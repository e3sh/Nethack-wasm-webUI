---
title: 全画面マップ＆イマーシブHUDメッセージウィンドウ設計仕様書
status: implemented
last_updated: 2026-10-11
author: e3-sh & Antigravity
related_code:
  - src/core/WebUICore.js
  - src/ui-controller/FloatingMessageHudController.js
  - src/components/NhFloatingHud.js
  - examples/gkl-pure-js-client/modules/components/FloatingMessageHud.js
  - examples/gkl-pure-js-client/modules/components/MessageHistoryDrawer.js
---

# 📜 全画面マップ＆イマーシブHUDメッセージウィンドウ設計仕様書
### （アプローチB：フローティング最新行HUD ＋ 展開型過去ログドロワー）

## 1. 概要とコンセプト

本ドキュメントは、NetHack WASM WebUI の Phase D「全画面マップ＋透過HUD」および Phase E「Headless UIController ＆ Web Components」において実装完了した、**メッセージ表示システム（イマーシブHUDメッセージウィンドウ）**の設計仕様書です。

### コンセプト：オリジナル NetHack の精神とモダン HUD の融合
1. **マップ領域の最大化（原点回帰）**:
   - オリジナルの CUI/TTY 版 NetHack は、画面の約 90% がマップであり、メッセージは最上部のわずか 1 行（`topline`）にのみ表示され、過去ログは `Ctrl+P` で必要な時だけ呼び出す構造でした。
   - 常時画面を圧迫する従来の分割パネル（サイドバー型ログ）を廃止し、**ダンジョンマップを画面いっぱい（100vw × 100vh）に広げます**。
2. **フローティング最新行 HUD (`FloatingMessageHud.js` / `<nh-floating-hud>`)**:
   - 行動（ターン）の瞬間だけ、画面上部（または自キャラ周辺）に最新メッセージが半透明でポップアップ。
   - 太字（`isBold: true`）や緊急メッセージ（`attr: ATR_URGENT`）は鮮やかな白やハイライトで強調。
   - 次の行動をとるとスムーズにフェードアウト・入れ替わり、探索中は視界を遮りません（ピン留め固定 `togglePin` も可能）。
3. **必要な時だけ引き出す「過去ログドロワー」 (`MessageHistoryDrawer.js`)**:
   - `Ctrl+P` キー、または画面上部の履歴アイコンタップにより、半透明の過去ログ一覧がスッとスライドインして全履歴を確認可能。さらにピン留め（`togglePin`）による常時ドック表示にも対応。

---

## 2. 画面レイアウトとレイヤー構造

```
+===========================================================+
| [ HUD最新メッセージ枠 (フローティング・透過) ]            |
|   You hit the goblin. (太字 / 鮮やかな白)                 |
|   The goblin misses. (通常テキスト)                       |
+-----------------------------------------------------------+
|                                                           |
|                                                           |
|               ダンジョンマップ (全画面 100vw × 100vh)      |
|                                                           |
|                     @       d                             |
|                                                           |
|                                                           |
+-----------------------------------------------------------+
| [ ステータスHUD (半透明バー) ] Dlvl:1  HP:16(16)  T:15    |
+===========================================================+
  [ 📜 過去ログドロワー (Ctrl+P / タップで右側からスライドイン) ]
```

### レイヤー構成
* **Layer 0 (最背面)**: ダンジョンマップ（WebGPU HD2D / Canvas 2D Viewport）全画面配置
* **Layer 10 (HUDレイヤー)**:
  * **フローティング最新行**: 画面上部中央。最大 2〜3 行。
  * **ステータスバー**: 画面下部中央。
* **Layer 20 (オーバーレイ)**:
  * **過去ログドロワー (`MessageHistoryDrawer.js`)**: 画面上部・右端からスライドインする半透明パネル（ピン留め時は画面レイアウトに固定）。
  * **ContextActions / 吹き出し（`bubbleMessage`）**: マップ上の対象座標直上。

---

## 3. WebUICore とのデータ連携仕様

`WebUICore` のメッセージ基盤および `FloatingMessageHudController`（Headless UI 状態管理）をフル活用します。

### (1) 利用するイベント
* **`core.on('bubbleMessage', ({ id, text, rawText, isBold }) => ...)`**:
  - 最新メッセージが発生するたびに発火（連打時も毎ターン発火）。
  - フローティング最新行HUDの更新、およびマップ上の頭上吹き出し表示のトリガー。
* **`core.on('messageUpdate', (item) => ...)`**:
  - 直前の通常メッセージが太字に昇格した場合の通知。最新行のスタイルを動的に太字化。
* **`core.on('messageItem', (item) => ...)`**:
  - 構造化ログ（`id`, `rawText`, `text`, `isBold`, `attr`, `isLatest`, `timestamp`）の受容。過去ログドロワーへの蓄積。

### (2) 利用する API
* **`core.getLatestMessage()`**: 現在の最新メッセージアイテムの取得。
* **`core.getMessageItems(count)`**: 過去ログドロワー展開時の履歴（最大200件）取得。

---

## 4. UIコンポーネント詳細仕様

### (1) フローティング最新行 HUD (`FloatingMessageHud.js` / `FloatingMessageHudController.js` / `<nh-floating-hud>`)

#### 動作フローと Headless 連携
1. Headless 層である `src/ui-controller/FloatingMessageHudController.js` がメッセージキュー、世代管理（`turnAge`）、ピン留め状態（`isPinned`）、およびゴールド獲得差分（`goldDelta`）を一元管理します。
2. `bubbleMessage` を受信すると、メッセージ行をキューに追加（最大 3〜4 行）。
3. CSS アニメーション（スライドイン＋フェードイン）で表示し、`isBold === true` の場合は太字フォント＋発光エフェクトを適用。
4. プレイヤーが次のアクションを入力した際（`userActionSent` ターン経過時）に、前のターンの行を世代減衰・フェードアウトさせます。
5. Web Components 版として `<nh-floating-hud>`（`src/components/NhFloatingHud.js`）も提供され、任意のフレームワークから同一のコントローラ状態で再利用可能です。

#### CSS トランジション設計
```css
.floating-message-hud {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none; /* マップクリックを妨げない */
  z-index: 100;
}

.floating-message-line {
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 6px 14px;
  color: #f8fafc;
  font-size: 14px;
  transition: opacity 0.3s ease, transform 0.3s ease;
  animation: hudMessageSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.floating-message-line.bold {
  font-weight: 700;
  color: #ffffff;
  border-color: rgba(250, 204, 21, 0.4);
  text-shadow: 0 0 8px rgba(250, 204, 21, 0.3);
}

@keyframes hudMessageSlideIn {
  from { opacity: 0; transform: translateY(-8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

---

### (2) 展開型過去ログドロワー (`MessageHistoryDrawer.js`)

#### 展開トリガーとピン留め (`togglePin`)
* キーボード: **`Ctrl + P`**（NetHack 伝統のメッセージ履歴コマンド）
* マウス: フローティングHUDの履歴ボタンまたはヘッダーの 📜 アイコンクリック
* **ピン留め機能 (`togglePin`)**: ドロワーヘッダーの 📌 ピン留めボタンをONにすると、外クリックや `ESC` キーでも閉じない常時表示モードとして固定可能。
* 閉じる操作: ピン留めOFF時に `ESC` キーまたはドロワー外背景クリック。

#### 内部表示（世代別透明度グラデーション ＆ バイリンガル表示モード）
ドロワー内では、最新ターンとの差分に応じた透明度グラデーションに加え、**「翻訳済み日本語」と「NetHack公式英語原文（`rawText`）」の双方を活用できるモード**を提供します：

1. **表示切り替えトグル ([ 🇯🇵 日本語 | 🔀 並列 (Bilingual) | 🇺🇸 原文 (Raw) ])**:
   * **🔀 並列表示モード（推奨デフォルト）**:
     * 主行に日本語翻訳テキスト（`text`）、その直下に少し小さく薄い文字色で英語原文（`rawText`）をルビや字幕のように併記。
     * ストーリーを日本語で味わいながら、アイテム名や公式メッセージの英語表現を同時に把握可能。
   * **🇯🇵 日本語のみモード**: すっきりとした日本語メッセージのみを表示。
   * **🇺🇸 原文のみモード**: オリジナルの英語 NetHack テキストのみを表示。
2. **ワンタップ・原文コピー機能**:
   * 各行のクリックまたはコピーアイコンタップで、素の `rawText` を即座にクリップボードへコピー可能。海外 Wiki や Spoilers（攻略データ）の検索・照合を爆速化。
3. **世代別透明度グラデーション**:
   * 今ターン（`isLatest === true`）：白 100%（太字）
   * 1〜2 ターン前：白 80%
   * 3〜5 ターン前：グレー 60%
   * それ以前：ダークグレー 40%

---

## 5. 実装状況（Phase D / Phase E 完了済み）

| ステップ | タスク内容 | 実装ファイル | 状態 |
|---|---|---| :---: |
| **Step 1** | `FloatingMessageHud` & Headless Controller 実装<br/>（最新行の透過オーバーレイ表示・太字強調・ゴールド差分） | `examples/gkl-pure-js-client/modules/components/FloatingMessageHud.js`<br/>`src/ui-controller/FloatingMessageHudController.js`<br/>`examples/gkl-pure-js-client/css/floating-hud.css` | **✅ 完了** |
| **Step 2** | `MessageHistoryDrawer` コンポーネント実装<br/>（`Ctrl+P` 展開、ピン留め `togglePin`、日英並列・原文コピー） | `examples/gkl-pure-js-client/modules/components/MessageHistoryDrawer.js`<br/>`examples/gkl-pure-js-client/css/floating-hud.css` | **✅ 完了** |
| **Step 3** | 全画面マップレイアウト化（Phase D 統合）<br/>従来の固定サイドバーメッセージ枠を刷新し全画面HUD化 | `examples/gkl-pure-js-client/index.html`<br/>`examples/gkl-pure-js-client/main.js`<br/>`examples/gkl-pure-js-client/modules/layout/LayoutController.js` | **✅ 完了** |
| **Step 4** | Web Components (`<nh-floating-hud>`) 提供 | `src/components/NhFloatingHud.js` | **✅ 完了** |

---

## 6. まとめ
本アーキテクチャにより、
* **「普段は全画面で臨場感あふれるダンジョン探索」**
* **「行動した瞬間だけ最新メッセージがスマートに主張」**
* **「必要な時はいつでも NetHack 伝統の `Ctrl+P` でログ全体を俯瞰」**
という、理想的なモダンローグライク体験が実現されます。
