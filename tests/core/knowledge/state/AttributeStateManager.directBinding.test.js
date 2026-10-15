import { describe, it, expect, beforeEach } from 'vitest';
import { AttributeStateManager, PROP_INDEX_TO_ATTRIBUTE_KEY } from '../../../../src/core/knowledge/state/AttributeStateManager.js';

describe('AttributeStateManager - Direct Binding (Wasm Memory Integration)', () => {
    let manager;

    beforeEach(() => {
        manager = new AttributeStateManager();
    });

    it('initializes with isSynced=false and empty attributes', () => {
        expect(manager.isSynced).toBe(false);
        const effective = manager.getEffectiveResistances();
        expect(effective.fire).toBe(false);
        expect(effective.poison).toBe(false);
        expect(effective.teleportControl).toBe(false);
    });

    it('correctly maps raw uprops array (intrinsic and extrinsic bitfields) via syncFromDirectBinding', () => {
        // 69 elements (index 0 to 68)
        const mockProps = new Array(69).fill(0);

        // 1: FIRE_RES - intrinsic only (下位16bit)
        mockProps[1] = 0x00000001;
        // 6: POISON_RES - extrinsic only (上位16bit: 0x00010000)
        mockProps[6] = 0x00010000;
        // 47: TELEPORT_CONTROL - both intrinsic and extrinsic (0x00010001)
        mockProps[47] = 0x00010001;
        // 65: REFLECTING - extrinsic (0x00020000)
        mockProps[65] = 0x00020000;

        const mockService = {
            getPlayerProps: () => mockProps
        };

        const changed = manager.syncFromDirectBinding(mockService);

        expect(changed).toBe(true);
        expect(manager.isSynced).toBe(true);

        const effective = manager.getEffectiveResistances();
        expect(effective.fire).toBe(true);
        expect(effective.poison).toBe(true);
        expect(effective.teleportControl).toBe(true);
        expect(effective.reflect).toBe(true);
        expect(effective.cold).toBe(false);

        // 内因性と外因性の分離検証
        expect(manager.intrinsics.fire).toBe(true);
        expect(manager.extrinsics.fire).toBe(false);

        expect(manager.intrinsics.poison).toBe(false);
        expect(manager.extrinsics.poison).toBe(true);

        expect(manager.intrinsics.teleportControl).toBe(true);
        expect(manager.extrinsics.teleportControl).toBe(true);

        // getActiveResistances() による UI 表示オブジェクト検証
        const active = manager.getActiveResistances('ja');
        const fire = active.find(a => a.key === 'fire');
        const poison = active.find(a => a.key === 'poison');
        const tc = active.find(a => a.key === 'teleportControl');

        expect(fire.source).toBe('intrinsic');
        expect(poison.source).toBe('extrinsic');
        expect(tc.source).toBe('both');
    });

    it('preserves innate character resistances when syncing from direct binding', () => {
        // オークによる生来の毒耐性 (level 1)
        manager.updateCharacter({ race: 'orc', role: 'barbarian', level: 1 });
        expect(manager.innate.poison).toBe(true);

        const mockProps = new Array(69).fill(0);
        // uprops には火炎耐性 (FIRE_RES = 1) のみセット
        mockProps[1] = 0x00000001;

        const mockService = {
            getPlayerProps: () => mockProps
        };

        manager.syncFromDirectBinding(mockService);

        expect(manager.intrinsics.poison).toBe(true);
        expect(manager.intrinsics.fire).toBe(true);
        expect(manager.getEffectiveResistances().poison).toBe(true);
        expect(manager.getEffectiveResistances().fire).toBe(true);
    });

    it('returns false and does not sync if getPlayerProps returns null or empty', () => {
        const mockService = {
            getPlayerProps: () => null
        };

        const res = manager.syncFromDirectBinding(mockService);
        expect(res).toBe(false);
        expect(manager.isSynced).toBe(false);
    });
});
