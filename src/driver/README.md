# NetHackWasmDriver (`@nethack/wasm-driver`)

`NetHackWasmDriver` は、NetHack 5.0 / 3.7 の Emscripten WebAssembly (Wasm) C コアエンジンと、モダンな JavaScript / WebUI / モバイル DOM / Node.js AI クライアント間を中継する疎結合（Decoupled / 独立型）イベント駆動型ドライバーサブシステムです。

本ディレクトリ配下のモジュールは、外部プロジェクトからも独立した JS ライブラリパッケージ（`@nethack/wasm-driver`）として単体利用可能です。

---

## 📁 ディレクトリ・パッケージ構造 (Package Structure)

```
src/driver/
├── index.js                      # 統合エントリーポイント (ESM / CommonJS / Global)
├── package.json                  # npm パッケージマニフェスト (@nethack/wasm-driver)
├── NetHackWasmWorkerBridge.js    # Web Worker 隔離ブリッジ (メインスレッド用 API)
├── nethack.worker.js             # Web Worker 用スクリプト (Wasm & Driver 隔離実行)
├── NetHackWasmDriver.js          # ドライバーコア (C コア・VFS・EventEmitter 配信)
├── NetHackMemory.js              # Wasm メモリ構造体解釈 & ポインタ相互変換
├── NetHackFSManager.js           # Emscripten VFS & IndexedDB セーブデータ管理
├── InputResolver.js              # Asyncify 安全 Promise レスポンダー
├── README.md                     # 本ドキュメント
└── test/
    └── DriverDomTestClient.js    # ドライバー単体検証用 DOM テストクライアント
```

---

## 🚀 導入・使用方法 (Installation & Usage)

### 1. ES Modules (`import`)

```javascript
import { NetHackWasmWorkerBridge, NetHackFSManager } from './src/driver/index.js';

// 1. Worker ブリッジの生成
const driver = new NetHackWasmWorkerBridge('./src/driver/nethack.worker.js', {
    arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
    debug: true
});

// 2. 高解像度イベントの受聴
driver.on('putstr', ({ windowId, text }) => {
    console.log(`[Window ${windowId}] ${text}`);
});

driver.on('status_update', ({ field, value }) => {
    console.log(`Status [field:${field}] = ${value}`);
});

driver.on('inputRequired', ({ context, prompt, resolver }) => {
    if (context === 'askname') {
        resolver.respond('Hero');
    } else if (context === 'yn') {
        resolver.respond(121); // 'y'
    }
});

// 3. Wasm エンジン初期化 & 起動
driver.on('initialized', async () => {
    console.log("Wasm initialized inside Worker!");
    const exitCode = await driver.start();
    console.log("Engine exited with code:", exitCode);
});

driver.init('nethack.js');
```

### 2. Browser Script Tag (Global)

```html
<script src="src/driver/NetHackMemory.js"></script>
<script src="src/driver/InputResolver.js"></script>
<script src="src/driver/NetHackFSManager.js"></script>
<script src="src/driver/NetHackWasmDriver.js"></script>
<script src="src/driver/NetHackWasmWorkerBridge.js"></script>

<script>
  const bridge = new NetHackWasmWorkerBridge('src/driver/nethack.worker.js');
  // ...同一の API で利用可能
</script>
```

---

## ✨ 主な特徴と独立性 (Key Features)

1. **完全なレイヤー分離 (Decoupled Design)**
   - UI描画ロジックと Wasm メモリ操作・C構造体解析を完全に切り離し、Pure JS Object の Typed Event (`putstr`, `print_glyph`, `status_update`, `inputRequired` 等) として配信。
2. **Web Worker 隔離実行 (Multi-threaded Non-blocking Execution)**
   - Wasm コアおよび Asyncify を Worker スレッド内に分離。YouTube 等の動画再生中や重い DOM 描画処理中でも UI スレッドをブロッキングしません。
3. **シームレスなセーブデータ自動復元 & 物理抹消**
   - VFS (`/save`) および IndexedDB (`/indexedDB`) 内のセーブデータを走査・自動検出・無条件一括物理削除する `NetHackFSManager` を内蔵。
4. **C 構造体サイズ（`menu_item` / `glyph_info`）完全解釈**
   - Wasm32 アロケーション規約に基づき `menu_item` (`struct mi`) を 12バイトレイアウトで正しく書き込み。
5. **ステータス情報の構造化デコード (`BL_` フィールド)**
   - 金額 (Gold), 空腹状態 (Hunger), 状態異常 (Condition: Blind, Confused 等) を人間・UIが扱いやすい形式に自動変換してパブリッシュ。

---

## 🧪 単体検証環境 (Driver Test Client)

ドライバーの機能拡張・バグ検証・C コアからのイベント受信確認には、独立検証ツールを使用します：
- **検証用 HTML**: **[driver_dom_test.html](https://e3sh.github.io/Nethack-wasm-webUI/tools/cltest.html)**
- **特徴**:
  - `Engine State` (RUNNING) ＆ `Input State` (WAITING_KEY/YN/MENU/TEXT) の 2 軸分離バッジ
  - インラインプロンプト行 (`[INPUT WAITING]`) による矢印キー/テンキー受容
  - セーブインジケーター（`Save: Username`）と物理一括削除ボタン（`🗑️ Del Save`）
  - CSS Sprite アイコン描画とリアルタイム状態異常・空腹バッジ表示

---

## 📚 ドライバー詳細仕様書 (Docs)

- 📄 **[アーキテクチャ & ロードマップ](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/1_driver/driver_architecture_and_roadmap.md)**
- 📄 **[API リファレンスガイド](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/1_driver/driver_api_reference.md)**
- 📄 **[ドライバーコア技術仕様書](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/1_driver/driver_core_spec.md)**


