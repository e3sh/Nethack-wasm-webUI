# NetHack WASM / WebUI 逆引き設定・セーブデータ管理 FAQ

本ドキュメントは、**NetHack WASM / WebUI システム独自の仕様・設定項目・セーブファイル管理・開発/デバッグ手順**をまとめた逆引きガイド（FAQ）です。  
NetHack 本来のゲーム仕様（Wiki/スポイラー等で確認できる内容）ではなく、**本プロジェクト独自のアーキテクチャやストレージ、設定の仕組み**に特化して解説しています。

---

## 目次

1. [セーブファイル・ストレージ管理 (Save Data & Storage)](#1-セーブファイルストレージ管理-save-data--storage)
   - [Q1-1. セーブデータはブラウザ上のどこに保存されていますか？](#q1-1-セーブデータはブラウザ上のどこに保存されていますか)
   - [Q1-2. セーブファイルをバックアップ・エクスポート・インポートするには？](#q1-2-セーブファイルをバックアップエクスポートインポートするには)
   - [Q1-3. セーブデータを完全に消去（クリーンリセット）するには？](#q1-3-セーブデータを完全に消去クリーンリセットするには)
   - [Q1-4. プログラム上でセーブデータの有無やプレイヤー名を判定するには？](#q1-4-プログラム上でセーブデータの有無やプレイヤー名を判定するには)
   - [Q1-5. セーブの同期タイミング（VFS ↔ IndexedDB）はどうなっていますか？](#q1-5-セーブの同期タイミングvfs--indexeddbはどうなっていますか)
2. [設定・コンフィグレーション (Settings & Configuration)](#2-設定コンフィグレーション-settings--configuration)
   - [Q2-1. 設定画面 `tools/config.html` では何が設定できますか？](#q2-1-設定画面-toolsconfightml-では何が設定できますか)
   - [Q2-2. 各種ユーザー設定の保存先（localStorage）キー一覧とステータスは？](#q2-2-各種ユーザー設定の保存先localstorageキー一覧とステータスは)
   - [Q2-3. `WebUICore` のオプションと `localStorage` の優先順位は？](#q2-3-webuicore-のオプションと-localstorage-の優先順位は)
   - [Q2-4. キーバインドやゲームパッド・タッチ操作の割り当てを変更・永続化するには？](#q2-4-キーバインドやゲームパッドタッチ操作の割り当てを変更永続化するには)
   - [Q2-5. サウンドモード（BGM/SE/Mute）や音量の設定方法は？](#q2-5-サウンドモードbgmsemuteや音量の設定方法は)
   - [Q2-6. 翻訳（日/英切替・仮訳・カスタム辞書）の設定方法は？](#q2-6-翻訳日英切替仮訳カスタム辞書の設定方法は)
3. [AIエージェント・開発者向け確認事項 (For AI Agents & Developers)](#3-aiエージェント開発者向け確認事項-for-ai-agents--developers)
   - [Q3-1. システム全体のアーキテクチャ境界とレイヤー構成は？](#q3-1-システム全体のアーキテクチャ境界とレイヤー構成は)
   - [Q3-2. 自動テストの実行方法と対象は？](#q3-2-自動テストの実行方法と対象は)
   - [Q3-3. よくあるトラブルシューティングと落とし穴 (Pitfalls)](#q3-3-よくあるトラブルシューティングと落とし穴-pitfalls)

---

## 1. セーブファイル・ストレージ管理 (Save Data & Storage)

### Q1-1. セーブデータはブラウザ上のどこに保存されていますか？

**A.** Emscripten の **IDBFS** を介して、ブラウザの **IndexedDB** に保存されています。

- **IndexedDB データベース名**: `/save`（または `/indexedDB`）
- **オブジェクトストア名**: `FILE_DATA`
- **仮想ファイルシステム (VFS) 上のパス**: `/save/` ディレクトリ内
- **ファイル命名規則**:
  - キャラクターセーブファイル: `/save/<UID><PlayerName>`（例: `/save/1000Player`）
  - ダンジョン階層キャッシュ: `/save/<UID><PlayerName>.d<Level>`（例: `/save/1000Player.d01`）
  - システム記録ファイル: `/save/record`, `/save/logfile`, `/save/xlogfile`, `/save/paniclog`, `/save/perm`

---

### Q1-2. セーブファイルをバックアップ・エクスポート・インポートするには？

**A.** プロジェクト付属の管理ツール **`tools/save_manager.html`** をブラウザで開いて操作します。

1. **セーブマネージャーの起動**:
   - ローカルサーバー稼働中に `http://localhost:8080/tools/save_manager.html`（または該当ポート）へアクセス。
2. **バックアップ / エクスポート**:
   - 「**Export All Saves (ZIP)**」をクリックすると、IndexedDB 内の全セーブファイルが ZIP 形式で一括ダウンロードされます。
   - 単一ファイルごとのダウンロードもリストから可能です。
3. **インポート / 復元**:
   - 「**Import Save ZIP / File**」からエクスポートした ZIP またはセーブファイルを選択して IndexedDB に書き込みます。

---

### Q1-3. セーブデータを完全に消去（クリーンリセット）するには？

**A.** 単に `localStorage.clear()` を実行しても **IndexedDB のセーブデータは消えません**。以下のいずれかの方法で行います。

#### ① セーブデータ管理画面 `tools/save_manager.html` から消去する場合 (GUI 推奨)
ブラウザ上でファイル一覧を確認しながら安全に消去できます。

1. **[`tools/save_manager.html`](../tools/save_manager.html)** をブラウザで開きます。
2. **全データ一括消去**:
   - IndexedDB セクションの「**Reset All Files**」ボタンをクリックすると、セーブファイル・ダンジョン階層キャッシュが一括削除されます。
3. **個別ファイル消去**:
   - ファイルリスト右端の「**Delete**」ボタンから、特定のキャラクターセーブのみを選択して消去することも可能です。
4. **LocalStorage 設定のリセット**:
   - 同画面下部の「Web Storage」セクションから「**Clear All Storage**」で設定も含めて完全初期化できます。

#### ② プログラムコードから安全に消去する場合
```javascript
// WebUICore 経由でクリーンリスタート（IndexedDB と VFS を完全初期化）
await core.restart({ clearStorage: true });

// またはドライバーから直接セーブ削除
await core.driver.deleteSaveFile();
```

#### ③ ブラウザ DevTools から手動で行う場合
1. F12 で DevTools を開き、**Application** タブを選択。
2. **Storage** → **IndexedDB** を展開。
3. `/save`（または `/indexedDB`）を右クリックして「**Delete database**」を実行。

---

### Q1-4. プログラム上でセーブデータの有無やプレイヤー名を判定するには？

**A.** `WebUICore` の非同期検出 API を使用します。

```javascript
// セーブデータが存在するかチェック (boolean)
const hasSave = await core.hasSaveDataAsync();

// セーブファイルの詳細情報（プレイヤー名・ファイル名）を検出
const saveInfo = await core.detectSavedGameInfo();
if (saveInfo && saveInfo.detectedName) {
    console.log(`検出されたプレイヤー: ${saveInfo.detectedName}`);
}
```

---

### Q1-5. セーブの同期タイミング（VFS ↔ IndexedDB）はどうなっていますか？

**A.** 以下のフローで自動的に同期 (`safeSaveSync` / `FS.syncfs`) されます。

1. **起動時**: IndexedDB から Emscripten VFS（メモリ上の `/save/`）へデータをロード（Populate）。
2. **ゲーム中（セーブ実行時 / Shift+S / 階層移動）**: NetHack が VFS に書き込んだ後、Driver が `FS.syncfs(false)` を呼び出して IndexedDB に非同期永続化。
3. **ゲーム終了 / 再起動時**: 整合性を担保した上でクリーンアップまたは永続化を完了。

---

## 2. 設定・コンフィグレーション (Settings & Configuration)

### Q2-1. 設定画面 `tools/config.html` では何が設定できますか？

**A.** 一般的なユーザー設定（`localStorage("nh.config")`）を GUI で編集・保存できる公式設定画面です。

| 設定項目 (UI) | 内部キー (`nh.config`) | 設定値・選択肢 | 説明・注意事項 |
| :--- | :--- | :--- | :--- |
| **グラフィック** | `gryph` | `true` (Tile) / `false` (ASCII) | マップ表示をタイル画像形式にするか ASCII テキストにするか。<br>※ **注意**: UIクライアントの実装に依存します。クライアント自身でレンダラーを切り替える構成の場合、このフラグは参照されません。 |
| **言語設定** | `lang` | `true` (JP) / `false` (EN) | 日本語翻訳表示の有効/無効 |
| **未翻訳収集 (LANGLARN)** | `larn` | `true` / `false` | **※ 実質無効**: 以前の LocalStorage 収集用フラグです。現在は DevTools Inspector でのリアルタイム収集へ移行したため機能しません。 |
| **デバッグ情報** | `debug` | `true` / `false` | 開発者向けログおよび Inspector 連動フラグ |
| **アイテム名付け動作** | `item_naming_mode` | `'auto_memo'` / `'manual'` / `'skip'` | 未識別アイテム使用時の名前付けプロンプト挙動 |
| **サウンドモード** | `sound_mode` | `'mute'` / `'se'` / `'all'` | 効果音・BGM の再生モード |
| **マスター音量** | `sound_volume` | `0` 〜 `100` | 全体ボリューム |
| **NetHack 追加オプション** | `extra_options` | 文字列（改行またはカンマ区切り） | NetHack 起動時オプション（詳細は下記サンプル参照） |

#### 💡 `extra_options` (NetHack 追加オプション) の設定サンプル
NetHack の標準 OPTIONS コマンドと同様のオプション文字列を改行またはカンマ区切りで複数指定できます。

```text
!tutorial
time
showexp
playmode:explore
autopickup
pickup_types:$
```

- `!tutorial`: チュートリアルプロンプトを無効化
- `time`: ステータス行に経過ターン数を表示
- `showexp`: 獲得経験値・EXPを表示
- `playmode:explore`: 探索モード（死亡時に復活可能・ゲームオーバー回避）
- `autopickup`: アイテムの上に移動した時の自動拾いを有効化
- `pickup_types:$`: 自動拾い対象をゴールド（`$`）のみに限定

---

### Q2-2. 各種ユーザー設定の保存先（localStorage）キー一覧とステータスは？

**A.** 最新のアーキテクチャ刷新により、LocalStorage のキーには**「現役で使用されるキー」**と**「DevTools Inspector 等へ移行・非推奨となったキー」**があります。

#### 🟢 現役で利用されるキー (Active)
| ストレージキー | 型 / 形式 | 用途・格納内容 |
| :--- | :--- | :--- |
| **`nh.config`** | JSON String | コア設定オブジェクト (`{ gryph, lang, debug, item_naming_mode, extra_options, sound_mode, sound_volume }`) |
| **`nh.gpadAssign`** | JSON String | ゲームパッドのボタン・軸割り当て設定 (`KEYASSIGN`) |
| **`nh.tpadAssign`** | JSON String | タッチパッド・仮想十字キーの入力割り当て |
| **`nethack_sound_mode`** | String | サウンド再生モード (`'all'` \| `'se'` \| `'mute'`) |
| **`nethack_sound_volume`** | Number (0.0〜1.0) | 全体マスター音量 |
| **`nethack_wave_gain`** | Number | 効果音 (WAV/SE) のゲイン倍率 |
| **`nethack_beep_gain`** | Number | ビープ音 (Synth Beep) のゲイン倍率 |
| **`nethack_webui_topten`** | JSON String | ローカルハイスコア・ランキング履歴 |

#### ⚠️ 移行済み・非推奨となったキー (Deprecated / Migrated)
| ストレージキー | 旧用途 | 現在の移行先・推奨手法 |
| :--- | :--- | :--- |
| **`nh.temp`** | 未翻訳ログ収集バッファ | **移行**: [`inspector_console.html`](../src/core/inspector/inspector_console.html) の「📝 翻訳管理」タブにて `BroadcastChannel` 経由でリアルタイム収集・CSVエクスポート |
| **`nh.ext_data`** | カスタム仮訳辞書データ | **移行**: メインスレッド負荷軽減のため、動的注入 API または `dictionary.csv` 編集後に `python tools/dict_converter.py import` で `param/nhMessage.js` を生成・反映するフローへ移行 |
| **`nh.play_log`** | 翻訳対比ログ | **移行**: `DebugInspector` のメモリバッファおよびリアルタイムストリーミングへ移行 |

> **設計上の背景**: `localStorage` への頻繁な同期書き込みはゲームループのフレームレート低下を招き、5MB の容量制限もあったため、重いログ収集や辞書キャッシュは `BroadcastChannel` と専用インスペクターへ完全に分離されました。

---

### Q2-3. `WebUICore` のオプションと `localStorage` の優先順位は？

**A.** 明示的に `new WebUICore(options)` へ渡された引数が最優先され、未指定（`undefined`）の場合に `localStorage("nh.config")` の値にフォールバックします。

```javascript
// 例: WebUICore 初期化時のオプション指定
const core = new WebUICore({
    driver: myWasmDriver,
    renderer: myCanvasRenderer,
    translateEnabled: true,       // 未指定時は localStorage("nh.config").lang を参照
    enableInspector: false,       // 未指定時は localStorage("nh.config").debug を参照
    itemNamingMode: 'manual',     // 'manual' | 'skip' (未指定時は localStorage("nh.config").item_naming_mode)
    soundMode: 'all'              // 'all' | 'se' | 'mute'
});
```

---

### Q2-4. キーバインドやゲームパッド・タッチ操作の割り当てを変更・永続化するには？

**A.** 専用の **GUI 設定ツール**、またはコード/LocalStorage から設定します。

#### 🎮 GUI 設定ツールから設定する場合 (推奨)
ブラウザ上で視覚的にコントローラーや仮想キーの割り当てを設定・保存できます。

- **ゲームパッド設定ツール**: [`examples/legacy-client/rogue/mapping_tool.html`](../examples/legacy-client/rogue/mapping_tool.html)
  - 接続した USB/Bluetooth ゲームパッドの各ボタン・スティックに NetHack のキー（方向キー、各種コマンド）を割り当てて `localStorage("nh.gpadAssign")` に保存します。
- **タッチ操作マッピングツール**: [`examples/legacy-client/rogue/touch_mapping_tool.html`](../examples/legacy-client/rogue/touch_mapping_tool.html)
  - スマホ・タブレット向けのバーチャル十字キーや操作ボタンの配置・カスタマイズを行います。

#### プログラム・コード上で制御する場合
- **キーボードマッピング**: [`src/core/input/KeyMapper.js`](../src/core/input/KeyMapper.js) / デフォルト定義: [`src/core/input/defaultDefines.js`](../src/core/input/defaultDefines.js)
- **ゲームパッドマネージャー**: [`src/core/input/GamepadManager.js`](../src/core/input/GamepadManager.js)

---

### Q2-5. サウンドモード（BGM/SE/Mute）や音量の設定方法は？

**A.** **GUI 設定画面**、**サウンドテストツール**、またはコード/LocalStorage から設定できます。

#### 🔊 GUI 画面から設定する場合
- **システム設定画面**: [`tools/config.html`](../tools/config.html)
  - サウンドモード（`mute` / `se` / `all`）の選択、音量スライダー（0〜100%）、テスト再生ボタンから即座に調整・保存できます。
- **サウンドテスター**: [`tests/sound_test.html`](../tests/sound_test.html)
  - BEEP 音（合成矩形波）、WAVE 音声、Auto ルール再生の個別テストとゲイン調整が可能です。
- **開発ツールハブ**: [`tools/dev_tools.html`](../tools/dev_tools.html)
  - 各種設定ツール群へのポータルハブ画面です。

#### プログラム・コード上で制御する場合
```javascript
// SoundEngine API からの制御
core.sound.setSoundMode('all');  // 'all' (全音) / 'se' (SEのみ) / 'mute' (消音)
core.sound.setVolume(0.8);       // 0.0 〜 1.0

// マッピング定義ファイル
// sound_mapping.json にメッセージやイベントに応じた SE トリガーが定義されています。
```

---

### Q2-6. 翻訳（日/英切替・仮訳・カスタム辞書）の設定方法は？

**A.** `TranslationEngine`（[`src/core/translation/TranslationEngine.js`](../src/core/translation/TranslationEngine.js)）が制御します。

1. **言語切り替え**:
   - `core.setLanguage('ja')` または `core.setLanguage('en')`
2. **辞書ファイル**:
   - 正式辞書: `dictionary.csv`（ルートディレクトリ）
   - 知識レイヤー辞書: `knowledge_dictionary.csv`
3. **未翻訳収集と辞書更新の推奨フロー**:
   - [`src/core/inspector/inspector_console.html`](../src/core/inspector/inspector_console.html) の「📝 翻訳管理」タブを利用してリアルタイム収集し、`dictionary.csv` に追記・編集します。
   - 編集後、`python tools/dict_converter.py import` を実行して WebUI 実行用辞書 `param/nhMessage.js` を生成・反映します。

---

## 3. AIエージェント・開発者向け確認事項 (For AI Agents & Developers)

### Q3-1. システム全体のアーキテクチャ境界とレイヤー構成は？

**A.** 本リポジトリは以下の疎結合な 3 層構造で設計されています。

```
[ UI / Presentation Layer ] (Client)
  ├─ CanvasRenderer / HTML5 UI / MobileDomClient
  └─ UI Components (MessageWindow, Inventory, StatusLine, GamepadOverlay)
         │  (Event / Method Call)
         ▼
[ Domain / Knowledge Layer ] (GKL Plugin)
  ├─ GKLPlugin (`src/core/knowledge/GKLPlugin.js`)
  ├─ TacticalAdvisor / AssistSignalSynthesizer (戦術・アドバイス)
  └─ ContextActionEngine (スマート自動行動・探索判定)
         │  (Plugin hook / State Sync)
         ▼
[ Core Infrastructure Layer ] (WebUICore & Wasm Driver)
  ├─ WebUICore (`src/core/WebUICore.js`) - ファサード・状態管理
  ├─ Input (KeyMapper, GamepadManager, TouchCalculator)
  ├─ Translation & Sound Engines
  └─ WasmDriver (`Worker Thread`) ↔ NetHack C Core (WASM / Emscripten)
```

> **注意**: `WebUICore` 自体は純粋なインフラ（入出力・通信基盤）であり、NetHack のゲーム知識・アドバイザー等のロジックはすべて `GKLPlugin` 側にカプセル化されています。

---

### Q3-2. 自動テストの実行方法と対象は？

**A.** `Vitest` を用いて単体テスト・境界テストが構築されています。

```bash
# 全テストの実行
npm test

# UI付きテストランナーの起動
npm run test:ui
```

- テストコード配置場所: `src/**/*.test.js`
- 境界検証テスト: `src/core/ArchitectureBoundary.test.js`（レイヤー間の依存関係違反を自動検知）

---

### Q3-3. よくあるトラブルシューティングと落とし穴 (Pitfalls)

#### ⚠️ 1. 「画面が暗転したまま進まない」「古いキャラクターデータで始まってしまう」
- **原因**: 以前のセーブデータが IndexedDB に残っており、初期化時のプレイヤー名と不整合を起こしている。
- **対処**: `await core.restart({ clearStorage: true });` を実行するか、`tools/save_manager.html` で IndexedDB の残存ファイルを消去してください。

#### ⚠️ 2. 「`localStorage.clear()` を呼んだのに直らない」
- **原因**: `localStorage` には UI 設定しか入っておらず、ゲーム本編のセーブデータは **IndexedDB (`/save` DB)** にあるため。
- **対処**: 必ず IndexedDB の削除（または `driver.deleteSaveFile()`）を行う必要があります。

#### ⚠️ 3. 「C言語コード（NetHack オリジナル）を変更したのに WASM に反映されない」
- **対処**: `NetHack-NetHack-5.0/build_wasm_50.ps1` を実行して `nethack.wasm` / `nethack.js` を再ビルドしてください。
- **注意**: 本システムは 現状では**本家オリジナルWASM版（win/shim Port `Unix NetHack Version 5.0.0-0 post-release`）** での動作は確認出来ています。

