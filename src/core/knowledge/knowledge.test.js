/**
 * knowledge.test.js
 * AreaStateManager, glyphClassifier, ContextActionEngine の単体動作テスト
 */

import assert from 'node:assert';
import { test } from 'node:test';
import { classifyGlyph, ENTITY_TYPES, GLYPH_OFFSETS } from './glyphClassifier.js';
import { AreaStateManager } from './AreaStateManager.js';
import { ContextActionEngine } from './ContextActionEngine.js';
import { WebUICore } from '../WebUICore.js';

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
    assert.strictEqual(kickTreeAction.key, 'C-dDIR_E');

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

import { InventoryStateManager } from './InventoryStateManager.js';
import { DirectionalActionResolver } from '../../client/DirectionalActionResolver.js';

test('InventoryStateManager - パースとツール抽出テスト', () => {
    const inv = new InventoryStateManager();
    assert.strictEqual(inv.getPickAxe(), null, '未同期時は null を返すこと');

    inv.updateFromMenuItems([
        { letter: 'a', text: 'a +0 dagger', glyph: 3450, onum: 1 },
        { letter: 'f', text: 'a blessed +1 pick-axe (weapon in hand)', glyph: 3707, onum: 259 },
        { letter: 'b', text: 'an iron key', glyph: 3699, onum: 251 }
    ]);

    assert.strictEqual(inv.isSynced, true);
    const pickAxe = inv.getPickAxe();
    assert.ok(pickAxe, 'ツルハシが検出されること');
    assert.strictEqual(pickAxe.letter, 'f');
    assert.strictEqual(pickAxe.isPickAxe, true);

    const key = inv.getKeyOrLockPick();
    assert.ok(key, '鍵が検出されること');
    assert.strictEqual(key.letter, 'b');
});

test('ContextActionEngine & DirectionalActionResolver - 所持品連動ノイズ除去およびペット誤爆防止テスト', () => {
    const manager = new AreaStateManager(80, 21);
    manager.updatePlayerPosition(5, 5);

    const wallGlyph = 3930; // Wall
    const petGlyph = GLYPH_OFFSETS.GLYPH_PET_OFF + 5; // Pet

    // 1. 東(6,5)に壁がある場合
    manager.updateGlyph(6, 5, wallGlyph);
    let state = manager.getAreaState();

    // 1-A. ツルハシ未所持状態 -> 掘削アクションはノイズ除去されて非生成
    const invEmpty = new InventoryStateManager();
    invEmpty.updateFromMenuItems([
        { letter: 'a', text: 'a +0 dagger' }
    ]);
    let actions = ContextActionEngine.generateActions(state, invEmpty);
    let digAction = actions.find(a => a.id === 'ACTION_DIG_WALL_E');
    assert.strictEqual(digAction, undefined, 'ツルハシ未所持時は壁掘削アクションがノイズ除去されること');

    let resolveResult = DirectionalActionResolver.resolveDirection('E', state, invEmpty);
    assert.strictEqual(resolveResult.isWalkable, false);
    assert.strictEqual(resolveResult.primaryAction, null, '掘削ツールが無い壁への入力はプライマリアクションなし');

    // 1-B. ツルハシ所持状態 -> 掘削アクション生成 & keySequence 挿入
    const invWithPick = new InventoryStateManager();
    invWithPick.updateFromMenuItems([
        { letter: 'f', text: 'a pick-axe', onum: 259 }
    ]);
    actions = ContextActionEngine.generateActions(state, invWithPick);
    digAction = actions.find(a => a.id === 'ACTION_DIG_WALL_E');
    assert.ok(digAction, 'ツルハシ所持時は壁掘削アクションが生成されること');
    assert.deepStrictEqual(digAction.keySequence, ['a', 'f', 'DIR_E'], 'keySequence が [a, f, DIR_E] に設定されること');

    resolveResult = DirectionalActionResolver.resolveDirection('E', state, invWithPick);
    assert.strictEqual(resolveResult.isWalkable, false);
    assert.strictEqual(resolveResult.primaryAction.id, 'ACTION_DIG_WALL_E');

    // 2. 北(5,4)にペットがいる場合 -> 攻撃コマンド非生成 & 話しかけるコマンドのみ
    manager.updateGlyph(5, 4, petGlyph);
    state = manager.getAreaState();
    actions = ContextActionEngine.generateActions(state, invEmpty);

    const attackPetAction = actions.find(a => a.id === 'ACTION_ATTACK_N');
    assert.strictEqual(attackPetAction, undefined, 'ペットに対する攻撃コマンドは絶対生成されないこと（誤爆防止）');

    const chatPetAction = actions.find(a => a.id === 'ACTION_CHAT_N');
    assert.ok(chatPetAction, 'ペットに対しては話しかけるアクションが生成されること');
});

import { SituationCache } from './SituationCache.js';

test('InventoryStateManager - ロックピック (lock pick) 初期メニュー同期＆メッセージ検出(dirty化)＆シーケンスバッファ更新テスト', () => {
    const inv = new InventoryStateManager();

    // 1. 初期メニュー同期テスト ("a - a lock pick")
    inv.updateFromMenuItems([
        { letter: 'a', text: 'a - a lock pick', glyph: 3707, onum: 250 }
    ]);
    assert.strictEqual(inv.isSynced, true);
    const keyItem = inv.getKeyOrLockPick();
    assert.ok(keyItem, 'a lock pick が鍵/解錠ツールとして認識されること');
    assert.strictEqual(keyItem.letter, 'a');

    // 2. メッセージ検出テスト (アドホック推測登録ではなく isSynced = false で未同期/dirty化されること)
    inv.updateFromMessage("You pick up a key.");
    assert.strictEqual(inv.isSynced, false, 'メッセージ受領時は能動取得を促すため未同期 (dirty) になること');

    // 3. updateFromSequenceBuffer テスト (シーケンスバッファからの正確な復元)
    const seqBuffer = [
        {
            menuItems: [
                { letter: 'b', text: 'b - a blessed +1 pick-axe', glyph: 3707, onum: 259 }
            ]
        }
    ];
    inv.updateFromSequenceBuffer(seqBuffer);
    assert.strictEqual(inv.isSynced, true, 'シーケンスバッファからの復元で同期完了フラグが立つこと');
    assert.ok(inv.getPickAxe(), 'シーケンスバッファからツルハシが検出されること');
    assert.strictEqual(inv.getPickAxe().letter, 'b');

    // 4. 多様なプロパティ名 (str, accelerator, label) 対応テスト
    const invProp = new InventoryStateManager();
    invProp.updateFromMenuItems([
        { accelerator: 'b', str: 'b - a lock pick', glyphInfo: { glyph: 3707, onum: 250 } }
    ]);
    assert.strictEqual(invProp.isSynced, true);
    const keyProp = invProp.getKeyOrLockPick();
    assert.ok(keyProp, 'str / accelerator 形式の lock pick も認識されること');
    assert.strictEqual(keyProp.letter, 'b');
});

test('SituationCache - GKL 統合状況 (Situation) アクセサテスト', () => {
    const inv = new InventoryStateManager();
    inv.updateFromMenuItems([
        { letter: 'a', text: 'a pick-axe', onum: 259 }
    ]);

    const area = new AreaStateManager(80, 21);
    area.updatePlayerPosition(10, 10);

    const mockStatusAccessor = {
        getStatus: () => ({ hp: { current: 12, max: 12 }, dlevel: { level: 1 } })
    };

    const cache = new SituationCache(mockStatusAccessor, inv, area, ContextActionEngine);
    const sit = cache.getSituation();

    assert.ok(sit.status, 'ステータス情報が含まれること');
    assert.strictEqual(sit.status.hp.current, 12);
    assert.ok(sit.inventory, 'インベントリ情報が含まれること');
    assert.strictEqual(sit.inventory.isSynced, true);
    assert.ok(sit.tools.pickAxe, '抽出ツールが含まれること');
    assert.strictEqual(sit.tools.pickAxe.letter, 'a');
    assert.ok(Array.isArray(sit.actions), '推論アクション配列が含まれること');
});

test('AreaStateManager & ContextActionEngine - setKeyMode (numpad / vi) 動的切替テスト', () => {
    const area = new AreaStateManager(80, 21);
    area.updatePlayerPosition(5, 5);

    // デフォルト ('vi'): 北 (dx:0, dy:-1) は 'k'
    let state = area.getAreaState();
    const northCellVi = state.cells.flat().find(c => c.relX === 0 && c.relY === -1);
    assert.strictEqual(northCellVi.dir.key, 'k', 'デフォルト vi モードでは北のキーは k');

    // numpad モード切替: 北 (dx:0, dy:-1) は '8'
    area.setKeyMode('numpad');
    state = area.getAreaState();
    const northCellNumpad = state.cells.flat().find(c => c.relX === 0 && c.relY === -1);
    assert.strictEqual(northCellNumpad.dir.key, '8', 'numpad モード切替後は北のキーは 8');
});

test('WebUICore - 起動オプション (number_pad / numpad) からの keyMode 自動追従テスト', () => {
    const dummyDriver = { on: () => {}, off: () => {} };
    const core = new WebUICore({ driver: dummyDriver, numpad: true });
    
    core.areaStateManager.updatePlayerPosition(5, 5);
    const state = core.areaStateManager.getAreaState();
    const northCell = state.cells.flat().find(c => c.relX === 0 && c.relY === -1);
    assert.strictEqual(northCell.dir.key, '8', 'core の numpad: true オプションにより自動的に北のキーが 8 となること');
});

test('InventoryStateManager & ContextActionEngine - pick-axe (a) と wand of digging (z) の発動キー分類テスト', () => {
    const inv = new InventoryStateManager();
    inv.updateFromMenuItems([
        { letter: 'a', text: 'a +0 pick-axe', onum: 259 },
        { letter: 'b', text: 'a wand of digging', onum: 299 }
    ]);

    const pickAxeItem = inv.items.find(i => i.isPickAxe);
    assert.ok(pickAxeItem, 'pick-axe が識別されていること');
    assert.strictEqual(pickAxeItem.verb, 'a', 'pick-axe の発動キーは a であること');

    const digWandItem = inv.items.find(i => i.isDigWand);
    assert.ok(digWandItem, 'wand of digging が識別されていること');
    assert.strictEqual(digWandItem.verb, 'z', 'wand of digging の発動キーは z であること');

    // 壁に隣接している場合の ContextAction の keySequence テスト
    const area = new AreaStateManager(80, 21);
    area.updatePlayerPosition(5, 5);
    area.updateGlyph(6, 5, 3930); // 東側 (relX: 1, relY: 0) に壁を配置

    // 1. wand of digging のみ持っているインベントリ
    const invWandOnly = new InventoryStateManager();
    invWandOnly.updateFromMenuItems([{ letter: 'w', text: 'a wand of digging', onum: 299 }]);
    const actionsWand = ContextActionEngine.generateActions(area.getAreaState(), invWandOnly);
    const digActionWand = actionsWand.find(a => a.id.startsWith('ACTION_DIG_WALL'));
    assert.ok(digActionWand, '壁破壊アクションが生成されること');
    assert.deepStrictEqual(digActionWand.keySequence, ['z', 'w', 'DIR_E'], 'wand of digging の場合は z キーで開始されること');

    // 2. pick-axe のみ持っているインベントリ
    const invPickOnly = new InventoryStateManager();
    invPickOnly.updateFromMenuItems([{ letter: 'p', text: 'a pick-axe', onum: 259 }]);
    const actionsPick = ContextActionEngine.generateActions(area.getAreaState(), invPickOnly);
    const digActionPick = actionsPick.find(a => a.id.startsWith('ACTION_DIG_WALL'));
    assert.ok(digActionPick, '壁掘削アクションが生成されること');
    assert.deepStrictEqual(digActionPick.keySequence, ['a', 'p', 'DIR_E'], 'pick-axe の場合は a キーで開始されること');
});


