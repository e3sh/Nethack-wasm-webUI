# NetHack-wasm-webUI

NetHack 5.0.0 (正式版) を WebAssembly にコンパイルし、Canvas ベースおよび DOM ベースのハイブリッド描画エンジンによりブラウザ上で動作させる WebUI プロジェクトです。日本語翻訳表示および各種入力デバイス（キーボード・ゲームパッド・タッチパネル）に対応しています。

👉 **[🎮 プレイする（メインポータル / タイトル画面）](https://e3sh.github.io/Nethack-wasm-webUI/)**

> ※ 上記のポータル（タイトル画面）から、**Desktop(Canvas)モード**、**Mobile(DOM)モード**、**システム設定**、**セーブデータ管理**、および各種**開発・調整ツール**へアクセスできます。

---

## 🌟 主な機能

- **NetHack 5.0.0 完全対応**: 最新の 5.0.0 正式版を Wasm 上で動作。5.0向けのタイルマッピング最適化やバグ調整に対応。
- **ハイブリッド描画システム**:
  - **Desktop (Canvas Mode)**: タイル表示とフォントベース（ASCII/漢字）の同一行混在表示、JIS X 0208 フォントレンダリングに対応。
  - **Mobile (DOM Mode)**: モバイル端末向けに Canvas を使用しない軽量・高精細な DOM レンダリングエンジンを搭載。
- **日本語翻訳機能**:
  - アイテム構成要素（数量、状態、変化値等）を解析し日本語として再構成するリアルタイム分析エンジン。
  - 辞書マッチングによるゲームメッセージの日本語表示。
- **セーブデータ＆データ管理**:
  - IndexedDB (IDBFS) によるブラウザ内永続化（オートセーブ＆終了時セーブ）。
  - セーブデータのインポート / エクスポートおよびブラウザ上でのログビューワー（record, logfile, xlogfile 等）機能。
- **マルチデバイス・操作カスタマイズ**:
  - PWA 仕様準拠、レスポンシブレイアウト最適化、キャラクター自動カメラセンタリング。
  - コンテキスト依存のバーチャルタッチパッド＆カスタマイズ可能なゲームパッドマッピング対応。

---

## 🎮 操作方法

- **移動**: 方向キー / テンキー / アナログスティック (Gamepad)
- **修飾キー (Space)**: ブラウザのショートカットキー衝突を避けるため、**Spaceキー**を修飾キーとして使用します。
  - `Space` + `X` : `Ctrl+X` 相当の入力（^X）
  - `Space` 単体押しの場合は、通常の Space キーとして機能します。
- **Gamepad / Touch Panel**:
  - ゲームパッドのレバー・全ボタン対応。
  - スマートフォン・タブレット向けのバーチャルパッド（ゲーム状況に応じた自動レイアウト切替）対応。
  - マッピング設定およびエクスポート/インポートはタイトル画面の開発ツールからアクセス可能です。

---

## 🛠️ 技術スタック

- **Core**: NetHack 5.0.0 (C)
- **Runtime**: WebAssembly (Emscripten / Asyncify)
- **Frontend**: JavaScript (Vanilla JS / ES6+)
- **Graphics**: HTML5 Canvas API / DOM Rendering Engine
- **Storage**: IndexedDB (IDBFS via Emscripten) / localStorage

---

## 📦 ローカルでの実行

リポジトリをクローンし、任意の HTTP サーバー（Python の `http.server` など）を起動してアクセスしてください。

```bash
git clone https://github.com/e3-sh/Nethack-wasm-webUI.git
cd Nethack-wasm-webUI

# HTTPサーバーの起動例
python -m http.server 8000
```
起動後、ブラウザで `http://localhost:8000` を開くとメインタイトル画面が表示されます。

---

## 📈 開発ステータス

- [x] NetHack 5.0.0 の Wasm コンパイル
- [x] 5.0のタイル配置変更に伴う WebUI 側の調整
- [x] 基本的な描画システム（Canvas / DOM）の構築
- [x] 漢字・記号・タイルの混合描画対応
- [x] IndexedDB によるセーブ機能およびマネージャーの実装
- [x] メインタイトル画面（ポータルメニュー）の統合リニューアル
- [x] アイテム名パースエンジンの実装
- [x] コンテキスト対応 Gamepad UI & タッチ操作の実装
- [x] モバイルレイアウト（座標補正・全画面対応）の最適化
- [/] 日本語メッセージ辞書の拡充（進行中）

---

## 📜 ライセンス

- **NetHack**: [NetHack General Public License](https://www.nethack.org/common/license.html)
- **WebUI Logic**: MIT License

---

Developed by [e3sh](https://github.com/e3sh)
