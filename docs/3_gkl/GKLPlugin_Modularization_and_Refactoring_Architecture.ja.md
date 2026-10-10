# 🧩 GKLPlugin モジュール分割・アーキテクチャ適正化設計書 (GKLPlugin Modularization & Refactoring Architecture)

- **ステータス**: `⏸️ pending` (設計完了 / 予定作業)
- **作成日**: 2026-10-10
- **対象コード**: `src/core/knowledge/GKLPlugin.js` (および新設 `coordinators/`, `services/` 配下)
- **関連ドキュメント**: [ROADMAP.md](../ROADMAP.md), [SYSTEM_CAPABILITIES.md](../SYSTEM_CAPABILITIES.md), [gkl_documentation.md](./gkl_documentation.md)

---

## 1. 概要と背景

`src/core/knowledge/GKLPlugin.js` は、NetHack WASM WebUI においてゲーム知識層（Game Knowledge Layer: GKL）の統括エントリポイントとして機能し、WebUICore のイベント基盤と多数の状態マネージャー（Area/Inventory/Spell/Skill/Attribute/Condition/Discovery/Monster/Encumbrance）および各専門サービスを結ぶコアプラグインです。

しかし、機能の拡張（Direct Memory Binding、LORE伝承検知、冒険手帳連携、Visual FX演出、オンデマンドLook、Auto-Travelなど）に伴い、単一ファイル内に多数のロジックが集積した結果、**2,493 行 / 約 117 KB** に達し、典型的な「神クラス (God Class)」となっています。

### 現状の主要課題

1. **単一責任の原則 (SRP) の超過**:
   - 本来の責務である「各StateManager / サービスの初期化・DI配線とファサード窓口」に加え、
     - **WebUICore イベントの巨大な購読・振り分けルーター (`_bindCoreEvents`: 約 580 行)**
     - **バックグラウンド同期・Direct Memory Shim 連携調停 (`sync*Silent`: 約 380 行)**
     - **マップセル調査・自キャラ判定 (`inspectCellOnDemand`: 約 90 行)**
     - **A* 自動移動・シーケンス生成 (`travelTo`: 約 110 行)**
     - **戦闘・被ダメ・蘇生演出イベント制御 (`emitFxTrigger` / 状態フラグ群: 約 120 行)**
     が同一クラス・同一ファイルに混在しています。
2. **可読性と保守性の低下**:
   - イベント処理の追加や同期戦略の改修を行うたびに、2,500 行に及ぶ巨大ファイルを編集する必要があり、変更の影響範囲特定が困難かつマージコンフリクトを誘発しやすい構造になっています。
3. **単体テスト容易性 (Testability) の低下**:
   - サイレント同期の直列制御ロジックや自動移動の判定ロジックが GKLPlugin のプライベート実装に埋め込まれており、個別のユニットテストを独立して書くことが困難です。

---

## 2. ゴールと指標

| 指標 | 現状 | 目標値 |
| :--- | :---: | :---: |
| **`GKLPlugin.js` 行数** | **2,493 行** | **400 〜 500 行** (約80%削減) |
| **`GKLPlugin.js` の責務** | 5役以上混在 (Facade + Router + Sync + Nav + FX) | **純粋な Facade / Orchestrator（DI配線・委譲窓口）のみ** |
| **外部 API 互換性** | 現行シグネチャ | **100% 後方互換性維持 (Zero Breaking Change)** |
| **既存テスト通過率** | 135スイート / 1,656テスト PASS | **100% PASS 維持 (Zero Regression)** |

---

## 3. 現状のコード構造と分割ターゲット

| セクション | 行範囲 | 現状行数 | 移行先モジュール | 想定削減行数 |
| :--- | :---: | :---: | :--- | :---: |
| **コンストラクタ & DI配線** | L40 - L325 | 約 285 行 | `GKLPlugin.js` (初期化メソッドに整理して維持) | - |
| **言語設定・手帳・キャッシュクリア・ライフサイクル** | L326 - L690 | 約 365 行 | `GKLPlugin.js` (Facadeメソッドとして維持) | - |
| **Core Events 購読 & シグナルハンドラ** | L691 - L1400 | **約 710 行** | `coordinators/GKLEventRouter.js` | **約 650 行** |
| **シーケンス判定 & サイレント同期制御** | L1401 - L1750<br>L2075 - L2115 | **約 390 行** | `coordinators/SilentSyncCoordinator.js` | **約 380 行** |
| **状況要約・ゲッター・アドバイザー** | L1751 - L2010 | 約 260 行 | `GKLPlugin.js` (既存の委譲メソッドとして維持) | - |
| **アクション実行 & 演出ディスパッチ** | L2011 - L2074 | 約 65 行 | `coordinators/GKLFxCoordinator.js` / 整理 | 約 50 行 |
| **キーシーケンス・呪文・スキル実行** | L2136 - L2230 | 約 95 行 | `GKLPlugin.js` (コントローラ中継として維持) | - |
| **オンデマンドセル調査 & カメラ** | L2231 - L2320<br>L2431 - L2455 | **約 115 行** | `services/InspectionService.js` | **約 110 行** |
| **自動移動 (Auto-Travel)** | L2321 - L2430 | **約 110 行** | `services/AutoTravelService.js` | **約 110 行** |

---

## 4. アーキテクチャと新規モジュール構成

既存の `src/core/knowledge/` 階層に `coordinators/` を新設し、サービス群と協調するアーキテクチャを導入します。

```
src/core/knowledge/
├── GKLPlugin.js                      # 【スリム化】Facade / オーケストレーター (約 400〜500 行)
│
├── coordinators/                     # 【新設】イベント調停・非同期制御レイヤー
│   ├── GKLEventRouter.js             # Core イベントの購読・登録解除および各マネージャーへのディスパッチ
│   ├── SilentSyncCoordinator.js      # サイレント同期 (所持品/魔法/属性/スキル/発見物) の直列化・衝突防止・統計
│   └── GKLFxCoordinator.js           # 攻撃/被ダメ/回復/死亡/蘇生などの戦闘・状態演出 (FX) トリガーと状態管理
│
├── services/                         # ドメイン特化サービスレイヤー
│   ├── AutoTravelService.js          # 【新設】travelTo などのクリック移動・相対方向トークン列生成
│   ├── InspectionService.js          # 【新設】inspectCellOnDemand などのセル調査・自キャラ判定・オンデマンドLook連携
│   ├── OnDemandLookService.js        # (既存: Look ';' コマンド実行)
│   ├── OnDemandLookupService.js      # (既存: WASM 公式情報照会)
│   ├── WasmDirectBindingService.js   # (既存: C構造体メモリ直結)
│   ├── WishService.js / GenocideService.js / PolymorphService.js / WriteService.js
│
├── state/                            # (既存: 状態SSOTマネージャー群)
│   ├── AreaStateManager.js / InventoryStateManager.js / SpellStateManager.js / ...
├── engines/                          # (既存: 推論・アドバイスエンジン群)
│   ├── ContextActionEngine.js / TacticalAdvisor.js / AssistSignalSynthesizer.js / ...
├── lore/                             # (既存: 伝承・冒険手帳)
│   ├── LoreCodex.js / LoreDetector.js / AdventureLogManager.js
└── context/                          # (既存: 対話コンテキスト)
    └── InteractionContext.js
```

---

## 5. 新規モジュールの詳細仕様

### 5.1 `GKLEventRouter.js` (イベントルーティング)
- **役割**: `WebUICore` から送出される全イベント（`messageText`, `status_update`, `print_glyph`, `curs`, `clear_nhwindow`, `situationSignal`, `inputRequired` 等）を購読し、適切な StateManager や Service へ分配する。
- **インターフェース**:
  ```javascript
  export class GKLEventRouter {
      constructor(plugin) {
          this.plugin = plugin;
          this._listeners = [];
      }
      attach(core) { ... }
      detach() { ... }
      // 各個別イベントハンドラをプライベート/モジュールメソッドとして整理
      handleMessageText({ text }) { ... }
      handleStatusUpdate(data) { ... }
      handlePrintGlyph(data) { ... }
      handleInputRequired(payload) { ... }
      handleUserActionSent({ sequence }) { ... }
      handleOracleUnlock(loreSignal) { ... }
      handleEngraveSignal(loreSignal) { ... }
  }
  ```

### 5.2 `SilentSyncCoordinator.js` (サイレント同期調停)
- **役割**: バックグラウンドでのキー問い合わせ (`querySequenceSilent`) の排他・直列制御、Direct Binding モードに応じたバイパス処理、同期統計 (`silentSyncTracker`) の集計。
- **インターフェース**:
  ```javascript
  export class SilentSyncCoordinator {
      constructor(plugin, options = {}) {
          this.plugin = plugin;
          this.directBindingMode = options.directBindingMode || 'auto';
          this.tracker = { ... };
          this._isSyncing = false;
          this._isSyncingDiscoveries = false;
      }
      setDirectBindingMode(mode) { ... }
      hasPendingSync() { ... }
      async syncPendingStateSilent(options = {}) { ... }
      async syncInventorySilent(options = {}) { ... }
      async syncSpellsSilent(options = {}) { ... }
      async syncAttributesSilent(options = {}) { ... }
      async syncSkillsSilent(options = {}) { ... }
      async syncDiscoveriesSilent(options = {}) { ... }
      async syncAllSilent(options = {}) { ... }
      isTurnConsumingSequence(sequence) { ... }
      isNonItemSequence(sequence) { ... }
      isSpellAffectingSequence(sequence) { ... }
  }
  ```

### 5.3 `GKLFxCoordinator.js` (視覚演出トリガー管理)
- **役割**: 攻撃ヒット、被ダメージ、回復、プレイヤー死亡/蘇生、モンスター撃破のエフェクト発火（`emitFxTrigger`）と、関連する内部状態（`_isPlayerDead`, `_lastAttackTarget`, `_prevHp`, `_prevAc`, `_emittedFxList`）の管理。
- **インターフェース**:
  ```javascript
  export class GKLFxCoordinator {
      constructor(core) {
          this.core = core;
          this.isPlayerDead = false;
          this.lastAttackTarget = null;
          this.prevHp = null;
          this.prevAc = null;
          this.emittedFxList = [];
      }
      setCore(core) { ... }
      emitFxTrigger(payload) { ... }
      checkHpTransition(newHp, maxHp, playerX, playerY) { ... }
      checkAcTransition(newAc) { ... }
      onAttackAction(action, playerPos, targetPos) { ... }
      onMonsterKilled(killedInfo) { ... }
      reset() { ... }
  }
  ```

### 5.4 `AutoTravelService.js` & `InspectionService.js` (移動 & 調査)
- **AutoTravelService**:
  - `travelTo(targetPos, options)`: 隣接移動トークン判定、Auto-Travel シーケンス（`_` ➔ `@` ➔ `DIR_*` ➔ `.`）生成、モンスター安全判定。
- **InspectionService**:
  - `inspectCellOnDemand(targetPos, options)`: プレイヤー自身判定（リアルタイムステータスカード生成）、アイテム・地形判定、オンデマンドLook連携による最新モンスター動的状態の確定獲得。
  - `getFocusCameraTiles(radiusX, radiusY, options)`: ズームビュー用の整形済みタイル配列導出。

---

## 6. 後方互換性担保（Facade パターン）の設計

外部（`WebUICore`, UIコンポーネント, テストコード）からの呼び出しは、すべて `GKLPlugin` インスタンスを経由して行われています。  
そのため、`GKLPlugin` 側の既存パブリックメソッドはそのまま維持し、内部で新設モジュールに委譲（Delegate）します。

```javascript
export class GKLPlugin {
    // ...
    async syncInventorySilent(options = {}) {
        return await this.silentSyncCoordinator.syncInventorySilent(options);
    }

    async travelTo(targetPos, options = {}) {
        return await this.autoTravelService.travelTo(targetPos, options);
    }

    async inspectCellOnDemand(targetPos, options = {}) {
        return await this.inspectionService.inspectCellOnDemand(targetPos, options);
    }

    emitFxTrigger(payload) {
        return this.fxCoordinator.emitFxTrigger(payload);
    }
}
```

これにより、**呼び出し元の既存コードや全 135 スイートのテストコードに一切手を加えることなく、完全な互換性を担保**します。

---

## 7. 段階的マイグレーション計画 (Phase 1 〜 Phase 4)

リグレッション（動作破壊）を防ぐため、依存関係の少ない部分から順次分離を進めます。

### Phase 1: `SilentSyncCoordinator.js` の分離
1. `src/core/knowledge/coordinators/SilentSyncCoordinator.js` を新設。
2. `sync*Silent` 群、シーケンス判定関数群、`silentSyncTracker` ロジックを移設。
3. `GKLPlugin.js` から委譲するように接続し、`npm test` で全テストが通過することを確認。

### Phase 2: `AutoTravelService.js` & `InspectionService.js` の分離
1. `src/core/knowledge/services/AutoTravelService.js` および `InspectionService.js` を新設。
2. `travelTo`、`inspectCellOnDemand`、`getFocusCameraTiles` を移設。
3. `GKLPlugin.js` から委譲し、テスト通過を確認。

### Phase 3: `GKLFxCoordinator.js` & `GKLEventRouter.js` の分離
1. `src/core/knowledge/coordinators/GKLFxCoordinator.js` を新設（演出トリガーロジックを集約）。
2. `src/core/knowledge/coordinators/GKLEventRouter.js` を新設（`_bindCoreEvents`、`_handleOracleUnlock`、`_handleEngraveSignal` を移設）。
3. `GKLPlugin.attach()` / `detach()` をルーティングクラス経由に切り替え。

### Phase 4: 全体リグレッション検証 & クリーンアップ
1. `GKLPlugin.js` のコンストラクタおよびプライベートメソッドを整理（目標 400〜500 行達成を確認）。
2. 全テストスイート（135 ファイル / 1,656 テスト）、Direct Binding 検証、シナリオテストを完全実行し、オールグリーンを確認。
