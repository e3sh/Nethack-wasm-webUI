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

    it('syncs player profile from direct binding and protects against legacy overrides (Stage 8.5)', () => {
        const mockProfile = {
            roleIndex: 11, // Valkyrie
            raceIndex: 2,  // Dwarf
            genderIndex: 1, // female
            alignType: 1,  // lawful
            level: 1,
            role: 'valkyrie',
            race: 'dwarf',
            gender: 'female',
            alignment: 'lawful',
            roleName: 'Valkyrie',
            raceName: 'Dwarf',
            playerName: 'Brunhilde'
        };

        const changed = manager.syncPlayerProfileFromDirectBinding(mockProfile);
        expect(changed).toBe(true);
        expect(manager.isSynced).toBe(true);
        expect(manager.isProfileDirectBound).toBe(true);

        // キャラクタサマリーの日本語・英語検証
        const summaryJa = manager.getCharacterSummary('ja');
        expect(summaryJa.role).toBe('valkyrie');
        expect(summaryJa.race).toBe('dwarf');
        expect(summaryJa.roleNameJa).toBe('ワルキューレ');
        expect(summaryJa.raceNameJa).toBe('ドワーフ');
        expect(summaryJa.alignNameJa).toBe('秩序');
        expect(summaryJa.playerName).toBe('Brunhilde');
        expect(summaryJa.displayTagJa).toBe('👤 ドワーフ / ワルキューレ Lv.1');

        const summaryEn = manager.getCharacterSummary('en');
        expect(summaryEn.roleNameEn).toBe('Valkyrie');
        expect(summaryEn.raceNameEn).toBe('Dwarf');
        expect(summaryEn.alignNameEn).toBe('Lawful');
        expect(summaryEn.displayTagEn).toBe('👤 Dwarf / Valkyrie Lv.1');

        // 生来のドワーフ暗視耐性 (infravision) が自動計算されていること
        expect(manager.innate.infravision).toBe(true);
        expect(manager.intrinsics.infravision).toBe(true);

        // レガシー推測コード (updateCharacter / 称号 "Shield Maiden" 混同等) による上書きがブロックされること
        const blocked = manager.updateCharacter({ role: 'archeologist', race: 'human' });
        expect(blocked).toBe(false);
        // 真値が維持されていること
        expect(manager.characterInfo.role).toBe('valkyrie');
        expect(manager.characterInfo.race).toBe('dwarf');

        // ただしレベルアップなどの動的数値変化は許可されること
        manager.updateCharacter({ level: 5 });
        expect(manager.characterInfo.level).toBe(5);
        expect(manager.characterInfo.role).toBe('valkyrie');
    });

    it('automatically syncs profile via syncFromDirectBinding when service provides getPlayerProfile', () => {
        const mockService = {
            getPlayerProps: () => new Array(69).fill(0),
            getPlayerProfile: () => ({
                role: 'wizard',
                race: 'elf',
                gender: 'male',
                alignment: 'chaotic',
                level: 3,
                playerName: 'Gandalf'
            })
        };

        manager.syncFromDirectBinding(mockService);

        expect(manager.isProfileDirectBound).toBe(true);
        const summary = manager.getCharacterSummary('ja');
        expect(summary.roleNameJa).toBe('魔法使い');
        expect(summary.raceNameJa).toBe('エルフ');
        expect(summary.alignNameJa).toBe('混沌');
        expect(summary.playerName).toBe('Gandalf');
        expect(summary.level).toBe(3);
    });

    it('correctly updates to new character profile after reset and new game start', () => {
        // 1回目のゲーム: Valkyrie / Dwarf
        const game1Service = {
            getPlayerProps: () => new Array(69).fill(0),
            getPlayerProfile: () => ({
                role: 'valkyrie',
                race: 'dwarf',
                gender: 'female',
                alignment: 'lawful',
                level: 1,
                playerName: 'Brunhilde'
            })
        };
        manager.syncFromDirectBinding(game1Service);
        expect(manager.characterInfo.role).toBe('valkyrie');
        expect(manager.characterInfo.race).toBe('dwarf');

        // quit / restart: manager.reset() が呼ばれる
        manager.reset();
        expect(manager.isProfileDirectBound).toBe(false);
        expect(manager.isSynced).toBe(false);
        expect(manager.characterInfo.role).toBe('archeologist');
        expect(manager.characterInfo.race).toBe('human');

        // 2回目のゲーム: Samurai / Human
        const game2Service = {
            getPlayerProps: () => new Array(69).fill(0),
            getPlayerProfile: () => ({
                role: 'samurai',
                race: 'human',
                gender: 'male',
                alignment: 'lawful',
                level: 1,
                playerName: 'Musashi'
            })
        };
        manager.syncFromDirectBinding(game2Service);

        // 前回の Valkyrie / Dwarf ではなく、新しい Samurai / Human に更新されていること
        expect(manager.isProfileDirectBound).toBe(true);
        expect(manager.characterInfo.role).toBe('samurai');
        expect(manager.characterInfo.race).toBe('human');
        expect(manager.characterInfo.playerName).toBe('Musashi');
        const summary = manager.getCharacterSummary('ja');
        expect(summary.roleNameJa).toBe('侍');
        expect(summary.raceNameJa).toBe('人間');
    });

    describe('updateFromStatus (Safe attribute and player name sync)', () => {
        it('syncs playerName, alignment, and level from status without guessing role or race', () => {
            const status = {
                title: 'Brunhilde the Stripling',
                align: 'Lawful',
                level: 1
            };

            const changed = manager.updateFromStatus(status);
            expect(changed).toBe(true);
            expect(manager.characterInfo.playerName).toBe('Brunhilde');
            expect(manager.characterInfo.alignment).toBe('lawful');
            expect(manager.characterInfo.level).toBe(1);

            // 称号からの職業・種族推測は行われないため初期値のまま
            expect(manager.characterInfo.role).toBe('archeologist');
            expect(manager.characterInfo.race).toBe('human');
        });

        it('does not overwrite direct bound profile when updateFromStatus is called', () => {
            // 先に Direct Binding で確定（Dwarf Valkyrie）
            manager.syncPlayerProfileFromDirectBinding({
                role: 'valkyrie',
                race: 'dwarf',
                gender: 'female',
                alignment: 'lawful',
                playerName: 'Brunhilde'
            });

            expect(manager.characterInfo.race).toBe('dwarf');
            expect(manager.characterInfo.role).toBe('valkyrie');

            // ステータス更新が届く
            manager.updateFromStatus({
                title: 'Brunhilde the Stripling',
                align: 'Lawful',
                level: 2
            });

            // レベルは 2 に更新され、種族とロールは Direct Binding の真値のまま保護される
            expect(manager.characterInfo.level).toBe(2);
            expect(manager.characterInfo.race).toBe('dwarf');
            expect(manager.characterInfo.role).toBe('valkyrie');
            expect(manager.characterInfo.playerName).toBe('Brunhilde');
        });
    });
});

