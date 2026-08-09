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

    // Item (Object)
    const itemInfo = classifyGlyph(GLYPH_OFFSETS.GLYPH_OBJ_OFF + 10);
    assert.strictEqual(itemInfo.type, ENTITY_TYPES.ITEM);
    assert.strictEqual(itemInfo.isPile, false);

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

test('ContextActionEngine - 推奨アクションの生成およびドア誤検出防止テスト', () => {
    const manager = new AreaStateManager(80, 21);
    manager.updatePlayerPosition(5, 5);

    const floorGlyph = GLYPH_OFFSETS.GLYPH_CMAP_OFF + 1; // 床
    const closedDoorGlyph = 3988; // 閉じたドア (Glyph 3988)

    // 全周に通常の「床」を描画
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            manager.updateGlyph(5 + dx, 5 + dy, floorGlyph);
        }
    }

    // 床だけの環境では「扉を開ける」アクションが出ないこと
    let state = manager.getAreaState();
    let actions = ContextActionEngine.generateActions(state);
    const doorActionFloorOnly = actions.find(a => a.id.startsWith('ACTION_OPEN_DOOR'));
    assert.strictEqual(doorActionFloorOnly, undefined, '普通の床にはドア開けアクションが出ないこと');

    // 東 (6, 5) に「閉じたドア」を配置
    manager.updateGlyph(6, 5, closedDoorGlyph);
    state = manager.getAreaState();
    actions = ContextActionEngine.generateActions(state);

    const doorAction = actions.find(a => a.id === 'ACTION_OPEN_DOOR_E');
    assert.ok(doorAction, '東に閉じたドアがある場合にのみ「東の扉を開ける」アクションが出力されること');
    assert.strictEqual(doorAction.key, 'ol');
});
