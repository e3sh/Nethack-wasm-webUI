# NetHack 翻訳・セーブデータ挙動差異調査 & DevTools Inspector 統合設計書

本ドキュメントでは、旧来のデスクトップ/モバイル版クライアント（`examples/legacy-client/`）と、共通コアエンジン（`src/core/WebUICore.js`）における翻訳処理およびセーブデータ管理の挙動差異を整理し、DevTools Inspector (`inspector_console.html`) への翻訳管理機能統合に関する設計仕様を記録します。

---

## 1. legacyClient と WebUICore の挙動差異調査

### 1.1 翻訳処理（Translation）の差異

| 比較項目 | legacyClient (`rogue/UI/trancelate.js`) | 現行 WebUICore (`TranslationEngine.js`) | 統合後の WebUICore |
| :--- | :--- | :--- | :--- |
| **アーキテクチャ** | グローバルスコープ前提の関数クロージャ | ES Modules 準拠の独立クラス設計 | ES Modules 準拠のイベント駆動型設計 |
| **翻訳成否追跡** | `lastMatchSuccess` フラグによる単純判定 | 未実装（戻り値の文字列のみ返却） | `lastMatchSuccess` + 詳細メタデータ (`matchMethod`) 保持 |
| **未翻訳ログの収集** | 翻訳失敗時に `localStorage("nh.temp")` へ直接書き込み | 未実装（UI層への副作用を排除） | `WebUICore` のイベント (`messageUntranslated`, `translationLog`) として発行 |
| **リアルタイム対比ログ** | `localStorage("nh.play_log")` に最大2000件配列を毎回 JSON シリアライズ | 未実装 | `DebugInspector` から `BroadcastChannel` でリアルタイムストリーミング |
| **拡張・仮訳データ** | `localStorage("nh.ext_data")` からのオンデマンド読み込み | `TranslationEngine(options)` への注入 | 辞書初期化および動的注入をサポート |

#### 課題と改善方針:
- **旧実装の課題**: `localStorage` への頻繁な同期書き込みによるメインスレッドのフレームレート低下、複数タブ間での競合やストレージ容量制限（5MB）、クリーンアップの手間。
- **改善方針**: メインスレッドではメモリ内での高速イベント発行（`emit('translationLog', ...)`）に徹し、重いログ蓄積・フィルタリング・CSVエクスポートは `BroadcastChannel` で接続された独立ウィンドウ（`inspector_console.html`）側で非同期に処理する。

---

### 1.2 セーブデータ（Save Data）管理の挙動差異

| 比較項目 | legacyClient (`GameManager.js`) | WebUICore (`WasmFsManager` / `WebUICore.js`) |
| :--- | :--- | :--- |
| **プレイヤー名検出** | 固定ファイル名または手動解決 | `autoDetectSavePlayerNameAsync()` による VFS 内セーブファイル自動スキャン |
| **起動引数設定** | `-uPlayer` または手動プロンプト | セーブ存在時は自動で `-u[PlayerName]` を付与、新規時は `askname` を付与 |
| **1スロット制限管理** | ブラウザストレージの単純クリア | `deleteSaveData()` / `forceNewGame` による VFS / IDBFS の安全な完全消去 |
| **非同期同期整合性** | 同期ブロックによるラグ | `FS.syncfs` の Promise ラッパーによる確実な永続化完了ハンドリング |

---

## 2. DevTools Inspector 翻訳統合 設計仕様

### 2.1 データフロー アーキテクチャ

```text
┌─────────────────────────────────────────────────────────────┐
│                      WebUICore                              │
│                                                             │
│  Wasm Driver (putstr / raw_print)                           │
│        │                                                    │
│        ▼                                                    │
│  handleMessageText(rawText)                                 │
│        │                                                    │
│        ├─► TranslationEngine.translate(rawText)             │
│        │     └─► lastMatchSuccess / matchMethod 更新        │
│        │                                                    │
│        ├─► emit('translationLog', { raw, jp, success, ... })│
│        │                                                    │
│        └─► (未翻訳時) emit('messageUntranslated', { ... })   │
└──────────────────────┬──────────────────────────────────────┘
                       │ Event Subscription
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    DebugInspector                           │
│                                                             │
│  broadcastLog('TRANSLATION_LOG', logEntry)                  │
│  BroadcastChannel.postMessage({ type: 'TRANSLATION_LOG' })  │
└──────────────────────┬──────────────────────────────────────┘
                       │ BroadcastChannel ("webuicore_inspector_channel")
                       ▼
┌─────────────────────────────────────────────────────────────┐
│             DevTools Inspector Console                      │
│             (inspector_console.html)                        │
│                                                             │
│  📝 翻訳管理 (Translations) タブ                             │
│  ├─ 1. 未翻訳メッセージ収集（重複除外・件数カウント）         │
│  ├─ 2. クリップボードコピー / TXT保存 / CSV保存             │
│  └─ 3. リアルタイム対比ログ（RAW vs JP テーブル）            │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.2 翻訳エンジン仕様 (`TranslationEngine.js`)

#### 状態・メタデータ保持プロパティ:
- `lastMatchSuccess`: `boolean` （直前の翻訳処理で辞書・パターン・構文解析にマッチしたか）
- `lastMatchMethod`: `'exact' | 'word' | 'pattern' | 'decompose' | 'none'` （マッチした方式）
- `lastRawText`: `string` （直前の入力テキスト）
- `lastTranslatedText`: `string` （直前の出力テキスト）

#### メソッド拡張:
- `getLastMatchInfo()`: 直近のマッチ成否およびマッチ方式・入出力をオブジェクトで返却。
- `isNoiseMessage(text)`: 単一文字のインデックス、純粋な数値、`12:34` 等の時刻/比率など、辞書登録が不要なノイズメッセージを判定・除外。

---

### 2.3 WebUICore イベント仕様 (`WebUICore.js`)

#### `translationLog`:
- **発火タイミング**: ゲーム画面へのメッセージ出力時（`putstr`, `raw_print` 等）
- **ペイロード**:
  ```javascript
  {
      raw: string,          // 原文 (英語)
      translated: string,   // 訳文 (日本語)
      success: boolean,     // マッチ成否
      method: string,       // マッチ方式 ('exact', 'pattern', etc.)
      timestamp: number     // 発生時刻 (Date.now())
  }
  ```

#### `messageUntranslated`:
- **発火タイミング**: 翻訳エンジンがマッチせず、かつノイズではない有効な英文メッセージだった場合
- **ペイロード**:
  ```javascript
  {
      raw: string,          // 未翻訳の原文 (英語)
      translated: string,   // そのままの文字列
      timestamp: number     // 発生時刻
  }
  ```

---

### 2.4 Inspector コンソール仕様 (`inspector_console.html`)

新設する「📝 翻訳管理 (Translations)」タブにおいて、以下の機能を提供する：

1. **未翻訳メッセージ収集パネル (Untranslated Queue)**:
   - 重複を除外した未翻訳メッセージのリスト表示。
   - 収集件数バッジのリアルタイム更新。
   - **[📋 クリップボードにコピー]**: `dictionary.csv` や Google スプレッドシートへそのまま貼り付けられる形式（`RAW` の改行区切りテキスト）でコピー。
   - **[💾 テキスト保存]**: `untranslated_messages.txt` としてブラウザから即座にダウンロード。
   - **[📊 CSVエクスポート]**: `untranslated_dictionary.csv`（`en,jp` カラム）としてダウンロード。
   - **[🗑️ クリア]**: 収集リストを初期化。

2. **リアルタイム対比ログパネル (Live Comparison Log)**:
   - ゲームプレイ中に発生した全メッセージをテーブル形式で上から順（または最新順）にリアルタイム追加。
   - **カラム構成**: `時刻`, `原文 (RAW)`, `訳文 (JP)`, `判定ステータス (TRANSLATED / UNTRANSLATED)`, `マッチ方式`。
   - **検索・フィルター**: 原文・訳文でのインクリメンタル検索、未翻訳のみ絞り込みトグル。
   - **クリア**: ログ一覧の初期化。

---

## 3. 今後の運用とメリット

1. **旧ツール群の一本化**:
   - これまで分散していた `tr_log.html`（対比ビューア）と `tr_fail.html`（未翻訳収集）を、ゲーム全体の統合デバッグ基盤である `inspector_console.html` に統合。
2. **パフォーマンス向上**:
   - メインスレッドでの `localStorage` 読み書きオーバーヘッドが完全にゼロになり、快適なゲームプレイと高機能なリアルタイム翻訳監視を両立。
3. **辞書作成ワークフローの効率化**:
   - プレイ中に Inspector コンソールを開いておくだけで、ゲーム進行に応じた未翻訳メッセージが自動収集され、ワンクリックでマスター辞書（`dictionary.csv`）用のデータをエクスポート可能。
