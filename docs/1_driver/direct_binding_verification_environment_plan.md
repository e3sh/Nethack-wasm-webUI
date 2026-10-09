# inspector_console 連携型 公式Shim直接調停 ＆ フォールバック検証環境 設計・実装計画書

## 1. 目的と基本方針

### 1.1 目的
- 現在の Web Worker 隔離環境において、GKL（Gameplay Knowledge Layer）が**「公式Shim（Cコア直接調停）」**で動作しているのか、それとも**「従来のフォールバック機構（推測床 3992 番、キー送信マクロ等）」**で動作しているのかを、独立デバッグ画面 [`inspector_console.html`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/inspector/inspector_console.html) 上でリアルタイムに観測・検証可能にします。
- また、設定（config）や `inspector_console.html` から直接切り替えられる「隠しスイッチ（動作モード）」を導入し、**フォールバックを完全遮断した状態（厳格直接調停モード）での動作検証** を可能にします。
- これにより、フォールバックの偽陽性に騙されることなく、Stage 8.2 / 8.3 の残りの直結タスクを確実に進められる検証環境を確立します。

---

## 2. システム構成と設計仕様

```mermaid
flowchart LR
    subgraph GameWindow ["ゲーム実行画面 (Web Worker 実行環境)"]
        Core["WebUICore / GKLPlugin\n・AreaStateManager\n・InventoryStateManager"]
        DI["DebugInspector.js\n(BroadcastChannel 配信基盤)"]
        Core <--> DI
    end

    subgraph InspectorWindow ["DevTools Inspector (inspector_console.html)"]
        Header["ヘッダー動作状態ランプ\n🟢 SHIM / 🟡 INFERRED / 🔵 MACRO"]
        SyncInfo["SilentSync 詳細インジケーター\n(所持品同期: SHIM vs MACRO, 所要時間)"]
        FloorLamp["足元床ランプ\n(真の床 SHIM vs 仮床 INFERRED 3992)"]
        SwitchPanel["Direct Injector / 切替スイッチ\n[Auto] [Strict Shim] [Fallback Only]"]
    end

    DI <==|"BroadcastChannel ('webuicore_inspector_channel')"| InspectorWindow
```

---

## 3. 具体的な実装仕様

### 3.1 GKL 側の同期テレメトリ ＆ モード管理 (`GKLPlugin.js`, `AreaStateManager.js`, `InventoryStateManager.js`)

1. **動作モード (`directBindingMode`) の導入**:
   - `core.config` または `gkl.directBindingMode` として設定（デフォルト: `'auto'`）。
   - **`'auto'`**: 公式Shim直接調停を最優先で試行し、未対応時のみフォールバックへ退避（通常本番用）。
   - **`'strict'` (厳格直接調停モード)**: フォールバックを完全遮断。
     - `InventoryStateManager`: キー送信マクロ（`['i', ' ', '\x1b']`）の送出を完全拒絶。Shimからのみ取得。
     - `AreaStateManager`: 3992番などの推測仮床の自動生成を禁止。Shimからのみ真の床を取得。
   - **`'fallback'` (フォールバック強制モード)**: Shimをバイパスし、従来のマクロや推測床のみで動作（比較検証用）。

2. **SilentSync の実行結果テレメトリ**:
   - `silentSyncTracker` の履歴エントリに `method: 'SHIM_DIRECT' | 'MACRO'` を明記。
   - 例: `{ type: 'inventory', method: 'SHIM_DIRECT', changed: true, durationMs: 0 }`

3. **足元床・フロアの同期種別テレメトリ**:
   - `AreaStateManager.lastFloorSync`: `{ source: 'SHIM_DIRECT' | 'INFERRED_FALLBACK', glyph: number, typ: number, isGenuine: boolean }`
   - `AreaStateManager.inferredFloorCount`: 発生した仮床の累計カウント
   - `AreaStateManager.genuineFloorCount`: 公式Shimで確定した真の床の累計カウント

---

### 3.2 DebugInspector 経由の状態配信 ＆ 制御コマンド (`DebugInspector.js`)

1. **スナップショット拡張 (`INSPECTOR_STATE_SNAPSHOT`)**:
   - `directBindingStatus`:
     - `mode`: 現在の動作モード (`'auto'` | `'strict'` | `'fallback'`)
     - `inventoryLastSync`: 直近の所持品同期方式 (`'SHIM_DIRECT'` or `'MACRO'`) と件数・所要時間
     - `floorStatus`: 足元の状態 (`'SHIM_DIRECT'` or `'INFERRED_FALLBACK'`)、部屋名、typ
     - `stats`: `{ shimInvCount, macroInvCount, genuineFloorCount, inferredFloorCount }`
2. **受信コマンド (`INJECT_COMMAND` / `SET_CONFIG`)**:
   - `inspector_console.html` から `{ type: 'SET_DIRECT_BINDING_MODE', mode: 'strict' }` を受信し、リアルタイムに GKL の動作モードを変更。

---

### 3.3 `inspector_console.html` の UI 拡張

1. **ヘッダー・動作状態インジケーターバーへのランプ追加**:
   - **`Silent Sync:` インジケーター拡張**:
     - `Inv: 12 (🟢 SHIM 0ms)` または `Inv: 12 (🔵 MACRO 140ms)`
   - **`Floor Lamp:` ランプ新設**:
     - `[Floor: 🟢 SHIM (ROOM 寺院)]` （Cコア真の床取得時）
     - `[Floor: 🟡 INFERRED (3992)]` （推測仮床配置時）
2. **切替スイッチ（Direct Injector タブ または ヘッダー）**:
   - モード切替ラジオ/ボタン:
     - `[Auto (標準)]`
     - `[Strict (フォールバック完全遮断・Shimのみ)]`
     - `[Fallback Only (マクロ・推測床のみ)]`
   - クリック時に BroadcastChannel でコアへ即時送信し、反映。

---

## 4. 実装タスクリスト (Task List)

### 【Task 1】GKL / StateManager への動作モード ＆ 同期実績テレメトリの実装
- [ ] `WasmDirectBindingService.js` / `GKLPlugin.js` に `directBindingMode` (`'auto'` | `'strict'` | `'fallback'`) 設定・保持APIを実装
- [ ] `InventoryStateManager.js`:
  - 直近同期方式 (`lastSyncMethod: 'SHIM' | 'MACRO'`) を記録
  - `strict` モード時に `querySequenceSilent(['i'])` を完全ブロック
- [ ] `AreaStateManager.js`:
  - 直近足元同期方式 (`lastFloorMethod: 'SHIM' | 'INFERRED'`) および仮床/真床カウンタを記録
  - `strict` モード時に推測仮床（3992番）の生成を完全ブロック

### 【Task 2】DebugInspector への状態スナップショット拡張 ＆ モード切替コマンド対応
- [ ] `DebugInspector.js`:
  - `broadcastState()` に `directBindingStatus`（モード、所持品同期方式、床同期ランプ情報、統計カウンタ）を同梱
  - BroadcastChannel メッセージハンドラに `SET_DIRECT_BINDING_MODE` を追加

### 【Task 3】`inspector_console.html` へのランプ・インジケーター ＆ 切替スイッチUI追加
- [ ] ヘッダーに `Floor Lamp`（🟢 SHIM / 🟡 INFERRED）および `SilentSync` 方式表示を追加
- [ ] Direct Injector タブ（またはヘッダー）に `Direct Binding Mode` 切替ボタングループを配置
- [ ] BroadcastChannel での切替コマンド送信・リアルタイム反映処理を実装

### 【Task 4】自動テストによる切替 ＆ フォールバック遮断検証
- [ ] `strict` モード時にマクロが 0 回・推測床が 0 件で動作することを実証するテストを作成
- [ ] 全体テストスイート (`npm test`) の通過確認
