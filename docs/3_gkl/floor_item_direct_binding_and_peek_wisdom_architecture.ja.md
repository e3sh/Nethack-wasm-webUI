# WASMメモリ直結(shim)による床アイテムナレッジ解決と賢者の知恵Peek再開計画書

## 1. 概要と背景

### 1.1 発生していた現象と課題
1. **床落ちアイテムのネタバレ防止時の断絶**:
   - NetHack では通常、未鑑定のアイテム（薬・巻物・杖・指輪・魔除け・未識別防具等）は外見名（例: `赤紫色の薬` / `purple-red potion`）で表示されるべきである。
   - 以前の実装では、マップセル上の床アイテム（`cell.middle`）の描画グリフ番号からアイテムマスターを直接引いてしまっていたため、未鑑定であるにもかかわらず床に落ちているだけで真名（例: `超回復のポーション`）が露出するネタバレ不具合が発生していた。
   - これを防止するために未鑑定マスク（`getUnidentifiedItemKnowledge`）を導入したが、中間ナレッジオブジェクトからアイテム本来の種別番号（`onum`）が脱落。
   - その結果、「🧙 正体を見る (Reveal)」ボタンをクリックまたは `w` キーを押して Peek 状態にしても、外見名文字列（`赤紫色の薬`）しか手元に残っておらず、フォールバックによって `赤紫色の薬 [赤紫色の薬]`（英語では `red potion [red potion]`）という本末転倒な表示となっていた。

2. **既存のWASM shim基盤との断絶**:
   - 実際には、WASM CコアとJavaScriptを直結する `WasmDirectBindingService` に、C言語の `level.objects[x][y]`（床アイテムの `struct obj` リンクリスト）から直接メモリをダンプする shim API（`SHIM_CMD.GET_OBJECT_AT` / `SHIM_CMD.DUMP_OBJECT_INFO`）が既に実装されていた。
   - モンスター（`cell.top`）側には `directBindingService.getFullMonsterAt(x, y)` によるメモリ直結結合が行われていたが、床アイテム（`cell.middle`）側にはこの shim 経由の `struct obj` 結合が配線されていなかった。

3. **現時点での暫定処置（一時的オミット）**:
   - 動作が不完全な「正体を見る (Reveal)」ボタンおよび `w` キー透視操作は、UIから一時的に非表示（オミット）とし、床落ち・所持品ともに勝手なネタバレが起きない安全な未鑑定表示を維持している。

---

## 2. アーキテクチャ設計：WASM Shim による床アイテム直接解決

```
[NetHack C Core Memory]
  └─ level.objects[x][y] (C言語 struct obj リンクリスト)
       │
       ▼ (WasmDirectBindingService: SHIM_CMD.GET_OBJECT_AT / DUMP_OBJECT_INFO)
[Direct Object Data]
  ├─ otyp (C言語のアイテム種別番号 0〜480 = onum: Single Source of Truth)
  ├─ spe  (強化値 / チャージ数)
  ├─ owt  (重量)
  ├─ quan (個数)
  ├─ flags (blessed, cursed, bknown, dknown, rknown)
  └─ o_id (固有オブジェクトID)
       │
       ▼
[AreaStateManager (cell.middle)]
  └─ directObject / objects: [ { otyp, spe, flags, rawObjPtr, ... } ]
       │
       ▼ (GKLPlugin: getKnowledgeAt)
[StructuredKnowledgeEngine]
  ├─ 通常時:
  │   - dknown または ディスカバリー既知なら真名表示
  │   - 未鑑定なら外見名 (赤紫色の薬) で安全にマスク (ネタバレ防止)
  │
  └─ 賢者の知恵 (Peek時 / sagesWisdomMode: true):
      - obj.otyp (= onum) から真のマスターデータを直撃取得！
      - 表示: "赤紫色の薬 [超回復のポーション]"
      - スペック: 真の重量・材質・BUC効果・適応スペックを100%完全開示！
```

---

## 3. 賢者の知恵Peek再開の実装ステップ (Task List)

### Step 1: `AreaStateManager.js` への床アイテム直結バインド配線
- **対象**: `src/core/knowledge/state/AreaStateManager.js`
- **内容**:
  1. `updateCell(x, y, glyphId, glyphInfo)` の `ENTITY_TYPES.ITEM` 分岐内において、`this.directBindingService` が有効な場合、`this.directBindingService.getObjectsAt(x, y)` を呼び出す。
  2. 取得した床アイテム配列（先頭の `obj` または複数スタック）を `cell.middle.directObject` および `cell.middle.floorObjects` として保持する。
  3. `cell.middle.onum = directObject.otyp` を明示的に設定し、グリフ推測に頼らない確実な `onum` を確立する。
  4. `syncFromDirectBinding()` 内でも、各セルの `cell.middle` に対する `getObjectsAt(x, y)` 同期処理を追加する。

### Step 2: `GKLPlugin.js` でのナレッジ解決への直接伝播
- **対象**: `src/core/knowledge/GKLPlugin.js`
- **内容**:
  1. `getKnowledgeAt(pos, options)` の非モンスター分岐（2360行付近）において、`cell.middle` が存在する場合：
     - `cell.middle.directObject` が未設定であれば、`await this.wasmDirectBindingService.fetchObjectsAt(x, y)` により取得・補完する。
     - `targetEntity` に `directObject`（`otyp`, `spe`, `flags`, `onum`）を含めて `structuredKnowledge.getKnowledge` に渡す。

### Step 3: `StructuredKnowledgeEngine.js` での真名・スペック合成
- **対象**: `src/core/knowledge/engines/StructuredKnowledgeEngine.js`
- **内容**:
  1. `getItemKnowledge(identifier, options)` において、`identifier.directObject` または `identifier.onum` / `identifier.subType` から `targetOnum` を確定。
  2. `isWisdomMode` (sagesWisdomMode: true) 時：
     - `OBJECT_KNOWLEDGE_MAP.get(targetOnum)` から真名（`name`, `nameJa`）、効果要約（`effectSummary`, `effectSummaryJa`）、BUC効果（`bucEffects`）、スペック（`material`, `weight`, `stats`）を取得。
     - 外見名（`appearanceName`）を保持したまま、真名プロパティ（`wisdomTrueName`, `wisdomTrueNameJa`, `trueName`）をマージして返却。

### Step 4: UIコンポーネントの「正体を見る (Reveal)」ボタン再有効化
- **対象**:
  - `examples/gkl-pure-js-client/modules/components/KnowledgeDetailModal.js`
  - `src/components/NhKnowledgeCard.js`
- **内容**:
  1. `KnowledgeDetailModal.js`:
     - ヘッダー右側の `#btn-modal-peek-wisdom` ボタンの描画を再有効化。
     - `_boundKeyDown` 内の `w` / `W` キーハンドラを再有効化。
     - 未鑑定アイテム注釈ボックス内の Peek ガイダンス文を再有効化。
  2. `NhKnowledgeCard.js`:
     - ヘッダーの `#peekWisdomBtn` ボタンの描画を再有効化。
     - フッターガイドの `w` 透視ヒントを再有効化。
     - `_handleKeyDown` 内の `w` キーハンドラおよびクリックイベントを再有効化。

### Step 5: テストの更新と検証
- **対象**:
  - `tests/components/NhKnowledgeCard.test.js`
  - `tests/ui/KnowledgeDetailModal.test.js`
- **内容**:
  1. `NhKnowledgeCard.test.js` の `it.skip`（`未鑑定アイテム表示中にオンデマンド透視ボタン（peekWisdomBtn / wキー）で一時的に正体を透視・再マスクできること`）を `it` に復帰。
  2. `KnowledgeDetailModal.test.js` に床落ちアイテム（`cell.middle` 由来、`directObject` 保持）での Peek 透視テストケースを追加。
  3. `npx vitest run` を実行し、全テストのパスを確認。

---

## 4. この設計により得られるメリット
1. **完全な Single Source of Truth (SSOT)**:
   - マップ上の床アイテム情報は NetHack Cコアの `level.objects` メモリポインタから直接得られるため、テキストや外見名の逆引き推測による誤判定や不整合がゼロになる。
2. **ネタバレ防止と Peek 透視の両立**:
   - 通常時は `dknown` / ディスカバリー状態に基づき、厳密に外見名（例: `赤紫色の薬`）で保護。
   - プレイヤーが「正体を見る」を押した時のみ、確実に `赤紫色の薬 [超回復のポーション]`、重量、材質、BUC効果が100%正確に開示される。
3. **スタックアイテムやコンテナ内部への拡張性**:
   - `getObjectsAt(x, y)` は複数アイテムのスタックリンクリストを走査可能なため、床に複数のアイテムが重なっている場合やコンテナ（箱・袋）が落ちている場合にも同一の shim パイプラインで自然に拡張可能となる。

---

## 5. ナレッジの分散防止と監査容易性 (Auditability) の設計指針

### 5.1 現状見られるナレッジ分散の課題（アンチパターン）
1. **UI層へのナレッジ解決ロジックの染み出し**:
   - `KnowledgeDetailModal.js` や `NhKnowledgeCard.js`（Web Component）が、自前で `OBJECT_KNOWLEDGE_MAP` や `getOnumFromGlyph`、各種フォールバック処理を呼び出して真名やスペックを合成・マージしようとしていた。
   - このような「UI側での場当たり的なデータ補正」を行うと、「どの層が真名を決定しているのか」「未鑑定マスクはどこで保証されるのか」がUIコンポーネントとコアエンジンに分散し、修正箇所が追跡不能になる。
2. **ナレッジ整合性監査 (`KnowledgeIntegrityAudit`) との乖離**:
   - GKLにはナレッジデータ構造とスキーマの正規性を担保する静的監査テスト（`KnowledgeIntegrityAudit.test.js`）が存在するが、UI側が独自にロジックを持つと、エンジン側の監査をパスしていてもUI側で不整合やバグ（`red potion [red potion]` 等）が生じる原因となる。

### 5.2 アーキテクチャの是正方針（Single Source of Truth の徹底）
1. **UI層（モーダル / Web Component）の完全な「View特化」への純化**:
   - `KnowledgeDetailModal` および `<nh-knowledge-card>` は、**自前で `OBJECT_KNOWLEDGE_MAP` を直接参照したり、真名・スペックの推測合成を行ってはならない**。
   - UI層の責務は「`core.gkl.getKnowledge(target, { sagesWisdomMode })` から返却された解決済みナレッジオブジェクトをそのまま受け取り、HTML/CSSとして描画すること」に厳格に限定する。
2. **`StructuredKnowledgeEngine` への解決パイプラインの一元集約**:
   - 未鑑定アイテムのマスク処理、および賢者の知恵（Peek）時の真名・真スペック・BUC効果の開示処理は、すべて **`StructuredKnowledgeEngine.js`（および `ItemIdentificationResolver.js`）の内部で完結** させる。
   - Peekボタンや `w` キーが押された際、UI側は単に `engine.getKnowledge(target, { sagesWisdomMode: true })` を要求して再描画するだけとする。
3. **ナレッジ監査スイート（`KnowledgeIntegrityAudit`）による完全検証可能性の確保**:
   - ナレッジの生成・マスク・Peek開示の全ロジックが `StructuredKnowledgeEngine` に集約されていれば、DOMやUIを介さずとも `KnowledgeIntegrityAudit` に「全アイテムの未鑑定マスク監査」および「賢者の知恵Peek開示監査」を追加するだけで、100%自動で整合性を保証できるようになる。

