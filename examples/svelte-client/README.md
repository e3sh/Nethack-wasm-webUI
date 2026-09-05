# NetHack WebUICore - Svelte + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/svelte-client`) は、**`WebUICore` / `@nethack/wasm-driver`** を使用して構築された、Svelte + TypeScript による公式サンプルアプリケーションです。

Svelte Writable Store によるリアクティブ状態管理、`WebUICore` / `GKLPlugin` の構造化データ・ダイレクトバインド設計パターンを提示しています。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[Svelte サンプルクライアントを体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/svelte-client/dist/index.html)**

---

## ✨ 主な機能 ＆ コンポーネント構成

本クライアントは React / Vue 版と同等のフル機能 2 カラム UI 構造を備えています：

- **`services/useNetHackDriver.ts` (`NetHackDriverController`)**:
  - `WebUICore` と Svelte Writable Stores を接続するメインコントローラー。
- **`FocusCamera.svelte` (🔍 21x9 中央フォーカス・ズームビュー)**:
  - 自キャラ周辺 21x9 の高精細ズーム Canvas ビューポート。GKL 解決済みの `renderGlyphs` レイヤー描画、自キャラバウンス、Visual FX、死亡時墓石表示に対応。
- **`InventoryGrid.svelte` (🎒 32px スプライトインベントリ)**:
  - 所持アイテムを 32px スプライトアイコンでグリッド表示。BUC状態バッジ（`+`, `-`）、装備状態、長押し・右クリックサブメニューに対応。
- **`AssistSignalBar.svelte` (🛡️ HUD アシストバー)**:
  - 危険状況・即死トラップ警告・推奨アクションのワンタップ実行。
- **`DirectionPad.svelte` & `ContextActions.svelte` (🧭 8方向連動アクション)**:
  - 周囲の状況や手持ちの道具に応じた文脈アクション（掘る、開ける、解錠、攻撃等）。
- **`GklKnowledgeTabs.svelte` (💡 戦術アドバイス ＆ ナレッジインスペクター)**:
  - リアルタイム戦術アドバイスと、マップ/アイテムホバー時の詳細構造化データ表示。
- **`WishModal.svelte` (🪄 #wish ビルダー ＆ プリセット)**:
  - 望みの杖・魔法によるアイテム生成ビルダー。カテゴリ別プリセット、祝福・強化値・数量の指定。
- **`StatusBar.svelte` (📊 ゲージ ＆ 詳細ステータス)**:
  - HP/Pw ゲージ、属性耐性、習得魔法、スキル熟練度一覧。

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

1. **Svelte Writable Store リアクティビティ**:
   `useNetHackDriver.ts` の各ストア (`gameStore`, `gklSituationStore` 等) を各コンポーネントで `$store` 記法により購読することで、無駄な再レンダリングを抑えた高速な更新を実現しています。
2. **オンデマンド座標問い合わせ (`inspectCellOnDemand`)**:
   マップ上のホバーやクリックは `gkl.inspectCellOnDemand({ x, y })` に一任し、未探索セルでの誤判定を防ぎます。
