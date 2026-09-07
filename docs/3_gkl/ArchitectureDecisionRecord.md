---
title: ArchitectureDecisionRecord
status: active
last_updated: 2026-08-21
related_code:
  - src/core/knowledge/
---

# Game Knowledge Layer (GKL) アーキテクチャ決定記録 (ADR)

本文書は、NetHack WASM WebUI の Game Knowledge Layer (GKL) における**設計原則**、**レイヤー境界の定義**、および**将来の設計フローにおける検討事項 (TODO)** を記録した決定文書である。

---

## 1. コア設計原則 (Core Architecture Principles)

### 1.1 分離アーキテクチャの徹底 (Clean Boundary & Layer Separation)
- **Cコア (Game Engine) と WebUI/GKL (Knowledge/UI) の完全分離**:
  - `NetHackWasmDriver` は純粋な低レイヤー受動通信エンジンとし、Cコアの内部メモリ構造体（`struct obj *invent` 等）を無理に泥臭く直接ハック・参照する過剰な実装を回避する。
  - Cコアと WebUI/GKL の間は、確立された通信プロトコル（イベントおよび `queueSequence` トークン配列）を介してやり取りし、レイヤー間の強結合を防ぐ。

### 1.2 シーケンス実行結果の一時バッファ獲得アーキテクチャ (`lastSequenceBuffer`)
- **Cコアのメモリ非ハックによる全知識獲得の決定版**:
  - `queueSequence` 実行中に Cコアが出力したすべてのテキスト・メニュー構造体を、ドライバー内部の一時バッファ (`lastSequenceBuffer`) にキャッチ・蓄積する。
  - 上位レイヤー（GKL / `WebUICore` / AI Agent）は、シーケンス完了後に `driver.getLastSequenceBuffer()` を参照することで、インベントリに限らず任意のコマンド（スペル一覧 `+`、ダンジョン履歴 `Ctrl-O` 等）の実行結果を 100% 安全かつ完全な通信データとして獲得する。

### 1.3 設計先行原則 (Design-First Principle)
- **アドホックなコード変更の厳禁**:
  - 複雑な知識追跡や状態同期機能の実装にあたっては、データフロー、状態のライフサイクル、およびインターフェースを事前に詳細設計ドキュメント・フロー図として完全に詰め切ってから実装を開始する。
  - 議論と合意形成が不十分な状態での安易なコード追加・修正は固く慎む。

### 1.4 操作性の安全担保 (UX Guidelines)
- **`apply` (`a`) ボタンの UI 常設**:
  - 推奨アクション (ActionSupport) が万が一全自動で発火しきらない状況であっても、プレイヤーが手動で道具（鍵・ツルハシ・ロックピック等）を使用できるように、タッチ/モバイル UI では `apply` (`a`) ボタンを常時アクセス可能な基本ボタンとして配置・維持する。

### 1.5 `WebUICore` と GKL の責務分離 (SoC) と 汎用サイレントクエリ (`querySequenceSilent`)
- **`WebUICore` の純粋汎用インフラ化**:
  - `WebUICore` はゲームルールやインベントリ等のドメイン知識を一切持たない純粋な通信インフラ層とし、Cコアへの汎用サイレント問い合わせ API `querySequenceSilent(tokens, options)` および直近バッファアクセサ `getLastSequenceBuffer()` のみを提供する。
  - `querySequenceSilent(['i', ' '])` や `querySequenceSilent(['+', ' '])`、`querySequenceSilent(['#', 'enhance', ' '])` などを呼び出すことで、画面非表示で自走実行し、シーケンス完了時に実行結果バッファ（`buffer`）を Promise の戻り値として直接受領する統一パイプラインを確立（`getLastSequenceBuffer()` の手動ポーリングは不要）。

### 1.6 GKL 統合状況アクセサ (`SituationCache`) と 4 層パイプライン構造
- **GKL の階層化と統一アクセサの導入**:
  - GKL を 1. 統合状況キャッシュ層 (`SituationCache`), 2. 知識補完・静的辞書層 (`StructuredKnowledgeEngine`, `OBJECT_KNOWLEDGE_FULL`, `MONSTER_KNOWLEDGE_FULL`), 3. 操作支援・推論層 (`ContextActionEngine`, `ItemIdentificationResolver`, `ItemSpecPresenter`, `OnDemandLookService`), 4. 自走実行制御層 (`RequestController`) の 4 層モデルとして整理。
  - `SituationCache` は `StatusAccessor` (ステータス/状態異常等), `InventoryStateManager` (所持品/ツール等), `AreaStateManager` (マップ/位置情報), `SpellStateManager` (習得魔法/詠唱成功率), `AttributeStateManager` (`^X` 耐性/固有能力), `SkillStateManager` (`#enhance` スキル熟練度), `DiscoveryStateManager` (`\` 発見/鑑定台帳) を統一ファサードとして一括束ね、UI クライアント（常時表示ボタン、独自ステータス UI）や AI Agent に `getSituation()` で現況データを一括提供する。

### 1.8 `WebUICore` (インフラ層) と GKL (知識・制御層) の完全層別分離およびモジュール切り離し方針 (Decoupled Module Architecture)
- **知識ロジック密結合の排除と完全疎結合化**:
  - `WebUICore` は Wasm Cコアとの低レイヤー通信・イベント仲介・レンダリング・翻訳・ウィンドウ管理に専念する「通信・UIインフラ基盤」とし、内部に GKL のドメイン知識を直接ハードコードしない。
  - GKL モジュール群 (`RequestController`, `InventoryStateManager`, `AreaStateManager`, `SpellStateManager`, `AttributeStateManager`, `SkillStateManager`, `DiscoveryStateManager`, `ContextActionEngine`) は `WebUICore` のパブリックイベント (`inputRequired`, `putstr`, `sequenceFinished` 等) を外部からイベントリスナーとしてバインド・アタッチする「独立拡張モジュール/プラグイン」構成とし、どちらの改修も相互に干渉しない綺麗な層分け設計（Separation of Concerns）を徹底する。

### 1.9 アーキテクチャ階層化モデル: 通信インフラ層 ➔ 知識層 (GKL) ➔ 戦略層 (Strategy/Action)
- **3 レイヤーへの明確な概念再構築**:
  1. **【低レイヤー / 通信・UIインフラ層 (Infrastructure)】 (`WebUICore`, `NetHackWasmDriver`)**:
     - Wasm Cコアとの入出力、描画、キーマッピング、テキストウィンドウ等の純粋基盤。
  2. **【知識層 / 事実保持・同期 (Knowledge - True GKL)】**:
     - **動的状態管理**: `InventoryStateManager`, `AreaStateManager`, `StatusAccessor`, `SpellStateManager`, `AttributeStateManager`, `SkillStateManager`, `DiscoveryStateManager`, `SituationCache`
     - **静的ドメイン知識**: `StructuredKnowledgeEngine`, `glyphClassifier`, `OBJECT_KNOWLEDGE_FULL`, `MONSTER_KNOWLEDGE_FULL`
     - **知識解決・整形**: `ItemIdentificationResolver`, `ItemSpecPresenter`, `OnDemandLookService`
     - 現状のゲーム世界の事実（所持品、マップ、ステータス、耐性、魔法、鑑定状態）の最新化と保持・管理に専念。
  3. **【戦略層 / 推論・意思決定 (Strategy / Action)】 (`ContextActionEngine`, `RequestController`, AI Agent)**:
     - 知識層から得た「状況 (Situation)」を評価インプットとし、次に何をすべきかの推論・推薦・アクション選択・自走実行を行う戦略モデル。

### 1.10 静的ナレッジの初回遅延固定化 (Lazy Memoization) と動的ステート合成 (Static/Dynamic 2-Tier Separation)
- **ゼロ起動遅延・超低メモリ・プレイ中翻訳負荷ゼロの達成**:
  - 全481アイテム、全384モンスター、全地形のマスターデータ（材質・固定効果・戦術Tips・地形解説）はゲーム中不変の「静的ナレッジ」である。
  - これらを起動時に一括翻訳すると起動待ち時間が発生するため、**「初回参照（インベントリ同期またはホバー）時にオンデマンドで1度だけ翻訳して正規化IDキー（`ja_item_onum`, `ja_mon_id`, `ja_terrain_id`）でキャッシュ固定化（Lazy Memoization）し、以後は完全 O(1) 参照する」** 設計を採用する。
- **動的ステート（鑑定状態・BUC・装備・モンスターHP・状態異常等）の安全な動的合成**:
  - 識別状態の変化（未識別 ➔ 判明）、呪い/祝福（BUC）、強化値、装備状態、モンスターの敵対/ペット状態・確定HPなどの「動的ステート」は、固定キャッシュせず、`DiscoveryStateManager` や最新 `Situation` から常に正しく合成（シャローコピー上乗せ）する。
  - これにより、**「古い情報が残り続ける不整合バグのリスクを完全にゼロ」** にしつつ、**「毎ターンのインベントリ同期やホバー時の不要な翻訳エンジン実行・重いディープコピー・GC負荷を完全に排除」** する。

### 1.11 行動指針 (Action Stance) ＆ アシストシグナル 3層情報圧縮モデル (`AssistSignalSynthesizer`)
- **情報過多・ボタン乱立の防止とワンタップ即時行動**:
  - `TacticalAdvisor` が多面的に列挙する警告から、優先度スコアリング（90+即死 ➔ 80+生命 ➔ 60+状態 ➔ 40+装備 ➔ 20+利便）によって **HUD最上部用 1 行シグナル（Level 2）** と **ワンタップ即時実行アクション（Level 3）** を厳選・調停する。
  - 各所持品スロットや修得魔法スロットには **Level 1 Nano Badge**（`[💊緊急回復]`, `[🔥治療]`, `[⚠️高失敗(XX%)]` 等）と金枠・赤枠パルスを分散配置し、UI の一覧性を損なわずにプレイヤーを正しいアイテム・行動へ誘導する。
- **フロア設備サマリー (`summary`) の提供側集約**:
  - `AreaStateManager` は、階段・祭壇・流し台・噴水・王座・店主の生座標一覧（`all`）に加え、同種設備を 1 種 1 つに集約した **`summary: FloorLandmarkSummaryItem[]`**（個数 `count`、全座標 `coords`、整形済みツールチップ文 `tooltipJa`/`tooltipEn`）を提供する。
  - UI 側（PureJS, React, Vue, Mobile 等）での集約ロジックの重複を排除し、描画コードを極限までシンプルに保つ。

### 1.12 構造化ナレッジ単一真実源 (SSOT: Single Source of Truth) 統合方針
- **モンスター・アイテム・地形知識の重複・分散排除**:
  - 「浮遊する目玉への目隠し」「銀弱点への銀武器」「反射敵へのビーム禁止」「錆び・腐食耐性」などの危険特性とカウンター対策を、各モジュール（`TacticalAdvisor`, `AssistSignalSynthesizer`, `ContextActionEngine`）にハードコード・分散させず、**構造化ナレッジ（`MONSTER_KNOWLEDGE_MAP` 等）の `threat` / `counters` メタデータとして単一真実源（SSOT）化**する。
  - 戦術アドバイザーやアシストシグナルはナレッジのメタデータを消費する「データ駆動型エンジン」とし、新モンスターや新対策の追加・仕様変更を図鑑データの更新のみで全モジュールに連動・反映させる。

### 1.13 インベントリ状態同期アーキテクチャ ＆ MonsterTracker 連動型ポストコンバット同期方針
- **AC変化検知による盗難・破損のゼロオーバーヘッド即時同期 (Phase 1)**:
  - 敵ターンでの盗難（ニンフ等）や装備破壊・脱衣によるインベントリ乖離に対し、`status_update`（`BL_AC = 14`）の変動をトリガーとして `inventoryStateManager.invalidate()` を1度だけ実行。メッセージパースに一切依存せず、安全かつ確実に同期を実現。
- **MonsterTracker 減衰モデル連動ポストコンバット遅延同期構想 (Phase 2)**:
  - 消耗品等の盗難に対し、戦闘中の毎ターン同期によるラグを回避するため、`stealsItems` 特性を持つ敵との近接接触フラグ（`hadCloseContact`）を記録し、その敵がテレポート、逃走（LoS外れ）、撃破、または追跡減衰によって「監視から外れた瞬間」にインベントリを遅延 invalidate する結果的整合性（Eventual Consistency）モデルを採用する（詳細は [GKL_Inventory_Synchronization_Architecture.md](./GKL_Inventory_Synchronization_Architecture.md) を参照）。

### 1.14 UI層ドメイン知識排除とプレゼンテーション層の自由度分離 (UI Decoupling & Presentation Freedom)
- **GKLの責務（ゲームルール・ドメイン解決の完全隠蔽）**:
  - FocusCamera / マップ描画における「死亡時の墓石（4011）」や「アイテム/モンスター下の仮床（3992）」などの NetHack 内部グリフ番号やゲームルールを UI 側にハードコードさせず、GKL（`AreaStateManager.getFocusCameraTiles`）が完全解決済みの描画順配列 `renderGlyphs: number[]` および階層メタデータ（`bottomGlyph`, `middleGlyph`, `topGlyph`, `effectGlyph`）として提供する。
  - マップ座標からの意味情報問い合わせは `inspectCellOnDemand({ x, y })` を単一窓口とし、UI 側での生グリフ直引きや未探索マスの誤判定（巨大アリ誤検出等）を完全に防止する。
- **UI側の裁量（デザイン・表現の自由）**:
  - アイテムのアイコン表現（`item.category` から `🧪` を出すか独自 SVG / 文字にするか）、BUC状態（`item.identification.bucStatus` から `+`/`-` バッジにするか枠色にするか）、ステータスバーの配置レイアウト等は **UI 実装者の自由度** として委ね、GKL から特定の CSS クラス名や固定 HTML 文字列を押し付けない綺麗な境界を維持する。

### 1.15 プレイヤー支援・警告・セーフティ制御の統合調停モデル (Notification, Advice & Safety Arbiter ADR)
- **背景と課題（情報多重度とアラート疲労の回避）**:
  - GKLの発展に伴い、「戦術指南 (`TacticalAdvisor`)」「行動指針・最短行動示唆 (`AssistSignalSynthesizer` / Action Stance)」「事故防止・操作抑止 (`ContainerSafetyGuard`, `GenocideService`, `WishService.checkWishSafety`)」の3系統が別個に成長し、UI上で警告や助言が入り乱れてプレイヤーのアラート疲労（警告慣れ・見落とし）や演出の競合が発生するリスクが高まった。
  - 単なる「共通文字列メッセージ」に集約すると、決定ボタンの無効化や特定スロットの点滅といった**能動的な操作抑止・UI制御**ができず、逆にUIが独自に判定ロジックを抱え込むとルールのSSOTが崩壊する。
- **決定された設計原則（Headless 制御メタデータと UI Decoupling）**:
  1. **4段階の介入度階層 (Severity Hierarchy)**:
     - **`BLOCK` (強制遮断 / セーフティガード)**: 取り返しのつかない即死・全ロスト（BoH爆発、自己虐殺、他職クエストAF願い）を防止。決定操作の物理的無効化（`DISABLE_SUBMIT`）。
     - **`ALERT` (緊急警告 / アシストシグナル)**: 次の1ターンで死亡・大損害（HP危機、麻痺、神罰爆破）。赤色・最優先HUD・パルスアニメーション。
     - **`GUIDE` (戦術指南 / タクティカルアドバイス)**: 損をしないための中長期育成・探索（耐性獲得、未識別鑑定、祈り）。黄色/青色・折りたたみ可能。
     - **`INFO` (静的解説 / ナレッジ)**: カタログ・図鑑（`KnowledgeInspector`）。通常テキスト表示。
  2. **Headless 制御メタデータ（指示書）の発行**:
     - GKL（コア層）は固定HTMLや特定CSSを押し付けず、「意味」「危険度階層 (`level`)」「推奨UI制御指示 (`uiDirective`: `DISABLE_SUBMIT` / `REQUIRE_CONFIRM` / `HIGHLIGHT_SLOT`)」「日英メッセージ (`messageJa`, `messageEn`)」「根拠データ (`metadata`)」を含む**構造化制御メタデータ**を発行することに専念する。
  3. **UI層の完全な表現自由度（プレゼンテーション層の裁量）**:
     - メタデータを受け取った各UIクライアント（PureJS, React, Vue, Mobile, CUI）は、そのUI形態や実装の好みに応じて自由に演出・抑止を実装する：
       - *デスクトップWebUI*: 決定ボタンを赤く `disabled` 化し、プレビュー直上に警告バナーと属性タグを表示。
       - *モバイルタッチUI*: ボタン無効化に加え、ハプティクス（振動）や画面下部ハーフモーダルで注意喚起。
       - *クラシックCUI*: 赤文字 `[FATAL]` 表示に加え、`[y/N]` のハード確認プロンプトを差し込む。
  4. **調停エンジン（Arbiter）によるサプレス方針**:
     - 高優先度の `BLOCK` や `ALERT` がアクティブな場合、低優先度の `GUIDE` や `INFO` を自動的に一時非表示（サプレス）または集約し、本当に命に関わる警告が埋もれない情報トリアージを保証する。

---

## 2. 実装仕様 (`lastSequenceBuffer` & `querySequenceSilent`)

### 2.1 データ構造とライフサイクル
1. **新規プロパティ**: `NetHackWasmDriver` 内に `this.lastSequenceBuffer = []` を保持。
2. **実行開始時のクリア**: `driver.queueSequence(tokens, options)` の呼び出し冒頭で `this.lastSequenceBuffer = []` を自動初期化。
3. **実行中の受動蓄積**:
   - `isExecutingSequence === true` の間、`putstr` (テキスト行), `textWindowBuffers` (テキストバッファ), `select_menu` (メニュー構造体) が Cコアから発行された際、画面表示および `putmsg` 配信の有無に関わらず `lastSequenceBuffer` 配列へ自動プッシュ保存。
4. **完了後の参照・直接返却 API**:
   - `await queueSequence(tokens)` (および `await querySequenceSilent(tokens)`) の戻り値 Promise として、シーケンス完了時に結果バッファのクリーンなコピーを直接受領可能（`driver.getLastSequenceBuffer()` でも参照可能）。

### 2.2 本設計の定量的メリット
- **WASM メモリハック 0%**: C言語の構造体ポインタ（`struct obj *invent` 等）の解析が一切不要。
- **マルチバージョン・他エンジン移植性 100%**: 通信イベントのみに依存するため、Cコア更新時にも破綻しない。
- **知識獲得の完全汎用化**: インベントリ(`i`)、所持品詳細(`v`)、呪文(`+`)、ダンジョン履歴(`Ctrl-O`) 等、あらゆるシーケンス結果を統一プロトコルで獲得可能。
- **推測バグ 0%**: ログメッセージによる不確実なレター推測登録を排除し、メニューバッファからの 100% 正確な同期を実現。

