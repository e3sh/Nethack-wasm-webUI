---
title: 全画面マップ＆イマーシブHUDメッセージウィンドウ設計仕様書
status: proposed (Roadmap 2.1 / Phase D 連携)
last_updated: 2026-09-26
author: e3-sh & Antigravity
related_code:
  - src/core/WebUICore.js
  - src/driver/NetHackWasmDriver.js
  - examples/gkl-pure-js-client/
---

# 📜 全画面マップ＆イマーシブHUDメッセージウィンドウ設計仕様書
### （アプローチB：フローティング最新行HUD ＋ 展開型過去ログドロワー）

## 1. 概要とコンセプト

本ドキュメントは、NetHack WASM WebUI のロードマップ（Roadmap 2.1 / Phase D「全画面マップ＋透過HUD」）に向けた、**新しいメッセージ表示システム（イマーシブHUDメッセージウィンドウ）**の設計仕様書です。

### コンセプト：オリジナル NetHack の精神とモダン HUD の融合
1. **マップ領域の最大化（原点回帰）**:
   - オリジナルの CUI/TTY 版 NetHack は、画面の約 90% がマップであり、メッセージは最上部のわずか 1 行（`topline`）にのみ表示され、過去ログは `Ctrl+P` で必要な時だけ呼び出す構造でした。
   - 常時画面を圧迫する従来の分割パネル（サイドバー型ログ）を廃止し、**ダンジョンマップを画面いっぱい（100vw × 100vh）に広げます**。
2. **フローティング最新行 HUD**:
   - 行動（ターン）の瞬間だけ、画面上部（または自キャラ周辺）に最新メッセージが半透明でポップアップ。
   - 太字（`isBold: true`）や緊急メッセージ（`attr: ATR_URGENT`）は鮮やかな白やハイライトで強調。
   - 次の行動をとるとスムーズにフェードアウト・入れ替わり、探索中は視界を遮りません。
3. **必要な時だけ引き出す「過去ログドロワー」**:
   - `Ctrl+P` キー、マウスホイールのスクロール、または画面端の履歴アイコンタップにより、半透明の過去ログ一覧がスッとスライドインして全履歴を確認可能。

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
  * **過去ログドロワー**: 画面右端（または上部）からスライドインする半透明パネル。
  * **ContextActions / 吹き出し（`bubbleMessage`）**: マップ上の対象座標直上。

---

## 3. WebUICore とのデータ連携仕様

先ほど実装した `WebUICore` のメッセージ基盤をフル活用します。

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

### (1) フローティング最新行 HUD (`FloatingMessageHud.js`)

#### 動作フロー
1. `bubbleMessage` を受信すると、メッセージ行をキューに追加（最大 2〜3 行）。
2. CSS アニメーション（スライドイン＋フェードイン）で表示。
3. `isBold === true` の場合は太字フォント（`font-weight: 700`）＋発光エフェクト（`text-shadow: 0 0 8px rgba(255,255,255,0.6)`）を適用。
4. プレイヤーが次のアクションを入力した際（ターン経過時）に、前のターンの行をフェードアウト。

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

### (2) 展開型過去ログドロワー (`MessageLogDrawer.js`)

#### 展開トリガー
* キーボード: **`Ctrl + P`**（NetHack 伝統のメッセージ履歴コマンド）
* マウス: マップ上で上スクロール（Wheel Up）、または画面隅の 📜 アイコンクリック
* 閉じる操作: `ESC` キー、ドロワー外クリック、またはスクロールダウン

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

## 5. 実装ロードマップ（Roadmap 2.1 / Phase D 連携）

| ステップ | タスク内容 | 対象ファイル |
|---|---|---|
| **Step 1** | `FloatingMessageHud` コンポーネント新設<br/>（最新行の透過オーバーレイ表示と太字強調） | `examples/gkl-pure-js-client/modules/components/FloatingMessageHud.js`<br/>`css/floating-message-hud.css` |
| **Step 2** | `MessageLogDrawer` コンポーネント新設<br/>（`Ctrl+P` / スクロール展開、全履歴閲覧） | `examples/gkl-pure-js-client/modules/components/MessageLogDrawer.js`<br/>`css/message-log-drawer.css` |
| **Step 3** | 全画面マップレイアウト化（Phase D と合流）<br/>従来の固定サイドバーメッセージ枠を廃止し全画面化 | `examples/gkl-pure-js-client/index.html`<br/>`examples/gkl-pure-js-client/main.js` |
| **Step 4** | 他クライアント（React / Solid / Vue）向けアダプタ提供 | `src/client/` 各サンプルへの展開 |

---

## 6. まとめ
本アーキテクチャにより、
* **「普段は全画面で臨場感あふれるダンジョン探索」**
* **「行動した瞬間だけ最新メッセージがスマートに主張」**
* **「必要な時はいつでも NetHack 伝統の `Ctrl+P` でログ全体を俯瞰」**
という、理想的なモダンローグライク体験が実現されます。
