import { describe, it, expect, beforeEach } from 'vitest';
import { SkillStateManager, SKILL_RANKS } from './SkillStateManager.js';

describe('SkillStateManager Tests', () => {
    let skillManager;

    beforeEach(() => {
        skillManager = new SkillStateManager();
    });

    it('初期状態は空配列で未同期であること', () => {
        expect(skillManager.getSkills()).toEqual([]);
        expect(skillManager.getActiveSkills()).toEqual([]);
        expect(skillManager.isSynced).toBe(false);
    });

    it('normalizeRank: unskilled が skilled より先に判定され文字列競合が起きないこと', () => {
        // unskilled の中に skilled が含まれているが、正しく unskilled と判定されること
        const unskilledRes = skillManager.normalizeRank('unskilled');
        expect(unskilledRes.key).toBe('unskilled');
        expect(unskilledRes.score).toBe(0);
        expect(unskilledRes.label).toBe('未熟');

        const skilledRes = skillManager.normalizeRank('skilled');
        expect(skilledRes.key).toBe('skilled');
        expect(skilledRes.score).toBe(25);
        expect(skilledRes.label).toBe('熟練');

        const expertRes = skillManager.normalizeRank('expert');
        expect(expertRes.key).toBe('expert');
        expect(expertRes.score).toBe(40);

        const basicRes = skillManager.normalizeRank('Basic');
        expect(basicRes.key).toBe('basic');
        expect(basicRes.score).toBe(10);

        const grandRes = skillManager.normalizeRank('Grand Master');
        expect(grandRes.key).toBe('grandmaster');
        expect(grandRes.score).toBe(80);

        const masterRes = skillManager.normalizeRank('Master');
        expect(masterRes.key).toBe('master');
        expect(masterRes.score).toBe(60);

        const restrictedRes = skillManager.normalizeRank('Restricted');
        expect(restrictedRes.key).toBe('restricted');
        expect(restrictedRes.score).toBe(-10);

        // 日本語判定
        expect(skillManager.normalizeRank('未熟').key).toBe('unskilled');
        expect(skillManager.normalizeRank('入門').key).toBe('basic');
        expect(skillManager.normalizeRank('熟練').key).toBe('skilled');
        expect(skillManager.normalizeRank('達人').key).toBe('expert');
        expect(skillManager.normalizeRank('名人').key).toBe('master');
        expect(skillManager.normalizeRank('師範').key).toBe('grandmaster');
        expect(skillManager.normalizeRank('不可').key).toBe('restricted');
    });

    it('#enhance メニューの英語行から正しくスキルと canEnhance をパースできること', () => {
        const sampleMenuItems = [
            { text: 'martial arts [Basic]' },
            { text: '* long sword [Skilled]' },
            { text: 'short sword [Unskilled]' },
            { text: 'dagger [Expert]' },
            { text: 'two-weapon combat [Restricted]' }
        ];

        skillManager.updateFromMenuItems(sampleMenuItems);

        expect(skillManager.isSynced).toBe(true);
        const skills = skillManager.getSkills();
        expect(skills.length).toBe(5);

        // 1. martial arts
        expect(skills[0].name).toBe('martial arts');
        expect(skills[0].rank.key).toBe('basic');
        expect(skills[0].canEnhance).toBe(false);

        // 2. * long sword
        expect(skills[1].name).toBe('long sword');
        expect(skills[1].rank.key).toBe('skilled');
        expect(skills[1].canEnhance).toBe(true);

        // 3. short sword
        expect(skills[2].name).toBe('short sword');
        expect(skills[2].rank.key).toBe('unskilled');
        expect(skills[2].canEnhance).toBe(false);

        // 4. dagger
        expect(skills[3].name).toBe('dagger');
        expect(skills[3].rank.key).toBe('expert');
        expect(skills[3].canEnhance).toBe(false);

        // 5. two-weapon combat
        expect(skills[4].name).toBe('two-weapon combat');
        expect(skills[4].rank.key).toBe('restricted');
    });

    it('#enhance メニューの日本語行から正しくパースできること', () => {
        const sampleLines = [
            '格闘 [入門]',
            '* 長剣 [熟練]',
            '短剣 [達人]',
            '弓 [未熟]'
        ];

        skillManager.updateFromLines(sampleLines);

        expect(skillManager.isSynced).toBe(true);
        const skills = skillManager.getSkills();
        expect(skills.length).toBe(4);

        expect(skills[0].name).toBe('格闘');
        expect(skills[0].rank.key).toBe('basic');
        expect(skills[0].canEnhance).toBe(false);

        expect(skills[1].name).toBe('長剣');
        expect(skills[1].rank.key).toBe('skilled');
        expect(skills[1].canEnhance).toBe(true);

        expect(skills[2].name).toBe('短剣');
        expect(skills[2].rank.key).toBe('expert');

        expect(skills[3].name).toBe('弓');
        expect(skills[3].rank.key).toBe('unskilled');
    });

    it('getActiveSkills: 有効スキル（Basic以上、または canEnhance が true のもの）のみを抽出すること', () => {
        const sampleLines = [
            'martial arts [Basic]',
            '* club [Unskilled]', // 未熟だが向上可能なので active
            'short sword [Unskilled]', // 未熟で向上不可なので除外
            'long sword [Skilled]',
            'two-weapon combat [Restricted]' // 制限なので除外
        ];

        skillManager.updateFromLines(sampleLines);

        const active = skillManager.getActiveSkills();
        expect(active.length).toBe(3);
        expect(active.map(s => s.name)).toEqual(['martial arts', 'club', 'long sword']);
    });

    it('getSkillRank: 武器名やスキル名からランク情報を検索・取得できること', () => {
        const sampleLines = [
            'long sword [Skilled]',
            'dagger [Expert]',
            'bow [Basic]'
        ];

        skillManager.updateFromLines(sampleLines);

        // 完全一致
        const lsRank = skillManager.getSkillRank('long sword');
        expect(lsRank.key).toBe('skilled');
        expect(lsRank.score).toBe(25);

        // 部分一致 (elven dagger -> dagger)
        const daggerRank = skillManager.getSkillRank('elven dagger');
        expect(daggerRank.key).toBe('expert');
        expect(daggerRank.score).toBe(40);

        // 該当なし -> Unskilled
        const axeRank = skillManager.getSkillRank('battle-axe');
        expect(axeRank.key).toBe('unskilled');
        expect(axeRank.score).toBe(0);
    });

    it('シーケンスバッファ (sequenceBuffer) からの抽出更新ができること', () => {
        const sequenceBuffer = [
            {
                title: 'Pick a skill to enhance:',
                menuItems: [
                    { text: 'a - * long sword [Skilled]' },
                    { text: 'b - short sword [Basic]' }
                ]
            }
        ];

        skillManager.updateFromSequenceBuffer(sequenceBuffer);
        expect(skillManager.isSynced).toBe(true);
        expect(skillManager.getSkills().length).toBe(2);
        expect(skillManager.getSkills()[0].name).toBe('long sword');
        expect(skillManager.getSkills()[0].canEnhance).toBe(true);
    });

    it('日本語および英語のスキル向上メッセージからキャッシュが無効化 (invalidate) されること', () => {
        skillManager.isSynced = true;

        // 英語: 向上メッセージ
        const res1 = skillManager.updateFromMessage('You are now basic in long sword.');
        expect(res1).toBe(true);
        expect(skillManager.isSynced).toBe(false);

        // 英語: 向上可能メッセージ
        skillManager.isSynced = true;
        const res2 = skillManager.updateFromMessage('You feel more confident in your dagger skills.');
        expect(res2).toBe(true);
        expect(skillManager.isSynced).toBe(false);

        // 日本語: 向上メッセージ
        skillManager.isSynced = true;
        const res3 = skillManager.updateFromMessage('短剣のスキルが入門に上がった.');
        expect(res3).toBe(true);
        expect(skillManager.isSynced).toBe(false);

        // 日本語: 向上可能メッセージ
        skillManager.isSynced = true;
        const res4 = skillManager.updateFromMessage('短剣のスキルを上げることができるようになった.');
        expect(res4).toBe(true);
        expect(skillManager.isSynced).toBe(false);

        // 無関係なメッセージでは invalidate されないこと
        skillManager.isSynced = true;
        const res5 = skillManager.updateFromMessage('You hit the goblin.');
        expect(res5).toBe(false);
        expect(skillManager.isSynced).toBe(true);
    });

    it('reset() および invalidate() で適切に状態変更されること', () => {
        skillManager.updateFromLines(['long sword [Skilled]']);
        expect(skillManager.getSkills().length).toBe(1);
        expect(skillManager.isSynced).toBe(true);

        skillManager.invalidate();
        expect(skillManager.isSynced).toBe(false);
        expect(skillManager.getSkills().length).toBe(1);

        skillManager.reset();
        expect(skillManager.getSkills().length).toBe(0);
        expect(skillManager.isSynced).toBe(false);
    });
});
