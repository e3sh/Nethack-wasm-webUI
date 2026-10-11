---
title: Wasm Direct Binding (CALL_SHIM) アイドリング調停・--More-- 待機・メッセージライフサイクル是正設計書
status: pending
last_updated: 2026-10-10
related_tasks:
  - ROADMAP 2.1 (GKL Pure JS Client モジュール分割)
  - ROADMAP 1.1 (Phase 8: Wasm Direct Binding)
---

# 🧭 Wasm Direct Binding アイドリング調停 ＆ --More-- 待機・メッセージライフサイクル是正設計書

## 1. 背景と課題の構造

Wasm Direct Binding（`CALL_SHIM` / Native Shim Dispatcher Bridge）の導入に伴い、C-Core メモリ直結による高速同期が実現した一方で、**「メッセージ発生時にフローティングメッセージ（--More-- / メッセージオーバーレイ）が待機せず流れてしまう・消えてしまう、またはアイドリング検出タイミングがずれる」** 現象が特定された。

調査により、以下の 4 つのレイヤーにわたる根本原因が特定されている：

| レイヤー | 対象ファイル | 根本原因 | 現象と影響 |
| :--- | :--- | :--- | :--- |
| **1. UI層** | `examples/gkl-pure-js-client/main.js`<br>`FloatingMessageHudController.js` | `statusUpdate` リスナー内でターン加算（`status.turns > lastTurns`）を受動的にトリガーとして `notifyUserAction()` を叩いていた。 | メッセージ出力直後のターン確定通知により、**プレイヤーが一切キー操作していないにもかかわらず、新着メッセージが即座に `STALE` に格下げされ 2.5 秒でフェードアウト消滅**。※暫定ホットフィックスとしてコメントアウト適用済み。 |
| **2. Core層** | `src/core/WebUICore.js` | `isTopLevelTurn` 判定において、未読メッセージ待機（`--More--`）やモーダルプロンプト表示中のガードが不十分。 | メッセージ出力直後の同一フレームで `poskey` 到達時に無条件で Direct Binding 同期（`CALL_SHIM`）が走ってしまう。 |
| **3. Driver層** | `src/driver/NetHackWasmDriver.js`<br>`NetHackWasmWorkerBridge.js` | `shim_display_nhwindow`（windowId: 1, blocking: true）待機時に `isTextWindowOpen` 等のフラグが立たず、`canAcceptSequenceInterruption()` が通常の通常ターン（`poskey`）と区別できない。また `suppressPrompts` 下で `safeResolver(0)` により自動解決（スキップ）される。 | `--More--` 待機状態がドライバーおよびブリッジのアイドリング判定に反映されず、シーケンスや同期処理が割り込んでメッセージが流れてしまう。 |
| **4. Direct Binding層** | `WasmDirectBindingService.js` | `syncFromWorkerBridge` による 6 回の連続 Worker 往復中にブラウザ側でユーザー入力（`RESPOND_INPUT`）が混ざる。 | 前ターンの Direct Binding 応答が遅延到着し、前ターンの `inventoryStateUpdated` が UI 再描画を発火させて画面が揺れる。 |

> [!NOTE]
> **ROADMAP 2.1（完了済み）および ROADMAP 2.2 との連携順序について**  
> 前提条件であった **ROADMAP 2.1（GKL Pure JS Client `main.js` のモジュール分割：2,364行 ➔ 618行、8コントローラー分離）は 2026-10-10 に完了**しました。  
> 残る Core/Driver/Direct Binding 層のアイドリング調停および Sync Barrier は、**ROADMAP 2.2（`GKLPlugin.js` モジュール分割：`GKLEventRouter` / `SilentSyncCoordinator` 抽出）および Stage 8.3-B（確定同期レンダリング・パイプライン）** と統合してクリーンに実装を進めます。

---

## 2. 是正設計方針

### 基本原則
1. **公式Cコア完全非侵襲の維持**: `winshim.c` 等の公式コードには手を加えない。
2. **ゼロマクロ Direct Binding の維持**: キー送信マクロへの後退は禁止。直接メモリ・Shim バインディングを維持する。
3. **メッセージ未入力待機状態の完全保証**: プレイヤーが能動的にキーを入力するまで、メッセージが勝手に消えたり流れたりしない状態を保証する。
4. **全テストスイートの PASS 維持**: 既存の 135 テストファイル / 1,662 テストの 100% PASS を維持する。

---

## 3. 各レイヤーの詳細設計

### 3.1 UI層: フローティングメッセージ消去ライフサイクルの健全化
- **対象**: `examples/gkl-pure-js-client/main.js`（ROADMAP 2.1 分割後の `EventOrchestrator`）および `FloatingMessageHudController.js`
- **設計内容**:
  1. **受動的ターン更新の排除**: `statusUpdate` での `notifyUserAction()` は呼び出さない（ホットフィックスを恒久化）。
  2. **能動的プレイヤー操作の厳格化**:
     - キーボード入力（修飾キー単体を除く）
     - DirectionPad のタップ入力
     - GklFloatingActions のコンテキストアクション実行
     - マウスクリック移動（`travelTo` 実行）
  3. **短時間同一フレーム保護 (Frame Guard)**:
     - `FloatingMessageHudController` において、行が追加された直後（例: 100ms以内）に誤って `notifyUserAction()` が走った場合でも、最新の `ACTIVE` 行を降格させないタイムスタンプガードを導入。

### 3.2 Core層: `WebUICore.js` の `isTopLevelTurn` ガードと同期調停の強化
- **対象**: `src/core/WebUICore.js`
- **設計内容**:
  1. **`isTopLevelTurn` ガードの精緻化**:
     - ドライバー/ブリッジから渡される `payload.isTopLevelTurn` を尊重。
     - 以下の待機状態を明示的に除外：
       - `--More--` プロンプト待機中（`this.isMorePromptActive` または `payload.isMorePrompt`）
       - テキストウィンドウ・モーダル表示中（`this.textWindowManager?.hasOpenModal`、`this.isTextWindowOpen`）
       - アクティブなプロンプト選択肢が存在する場合（`this.currentPromptChoices`）
  2. **`display_nhwindow`（WIN_MESSAGE, blocking）待機時の resolver 生存期間整合**:
     - `windowId === 1 && blocking`（--More--）受信時、`this.isMorePromptActive = true` を設定。
     - 自動解決（スキップ）を防止し、ユーザーまたはシーケンスの明示的入力待機とする。
     - 入力解決（`inputResolved`）時に `this.isMorePromptActive = false` へ復帰。

### 3.3 Driver層: `--More--` 待機状態のアイドリング判定明示化
- **対象**: `src/driver/NetHackWasmDriver.js` & `src/driver/NetHackWasmWorkerBridge.js` & `src/driver/nethack.worker.js`
- **設計内容**:
  1. **`isMorePromptActive` フラグの新設**:
     - `shim_display_nhwindow` において `windowId === 1 && blocking` の場合に `this.isMorePromptActive = true`、`this.isTopLevelTurn = false` を設定。
     - `await promise;` 完了後に `this.isMorePromptActive = false` へ復帰。
  2. **`canAcceptSequenceInterruption()` のガード強化**:
     - `isMorePromptActive` が `true` の間は `canAcceptSequenceInterruption()` が必ず `false` を返すようにする。
  3. **Bridge 連携**:
     - Worker 経由時も `cleanData.isMorePromptActive` を送信し、Bridge 側でも同期。

### 3.4 Direct Binding層: 複数回往復（6回）の排他制御・世代整合性
- **対象**: `src/core/knowledge/services/WasmDirectBindingService.js`
- **設計内容**:
  1. **同期バリア (Sync Barrier / Mutex)**:
     - `syncFromWorkerBridge` の実行中は同期フラグ `_isSyncing = true` を保持。
     - 同期完了前にユーザー入力（`RESPOND_INPUT`）が発行された場合、直近のターン番号（`turnId`）をインクリメントし、遅延到着した古いレスポンスによる `inventoryStateUpdated` の発火をキャンセル（破棄）する。

---

## 4. 実施ステップとスケジュール（ROADMAP 2.1 完了後）

- [ ] **Step 1: Driver層 & Core層の `--More--` 待機状態明示化**
  - `NetHackWasmDriver.js` に `isMorePromptActive` を配備
  - `WebUICore.js` の `isTopLevelTurn` ガードを強化
- [ ] **Step 2: Direct Binding 同期の排他・世代管理**
  - `WasmDirectBindingService.js` に世代ID照合と遅延描画破棄ガードを追加
- [ ] **Step 3: UI層ライフサイクルの統合 (ROADMAP 2.1 新アーキテクチャ上)**
  - ROADMAP 2.1 で新設されるイベントオーケストレーターに健全化されたメッセージ通知を配備
- [ ] **Step 4: 単体・結合・実機シナリオテスト**
  - ターン経過時のメッセージ不変テスト
  - `--More--` 待機時のアイドリング・Direct Binding 抑止テスト
  - 全135スイートの PASS 確認
