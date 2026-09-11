/**
 * ControlSignalCatalog.js - NetHack WASM WebUI Control Signal Catalog (Vanilla / English)
 *
 * ブラウザネイティブESM環境 (GKLpureJSclient等) およびバンドラ双方で
 * MIMEタイプエラーなく直接インポート可能な JavaScript モジュール。
 */
export const enCatalog = {
  "version": "1.0.0",
  "variant": "vanilla",
  "locale": "en",
  "description": "NetHack WASM WebUI Control Signal Catalog (Vanilla NetHack 5.0 / English)",
  "signals": [
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
      "id": "SIGNAL_GENOCIDE_GENERIC",
      "subCategory": "GENOCIDE",
      "inputType": "LINE_TEXT",
      "priority": 100,
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
      "patterns": [
        "(?:which\\s+ring|which\\s+hand|which\\s+side|which\\s+(?:left|right))"
      ],
      "flags": "i",
      "params": {},
      "description": "Left/Right side selection prompt"
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
    }
  ]
};

export default enCatalog;
