---
title: 制御シグナル (Control Signal) による専用UI化とメニュー判断集約アーキテクチャ
status: active
last_updated: 2026-09-15
related_code:
  - src/core/prompt/ControlSignalCatalog.js
  - src/core/prompt/ControlSignalCatalog.ja.js
  - src/core/prompt/SignalDetector.js
  - src/core/prompt/PromptPayloadBuilder.js
  - examples/gkl-pure-js-client/modules/components/ModalManager.js
  - examples/gkl-pure-js-client/modules/components/CharacterCreationModal.js
  - src/core/container/ContainerController.js
---

# 制御シグナル (Control Signal) による専用UI化とメニュー判断集約アーキテクチャ

**〜UI層の文脈解釈を完全撤廃し、Core/GKLによるシグナル確定で堅牢な専用UIを実現する設計原則〜**

---

## 1. 背景と基本思想 (Philosophy & Background)

### 1.1 「メニュー判断などをUIにやらせてはならない」
NetHack の生インターフェース（C コア）は、すべて CUI（端末テキスト・行プロンプト・文字メニュー）として出力されます。
これをモダンな専用 Web UI（キャラクタ作成画面、コンテナ操作、ペーパードール、重量管理など）に拡張する際、**「このメニューは何のメニューか？」「この文字列はアイテム一覧か？それとも確認画面か？」という判断をフロントエンド UI 層（Modal や View）に持たせることは、アーキテクチャ上のアンチパターン**です。

UI層に文脈解析（正規表現マッチングやアイテム名判別）を委ねると、以下の致命的な問題が発生します：
1. **アイテムサブメニューとの誤爆（False Positive）**:
   - 例: キャラクタ確定画面の正規表現が、インベントリ内の `the blessed +1 silver dragon scale mail` 等のアーティファクト名に過剰マッチし、ダンジョン探索中に「冒険の準備が整いました」ダイアログが誤起動する。
2. **多言語・バリアント対応の破綻**:
   - Vanilla NetHack（英語）、JNetHack（日本語）、Slash'EM 等のバリアントごとに文言が異なるため、UI コンポーネント側で全パターンの文字列を追いかけるとコードがスパゲッティ化する。
3. **UI 差し替え性・自動化（AI/Bot）の阻害**:
   - 別の UI（React/Vue 製クライアント、モバイル専用 UI、あるいは自動プレイエージェント）を実装する際、同じ解析ロジックを各クライアントで再実装する必要が生じる。

### 1.2 黄金律：Core / GKL でシグナル（SIGNAL）を確定させてから UI に渡す
本アーキテクチャでは、**NetHack C コアからのあらゆるプロンプト／メニュー／ダイアログを、低レイヤー通信・解釈層（`SignalDetector` / `ControlSignalCatalog` / `PromptPayloadBuilder`）で機械可読な専用シグナル（`SIGNAL_...`）として同定・確定し、UI 層はシグナルを受け取って描画に専念する** という関心の分離（SoC）を徹底します。

---

## 2. 2大制御モデル：受動的モーダル型 vs 能動的作業セッション型

専用 UI を実装するにあたり、操作の性質に応じて以下の **2つの制御モデル** を明確に区別して設計します。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      専用UIの 2大アーキテクチャ制御モデル                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
           ┌───────────────────────────┴───────────────────────────┐
           ▼                                                       ▼
  【1. 受動的モーダルコントロール型】               【2. 能動的作業セッション（専有）型】
  ・主導権: NetHack C コア                          ・主導権: フロントエンド・コントローラ
  ・動作: C コアが順次 inputRequired を発行         ・動作: 1つの意図に対して複合キーを連続実行
  ・状態: 単一ステップの打ち返し (respond)          ・状態: SessionLock / 作業中縛り (排他専有)
  ・代表例: キャラクタ作成、願い (Wish)、           ・代表例: コンテナ操作 (Loot)、
           変化 (Polymorph)、虐殺 (Genocide)                 ペーパードール (装備着脱)、重量整理
```

### 2.1 受動的モーダルコントロール型 (Passive Modal Control)
- **主導権**: **NetHack C コア**
- **メカニズム**:
  - C コアが自律的にウィザードを進め、ステップごとに「職業を選べ」「種族を選べ」「確定せよ」とプロンプトを発行。
  - WebUICore がそれを検知し、`subCategory: 'CHARACTER_CREATION'`, `signal: { id: 'SIGNAL_CHARACTER_CREATION', params: { step: 'role' } }` をペイロードに付与。
  - UI 側（`ModalManager` / `CharacterCreationModal`）はシグナルを受け取ってモーダルを描画し、選ばれたキーを `core.respond(key)` で1文字返答するのみ。
  - フロントエンド側でセッションロックやステートマシンによる排他制御を行う必要がない。

### 2.2 能動的作業セッション型 (Active Session / Recipe Execution)
- **主導権**: **フロントエンド・コントローラ（`ContainerController` 等）**
- **メカニズム**:
  - プレイヤーの「アイテムを袋に入れたい」という1アクションに対し、裏では `#loot` ➔ 方向指定 ➔ カテゴリ選択 ➔ アイテム指定 ➔ 個数入力 という複数ターンの通信が走る。
  - 途中で別のキーや操作が割り込むとゲーム状態が致命的に破壊されるため、**`SessionLock`（作業中縛り）** を発動して操作権をコントローラが専有する。
  - C コアから返ってくる中間シグナル（`SIGNAL_CONTAINER_CATEGORY_SELECT`, `SIGNAL_COUNT_PROMPT` 等）をコントローラが自律的にインターセプトして解決し、最終的な完了シグナル（`turn_ready` 等）で作業中縛りを解除する。

---

## 3. レイヤー境界とデータフロー (Pipeline Architecture)

```
 [ NetHack C-Core (WASM) ]
            │ (生プロンプト文字列, menuItems, context)
            ▼
 ┌───────────────────────────────────────────────────────────┐
 │ 1. 制御シグナルカタログ層 (ControlSignalCatalog.js / .ja.js) │
 │    - バリアント・ロケール別（Vanilla / JNetHack）のSSOT辞書   │
 │    - パターン正規表現、優先度 (priority)、paramsMapping   │
 └───────────────────────────────────────────────────────────┘
            │
            ▼
 ┌───────────────────────────────────────────────────────────┐
 │ 2. シグナル検知エンジン層 (SignalDetector.js)              │
 │    - コンテキストフィルタ評価                                │
 │    - プロンプト文字列照合 ＆ メニュー構造（items）補助検証   │
 │    - 出力: { matched: true, signalId, subCategory, params }│
 └───────────────────────────────────────────────────────────┘
            │
            ▼
 ┌───────────────────────────────────────────────────────────┐
 │ 3. ペイロード構築層 (PromptPayloadBuilder.js)              │
 │    - ナレッジ自動結合 (GKL)                                 │
 │    - GUIInputRequiredPayload への subCategory / signal 格納  │
 └───────────────────────────────────────────────────────────┘
            │ (inputRequired イベント: 構造化 payload)
            ▼
 ┌───────────────────────────────────────────────────────────┐
 │ 4. UI マネージャ層 (ModalManager.js)                       │
 │    - data.subCategory === '...' によるルーティング         │
 │    - 完了フラグガード (!modal.isCompleted) による二重防御   │
 └───────────────────────────────────────────────────────────┘
            │ (ディスパッチ)
            ▼
 ┌───────────────────────────────────────────────────────────┐
 │ 5. 専用 UI コンポーネント層 (CharacterCreationModal 等)     │
 │    - 文字列パースを行わず、構造化データ・バッジを描画        │
 └───────────────────────────────────────────────────────────┘
```

---

## 4. 今後専用UI化するプレイ要素とシグナル設計ロードマップ

本アーキテクチャに基づき、今後実装する主要プレイ要素はすべて以下のシグナル体系へ集約します。

| プレイ要素（専用UI） | 制御モデル | NetHack C コア側の生挙動 | 定義すべき制御シグナル (SIGNAL) |
| :--- | :--- | :--- | :--- |
| **キャラクタ作成** (実装済) | 受動的モーダル | `Pick a role...`, `Is this ok? [ynq]` | `SIGNAL_CHARACTER_CREATION` (`subCategory: 'CHARACTER_CREATION'`) |
| **コンテナ操作** (実装済) | 能動的作業セッション | `#loot`, 取り出し/収納メニュー, 個数 | `SIGNAL_CONTAINER_ACTION_MENU`<br>`SIGNAL_CONTAINER_CATEGORY_SELECT`<br>`SIGNAL_CONTAINER_ITEM_SELECT` |
| **ペーパードール (装備管理)** | 能動的作業セッション | `w`, `W`, `T`, `P`, `R`, `Q` 等の着脱・持ち替えメニュー | `SIGNAL_EQUIPMENT_SLOT_SELECT`<br>`SIGNAL_WEAPON_WIELD`<br>`SIGNAL_ARMOR_WEAR_TAKEOFF`<br>`SIGNAL_ACCESSORY_PUT_REMOVE` |
| **重量・荷物整理** | 能動的作業セッション | 重量超過警告、`d`, `D` 一括ドロッププロンプト | `SIGNAL_INVENTORY_DROP_BATCH`<br>`SIGNAL_BURDEN_STATUS_CHANGE` |
| **ショップ売買** | 受動的 / 能動的複合 | 店主の請求、価格提示、購入確認 `[yn]` | `SIGNAL_SHOP_TRANSACTION`<br>`SIGNAL_SHOP_BILL_PAY` |
| **魔法詠唱・スキル熟練** | 受動的モーダル | `Z` (cast), `e` (enhance) のスロット選択 | `SIGNAL_SPELL_CAST_SELECT`<br>`SIGNAL_SKILL_ENHANCE_MENU` |

---

## 5. 実装ルールとチェックリスト (Implementation Checklist)

新しい専用 UI やメニューを実装する際は、必ず以下のチェックリストを遵守すること：

- [ ] **UIコンポーネント内で `rawPrompt` やアイテム名の正規表現パースを行っていないか？**
  - 行っている場合は即座にリファクタリングし、シグナル定義へ移行する。
- [ ] **`ControlSignalCatalog.js` (en) および `ControlSignalCatalog.ja.js` (ja) にシグナルを登録したか？**
  - バリアントと言語差分をカタログで吸収しているか確認する。
- [ ] **誤爆の可能性のあるプロンプト（`[yn]` や `is this ok` 等）に対してアイテム検証を行っているか？**
  - `SignalDetector` の `_validate...` ヘルパーでアイテムヘッダーや確定選択肢を AND 条件にしているか確認する。
- [ ] **ゲーム進行状態（`turn > 0` や `isCompleted`）に応じた起動ガードを設けているか？**
  - ゲーム本編中（ダンジョン内）で初期化系シグナルが絶対に誤発火しないようガードされているか確認する。
- [ ] **作業セッション型（能動的コントローラ）の場合、`SessionLock` で排他制御を行っているか？**
  - シーケンス実行中にプレイヤーのキー入力や別イベントの割り込みを遮断できているか確認する。
