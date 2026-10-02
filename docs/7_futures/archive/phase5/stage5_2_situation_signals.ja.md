---
title: "Phase 5 - Stage 5.2 詳細仕様書: 状況シグナル基盤と実行時コンテキスト照合"
status: implemented
created_at: 2026-09-19
last_updated: 2026-09-25
related_docs:
  - docs/7_futures/phase5_detailed_migration_plan.ja.md
  - docs/7_futures/message_context_and_signal_driven_architecture.ja.md
related_code:
  - tools/build_message_context_catalog.py
  - src/core/message/data/MessageContextCatalog.js
  - src/core/message/MessageContextResolver.js
  - src/core/message/ContextFrameBuffer.js
  - src/core/WebUICore.js
---

# Phase 5 - Stage 5.2 詳細仕様書
## 状況シグナル基盤（第1層）と実行時コンテキスト照合の確立

---

## 1. 目的とスコープ (Objective & Scope)
- **現状の課題**:
  - `tools/data/source_messages_mapped.json` は **14,849 件・約 11.8 MB** 存在する。これをブラウザ実行時に直接 import / fetch することは起動遅延・メモリ浪費の観点から不可能。
  - C コアから届くメッセージ（`raw_print` / `putstr`）やプロンプト（`yn_function` / `getlin`）は端末用テキストであり、客観的事象としての構造化が行われていない。
- **目的**:
  - SSOT マスタから WebUI で真に必要なメッセージのみを抽出した **軽量実行時カタログ（`MessageContextCatalog.js`: < 250KB）** をビルド時に自動生成。
  - Wasm から届く 1 行の生テキストから、超高速（< 0.1ms/件）にコンテキストを同定する **`MessageContextResolver.js`** を新設。
  - 直前メッセージ履歴ウィンドウを管理する **`ContextFrameBuffer.js`** を導入し、WebUICore から **「第1層: 状況シグナル (Situation Signal)」** を一元ディスパッチする。

---

## 2. カタログ自動生成ツール設計 (`tools/build_message_context_catalog.py`)

### 2.1 入力データソース
- `tools/data/source_messages_mapped.json`（全14,849件の SSOT マスタ）
- `tools/data/control_signals_master.json`（Phase 3 制御シグナルマスタ）

### 2.2 抽出・フィルタリング基準
1. **Layer 1: 視点・知覚メッセージ**:
   - `callee_func` が `You_feel`, `You_hear`, `You_cant`, `verbalize` に該当するもの（全件: 約600件）。
2. **Layer 2: ドメイン重要メッセージ**:
   - `eat.c`, `potion.c`, `read.c`, `zap.c`, `pray.c`, `trap.c`, `lock.c`, `shk.c`, `end.c` のうち、状態変化・効果音・アイテム識別に寄与するもの（約400〜600件）。
3. **Layer 3: 制御プロンプト**:
   - `yn_function`, `getlin`, `getdir` 等の入力要求（約100件）。

### 2.3 出力
- `src/core/message/data/MessageContextCatalog.js`（ESM 形式、サイズ < 250KB）

---

## 3. 実行時照合エンジン設計 (`src/core/message/MessageContextResolver.js`)

```
                    Wasm メッセージ (rawText)
                                │
                                ▼
                ┌───────────────────────────────┐
                │  MessageContextResolver       │
                └───────────────┬───────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
【完全一致インデックス】   【前方一致/プレフィックス】 【正規表現テーブル】
 ・固定リテラル文字列       ・"You feel ..." 等       ・プレースホルダ (%s, %d)
 ・Map による O(1) 逆引き  ・Trie またはプレフィックス  ・プリコンパイル済み正規表現
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   MessageContext      │
                    │  (構造化コンテキスト) │
                    └───────────────────────┘
```

### 3.1 MessageContext オブジェクトのスキーマ定義 (完全言語非依存)
```typescript
interface MessageContext {
    messageId: string;          // 例: "eat.c:L123:You_feel:0"
    file: string;               // 例: "eat.c"
    domain: string;             // 例: "eat/hunger"
    calleeFunc: string;         // 例: "You_feel"
    semanticRole: string;       // 例: "SENSATION" | "SOUND" | "INTRINSIC_CHANGE"
    layer: number;              // 1 ~ 3
    rawText: string;            // 受信した生テキスト ("You feel a hot sensation.")
    placeholders: string[];     // 抽出された動的引数 (モンスター名、道具名、音階名 "C note" 等)
    metadata: {
        intrinsic?: string;     // 耐性キー (例: "fire_resistance")
        soundId?: string;       // 対応する効果音 ID (例: "se_rumble")
        soundCategory?: string; // 効果音カテゴリ (例: "HEAR")
        signalId?: string;      // 制御シグナル ID (例: "SIGNAL_DIRECTION")
        subCategory?: string;   // 制御サブカテゴリ (例: "DIRECTION")
        inputType?: string;     // 入力要求型 (例: "DIRECTION")
        promptFunc?: string;    // プロンプト関数 (例: "getdir")
        [key: string]: any;
    };
}
```
> [!IMPORTANT]
> **翻訳責務の完全分離と言語非依存性**:
> `MessageContext` および `MessageContextCatalog` は純粋に C ソース発信の客観的事象（セマンティクス）のみを表現し、表示用言語（日本語・英語・他言語）に依存する翻訳文字列は一切保持しません。画面表示用の多言語翻訳は、既存の `TranslationEngine`（`dictionary.csv`）が一元管理します。

---

## 4. ContextFrameBuffer と WebUICore パイプライン

### 4.1 ContextFrameBuffer 設計
- 直近のユーザーアクション（poskey やプロンプト回答）以降に受信した `raw_print` / `putstr` を、時系列リングバッファ（最大 5〜10 件）として保持。
- 後続のプロンプト発生時や、GKL への文脈通知（直前ウィンドウ）として活用。

### 4.2 WebUICore の一元ディスパッチフロー
```javascript
// WebUICore.js メッセージ受信ハンドラ (handleMessageText)
const handleMessageText = (rawText) => {
    // 1. 状況シグナル (MessageContext) の超高速解決 (< 0.1ms, 完全言語非依存)
    const context = this.messageResolver ? this.messageResolver.resolve(rawText) : null;

    // 2. ターン内メッセージ履歴バッファへの記録 (直前ウィンドウ)
    if (this.contextFrameBuffer) {
        this.contextFrameBuffer.push({ rawText, context });
    }

    // 3. 構造化状況シグナル (Situation Signal) の一元ディスパッチ (Pub/Sub)
    if (context) {
        this.emit('situationSignal', { type: 'MESSAGE', context });
        if (context.domain) {
            this.emit(`messageContext:${context.domain}`, context);
        }
    }

    // 4. 画面表示用テキストの翻訳 (TranslationEngine / dictionary.csv が一元管理)
    const translated = this.translator.translate(rawText);

    // 5. サウンド・描画・従来メッセージイベントへの即時伝播
    const seEffect = this.sound.processLogMessage(translated);
    if (seEffect) {
        this.emit('soundEffect', seEffect);
    }
    this.renderer.appendMessage(translated);
    this.emit('message', translated);
};
```

---

## 5. 作業手順とチェックリスト

- [x] **Step 5.2.1**: `tools/build_message_context_catalog.py` を作成し、Layer 1 & Layer 2 重要メッセージの抽出・カタログ生成ロジックを実装。
- [x] **Step 5.2.2**: `src/core/message/data/MessageContextCatalog.js` を生成（実測: 1,071件、154.28KB < 250KB DoD達成、完全ASCII・言語非依存、三項演算子展開＆Cコードノイズ完全排除）。
- [x] **Step 5.2.3**: `src/core/message/MessageContextResolver.js` を実装（Map 完全一致 + プレフィックス + パターンマッチング、純粋シグナル同定）。
- [x] **Step 5.2.4**: `src/core/message/ContextFrameBuffer.js` を実装（リングバッファ構造による直前メッセージ履歴管理）。
- [x] **Step 5.2.5**: `MessageContextResolver.test.js` および `ContextFrameBuffer.test.js` を作成し、主要メッセージの同定速度（実測: 平均 0.002ms/件 << 0.1ms DoD達成）と抽出精度を検証。
- [x] **Step 5.2.6**: `WebUICore.js` に `MessageContextResolver` と `ContextFrameBuffer` を組み込み、`situationSignal` のディスパッチパイプラインを配線（翻訳責務を完全分離）。
- [x] **Step 5.2.7**: `npm test`（全85スイート・1,128テスト 100% PASS）および全4クライアントのビルドが 100% 通過することを確認（Zero-Regression Gate 達成）。

---

## 6. 完了判定基準 (DoD) 実績
1. ✅ **カタログサイズ**: 生成カタログサイズは **154.28 KB**（DoD 条件 < 250KB を大幅クリア、マルチバイト文字 0 の完全 ASCII、途中改行・C言語式 0 件）。
2. ✅ **照合レイテンシ**: 10,000回ベンチマークで平均 **0.002ms (2.0μs) / 件**（DoD 条件 < 0.1ms の 50倍高速）。
3. ✅ **一元ディスパッチ＆責務分離**: `situationSignal` (`{ type: 'MESSAGE', context }`) および `messageContext:${domain}` が WebUICore から正常にディスパッチされ、画面翻訳は `TranslationEngine`（`dictionary.csv`）が一元管理することで完全な関心の分離を達成。
4. ✅ **Zero-Regression**: 全85スイート・1,128テスト完全 PASS、Vue / React / Solid / Svelte 全4クライアントビルド完全 PASS。
