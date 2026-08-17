# NetHack WebUICore - SolidJS + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/solid-client`) は、**`WebUICore` / `@nethack/wasm-driver`** を使用して構築された、SolidJS + TypeScript による公式サンプルアプリケーションです。

SolidJS Signals & Stores による超高速・ファイングレイン・リアクティブ状態管理、`WebUICore` / `GKLPlugin` の構造化データ・ダイレクトバインド設計パターンを提示しています。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[SolidJS サンプルクライアントを体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/solid-client/dist/index.html)**

---

## ✨ 主な機能 ＆ コンポーネント構成

- **`useNetHackDriver.ts` (`NetHackDriverController`)**:
  - `WebUICore` と SolidJS Store / Signal を接続するコントローラー。
- **`GklKnowledgePanel.tsx` (🧠 GKL 状況推論 ＆ ナレッジアシスト)**:
  - **⚡ アイコン即時自動実行**: 所持品アイコンタップで `executeSequence` による装備・使用の一発即時実行。
  - **💡 浮き出し解説ポップアップ**: ホバー時にアイテム名・ワンタップアクション予告・日本語効果解説を浮き出し表示。
  - **🖼️ SolidJS スタイル安全マッピング (`getSolidGlyphStyle`)**: JSX インライン style 属性用のハイフン区切りプロパティ展開による正確なスプライト画像描画。
  - **🎯 8方向アクションフィルター (`extractDirectionCode`)**: 方向別アクションフィルタリング。
  - **🔍 7x7 高精細ダンジョンズームカメラ**: プレイヤーを中心とした 7x7 ミニマップズームビューア。

---

## 🚀 起動 & ビルド方法

```bash
# 開発起動 (ルートより)
npm run dev:solid

# スタンドアロンビルド (examples/solid-client にて)
npm run build
```

---

## 🏛️ アーキテクチャと構築ガイドライン

1. **SolidJS インライン Style マッピング**:
   SolidJS の JSX インライン style 属性に CSS オブジェクトを渡す際は、`background-image`, `background-position` などのハイフン区切りプロパティ名で整形して適用します。
2. **未探索セル (`glyphId = 0`) の誤検出防止**:
   `tileId === 0` かつ `symbol === ' '` のセルは `glyphId = -1` (未探索) として扱い、`giant ant` の誤判定を防ぎます。
