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
  - `querySequenceSilent(['i', ' '])` や `querySequenceSilent(['+', ' '])` を呼び出すことで、画面非表示で自走実行し、シーケンス完了時に `driver.getLastSequenceBuffer()` のバッファを Promise として返却する統一パイプラインを確立。

### 1.6 GKL 統合状況アクセサ (`SituationCache`) と 4 層パイプライン構造
- **GKL の階層化と統一アクセサの導入**:
  - GKL を 1. 統合状況キャッシュ層 (`SituationCache`), 2. 知識補完層, 3. 操作支援・推論層 (`ContextActionEngine`), 4. 自走実行制御層 (`RequestController`) の 4 層モデルとして整理。
  - `SituationCache` は `StatusAccessor` (ステータス/状態異常等), `InventoryStateManager` (所持品/ツール等), `AreaStateManager` (マップ/位置情報) を統一ファサードとして一括束ね、UI クライアント（常時表示ボタン、独自ステータス UI）や AI Agent に `getSituation()` で現況データ `{ status, inventory, area, tools, actions }` を一括提供する。

### 1.7 ログメッセージ推測登録の全廃と未同期 (dirty) フラグ管理
- **不確実な推測パースの完全排除**:
  - 従来の `"You pick up a key."` 等のログメッセージから推測でアイテムを追加していた処理を全廃する。
  - ログメッセージ検知時は単に「インベントリ未同期 (isSynced = false / dirty)」フラグに変更し、`querySequenceSilent(['i', ' '])` 経由の 100% 正確な Cコアデータ（Single Source of Truth）による能動同期を徹底する。

---

## 2. 実装仕様 (`lastSequenceBuffer` & `querySequenceSilent`)

### 2.1 データ構造とライフサイクル
1. **新規プロパティ**: `NetHackWasmDriver` 内に `this.lastSequenceBuffer = []` を保持。
2. **実行開始時のクリア**: `driver.queueSequence(tokens, options)` の呼び出し冒頭で `this.lastSequenceBuffer = []` を自動初期化。
3. **実行中の受動蓄積**:
   - `isExecutingSequence === true` の間、`putstr` (テキスト行), `textWindowBuffers` (テキストバッファ), `select_menu` (メニュー構造体) が Cコアから発行された際、画面表示および `putmsg` 配信の有無に関わらず `lastSequenceBuffer` 配列へ自動プッシュ保存。
4. **完了後の参照 API**:
   - `driver.getLastSequenceBuffer()` (または `core.getLastSequenceBuffer()`) および `core.querySequenceSilent(tokens, options)` を通じて、実行結果のクリーンなコピーを非同期で上位層へ提供。

### 2.2 本設計の定量的メリット
- **WASM メモリハック 0%**: C言語の構造体ポインタ（`struct obj *invent` 等）の解析が一切不要。
- **マルチバージョン・他エンジン移植性 100%**: 通信イベントのみに依存するため、Cコア更新時にも破綻しない。
- **知識獲得の完全汎用化**: インベントリ(`i`)、所持品詳細(`v`)、呪文(`+`)、ダンジョン履歴(`Ctrl-O`) 等、あらゆるシーケンス結果を統一プロトコルで獲得可能。
- **推測バグ 0%**: ログメッセージによる不確実なレター推測登録を排除し、メニューバッファからの 100% 正確な同期を実現。

