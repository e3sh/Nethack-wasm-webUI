---
title: gkl_enhancement_summary
status: archived
last_updated: 2026-08-15
related_code:
  - src/gkl/
---

# GKL (Game Knowledge Layer) 高度化＆実装変更点 まとめ資料

本ドキュメントは、NetHack WebUI Core に組み込まれている Game Knowledge Layer (GKL) のリファクタリング、装備状態パース、アイテム最適デフォルトアクション自動判定、指輪左右自動選択、およびフォールバック安全設計の全容を記録した最新の技術仕様書です。

---

## 1. 全体概要と達成成果

本セッションを通じて、GKL のモジュール設計・保守性の向上から、ローグライク特有の「複雑な装備状態」「カテゴリ別の多様な操作体系」に対するインテリジェントな自動化まで、多角的な高度化を達成しました。

```
 [ UI Layer / Custom Buttons / AI Agent / Debug Inspector ]
                        │
                        │  core.getSituation() / core.executeSequence(seq)
                        ▼
 ┌──────────────────────────────────────────────────────────┐
 │ 🧠 Game Knowledge Layer (GKL)                            │
 │                                                          │
 │  1. 状況統合・キャッシュアクセサ                         │
 │     - SituationCache                                     │
 │       (ステータス・マップ・所持品・装備・推奨アクション)  │
 │                                                          │
 │  2. 推奨アクション自動生成エンジン                       │
 │     - ContextActionEngine                                │
 │       (周辺環境と所持ツールから最適コマンド群を推論)       │
 │                                                          │
 │  3. エリア・ダンジョンマップ状態マネージャー              │
 │     - AreaStateManager                                   │
 │       (80x21グリッドを3階層[地形/アイテム/モンスター]管理)│
 │                                                          │
 │  4. インベントリ（所持品）状態マネージャー                │
 │     - InventoryStateManager                              │
 │       (装備状態・アイテム最適推奨アクションを動的パース)  │
 │                                                          │
 │  5. グリフ・エンティティ分類ユーティリティ              │
 │     - glyphClassifier                                    │
 │       (NetHack 5.0/3.7 の Glyph ID を意味カテゴリに分類)  │
 │                                                          │
 │  6. シーケンス自走実行・状態制御コントローラー            │
 │     - RequestController                                  │
 │       (トークン配列の自動消化・手動割り込み・復帰制御)       │
 └────────────────────────────┬─────────────────────────────┘
                              │ queueSequence / querySequenceSilent
                              ▼
 ┌──────────────────────────────────────────────────────────┐
 │ ⚙️ WebUI Core & NetHack WASM Core                         │
 └──────────────────────────────────────────────────────────┘
```

---

## 2. 実施した主な改修と高度化仕様

### (1) `ContextActionEngine.js` のモジュール構造リファクタリング
- **目的**: `generateActions()` 内の 200 行超の直列処理を解体し、保守性・再利用性を向上。
- **構成**:
  - `extractTools()`: インベントリからの道具抽出の一元化
  - `buildFeetActions()`: 足元アイテム・階段・祭壇・泉・シンク・罠・玉座・床の判定
  - `buildMonsterActions()`: ペット誤爆防止・近接攻撃・会話・店主支払いの判定
  - `buildAdjacentEntityActions()`: 扉・壁・樹木・水場/溶岩・鉄格子・隣接罠の判定

---

### (2) GKL 装備状態管理機能 (Equipment State Tracking)
NetHack Cコアのテキスト表現（`(weapon in hand)`, `(in off hand)`, `(in quiver)`, `(being worn)`, `(on left hand)` 等）を自動解析し、多角的な装備スロット情報を保持・提供する機能を構築しました。

- **パースされる状態フラグ**:
  - `isWielded` (メイン武器)
  - `isOffhand` (二刀流副武器)
  - `isQuivered` (矢筒内の弾薬)
  - `isWorn` (着用中の防具・指輪・お守り)
  - `equipSlot` (`weapon`, `offhand`, `quiver`, `ring_left`, `ring_right`, `amulet`, `shield`, `worn`)
- **拡張クエリ API**:
  - `getWieldedWeapon()`, `getOffhandWeapon()`, `isTwoWeaponing()`, `getQuiveredItem()`, `getEquippedItems()`, `getEquipmentMap()`
- **統合アクセス**:
  - `SituationCache.getSituation().equipment` として最新の装備状態を一括取得可能。

---

### (3) アイテム最適デフォルト推奨アクション (Item Default Actions) 自動判定
タッチUI等のワンタップ操作向けに、アイテムのカテゴリおよび装備状態に応じた推奨操作キー (`defaultVerb`, `defaultSequence`, `defaultActionLabelJa`) を自動判定します。

#### カテゴリ＆状態連動の推論ルール
| アイテムカテゴリ / 状態 | 判定対象 | `defaultVerb` | `defaultSequence` | アクション名 (`defaultActionLabelJa`) |
|---|---|---|---|---|
| **ポーション (Potion)** | 未識別色名・薬 | `'q'` | `['q', letter]` | 飲む (q) |
| **食品 (Food)** | 食料・死体・缶詰・果物 | `'e'` | `['e', letter]` | 食べる (e) |
| **巻物 (Scroll)** | 巻物・未識別ラベル | `'r'` | `['r', letter]` | 読む (r) |
| **呪文書 (Spellbook)** | 呪文書・魔法書 | `'r'` | `['r', letter]` | 勉強する (r) |
| **杖 (Wand)** | 杖・未識別材質名 | `'z'` | `['z', letter]` | 振る (z) |
| **道具 (Tool)** | タオル, 缶詰キット, 鍵, ツルハシ, 笛, 鏡等 | `'a'` | `['a', letter]` | 使う (a) |
| **未着用防具** | 鎧, 兜, 靴, 手袋, 盾等 | `'W'` | `['W', letter]` | 着用する (W) |
| **着用中防具** | 防具類 (着用中) | `'T'` | `['T', letter]` | 脱ぐ (T) |
| **未装着指輪** | 指輪 (未装着) | `'P'` | `['P', letter, 'l'/'r']` | はめる (P:左手/右手) |
| **装着中指輪** | 指輪 (装着中) | `'R'` | `['R', letter]` | 外す (R) |
| **未装備武器** | 武器類 (未装備) | `'w'` | `['w', letter]` | 手に持つ (w) |
| **装備中武器** | 武器類 (装備中) | `'w'` | `['w', '-']` | 手放す (w-) |

#### 特筆すべき安全・補完ロジック
1. **指輪の左右手（Left/Right Finger）自動決定**:
   - `ring_left` と `ring_right` の空き状況をリアルタイムに評価し、`Which finger? [l or r]` プロンプトを自動突破する `['P', letter, 'l']` または `['P', letter, 'r']` を自動送出。
2. **判定不能・変名アイテムの安全フォールバック**:
   - 未知の変名アイテム（`OTHER` カテゴリ）に対して、単にレター `b` だけを送信すると通常画面で「南西へ移動」コマンドとして誤暴発するリスクを回避するため、**`['i', letter]`（インベントリ表示 `i` を前置）** を送信して、安全にゲーム本来の通常選択メニューを表示させる仕様を採用。

---

### (4) クライアント UI (`examples/gkl-pure-js-client`) での実装成果

1. **装備状態の視覚的ハイライト**:
   - メイン武器: **黄金ゴールド枠** + `[手]` バッジ
   - 副武器 (二刀流): **シアンブルー枠** + `[副]` バッジ
   - 矢筒: **エメラルドグリーン枠** + `[筒]` バッジ
   - 着用具: **ロイヤルパープル枠** + `[着]` バッジ
2. **ワンタップ自走送信 & ツールチップガイド**:
   - タップ時に `item.defaultSequence` が即座に自走送信。
   - ツールチップに `ワンタップ: 飲む(q)` などのガイドを出力。
3. **操作完了後の自動サイレント・インベントリ同期**:
   - ワンタップ操作後 `300ms` 遅延して `syncInventorySilent()` がバックグラウンドで走ることで、消費されたアイテムの自動消滅や、装備ハイライト枠の点灯/消灯切り替えがリアルタイムで反映。

---

### (5) テスト品質の保証
- **Node.js Native Test (`knowledge.test.js`)**: **13 サブテスト全件 OK**（プロセスハング問題も `core.destroy()` で解決）。
- **Vitest Suite (`npx vitest run`)**: **10 ファイル 31 テスト全件 PASS**。
