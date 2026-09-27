---
title: GKL クライアント モーダル・ダイアログ群デザインシステム統一＆UIリファクタリング構想
status: implemented
last_updated: 2026-09-27
author: e3-sh & Antigravity
---

# 🎨 GKL クライアント モーダル・ダイアログ群デザインシステム統一＆UIリファクタリング構想

## 📌 1. 背景と課題意識

NetHack WASM WebUI（特に GKL Pure JS Client）では、これまで多機能化・高機能化に伴い、以下のリッチな専用モーダル・GUI が順次開発・投入されてきました：

1. **ゲーム開始導入フロー (`CharacterIntroModal.js`)**: 冒険者名入力、キャラ作成モード選択（ゴールド枠、ステップインジケーター）
2. **キャラクタ詳細作成 (`CharacterCreationModal.js`)**: タブ型ウィザード（ダークスレート枠、左右2ペイン）
3. **装備ペーパードール (`PaperdollModal.js`)**: 人型スロット配置、換装シミュレータ
4. **二画面ファイラー型コンテナ (`ContainerModal.js`)**: 床／インベントリ／箱の双方向移動
5. **冒険手帳・伝承図鑑 (`CodexModal.js`)**: 噂・神託・関連エンティティ閲覧
6. **インテリジェント入力支援ダイアログ群**: 願い (`WishModal`), 虐殺 (`GenocideModal`), 変化制御 (`PolymorphModal`), 魔法のマーカー (`WriteModal`)
7. **通常メニュー・プロンプト (`ModalManager.js`)**: 原作互換メニュー、テキスト入力、YN 選択
8. **ナレッジ詳細 (`KnowledgeDetailModal.js`)**: モンスター・アイテム・地形の詳細スペック表示

### 課題
各コンポーネントが機能単位で順次追加されてきた歴史的経緯から、以下のデザイン要素に微妙な差異・バラつきが生じています：
- **枠線・ボーダーカラー**: ゴールド系アクセント（導入カード等） vs ダークスレート／ブルー系（キャラメイク、ペーパードール等）
- **ヘッダー構成**: バッジ・アイコン・タイトルの階層構造や閉じるボタン（✕）の配置
- **ボタン・コンポーネント**: 決定・キャンセルのグラデーションやパディング、角丸サイズ（`border-radius: 6px / 8px / 10px / 12px`）
- **背景オーバーレイ（Backdrop）**: 暗さ・ブラー強度の共通化（※背景色自体は `rgba(15, 15, 26, 0.7)` ＆ `blur(2px)` に概ね統一済）

現時点では「導入カード（金枠）から詳細キャラメイク（スレート枠）へ移ることで画面変化が直感的に感じられる」といった副次的メリットもありますが、長期的な保守性および完成度の観点から、**デザインシステム（Design System）としての共通ルール策定とCSSリファクタリングが必要**と認識されています。

---

## 💡 2. 統一に向けたアプローチ構想 (RFC)

### 2.1 CSS Variables / トークンの一元化
- `css/base.css` または専用の `css/design-tokens.css` において、ダイアログ共通のデザイントークンを定義：
  - `--modal-card-bg`: 背景グラデーション
  - `--modal-border-color`: 統一された外枠ボーダー
  - `--modal-border-radius`: 角丸規格（例: `12px`）
  - `--modal-header-padding` / `--modal-body-padding`

### 2.2 共通ベースカードコンポーネントまたは CSS クラス規約
- 各モーダルでバラつきのある `.char-create-modal-container`, `.char-intro-card`, `.modal-card`, `.paperdoll-container` などを、共通のベースクラス（例: `.gkl-modal-card`）およびバリアントクラス（`.size-sm`, `.size-md`, `.size-lg`, `.size-full`）に整理。

### 2.3 ヘッダー・フッターの共通レイアウト
- 左側: アイコン ＋ タイトル ＋ ステップ/カテゴリバッジ
- 右側: 言語切り替えまたは閉じるボタン（✕）
- 下部フッター: アクションボタン（キャンセル / OK）の配置統一

---

## 📋 3. ロードマップにおける位置付け

- **ステータス**: `🟢 implemented` (2026-09-26 完了)
- **関連コミット**: `600c688` (Update Nehww: UI/UXの刷新)

---

## 🟢 4. 実装完了・達成状況 (Neo-Retro Dark Glass UI 統一)

2026-09-26 の UI/UX 刷新において、本構想に基づくリファクタリングが全面的に実施・完了しました。

1. **デザイントークンの一元化 (`css/base.css`)**:
   - `--glass-bg`: `rgba(15, 23, 42, 0.78)`
   - `--glass-blur`: `blur(12px)`
   - `--glass-border`: `1px solid rgba(56, 189, 248, 0.22)`
   - `--glass-shadow-lg`: `0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 25px rgba(56, 189, 248, 0.12)`
   - `--primary-color`: サイバーシアン（`#38bdf8`）
2. **全モーダルへの共通トークン適用**:
   - `CharacterIntroModal.js` (`character-intro-modal.css`): 金枠からフロストガラス＋サイバーシアンへ統一
   - `CharacterCreationModal.js` (`character-creation-modal.css`): スレート枠からフロストガラス規格へ統一
   - `PaperdollModal.js` (`paperdoll-modal.css`): 人型スロットと外枠カードのフロストガラス統一
   - `ContainerModal.js` (`container-modal.css`): ファイラーパネルのフロストガラス統一
   - `CodexModal.js` (`codex-modal.css`): 噂・神託リストカードの共通規格化
   - `KnowledgeDetailModal.js` (`knowledge-detail-modal.css`): 詳細ナレッジモーダルの統一
   - `ModalManager.js` (`modals.css`): テキスト入力、YNプロンプト、インテリジェント入力支援モーダル群の統一
3. **品質検証**:
   - 全モーダルの表示・フォーカス・キーボード操作において回帰ゼロを達成（全90テストファイル、1,190テスト PASS）。
