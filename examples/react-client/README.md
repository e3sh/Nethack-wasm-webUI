# NetHack Wasm Driver - React 18 + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/react-client`) は、**`@nethack/wasm-driver`** を使用して構築された、React 18 + TypeScript + Zustand による実践的な WebUI アプリケーションです。

`examples/README.md` に定義された共通アーキテクチャ・設計基準に 100% 遵守して設計されており、キー入力競合対策・二重応答防止（SafeResolver）・Tile Mapping 2D Canvas 描画・各種モーダル制御などのノウハウが完全実装されています。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[React 18 サンプルクライアントを今すぐ体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/react-client/dist/index.html)**
  *(※ GitHub Pages 公開時は `https://<username>.github.io/<repo>/examples/react-client/dist/` にてそのまま 1 クリックで動作します)*

---

## ✨ 主な機能

- **ハイブリッド 2D Canvas マップ (`MapCanvas.tsx`)**:
  - `param/tileMapping.js` の正統スプライトマッピング (`nethack_default_32.png`) に対応。
  - 未割り当てタイルや文字マスは 16 色 TTY カラーの monospace フォントでハイブリッド描画。
  - 暗闇・未探知マス (`tileId === 0`) でのアリ描画を自動スキップし、漆黒のダンジョン表現を実現。
  - `curs` イベントによるリアルタイムなプレイヤー位置・カーソル位置のシックなスリム枠線表示。
- **堅牢なメッセージ & ステータスバー (`StatusBar.tsx`, `MessageLog.tsx`)**:
  - HP, Pw, AC, Gold, Exp, Dungeon Level (`DLEVEL`) などをリアルタイム同期。
  - C コア初期化時のノイズログフィルタリングおよび重複メッセージの自動排他カット。
- **万能プロンプトハンドラ (`InputPrompt.tsx`)**:
  - 文字列入力 (`askname`, `getlin`, `#extcmd`) に応じた安全な入力フォーム (+ ESC キャンセル)。
  - Y/N 質問プロンプトの確定受容 (y/n/q ボタン & ダイレクトキー操作)。
  - 例外的な質問文言（`"Do you want a tutorial?"` 等）を無表示・操作不能にならず自動吸収する安全フォールバック。
- **インベントリ & メニューダイアログ (`MenuModal.tsx`)**:
  - 選択肢アイテムのスプライト表示 & アクセラレータキー (a, b, c...) のクリック/直接打鍵。
  - 閲覧専用メニュー (`how === 0`) やアイテムなしメニューの自動解放処理。
- **長文閲覧用テキストモーダル (`TextWindowModal.tsx`)**:
  - ヘルプファイル (`display_file`) や案内画面 (`display_nhwindow` >= 4) の閲覧モード。

---

## 🚀 起動 & ビルド方法

### 依存パッケージのインストール
`examples/react-client` ディレクトリ内：
```bash
npm install
```

### 開発用ローカルサーバーの起動 (Vite)
`examples/react-client` ディレクトリ内：
```bash
npm run dev
```
自動的に `http://localhost:3001/` が立ち上がり、ホットリロード対応の開発環境がブラウザで開きます。

### スタンドアロン静的ビルド (GitHub Pages / Live Server 用)
```bash
npm run build
```
ビルドが完了すると、`examples/react-client/dist/` ディレクトリ内に **Wasm バイナリ・Worker スクリプト・画像データがすべて同梱された完全独立パッケージ** が生成されます。
この `dist/` フォルダをそのまま Live Server で開いたり、GitHub Pages へ配備するだけで 100% 動作します。

---

## 🏛️ 実装のツボ (React 特有の最適化)

1. **Zustand による軽量・高パフォーマンスな状態管理**:
   - React Context の不要な全体再レンダリングを回避し、必要な状態変化（マップグリッド、ステータス、ログ）のみをコンポーネントへ精密に通知。
2. **SafeResolver ラッパーによる二重応答防止**:
   - NetHack Worker コールバックからの `respond()` / `cancel()` の重複呼び出しを遮断し、ブラウザコンソール警告の発生を 100% 回避。
3. **キーボード操作遮断ガード**:
   - テキスト入力フォームフォーカス中、メニューモーダル表示中、テキスト表示モーダル表示中は、グローバル移動キー（矢印キー, hjkl）の Wasm 送信を 100% 遮断。
