/**
 * ControlSignalCatalog.ja.js - NetHack WASM WebUI 機械用制御シグナル辞書 (JNetHack / 日本語)
 *
 * ブラウザネイティブESM環境 (GKLpureJSclient等) およびバンドラ双方で
 * MIMEタイプエラーなく直接インポート可能な JavaScript モジュール。
 */
export const jaCatalog = {
  "version": "1.0.0",
  "variant": "jnethack",
  "locale": "ja",
  "description": "NetHack WASM WebUI 機械用制御シグナル辞書 (JNetHack / 日本語バリアント)",
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
        "何を願[うい]",
        "何をお望み",
        "何をご所望",
        "何を望む"
      ],
      "flags": "i",
      "params": {},
      "description": "願い (Wish) 入力プロンプト (JNetHack)"
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
        "どのクラスのモンスターを虐殺",
        "モンスターのクラス.*虐殺"
      ],
      "flags": "i",
      "params": {
        "mode": "CLASS"
      },
      "description": "虐殺 (Genocide) - モンスタークラス指定プロンプト (JNetHack)"
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
        "どの種類のモンスターを虐殺",
        "モンスターの種類.*虐殺"
      ],
      "flags": "i",
      "params": {
        "mode": "SINGLE"
      },
      "description": "虐殺 (Genocide) - 単体モンスター指定プロンプト (JNetHack)"
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
        "虐殺"
      ],
      "flags": "i",
      "params": {
        "mode": "ALL"
      },
      "description": "虐殺 (Genocide) - 汎用虐殺プロンプト (JNetHack)"
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
        "どの種類のモンスターになりますか"
      ],
      "flags": "i",
      "params": {},
      "description": "変化制御 (Polymorph Control) プロンプト (JNetHack)"
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
        "(?<containerName>.+?)(?:の中身)?(?:[をでは])?(?:どうしますか|何(?:を|に)しますか)"
      ],
      "flags": "i",
      "params": {
        "source": "LOOT_COMMAND"
      },
      "description": "#loot コマンド実行時のコンテナアクション選択メニュー (JNetHack)"
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
        "(?<containerName>.+?)(?:の中身)?(?:[をでは])?(?:どうしますか|何(?:を|に)しますか)"
      ],
      "flags": "i",
      "params": {},
      "description": "汎用コンテナアクション選択メニュー (JNetHack)"
    },
    {
      "id": "SIGNAL_CONTAINER_FLOOR_SELECT",
      "subCategory": "CONTAINER_FLOOR_SELECT",
      "inputType": "MENU",
      "priority": 100,
      "patterns": [
        "どのコンテナを物色",
        "どの容器を物色"
      ],
      "flags": "i",
      "params": {},
      "description": "床の複数コンテナ選択メニュー (JNetHack)"
    },
    {
      "id": "SIGNAL_CONTAINER_CATEGORY_SELECT",
      "subCategory": "CONTAINER_CATEGORY_SELECT",
      "inputType": "MENU",
      "priority": 100,
      "patterns": [
        "^(?<directionActionJa>取り出す|入れる)オブジェクトの種類",
        "^(?<directionActionJa>中に入れる|外に出す)アイテムの種類"
      ],
      "flags": "i",
      "paramsMapping": {
        "directionActionJa": {
          "取り出す": { "direction": "out" },
          "外に出す": { "direction": "out" },
          "入れる": { "direction": "in" },
          "中に入れる": { "direction": "in" }
        }
      },
      "params": {},
      "description": "コンテナ内/外 カテゴリ選択メニュー (JNetHack)"
    },
    {
      "id": "SIGNAL_CONTAINER_ITEM_SELECT",
      "subCategory": "CONTAINER_ITEM_SELECT",
      "inputType": "MENU",
      "priority": 100,
      "patterns": [
        "^(?<directionActionJa>何を中に入れますか|何を外に出しますか|何を取り出しますか|何を入れますか)"
      ],
      "flags": "i",
      "paramsMapping": {
        "directionActionJa": {
          "何を取り出しますか": { "direction": "out" },
          "何を外に出しますか": { "direction": "out" },
          "何を入れますか": { "direction": "in" },
          "何を中に入れますか": { "direction": "in" }
        }
      },
      "params": {},
      "description": "コンテナ アイテム個別選択メニュー (JNetHack)"
    },
    {
      "id": "SIGNAL_COUNT_PROMPT",
      "subCategory": "COUNT_PROMPT",
      "inputType": "LINE_TEXT",
      "priority": 100,
      "patterns": [
        "(?:何個|幾つ)(?:の)?(?<targetItemJa>[^？?]*)"
      ],
      "flags": "i",
      "params": {},
      "description": "数量指定プロンプト (JNetHack)"
    },
    {
      "id": "SIGNAL_DIRECTION",
      "subCategory": "DIRECTION",
      "inputType": "DIRECTION",
      "priority": 100,
      "patterns": [
        "どの方向",
        "どちらの方向",
        "方向"
      ],
      "flags": "i",
      "params": {},
      "description": "方向入力プロンプト (JNetHack)"
    },
    {
      "id": "SIGNAL_SIDE_SELECT",
      "subCategory": "SIDE_SELECT",
      "inputType": "CHOICE_BUTTONS",
      "priority": 100,
      "patterns": [
        "どちらの指輪",
        "どちらの手",
        "どちら側",
        "どの指輪",
        "左右"
      ],
      "flags": "i",
      "params": {},
      "description": "左右選択プロンプト (JNetHack)"
    },
    {
      "id": "SIGNAL_ITEM_SELECT",
      "subCategory": "ITEM_SELECT",
      "inputType": "CHOICE_BUTTONS",
      "priority": 90,
      "patterns": [
        "何を使用",
        "適用",
        "何を食べ",
        "何を飲",
        "何を読",
        "どの.*振",
        "何を装備",
        "何を外",
        "何を置",
        "何を投",
        "どのアイテム",
        "何を識別"
      ],
      "flags": "i",
      "params": {},
      "description": "アイテム選択プロンプト (JNetHack)"
    }
  ]
};

export default jaCatalog;
