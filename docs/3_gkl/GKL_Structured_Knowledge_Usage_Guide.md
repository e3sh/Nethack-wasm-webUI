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

### パターン 2: 所持品アイテムから物理アタッチデータ (`item.knowledge`) を直接使う
`InventoryStateManager` によってパースされた全所持品アイテムには、あらかじめ `item.knowledge` が添付されています。

```javascript
// 所持品一覧 (items) から直接参照
const item = core.gkl.inventoryStateManager.items[0];

console.log(item.knowledge.name);            // 例: "silver arrow" (銀の矢)
console.log(item.knowledge.stats.sdam);      // 例: "1d6+1" (小型攻撃力)
console.log(item.knowledge.unidentifiedTips);// 例: ["銀は触れるだけで邪悪な存在を焼き灼く..."]
```

### パターン 3: AI プロンプトペイロード (`PromptPayloadBuilder`) で使う
SituationSnapshot 生成時、プレイヤーの周辺状況 (`surroundings`) や所持品アイテムにナレッジが自動的に統合されます。

周囲にいる敵（モンスター）や地形（階段・罠・扉など）に対しても、**プロンプト用ペイロードおよびUI描画の両方で 100% 自動的にナレッジが付加** されます。

```javascript
const snapshot = promptPayloadBuilder.buildSnapshot();

// 1. 周囲の敵 (モンスター) のナレッジ参照
const enemy = snapshot.surroundings.find(e => e.type === 'MONSTER');
console.log(enemy.knowledge.dangerLevel);   // 例: "LOW"
console.log(enemy.knowledge.tacticalAdvice);// 例: ["距離を保って矢で攻撃しましょう"]

// 2. 周囲の地形 (階段・扉等) のナレッジ参照
const stairs = snapshot.surroundings.find(e => e.category === 'STAIRS');
console.log(stairs.knowledge.effectSummary); // 例: "'>' キーを押すことで、より深い階層へ移動します"
```

---

## 3. ナレッジデータの構造モデル (Data Schema)

`getKnowledge()` または `item.knowledge` から返されるデータオブジェクトの構造です。

### 3.1 モンスターナレッジ (`ENTITY_TYPES.MONSTER`)
```json
{
  "name": "kobold (コボルド)",
  "category": "MONSTER",
  "dangerLevel": "LOW",
  "stats": {
    "hd": 1,
    "ac": 10,
    "speed": 6,
    "mr": 0
  },
  "corpseInfo": {
    "warningNote": "毒持ちの肉である可能性があります。"
  },
  "effectSummary": "ダンジョンの序盤に現れる小型のモンスター。",
  "tacticalAdvice": [
    "距離を保って間合いを詰めて攻撃しましょう。",
    "矢や投げナイフなどの遠距離攻撃が有効です。"
  ]
}
```

### 3.2 アイテムナレッジ (`ENTITY_TYPES.ITEM`)
```json
{
  "name": "silver arrow (銀の矢)",
  "category": "WEAPON",
  "isUnidentified": false,
  "stats": {
    "sdam": "1d6+1",
    "ldam": "1d6+1",
    "ac": undefined,
    "material": "silver",
    "hands": 1
  },
  "bucEffects": {
    "blessed": "命中率とダメージが向上します。",
    "uncursed": "通常の効果です。",
    "cursed": "射撃時に一定確率で外れます。"
  },
  "effectSummary": "銀製の矢。邪悪な怪物に対して追加の特効傷害を与えます。",
  "flavorNote": "\"Silver burns evil entities on touch...\"",
  "unidentifiedTips": [
    "銀製品は触れるだけで一部の怪物を焼き灼きます。"
  ]
}
```

### 3.3 地形ナレッジ (`ENTITY_TYPES.TERRAIN`)
```json
{
  "name": "staircase down (下り階段)",
  "category": "STAIRS",
  "effectSummary": "'>' キーを押すことで、より深いダンジョン階層へと移動します。"
}
```

---

## 4. UI レンダリングでの利用パターン (UI Client Patterns)

### パターン A: ターゲットナレッジカードの描画 (HTML/DOM レンダリング)

```javascript
function renderKnowledgeCard(target) {
  const container = document.getElementById('knowledge-content');
  if (!target) {
    container.innerHTML = '<div class="empty">ホバーでナレッジ表示</div>';
    return;
  }

  // 1. オブジェクトまたは Glyph ID からナレッジを取得
  const data = (typeof target === 'object' && target.knowledge)
    ? target.knowledge
    : core.gkl.getKnowledge(target, { translate: true });

  if (!data) return;

  // 2. モンスターカード vs アイテム/地形カードの条件分岐描画
  if (data.dangerLevel) {
    // モンスターカード描画
    container.innerHTML = `
      <div class="card">
        <h3>${data.name} <span class="badge">${data.dangerLevel}</span></h3>
        <p>HD:${data.stats.hd} AC:${data.stats.ac} Spd:${data.stats.speed}</p>
        <p>${data.effectSummary}</p>
      </div>`;
  } else {
    // アイテム・地形カード描画
    container.innerHTML = `
      <div class="card">
        <h3>${data.name} <span class="badge">${data.category}</span></h3>
        ${data.stats?.sdam ? `<p>⚔️ 攻撃力: ${data.stats.sdam}</p>` : ''}
        ${data.stats?.ac !== undefined ? `<p>🛡️ 防御力: AC ${data.stats.ac}</p>` : ''}
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

### パターン C: IconInventory スロットでのツールチップ ＆ ナレッジ表示

所持品アイコンにマウスを乗せた時、ツールチップとサイドバーナレッジを同時更新します。

```javascript
items.forEach(item => {
  const slot = document.getElementById(`slot-${item.letter}`);
  
  // ホバー時：ナレッジカードとツールチップの更新
  slot.onmouseenter = () => {
    renderKnowledgeCard(item); // item.knowledge が参照される
    showTooltip(item.rawText);
  };
  
  // クリック時：ワンタップ推奨操作 (例: 装備/使用/掘削) の発火
  slot.onclick = () => {
    core.executeSequence(item.defaultSequence || [item.letter]);
  };
});
```

---

## 5. まとめ

Structured Knowledge は、複雑な NetHack の内部パラメータを整理し、**「1つの統一アクセサ `getKnowledge` または `item.knowledge` を呼ぶだけ」** で、直ちに UI レンダリングや AI プロンプトに活用できる美しいクリーン設計となっています。
