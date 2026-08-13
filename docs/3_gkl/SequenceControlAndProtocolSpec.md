# Game Knowledge Layer (GKL) シーケンス制御 ＆ WASM Cコア通信プロトコル仕様書

本文書は、NetHack WASM WebUI における Game Knowledge Layer (GKL) Phase 2 のコア仕様である**「多段階プロンプト自走消化エンジン (`queueSequence`)」**、**「WASM Cコア通信プロトコル」**、および**「`RequestController` 状態マシン」** の技術的詳細と設計結果を記録したものです。

---

## 1. 低レイヤー受動・自走消化エンジン (`NetHackWasmDriver.js`)

### 1.1 `queueSequence(tokens, options)` の基本原理
- **概要**: ユーザーまたは上位レイヤー（GKL / `WebUICore`）からトークン配列（例: `['#', 'kick', 'DIR_E']` や `['o', 'DIR_E']`）を受け取り、WASM Cコアが発生させる同期入力要求 (`inputRequired`) に追従して受動的・自動的に応答を打ち込む自走消化エンジン。
- **SoC (責務の分離) 原則**:
  - `NetHackWasmDriver` はどこまでも「受け取ったトークン列をそのまま Cコアへ手渡すピュアな受動通信エンジン」であり、アイテムパースやゲームルールの解釈といったお節介な加工を一切行わない。
  - Cコアが解釈可能な正当なトークン配列（`['#', 'kick', 'DIR_E']`）を組み立てる責務は、上位の GKL / アクション生成層 (`ContextActionEngine` / `WebUICore`) が負う。

### 1.2 `DIR_*` 抽象キーのキーモード動的変換
- ドライバー内部の `resolveTokenKey(token)` は、抽象方向キー (`DIR_N`, `DIR_E`, `DIR_S`, `DIR_W` 等) を、現在の操作モード (`numpad` / `vi`) に応じて動的に対応する文字（`'8'`, `'6'`, `'2'`, `'4'` 等 または `'k'`, `'l'`, `'j'`, `'h'` 等）へ安全変換する役割のみを担う。

### 1.3 【実装完了仕様】シーケンス実行結果の一時バッファ獲得 (`lastSequenceBuffer`) ＆ 汎用サイレントクエリ (`querySequenceSilent`)

Cコアの内部メモリをハックすることなく、任意のコマンド実行結果を非同期 Promise で安全獲得する通信プロトコル仕様。

```
 [querySequenceSilent(['i', ' ']) 発行] ──▶ (this.lastSequenceBuffer = [] を初期化)
          │
          ▼
 [シーケンス自走消化中] ─────────────────▶ Cコアからの putstr / textWindowBuffers / select_menu を
                                             画面非表示 (suppressPrompts: true) のまま
                                             lastSequenceBuffer 配列に自動保存
          │
          ▼
 [シーケンス完了待機 (Promise)] ─────────▶ driver.getLastSequenceBuffer() のクリーンコピーを返却
                                             GKL (SituationCache / InventoryStateManager) や AI は
                                             100% 正確なバッファデータから状態を一括同期更新
```

- **利点**: WASM メモリ参照ハックが 100% 不要。あらゆるコマンドの実行結果を完全な通信テキストデータとして非同期で安全獲得可能。

---

## 2. WASM Cコア通信プロトコルとレスポンス仕様

WASM Cコア側における主要な入力コンテキスト（`context`）と、期待されるレスポンスの型、および `\r` (Enter) の要不要の検証結果は以下の通りである。

| 入力コンテキスト | 代表例・発生場所 | 期待するレスポンスの型 | `\r` (Enter) の要不要 | 通信動作のメカニズム・理由 |
| :--- | :--- | :--- | :--- | :--- |
| **`poskey`** | マップ上の移動・1文字キー | ASCII数値 (`number`) またはキー文字 | **不要** | 1キー受領時に即時 Cコアへ復帰 |
| **`getch`** | 画面送り・1文字入力待ち | ASCII数値 (`number`) またはキー文字 | **不要** | 1キー受領時に即時 Cコアへ復帰 |
| **`yn_function`** | 方向要求 (`In what direction?`) / Y/N | 選択肢のASCII数値 (`number`) | **不要** | 選択キー1文字（`'6'`, `'y'`, `'n'` 等）で即時確定 |
| **`select_menu`** | メニュー選択画面 | 選択項目配列 or `0` (キャンセル) | **不要** | 項目選択時/キャンセル時に即時確定 |
| **`get_ext_cmd`** | 拡張コマンド (`#` の直後) | コマンド名文字列 (`"kick"`, `"chat"`) | **不要** | ドライバーが受領文字列から `extcmds.indexOf("kick")` を引いてインデックス数値へ直訳変換するため即時確定 |
| **`getlin`** | 刻み文字・名前自由入力 (`#engrave`) | 任意の文字列 (`"Elbereth"`) | **不要** | ドライバーが `stringToUTF8(input, bufp, 256)` で直接 Cのメモリバッファへ書き込むため `\r` なしの文字列単体で即時確定 |

> [!IMPORTANT]
> **Enterキー (`\r`) トークンの不要性について**
> WASM Cコアの `shim_get_ext_cmd` および `shim_getlin` は、文字列（例: `"kick"` や `"Elbereth"`）を受領した時点で内部で入力確定処理を行うため、トークン配列内に余計な `'\r'` を挟むと Cコアの次の入力待ちを誤爆・破壊する。
> したがって、シーケンス配列は `['#', 'kick', 'DIR_E']` のように素直なトークン分解を行うのが正解である。

---

## 3. GKL 状態マシンコントローラー (`RequestController.js`)

`src/core/knowledge/RequestController.js` は、自走シーケンス実行の安全性を担保する状態マシンである。

```
  ┌──────────────┐
  │     IDLE     │ ◄────────────────────────┐
  └──────┬───────┘                          │
         │ executeSequence()                │ Sequence End /
         ▼                                  │ Cancel / Esc
  ┌──────────────┐                          │
  │  EXECUTING   ├──────────────────────────┤
  └──────┬───────┘                          │
         │ 物理キー割り込み (Physical Key)   │
         ▼                                  │
  ┌──────────────┐                          │
  │  SUSPENDED   ├──────────────────────────┘
  └──────────────┘
```

- **IDLE**: 待機状態。
- **EXECUTING**: シーケンス自走消化中（中間モーダル非表示、`putmsg` ログ配信）。
- **SUSPENDED**: ユーザーによる物理キーボード/ゲームパッド操作の割り込みを検出した際、キューを即時クリアして物理操作を最優先する状態。
- **ABORTING_ESC**: ESCキーキャンセルによるシーケンス安全脱出状態。

---

## 4. `driver_test.html` と 他UIクライアントの等価性

- `driver_test.html` のテキスト入力欄における `#, kick, DIR_S` 手打ちは、内部で `['#', 'kick', 'DIR_S']` へカンマ分割されて `queueSequence` に投入されていた。
- GKL 推奨アクションエンジン (`ContextActionEngine`) も全く同じ `['#', 'kick', 'DIR_E']` や `['o', 'DIR_E']` のトークン配列を生成して `executeAction` へ送出することにより、UIクライアントからボタンを押した際にも画面モーダルなしで完全に等価な一発自走消化が実現される。
