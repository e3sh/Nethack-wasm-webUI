import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryStateManager } from '../../../src/core/knowledge/state/InventoryStateManager.js';
import { AreaStateManager } from '../../../src/core/knowledge/state/AreaStateManager.js';
import { ContextActionEngine } from '../../../src/core/knowledge/engines/ContextActionEngine.js';

describe('ContextActions 解錠/施錠・ツールアクション復旧検証テスト', () => {
    let invMgr;
    let areaMgr;

    beforeEach(() => {
        invMgr = new InventoryStateManager();
        areaMgr = new AreaStateManager(80, 21);
    });

    it('鍵を所持している場合、閉じた扉の前で ACTION_UNLOCK_DOOR が正しく提示されること', () => {
        // 1. メニュー同期経由で鍵アイテムを登録 (ItemNormalizer を通過)
        invMgr.syncFromMenu([
            { accelerator: 'k', rawStr: 'k - a skeleton key' }
        ]);

        // アイテム正規化後も isKey が保持され、getKeyOrLockPick で取得できること
        const keyItem = invMgr.getKeyOrLockPick();
        expect(keyItem).not.toBeNull();
        expect(keyItem.isKey).toBe(true);
        expect(keyItem.letter).toBe('k');

        // 2. プレイヤーを (10, 10) に配置し、東 (11, 10) に閉じた扉 (3988) を配置
        areaMgr.updatePlayerPosition(10, 10);
        areaMgr.updateGlyph(11, 10, 3988); // S_vcdoor / S_hcdoor

        const areaState = areaMgr.getAreaState();

        // 3. ContextActionEngine でアクション生成
        const actions = ContextActionEngine.generateActions(areaState, invMgr);

        // 4. 解錠アクションが含まれていること
        const unlockAction = actions.find(a => a.id === 'ACTION_UNLOCK_DOOR_E');
        expect(unlockAction).toBeDefined();
        expect(unlockAction.keySequence).toEqual(['a', 'k', 'DIR_E', 'y']);
        expect(unlockAction.label).toContain('解錠/施錠');
        expect(unlockAction.priority).toBe(95);

        // 開けるアクション (priority: 90) も併せて生成され、解錠が優先されること
        const openAction = actions.find(a => a.id === 'ACTION_OPEN_DOOR_E');
        expect(openAction).toBeDefined();
        expect(unlockAction.priority).toBeGreaterThan(openAction.priority);
    });

    it('ツルハシを所持している場合、壁の前で ACTION_DIG_WALL が正しく提示されること', () => {
        invMgr.syncFromMenu([
            { accelerator: 'p', rawStr: 'p - a pick-axe' }
        ]);

        const digTool = invMgr.getDigTool();
        expect(digTool).not.toBeNull();
        expect(digTool.isPickAxe).toBe(true);

        // 東 (11, 10) に壁 (3930) を配置
        areaMgr.updatePlayerPosition(10, 10);
        areaMgr.updateGlyph(11, 10, 3930);

        const areaState = areaMgr.getAreaState();
        const actions = ContextActionEngine.generateActions(areaState, invMgr);

        const digAction = actions.find(a => a.id === 'ACTION_DIG_WALL_E');
        expect(digAction).toBeDefined();
        expect(digAction.keySequence).toEqual(['a', 'p', 'DIR_E']);
    });
});
