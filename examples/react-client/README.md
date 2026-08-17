# NetHack WebUICore - React 18 + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/react-client`) は、**`WebUICore` / `@nethack/wasm-driver`** を使用して構築された、React 18 + TypeScript による公式サンプルアプリケーションです。

Zustand による軽量状態管理、TypeScript による型安全なイベント受容、React Hook (`useNetHackDriver`) と `WebUICore` / `GKLPlugin` の構造化データ・ダイレクトバインド設計パターンを提示しています。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[React 18 サンプルクライアントを体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/react-client/dist/index.html)**

---

## ✨ 主な機能 ＆ コンポーネント構成

- **`useNetHackDriver.ts` (React カスタムフック)**:
  - `WebUICore` と状態ストアを仲介するフック。`getZoomAreaTiles` や `executeSequence` などの安全なバインドを提供。
- **`GklKnowledgePanel.tsx` (🧠 GKL 状況推論 ＆ ナレッジアシスト)**:
  - **⚡ アイコン即時自動実行**: 所持品アイコンタップで `executeSequence` による装備・使用の一発即時実行。
  - **💡 浮き出し解説ポップアップ**: ホバー時にアイテム名・ワンタップアクション予告・日本語効果解説を浮き出し表示。
  - **🎽 装備バッジ ＆ 枠線カラー**: メイン武器 (`[手]`, `#e9c46a`)、副武器 (`[副]`, `#4ea8de`)、矢筒 (`[筒]`, `#2a9d8f`)、着用防具 (`[着]`, `#9d4edd`)。
  - **🎯 8方向アクションフィルター (`extractDirectionCode`)**: 8方向 ＋ 足元 (`SELF`) の正規化コードによる一貫したアクション絞り込み。
  - **🔍 7x7 高精細ダンジョンズームカメラ**: プレイヤーを中心とした半径3マス（7x7=全49マス）の 24px スプライトタイル高密度ミニマップビューア。
- **`GameCanvas.tsx` / `StatusBar.tsx` / `PromptModal.tsx`**:
  - React コンポーネントによるゲーム画面・ステータス・モーダルダイアログ。

---

## 🚀 起動 & ビルド方法

```bash
# 開発起動 (ルートより)
npm run dev:react

# スタンドアロンビルド (examples/react-client にて)
npm run build
```

---

## 🏛️ アーキテクチャと構築ガイドライン

1. **完全な疎結合設計 (GKL オプショナル設計)**:
   `WebUICore` 単体でも完全に独立して動作し、`GKLPlugin` を接続しない場合でも通常プレイに一切影響を与えません。
2. **未探索セル (`glyphId = 0`) の誤検出防止**:
   NetHack の Glyph ID 0 は `giant ant` に該当するため、`tileId === 0` かつ `symbol === ' '` のセルは `glyphId = -1` (未探索) として扱い誤判定を防ぎます。
