---
title: GKL 構造化ナレッジ機能 基盤・データ仕様書
status: active
last_updated: 2026-08-21
related_code:
  - src/core/knowledge/StructuredKnowledgeEngine.js
  - src/core/knowledge/glyphClassifier.js
  - src/core/knowledge/OBJECT_KNOWLEDGE_FULL.js
  - src/core/knowledge/OBJECT_KNOWLEDGE_BASE.js
  - src/core/knowledge/MONSTER_KNOWLEDGE_FULL.js
  - src/core/knowledge/ItemIdentificationResolver.js
  - src/core/knowledge/ItemSpecPresenter.js
  - src/core/knowledge/OnDemandLookService.js
---

# GKL (Game Knowledge Layer) 構造化ナレッジ機能 基盤・データ仕様書

## 1. 概要 (Overview)

GKL 構造化ナレッジ機能は、NetHack の全ゲームデータ（全 481 種類のアイテム、2,000 体以上のモンスター、全ダンジョン地形）を構造化し、高速なリアルタイム検索、識別状態判定、および UI/AI 向けフォーマット整形を提供する基盤エンジンです。

---

## 2. アーキテクチャと全領域 Glyph 統一検索 (Unified Glyph Search)

### 2.1 データ検索エンジン (`StructuredKnowledgeEngine.js`)
`StructuredKnowledgeEngine` は、万能統合アクセサ `getKnowledge(identifier, options)` を提供します。

NetHack では、モンスターの `glyphId` (0〜382等) とアイテムの `onum` (0〜480) は数値範囲が重なるため、数値判定での誤検索を防ぐ **全領域 Glyph 統一判定 (`classifyGlyph`)** を導入しています。

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

### 2.2 静的データソース構成
- **`OBJECT_KNOWLEDGE_FULL.js` / `OBJECT_KNOWLEDGE_BASE.js`**:
  - NetHack 5.0 / 3.7 の全 481 アイテム (`onum`: 0 〜 480) を 100% 完全マッピング。
  - ダイス攻撃力 (d値)、AC、素材、推奨操作動詞 (`defaultVerb`)、武器種別 (`skill`)、両手持ち (`hands`)、BUC効果などを網羅。
- **`MONSTER_KNOWLEDGE_FULL.js`**:
  - モンスターの HD、AC、速度、魔抗、死体危険性警告、属性耐性、戦術アドバイスを網羅。
- **`glyphClassifier.js`**:
  - `GLYPH_OBJ_OFF` (3448) オフセット等を利用し、全 9,623 個の Glyph ID (0 〜 9622) を即座にエンティティ種別 (`MONSTER`, `ITEM`, `TERRAIN`) に分類。

---

## 3. 識別判定・スペック整形・調査基盤 (Resolvers & Services)

### 3.1 アイテム鑑定判定エンジン (`ItemIdentificationResolver.js`)
ゲーム内の発見台帳 (`DiscoveryStateManager`) と連携し、アイテムの鑑定状態を 3 段階で厳密に判定します：
1. **`FULLY_IDENTIFIED`**: 正式名が判明している（例: `"long sword"`, `"potion of healing"`）。
2. **`PRICE_IDENTIFIED`**: 店の売買価格等により候補が絞り込まれた状態。
3. **`UNIDENTIFIED`**: 未識別（外見名のみ判明、例: `"ruby ring"`, `"clear potion"`）。

### 3.2 UIスペック整形プレゼンター (`ItemSpecPresenter.js`)
アイテムオブジェクト、ナレッジ、識別状態を総合し、UI 表示用のフォーマット済みデータ（表示名、攻撃力d値、AC、特効ボーナス、未識別リスク警告等）を生成します。

### 3.3 オンデマンド Look サービス (`OnDemandLookService.js`)
任意の座標に対して `;` (Look) コマンドをバックグラウンドでサイレント発行し、画面外や未知タイルの詳細テキスト・シンボルをリアルタイムに獲得します。

---

## 4. 対訳辞書管理ワークフロー (Standard CSV Dictionary Workflow)

アイテム解説やフレーバーテキストの日本語対訳は、自動化 Python ツールチェーンにより完全に管理されています。

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

### 4.1 辞書確認ツール
`tools/knowledge-inspector.html` をブラウザで開くことで、辞書データが流し込まれた状態をビジュアルに閲覧・検証可能です。

---

## 5. 自動検証とテストスイート

- **全 Glyph ID ストレストライアルテスト**: `src/core/knowledge/AllGlyphsVerification.test.js`
  - 0 〜 9622 までの全 9,623 個の Glyph ID に対し、例外やエラーが発生しないことを Vitest 単体テストで証明済み。
- **全体テストカバレッジ**: 全 26 テストファイル / 170 テストケース 100% PASS。
