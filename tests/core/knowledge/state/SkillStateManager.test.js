import { describe, it, expect, beforeEach } from 'vitest';
import { SkillStateManager, SKILL_RANKS } from '../../../../src/core/knowledge/state/SkillStateManager.js';

describe('SkillStateManager 単体テスト', () => {
    let skillManager;

    beforeEach(() => {
        skillManager = new SkillStateManager();
    });

    it('初期状態では未同期かつスキルリストが空であること', () => {
        expect(skillManager.isSynced).toBe(false);
        expect(skillManager.getSkills()).toEqual([]);
        expect(skillManager.getActiveSkills()).toEqual([]);
        expect(skillManager.getTwoWeaponSkill()).toBeNull();
    });

    it('syncFromDirectBinding で Direct Binding サービスからスキル一覧を正常に同期できること', () => {
        const mockDirectService = {
            getSkills: () => [
                {
                    id: 7,
                    name: 'long sword',
                    nameJa: 'ロングソード',
                    nameRaw: 'long sword',
                    skillLevel: 2,
                    maxSkillLevel: 3,
                    rank: SKILL_RANKS.BASIC,
                    maxRank: SKILL_RANKS.SKILLED,
                    isRestricted: false,
                    canEnhance: true,
                    weaponSlots: 1
                },
                {
                    id: 36,
                    name: 'two-weapon combat',
                    nameJa: '二刀流',
                    nameRaw: 'two-weapon combat',
                    skillLevel: 1,
                    maxSkillLevel: 2,
                    rank: SKILL_RANKS.UNSKILLED,
                    maxRank: SKILL_RANKS.BASIC,
                    isRestricted: false,
                    canEnhance: false,
                    weaponSlots: 1
                }
            ]
        };

        const changed = skillManager.syncFromDirectBinding(mockDirectService);
        expect(changed).toBe(true);
        expect(skillManager.isSynced).toBe(true);
        expect(skillManager.getSkills().length).toBe(2);

        const longSword = skillManager.getSkills()[0];
        expect(longSword.name).toBe('long sword');
        expect(longSword.rank.key).toBe('basic');
        expect(longSword.canEnhance).toBe(true);

        const twoWeapon = skillManager.getTwoWeaponSkill();
        expect(twoWeapon).not.toBeNull();
        expect(twoWeapon.rank.key).toBe('unskilled');
        expect(skillManager.canTwoWeapon()).toBe(true);

        // 同一データで再同期した場合は変更なし (false) を返却
        const reChanged = skillManager.syncFromDirectBinding(mockDirectService);
        expect(reChanged).toBe(false);
    });

    it('directBindingService が不正または空配列の場合は変更せず false を返すこと', () => {
        expect(skillManager.syncFromDirectBinding(null)).toBe(false);
        expect(skillManager.syncFromDirectBinding({})).toBe(false);
        expect(skillManager.syncFromDirectBinding({ getSkills: () => [] })).toBe(false);
        expect(skillManager.isSynced).toBe(false);
    });

    it('reset / invalidate で状態が適切にクリア・無効化されること', () => {
        const mockDirectService = {
            getSkills: () => [{
                id: 1,
                name: 'dagger',
                rank: SKILL_RANKS.BASIC,
                canEnhance: false,
                skillLevel: 2,
                weaponSlots: 0
            }]
        };

        skillManager.syncFromDirectBinding(mockDirectService);
        expect(skillManager.isSynced).toBe(true);

        skillManager.invalidate();
        expect(skillManager.isSynced).toBe(false);
        expect(skillManager.getSkills().length).toBe(1);

        skillManager.reset();
        expect(skillManager.isSynced).toBe(false);
        expect(skillManager.getSkills().length).toBe(0);
    });
});
