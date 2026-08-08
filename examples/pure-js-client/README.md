# 🚀 NetHack Wasm WebUI - Pure JS Reference Client (`examples/pure-js-client/`)

本ディレクトリは、**WebUIcore (`src/core/WebUICore.js`)** を直接インポートし、React/Vue/Svelte/Solid 等のフロントエンドフレームワークを一切使用せずに構築された**標準 Pure JS / HTML5 リファレンスクライアント**です。

---

## ✨ 主な特徴

- **フレームワーク非依存**: Pure ES Modules JavaScript + Vanilla CSS + HTML5 Canvas で構成。
- **WebUIcore 100% 準拠**: `WebUICore` のイベント駆動設計（`stateChange`, `message`, `statusUpdate`, `inputRequired`, `textWindowModal`, `exited` 等）に従った完璧なサンプルコード。
- **UI コンポーネント網羅**:
  - 32x32 スプライト Canvas 描画 & ターゲット金枠カーソル
  - ステータスバー（HP/Pw/AC/Dlvl等）
  - メッセージログ自動スクロール
  - 構造化プロンプトモーダル (YNボタン / TEXT入力 / MENU上下キー選択 / FILEヘルプ)
  - Top 10 スコアボード付き Game Over モーダル
  - `core.restart({ clearStorage: true })` によるシームレスなリスタート処理

---

## 🏃 起動方法

### ローカル開発サーバーでの実行 (Vite / Live Server等)
ルートディレクトリ等で Vite 開発サーバーを実行中、またはローカル Web サーバーで本ディレクトリの `index.html` にアクセスします。

```bash
# WebUIRoot にて
npm run dev
# ブラウザで http://localhost:5173/examples/pure-js-client/index.html を開く
```

---
