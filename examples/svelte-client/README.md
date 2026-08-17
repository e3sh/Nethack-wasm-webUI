# NetHack WebUICore - Svelte + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/svelte-client`) は、**`WebUICore` / `@nethack/wasm-driver`** を使用して構築された、Svelte + TypeScript による公式サンプルアプリケーションです。

Svelte Writable Store によるリアクティブ状態管理、`WebUICore` / `GKLPlugin` の構造化データ・ダイレクトバインド設計パターンを提示しています。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[Svelte サンプルクライアントを体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/svelte-client/dist/index.html)**

---

## ✨ 主な機能 ＆ コンポーネント構成

- **`useNetHackDriver.ts` (`NetHackDriverController`)**:
  - `WebUICore` と Svelte ストアを連携するコントローラークラス。
- **`GklKnowledgePanel.svelte` (🧠 GKL 状況推論 ＆ ナレッジアシスト)**:
  - **⚡ アイコン即時自動実行**: 所持品アイコンタップで `executeSequence` による装備・使用の一発即時実行。
  - **💡 浮き出し解説ポップアップ**: ホバー時にアイテム名・ワンタップアクション予告・日本語効果解説を浮き出し表示。
  - **🎽 装備バッジ ＆ 枠線カラー**: メイン武器 (`[手]`), 副武器 (`[副]`), 矢筒 (`[筒]`), 着用防具 (`[着]`)。
  - **🎯 8方向アクションフィルター (`extractDirectionCode`)**: Svelte の完全リアクティブ宣言 (`$: dirCounts = ...`) による方向別数値バッジ。
  - **🔍 7x7 高精細ダンジョンズームカメラ**: `$cursorPosStore` と `$mapGridStore` のリアクティブバインド (`$: zoomTiles = ($cursorPosStore, $mapGridStore, driverController.getZoomAreaTiles(3));`) によるリアルタイムズーム更新。

---

## 🚀 起動 & ビルド方法

```bash
# 開発起動 (ルートより)
npm run dev:svelte

# スタンドアロンビルド (examples/svelte-client にて)
npm run build
```

---

## 🏛️ アーキテクチャと構築ガイドライン

1. **Svelte ストアリアクティビティのバインドノウハウ**:
   Svelte コンポーネント内でメソッド経由でストアを参照する場合、`$: zoomTiles = ($cursorPosStore, $mapGridStore, driverController.getZoomAreaTiles(3));` のように参照ストアをリアクティブトリガーに明示的に含めることで、ストア更新時にコンポーネントが 100% 確実に再計算されます。
2. **未探索セル (`glyphId = 0`) の誤検出防止**:
   `tileId === 0` かつ `symbol === ' '` のセルは `glyphId = -1` (未探索) として扱い、`giant ant` の誤判定を防ぎます。
