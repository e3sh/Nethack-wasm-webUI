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

---

## 2. 将来実装時のための詳細仕様 (`lastSequenceBuffer`)

### 2.1 データ構造とライフサイクル
1. **新規プロパティ**: `NetHackWasmDriver` 内に `this.lastSequenceBuffer = []` を保持。
2. **実行開始時のクリア**: `driver.queueSequence(tokens, options)` の呼び出し冒頭で `this.lastSequenceBuffer = []` を自動初期化。
3. **実行中の受動蓄積**:
   - `isExecutingSequence === true` の間、`putstr` (テキスト行), `textWindowBuffers` (テキストバッファ), `select_menu` (メニュー構造体) が Cコアから発行された際、画面表示および `putmsg` 配信の有無に関わらず `lastSequenceBuffer` 配列へ自動プッシュ保存。
4. **完了後の参照 API**:
   - `driver.getLastSequenceBuffer()` (または `core.getLastSequenceBuffer()`) を新設し、実行結果のクリーンなコピーを上位層へ提供。

### 2.2 本設計の定量的メリット
- **WASM メモリハック 0%**: C言語の構造体ポインタ（`struct obj *invent` 等）の解析が一切不要。
- **マルチバージョン・他エンジン移植性 100%**: 通信イベントのみに依存するため、Cコア更新時にも破綻しない。
- **知識獲得の完全汎用化**: インベントリ(`i`)、所持品詳細(`v`)、呪文(`+`)、ダンジョン履歴(`Ctrl-O`) 等、あらゆるシーケンス結果を統一プロトコルで獲得可能。
