# NetHack-wasm-webUI

NetHack 3.7.0 (Development) を WebAssembly にコンパイルし、Canvas ベースの独自描画エンジンでブラウザからプレイ可能にするプロジェクトです。

[**[ 🎮 今すぐブラウザでプレイ (Demo) ]**](https://e3sh.github.io/Nethack-wasm-webUI/)

## 🚀 特徴

- **NetHack 3.7.0 サポート**: 最新の開発版 NetHack を Wasm 上で動作。
- **混合描画エンジン (WebUI)**:
  - Canvas を用いた高速な描画。
  - タイル表示とフォントベース（ASCII/漢字）のレンダリングを同一画面・同一行で混在可能。
  - 日本語（JIS X 0208）に対応し、シャープなフォントレンダリングを実現。
- **データの永続化**:
  - IndexedDB (IDBFS) による、ブラウザ内でのセーブデータ保持。
  - 5分おきのオートセーブおよび正常終了時の自動保存を実装。

## 🎮 操作方法

- **移動**: 方向キー / テンキー
- **特殊コマンド (修飾キー)**: ブラウザのキー衝突を避けるため、**Spaceキー**を修飾キーとして使用します。
  - `Space` + `X` : `Ctrl+X` 相当の入力（^X）
  - `Space` 単体押しの場合は、通常の Space キーとして機能します。
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
- [x] 基本的な描画システムの構築
- [x] 漢字・記号・タイルの混合描画対応
- [x] IndexedDB によるセーブ機能の実装
- [/] UI/UX の洗練・タイルセットの調整
- [ ] タイル表示の完全対応 (一部特殊表示の検証)
- [ ] 日本語メッセージ辞書の拡充

## 📜 ライセンス

- **NetHack**: [NetHack General Public License](https://www.nethack.org/common/license.html)
- **WebUI Logic**: MIT License

---
Developed by [e3-sh](https://github.com/e3-sh)
