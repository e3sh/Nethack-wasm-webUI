# GKL (Game Knowledge Layer) 構造化ナレッジ機能 仕様・活用ガイド

## 1. 概要 (Overview)

GKL (Game Knowledge Layer) 構造化ナレッジ機能は、NetHack の膨大なゲームデータ（全 481 種類のアイテム、2,000 種類以上のモンスター、ダンジョン地形）を構造化し、AI エージェントプロンプトおよび人間プレイヤー用 UI クライアントへリアルタイムで提供する WebUI コア知識基盤です。

単なる文字列データにとどまらず、アイテムのダイス攻撃力(d値)、防御力(AC)、素材、手持ち数、未識別時のテストコツ、BUC(祝福/通常/呪い)効果、モンスターの危険度(Danger Level)、戦術アドバイスを構造化オブジェクトとしてカプセル化しています。

---

## 2. アーキテクチャと全領域 Glyph 統一検索 (Unified Glyph Search)

### 2.1 データ検索エンジン (`StructuredKnowledgeEngine.js`)
GKL の中核を担う `StructuredKnowledgeEngine` は、万能統合アクセサ `getKnowledge(identifier, options)` を提供します。

NetHack において、モンスターの `glyphId` (0〜382等) とアイテムの `onum` (0〜480) は数値範囲が重なるため、数値判定で誤検索を起こさないよう **全領域 Glyph 統一検索 (`classifyGlyph`)** を完全導入しています。

```
                    [ 検索リクエスト (glyphId / onum / 名前) ]
                                      │
                         classifyGlyph(identifier)
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
  ENTITY_TYPES.MONSTER         ENTITY_TYPES.ITEM            ENTITY_TYPES.TERRAIN
   (getMonsterKnowledge)       (getItemKnowledge)           (getTerrainKnowledge)
         │                            │                            │
         └────────────────────────────┼────────────────────────────┘
                                      ▼
                        [ 構造化ナレッジオブジェクト ]
                                      │
                         TranslationEngine (nhMessage)
                                      ▼
                    [ 日本語リアルタイム対訳変換データ ]
```

### 2.2 データソースとカバレッジ
- **`OBJECT_KNOWLEDGE_FULL.js`**: NetHack 5.0 / 3.7 の全 481 アイテム (`onum`: 0 〜 480) を 100% 完全マッピング。
- **`glyphClassifier.js`**: `GLYPH_OBJ_OFF` (3448) オフセット等を利用し、NetHack の全 9,623 個の Glyph ID (0 〜 9622) を即座にエンティティ種別 (`MONSTER`, `ITEM`, `TERRAIN`) に分類。

---

## 3. 対訳辞書管理ワークフロー (Standard CSV Dictionary Workflow)

アイテム解説やフレーバーテキストの日本語対訳は、プロジェクト標準の全自動 Python ツールチェーンにより完全に管理されています。

```
 [ docs/5_gamedata/item_knowledge_dictionary.csv ] (標準 CSV 対訳辞書)
                         │
         python tools/merge_knowledge_dictionary.py
                         ▼
                 [ dictionary.csv ] (マスター辞書)
                         │
          python tools/dict_converter.py import dictionary.csv
                         ▼
               [ param/nhMessage.js ] (ブラウザ用 JavaScript 辞書)
```

### 3.1 辞書確認ツール
`tools/knowledge-inspector.html` をブラウザで開くことで、辞書データが流し込まれた状態をビジュアルに閲覧・検証可能です。

---

## 4. UI クライアント連携仕様 (Client Integration)

### 4.1 所持品アイテムへの `item.knowledge` 物理アタッチ
`GKLPlugin` 経由で `InventoryStateManager` および `PromptPayloadBuilder` へ構造化ナレッジエンジンがアタッチされます。
パースされた全所持品アイテムオブジェクトには `item.knowledge` プロパティが物理添付され、DevTool Inspector やクライアント UI から即座に参照可能です。

### 4.2 ズームカメラ (Zoom Viewport) 連携
拡大ズームカメラ (`zoom-canvas`) 内の 7×7 マス (32×32px) ホバー時、以下の優先順位で安全にエンティティが取得・描画されます：
1. **Top 層**: モンスターナレッジ (HD, AC, Speed, 魔抗, 死体警告, 戦術アドバイス)
2. **Middle 層**: アイテムナレッジ (⚔️攻撃力 d値, 🛡️AC, 素材, 未識別ヒント)
3. **Bottom 層**: 地形ナレッジ (階段, 扉, 壁, 床ガイド)

---

## 5. 自動検証とテストスイート

- **全 Glyph ID ストレストライアルテスト**: `src/core/knowledge/AllGlyphsVerification.test.js`
  - 0 〜 9622 までの全 9,623 個の Glyph ID に対し、例外やエラーが発生しないことを Vitest 単体テストで証明済み (34/34 PASS)。
