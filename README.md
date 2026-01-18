# NetHack-wasm-webUI

NetHack 3.7.0 (Development) を WebAssembly にコンパイルし、Canvas ベースの独自描画エンジンでブラウザからプレイ可能にするプロジェクトです。

[**[ 🎮 今すぐブラウザでプレイ (Demo) ]**](https://e3sh.github.io/Nethack-wasm-webUI/)

## 🚀 特徴

- **NetHack 3.7.0 サポート**: 最新の開発版 NetHack を Wasm 上で動作。
- **独自 UI エンジン (WebUI)**:
  - Canvas を用いた高速な描画。
  - タイル表示だけでなく、フォントベースのレンダリングもサポート。
- **日本語対応**:
  - JIS X 0208 等の漢字フォントレンダリングを実装。
  - 日本語メッセージの表示に対応。
  - 日本語版 [Guidebook](https://e3sh.github.io/Nethack-wasm-webUI/Guidebook.ja.html) を同梱。
- **データの永続化**:
  - IndexedDB (IDBFS) による、ブラウザ内でのセーブデータ保持。
  - 5分おきのオートセーブおよび正常終了時の自動保存を実装。

## 🎮 操作方法

- **移動**: 方向キー / テンキー
- **特殊コマンド (Ctrlキー)**: **Spaceキー**をCtrlキーの代わりにとして使用します。
  - 例: `Ctrl+X` (詳細ステータス表示) は `Space` + `X` で入力。
  - `Space` 単体押しの場合は、Spaceキーとして機能します。
- **Gamepad**: 十字キーによる移動をサポート（ボタン割り当ては調整中）。

## 🛠️ 技術スタック

- **Core**: NetHack 3.7.0 (C)
- **Runtime**: WebAssembly (Emscripten / Asyncify)
- **Frontend**: JavaScript (Vanilla JS / ES6+)
- **Graphics**: HTML5 Canvas API
- **Storage**: IndexedDB (IDBFS via Emscripten)

## 📦 セットアップ

### ローカルでの実行

リポジトリをダウンロードし、HTTP サーバー（Python の `http.server` など）を起動してアクセスしてください。

```bash
git clone https://github.com/e3-sh/Nethack-wasm-webUI.git
cd Nethack-wasm-webUI

# HTTPサーバーの起動例
python -m http.server 8000
```
起動後、ブラウザで `http://localhost:8000` を開きます。

### ビルド (開発者向け)

NetHack を WebAssembly にビルドするには、Emscripten SDK (emsdk) 等の環境構築が必要です。
Windows 環境および Linux/WSL 環境での詳細なビルド手順については、[**ビルド手順のリファレンス (shim_reference.ja.md)**](shim_reference.ja.md#ビルド手順WebAssembly) を参照してください。

## 📈 開発ステータス

- [x] NetHack 3.7.0 の Wasm コンパイル
- [x] 基本的な描画システム (GameCore) の構築
- [x] 漢字フォントのレンダリング対応
- [x] IndexedDB によるセーブ機能の実装
- [/] UI/UX の洗練
- [ ] タイル表示の完全対応
- [ ] 日本語メッセージ完全対応

## 📜 ライセンス

- **NetHack**: [NetHack General Public License](https://www.nethack.org/common/license.html)
- **WebUI Logic**: MIT License

---
Developed by [e3-sh](https://github.com/e3-sh)
