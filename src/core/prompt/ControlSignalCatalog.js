/**
 * ControlSignalCatalog.js - NetHack WASM WebUI Control Signal Catalog (Vanilla / English)
 *
 * 【Phase 3: 制御シグナルの先行完全網羅 (NetHack 5.0 C ソース 102 箇所完全対応)】
 * ブラウザネイティブESM環境 (GKLpureJSclient等) およびバンドラ双方で
 * MIMEタイプエラーなく直接インポート可能な JavaScript モジュール。
 */
export const enCatalog = {
  "version": "2.0.0",
  "variant": "vanilla",
  "locale": "en",
  "description": "NetHack WASM WebUI Control Signal Catalog (Vanilla NetHack 5.0 / English) - Phase 3 Complete Coverage",
  "signals": [
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
          "role": {
            "step": "role"
          },
          "profession": {
            "step": "role"
          },
          "race": {
            "step": "race"
          },
          "species": {
            "step": "race"
          },
          "gender": {
            "step": "gender"
          },
          "sex": {
            "step": "gender"
          },
          "alignment": {
            "step": "alignment"
          },
          "creed": {
            "step": "alignment"
          }
        }
      },
      "description": "Character creation prompt/menu"
    },
    {
      "id": "SIGNAL_CONTAINER_ACTION_MENU_LOOT",
      "subCategory": "CONTAINER_ACTION_MENU",
      "inputType": "MENU",
      "priority": 150,
      "contextFilter": {
        "triggerCommand": "#loot",
        "excludeInventoryMenu": true
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
      "description": "Container action menu triggered by #loot"
    },
    {
      "id": "SIGNAL_GENOCIDE_CLASS",
      "subCategory": "GENOCIDE",
      "inputType": "LINE_TEXT",
      "priority": 120,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "(?:which|what)\\s+class\\s+of\\s+monsters?\\s+do\\s+you\\s+(?:want|wish)\\s+to\\s+genocide",
        "class\\s+of\\s+monsters?.*genocide",
        "genocide.*class\\s+of\\s+monsters?"
      ],
      "flags": "i",
      "params": {
        "mode": "CLASS"
      },
      "description": "Genocide monster class prompt"
    },
    {
      "id": "SIGNAL_GENOCIDE_SINGLE",
      "subCategory": "GENOCIDE",
      "inputType": "LINE_TEXT",
      "priority": 110,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "(?:what|which)\\s+(?:type|kind)?\\s*of\\s+monsters?\\s+do\\s+you\\s+(?:want|wish)\\s+to\\s+genocide",
        "(?:what|which)\\s+monsters?\\s+do\\s+you\\s+(?:want|wish)\\s+to\\s+genocide",
        "(?:type|kind)\\s+of\\s+monsters?.*genocide"
      ],
      "flags": "i",
      "params": {
        "mode": "SINGLE"
      },
      "description": "Genocide single monster prompt"
    },
    {
      "id": "SIGNAL_WRITE_SCROLL",
      "subCategory": "WRITE",
      "inputType": "LINE_TEXT",
      "priority": 110,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "what\\s+(?:type|sort)\\s+of\\s+scroll\\s+do\\s+you\\s+want\\s+to\\s+write",
        "what\\s+type\\s+of\\s+scroll"
      ],
      "flags": "i",
      "params": {
        "targetType": "SCROLL"
      },
      "description": "Magic marker write scroll prompt"
    },
    {
      "id": "SIGNAL_WRITE_SPELLBOOK",
      "subCategory": "WRITE",
      "inputType": "LINE_TEXT",
      "priority": 110,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "what\\s+(?:type|sort)\\s+of\\s+(?:spell)?book\\s+do\\s+you\\s+want\\s+to\\s+write",
        "what\\s+type\\s+of\\s+(?:spell)?book"
      ],
      "flags": "i",
      "params": {
        "targetType": "SPELLBOOK"
      },
      "description": "Magic marker write spellbook prompt"
    },
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
      "description": "System impossible error report prompt"
    },
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
      "description": "General yes/no confirmation prompt"
    },
    {
      "id": "SIGNAL_WISH",
      "subCategory": "WISH",
      "inputType": "LINE_TEXT",
      "priority": 100,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "for what do you wish",
        "what do you want to wish for"
      ],
      "flags": "i",
      "params": {},
      "description": "Wish input prompt"
    },
    {
      "id": "SIGNAL_POLYMORPH",
      "subCategory": "POLYMORPH",
      "inputType": "LINE_TEXT",
      "priority": 100,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "become what kind of monster"
      ],
      "flags": "i",
      "params": {},
      "description": "Polymorph control prompt"
    },
    {
      "id": "SIGNAL_CREATE_MONSTER",
      "subCategory": "CREATE_MONSTER",
      "inputType": "LINE_TEXT",
      "priority": 100,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "create what kind of monster"
      ],
      "flags": "i",
      "params": {},
      "description": "Create monster prompt"
    },
    {
      "id": "SIGNAL_MUSIC_TUNE",
      "subCategory": "MUSIC",
      "inputType": "LINE_TEXT",
      "priority": 100,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "what tune are you playing\\?\\s*\\[5 notes, A-G\\]"
      ],
      "flags": "i",
      "params": {
        "maxNotes": 5,
        "allowedChars": "A-Ga-g"
      },
      "description": "Instrument play tune prompt"
    },
    {
      "id": "SIGNAL_LEVEL_TELEPORT",
      "subCategory": "TELEPORT",
      "inputType": "LINE_TEXT",
      "priority": 100,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "to what level do you want to teleport"
      ],
      "flags": "i",
      "params": {},
      "description": "Level teleport prompt"
    },
    {
      "id": "SIGNAL_DUNGEON_ANNOTATION",
      "subCategory": "NAME",
      "inputType": "LINE_TEXT",
      "priority": 100,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "what do you want to call this dungeon level"
      ],
      "flags": "i",
      "params": {},
      "description": "Dungeon level annotation prompt"
    },
    {
      "id": "SIGNAL_GUARD_NAME_INQUIRY",
      "subCategory": "NAME",
      "inputType": "LINE_TEXT",
      "priority": 100,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "hello stranger, who are you",
        "you are required to supply your name"
      ],
      "flags": "i",
      "params": {},
      "description": "Vault guard name inquiry prompt"
    },
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
      "description": "Add to current engraving query"
    },
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
      "description": "Eat inventory food prompt"
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
      "description": "Eat floor food prompt"
    },
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
      "params": {
        "discloseType": "POSSESSIONS"
      },
      "description": "Disclose possessions query"
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
      "params": {
        "discloseType": "ATTRIBUTES"
      },
      "description": "Disclose attributes query"
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
      "params": {
        "discloseType": "CONDUCT"
      },
      "description": "Disclose conduct query"
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
      "params": {
        "discloseType": "OVERVIEW"
      },
      "description": "Disclose dungeon overview query"
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
      "params": {
        "discloseType": "VANQUISHED"
      },
      "description": "Disclose vanquished creatures query"
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
      "params": {
        "discloseType": "GENOCIDED"
      },
      "description": "Disclose genocided species query"
    },
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
      "params": {
        "abilityType": "SPIDER"
      },
      "description": "Spider monster ability choice (hide/web)"
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
      "description": "Crystal ball scrying prompt"
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
      "description": "Steed kick confirmation prompt"
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
      "description": "Demon lord bribe offer prompt"
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
      "description": "Shopkeeper itemized billing prompt"
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
      "description": "Split item stack count prompt"
    },
    {
      "id": "SIGNAL_CONTAINER_ACTION_MENU",
      "subCategory": "CONTAINER_ACTION_MENU",
      "inputType": "MENU",
      "priority": 100,
      "contextFilter": {
        "excludeInventoryMenu": true
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
      "params": {},
      "paramsMapping": {
        "directionAction": {
          "Take out": {
            "direction": "out"
          },
          "Put in": {
            "direction": "in"
          }
        }
      },
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
      "params": {},
      "paramsMapping": {
        "directionAction": {
          "Take out": {
            "direction": "out"
          },
          "Put in": {
            "direction": "in"
          }
        }
      },
      "description": "Container item selection menu"
    },
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
      "description": "Direction input prompt"
    },
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
      "description": "Left/Right side selection prompt"
    },
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
      "description": "Look specify word prompt"
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
      "description": "What command help prompt"
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
      "description": "Search extended command prompt"
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
      "description": "Rebind key to command prompt"
    },
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
      "description": "Text input prompt (engrave, naming, calling)"
    },
    {
      "id": "SIGNAL_WRITE_GENERIC",
      "subCategory": "WRITE",
      "inputType": "LINE_TEXT",
      "priority": 100,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "what\\s+(?:type|sort)\\s+.*\\s+do\\s+you\\s+want\\s+to\\s+write"
      ],
      "flags": "i",
      "params": {
        "targetType": "SCROLL"
      },
      "description": "Magic marker write generic prompt"
    },
    {
      "id": "SIGNAL_GENOCIDE_GENERIC",
      "subCategory": "GENOCIDE",
      "inputType": "LINE_TEXT",
      "priority": 90,
      "contextFilter": {
        "isTextType": true
      },
      "patterns": [
        "\\bgenocide\\b"
      ],
      "flags": "i",
      "params": {
        "mode": "ALL"
      },
      "description": "Generic genocide prompt"
    },
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
      "description": "Item selection prompt"
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
      "description": "Select object classes prompt"
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
      "description": "Adjust inventory slot letter prompt"
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
      "description": "Class discovery list prompt"
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
      "description": "Type inventory list prompt"
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
      "description": "Cast spell prompt"
    },
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
      "description": "Wizard debug command prompt"
    }
  ]
};

export default enCatalog;
