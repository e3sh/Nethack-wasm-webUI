/**
 * ObjectKnowledgeIntegrity.test.js
 * NetHack 5.0 全 481 アイテム (onum 0〜480) 構造化ナレッジ完全性および型安全検証テスト
 */

import { describe, it, expect } from 'vitest';
import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';
import { OBJECT_KNOWLEDGE_BASE } from './OBJECT_KNOWLEDGE_BASE.js';
import { AttributeStateManager } from './AttributeStateManager.js';

describe('OBJECT_KNOWLEDGE_FULL Integrity & Property Coverage', () => {
    it('should have exactly 481 items (onum 0 to 480) in OBJECT_KNOWLEDGE_BASE and OBJECT_KNOWLEDGE_MAP', () => {
        expect(OBJECT_KNOWLEDGE_BASE.length).toBe(481);
        expect(OBJECT_KNOWLEDGE_MAP.size).toBe(481);

        for (let i = 0; i <= 480; i++) {
            expect(OBJECT_KNOWLEDGE_MAP.has(i)).toBe(true);
            const item = OBJECT_KNOWLEDGE_MAP.get(i);
            expect(item).toBeDefined();
            expect(item.onum).toBe(i);
            expect(item.id).toBe(`item_onum_${i}`);
            expect(item.name).toBeTruthy();
            expect(item.category).toBeTruthy();
            expect(typeof item.material).toBe('string');
            expect(typeof item.weight).toBe('number');
            expect(typeof item.cost).toBe('number');
            expect(typeof item.hands).toBe('number');
            expect(typeof item.skill).toBe('string');
            expect(item.stats).toBeDefined();
        }
    });

    it('should verify weapons have correct skills, damages, hands, and materials', () => {
        // onum 55: two-handed sword
        const twoHandedSword = OBJECT_KNOWLEDGE_MAP.get(55);
        expect(twoHandedSword.name).toBe('two-handed sword');
        expect(twoHandedSword.category).toBe('WEAPON');
        expect(twoHandedSword.skill).toBe('two-handed sword');
        expect(twoHandedSword.hands).toBe(2);
        expect(twoHandedSword.material).toBe('iron');
        expect(twoHandedSword.sdam).toBe('1d12');
        expect(twoHandedSword.ldam).toBe('3d6');
        expect(twoHandedSword.weight).toBe(150);
        expect(twoHandedSword.cost).toBe(50);

        // onum 34: dagger
        const dagger = OBJECT_KNOWLEDGE_MAP.get(34);
        expect(dagger.name).toBe('dagger');
        expect(dagger.category).toBe('WEAPON');
        expect(dagger.skill).toBe('dagger');
        expect(dagger.hands).toBe(1);
        expect(dagger.material).toBe('iron');
        expect(dagger.sdam).toBe('1d4');
        expect(dagger.ldam).toBe('1d3');
        expect(dagger.hitBonus).toBe(2);

        // onum 37: silver dagger
        const silverDagger = OBJECT_KNOWLEDGE_MAP.get(37);
        expect(silverDagger.material).toBe('silver');

        // onum 88: crossbow
        const crossbow = OBJECT_KNOWLEDGE_BASE.find(b => b.name === 'crossbow');
        expect(crossbow).toBeDefined();
        const crossbowFull = OBJECT_KNOWLEDGE_MAP.get(crossbow.onum);
        expect(crossbowFull.category).toBe('WEAPON');
        expect(crossbowFull.isLauncher).toBe(true);
        expect(crossbowFull.skill).toBe('crossbow');
        expect(crossbowFull.hands).toBe(2);
    });

    it('should verify armor has correct AC, MC, armorSlot, and propConveyed', () => {
        // Red dragon scale mail (FIRE_RES)
        const redDSM = OBJECT_KNOWLEDGE_BASE.find(b => b.name === 'red dragon scale mail');
        expect(redDSM).toBeDefined();
        const redDSMFull = OBJECT_KNOWLEDGE_MAP.get(redDSM.onum);
        expect(redDSMFull.category).toBe('ARMOR');
        expect(redDSMFull.armorSlot).toBe('suit');
        expect(redDSMFull.propConveyed).toBe('FIRE_RES');
        expect(redDSMFull.material).toBe('dragon_hide');
        expect(redDSMFull.ac).toBe(1);
        expect(redDSMFull.acBonus).toBe(9);

        // Silver dragon scale mail (REFLECTING)
        const silverDSM = OBJECT_KNOWLEDGE_BASE.find(b => b.name === 'silver dragon scale mail');
        expect(silverDSM).toBeDefined();
        const silverDSMFull = OBJECT_KNOWLEDGE_MAP.get(silverDSM.onum);
        expect(silverDSMFull.propConveyed).toBe('REFLECTING');

        // Cloak of magic resistance (ANTIMAGIC, MC 1)
        const mrCloak = OBJECT_KNOWLEDGE_BASE.find(b => b.name === 'cloak of magic resistance');
        expect(mrCloak).toBeDefined();
        const mrCloakFull = OBJECT_KNOWLEDGE_MAP.get(mrCloak.onum);
        expect(mrCloakFull.propConveyed).toBe('ANTIMAGIC');
        expect(mrCloakFull.armorSlot).toBe('cloak');
        expect(mrCloakFull.mc).toBe(1);
    });

    it('should verify rings, amulets, and wands have correct properties and zapTypes', () => {
        // Ring of teleportation (NetHack 内部名: 'teleportation', category: 'RING')
        const teleRing = OBJECT_KNOWLEDGE_BASE.find(b => b.category === 'RING' && (b.name === 'teleportation' || b.sn === 'RIN_TELEPORTATION'));
        expect(teleRing).toBeDefined();
        const teleRingFull = OBJECT_KNOWLEDGE_MAP.get(teleRing.onum);
        expect(teleRingFull.category).toBe('RING');
        expect(teleRingFull.propConveyed).toBe('TELEPORT');

        // Amulet of reflection (category: 'AMULET')
        const reflectAmulet = OBJECT_KNOWLEDGE_BASE.find(b => b.category === 'AMULET' && b.propConveyed === 'REFLECTING');
        expect(reflectAmulet).toBeDefined();
        const reflectAmuletFull = OBJECT_KNOWLEDGE_MAP.get(reflectAmulet.onum);
        expect(reflectAmuletFull.category).toBe('AMULET');
        expect(reflectAmuletFull.propConveyed).toBe('REFLECTING');

        // Wand of death (ray)
        const deathWand = OBJECT_KNOWLEDGE_BASE.find(b => b.category === 'WAND' && (b.name === 'death' || b.sn === 'WAN_DEATH'));
        expect(deathWand).toBeDefined();
        const deathWandFull = OBJECT_KNOWLEDGE_MAP.get(deathWand.onum);
        expect(deathWandFull.category).toBe('WAND');
        expect(deathWandFull.zapType).toBe('ray');
        expect(deathWandFull.isCharged).toBe(true);

        // Wand of digging (ray)
        const digWand = OBJECT_KNOWLEDGE_BASE.find(b => b.category === 'WAND' && (b.name === 'digging' || b.sn === 'WAN_DIGGING'));
        expect(digWand).toBeDefined();
        const digWandFull = OBJECT_KNOWLEDGE_MAP.get(digWand.onum);
        expect(digWandFull.category).toBe('WAND');
        expect(digWandFull.zapType).toBe('ray');
    });

    it('should correctly infer extrinsics in AttributeStateManager from structured knowledge', () => {
        const attrManager = new AttributeStateManager();

        const redDSM = OBJECT_KNOWLEDGE_BASE.find(b => b.name === 'red dragon scale mail');
        const teleRing = OBJECT_KNOWLEDGE_BASE.find(b => b.category === 'RING' && (b.name === 'teleportation' || b.sn === 'RIN_TELEPORTATION'));

        const inventoryItems = [
            {
                letter: 'a',
                onum: redDSM.onum,
                rawText: 'a - a +0 red dragon scale mail (being worn)',
                isWorn: true,
                isArmor: true,
                knowledge: OBJECT_KNOWLEDGE_MAP.get(redDSM.onum)
            },
            {
                letter: 'b',
                onum: teleRing.onum,
                rawText: 'b - a ring of teleportation (on left hand)',
                isWorn: true,
                isWornLeft: true,
                knowledge: OBJECT_KNOWLEDGE_MAP.get(teleRing.onum)
            }
        ];

        attrManager.updateExtrinsicsFromInventory(inventoryItems);
        const effective = attrManager.getEffectiveResistances();

        expect(effective.fire).toBe(true);
        expect(effective.teleport).toBe(true);
        expect(effective.cold).toBe(false);
    });
});
