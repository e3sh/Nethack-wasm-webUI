# NetHackWasmDriver (NetHack Wasm JavaScript Driver)

`NetHackWasmDriver` は、NetHack 5.0 / 3.7 の Emscripten WebAssembly (Wasm) C コアエンジンと、モダンな JavaScript / WebUI クライアント間を中継する疎結合（Decoupled / 独立型）イベント駆動型ドライバーサブシステムです。

---

## 📁 ディレクトリ構造 (Directory Structure)

```
src/driver/
├── NetHackWasmDriver.js          # ドライバー本体 (C コア・Wasm FS・EventEmitter 配信)
├── NetHackMemory.js              # Wasm メモリ構造体アロケート & 解放 & デコード
├── InputResolver.js              # Asyncify 安全 Promise レスポンダー (10ms 遅延制御)
├── README.md                     # 本ドキュメント
└── test/
    └── DriverDomTestClient.js    # ドライバー検証用 DOM テストクライアント
```

---

## 🧪 単体検証環境 (Driver Test Client)

ドライバーの機能拡張・バグ検証・C コアからのイベント受信確認には、独立検証ツールを使用します：
- **検証用 HTML**: **[driver_dom_test.html](https://e3sh.github.io/Nethack-wasm-webUI/driver_dom_test.html)**
- **特徴**:
  - `Engine State` (RUNNING) ＆ `Input State` (WAITING_KEY/YN/MENU/TEXT) の 2 軸分離バッジ
  - インラインプロンプト行 (`[INPUT WAITING]`) による矢印キー/テンキー受容
  - `localStorage` による User Name の自動永続保存

---

## 💻 簡易使用コード例 (Quick Example)

```javascript
import NetHackWasmDriver from './src/driver/NetHackWasmDriver.js';

// 1. ドライバーインスタンスの生成
const driver = new NetHackWasmDriver({
    wasmModule: window.Module,
    gameOptions: {
        name: 'e3-sh',     // -uUsername として C main 引数の先頭へ自動注入
        number_pad: 1,
        showexp: true
    },
    debug: true
});

// 2. イベントリスナーの登録
driver.on('status_update', ({ field, value }) => {
    console.log(`Status field ${field} updated to:`, value);
});

driver.on('inputRequired', ({ context, question, resolver }) => {
    if (context === 'yn_function') {
        // キー入力に応答 ('y' = 121)
        resolver.respond(121);
    }
});

// 3. ドライバーの初期化と C main の起動
driver.init(window.Module);
await driver.start();
```

---

## 📚 ドライバー詳細仕様書 (Docs)

ドライバーの詳細な内部設計や API リファレンスは以下に保管されています：

- 📄 **[API リファレンスガイド](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/Docs/1_driver/driver_api_reference.md)** (`Docs/1_driver/driver_api_reference.md`)
- 📄 **[ドライバーコア技術仕様書](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/Docs/1_driver/driver_core_spec.md)** (`Docs/1_driver/driver_core_spec.md`)
- 📄 **[WebUI クライアント実装ガイド](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/Docs/2_client_ui/client_integration_guide.md)** (`Docs/2_client_ui/client_integration_guide.md`)
