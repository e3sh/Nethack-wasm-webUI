/**
 * knowledge.test.js
 * AreaStateManager, glyphClassifier, ContextActionEngine の単体動作テスト
 */

import assert from 'node:assert';
import { test } from 'node:test';
import { classifyGlyph, ENTITY_TYPES, GLYPH_OFFSETS } from './glyphClassifier.js';
import { AreaStateManager } from './AreaStateManager.js';
import { ContextActionEngine } from './ContextActionEngine.js';

test('glyphClassifier - 各種 Glyph ID の正確な分類', () => {
    // Terrain (CMAP - Floor)
    const floorInfo = classifyGlyph(GLYPH_OFFSETS.GLYPH_CMAP_OFF + 1);
    assert.strictEqual(floorInfo.type, ENTITY_TYPES.TERRAIN);
    assert.strictEqual(floorInfo.isPile, false);

    // Closed Door (Glyph 3988)
    const closedDoorInfo = classifyGlyph(3988);
    assert.strictEqual(closedDoorInfo.type, ENTITY_TYPES.TERRAIN);
    assert.strictEqual(closedDoorInfo.cmapFlags.isClosedDoor, true);
    assert.strictEqual(closedDoorInfo.cmapFlags.isOpenDoor, false);

    // Item (Object - 普通のアイテム)
    const itemInfo = classifyGlyph(GLYPH_OFFSETS.GLYPH_OBJ_OFF + 10);
    assert.strictEqual(itemInfo.type, ENTITY_TYPES.ITEM);
    assert.strictEqual(itemInfo.isContainer, false);

    // Chest (Object - 箱)
    const chestInfo = classifyGlyph(3663);
    assert.strictEqual(chestInfo.type, ENTITY_TYPES.ITEM);
    assert.strictEqual(chestInfo.isContainer, true);

    // Monster
    const monInfo = classifyGlyph(GLYPH_OFFSETS.GLYPH_MON_OFF + 5);
    assert.strictEqual(monInfo.type, ENTITY_TYPES.MONSTER);

    // Piletop Item
    const pileInfo = classifyGlyph(GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF + 2);
    assert.strictEqual(pileInfo.type, ENTITY_TYPES.ITEM);
    assert.strictEqual(pileInfo.isPile, true);
});

test('AreaStateManager - 3階層 LIFO キャッシュと重なり復元テスト', () => {
    const manager = new AreaStateManager(80, 21);
    manager.updatePlayerPosition(10, 10);

    const floorGlyph = GLYPH_OFFSETS.GLYPH_CMAP_OFF + 1; // Floor
    const itemGlyph = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 5;   // Gold/Item
    const monGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 12;   // Goblin

    // 1. 床を描画
    manager.updateGlyph(10, 10, floorGlyph);
    let state = manager.getAreaState();
    assert.strictEqual(state.feet.bottom.type, ENTITY_TYPES.TERRAIN);
    assert.strictEqual(state.feet.middle, null);
    assert.strictEqual(state.feet.top, null);

    // 2. 同じマスにアイテムを描画
    manager.updateGlyph(10, 10, itemGlyph);
    state = manager.getAreaState();
    assert.strictEqual(state.feet.bottom.type, ENTITY_TYPES.TERRAIN);
    assert.strictEqual(state.feet.middle.type, ENTITY_TYPES.ITEM);
    assert.strictEqual(state.feet.top, null);

    // 3. 同じマスにモンスターが乗る
    manager.updateGlyph(10, 10, monGlyph);
    state = manager.getAreaState();
    assert.strictEqual(state.feet.bottom.type, ENTITY_TYPES.TERRAIN);
    assert.strictEqual(state.feet.middle.type, ENTITY_TYPES.ITEM); // 下のアイテム保持！
    assert.strictEqual(state.feet.top.type, ENTITY_TYPES.MONSTER); // 最上層にモンスター！

    // 4. アイテムを拾った（床の描画が再送信される）
    manager.updateGlyph(10, 10, floorGlyph);
    state = manager.getAreaState();
    assert.strictEqual(state.feet.bottom.type, ENTITY_TYPES.TERRAIN);
    assert.strictEqual(state.feet.middle, null); // アイテム削除・床露出！
    assert.strictEqual(state.feet.top, null);
});

test('glyphClassifier - 各種 CMAP 地形およびトラップの判定テスト', () => {
    // Altar
    const altarInfo = classifyGlyph(4006);
    assert.strictEqual(altarInfo.cmapFlags.isAltar, true);

    // Fountain
    const fountainInfo = classifyGlyph(4014);
    assert.strictEqual(fountainInfo.cmapFlags.isFountain, true);

    // Sink
    const sinkInfo = classifyGlyph(4013);
    assert.strictEqual(sinkInfo.cmapFlags.isSink, true);

    // Tree
    const treeInfo = classifyGlyph(3991);
    assert.strictEqual(treeInfo.cmapFlags.isTree, true);

    // Wall
    const wallInfo = classifyGlyph(3930);
    assert.strictEqual(wallInfo.cmapFlags.isWall, true);

    // Trap (Arrow trap)
    const trapInfo = classifyGlyph(4026);
    assert.strictEqual(trapInfo.cmapFlags.isTrap, true);
});

test('ContextActionEngine - 祭壇・泉・樹木・リスク評価・多言語プロパティのテスト', () => {
    const manager = new AreaStateManager(80, 21);
    manager.updatePlayerPosition(5, 5);

    const altarGlyph = 4006;   // Altar
    const fountainGlyph = 4014; // Fountain
    const treeGlyph = 3991;    // Tree

    // 1. 足元が祭壇
    manager.updateGlyph(5, 5, altarGlyph);
    let state = manager.getAreaState();
    let actions = ContextActionEngine.generateActions(state);

    const offerAction = actions.find(a => a.id === 'ACTION_OFFER');
    assert.ok(offerAction, '祭壇の上で死体を捧げるアクションが生成されること');
    assert.strictEqual(offerAction.label, 'Offer corpse on altar');
    assert.strictEqual(offerAction.labelJa, '死体を捧げる (Offer)');

    const prayAction = actions.find(a => a.id === 'ACTION_PRAY');
    assert.ok(prayAction, '祭壇の上で祈るアクションが生成されること');
    assert.strictEqual(prayAction.risk, 'danger', '祈るアクションには risk: danger が設定されていること');

    // 2. 足元が泉
    manager.updateGlyph(5, 5, fountainGlyph);
    state = manager.getAreaState();
    actions = ContextActionEngine.generateActions(state);

    const quaffAction = actions.find(a => a.id === 'ACTION_QUAFF_FOUNTAIN');
    assert.ok(quaffAction);
    assert.strictEqual(quaffAction.risk, 'warning');

    const kickFountainAction = actions.find(a => a.id === 'ACTION_KICK_FOUNTAIN');
    assert.ok(kickFountainAction);
    assert.strictEqual(kickFountainAction.risk, 'danger');

    // 3. 隣接 (東: 6,5) に樹木
    manager.updateGlyph(6, 5, treeGlyph);
    state = manager.getAreaState();
    actions = ContextActionEngine.generateActions(state);

    const kickTreeAction = actions.find(a => a.id === 'ACTION_KICK_TREE_E');
    assert.ok(kickTreeAction, '東の樹木を蹴るアクションが生成されること');
    assert.strictEqual(kickTreeAction.key, 'C-dl');

    // 4. 足元に通常のアイテム (金貨など) がある場合は LOOT が出ないこと
    const normalItemGlyph = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 5;
    manager.updateGlyph(5, 5, normalItemGlyph);
    state = manager.getAreaState();
    actions = ContextActionEngine.generateActions(state);

    const pickupNormal = actions.find(a => a.id === 'ACTION_PICKUP');
    const lootNormal = actions.find(a => a.id === 'ACTION_LOOT');
    assert.ok(pickupNormal, '通常アイテムでは拾うアクションが生成されること');
    assert.strictEqual(lootNormal, undefined, '通常アイテムでは Loot アクションが生成されないこと');

    // 5. 足元に箱 (Chest: 3663) がある場合は LOOT が生成されること
    const chestGlyph = 3663;
    manager.updateGlyph(5, 5, chestGlyph);
    state = manager.getAreaState();
    actions = ContextActionEngine.generateActions(state);

    const lootChest = actions.find(a => a.id === 'ACTION_LOOT');
    assert.ok(lootChest, '箱アイテムでは Loot アクションが生成されること');

    // 6. アクションが priority 降順でソートされていることの検証
    for (let i = 0; i < actions.length - 1; i++) {
        assert.ok(actions[i].priority >= actions[i + 1].priority, '推奨アクションが優先度降順に並んでいること');
    }
});
