# NetHackWasmDriver (NetHack Wasm JavaScript Driver)

`NetHackWasmDriver` は、NetHack 5.0 / 3.7 の Emscripten WebAssembly (Wasm) C コアエンジンと、モダンな JavaScript / WebUI クライアント間を中継する疎結合（Decoupled / 独立型）イベント駆動型ドライバーサブシステムです。

---

## 📁 ディレクトリ構造 (Directory Structure)

```
src/driver/
├── NetHackWasmWorkerBridge.js    # メインスレッド用ブリッジ (従来の Driver と同一の外部APIを提供)
├── nethack.worker.js             # Web Worker 用スクリプト (WasmとDriverをWorker内に配置)
├── NetHackWasmDriver.js          # ドライバー本体 (C コア・Wasm FS・EventEmitter 配信)
├── NetHackMemory.js              # Wasm メモリ構造体アロケート & 解放 & 構造化デコード
├── NetHackFSManager.js           # Emscripten VFS & IndexedDB セーブ永続化/全消去/パース
├── InputResolver.js              # Asyncify 安全 Promise レスポンダー (遅延制御 & ガード)
├── README.md                     # 本ドキュメント
└── test/
    └── DriverDomTestClient.js    # ドライバー検証用 DOM テストクライアント
```

---

## ✨ 主な新機能・改善点 (Key Improvements & Features)

1. **シームレスなセーブデータ自動復元 (Auto Resume)**
   - C コアの `askname` (`shim_askname`) からのプレイヤー名問い合わせと連携し、IndexedDB / VFS 上に検出されたセーブデータ名 (`detectedName`) で自動応答。リロード後も即座に以前のプレイからシームレスに再開。
2. **堅牢なセーブデータ物理一括抹消 (`deleteSaveFile`)**
   - VFS (`/save`) および IndexedDB (`/indexedDB` の `FILE_DATA` ストア) 内の残留セーブデータを完全走査・無条件物理抹消する安全メカニズムを構築。
3. **C 構造体サイズ不整合の解消 (`menu_item`)**
   - `NetHackMemory.js` における `menu_item` (`struct mi`) の要素サイズを Wasm32 レイアウトに合わせて 12バイトに修正。`assert(otmp != 0)` クラッシュを解消。
4. **ステータス情報の完全構造化デコード (`BL_` フィールド)**
   - **`BL_GOLD` (field 10)**: `"glyph:0x0f2e:100"` からの Gold Pieces Glyph ID (`3886`) および金額の自動解析。
   - **`BL_HUNGER` (field 17)**: 空腹・満腹状態 (`"Satiated"`, `"Hungry"`, `"Weak"`, `"Fainting"`) の解釈と分離表示。
   - **`BL_CONDITION` (field 22)**: ビットマスクからの状態異常配列デコード (`Blind`, `Confused`, `Stunned` 等)。
5. **クリーンな初期化とオプション重複エラーの根絶**
   - VFS 上の `NetHack.cnf` / `.nethackrc` 生成時の重用 `OPTIONS=` をクレンジングし、起動時の `4 errors in //.nethackrc.` 警告を完全除去。環境変数 (ENV) 設定を preRun にて早期ロードするように調整。
6. **インベントリ・メニューの CSS Sprite タイル描画サポート**
   - `shim_add_menu` で数値 Glyph ID をダイレクト保持し、テキストからのスマートカテゴリ推論フォールバック (`inferGlyphFromText`) によりインベントリ画面等の全アイテムにグラフィックアイコンを描画。
7. **Web Worker 隔離によるUI描画・動画フリーズの根本解消 (Web Worker Architecture)**
   - Wasmコアと Asyncify（マイクロタスク占有とスタック退避・復元）を `nethack.worker.js` 内に分離隔離。
   - 同一ブラウザの別タブで YouTube などの動画を再生した状態で NetHack を操作しても、UIスレッドが一切ブロッキングされず、フリーズ（くるくる）しない完全並行動作を確立。
   - `NetHackWasmWorkerBridge.js` により、UI側からは従来の Driver と 100% 同一の API インターフェース（`activeResolver` ゲッター等含む）で透過的に利用可能。

---

## 🧪 単体検証環境 (Driver Test Client)

ドライバーの機能拡張・バグ検証・C コアからのイベント受信確認には、独立検証ツールを使用します：
- **検証用 HTML**: **[driver_dom_test.html](https://e3sh.github.io/Nethack-wasm-webUI/driver_dom_test.html)**
- **特徴**:
  - `Engine State` (RUNNING) ＆ `Input State` (WAITING_KEY/YN/MENU/TEXT) の 2 軸分離バッジ
  - インラインプロンプト行 (`[INPUT WAITING]`) による矢印キー/テンキー受容
  - セーブインジケーター（`Save: Username`）と物理一括削除ボタン（`🗑️ Del Save`）
  - CSS Sprite アイコン描画とリアルタイム状態異常・空腹バッジ表示

---

## 💻 簡易使用コード例 (Quick Example)

```javascript
import NetHackWasmWorkerBridge from './src/driver/NetHackWasmWorkerBridge.js';

// 1. ブリッジインスタンスの生成 (Worker スクリプトを指定)
const driver = new NetHackWasmWorkerBridge('src/driver/nethack.worker.js', {
    arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
    gameOptions: {
        number_pad: 1,
        showexp: true,
        time: true,
        showvers: true
    },
    debug: true
});

// 2. イベントリスナーの登録
driver.on('status_update', ({ field, value }) => {
    console.log(`Status field ${field} updated to:`, value);
});

driver.on('inputRequired', ({ context, question, detectedName, resolver }) => {
    if (context === 'askname' && detectedName) {
        // 既存のセーブデータ名で即座に自動復元・再開！
        resolver.respond(detectedName);
    } else if (context === 'yn_function') {
        resolver.respond(121); // 'y'
    }
});

// 3. Wasm初期化完了イベントを受けて起動
driver.on('initialized', async () => {
    console.log("Wasm initialized inside Worker!");
    const exitCode = await driver.start();
    console.log("Game exited with code:", exitCode);
});

driver.init('nethack.js');
```

---

## 📚 ドライバー詳細仕様書 (Docs)

ドライバーの詳細な内部設計や API リファレンスは以下に保管されています：

- 📄 **[API リファレンスガイド](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/Docs/1_driver/driver_api_reference.md)** (`Docs/1_driver/driver_api_reference.md`)
- 📄 **[ドライバーコア技術仕様書](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/Docs/1_driver/driver_core_spec.md)** (`Docs/1_driver/driver_core_spec.md`)
- 📄 **[WebUI クライアント実装ガイド](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/Docs/2_client_ui/client_integration_guide.md)** (`Docs/2_client_ui/client_integration_guide.md`)

