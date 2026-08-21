/**
 * ItemSpecPresenter.test.js
 * カテゴリ別アダプティブ・スペック生成およびスキル連携「＋」マークの単体テスト
 */

import { describe, it, expect } from 'vitest';
import { getAdaptiveItemSpecs, getSkillProficiencyBadge } from './ItemSpecPresenter.js';
import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';
import { OBJECT_KNOWLEDGE_BASE } from './OBJECT_KNOWLEDGE_BASE.js';
import { SkillStateManager } from './SkillStateManager.js';

describe('ItemSpecPresenter Adaptive Formatting', () => {
    it('should generate weapon specs without AC or extraneous zeros', () => {
        // onum 55: two-handed sword
        const twoHandedSword = OBJECT_KNOWLEDGE_MAP.get(55);
        const specs = getAdaptiveItemSpecs(twoHandedSword);

        const ids = specs.map(s => s.id);
        expect(ids).toContain('damage');
        expect(ids).toContain('hands');
        expect(ids).toContain('skill');
        expect(ids).toContain('material');
        expect(ids).toContain('weight');
        expect(ids).not.toContain('ac');
        expect(ids).not.toContain('mc');
        expect(ids).not.toContain('zapType');

        const damageSpec = specs.find(s => s.id === 'damage');
        expect(damageSpec.value).toBe('1d12 / 3d6');

        const handsSpec = specs.find(s => s.id === 'hands');
        expect(handsSpec.value).toBe('両手持ち (2H)');
    });

    it('should generate armor specs with AC, MC, Slot, and Conveys', () => {
        // Red dragon scale mail
        const redDSM = OBJECT_KNOWLEDGE_BASE.find(b => b.name === 'red dragon scale mail');
        const redDSMFull = OBJECT_KNOWLEDGE_MAP.get(redDSM.onum);
        const specs = getAdaptiveItemSpecs(redDSMFull);

        const ids = specs.map(s => s.id);
        expect(ids).toContain('ac');
        expect(ids).toContain('armorSlot');
        expect(ids).toContain('propConveyed');
        expect(ids).not.toContain('damage');
        expect(ids).not.toContain('hands');

        const acSpec = specs.find(s => s.id === 'ac');
        expect(acSpec.value).toBe('+9 (AC 1)');
        expect(acSpec.acBonus).toBe(9);
        expect(acSpec.ac).toBe(1);

        const propSpec = specs.find(s => s.id === 'propConveyed');
        expect(propSpec.value).toContain('火炎耐性');
    });

    it('should generate wand specs with Zap Type and Charged without weapon/armor specs', () => {
        // Wand of death
        const deathWand = OBJECT_KNOWLEDGE_BASE.find(b => b.category === 'WAND' && (b.name === 'death' || b.sn === 'WAN_DEATH'));
        const deathWandFull = OBJECT_KNOWLEDGE_MAP.get(deathWand.onum);
        const specs = getAdaptiveItemSpecs(deathWandFull);

        const ids = specs.map(s => s.id);
        expect(ids).toContain('zapType');
        expect(ids).toContain('charged');
        expect(ids).not.toContain('damage');
        expect(ids).not.toContain('ac');

        const zapSpec = specs.find(s => s.id === 'zapType');
        expect(zapSpec.value).toContain('Ray');
    });

    it('should generate spellbook specs with Spell Level and School', () => {
        // Spellbook of identify or any spellbook
        const spbook = OBJECT_KNOWLEDGE_BASE.find(b => b.category === 'SPELLBOOK' && b.spellLevel);
        const spbookFull = OBJECT_KNOWLEDGE_MAP.get(spbook.onum);
        const specs = getAdaptiveItemSpecs(spbookFull);

        const ids = specs.map(s => s.id);
        expect(ids).toContain('spellLevel');
        expect(ids).toContain('spellSkill');
        expect(ids).not.toContain('damage');
        expect(ids).not.toContain('ac');
    });

    it('should generate food specs with Nutrition without weapon/armor specs', () => {
        // Food ration (onum in FOOD)
        const food = OBJECT_KNOWLEDGE_BASE.find(b => b.category === 'FOOD' && b.nutrition > 0);
        const foodFull = OBJECT_KNOWLEDGE_MAP.get(food.onum);
        const specs = getAdaptiveItemSpecs(foodFull);

        const ids = specs.map(s => s.id);
        expect(ids).toContain('nutrition');
        expect(ids).not.toContain('damage');
        expect(ids).not.toContain('ac');
    });

    it('should correctly award [+] proficiency badge for skilled weapons', () => {
        const skillManager = new SkillStateManager();
        // 模擬スキル登録: long sword を Skilled (熟練) に設定
        skillManager.skills = [
            { name: 'long sword', rank: { key: 'skilled', label: '熟練', en: 'Skilled', score: 25 }, canEnhance: false }
        ];

        // Long sword
        const longSword = OBJECT_KNOWLEDGE_BASE.find(b => b.name === 'long sword');
        const longSwordFull = OBJECT_KNOWLEDGE_MAP.get(longSword.onum);

        const badge = getSkillProficiencyBadge(longSwordFull, skillManager);
        expect(badge).toBeDefined();
        expect(badge.isProficient).toBe(true);
        expect(badge.label).toBe('+ Skilled');
        expect(badge.labelJa).toBe('+ 熟練');

        // Two-handed sword (未習得)
        const twoHandedSword = OBJECT_KNOWLEDGE_MAP.get(55);
        const unlearnedBadge = getSkillProficiencyBadge(twoHandedSword, skillManager);
        expect(unlearnedBadge).toBeNull();
    });
});
