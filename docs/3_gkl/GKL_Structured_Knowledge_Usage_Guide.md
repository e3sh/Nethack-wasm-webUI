---
title: GKL Structured Knowledge データ参照・利用ガイド (Usage Guide)
status: implemented
last_updated: 2026-10-11
related_code:
  - src/core/knowledge/engines/StructuredKnowledgeEngine.js
  - src/core/knowledge/GKLPlugin.js
  - src/core/knowledge/presenters/ItemSpecPresenter.js
  - src/core/knowledge/engines/ItemIdentificationResolver.js
  - src/core/knowledge/services/OnDemandLookService.js
  - src/core/knowledge/services/OnDemandLookupService.js
  - src/core/knowledge/services/WasmDirectBindingService.js
---

# GKL Structured Knowledge データ参照・利用ガイド (Usage Guide)

## 1. はじめに (Overview)

GKL (Game Knowledge Layer) の **Structured Knowledge (構造化ナレッジ)** は、NetHack 内の「モンスター（全384体）」「アイテム（全481種）」「地形」に関する知識を標準化・構造化したデータモデルです。

処理層（WebUICore / GKL プラグイン / Prompt Payload Builder）および UI 層（Pure JS / Web Components `<nh-knowledge-card>` / `<nh-discovery-codex>` 等）から、一貫したシンプルな API で安全かつ高速にデータを取り出して利用できます。

---

## 2. 処理層からのアクセス方法 (Core & Processing Layer)

### 2.1 データ保持モデルの違いと設計理由
- **所持品・床落ち・コンテナ内アイテム (Item)**: 個別状態 (BUC, 未識別, 強化値, `isPile` 重なりフラグ) を持つため、`InventoryStateManager` 等での同期時に `item.knowledge` として**物理アタッチ・事前保持**されます。
- **敵 (Monster) ＆ 地形 (Terrain)**: Wasm Core から `glyphId` (数値) としてリアルタイム送信されるため、メモリ負荷を最小化する**オンデマンド検索 (`getKnowledge(glyphId)`)** 設計となっています。ただし、AI プロンプト (`SituationSnapshot`) や UI イベント時には自動的にアタッチ・生成されます。

---

### パターン 1: 万能統合アクセサ (`getKnowledge`) を使う
Glyph ID (0〜9622)、Onum (0〜480)、あるいはオブジェクトから直接ナレッジを取得します。内部で全領域 Glyph 統一判定 (`classifyGlyph`) が走るため、数値衝突が起きません。

```javascript
// WebUICore 経由での取得 (自動和訳 option 有効)
const knowledge = core.gkl.getKnowledge(glyphId, { translate: true });

// または GKLPlugin / StructuredKnowledgeEngine 直接呼び出し
const knowledge = gklPlugin.structuredKnowledge.getKnowledge(glyphId, { translate: true });
```

### パターン 2: 適応的プログレッシブ開示プレゼンター (`ItemSpecPresenter`) を使う
アイテムやモンスターから、現在の識別レベル（`Lv.0` 〜 `Lv.4`）や討伐・発見状況（`AdventureLogManager`）に応じた表示用スペック一式（`getAdaptiveItemSpecs` / `getAdaptiveMonsterSpecs`）を取得します。床アイテムが複数重なっている場合（`isPile: true`）は自動的に `📚 複数重なり (Pile)` バッジが付与されます。

```javascript
const item = core.gkl.inventoryStateManager.items[0];
const spec = core.gkl.itemSpecPresenter.present(item);
// または適応的開示スペック:
const adaptiveSpecs = core.gkl.itemSpecPresenter.getAdaptiveItemSpecs(item, knowledge, discoveryState);

console.log(spec.header);        // 例: "長剣 (long sword) +1"
console.log(spec.damageSmall);    // 例: "1d8+1"
console.log(spec.damageLarge);    // 例: "1d12+1"
console.log(spec.warning);        // 例: "⚠️ 未識別 (麻痺・毒・呪いのリスクあり)"
console.log(spec.effectSummary);  // 例: "標準的な片手剣。..."
```

### パターン 3: 5段階のアイテム識別レベル (`ItemIdentificationResolver`) を判定
`ItemIdentificationResolver` は、Phase 8 メモリ直結 (`objects[otyp].oc_name_known` / `obj.known` / `obj.bknown`) および発見台帳 (`DiscoveryStateManager`) から、以下の **5段階の識別レベル (`IDENTIFICATION_LEVELS`)** を厳密に判定します：
- `Lv.0 UNIDENTIFIED`（完全未識別：外見のみ判明）
- `Lv.1 BUC_KNOWN`（祭壇等で BUC のみ判明）
- `Lv.2 PRICE_NARROWED`（店舗価格により候補絞り込み済み）
- `Lv.3 TYPE_IDENTIFIED`（アイテムの正体 `otyp` 判明済み、強化値・回数は未知）
- `Lv.4 FULLY_IDENTIFIED`（正体・BUC・強化値/チャージ回数まで完全判明）

```javascript
import { IDENTIFICATION_LEVELS } from './core/knowledge/engines/ItemIdentificationResolver.js';

const idInfo = core.gkl.itemIdentificationResolver.resolveIdentificationLevel(item);
// idInfo.level: 0〜4, idInfo.status: 'UNIDENTIFIED' | 'BUC_KNOWN' | 'PRICE_NARROWED' | 'TYPE_IDENTIFIED' | 'FULLY_IDENTIFIED'

if (idInfo.level === IDENTIFICATION_LEVELS.UNIDENTIFIED) {
  console.log("完全未識別アイテムです。リスク警告を表示します。");
}
```

### パターン 4: オンデマンドセル調査 (`OnDemandLookService`) ＆ 動的図鑑検索 (`OnDemandLookupService`)
任意のマス (x, y) に対するセル調査（Phase 8 `CALL_SHIM` 0x20〜0x23 直結 ＋ `;` Look フォールバック）や、名前からの動的図鑑検索（`/` Whatis 統合）を実行します。

```javascript
// 1. マップ座標 (x, y) の調査
const lookResult = await core.gkl.onDemandLookService.lookAt(targetX, targetY);

// 2. エンティティ名・グリフからの動的図鑑検索 (Phase 7 OnDemandLookupService)
const cardPayload = await core.lookupEntityOnDemand({ query: 'cockatrice' });
```

### パターン 5: 統合状況 (`getSituation`) から魔法・耐性・スキルを参照
```javascript
const situation = core.getSituation();

// 1. 習得魔法リスト
situation.spells.forEach(spell => {
  console.log(`${spell.name} (Lv.${spell.level}) - 失敗率 ${spell.failRate}%`);
});

// 2. 属性耐性 (内在 + 装備合算)
if (situation.attributes.resistances.fire) {
  console.log("火炎耐性を保持中（Fireball自爆安全）");
}

// 3. 向上可能スキル
const upgradeableSkills = situation.skills.filter(s => s.canEnhance);
```

---

## 3. UI レンダリングでの利用パターン (UI Client Patterns)

### パターン A: ターゲットナレッジカードの描画 (HTML/DOM レンダリング)

```javascript
function renderKnowledgeCard(target) {
  const container = document.getElementById('knowledge-content');
  if (!target) {
    container.innerHTML = '<div class="empty">ホバーでナレッジ表示</div>';
    return;
  }

  // 1. アイテムオブジェクトの場合は ItemSpecPresenter で成形
  if (typeof target === 'object' && target.letter) {
    const spec = core.gkl.itemSpecPresenter.present(target);
    container.innerHTML = `
      <div class="card item-card">
        <h3>${spec.header}</h3>
        ${spec.damageSmall ? `<p>⚔️ 攻撃力: ${spec.damageSmall} (対大: ${spec.damageLarge})</p>` : ''}
        ${spec.ac !== undefined ? `<p>🛡️ 防御力: AC ${spec.ac}</p>` : ''}
        ${spec.warning ? `<p class="warning">${spec.warning}</p>` : ''}
        <p>${spec.effectSummary || ''}</p>
      </div>`;
    return;
  }

  // 2. モンスターまたは地形の場合は getKnowledge で取得
  const data = core.gkl.getKnowledge(target, { translate: true });
  if (!data) return;

  if (data.dangerLevel) {
    // モンスターカード描画
    container.innerHTML = `
      <div class="card monster-card">
        <h3>${data.name} <span class="badge ${data.dangerLevel}">${data.dangerLevel}</span></h3>
        <p>HD:${data.stats.hd} AC:${data.stats.ac} Spd:${data.stats.speed}</p>
        <p>${data.effectSummary}</p>
      </div>`;
  } else {
    // 地形カード描画
    container.innerHTML = `
      <div class="card terrain-card">
        <h3>${data.name}</h3>
        <p>${data.effectSummary || ''}</p>
      </div>`;
  }
}
```

### パターン B: ズームカメラ (Zoom Viewport 7x7) ホバー連動

プレイヤー周辺 7×7 マスのズームカメラ画面 (`zoom-canvas`) 上でマウスが動いた際、そのマスの最前面エンティティ (Top ➔ Middle ➔ Bottom) のナレッジをリアルタイム表示します。

```javascript
zoomCanvas.addEventListener('mousemove', (e) => {
  const rect = zoomCanvas.getBoundingClientRect();
  const tileX = Math.floor(((e.clientX - rect.left) * (zoomCanvas.width / rect.width)) / 32);
  const tileY = Math.floor(((e.clientY - rect.top) * (zoomCanvas.height / rect.height)) / 32);

  // カメラ中心 (3, 3) からの相対座標オフセット
  const gx = playerX + (tileX - 3);
  const gy = playerY + (tileY - 3);

  // AreaStateManager の 4 階層セルからターゲットを取得（Top ➔ Middle ➔ Bottom ➔ Effect）
  const cell = core.gkl.areaStateManager.grid[gy]?.[gx];
  const target = cell?.top || cell?.middle || cell?.bottom || cell?.effect;

  renderKnowledgeCard(target ? target.glyph : null);
});
```

### パターン C: IconInventory スロットでのツールチップ ＆ ワンタップ操作

所持品アイコンにマウスを乗せた時、スペックカードを即時表示し、クリックで推奨操作を実行します。

```javascript
items.forEach(item => {
  const slot = document.getElementById(`slot-${item.letter}`);
  
  // ホバー時：ナレッジカードとツールチップの更新
  slot.onmouseenter = () => {
    renderKnowledgeCard(item);
    showTooltip(item.rawText);
  };
  
  // クリック時：ワンタップ推奨操作 (例: 装備/使用/解錠) の発火
  slot.onclick = () => {
    core.executeSequence(item.defaultSequence || [item.letter]);
  };
});
```

---

## 4. まとめ

Structured Knowledge は、複雑な NetHack の内部パラメータを整理し、**「`getKnowledge` や `ItemSpecPresenter`、`getSituation` を呼ぶだけ」** で、直ちに UI レンダリングや AI 推論に活用できるクリーン設計となっています。
