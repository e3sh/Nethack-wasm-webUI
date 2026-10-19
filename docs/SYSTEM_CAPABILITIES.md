---
title: NetHack WASM WebUI システム現有能力カタログ
status: implemented
last_updated: 2026-10-19
---

# 🧭 NetHack WASM WebUI システム現有能力カタログ (SYSTEM_CAPABILITIES.md)
### ―― システム全機能・API・データ資産インベントリ ＆ 責務境界・統廃合・ギャップ分析 ――

> [!IMPORTANT]
> **設計・機能提案・リファクタリング時の最重要必読インベントリ**  
> 本ドキュメントは、NetHack WASM WebUI プロジェクトにおける **「現在システムができること・持っている能力・API・データ資産」** を網羅的に集約した公式カタログです。  
> 新機能の提案やリファクタリングを検討する際は、必ず本カタログを参照し、**「既存機能の考慮漏れ」「車輪の再発明（静的二重持ち等）」** を防止してください。

---

## 📑 目次

1. [① コア通信・同期パイプライン (Communication & Sync Capabilities)](#①-コア通信同期パイプライン-communication--sync-capabilities)
2. [② ゲーム状態追跡・解析エンジン (State & Analysis Engines)](#②-ゲーム状態追跡解析エンジン-state--analysis-engines)
   - [2.1 識別の5段階管理 (ItemIdentificationResolver)](#21-識別の5段階管理-itemidentificationresolver)
   - [2.2 適応型スペック生成 (ItemSpecPresenter / MonsterSpecPresenter)](#22-適応型スペック生成-itemspecpresenter--monsterspecpresenter)
   - [2.3 遠隔・足元オンデマンド調査 ＆ 文学引用動的抽出 (OnDemandLookService / OnDemandLookupService)](#23-遠隔足元オンデマンド調査--文学引用動的抽出-ondemandlookservice--ondemandlookupservice)
   - [2.4 装備依存解析 (EquipmentActionPlanner / EquipmentRules)](#24-装備依存解析-equipmentactionplanner--equipmentrules)
   - [2.5 空間状態総合オーケストレーション ＆ 探索知識台帳 (AreaStateManager)](#25-空間状態総合オーケストレーション--探索知識台帳-areastatemanager)
   - [2.6 事後ナレッジ解析 ＆ 冒険手帳メタ進行 (PostMortemKnowledgeResolver / AdventureLogManager)](#26-事後ナレッジ解析--冒険手帳メタ進行-postmortemknowledgeresolver--adventurelogmanager)
   - [2.7 ゲームライフサイクル状態マシン (GameLifecycleManager)](#27-ゲームライフサイクル状態マシン-gamelifecyclemanager)
3. [③ データ・伝承資産 (Data & Lore Assets)](#③-データ伝承資産-data--lore-assets)
4. [④ UI制御・操作調停・盤面描画 (UIController & Web Components & Renderers)](#④-ui制御操作調停盤面描画-uicontroller--web-components--renderers)
   - [4.1 キー・ゲームパッド入力調停 (InputCoordinator / GamepadInputController / ModalStackController)](#41-キーゲームパッド入力調停-inputcoordinator--gamepadinputcontroller--modalstackcontroller)
   - [4.2 共通 Web Components (<nh-*>)](#42-共通-web-components-nh-)
   - [4.3 コンテキスト連動型岩盤可視化 ＆ 掘削アシスト・マップ上コマンド数バッジ (Renderers & Overlays)](#43-コンテキスト連動型岩盤可視化--掘削アシストマップ上コマンド数バッジ-renderers--overlays)
5. [⑤ アーキテクチャの基本憲法（設計判断ルール）](#⑤-アーキテクチャの基本憲法設計判断ルール)
6. [⑥ 機能重複およびレガシー文字列パースの統廃合・退役候補 (Consolidation & Retirement Candidates)](#⑥-機能重複およびレガシー文字列パースの統廃合退役候補-consolidation--retirement-candidates)
7. [⑦ ギャップ分析と解消状況 (Capability Gaps & Resolution Status)](#⑦-ギャップ分析と解消状況-capability-gaps--resolution-status)

---

## ① コア通信・同期パイプライン (Communication & Sync Capabilities)

ブラウザ環境で NetHack C コア (WASM) を安全・高速・非同期に駆動し、画面描画を乱さずに内部データを抽出・同期する中核インフラストラクチャです。Phase 8（全ステージ 8.1〜8.5 完遂）により **「Cメモリ構造体直結 (`CALL_SHIM` / `_shim_bridge_call`)」** と **「サイレント・キーシーケンス (`querySequenceSilent`)」** のハイブリッド二刀流パイプラインを保有しています。

```mermaid
flowchart TD
    subgraph BrowserUI ["フロントエンド / GKL 層"]
        UI["UI / Web Components (<nh-*>)"]
        DBS["WasmDirectBindingService (薄型ファサード)"]
        Adapters["WasmAdapters\n(Inventory / Player / Spatial / Monster / Discovery)"]
        SyncCoord["WasmSyncCoordinator (同期調停)"]
        IRC["InteractiveRequestController (WebUICore)"]
    end

    subgraph DriverLayer ["WASM ドライバ層 (Web Worker / NetHackMemory)"]
        Bridge["NetHackWasmWorkerBridge / NetHackWasmDriver"]
        TaskQueue["TaskQueue / Sequence Buffer"]
    end

    subgraph CCore ["NetHack 5.0.1 C コア (Emscripten)"]
        ShimBridge["shim_bridge.c (_shim_bridge_call)"]
        WASM["NetHack 5.0.1 WASM Binary"]
    end

    UI -->|状態同期・盤面照会| DBS
    DBS --> Adapters
    DBS --> SyncCoord
    SyncCoord -->|"callShim(SHIM_CMD_*, arg0, arg1)"| Bridge
    Bridge -->|0.1ms未満 ゼロ副作用直結| ShimBridge
    ShimBridge <-->|C 構造体読取 (levl/fmon/invent/u)| WASM

    UI -->|マルチステップ操作・フォールバック| IRC
    IRC -->|"querySequenceSilent(['i', ' ', '\x1b'], { suppressPrompts: true, isSilentSync: true })"| Bridge
    Bridge -->|仮想キーストローク注入| TaskQueue
    TaskQueue -->|Asyncify 再開| WASM
```

### 1.0 Phase 8: 単一窓口 C メモリ直結 (`_shim_bridge_call` / `WasmDirectBindingService`)

* **主要クラス / 関数**:
  - `src/driver/shim/shim_bridge.c` (`_shim_bridge_call`)
  - `src/driver/NetHackMemory.js` (`bridgeCall`, `SHIM_CMD`, `SHIM_SYM`)
  - `src/driver/NetHackWasmWorkerBridge.js` (`callShim`)
  - `src/core/knowledge/services/WasmDirectBindingService.js` (6分割・薄型ファサード)
  - `src/core/knowledge/adapters/` (`InventoryWasmAdapter`, `PlayerWasmAdapter`, `SpatialWasmAdapter`, `MonsterWasmAdapter`, `DiscoveryWasmAdapter`)
  - `src/core/knowledge/coordinators/WasmSyncCoordinator.js`
* **できること**:
  - 公式 NetHack C ソースを 1 行も改変せず、単一の外付けブリッジ (`shim_bridge.c`) 経由で C メモリ構造体（`levl[x][y]`, `fmon`, `fobj`, `invent`, `u` 等）を **0.1ms 未満・キー注入副作用ゼロ** で直接読み出し。
  - **主要コマンド実績**:
    1. **フロア全域地形・階段一括ダンプ (`SHIM_CMD_DUMP_LEVEL_TERRAIN` / 0x15)**: 80×21 全マスの真の地形 (`typ`)・扉状態 (`flags`)・階段接続を 1 往復で取得。
    2. **セル詳細＆床アイテム走査 (`SHIM_CMD_GET_CELL_INFO` / `GET_OBJECT_AT`)**: 足元や任意座標の地形・罠・部屋種別・床アイテムの BUC (`blessed`/`cursed`/`bknown`)・箱の施錠状態・死体/像のモンスター種別 (`corpsenm`)・既知フラグ (`known`) を直接取得。
    3. **インベントリ＆装備＆総重量直結 (`SHIM_CMD_DUMP_ALL_INVENT` / `GET_EQUIPMENT_PTRS` / `GET_INV_WEIGHT`)**: 全所持品構造体・14装備スロットポインタ・真の総重量 (`inv_weight()`) を一括取得。
    4. **モンスター＆プレイヤー状態直結 (`SHIM_CMD_GET_MONSTER_AT` / `GET_PLAYER_SUMMARY` / `GET_PLAYER_PROPS`)**: 平和NPC (`mpeaceful`)・ペット (`mtame`) 判定、ダンジョン番号 (`dnum`) による全9ブランチ 100% 確定同定、お祈りタイマー (`ublesscnt`)・神の怒り (`ugangr`) 直結、耐性配列 (`uprops` 69要素) 内因・外因分離直結。
    5. **確定同期待ちによる不可分起動 (Stage 8.5)**: `completeStartup` の完全 async 化と Promise 調停により、セーブ再開時のインベントリ空化や初期描画チラつきを完全根絶。
  - **3モード検証切替 (`DIRECT_BINDING_MODE`)**: `auto`（直結優先＋自動フォールバック）、`strict`（フォールバック遮断・直結強制検証）、`fallback`（旧マクロ強制）を実行時切替可能。

### 1.1 サイレント・キーシーケンス実行 (`querySequenceSilent` / `queueSequence`)

* **主要クラス / 関数**:
  - `InteractiveRequestController.querySequenceSilent(sequenceOrRecipe, options)`
  - `NetHackWasmDriver.queueSequence(tokens, options)` / `canAcceptSequenceInterruption()`
  - `WebUICore.querySequenceSilent(sequenceOrRecipe, options)`
  - `GKLPlugin.syncInventorySilent()` / `syncSpellsSilent()` / `syncAttributesSilent()` / `syncSkillsSilent()` / `syncDiscoveriesSilent()`
* **できること**:
  - `suppressPrompts: true, isSilentSync: true` オプションにより、**画面のちらつきゼロ（UI描画イベントの外部発火なし）** で、C コアに仮想キーストローク列を自走注入し、生成されたテキスト出力バッファを Promise で一括キャプチャ。
  - `--More--` ページ送り中（`isTopLevelTurn === false`）やターゲットモード中は自動待機し、真のトップレベル・ターン待機に復帰した瞬間に安全消化。
* **主要活用実績・ユースケース**:
  1. **マルチステップ自動操作**: コンテナ出し入れトランザクション (`ContainerController.executeTransaction`)、ペーパードール多段着脱 (`EquipmentActionPlanner`)。
  2. **オンデマンド辞書・文学引用クエリ (`OnDemandLookupService`)**: `/` コマンドによる C コア内包 `data.base` 文学引用の動的取得。
  3. **Direct Binding 非対応環境・未直結ドメインのセーフティネット**: 魔法一覧 (`+`)、スキル一覧 (`#enhance`)、および `fallback` モード時の所持品・属性・発見リスト同期。

### 1.2 メッセージ抑止制御 (`suppressMessage` / `suppressedEvents`)

* **主要クラス / 関数**:
  - `NetHackWasmDriver.prototype.emit(event, payload)`（抑止フィルター）
  - `WebUICore.js` / `NetHackWasmDriver.js`
* **できること**:
  - `isSilentSync: true` またはモーダル操作中の一時的メッセージブロック機構。
  - C コアから送出される `putmsg`, `putstr`, `raw_print`, `raw_print_bold`, `putmixed`, `inputRequired`, `display_nhwindow`, `clear_nhwindow` などのイベント通知を一時的にインターセプト・破棄。
* **活用ユースケース**:
  - モーダル（アイテム選択、コンテナ出し入れ、ペーパードール自動換装等）実行中に、C コアが出力する「What do you want to take off?」や「You cannot wear...」といった中間プロンプトが画面上のフローティングHUDやログドロワーに漏れるのを完全に遮断。

### 1.3 2段構えシグナル基盤 (Two-Tier Signal Architecture)

客観的なゲーム事実の抽出と、それに基づく主観的戦術判断を疎結合に分離する2段パイプラインです。

```mermaid
flowchart LR
    subgraph Tier1 ["第1層: WebUICore (客観事実の同定)"]
        Msg[生メッセージ / LORE] --> MCD[MessageContextResolver]
        MCD --> SD[SignalDetector]
        SD -->|situationSignal\n{ type, context }| CoreEmit[core.emit('situationSignal')]
    end

    subgraph Tier2 ["第2層: GKL (主観的判断・キャッシュ化)"]
        CoreEmit --> GKL[GKLPlugin / InteractionContext]
        GKL --> SC[SituationCache]
        SC --> TA[TacticalAdvisor]
        SC --> AS[AssistSignalSynthesizer]
        TA -->|戦術バッジ / 警告| View[クライアントUI / HUD]
        AS -->|アシストスタンス / ContextActions| View
    end
```

* **主要クラス / 関数**:
  - **第1層 (WebUICore)**: `MessageContextResolver`, `SignalDetector`, `ContextFrameBuffer`, `core.emit('situationSignal')`
  - **第2層 (GKL)**: `GKLPlugin`, `InteractionContext`, `SituationCache`, `TacticalAdvisor`, `AssistSignalSynthesizer`
* **できること**:
  - **第1層**: C コアのメッセージ文字列やプロンプトから、「戦闘発生」「空腹警告」「呪詛検知」「床彫り発見」「伝承検知」などの客観的事実を正規化シグナルとして同定。
  - **第2層**: 第1層のシグナルをトリガーに `SituationCache` を自動更新。プレイヤーの現在のステータス・装備・周辺マップ・所持品と複合照合し、推奨アクション（ContextActions）や危険警告（Tactical Advice）を即座に導出。

---

## ② ゲーム状態追跡・解析エンジン (State & Analysis Engines)

WASM 単体では得られない高次のゲーム状態をリアルタイムに追跡・推論・整形する頭脳部です。

### 2.1 識別の5段階管理 (`ItemIdentificationResolver`)

* **主要クラス / 関数**:
  - `src/core/knowledge/engines/ItemIdentificationResolver.js`
  - `IDENTIFICATION_LEVELS`: `UNIDENTIFIED` (Lv.0), `BUC_KNOWN` (Lv.1), `NAMED` (Lv.2), `TYPE_IDENTIFIED` (Lv.3), `FULLY_IDENTIFIED` (Lv.4)
  - `resolveIdentificationState(itemOrStr, discoveryState)`
  - `APPEARANCE_PATTERNS`, `IDENTIFICATION_TIPS`
* **できること**:
  - インベントリ構造体（Phase 8 Direct Binding）やインベントリ行・Look メッセージ文字列から、現在の識別深度を5段階で高精度に同定。
  - ランダム化された外見名（薬の色 26種、指輪の素材 26種、魔法書の装丁 31種、杖の素材 27種、アミュレットの形状 11種、防具の一般名 32種、灰色の石等）を完全照合。
  - **ネタバレ防止マスク**: 未識別アイテムに対しては真の効能を隠蔽し、安全な外見スペックおよびカテゴリ別の鑑定ヒント（床彫り、流し台、価格鑑定等）を自動提示。

### 2.2 適応型スペック生成 (`ItemSpecPresenter` / `MonsterSpecPresenter`)

* **主要クラス / 関数**:
  - `src/core/knowledge/presenters/ItemSpecPresenter.js` (`getAdaptiveItemSpecs`)
  - `src/core/knowledge/presenters/MonsterSpecPresenter.js` (`getAdaptiveMonsterSpecs`)
  - `src/core/knowledge/presenters/EncumbrancePresenter.js`
* **できること**:
  - カテゴリ（武器、防具、指輪、巻物等）ごとに最適なスペックバッジ（重量、材質、AC、攻撃力ダイス、効果）を抽出。
  - **床落ちアイテム Direct Binding 個体スペック動的反映 (Peek Wisdom / Stage 8.5)**: 足元や床に落ちているアイテムの C 構造体 (`directObject`) から、スタック数量 (`quan`)、強化値 (`spe`)、残チャージ (`charges`)、対象生物種別 (`corpsenm`)、BUC (`bucStatus`) を動的にバッジ化。
  - **ASCII 英語純化**: `rawText` からの和名逆流を根絶し、ASCII 英語メタデータのみで決定論的にスペックを導出。
  - `SkillStateManager` と動的に突合し、**プレイヤーのスキル熟練度に応じた適性バッジ（得意武器マーク、向上可能マーク `+`）をリアルタイム付与**。
  - モンスターの危険度レベル、移動速度、耐性一覧、特殊攻撃リスク、死体摂食効果（耐性獲得率等）を適応型バッジとして生成。

### 2.3 遠隔・足元オンデマンド調査 ＆ 文学引用動的抽出 (`OnDemandLookService` / `OnDemandLookupService`)

* **主要クラス / 関数**:
  - `src/core/knowledge/services/OnDemandLookService.js` (`executeLook`, `buildLookSequence`, `parseLookResponse`)
  - `src/core/knowledge/services/OnDemandLookupService.js` (`lookupEntity`, `parseLookupOutput`)
  - `src/core/knowledge/lore/ElberethAnalyzer.js` (`analyze`, `WARD_STATUS`, `DEGRADED_CHAR_MAP`)
  - `src/core/knowledge/lore/EngravingArchaeologist.js`
* **できること**:
  - マップ座標（x, y）指定による Far look（`;`）および `/` コマンドによる C コア内包 `data.base` 公式文学引用のオンデマンド動的抽出（LRU メモリキャッシュ付き）。
  - 個体の動的状態（ペット `mtame`、友好 `mpeaceful`、敵対、自分自身）のリアルタイム判定。
  - **床文字・Elbereth 劣化判定**: 床に刻まれた文字列から残存率（0.0〜1.0）と文字消えを解析し、聖なる結界としての有効性（`ACTIVE`, `DEGRADED`, `NONE`）を判定。

### 2.4 装備依存解析 (`EquipmentActionPlanner` / `EquipmentRules`)

* **主要クラス / 関数**:
  - `src/core/knowledge/equipment/EquipmentActionPlanner.js` (`plan`)
  - `src/core/knowledge/equipment/EquipmentDependencyAnalyzer.js` (`analyzeDependency`)
  - `src/core/knowledge/equipment/EquipmentRules.js` (`EQUIP_SLOTS`, `estimateActionTurns`)
* **できること**:
  - NetHack 5.0 C コア（`do_wear.c`）の厳密な防具・装身具着脱ルールに基づき、多段換装シミュレーションを実行。
  - 呪詛（Cursed）による脱衣ブロッカー検知、手袋なしでのコカトリス死体接触などの致命的事故を事前遮断。
  - **ASCII純化**: モデル層から日本語正規表現を全廃し、確定メタデータと純粋な英語判定で完結。

### 2.5 空間状態総合オーケストレーション ＆ 探索知識台帳 (`AreaStateManager`)

* **主要クラス / 関数**:
  - `src/core/knowledge/state/AreaStateManager.js` (4分割オーケストレーター)
  - `src/core/knowledge/state/area/` (`TerrainInferenceEngine`, `DungeonLandmarkRegistry`, `ViewportTileProjector`)
  - 詳細仕様書: [AreaStateManager_Architecture_and_Specification.ja.md](./3_gkl/AreaStateManager_Architecture_and_Specification.ja.md)
  - `updateGlyph(x, y, glyphId, glyphInfo, bkglyphInfo)`
  - `syncPlayerFeetFloor(x, y)` / `dumpLevelTerrain()`
  - `seedInitialStair(x, y)` / `applyStairCacheForFloor(floorKey)`
  - `extractLandmarkEntity(x, y, glyphId)` / `getFloorLandmarks(floorKey)`
  - `getAreaState(cx, cy, radius)` / `getFocusCameraTiles(radiusX, radiusY, options)`
* **できること**:
  - **4層空間モデル＆差分追跡**: 単一グリフから `bottom`（地形）、`middle`（アイテム/岩）、`top`（生物/墓石）、`effect`（演出）を復元管理し、描画差分（`dirtyCells`）のみをレンダラーへ高速供給。
  - **観測済み岩盤 (`isObservedStone`) の識別保持**: 受信グリフが `0` または `3929` の場合、空白文字（`' '`）であっても完全未踏領域（`glyph >= 9622`）と明確に区別し、Direct Binding の真の地形（`typ: 0`）とともに `isObservedStone: true` を保持（スマート岩盤可視化の基盤）。
  - **Phase 8 メモリ直結同期**: `dumpLevelTerrain()` による 80×21 フロア全域の真の地形・階段一括確定、および `syncPlayerFeetFloor()` による足元の真の床・罠・床アイテムBUCのゼロ遅延確定（未踏領域ネタバレ防止ガード付き）。
  - **ランドマーク台帳**: 階段・祭壇・泉・玉座・シンク・店舗（店主同定）を自動抽出・永続化（`landmarkCache`）。

### 2.6 事後ナレッジ解析 ＆ 冒険手帳メタ進行 (`PostMortemKnowledgeResolver` / `AdventureLogManager`)

* **主要クラス / 関数**:
  - `src/core/knowledge/services/PostMortemKnowledgeResolver.js`
  - `src/core/knowledge/lore/AdventureLogManager.js`
* **できること**:
  - NetHack 5.0 `formatkiller()` の複合死因文字列（Prefix/Core/Suffix）を3段階で分解し、真の脅威エンティティと根本原因対策アドバイス（RCA）を自動導出。
  - セッションを跨いで遭遇モンスター・発見アイテム・噂・神託・墓碑銘の解禁率（知のメタ進行）を集計・永続化。

### 2.7 ゲームライフサイクル状態マシン (`GameLifecycleManager`)

* **主要クラス / 関数**:
  - `src/core/lifecycle/GameLifecycleState.js` (`GAME_LIFECYCLE_STATE`, `GameLifecycleManager`)
* **できること**:
  - `NOT_STARTED` ➔ `INITIALIZING` ➔ `STARTUP_FLOW` ➔ `IN_GAME` ➔ `GAME_OVER` ➔ `RESETTING` の単一ステートマシンによるライフサイクル遷移管理（SSOT）。
  - 散在していた旧フラグ（`isFirstTurnSyncing`, `isStartingUp` 等）を一元化し、状態遷移リスナーと不正遷移ガードを提供。

---

## ③ データ・伝承資産 (Data & Lore Assets)

NetHack 50年の歴史と公式リソースを完全網羅した構造化データ資産です。

| アセット分類 | 主要ファイル / 配置 | レコード数 / 規模 | 特徴と活用機能 |
| :--- | :--- | :--- | :--- |
| **Cコア公式文学引用** | `dat/data.base` (WASM内包)<br>`OnDemandLookupService.js` | 4,000+ 引用項目 | WASM 内にコンパイル同梱。シェイクスピア、クトゥルフ神話、指輪物語などの公式文学引用を動的クエリし、`dictionary.csv` で日本語対訳表示。 |
| **伝承マスター** | `src/core/knowledge/lore/data/LoreMasterData.js` | 噂 787件<br>神託 20件<br>墓碑銘 48件 | 真偽判定（`isTrue`）完備。噂 366件・神託 19件がアイテム番号（`onum`）・モンスターと完全事前紐付け済み。 |
| **構造化モンスター辞書** | `src/core/knowledge/data/MONSTER_KNOWLEDGE_FULL.js`<br>`MONSTER_OFFICIAL_ATTACKS.js` | 全 384 体<br>(3,767行攻撃定義) | 日英完全対訳、耐性、公式最大6枠攻撃ダイス（`AT_*` / `AD_*`）、速度、死体効果、危険度ランク。静的整合性監査済み。 |
| **構造化アイテム辞書** | `src/core/knowledge/data/OBJECT_KNOWLEDGE_FULL.js` | 全 481 アイテム<br>(onum 0〜480) | 日英完全対訳、防護耐性（`protectsAgainst`）、材質、基本価格、重量、効果。静的整合性監査済み。 |
| **ビジュアルタイルシート** | `pict/nethack_default_32.png`<br>`pict/nethack_default_32_tr.png` | 32×32px タイル<br>(2,307タイル) | NetHack 5.0.1 公式グラフィックスタイル。全グリフ対応。`GlyphHelper.js` による CSS スプライト座標切り出し。 |
| **制御シグナル辞書** | `src/core/prompt/ControlSignalCatalog.js` | 全 115 制御パターン | プロンプト・待機状態の同定と自動応答キー定義。 |

---

## ④ UI制御・操作調停 (UIController & Web Components)

DOM 非依存の Headless UI 層と、モダンなダークガラス Web Components による最高峰のフロントエンド基盤です。

```mermaid
flowchart TD
    subgraph UIControllerLayer ["@nethack-webui/ui-controller (DOM非依存 Headless)"]
        IC[InputCoordinator]
        MSC[ModalStackController]
        UICS[UIConfigStore]
        FMHC[FloatingMessageHudController]
        PDP[PaperdollPresenter]
        CDC[ContainerDraftController]
        GIC[GamepadInputController]
    end

    subgraph WebComponents ["@nethack-webui/components (Shadow DOM / Custom Elements)"]
        NhModal["<nh-modal>"]
        NhHud["<nh-floating-hud>"]
        NhDoll["<nh-paperdoll>"]
        NhFiler["<nh-container-filer>"]
        NhConfig["<nh-ui-config>"]
        NhCard["<nh-knowledge-card>"]
        NhCodex["<nh-discovery-codex> / <nh-codex-grid>"]
        NhPad["<nh-radial-palette-hud> / <nh-shiren-inventory-drawer>"]
    end

    IC -->|ESC閉塞・Z-Index| MSC
    MSC --> NhModal
    FMHC --> NhHud
    PDP --> NhDoll
    CDC --> NhFiler
    UICS --> NhConfig
    GIC --> NhPad
```

### 4.1 キー・ゲームパッド入力調停 (`InputCoordinator` / `GamepadInputController` / `ModalStackController`)

* **主要クラス / 関数**:
  - `src/ui-controller/InputCoordinator.js` (`evaluateKeyDown`, `ROUTE_ACTIONS`)
  - `src/ui-controller/GamepadInputController.js` / `RadialInputRecognizer.js`
  - `src/ui-controller/ModalStackController.js` (`push`, `pop`, `getTopModal`, `hasModals`)
* **できること**:
  - 多重モーダル表示時のスタック管理と Z-Index 自動解決。
  - `ESC` キー押下時に「最前面のモーダル1枚だけを閉じる」安全な閉塞制御。
  - テキスト入力中（`INPUT` / `TEXTAREA`）の NetHack ゲームキー誤爆防止。
  - **Vanilla / Enhanced の操作直交性**: 純粋なゲーム操作キー（`PASSTHROUGH_GAME_KEY`）と UI ショートカット（Alt+S, Ctrl+P 等）を厳密に調停。

### 4.2 共通 Web Components (`<nh-*>`)

* **主要コンポーネント (`src/components/`)**:
  - `<nh-modal>`: FocusTrap、ESC 閉塞、多重スタック対応の共通モーダル枠。
  - `<nh-floating-hud>`: 全画面ダンジョンマップ上に透過オーバーレイする最新メッセージ行。太字強調・世代別フェードアウト完備。
  - `<nh-paperdoll>`: 人形型装備スロット（頭、鎧、マント、武器、盾、指輪、靴等）。ドラッグ＆ドロップおよび換装差分プレビュー対応。
  - `<nh-container-filer>`: 2画面コンテナ出し入れファイラー。数量スライダー、BoH 防爆安全ガード（Bag of Holding 爆発防止）完備。
  - `<nh-ui-config>`: Neo-Retro Dark Glass UI 設定パネル。プリセット管理・LocalStorage 永続化。
  - `<nh-knowledge-card>`: 3層構造（基本スペック・公式攻撃ダイス・`data.base` 文学引用/伝承）を凝縮した超軽量統合ナレッジカード。
  - `<nh-discovery-codex>` / `<nh-codex-grid>`: ゲーム内 `\` 発見済みアイテム対照図鑑およびシルエット解禁対応の冒険手帳グリッド。
  - `<nh-radial-palette-hud>` / `<nh-shiren-inventory-drawer>` / `<nh-gamepad-guide-bar>` / `<nh-context-hint-pill>`: ゲームパッド・コンソール操作向け UI コンポーネント群。

### 4.3 コンテキスト連動型岩盤可視化 ＆ 掘削アシスト・マップ上コマンド数バッジ (`Renderers & Overlays`)

* **主要クラス / モジュール**:
  - `src/ui-controller/UIConfigStore.js` (`stoneRenderingMode`, `mapActionIndicator`)
  - `examples/gkl-pure-js-client/modules/renderers/MainViewportRenderer.js` (2D Canvas レンダラー)
  - `examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js` (WebGPU 3D ジオラマレンダラー)
  - `examples/gkl-pure-js-client/modules/renderers/hd2d/hd2dFxOverlay.js` (3D 空間 2D オーバーレイ)
  - 詳細仕様書: [context_aware_stone_and_digging_rendering_spec.ja.md](./2_client_ui/context_aware_stone_and_digging_rendering_spec.ja.md)
* **できること**:
  - **スマート岩盤可視化 (`stoneRenderingMode: 'smart'`)**: 普段は部屋・通路のネットワーク構造がくっきり見える「黒抜き」を維持しつつ、つるはし等の掘削アクション（`hasDig`）が発生したときのみ、隣接する観測済み岩盤（`isObservedStone` / `3929`）を浮かび上がらせてアンバー枠（`#fbbf24`）で強調描画。
  - **3大描画モード切替**: `smart`（既定）、`minimal`（常時完全黒抜き）、`classic_tile`（観測済み岩盤の常時クッキリ描画）を `<nh-ui-config>` からオンデマンド切替・LocalStorage 永続化。
  - **HD-2D 3D 壁インスタンス動的投影**: WebGPU 3D モードにおいて、掘削可能岩盤を立体的な壁天面および前面インスタンス（不透明度 0.85）として動的に立ち上げ。
  - **マップ上 ContextActions コマンド数ミニバッジ (`mapActionIndicator`)**: 自キャラ周囲（隣接8方向＋足元）のマス上に、GKL の推奨固有アクション数をピル型ミニバッジ（および控えめなガイド枠）としてオーバーレイ描画。盤面クリックにより `FloatingContextActions` を直接起動可能。

---

## ⑤ アーキテクチャの基本憲法（設計判断ルール）

すべての新機能開発・リファクタリングにおいて遵守すべき **「6大原則」** です。

```mermaid
graph TD
    Const1["憲法1: DRY ＆ バリアント追従の原則\n(WASM一次情報を静的二重持ちしない)"]
    Const2["憲法2: 公式Cコード非侵襲の原則\n(公式Cソースは無改変・外付けshim_bridge.cとJSで拡張)"]
    Const3["憲法3: 直交性の原則\n(描画表現と操作拡張を完全に独立分離)"]
    Const4["憲法4: パーマデス維持と知のメタ進行\n(キャラ強化は持ち越さず図鑑収集率のみ蓄積)"]
    Const5["憲法5: ゲーム内とゲーム外の疎結合\n(プレイ中は超軽量カード、大図鑑は独立展開)"]
    Const6["憲法6: 確定情報とフォールバックの排他ルーティング\n(Shim直結時は文字列パース・推測処理を完全バイパス)"]
```

### 憲法 1: DRY ＆ バリアント追従の原則 (Single Source of Truth)
WASM（C コア）が内部で保持している一次情報（所持品、装備、真の地形、属性値、耐性、発見済みアイテム、公式文学引用）は、JavaScript 側で静的に二重持ちしてはならない。  
Phase 8 の単一窓口 `callShim`（`_shim_bridge_call`）による C メモリ直接参照、または `querySequenceSilent`（`suppressPrompts: true`）を用いて C コアから動的に引き出し、メモリキャッシュで運用する。

### 憲法 2: 公式 C コード非侵襲の原則 (Non-Invasive C-Core)
NetHack 本体の公式 C ソースコード（`win/shim/winshim.c` や `src/*.c`）を独自に改変してはならない。  
C メモリ参照が必要な場合は独立した単一外付けファイル `src/driver/shim/shim_bridge.c`（`_shim_bridge_call`）に集約し、公式 NetHack のコードベースを 100% クリーンに保つことで、本家アップデートへの即時追従を保証する。

### 憲法 3: 直交性の原則 (Orthogonality of Render & Input)
「描画表現（ASCII ⇄ 2Dタイル ⇄ WebGPU HD-2D）」と「操作性（Vanilla 操作 ⇄ Enhanced 拡張操作）」は完全に直交し、独立して切り替え可能でなければならない。  
「タイル描画でクラシックなキーボード操作のみを行う」「ASCII 描画でマウス・ペーパードール操作を行う」など、プレイヤーがあらゆる組み合わせを自由に選択できる自由度を保証する。

### 憲法 4: パーマデス維持と知のメタ進行 (Permadeath & Meta-Knowledge)
NetHack 本来の醍醐味である「パーマデス（死んだらキャラクター能力・所持品は一切持ち越せない）」を厳格に堅持する。  
セッション横断で持ち越す要素は、プレイヤー自身の知識の結晶である「冒険手帳・図鑑収集率（%）」「アイテム発見履歴」「スコアボード・死因アーカイブ」などの **「知の蓄積（メタ進行）」** に限定する。

### 憲法 5: ゲーム内（即時）とゲーム外（鑑賞）の疎結合 (In-Game vs Out-Game Decoupling)
ゲームプレイ中の操作性を阻害してはならない。プレイ中に表示するナレッジは、ミリ秒単位で開き最小限の視線移動で把握できる超軽量な単体カード（`<nh-knowledge-card>`）とする。  
全モンスター・全アイテム・全伝承を一覧・鑑賞する大図鑑や戦歴分析は、独立ツール（`tools/adventure_log.html`, `tools/scoreboard.html`）として分離展開する。

### 憲法 6: 確定情報（Direct Binding）と推論フォールバックの排他ルーティング原則 (Exclusive Routing & Strict Priority)
Phase 8 の C 構造体メモリ直結（`SHIM_DIRECT`）が有効な場合、従来の「画面テキスト正規表現パース」や「ヒューリスティック推論（仮床推測・文字列からのカテゴリ逆算等）」を**同一パイプライン内で混在・後段実行してはならない**。
- **入口での完全分岐**: C 構造体から仮の文字列を合成して既存テキストパーサーに流し込む「逆流アダプタ」を禁止する。`SHIM_DIRECT` 経路は `onum` / `oclass` / `corpsenm` / `flags` 等の確定値のみから $O(1)$ で決定論的に解決し、テキスト解析・推論コードは `fallback` モード専用パスとして完全に隔離する。
- **厳格な3階層優先順位**: **Tier 1（C 構造体 Ground Truth ＋ 既知フラグ `known`/`dknown`/`bknown`/`seenv`） > Tier 2（`print_glyph` で目視確定済みの扉の向き等の視覚属性） > Tier 3（`fallback` 時のみの文字列・推論）** の順序を厳守し、下位層が上位層の確定情報を上書き破壊することを一切禁止する。

---

## ⑥ 機能重複およびレガシー文字列パースの統廃合・退役候補 (Consolidation & Retirement Candidates)

コードベースの肥大化・保守コスト・正規表現誤爆リスクを削減するため、段階的に統合・退役（断捨離）を進めているリストです。

### 6.1 UI コンポーネントの重複統廃合

| 対象機能 / UI | 現状の重複状況 | 一本化・統廃合先 | ステータス / メリット |
| :--- | :--- | :--- | :--- |
| **ナレッジ詳細カード** | `KnowledgeDetailModal.js` (Nehww)<br>`<nh-knowledge-card>` (共通基盤) | **`<nh-knowledge-card>`** | `🟢 コンポーネント配備済` — 3層統合ナレッジカードへ集約中。 |
| **メッセージHUD / ログ** | `FloatingMessageHud.js` (Nehww)<br>`MessageHistoryDrawer.js`<br>`<nh-floating-hud>` | **`FloatingMessageHudController`** ＋ **`<nh-floating-hud>`** | Headless コントローラーと標準 Web Components への一本化により、描画ロジックの二重実装を解消。 |
| **コンテナ出し入れ操作** | `ContainerModal.js` (Nehww)<br>`<nh-container-filer>` (共通基盤) | **`<nh-container-filer>`** | 二画面コンテナ操作、数量ドラフト、BoH 防爆安全ガードのロジックを共通コンポーネント1つに集約。 |
| **ペーパードール装備** | `PaperdollModal.js` (Nehww)<br>`<nh-paperdoll>` (共通基盤) | **`<nh-paperdoll>`** | 部位判定・ドラッグ＆ドロップ・換装シミュレーションのロジックを一元化。 |
| **モーダルスタック管理** | `ModalManager.js` (Nehww)<br>`ModalStackController.js` (Headless) | **`ModalStackController`** | ESC 閉塞・FocusTrap・Z-Index 解決を Headless パッケージに完全統一。 |

### 6.2 Phase 5（シグナル化）＋ Phase 8（Direct Binding）により不要化した旧文字列パース・推測処理の断捨離対象
以前は C コア内部が見えなかったため画面出力の正規表現パースに頼っていましたが、同一 WASM バイナリ内で `shim_bridge.c` と `MessageContextResolver` が常時稼働する現在、**「念のため残した過去の文字列パース」自体が誤爆バグや複雑化の温床**となっています。以下の処理は安易に温存せず、要否を厳しく監査して計画的に縮小・廃止（退役）します。

| ドメイン / 対象箇所 | 過去のレガシー実装（疑うべき処理） | 現在の正規手段（Ground Truth） | 整理・断捨離方針 |
| :--- | :--- | :--- | :--- |
| **所持品カテゴリ・装備状態判定**<br>`InventoryStateManager.js`<br>`EquipmentRules.js` | `categorizeItem` の Layer 2 文字列正規表現、`parseEquipState(rawText)` の括弧パース、和名逆流 | `onum` (`0..480`) / `oclass` 直引き ＋ `getEquipmentPtrs()` ＋ ASCII英語純化 | **✅ 整理完了 (Stage 8.5)**: 和名汚染を解消し、モデル層の日本語正規表現を完全撤廃。 |
| **アイテム外見・識別深度解析**<br>`ItemIdentificationResolver.js` | `detectAppearance`（形容詞総当たり正規表現）、`inferCategory`、`extractBuc`、`extractEnchantmentAndCharges` | `onum` ＋ `oc_name_known` ＋ `oc_descr_idx` ＋ `o->bknown` / `o->known` / `o->spe` | **✅ 整理完了 (Stage 8.5)**: 数値とフラグから直接構築し、日本語正規表現を完全削除。 |
| **ディスカバリー同期**<br>`DiscoveryStateManager.js` | `\` コマンドのサイレントマクロ実行とテキスト行正規表現パース (`updateFromDiscoveriesText`) | `SHIM_CMD_DUMP_DISCOVERIES` (0x10) ＋ `DUMP_DESCR_INDEXES` (0x62) ＋ `oc_uname` | 実機ではメモリ直結で 100% 完結するため、マクロ実行と行パーサーへの依存を廃止。 |
| **空間・仮床・扉/罠推論**<br>`AreaStateManager.js`<br>`TerrainInferenceEngine.js` | `9622` 仮床注入、メッセージ文字列からの罠・施錠推測 | `dumpLevelTerrain()` ＋ `getCellInfo()` (`typ`, `door`, `trap`) ＋ `print_glyph` | **✅ 整理完了 (Stage 8.3-B/C)**: Direct Binding 稼働時は仮床推測・メッセージ頼みの地形書き換えを完全排除。 |
| **属性・耐性・タイマー同期**<br>`AttributeStateManager.js` | `^X` のサイレントマクロ画面キャプチャと正規表現パース、祈り経過歩数カウント | `SHIM_CMD_GET_PLAYER_SUMMARY` (0x30) ＋ `GET_PLAYER_PROPS` (0x32: `uprops`) ＋ `ublesscnt` | **✅ 整理完了 (Stage 8.4)**: C メモリ直接取得に一本化。お祈りタイマーも真値直結へ移行。 |

> **💡 今も本当にテキスト処理が必要な領域（これだけに集中する）**:  
> ① `putmsg` 動的メッセージストリームのカタログ照合（`MessageContextResolver`）と翻訳（`TranslationEngine`）  
> ② 対話プロンプト（`yn_function`, `getlin`）および C コアの選択メニューウィンドウ（コンテナ・呪文選択時のレター抽出）  
> ③ テキスト自体が一次情報である `dat/data.base`（公式文学引用）と `xlogfile`（スコアボード死因文字列）

---

## ⑦ ギャップ分析と解消状況 (Capability Gaps & Resolution Status)

初期監査で抽出された 4 大ギャップ（ギャップ 1: ディスカバリー図鑑、ギャップ 2: 命名アシスト、ギャップ 3: WASM動的文学引用、ギャップ 4: 冒険手帳ダッシュボード）および床アイテム覗き見知恵（Peek Wisdom）は、**すべて 100% 実装完了** しました。

| ギャップ項目 | 状態 | 実装・解決内容 |
| :--- | :---: | :--- |
| **ギャップ 1: `\` コマンド（ディスカバリー）の図鑑UI連携** | **✅ 実装完了**<br>*(Phase 7-1)* | `<nh-discovery-codex>` により、ゲーム内で発見済みアイテムの「真名 ⇄ 外見」対照表・基本価格・カテゴリ絞り込みを即時閲覧可能。さらに Stage 8.2-C の `SHIM_CMD_DUMP_DESCR_INDEXES` でメモリ直結化も完了。 |
| **ギャップ 2: アイテム候補逆引きからの命名支援 ＆ GamePad候補選択** | **✅ 実装完了**<br>*(Phase 7-3 / ROADMAP §2.1)* | `ItemCandidateResolver.js` (価格帯・効果・既知除外) ＋ `CustomNameStore.js` ＋ `<nh-call-candidate-dialog>` ＋ `InputCoordinator` 連携により、テキストパース不要でキーボード・ゲームパッドからワンタップで候補仮名を選択・命名可能。 |
| **ギャップ 3: WASM 動的文学引用（`data.base`）のオンデマンド閲覧 UI** | **✅ 実装完了**<br>*(Phase 7-1)* | `OnDemandLookupService.js` および `<nh-knowledge-card>` の第3層「文学・伝承引用」セクションとして完全接続済み（LRUキャッシュ＋日本語対訳対応）。 |
| **ギャップ 4: セッション横断の図鑑収集率（知のメタ進行）ダッシュボード** | **✅ 実装完了**<br>*(Phase 7-2)* | `AdventureLogManager.js`、`<nh-codex-grid>`、および独立ツール `tools/adventure_log.html` / `tools/scoreboard.html` として完全実装済み。 |
| **【追加】床アイテム覗き見知恵 (Peek Wisdom) 統合** | **✅ 実装完了**<br>*(Phase 8 Stage 8.5)* | `SHIM_CMD_GET_OBJECT_AT` から `ItemSpecPresenter` へ接続し、床に置かれたアイテムの数量、強化値、残チャージ、対象生物種別、BUC を動的バッジ化。 |

---

## 8. まとめ

NetHack WASM WebUI は、「通信・同期（Phase 8 Direct Binding + IRC）」「状態解析」「データ・伝承」「UI調停（Headless UI + Web Components）」「マルチドライバ音響（Phase 6）」の各レイヤーにおいて、極めて強固で完成度の高いインフラストラクチャ（全158スイート・1,984テスト 100% PASS）を保有しています。  
初期の全ギャップおよび Phase 8 メモリ直結基盤が完遂された現在、**強固な土台の上でセマンティックUIやモダンインベントリダイアログ等の次期構想へ安心して邁進できる状態** が整いました。
