# NetHack WebUICore - SolidJS + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/solid-client`) は、**`WebUICore` / `@nethack/wasm-driver`** を使用して構築された、SolidJS + TypeScript による公式サンプルアプリケーションです。

SolidJS Signals & Stores による超高速・ファイングレイン・リアクティブ状態管理、`WebUICore` / `GKLPlugin` の構造化データ・ダイレクトバインド設計パターンを提示しています。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[SolidJS サンプルクライアントを体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/solid-client/dist/index.html)**

---

## ✨ 主な機能 ＆ コンポーネント構成

本クライアントは React / Vue 版と同等のフル機能 2 カラム UI 構造を備えています：

- **`services/useNetHackDriver.ts` (`NetHackDriverController`)**:
  - `WebUICore` と SolidJS Store / Signals を接続するメインコントローラー。
- **`FocusCamera.tsx` (🔍 21x9 中央フォーカス・ズームビュー)**:
  - 自キャラ周辺 21x9 の高精細ズーム Canvas ビューポート。GKL 解決済みの `renderGlyphs` レイヤー描画、自キャラバウンス、Visual FX、死亡時墓石表示に対応。
- **`InventoryGrid.tsx` (🎒 32px スプライトインベントリ)**:
  - 所持アイテムを 32px スプライトアイコンでグリッド表示。BUC状態バッジ（`+`, `-`）、装備状態、長押し・右クリックサブメニューに対応。
- **`AssistSignalBar.tsx` (🛡️ HUD アシストバー)**:
  - 危険状況・即死トラップ警告・推奨アクションのワンタップ実行。
- **`DirectionPad.tsx` & `ContextActions.tsx` (🧭 8方向連動アクション)**:
  - 周囲の状況や手持ちの道具に応じた文脈アクション（掘る、開ける、解錠、攻撃等）。
- **`GklKnowledgeTabs.tsx` (💡 戦術アドバイス ＆ ナレッジインスペクター)**:
  - リアルタイム戦術アドバイスと、マップ/アイテムホバー時の詳細構造化データ表示。
- **`WishModal.tsx` (🪄 #wish ビルダー ＆ プリセット)**:
  - 望みの杖・魔法によるアイテム生成ビルダー。カテゴリ別プリセット、祝福・強化値・数量の指定。
- **`StatusBar.tsx` (📊 ゲージ ＆ 詳細ステータス)**:
  - HP/Pw ゲージ、属性耐性、習得魔法、スキル熟練度一覧。

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

1. **SolidJS スタイルマッピング (`getGlyphStyleString`)**:
   SolidJS のインラインスタイル適用時は、`getGlyphStyleString` で生成した CSS 文字列を `style={getGlyphStyleString(glyphId)}` としてバインドすることで、高パフォーマンスなスプライト描画を実現しています。
2. **オンデマンド座標問い合わせ (`inspectCellOnDemand`)**:
   マップ上のホバーやクリックは `gkl.inspectCellOnDemand({ x, y })` に一任し、未探索セルでの誤判定を防ぎます。
