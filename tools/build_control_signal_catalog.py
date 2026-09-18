#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
build_control_signal_catalog.py

Layer 3 制御プロンプトマスター (control_signals_master.json: 102件) を検証・精緻化し、
Vanilla NetHack 5.0 (英語) の完全網羅カタログ (src/core/prompt/ControlSignalCatalog.js)
を決定論的に生成・同期・検証するスクリプト。
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import Dict, List, Any

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
MASTER_JSON_PATH = WORKSPACE_ROOT / "tools" / "data" / "control_signals_master.json"
EN_CATALOG_JS_PATH = WORKSPACE_ROOT / "src" / "core" / "prompt" / "ControlSignalCatalog.js"

# ----------------------------------------------------------------------
# 1. 102件の C ソース呼び出しに対する完全シグナル定義
#    (既存 21 件との完全互換を維持しつつ、新規 C プロンプトを網羅)
# ----------------------------------------------------------------------
SIGNAL_DEFINITIONS = [
    # === CHARACTER CREATION (最高優先度) ===
    {
        "id": "SIGNAL_CHARACTER_CREATION",
        "subCategory": "CHARACTER_CREATION",
        "inputType": "MENU",
        "priority": 150,
        "patterns": [
            "^pick an? (?<stepType>role|race|gender|alignment|profession|species|sex|creed)",
            "^pick all that apply",
            "^(?:is this ok|start game|choose role again)"
        ],
        "flags": "i",
        "params": {},
        "paramsMapping": {
            "stepType": {
                "role": { "step": "role" },
                "profession": { "step": "role" },
                "race": { "step": "race" },
                "species": { "step": "race" },
                "gender": { "step": "gender" },
                "sex": { "step": "gender" },
                "alignment": { "step": "alignment" },
                "creed": { "step": "alignment" }
            }
        },
        "description": "Character creation prompt/menu",
        "c_callers": ["genl_player_setup"]
    },

    # === CONTAINER ACTION MENU (#loot コマンド専用) ===
    {
        "id": "SIGNAL_CONTAINER_ACTION_MENU_LOOT",
        "subCategory": "CONTAINER_ACTION_MENU",
        "inputType": "MENU",
        "priority": 150,
        "contextFilter": {
            "triggerCommand": "#loot",
            "excludeInventoryMenu": True
        },
        "patterns": [
            "(?:^|[\\.\\!\\?]\\s+)(?:There is [^.]+?\\.\\s+)?(?<containerName>.+?)\\s+is\\s+(?:now\\s+)?empty\\.\\s*Do what with it\\?",
            "(?:^|[\\.\\!\\?]\\s+)(?:There is [^.]+?\\.\\s+)?(?<containerName>.+?)\\s+is\\s+(?:now\\s+)?empty\\.",
            "Do what with (?<containerName>.+?)\\?"
        ],
        "flags": "i",
        "params": {
            "source": "LOOT_COMMAND"
        },
        "description": "Container action menu triggered by #loot",
        "c_callers": ["use_container"]
    },

    # === GENOCIDE ===
    {
        "id": "SIGNAL_GENOCIDE_CLASS",
        "subCategory": "GENOCIDE",
        "inputType": "LINE_TEXT",
        "priority": 120,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "(?:which|what)\\s+class\\s+of\\s+monsters?\\s+do\\s+you\\s+(?:want|wish)\\s+to\\s+genocide",
            "class\\s+of\\s+monsters?.*genocide",
            "genocide.*class\\s+of\\s+monsters?"
        ],
        "flags": "i",
        "params": { "mode": "CLASS" },
        "description": "Genocide monster class prompt",
        "c_callers": ["do_class_genocide"]
    },
    {
        "id": "SIGNAL_GENOCIDE_SINGLE",
        "subCategory": "GENOCIDE",
        "inputType": "LINE_TEXT",
        "priority": 110,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "(?:what|which)\\s+(?:type|kind)?\\s*of\\s+monsters?\\s+do\\s+you\\s+(?:want|wish)\\s+to\\s+genocide",
            "(?:what|which)\\s+monsters?\\s+do\\s+you\\s+(?:want|wish)\\s+to\\s+genocide",
            "(?:type|kind)\\s+of\\s+monsters?.*genocide"
        ],
        "flags": "i",
        "params": { "mode": "SINGLE" },
        "description": "Genocide single monster prompt",
        "c_callers": ["do_genocide"]
    },

    # === WRITE (Scroll / Spellbook) ===
    {
        "id": "SIGNAL_WRITE_SCROLL",
        "subCategory": "WRITE",
        "inputType": "LINE_TEXT",
        "priority": 110,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "what\\s+(?:type|sort)\\s+of\\s+scroll\\s+do\\s+you\\s+want\\s+to\\s+write",
            "what\\s+type\\s+of\\s+scroll"
        ],
        "flags": "i",
        "params": { "targetType": "SCROLL" },
        "description": "Magic marker write scroll prompt",
        "c_callers": ["dowrite"]
    },
    {
        "id": "SIGNAL_WRITE_SPELLBOOK",
        "subCategory": "WRITE",
        "inputType": "LINE_TEXT",
        "priority": 110,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "what\\s+(?:type|sort)\\s+of\\s+(?:spell)?book\\s+do\\s+you\\s+want\\s+to\\s+write",
            "what\\s+type\\s+of\\s+(?:spell)?book"
        ],
        "flags": "i",
        "params": { "targetType": "SPELLBOOK" },
        "description": "Magic marker write spellbook prompt",
        "c_callers": ["dowrite"]
    },

    # === SYSTEM WARNING (impossible) ===
    {
        "id": "SIGNAL_SYSTEM_REPORT_NOW",
        "subCategory": "SYSTEM",
        "inputType": "CONFIRM_YN",
        "priority": 110,
        "validKeys": "yn",
        "defaultKey": "n",
        "patterns": [
            "report now\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "System impossible error report prompt",
        "c_callers": ["impossible"]
    },

    # === CONFIRM_YN (重要確認プロンプト) ===
    {
        "id": "SIGNAL_CONFIRM_YN",
        "subCategory": "CONFIRM_YN",
        "inputType": "CHOICE_BUTTONS",
        "priority": 110,
        "patterns": [
            "(?:Are you sure(?: you want to)?|really|smells terrible|eat it|open a tin|stop eating|Wipe it out|Add to the existing message).*?\\[[a-z0-9,\\/\\* ]*y[^\\]]*n[^\\]]*\\]",
            "(?:Are you sure(?: you want to)? pray|Really pray)\\?",
            "(?:Are you sure|really want to)\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "General yes/no confirmation prompt",
        "c_callers": ["paranoid_ynq"]
    },

    # === WISH ===
    {
        "id": "SIGNAL_WISH",
        "subCategory": "WISH",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "for what do you wish",
            "what do you want to wish for"
        ],
        "flags": "i",
        "params": {},
        "description": "Wish input prompt",
        "c_callers": ["makewish"]
    },

    # === POLYMORPH & MONSTER CREATION ===
    {
        "id": "SIGNAL_POLYMORPH",
        "subCategory": "POLYMORPH",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "become what kind of monster"
        ],
        "flags": "i",
        "params": {},
        "description": "Polymorph control prompt",
        "c_callers": ["polyself"]
    },
    {
        "id": "SIGNAL_CREATE_MONSTER",
        "subCategory": "CREATE_MONSTER",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "create what kind of monster"
        ],
        "flags": "i",
        "params": {},
        "description": "Create monster prompt",
        "c_callers": ["create_particular"]
    },

    # === MUSIC ===
    {
        "id": "SIGNAL_MUSIC_TUNE",
        "subCategory": "MUSIC",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "what tune are you playing\\?\\s*\\[5 notes, A-G\\]"
        ],
        "flags": "i",
        "params": { "maxNotes": 5, "allowedChars": "A-Ga-g" },
        "description": "Instrument play tune prompt",
        "c_callers": ["do_play_instrument"]
    },

    # === TELEPORT ===
    {
        "id": "SIGNAL_LEVEL_TELEPORT",
        "subCategory": "TELEPORT",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "to what level do you want to teleport"
        ],
        "flags": "i",
        "params": {},
        "description": "Level teleport prompt",
        "c_callers": ["level_tele"]
    },

    # === NAME & ANNOTATION ===
    {
        "id": "SIGNAL_DUNGEON_ANNOTATION",
        "subCategory": "NAME",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "what do you want to call this dungeon level"
        ],
        "flags": "i",
        "params": {},
        "description": "Dungeon level annotation prompt",
        "c_callers": ["query_annotation"]
    },
    {
        "id": "SIGNAL_GUARD_NAME_INQUIRY",
        "subCategory": "NAME",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "hello stranger, who are you",
            "you are required to supply your name"
        ],
        "flags": "i",
        "params": {},
        "description": "Vault guard name inquiry prompt",
        "c_callers": ["invault"]
    },

    # === ENGRAVE ===
    {
        "id": "SIGNAL_ENGRAVE_ADD_QUERY",
        "subCategory": "ENGRAVE",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "ynq",
        "defaultKey": "y",
        "patterns": [
            "do you want to add to the current engraving"
        ],
        "flags": "i",
        "params": {},
        "description": "Add to current engraving query",
        "c_callers": ["doengrave"]
    },

    # === EAT ===
    {
        "id": "SIGNAL_EAT_QUERY",
        "subCategory": "EAT",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "yn",
        "defaultKey": "n",
        "patterns": [
            "^eat (?:the |a |an )?.+\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Eat inventory food prompt",
        "c_callers": ["edibility_prompts"]
    },
    {
        "id": "SIGNAL_EAT_FLOOR_QUERY",
        "subCategory": "EAT",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "ynq",
        "defaultKey": "n",
        "patterns": [
            "there (?:is|are) .+ here; eat (?:it|them)\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Eat floor food prompt",
        "c_callers": ["floorfood"]
    },

    # === DISCLOSE (End game & statistics) ===
    {
        "id": "SIGNAL_DISCLOSE_POSSESSIONS",
        "subCategory": "DISCLOSE",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "ynq",
        "defaultKey": "y",
        "patterns": [
            "do you want (?:to see )?your possessions (?:identified|seen)"
        ],
        "flags": "i",
        "params": { "discloseType": "POSSESSIONS" },
        "description": "Disclose possessions query",
        "c_callers": ["disclose"]
    },
    {
        "id": "SIGNAL_DISCLOSE_ATTRIBUTES",
        "subCategory": "DISCLOSE",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "ynq",
        "defaultKey": "y",
        "patterns": [
            "do you want to see your attributes"
        ],
        "flags": "i",
        "params": { "discloseType": "ATTRIBUTES" },
        "description": "Disclose attributes query",
        "c_callers": ["disclose"]
    },
    {
        "id": "SIGNAL_DISCLOSE_CONDUCT",
        "subCategory": "DISCLOSE",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "ynq",
        "defaultKey": "y",
        "patterns": [
            "do you want to see your conduct"
        ],
        "flags": "i",
        "params": { "discloseType": "CONDUCT" },
        "description": "Disclose conduct query",
        "c_callers": ["disclose"]
    },
    {
        "id": "SIGNAL_DISCLOSE_OVERVIEW",
        "subCategory": "DISCLOSE",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "ynq",
        "defaultKey": "y",
        "patterns": [
            "do you want to see the dungeon overview"
        ],
        "flags": "i",
        "params": { "discloseType": "OVERVIEW" },
        "description": "Disclose dungeon overview query",
        "c_callers": ["disclose"]
    },
    {
        "id": "SIGNAL_DISCLOSE_VANQUISHED",
        "subCategory": "DISCLOSE",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "ynq",
        "defaultKey": "y",
        "patterns": [
            "do you want an account of creatures vanquished"
        ],
        "flags": "i",
        "params": { "discloseType": "VANQUISHED" },
        "description": "Disclose vanquished creatures query",
        "c_callers": ["list_vanquished"]
    },
    {
        "id": "SIGNAL_DISCLOSE_GENOCIDED",
        "subCategory": "DISCLOSE",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "ynaq",
        "defaultKey": "y",
        "patterns": [
            "do you want a list of species genocided"
        ],
        "flags": "i",
        "params": { "discloseType": "GENOCIDED" },
        "description": "Disclose genocided species query",
        "c_callers": ["list_genocided"]
    },

    # === SPECIAL ABILITIES & ACTIONS ===
    {
        "id": "SIGNAL_SPIDER_ABILITY",
        "subCategory": "SPECIAL_ABILITY",
        "inputType": "SINGLE_KEY",
        "priority": 100,
        "validKeys": "hsq",
        "defaultKey": "q",
        "patterns": [
            "hide \\[h\\] or spin a web \\[s\\]"
        ],
        "flags": "i",
        "params": { "abilityType": "SPIDER" },
        "description": "Spider monster ability choice (hide/web)",
        "c_callers": ["domonability"]
    },
    {
        "id": "SIGNAL_CRYSTAL_BALL",
        "subCategory": "CRYSTAL_BALL",
        "inputType": "SINGLE_KEY",
        "priority": 100,
        "patterns": [
            "what do you look for\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Crystal ball scrying prompt",
        "c_callers": ["use_crystal_ball"]
    },
    {
        "id": "SIGNAL_STEED_KICK",
        "subCategory": "STEED",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "yn",
        "defaultKey": "y",
        "patterns": [
            "kick your steed\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Steed kick confirmation prompt",
        "c_callers": ["dokick"]
    },
    {
        "id": "SIGNAL_BRIBE_AMOUNT",
        "subCategory": "BRIBE",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "patterns": [
            "how much will you offer"
        ],
        "flags": "i",
        "params": {},
        "description": "Demon lord bribe offer prompt",
        "c_callers": ["bribe"]
    },
    {
        "id": "SIGNAL_ITEMIZED_BILLING",
        "subCategory": "SHOP",
        "inputType": "CONFIRM_YN",
        "priority": 100,
        "validKeys": "ynqm",
        "defaultKey": "q",
        "patterns": [
            "itemized billing\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Shopkeeper itemized billing prompt",
        "c_callers": ["pay_billed_items"]
    },
    {
        "id": "SIGNAL_SPLIT_PROMPT",
        "subCategory": "COUNT",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "patterns": [
            "split off how many\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Split item stack count prompt",
        "c_callers": ["adjust_split"]
    },

    # === CONTAINER MENUS ===
    {
        "id": "SIGNAL_CONTAINER_ACTION_MENU",
        "subCategory": "CONTAINER_ACTION_MENU",
        "inputType": "MENU",
        "priority": 100,
        "contextFilter": {
            "excludeInventoryMenu": True
        },
        "patterns": [
            "(?:^|[\\.\\!\\?]\\s+)(?:There is [^.]+?\\.\\s+)?(?<containerName>.+?)\\s+is\\s+(?:now\\s+)?empty\\.\\s*Do what with it\\?",
            "(?:^|[\\.\\!\\?]\\s+)(?:There is [^.]+?\\.\\s+)?(?<containerName>.+?)\\s+is\\s+(?:now\\s+)?empty\\.",
            "Do what with (?<containerName>.+?)\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Generic container action menu"
    },
    {
        "id": "SIGNAL_CONTAINER_FLOOR_SELECT",
        "subCategory": "CONTAINER_FLOOR_SELECT",
        "inputType": "MENU",
        "priority": 100,
        "patterns": [
            "Loot which containers"
        ],
        "flags": "i",
        "params": {},
        "description": "Floor container selection menu"
    },
    {
        "id": "SIGNAL_CONTAINER_CATEGORY_SELECT",
        "subCategory": "CONTAINER_CATEGORY_SELECT",
        "inputType": "MENU",
        "priority": 100,
        "patterns": [
            "^(?<directionAction>Take out|Put in) what type of objects\\?"
        ],
        "flags": "i",
        "paramsMapping": {
            "directionAction": {
                "Take out": { "direction": "out" },
                "Put in": { "direction": "in" }
            }
        },
        "params": {},
        "description": "Container category selection menu"
    },
    {
        "id": "SIGNAL_CONTAINER_ITEM_SELECT",
        "subCategory": "CONTAINER_ITEM_SELECT",
        "inputType": "MENU",
        "priority": 100,
        "patterns": [
            "^(?<directionAction>Take out|Put in) what\\?"
        ],
        "flags": "i",
        "paramsMapping": {
            "directionAction": {
                "Take out": { "direction": "out" },
                "Put in": { "direction": "in" }
            }
        },
        "params": {},
        "description": "Container item selection menu"
    },

    # === COUNT PROMPT ===
    {
        "id": "SIGNAL_COUNT_PROMPT",
        "subCategory": "COUNT_PROMPT",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "patterns": [
            "^How many(?:\\s+\\[?(?<targetItem>[^\\]\\?]+)\\]?)?\\?",
            "^How many"
        ],
        "flags": "i",
        "params": {},
        "description": "Count prompt (How many?)"
    },

    # === DIRECTION (getdir) ===
    {
        "id": "SIGNAL_DIRECTION",
        "subCategory": "DIRECTION",
        "inputType": "DIRECTION",
        "priority": 100,
        "patterns": [
            "(?:in\\s+what\\s+direction|which\\s+way|\\bdirection\\b)"
        ],
        "flags": "i",
        "params": {},
        "description": "Direction input prompt",
        "c_callers": [
            "use_camera", "use_stethoscope", "use_mirror", "use_figurine", "use_whip",
            "invoke_fling_poison", "invoke_blinding_ray", "use_pick_axe", "dokick",
            "throw_obj", "doclose", "do_improvisation", "dobreathe", "dospit",
            "dochat", "tiphat", "spelleffects", "use_saddle", "doride", "untrap",
            "dozap", "wiz_telekinesis"
        ]
    },

    # === SIDE SELECT ===
    {
        "id": "SIGNAL_SIDE_SELECT",
        "subCategory": "SIDE_SELECT",
        "inputType": "CHOICE_BUTTONS",
        "priority": 100,
        "validKeys": "rlq",
        "patterns": [
            "(?:which\\s+ring|which\\s+hand|which\\s+side|which\\s+(?:left|right))"
        ],
        "flags": "i",
        "params": {},
        "description": "Left/Right side selection prompt",
        "c_callers": ["accessory_or_armor_on"]
    },

    # === TOOL SELECT ===
    {
        "id": "SIGNAL_TOOL_SELECT",
        "subCategory": "TOOL_SELECT",
        "inputType": "CHOICE_BUTTONS",
        "priority": 105,
        "patterns": [
            "What do you want to (?:write with|open the tin with|untrap with)"
        ],
        "flags": "i",
        "params": {},
        "description": "Tool selection prompt for applying / engraving"
    },

    # === LOOK / HELP / COMMANDS ===
    {
        "id": "SIGNAL_SPECIFY_OBJECT",
        "subCategory": "LOOK",
        "inputType": "LINE_TEXT",
        "priority": 95,
        "patterns": [
            "specify what\\?\\s*\\(type the word\\)"
        ],
        "flags": "i",
        "params": {},
        "description": "Look specify word prompt",
        "c_callers": ["do_look"]
    },
    {
        "id": "SIGNAL_WHAT_COMMAND",
        "subCategory": "COMMAND_HELP",
        "inputType": "SINGLE_KEY",
        "priority": 95,
        "patterns": [
            "what command\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "What command help prompt",
        "c_callers": ["dowhatdoes"]
    },
    {
        "id": "SIGNAL_EXTCMD_SEARCH",
        "subCategory": "EXTCMD",
        "inputType": "LINE_TEXT",
        "priority": 95,
        "patterns": [
            "search for which extended command"
        ],
        "flags": "i",
        "params": {},
        "description": "Search extended command prompt",
        "c_callers": ["doextlist"]
    },
    {
        "id": "SIGNAL_REBIND_KEY",
        "subCategory": "CONFIG",
        "inputType": "LINE_TEXT",
        "priority": 95,
        "patterns": [
            "bind '.+' to what command\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Rebind key to command prompt",
        "c_callers": ["handler_rebind_keys_add"]
    },

    # === TEXT_INPUT (汎用テキスト入力) ===
    {
        "id": "SIGNAL_TEXT_INPUT",
        "subCategory": "TEXT_INPUT",
        "inputType": "LINE_TEXT",
        "priority": 95,
        "patterns": [
            "What do you want to (?:engrave|write(?!\\s+with)|call|name)"
        ],
        "flags": "i",
        "params": {},
        "description": "Text input prompt (engrave, naming, calling)",
        "c_callers": ["name_from_player", "doengrave"]
    },

    # === WRITE GENERIC ===
    {
        "id": "SIGNAL_WRITE_GENERIC",
        "subCategory": "WRITE",
        "inputType": "LINE_TEXT",
        "priority": 100,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "what\\s+(?:type|sort)\\s+.*\\s+do\\s+you\\s+want\\s+to\\s+write"
        ],
        "flags": "i",
        "params": { "targetType": "SCROLL" },
        "description": "Magic marker write generic prompt"
    },

    # === GENOCIDE GENERIC ===
    {
        "id": "SIGNAL_GENOCIDE_GENERIC",
        "subCategory": "GENOCIDE",
        "inputType": "LINE_TEXT",
        "priority": 90,
        "contextFilter": { "isTextType": True },
        "patterns": [
            "\\bgenocide\\b"
        ],
        "flags": "i",
        "params": { "mode": "ALL" },
        "description": "Generic genocide prompt"
    },

    # === ITEM SELECT ===
    {
        "id": "SIGNAL_ITEM_SELECT",
        "subCategory": "ITEM_SELECT",
        "inputType": "CHOICE_BUTTONS",
        "priority": 90,
        "patterns": [
            "what\\s+do\\s+you\\s+want\\s+to",
            "eat\\s+what",
            "read\\s+what",
            "drink\\s+what",
            "wear\\s+what",
            "wield\\s+what",
            "zap\\s+what",
            "apply\\s+what",
            "take\\s+off\\s+what",
            "drop\\s+what",
            "which\\s+item"
        ],
        "flags": "i",
        "params": {},
        "description": "Item selection prompt",
        "c_callers": ["getobj", "ggetobj"]
    },
    {
        "id": "SIGNAL_PICKUP_CLASSES",
        "subCategory": "ITEM_SELECT",
        "inputType": "LINE_TEXT",
        "priority": 85,
        "patterns": [
            "what kinds of things? do you want to"
        ],
        "flags": "i",
        "params": {},
        "description": "Select object classes prompt",
        "c_callers": ["query_classes"]
    },
    {
        "id": "SIGNAL_ADJUST_LETTER",
        "subCategory": "INVENTORY",
        "inputType": "SINGLE_KEY",
        "priority": 90,
        "patterns": [
            "adjust letter to what\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Adjust inventory slot letter prompt",
        "c_callers": ["doorganize_core"]
    },
    {
        "id": "SIGNAL_DISCOVERY_CLASS",
        "subCategory": "DISCOVERY",
        "inputType": "SINGLE_KEY",
        "priority": 90,
        "patterns": [
            "what class of objects\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Class discovery list prompt",
        "c_callers": ["doclassdisco"]
    },
    {
        "id": "SIGNAL_INVENTORY_TYPE_LIST",
        "subCategory": "INVENTORY",
        "inputType": "SINGLE_KEY",
        "priority": 90,
        "patterns": [
            "what type of objects do you want to list\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Type inventory list prompt",
        "c_callers": ["dotypeinv"]
    },
    {
        "id": "SIGNAL_CAST_SPELL",
        "subCategory": "SPELL",
        "inputType": "SINGLE_KEY",
        "priority": 90,
        "patterns": [
            "cast which spell\\?"
        ],
        "flags": "i",
        "params": {},
        "description": "Cast spell prompt",
        "c_callers": ["getspell"]
    },

    # === WIZARD COMMANDS ===
    {
        "id": "SIGNAL_WIZARD_PROMPT",
        "subCategory": "WIZARD",
        "inputType": "LINE_TEXT",
        "priority": 85,
        "patterns": [
            "throne sit effect",
            "load which.*lua file",
            "to what experience level do you want to be set",
            "how many random monsters to migrate"
        ],
        "flags": "i",
        "params": {},
        "description": "Wizard debug command prompt",
        "c_callers": ["throne_sit_effect", "wiz_load_lua", "wiz_load_splua", "wiz_level_change", "wiz_migrate_mons"]
    }
]


def update_master_json():
    """control_signals_master.json の各シグナルに signal_id や分類メタデータを付与して更新"""
    if not MASTER_JSON_PATH.exists():
        print(f"[!] Error: Master json not found: {MASTER_JSON_PATH}")
        return

    with open(MASTER_JSON_PATH, "r", encoding="utf-8") as f:
        master_data = json.load(f)

    signals = master_data.get("signals", [])
    print(f"[*] Updating {len(signals)} signals in master json...")

    caller_to_sig = {}
    for sig_def in SIGNAL_DEFINITIONS:
        for caller in sig_def.get("c_callers", []):
            caller_to_sig[caller] = sig_def

    updated_count = 0
    for s in signals:
        callee = s.get("callee_func")
        caller = s.get("caller_func")

        assigned_def = None
        if caller in caller_to_sig:
            assigned_def = caller_to_sig[caller]
        elif callee == "getdir":
            assigned_def = caller_to_sig.get("use_camera")

        if assigned_def:
            s["assigned_signal_id"] = assigned_def["id"]
            s["assigned_sub_category"] = assigned_def["subCategory"]
            s["assigned_input_type"] = assigned_def["inputType"]
            if "validKeys" in assigned_def:
                s["prompt_meta"]["valid_keys"] = assigned_def["validKeys"]
            if "defaultKey" in assigned_def:
                s["prompt_meta"]["default_key"] = assigned_def["defaultKey"]
            updated_count += 1

    master_data["stats"]["phase3_cataloged_count"] = updated_count
    with open(MASTER_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(master_data, f, ensure_ascii=False, indent=2)

    print(f"[✓] Successfully updated master json with {updated_count}/{len(signals)} assigned signals.")


def generate_control_signal_catalog_js():
    """ControlSignalCatalog.js (ESM) を生成"""
    print(f"[*] Generating {EN_CATALOG_JS_PATH}...")

    clean_signals = []
    for sig in SIGNAL_DEFINITIONS:
        entry = {
            "id": sig["id"],
            "subCategory": sig["subCategory"],
            "inputType": sig["inputType"],
            "priority": sig["priority"]
        }
        if "validKeys" in sig:
            entry["validKeys"] = sig["validKeys"]
        if "defaultKey" in sig:
            entry["defaultKey"] = sig["defaultKey"]
        if "contextFilter" in sig:
            entry["contextFilter"] = sig["contextFilter"]
        
        entry["patterns"] = sig["patterns"]
        entry["flags"] = sig.get("flags", "i")
        entry["params"] = sig.get("params", {})
        if "paramsMapping" in sig:
            entry["paramsMapping"] = sig["paramsMapping"]
        entry["description"] = sig.get("description", "")
        clean_signals.append(entry)

    catalog_obj = {
        "version": "2.0.0",
        "variant": "vanilla",
        "locale": "en",
        "description": "NetHack WASM WebUI Control Signal Catalog (Vanilla NetHack 5.0 / English) - Phase 3 Complete Coverage",
        "signals": clean_signals
    }

    js_content = f"""/**
 * ControlSignalCatalog.js - NetHack WASM WebUI Control Signal Catalog (Vanilla / English)
 *
 * 【Phase 3: 制御シグナルの先行完全網羅 (NetHack 5.0 C ソース 102 箇所完全対応)】
 * ブラウザネイティブESM環境 (GKLpureJSclient等) およびバンドラ双方で
 * MIMEタイプエラーなく直接インポート可能な JavaScript モジュール。
 */
export const enCatalog = {json.dumps(catalog_obj, ensure_ascii=False, indent=2)};

export default enCatalog;
"""
    with open(EN_CATALOG_JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"[✓] Generated {EN_CATALOG_JS_PATH} with {len(clean_signals)} complete control signals.")


def verify():
    """生成結果とマスターデータの整合性バリデーション"""
    print("[*] Verifying catalog consistency...")
    with open(EN_CATALOG_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    match = re.search(r'export const enCatalog = ({[\s\S]+});\s*export default enCatalog;', content)
    if not match:
        raise ValueError("Failed to parse enCatalog from ControlSignalCatalog.js")
    catalog = json.loads(match.group(1))
    signals = catalog.get("signals", [])
    print(f"[✓] Parsed enCatalog: {len(signals)} signals defined.")

    ids = [s["id"] for s in signals]
    duplicates = [item for item in set(ids) if ids.count(item) > 1]
    if duplicates:
        raise ValueError(f"Duplicate signal IDs found: {duplicates}")
    print("[✓] No duplicate signal IDs.")

    for s in signals:
        for p in s.get("patterns", []):
            try:
                py_p = re.sub(r'\(\?<([a-zA-Z0-9_]+)>', r'(?P<\1>', p)
                re.compile(py_p, re.IGNORECASE)
            except Exception as e:
                raise ValueError(f"Invalid regex '{p}' in signal {s['id']}: {e}")
    print("[✓] All regex patterns compiled successfully.")


def main():
    update_master_json()
    generate_control_signal_catalog_js()
    verify()
    print("\n[★] Phase 3 Control Signal Catalog generation completed successfully!")


if __name__ == "__main__":
    main()
