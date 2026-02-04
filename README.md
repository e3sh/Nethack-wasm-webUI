# NetHack-wasm-webUI

NetHack 3.7.0 (Development) を WebAssembly にコンパイルし、Canvas ベースの描画エンジンによりブラウザ上で動作させるプロジェクトです。日本語翻訳表示および各種入力デバイスへの対応を目的としています。

[**[ 🎮 デモ (Demo) ]**](https://e3sh.github.io/Nethack-wasm-webUI/)

## 主な機能

- **NetHack 3.7.0 対応**: 開発版 NetHack を Wasm 上で動作。
- **混合描画方式**:
  - Canvas を用いた描画。
  - タイル表示とフォントベース（ASCII/漢字）の同一行での混在表示に対応。
  - 日本語（JIS X 0208）フォントのレンダリングをサポート。
- **翻訳機能**:
  - アイテム構成要素（数量、状態、変化値等）を解析し、日本語として再構成するエンジンを搭載。
  - 辞書マッチングによるメッセージの翻訳表示。
- **セーブデータ保持**:
  - IndexedDB (IDBFS) によるブラウザ内での永続化。
  - 定期的なオートセーブおよび終了時の保存機能を実装。

## 🎮 操作方法

- **移動**: 方向キー / テンキー
- **特殊コマンド (修飾キー)**: ブラウザのキー衝突を避けるため、**Spaceキー**を修飾キーとして使用します。
  - `Space` + `X` : `Ctrl+X` 相当の入力（^X）
  - `Space` 単体押しの場合は、通常の Space キーとして機能します。
- **Gamepad**: 全ボタン・レバーに対応。
  - **アナログスティック**: (左レバー)自由な移動（テンキー相当の入力）。
  - **ボタンカスタマイズ**: `LT/RT/LB/RB` などを修飾キーとして組み合わせた多層的なマッピングに対応。
  - **設定方法**: 下記の「ゲームパッドマッピングツール」にて設定可能。
- **Touch Panel**: スマートフォン・タブレット向けのバーチャルパッドを搭載。
  - **コンテキスト依存**: 移動、メニュー選択、YN回答など、ゲームの状態に応じてボタン配置が自動的に切り替わります。
  - **設定方法**: 下記の「タッチパネルマッピングツール」にて設定可能。
  - 
- (Gamepad, Touch Panelともにデフォルト値は調整不足、未調整です。よいレイアウトが出来たら教えてください。)
- (マッピング状態はツールでExport/Importできます。）

## 🛠️ 技術スタック

- **Core**: NetHack 3.7.0 (C)
- **Runtime**: WebAssembly (Emscripten / Asyncify)
- **Frontend**: JavaScript (Vanilla JS / ES6+)
- **Graphics**: HTML5 Canvas API
- **Storage**: IndexedDB (IDBFS via Emscripten)

## ⚒️ 開発支援ツール

### 翻訳検証ツール (`tr_test.html`)
翻訳ロジックや辞書パターンの検証をブラウザ上で行うためのツールです。
- 翻訳前後のリアルタイムプレビュー。
- `trancelate.js` と各辞書ファイルの動作確認用。

### ゲームパッドマッピングツール (`rogue/mapping_tool.html`)
ゲームパッドのボタンにキーを割り当てるための設定ツールです。
- **キーキャプチャ**: 実際のキー入力を検知して登録可能。
- **多層モード**: 修飾ボタン（LB/RT等）の組み合わせに対応。
- **データの入出力**: JSON形式でのエクスポート/インポート、およびブラウザへの保存。

### タッチパネルマッピングツール (`touch_mapping_tool.html`)
バーチャルパッド（タッチパネル）のボタン配置をカスタマイズするためのツールです。
- **コンテキスト別編集**: センター移動、左右ボタン、YN回答などの画面状態ごとに配置を設定可能。
- **設定の永続化**: 各コンテキストごとの設定をブラウザ（localStorage）へ保存。

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

## 📈 開発ステータス

- [x] NetHack 3.7.0 の Wasm コンパイル
- [x] 基本的な描画システムの構築
- [x] 漢字・記号・タイルの混合描画対応
- [x] IndexedDB によるセーブ機能の実装
- [x] アイテム名パースエンジンの実装
- [x] モダンなコンフィグ画面と設定永続化の実装
- [x] コンテキスト対応 Gamepad UI & タッチ操作の実装
- [/] 日本語メッセージ辞書の拡充（進行中）
- [ ] タイル表示の完全対応 (一部特殊表示の検証)
- [ ] モバイルレイアウト（見切れ等）の最適化（今後の課題）

## 📜 ライセンス

- **NetHack**: [NetHack General Public License](https://www.nethack.org/common/license.html)
- **WebUI Logic**: MIT License

---
Developed by [e3-sh](https://github.com/e3-sh)
