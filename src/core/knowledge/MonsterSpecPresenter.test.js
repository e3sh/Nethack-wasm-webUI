import { describe, it, expect } from 'vitest';
import { getAdaptiveMonsterSpecs, getMonsterSpecSummaryStrings } from './MonsterSpecPresenter.js';
import { ALL_MONSTER_KNOWLEDGE_BASE } from './MONSTER_KNOWLEDGE_FULL.js';

describe('MonsterSpecPresenter: フラグ動的スペック・バッジ生成テスト', () => {

    it('コカトリス (monOffset 10) から接触石化・死体石化バッジが動的生成されること', () => {
        const cockatrice = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 10);
        expect(cockatrice).toBeDefined();

        // 日本語スペック
        const specsJa = getAdaptiveMonsterSpecs(cockatrice, { language: 'ja' });
        expect(specsJa.some(s => s.id === 'trait_petrify' && s.label.includes('接触石化'))).toBe(true);
        expect(specsJa.some(s => s.id === 'corpse_hazard_petrify' && s.label.includes('接触石化'))).toBe(true);

        // 英語スペック
        const specsEn = getAdaptiveMonsterSpecs(cockatrice, { language: 'en' });
        expect(specsEn.some(s => s.id === 'trait_petrify' && s.label.includes('Petrification'))).toBe(true);
        expect(specsEn.some(s => s.id === 'corpse_hazard_petrify' && s.label.includes('Petrifies'))).toBe(true);
    });

    it('パイロリスク (monOffset 11) はコカトリス属だが石化せず、火炎視線・耐性・固有フラグが正確に定義されていること', () => {
        const pyrolisk = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 11);
        expect(pyrolisk).toBeDefined();
        expect(pyrolisk.name).toBe('pyrolisk');

        // 石化しないことの検証（警告ノイズ防止）
        expect(pyrolisk.petrifiesOnTouch).toBe(false);
        expect(pyrolisk.traits.petrifiesOnTouch).toBe(false);
        expect(pyrolisk.corpse.causesPetrification).toBe(false);

        const specsJa = getAdaptiveMonsterSpecs(pyrolisk, { language: 'ja' });
        expect(specsJa.some(s => s.id === 'trait_petrify')).toBe(false);
        // 🔥 火炎視線バッジが動的生成されること
        const fieryGazeSpecJa = specsJa.find(s => s.id === 'trait_fiery_gaze');
        expect(fieryGazeSpecJa).toBeDefined();
        expect(fieryGazeSpecJa.label).toContain('火炎視線');
        expect(fieryGazeSpecJa.label).toContain('盲目で無効');

        const specsEn = getAdaptiveMonsterSpecs(pyrolisk, { language: 'en' });
        const fieryGazeSpecEn = specsEn.find(s => s.id === 'trait_fiery_gaze');
        expect(fieryGazeSpecEn).toBeDefined();
        expect(fieryGazeSpecEn.label).toContain('Fiery Gaze');

        // 火炎視線 & 攻撃
        expect(pyrolisk.threat?.type).toBe('FIRE_GAZE');
        expect(pyrolisk.threat?.effect).toBe('FIRE');
        expect(pyrolisk.attacks).toEqual([
            { type: 'gaze', damage: '2d6', effect: 'fire' },
            { type: 'bite', damage: '1d6' }
        ]);

        // 耐性 & 死体
        expect(pyrolisk.resistances).toContain('fire');
        expect(pyrolisk.resistances).toContain('poison');
        expect(pyrolisk.corpse.edible).toBe(true);
        expect(pyrolisk.corpse.grantsIntrinsics).toContain('fire');
        expect(pyrolisk.corpse.grantsIntrinsics).toContain('poison');

        // 将来機能用の固有フラグ
        expect(pyrolisk.traits.fieryGaze).toBe(true);
        expect(pyrolisk.traits.destroysInventory).toBe(true);
        expect(pyrolisk.traits.explosiveEggs).toBe(true);
    });

    it('ブレス攻撃（冷気、火炎、電撃、分解等）を持つモンスターから属性別ブレスバッジが動的生成されること', () => {
        // 冬狼/白ドラゴン想定: 冷気ブレス
        const coldBreather = {
            name: 'winter wolf',
            attacks: [{ type: 'breath', effect: 'cold', damage: '2d6' }]
        };
        const coldSpecsJa = getAdaptiveMonsterSpecs(coldBreather, { language: 'ja' });
        const coldBadge = coldSpecsJa.find(s => s.id === 'trait_breath');
        expect(coldBadge).toBeDefined();
        expect(coldBadge.label).toBe('吹雪ブレス (直線射線/反射有効)');
        expect(coldBadge.type).toBe('danger');

        const coldSpecsEn = getAdaptiveMonsterSpecs(coldBreather, { language: 'en' });
        expect(coldSpecsEn.find(s => s.id === 'trait_breath')?.label).toBe('Cold Breath (Ray/Reflectable)');

        // 赤ドラゴン想定: 火炎ブレス
        const fireBreather = {
            name: 'red dragon',
            attacks: [{ type: 'breath', effect: 'fire' }]
        };
        const fireSpecs = getAdaptiveMonsterSpecs(fireBreather, { language: 'ja' });
        expect(fireSpecs.find(s => s.id === 'trait_breath')?.label).toBe('火炎ブレス (直線射線/反射有効)');

        // 青ドラゴン想定: 電撃ブレス
        const elecBreather = {
            name: 'blue dragon',
            traits: { breath: 'lightning' }
        };
        const elecSpecs = getAdaptiveMonsterSpecs(elecBreather, { language: 'ja' });
        expect(elecSpecs.find(s => s.id === 'trait_breath')?.label).toBe('電撃ブレス (直線射線/反射有効)');

        // 黒ドラゴン想定: 分解ブレス (ハイライト & 即死警告)
        const disintBreather = {
            name: 'black dragon',
            attacks: [{ type: 'breath', effect: 'disintegration' }]
        };
        const disintSpecs = getAdaptiveMonsterSpecs(disintBreather, { language: 'ja' });
        const disintBadge = disintSpecs.find(s => s.id === 'trait_breath');
        expect(disintBadge?.label).toBe('分解ブレス (即死級/反射必須)');
        expect(disintBadge?.highlight).toBe(true);
    });

    it('winter wolf cub (monOffset 22) および winter wolf (monOffset 24) から吹雪ブレスバッジ・冷気耐性が動的生成されること', () => {
        // 22: winter wolf cub
        const cub = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 22);
        expect(cub).toBeDefined();
        expect(cub.name).toBe('winter wolf cub');
        expect(cub.threat?.type).toBe('COLD_BREATH');

        const cubSpecsJa = getAdaptiveMonsterSpecs(cub, { language: 'ja' });
        const cubBreathBadge = cubSpecsJa.find(s => s.id === 'trait_breath');
        expect(cubBreathBadge).toBeDefined();
        expect(cubBreathBadge.label).toBe('吹雪ブレス (直線射線/反射有効)');
        expect(cub.resistances).toContain('cold');
        expect(cub.corpse.grantsIntrinsics).toContain('cold');

        // 24: winter wolf
        const wolf = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 24);
        expect(wolf).toBeDefined();
        expect(wolf.name).toBe('winter wolf');
        expect(wolf.dangerLevel).toBe('HIGH');
        expect(wolf.threat?.type).toBe('COLD_BREATH');

        const wolfSpecsJa = getAdaptiveMonsterSpecs(wolf, { language: 'ja' });
        const wolfBreathBadge = wolfSpecsJa.find(s => s.id === 'trait_breath');
        expect(wolfBreathBadge).toBeDefined();
        expect(wolfBreathBadge.label).toBe('吹雪ブレス (直線射線/反射有効)');
        expect(wolf.resistances).toContain('cold');
        expect(wolf.corpse.grantsIntrinsics).toContain('cold');
    });

    it('浮遊目玉 (monOffset 28) から麻痺視線バッジおよび死体テレパシー獲得バッジが動的生成されること', () => {
        const floatingEye = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 28);
        expect(floatingEye).toBeDefined();

        const specsJa = getAdaptiveMonsterSpecs(floatingEye, { language: 'ja' });
        expect(specsJa.some(s => s.id === 'trait_paralysis_gaze' && s.label.includes('麻痺視線'))).toBe(true);
    });

    it('マインドフレア (monOffset 48) から知力吸い/脳食いバッジが動的生成されること', () => {
        const mindFlayer = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 48);
        expect(mindFlayer).toBeDefined();

        const specsJa = getAdaptiveMonsterSpecs(mindFlayer, { language: 'ja' });
        expect(specsJa.some(s => s.id === 'trait_brain_eat' && s.label.includes('知力吸い/脳食い'))).toBe(true);
    });

    it('getMonsterSpecSummaryStrings が図鑑表示用文字列リストを正確に出力すること', () => {
        const cockatrice = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 10);
        const summariesJa = getMonsterSpecSummaryStrings(cockatrice, { language: 'ja' });
        expect(Array.isArray(summariesJa)).toBe(true);
        expect(summariesJa.length).toBeGreaterThan(0);
        expect(summariesJa.some(str => str.includes('接触石化'))).toBe(true);

        const summariesEn = getMonsterSpecSummaryStrings(cockatrice, { language: 'en' });
        expect(summariesEn.some(str => str.includes('Petrification'))).toBe(true);
    });

    it('手書きテキストが存在しない空のモンスターでも安全にフォールバックサマリーを返すこと', () => {
        const emptyMon = { name: 'generic monster', stats: { hd: 2, ac: 8 } };
        const summaries = getMonsterSpecSummaryStrings(emptyMon, { language: 'ja' });
        expect(summaries.length).toBe(2);
        expect(summaries[0]).toContain('標準的な魔獣');
    });
});
