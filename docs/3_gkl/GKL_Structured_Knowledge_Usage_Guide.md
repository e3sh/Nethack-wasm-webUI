---
title: GKL Structured Knowledge データ参照・利用ガイド (Usage Guide)
status: active
last_updated: 2026-08-21
related_code:
  - src/core/knowledge/StructuredKnowledgeEngine.js
  - src/core/knowledge/GKLPlugin.js
  - src/core/knowledge/ItemSpecPresenter.js
  - src/core/knowledge/ItemIdentificationResolver.js
  - src/core/knowledge/OnDemandLookService.js
---

# GKL Structured Knowledge データ参照・利用ガイド (Usage Guide)

## 1. はじめに (Overview)

GKL (Game Knowledge Layer) の **Structured Knowledge (構造化ナレッジ)** は、NetHack 内の「モンスター」「アイテム」「地形」に関する知識を標準化・構造化したデータモデルです。

処理層（WebUICore / GKL プラグイン / Prompt Payload Builder）および UI 層（Pure JS / DOM Grid / React / Vue 等のクライアント）から、一貫したシンプルな API で安全かつ高速にデータを取り出して利用できます。

---

## 2. 処理層からのアクセス方法 (Core & Processing Layer)

### 2.1 データ保持モデルの違いと設計理由
- **所持品アイテム (Item)**: 個別状態 (BUC, 未識別, 強化値) を持つため、`InventoryStateManager` パース時に `item.knowledge` として**物理アタッチ・事前保持**されます。
- **敵 (Monster) ＆ 地形 (Terrain)**: Wasm Core から `glyphId` (数値) としてリアルタイムストリーミング送信されるため、メモリ負荷を最小化する**オンデマンド検索 (`getKnowledge(glyphId)`)** 設計となっています。ただし、AI プロンプト (`SituationSnapshot`) や UI イベント時には自動的にアタッチ・生成されます。

---

### パターン 1: 万能統合アクセサ (`getKnowledge`) を使う
Glyph ID (0〜9622)、Onum (0〜480)、あるいはオブジェクトから直接ナレッジを取得します。内部で全領域 Glyph 統一判定 (`classifyGlyph`) が走るため、数値衝突が起きません。

```javascript
// WebUICore 経由での取得 (自動和訳 option 有効)
const knowledge = core.gkl.getKnowledge(glyphId, { translate: true });

// または GKLPlugin / StructuredKnowledgeEngine 直接呼び出し
const knowledge = gklPlugin.structuredKnowledge.getKnowledge(glyphId, { translate: true });
```

### パターン 2: UIスペック整形プレゼンター (`ItemSpecPresenter`) を使う
アイテムオブジェクトから、鑑定状態や強化値を考慮した表示用スペック一式（ヘッダー、d値、AC、特効、警告文）を 1 呼び出しで取得します。

```javascript
const item = core.gkl.inventoryStateManager.items[0];
const spec = core.gkl.itemSpecPresenter.present(item);

console.log(spec.header);        // 例: "長剣 (long sword) +1"
console.log(spec.damageSmall);    // 例: "1d8+1"
console.log(spec.damageLarge);    // 例: "1d12+1"
console.log(spec.warning);        // 例: "⚠️ 未識別 (麻痺・毒・呪いのリスクあり)"
console.log(spec.effectSummary);  // 例: "標準的な片手剣。..."
```

### パターン 3: アイテムの識別状態 (`ItemIdentificationResolver`) を直接判定
```javascript
import { ItemIdentificationResolver } from './core/knowledge/ItemIdentificationResolver.js';

const status = core.gkl.itemIdentificationResolver.resolveStatus(item);
// 返り値: 'FULLY_IDENTIFIED' | 'PRICE_IDENTIFIED' | 'UNIDENTIFIED'

if (status === 'UNIDENTIFIED') {
  console.log("未識別アイテムです。リスク警告を表示します。");
}
```

### パターン 4: オンデマンド Look 調査 (`OnDemandLookService`) を使う
任意のマス (x, y) に対して Look (`;`) コマンドをサイレント実行し、詳細テキストを非同期に取得します。

```javascript
const lookResult = await core.gkl.onDemandLookService.lookAt(targetX, targetY);
console.log("調査結果テキスト:", lookResult.text);
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

  // AreaStateManager の 3 階層セルからターゲットを取得
  const cell = core.gkl.areaStateManager.grid[gy]?.[gx];
  const target = cell?.top || cell?.middle || cell?.bottom;

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
