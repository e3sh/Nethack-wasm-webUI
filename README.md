# NetHack WASM WebUI

NetHack 5.0 (および NetHackJP) を WebAssembly (Wasm) にコンパイルし、共通コアエンジン **`WebUIcore` (`src/core/`)** と Web Worker 隔離アーキテクチャによって構築されたモダン Web フロントエンドプロジェクトです。

コア層 `WebUIcore` に翻訳・サウンド・入力・状態管理をすべて一元化しており、多種多様な UI フロントエンド（Vue 3, React 18, Svelte, SolidJS, Pure JS 等）で動作します。

👉 **[🎮 メインポータル / プレイ開始画面を開く](https://e3sh.github.io/Nethack-wasm-webUI/)**

---

## 🏛️ アーキテクチャとディレクトリ構造

本リポジトリは **`WebUIcore` を唯一の正解 (Single Source of Truth)** とし、初期プロトタイプコード（レガシー）、ツール類、テスト群をサブディレクトリへ明確に整理分離しています。

```text
Nethack-wasm-webUI/
├── src/                        # 【共通コア】(Single Source of Truth)
│   ├── core/                   # WebUIcore (翻訳/音響/描画/入力/状態一元管理)
│   ├── driver/                 # WASM Driver & FS Manager (@nethack/wasm-driver)
│   └── client/                 # モバイルDOMクライアント等
├── examples/                   # 【各種クライアント実装例】
│   ├── pure-js-client/         # [NEW] WebUIcore ベース標準 Pure JS リファレンス
│   ├── vue-client/             # Vue 3 + Pinia + TypeScript 実装
│   ├── react-client/           # React 18 + Zustand + TypeScript 実装
│   ├── svelte-client/          # Svelte 4/5 + TypeScript 実装
│   ├── solid-client/           # SolidJS + TypeScript 実装
│   └── legacy-client/          # [Canvas / Mobile] WebUICore 統合済みの独自 Canvas タイル描画 & モバイル DOM タッチクライアント
├── tools/                      # 【管理ユーティリティ類】(tools/tr_manager, save_manager, config等)
├── tests/                      # 【テストHTML ＆ PoC群】(tests/driver_dom_test, webuicore_poc等)
├── docs/                       # 公式ドキュメント類 (docs/3_translation/ 等)
├── dictionary.csv              # マスター翻訳辞書
├── index.html                  # タイトルポータル画面
└── README.md                   # 本ドキュメント
```

---

## 🌟 主な特徴 & Core 機能

1. **`WebUIcore` によるドメイン一元管理 (`src/core/`)**:
   - **入力統合 (`KeyMapper` / `GamepadManager`)**: 統一キー変換、Ctrl/Alt 修飾キー合成、アクション送信 (`sendAction`)。
   - **🧠 GKL (Game Knowledge Layer) 状況推論エンジン (`src/core/knowledge/`)**:
     - C言語 WASM の低レイヤー通信プロトコルから、ダンジョンの 3階層マップ（Bottom:地形, Middle:アイテム, Top:キャラクター）および所持品・ステータス知識をリアルタイム解析・構造化保持。
     - 周囲の環境・足元の仕掛け・所持している道具（`pick-axe`/`wand of digging`/鍵/杖など）から「今最も有益な行動」を先回り推論して提示するコンテキストアクションエンジン。
   - **翻訳エンジン (`TranslationEngine`)**: メッセージの日本語自動翻訳・辞書マッチング・未翻訳自動ログ出力。
   - **音響エンジン (`SoundEngine`)**: SE 再生、8bit 合成音 (`Beepcore`) / Audio Asset 切替。
   - **構造化プロンプト & リザルト (`GameOverResolver`)**: YN / TEXT / MENU / FILE プロンプトを完全構造化データとしてバインド可能。

2. **マルチクライアント展開 (`examples/`)**:
   - **GKL Pure JS Client**: GKL 状況推論、推奨アクションパネル、アイコン型所持品インベントリ、🎯自キャラ周辺拡大ズームカメラ（3層透過＆浮遊アニメーション）をフル搭載した最新クライアント。
   - **Desktop Canvas & Mobile Touch Client**: 独自グラフィックタイル＆日本語フォントの高度な協調制御、およびレスポンシブバーチャルパッドを備えた Pure JS 実装。
   - **Pure JS リファレンス**: フレームワーク非依存の軽量モジュールクライアント。
   - **モダンフレームワーク版**: Vue 3, React 18, Svelte, SolidJS に対応したスタンドアロンクライアント（ビルド済 `dist/` 対応）。

3. **Web Worker 隔離アーキテクチャ (`@nethack/wasm-driver`)**:
   - WASM ゲームエンジンをバックグラウンドスレッドで隔離動作させ、メイン UI スレッドのレスポンスを 100% 保証。

---

## 📖 ガイドライン ＆ ドキュメント

- 🧠 **[GKL (Game Knowledge Layer) アーキテクチャ ＆ 仕様ドキュメント](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_gkl/gkl_documentation.md)** (`docs/3_gkl/gkl_documentation.md`)
- 📖 **[WebUIcore 利用方法・機能仕様ガイド](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/WebUICore_Usage_Guide.md)** (`docs/WebUICore_Usage_Guide.md`)
- 📖 **[翻訳ドキュメント ＆ ガイドインデックス](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_translation/README.md)** (`docs/3_translation/README.md`)
- 📦 **[WASM Driver パッケージドキュメント](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/driver/README.md)** (`src/driver/README.md`)

---

## 🛠️ 技術スタック

- **Core Engine**: NetHack 5.0.0 (C) / NetHackJP
- **Runtime**: WebAssembly (Emscripten / Asyncify)
- **Core Architecture**: `WebUIcore` Clean Architecture (`src/core/`)
- **Driver**: Web Worker Thread Isolation (`@nethack/wasm-driver`)
- **Frontend Frameworks**: Vanilla JS / Vue 3 / React 18 / Svelte / SolidJS
- **Graphics**: 2D Canvas Sprite Rendering / High-DPI DOM Grid Rendering
- **Audio Engine**: Web Audio API (Beepcore & Audio Assets)
- **Storage**: IndexedDB (IDBFS via Emscripten) / localStorage

---

## 📦 ローカルでの実行

リポジトリをクローンし、任意の HTTP サーバー（Python の `http.server` や VSCode Live Server、`npm run dev` など）を起動してアクセスします。

```bash
git clone https://github.com/e3-sh/Nethack-wasm-webUI.git
cd Nethack-wasm-webUI

# HTTP サーバーの起動例
python -m http.server 8000
```

起動後、ブラウザで `http://localhost:8000/index.html` または各 `examples/` を開くとポータル画面および各種クライアントが表示されます。

---

## 📜 ライセンス

- **NetHack**: [NetHack General Public License](https://www.nethack.org/common/license.html)
- **WebUI Logic & Driver**: MIT License

---

Developed by [e3sh](https://github.com/e3sh)
