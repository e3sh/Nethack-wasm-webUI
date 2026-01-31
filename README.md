# NetHack-wasm-webUI

NetHack 3.7.0 (Development) を WebAssembly にコンパイルし、Canvas ベースの独自描画エンジンでブラウザからプレイ可能にするプロジェクトです。

[**[ 🎮 今すぐブラウザでプレイ (Demo) ]**](https://e3sh.github.io/Nethack-wasm-webUI/)

## 🚀 特徴

- **NetHack 3.7.0 サポート**: 最新の開発版 NetHack を Wasm 上で動作。
- **混合描画エンジン (WebUI)**:
  - Canvas を用いた高速な描画。
  - タイル表示とフォントベース（ASCII/漢字）のレンダリングを同一画面・同一行で混在可能。
  - 日本語（JIS X 0208）に対応し、シャープなフォントレンダリングを実現。
- **翻訳エンジン**:
  - 単純な文字列置換だけでなく、アイテム構成要素（数量、状態、強化値、名称）の動的な解析と再構成。
  - 翻訳キャッシュによる高頻度メッセージ（インベントリ等）の高速表示。
  - 再帰的なパターンマッチングによる複雑なフレーズの自然な日本語化。
- **データの永続化**:
  - IndexedDB (IDBFS) による、ブラウザ内でのセーブデータ保持。
  - 5分おきのオートセーブおよび正常終了時の自動保存を実装。

## 🎮 操作方法

- **移動**: 方向キー / テンキー
- **特殊コマンド (修飾キー)**: ブラウザのキー衝突を避けるため、**Spaceキー**を修飾キーとして使用します。
  - `Space` + `X` : `Ctrl+X` 相当の入力（^X）
  - `Space` 単体押しの場合は、通常の Space キーとして機能します。
- **Gamepad**: 全ボタン・レバーに対応。
  - **アナログスティック**: 自由な移動（テンキー相当の入力）。
  - **ボタンカスタマイズ**: `LT/RT/LB/RB` などを修飾キーとして組み合わせた多層的なマッピングに対応。
  - **設定方法**: 下記の「GpadToKey 構成ツール」にてブラウザから設定可能。

## 🛠️ 技術スタック

- **Core**: NetHack 3.7.0 (C)
- **Runtime**: WebAssembly (Emscripten / Asyncify)
- **Frontend**: JavaScript (Vanilla JS / ES6+)
- **Graphics**: HTML5 Canvas API
- **Storage**: IndexedDB (IDBFS via Emscripten)

## 🛠️ 開発者向けツール

### NetHack Translation Tester (`tr_test.html`)
翻訳ロジックや辞書パターンの検証をブラウザ上で行える限定ツールです。
- 翻訳前後のリアルタイムプレビュー。
- `trancelate.js` と各辞書ファイルの動作確認に最適。

### GpadToKey 配置構成ツール (`rogue/mapping_tool.html`)
ゲームパッドのボタンに任意のキーを割り当てるための設定ツールです。
- **キーキャプチャ機能**: 実際のキーボード入力を検知して自動登録。
- **多層モード**: LB / LT / RB / RT 等を押しながらの別アクション設定。
- **設定の永続化**: JSON形式でのエクスポート/インポートおよびブラウザ（localStorage）への保存。

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
- [/] UI/UX の洗練・タイルセットの調整
- [ ] タイル表示の完全対応 (一部特殊表示の検証)
- [/] 日本語メッセージ辞書の拡充（進行中）

## 📜 ライセンス

- **NetHack**: [NetHack General Public License](https://www.nethack.org/common/license.html)
- **WebUI Logic**: MIT License

---
Developed by [e3-sh](https://github.com/e3-sh)
