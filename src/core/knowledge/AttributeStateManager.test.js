import { describe, it, expect, beforeEach } from 'vitest';
import { AttributeStateManager, ATTRIBUTE_KEYS } from './AttributeStateManager.js';

describe('AttributeStateManager Tests', () => {
    let attrManager;

    beforeEach(() => {
        attrManager = new AttributeStateManager();
    });

    it('全38種類の属性キーが定義されており、初期状態ではすべて false であること', () => {
        expect(ATTRIBUTE_KEYS.length).toBe(38);
        const attrs = attrManager.getAttributes();
        expect(attrs.isSynced).toBe(false);

        for (const k of ATTRIBUTE_KEYS) {
            expect(attrs.effectiveResistances[k]).toBe(false);
            expect(attrs.intrinsics[k]).toBe(false);
            expect(attrs.extrinsics[k]).toBe(false);
        }
    });

    it('^X (#attributes) テキスト出力から内因性耐性を正しくパースできること', () => {
        const sampleLines = [
            'You are fire resistant.',
            'You are poison resistant.',
            'You see invisible.',
            'You are warned.',
            'You have teleport control.',
            'You are fast.'
        ];

        attrManager.updateFromIntrinsicsLines(sampleLines);

        const attrs = attrManager.getAttributes();
        expect(attrs.isSynced).toBe(true);

        // 有効化された耐性
        expect(attrs.intrinsics.fire).toBe(true);
        expect(attrs.intrinsics.poison).toBe(true);
        expect(attrs.intrinsics.seeInvis).toBe(true);
        expect(attrs.intrinsics.warning).toBe(true);
        expect(attrs.intrinsics.teleportControl).toBe(true);
        expect(attrs.intrinsics.fast).toBe(true);

        // 未有効化の耐性
        expect(attrs.intrinsics.cold).toBe(false);
        expect(attrs.intrinsics.shock).toBe(false);
        expect(attrs.intrinsics.sleep).toBe(false);
        expect(attrs.intrinsics.reflect).toBe(false);
    });

    it('日本語版 NetHack の ^X 出力から内因性耐性を正しくパースできること', () => {
        const sampleLines = [
            '火炎に対する耐性がある',
            '電撃に対する耐性がある',
            '不可視のものを視認できる',
            '反射能力がある'
        ];

        attrManager.updateFromIntrinsicsLines(sampleLines);

        const eff = attrManager.getEffectiveResistances();
        expect(eff.fire).toBe(true);
        expect(eff.shock).toBe(true);
        expect(eff.seeInvis).toBe(true);
        expect(eff.reflect).toBe(true);
        expect(eff.cold).toBe(false);
    });

    it('装備中アイテム（指輪・防具・靴・外套・盾等）から外因性耐性 (Extrinsics) を正しく自動抽出・マージできること', () => {
        const inventoryItems = [
            { rawText: 'a blessed ring of fire resistance (on right hand)', isWornRight: true },
            { rawText: 'a +1 silver dragon scale mail (being worn)', isWorn: true },
            { rawText: 'a pair of water walking boots (being worn)', isWorn: true },
            { rawText: 'a cloak of protection (being worn)', isWorn: true },
            { rawText: 'a cloak of magic resistance (being worn)', isWorn: true },
            { rawText: 'a ring of levitation (on left hand)', isWornLeft: true },
            { rawText: 'a ring of cold resistance in pack', isWorn: false } // 装備していない指輪
        ];

        attrManager.updateExtrinsicsFromInventory(inventoryItems);

        const attrs = attrManager.getAttributes();
        expect(attrs.extrinsics.fire).toBe(true);
        expect(attrs.extrinsics.reflect).toBe(true); // silver dragon scale mail provides reflection
        expect(attrs.extrinsics.wwalking).toBe(true); // water walking boots
        expect(attrs.extrinsics.protection).toBe(true); // cloak of protection
        expect(attrs.extrinsics.antimagic).toBe(true); // cloak of magic resistance
        expect(attrs.extrinsics.levitation).toBe(true);
        expect(attrs.extrinsics.cold).toBe(false); // バッグ内なので無効

        // 内因性と外因性の統合 (EffectiveResistances)
        expect(attrs.effectiveResistances.fire).toBe(true);
        expect(attrs.effectiveResistances.reflect).toBe(true);
        expect(attrs.effectiveResistances.wwalking).toBe(true);
        expect(attrs.effectiveResistances.protection).toBe(true);
        expect(attrs.effectiveResistances.antimagic).toBe(true);
        expect(attrs.effectiveResistances.levitation).toBe(true);
        expect(attrs.effectiveResistances.cold).toBe(false);
    });

    it('耐性獲得メッセージから動的に内因性耐性が追加されること', () => {
        expect(attrManager.getEffectiveResistances().fire).toBe(false);

        const changed = attrManager.updateFromMessage('You feel a hot sensation.');
        expect(changed).toBe(true);
        expect(attrManager.getEffectiveResistances().fire).toBe(true);

        const changed2 = attrManager.updateFromMessage('You feel healthy.');
        expect(changed2).toBe(true);
        expect(attrManager.getEffectiveResistances().poison).toBe(true);
    });

    it('reset() で全耐性が初期化されること', () => {
        attrManager.updateFromIntrinsicsLines(['You are fire resistant.']);
        expect(attrManager.getEffectiveResistances().fire).toBe(true);

        attrManager.reset();
        expect(attrManager.getEffectiveResistances().fire).toBe(false);
        expect(attrManager.isSynced).toBe(false);
    });
});
