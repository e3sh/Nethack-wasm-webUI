---
title: i18n_translator_plugin_architecture
status: active
last_updated: 2026-08-15
related_code:
  - src/
---

# WebUICore i18n プラグイン差し替えアーキテクチャ設計仕様書
## (i18n Translator Plugin Architecture & Dependency Injection)

## 1. 背景と設計方針

現行の `WebUICore` は、初期化時に内部で直書きされた `TranslationEngine`（日本語/JP 辞書）をインスタンス化しており、特定言語（日本語）前提のロジックがコアファサードに結合しています。

将来的に NetHack WebUI を多言語展開（中国語、フランス語、ドイツ語等への切り替え）し、また外部の翻訳ライブラリ（`i18next` や AI リアルタイム翻訳等）やサードパーティ製辞書を自由に差し替え可能にするため、**翻訳機能を Core 本体から完全に分離し、`ITranslator` インターフェースによるプラグイン注入（Dependency Injection: DI）構造へ刷新** します。

```
+-----------------------------------------------------------------------------------+
|                            WebUICore (Language-Agnostic Core SDK)                 |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | translator: ITranslator (抽象インターフェース契約)                          |  |
|  | ・translate(text: string): string                                           |  |
|  | ・lookupWord?(word: string, pos?: string): string                           |  |
|  | ・resolveFileText?(filename: string, fileText: string, FS?: any): Promise   |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                          ▲
                         (依存性の注入 / プラグイン差し替え)
                                          │
    +-------------------------------------+-------------------------------------+
    │                                     │                                     │
+---+-------------------+   +-------------+---------+   +-----------------------+---+
| JapaneseTranslationEngine| | CustomDictTranslator   | | NullTranslator            |
| (現行 JP 翻訳エンジン)  |   | (他言語・任意辞書)      | | (無翻訳/英語パススルー)|
+-----------------------+   +-----------------------+   +---------------------------+
```

## 2. インターフェース定義 (`ITranslator`) ＆ 文脈型 (`TranslationContext`)

全翻訳プラグインが満たすべき統一契約シグネチャです。同音異義語の誤訳抑止および各文脈別の制御を行うため、**`context`（文脈種別）** 引数をサポートします。

### TypeScript 型定義 (`src/core/translation/ITranslator.ts`)

```typescript
export type TranslationContext = 
  | 'log'         // ゲーム進行ログメッセージ (putstr / windowId: 1)
  | 'prompt'      // Y/N や AskName などの問い合せプロンプト (inputRequired / YN, KEY)
  | 'menu_item'   // インベントリやオプションなどの選択項目 (inputRequired / MENU)
  | 'file'        // ヘルプやガイドブック等のテキストファイル (display_file / textWindow)
  | 'ui';         // クライアント UI 固有文言 (ボタン名、ヘッダー等)

export interface ITranslator {
    /**
     * 指定されたテキストメッセージ・プロンプトを翻訳して返却
     * @param text 翻訳対象テキスト
     * @param context (オプション) 文脈種別 ('log' | 'prompt' | 'menu_item' | 'file' | 'ui')
     */
    translate(text: string, context?: TranslationContext): string;

    /**
     * (オプション) 単語・名詞の辞書引き
     */
    lookupWord?(word: string, pos?: string): string;

    /**
     * (オプション) display_file 等のテキストファイル全編の翻訳解凍
     */
    resolveFileText?(filename: string, fileText: string, FS?: any): Promise<string>;

    /**
     * (オプション) 翻訳機能の有効/無効切替
     */
    setEnabled?(enabled: boolean): void;
}
```

---

## 3. `lang` (ロケール) と `translate_enabled` (機能スイッチ) の概念分離

これまで混同されがちであった「表示言語」と「翻訳エンジン機能のON/OFF」を明確に分離して取り扱います。

| パラメータ | 役割・概念 | 値の例 | 目的・用途 |
| :--- | :--- | :--- | :--- |
| **`lang`**<br>(ロケール) | アプリ全体の**ターゲット表示言語** | `"ja"`, `"en"`, `"zh-CN"` | UI 全体の言語セット、標準メッセージ、ドキュメントの言語定義。 |
| **`translate_enabled`**<br>(機能スイッチ) | 翻訳エンジンを**通すか / 素通り(Pass-through)させるか** | `true` (有効) / `false` (素通り) | Wasm コアから届く英文メッセージを動的翻訳するか、生の原文 (Raw English) で出力するかの機能トグル。 |

### `context` と連動した高度な表示制御モデル
`lang = "ja"`（日本語表示モード）であっても、`translate_enabled` および `context` を用いることで以下のような柔軟な制御が可能となります：

- `lang === "ja"` 且つ `translate_enabled === true`: 全要素 (`'log'`, `'prompt'`, `'menu_item'`, `'file'`, `'ui'`) を日本語で翻訳表示。
- `lang === "ja"` 且つ `translate_enabled === false`: UI (`'ui'`) やプロンプト (`'prompt'`) は日本語表示のままだが、**ゲーム進行ログ (`'log'`) のみ原文英語 (Raw English) で出力**（デバッグ・原文比較用途）。

---

## 4. 型指定パターンマッピング ＆ 複合アイテムフレーズ解析 (`decomposeItemName`)

同音異義語の誤置換防止および翻訳精度向上のため、正規表現パターンのキャプチャグループへカテゴリ型 (`'entity'`, `'item'`, `'role'` 等) を割り当てる **Typed Pattern Engine** 仕様を定義します。

### (1) 型指定パターン定義構造 (Typed Pattern Matching)
```javascript
{
    id: "pat_pickup_item",
    pattern: /^You pick up (a|an|the) (.+)\.$/,
    replace: "{1:item} を拾い上げた。",
    types: {
        2: 'item' // グループ2を nhItems / decomposeItemName でピンポイント解析
    }
}
```

### (2) 複合アイテムフレーズ解析の実績 (`decomposeItemName`)
`types[n] === 'item'` または `context === 'menu_item'` が指定された場合、現行 `TranslationEngine.js` で検証実績のある **`decomposeItemName(msg)`** パイプラインが起動し、単なる辞書引きにとどまらない高度なフレーズ分解・合成を実行します。

```javascript
// decomposeItemName の解析＆合成フロー
1. サフィックス切り出し : (in use), (written upon) 等
2. 数量・冠詞切り出し  : a, an, 3 等
3. 状態切り出し       : empty 等
4. BUC切り出し         : blessed, cursed, uncursed, locked 等
5. 損耗・属性切り出し  : greased, burnt, rusty, corroded, poisoned 等
6. 強化値切り出し     : +1, -2 等
7. 一対切り出し       : pair of 等
8. 本体辞書引き       : lookupWord(itemResult, 'noun')
9. 日本語順への再合成 : (BUC) + (損耗) + (強化値) + (本体) + (数量)
```

---

## 5. 実装クラス群の設計

### (1) `NullTranslator` (デフォルト/無翻訳パススルー)
翻訳処理を行わず、引数の英文をそのまま返す軽量クラス。単体テストやオリジナル英語版動作で利用。

```javascript
export class NullTranslator {
    translate(text) {
        return text || '';
    }
    lookupWord(word) {
        return word || '';
    }
    async resolveFileText(filename, fileText) {
        return fileText || '';
    }
}
```

### (2) `JapaneseTranslationEngine` (現行 JP 翻訳エンジン)
`nhMessage()`, `nhPatterns()`, `nhEntities()`, `nhItems()` を内蔵した日本語特化ハイブリッド翻訳プラグイン。

```javascript
import { NullTranslator } from './NullTranslator.js';

export class JapaneseTranslationEngine extends NullTranslator {
    constructor(options = {}) {
        super();
        this.enabled = options.enabled !== undefined ? options.enabled : true;
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
    }

    translate(text) {
        if (!this.enabled || !text) return text;
        // 既存の 3層ハイブリッド (完全一致 -> 正規表現 -> 名詞単語置換) ロジック
        return translateJapaneseInternal(text);
    }

    lookupWord(word, pos = 'noun') {
        if (!this.enabled || !word) return word;
        return lookupJapaneseWordInternal(word, pos);
    }
}
```

### (3) `CustomDictTranslator` (他言語・汎用 JSON 辞書アダプター)
ユーザーが任意の JSON 辞書（例: 中国語 `zh-CN.json`）を読み込んで注入できるプラグイン。

```javascript
export class CustomDictTranslator {
    constructor(options = {}) {
        this.dict = options.dictionary || {};
    }

    translate(text) {
        if (!text) return text;
        return this.dict[text] || text;
    }
}
```

---

## 4. `WebUICore` への DI（依存性注入）と利用方法

`WebUICore` のコンストラクタで `options.translator` を受け取ります。

```javascript
export class WebUICore {
    constructor(options = {}) {
        this.driver = options.driver;
        
        // DI (依存性注入): 未指定の場合は無翻訳 NullTranslator をデフォルトセット
        this.translator = options.translator || new NullTranslator();
        
        // ... その他のモジュール初期化 ...
    }
}
```

### 利用コード例 (クライアント側)

```javascript
// A. 日本語版として起動する場合
import { WebUICore } from '@core/WebUICore.js';
import { JapaneseTranslationEngine } from '@core/translation/JapaneseTranslationEngine.js';

const core = new WebUICore({
    driver: myDriver,
    translator: new JapaneseTranslationEngine({ enabled: true })
});

// B. 無翻訳（オリジナル英語版）として起動する場合
const coreEn = new WebUICore({
    driver: myDriver
    // translator を省略すると自動で NullTranslator が適用される
});

// C. 他言語 (中国語) カスタム辞書で起動する場合
import { CustomDictTranslator } from '@core/translation/CustomDictTranslator.js';

const coreZh = new WebUICore({
    driver: myDriver,
    translator: new CustomDictTranslator({ dictionary: zhDictionaryJson })
});
```

---

## 5. 移行ロードマップ (Migration Plan)

- **Phase 1: インターフェースと NullTranslator の作成**
  - `ITranslator.ts` および `NullTranslator.js` を作成し、現行 `TranslationEngine.js` を `JapaneseTranslationEngine.js` に改称・リファクタリング。
- **Phase 2: WebUICore への DI 導入**
  - `WebUICore` のコンストラクタで `options.translator` を受け取るように改修（下位互換のため未指定時は `JapaneseTranslationEngine` または `NullTranslator` へフォールバック）。
- **Phase 3: 各サンプルクライアントでの翻訳プラグイン明示指定**
  - サンプル UI 側から必要な翻訳エンジンを明示的に注入する構造へ更新。
