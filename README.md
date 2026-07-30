# NetHack-wasm-webUI

NetHack 5.0 (および NetHackJP) を WebAssembly (Wasm) にコンパイルし、Web Worker 隔離マルチスレッドアーキテクチャと Canvas / DOM ハイブリッド描画エンジンによりブラウザ上で快適に動作させるモダン WebUI プロジェクトです。

日本語翻訳表示、音声再生システム (8bit Synth & Audio asset)、柔軟な各種入力デバイス（キーボード・JISキーボード・ゲームパッド・バーチャルタッチパネル）、および独立利用可能な汎用 WASM Driver ライブラリ (`@nethack/wasm-driver`) を搭載しています。

👉 **[🎮 プレイする（メインポータル / タイトル画面）](https://e3sh.github.io/Nethack-wasm-webUI/)**

> ※ 上記のポータル（タイトル画面）から、**Desktop(Canvas)モード**、**Mobile(DOM)モード**、**システム設定**、**セーブデータ管理**、および各種**開発・調整ツール（Sound Tester等）**へアクセスできます。

---

## 🌟 主な機能

- **NetHack 5.0.0 & NetHackJP 完全対応**: 最新の 5.0.0 正式版 Wasm コアを動作。日本語版 (`nethack_jp.js`) とのシームレス切替および UTF-8 ネイティブパススルー対応。
- **Web Worker 隔離型マルチスレッドアーキテクチャ**:
  - 重い NetHack Wasm コアエンジンをバックグラウンドの Web Worker スレッドに完全分離 (`NetHackWasmWorkerBridge`)。
  - メイン UI スレッドの応答性を100%維持し、入力遅延や画面フリーズのない極めてスムーズな操作性を実現。
- **ハイブリッド描画システム**:
  - **Desktop (Canvas Mode)**: タイル表示とフォントベース（ASCII/漢字）の同一行混在表示、JIS X 0208 フォントレンダリングに対応。
  - **Mobile (DOM Mode)**: モバイル端末向けに Canvas を使用しない軽量・高精細な DOM レンダリングエンジンを搭載。
- **音声再生システム (usersounds & 8bit Synth)**:
  - メッセージトリガー（usersounds方式）による効果音再生。
  - WAV/MP3オーディオアセット再生に加え、アセット不要の 8bit レトロ合成音（`Beepcore` / Web Audio API オシレーター）に対応。
  - 音源モード（`Auto` / `Wave` / `Beep` / `Mute`）を選択可能。
- **日本語翻訳 & アイテムパース機能**:
  - アイテム構成要素（数量、状態、変化値等）を解析し日本語として再構成するリアルタイム分析エンジン。
  - 辞書マッチングによるゲームメッセージの日本語表示および `yn_function` 選択肢翻訳。
- **堅牢なデータ永続化＆セーブデータ管理**:
  - IndexedDB (IDBFS via Emscripten) によるオートセーブ・終了時セーブの完全同期。
  - 死亡時ハイスコア (Top 10 Record / xlogfile) のパースと `localStorage` 永続化。
  - `save_manager.html` によるセーブデータの確認・一括管理・削除 API 統合。
- **マルチデバイス・操作カスタマイズ**:
  - JIS キーボード (`#` / `IntlRo`) および拡張コマンド (`#` / EXT_CMD) プロンプト統合。
  - コンテキスト依存のバーチャルタッチパッド＆カスタマイズ可能なゲームパッドマッピング対応。

---

## 🏗️ システムアーキテクチャ

本プロジェクトは、WebUI 表示層と WASM コアエンジン層が明確に分離されたモダンなマルチレイヤー設計となっています：

```
┌─────────────────────────────────────────────────────────┐
│                    WebUI Layer                          │
│   (game.html, mobile.html, GameManager.js, UIManager.js) │
└───────────────────────────┬─────────────────────────────┘
                            │  Typed Events (WorkerBridge)
┌───────────────────────────▼─────────────────────────────┐
│             @nethack/wasm-driver Package                │
│    (NetHackWasmWorkerBridge.js, InputResolver.js)       │
└───────────────────────────┬─────────────────────────────┘
                            │  Web Worker Message Channel
┌───────────────────────────▼─────────────────────────────┐
│                  Web Worker Thread                      │
│ (nethack.worker.js, NetHackWasmDriver.js, FSManager.js)  │
└───────────────────────────┬─────────────────────────────┘
                            │  Emscripten / Asyncify C-API
┌───────────────────────────▼─────────────────────────────┐
│                 NetHack 5.0 Wasm Core                   │
│         (nethack.wasm, nethack.js, winshim.c)           │
└─────────────────────────────────────────────────────────┘
```

> **独立ライブラリ仕様**:  
> `src/driver/` 配下のモジュール群は `@nethack/wasm-driver` パッケージとして整理されており、他の React, Vue, Node.js, AI クライアント等の外部プロジェクトからも単体でライブラリとしてインポート利用可能です。詳細は [src/driver/README.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/driver/README.md) を参照してください。

---

## 🎮 操作方法

- **移動**: 方向キー / テンキー / アナログスティック (Gamepad)
- **修飾キー (Space)**: ブラウザのショートカットキー衝突を避けるため、**Spaceキー**を修飾キーとして使用可能です。
  - `Space` + `X` : `Ctrl+X` 相当の入力（^X）
  - `Space` 単体押しの場合は、通常の Space キーとして機能します。
- **JIS キーボード & 拡張コマンド**:
  - JIS キーボードの `#` キー（`IntlRo` / `_`）を直接押すことで拡張コマンド入力プロンプトが起動します。
- **Gamepad / Touch Panel**:
  - ゲームパッドのレバー・全ボタン対応。
  - スマートフォン・タブレット向けのバーチャルパッド（ゲーム状況に応じた自動レイアウト切替）対応。

---

## 🛠️ 技術スタック

- **Core Engine**: NetHack 5.0.0 (C) / NetHackJP
- **Runtime**: WebAssembly (Emscripten / Asyncify)
- **Architecture**: Web Worker Thread Isolation (`NetHackWasmWorkerBridge`)
- **Frontend**: JavaScript (Vanilla JS / ES6+ / UMD / ESM)
- **Graphics**: HTML5 Canvas API / High-DPI DOM Rendering Engine
- **Audio Engine**: Web Audio API / Beepcore (sys/coremin.js) / SoundManager
- **Storage**: IndexedDB (IDBFS via Emscripten) / localStorage
- **WASM Driver Package**: `@nethack/wasm-driver` (v1.0.0)

---

## 📦 ローカルでの実行

リポジトリをクローンし、任意の HTTP サーバー（Python の `http.server` や VSCode Live Server など）を起動してアクセスしてください。

```bash
git clone https://github.com/e3-sh/Nethack-wasm-webUI.git
cd Nethack-wasm-webUI

# HTTPサーバーの起動例
python -m http.server 8000
```
起動後、ブラウザで `http://localhost:8000` を開くとメインタイトル画面が表示されます。

---

## 📈 開発ステータス

- [x] NetHack 5.0.0 の Wasm コンパイル & 5.0 タイルマッピング対応
- [x] 基本的な描画システム（Canvas / DOM）の構築
- [x] 漢字・記号・タイルの混合描画対応
- [x] 音声再生システム（usersoundsメッセージフック & Beepcore 8bit Synth）の実装
- [x] Web Worker 隔離マルチスレッドモデル (`NetHackWasmWorkerBridge`) への完全移行
- [x] 汎用 WASM Driver パッケージ (`@nethack/wasm-driver`) の独立化 & README 整備
- [x] 死亡時ハイスコア (Top 10 Record / xlogfile) の VFS 解析 & 永続化修復
- [x] セーブデータ一覧・詳細確認・削除 API (`save_manager.html`) の統合
- [x] `config.html` 経由のカスタムオプション (`NETHACKOPTIONS`) 連携
- [x] メインタイトル画面（ポータルメニュー）の統合リニューアル
- [x] アイテム名パースエンジンの実装
- [x] コンテキスト対応 Gamepad UI & タッチ操作の実装
- [x] モバイルレイアウト（座標補正・全画面対応）の最適化
- [ ] sound_mapping.json のメッセージへのサウンド割り当て調整（未調整）
- [ ] ゲームパッド・バーチャルタッチパッドのデフォルトボタン/キーレイアウト割り当て調整（未調整）
- [/] 日本語メッセージ辞書の拡充（進行中）

---

## 📜 ライセンス

- **NetHack**: [NetHack General Public License](https://www.nethack.org/common/license.html)
- **WebUI Logic & Driver**: MIT License

---

Developed by [e3sh](https://github.com/e3sh)
