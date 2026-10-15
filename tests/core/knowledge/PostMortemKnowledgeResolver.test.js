import { describe, it, expect } from 'vitest';
import { PostMortemKnowledgeResolver } from '../../../src/core/knowledge/services/PostMortemKnowledgeResolver.js';

describe('PostMortemKnowledgeResolver - 事後ナレッジ連携＆死因解析エンジン', () => {
    it('1. 昇天 (Ascended) を正しく検知し、祝賀メッセージを返却すること', () => {
        const result = PostMortemKnowledgeResolver.resolve('ascended to demigod-hood');
        expect(result.category).toBe('ASCENDED');
        expect(result.isVictory).toBe(true);
        expect(result.translatedDeath).toContain('昇天した');
    });

    it('2. 飢餓死 (Starvation) を検知し、ADVICE_SURVIVAL_STARVATION をバインドすること', () => {
        const result = PostMortemKnowledgeResolver.resolve('died of starvation');
        expect(result.category).toBe('STARVATION');
        expect(result.isVictory).toBe(false);
        expect(result.translatedDeath).toBe('飢えにより力尽きた');
        expect(result.advice).toBeDefined();
        expect(result.advice.id).toBe('ADVICE_SURVIVAL_STARVATION');
        expect(result.countermeasureJa).toContain('神に祈る');
    });

    it('3. 石化死 (Petrification) を検知し、ADVICE_THREAT_PETRIFICATION をバインドすること', () => {
        const result = PostMortemKnowledgeResolver.resolve('petrified by touching a chickatrice corpse');
        expect(result.category).toBe('PETRIFICATION');
        expect(result.translatedDeath).toContain('石化した');
        expect(result.advice).toBeDefined();
        expect(result.advice.id).toBe('ADVICE_THREAT_PETRIFICATION');
        expect(result.countermeasureJa).toContain('トカゲの死骸');
    });

    it('4. モンスターによる殺害 (Killed by cockatrice) を検知し、日本語モンスター名と対策を解決すること', () => {
        const result = PostMortemKnowledgeResolver.resolve('killed by a cockatrice');
        expect(result.category).toBe('THREAT_MONSTER');
        expect(result.translatedDeath).toBe('コカトリスに倒された');
        expect(result.entity.nameEn).toBe('cockatrice');
        expect(result.entity.nameJa).toBe('コカトリス');
        expect(result.advice.id).toBe('ADVICE_THREAT_PETRIFICATION');
        expect(result.countermeasureJa).toContain('手袋');
        expect(result.loreLink.target).toBe('adventure_log.html');
    });

    it('5. 浮遊目玉との戦闘での死亡を検知し、ADVICE_THREAT_FLOATING_EYE をバインドすること', () => {
        const result = PostMortemKnowledgeResolver.resolve('killed by a floating eye while frozen');
        expect(result.category).toBe('THREAT_MONSTER');
        expect(result.translatedDeath).toContain('目');
        expect(result.advice.id).toBe('ADVICE_THREAT_FLOATING_EYE');
        expect(result.countermeasureJa).toContain('目隠し');
    });

    it('6. 窒息死 (Choked on food) を検知し、アイテム名と対策を解決すること', () => {
        const result = PostMortemKnowledgeResolver.resolve('choked on a meatball');
        expect(result.category).toBe('CHOKING');
        expect(result.translatedDeath).toContain('窒息死した');
        expect(result.countermeasureJa).toContain('満腹状態');
    });

    it('7. 溺死 (Drowning) を検知し、水没対策を解決すること', () => {
        const result = PostMortemKnowledgeResolver.resolve('drowned in a pool of water');
        expect(result.category).toBe('DROWNING');
        expect(result.translatedDeath).toContain('溺死した');
        expect(result.countermeasureJa).toContain('浮遊の指輪');
    });

    it('8. 冒険放棄 (Quit) を検知すること', () => {
        const result = PostMortemKnowledgeResolver.resolve('quit');
        expect(result.category).toBe('QUIT');
        expect(result.translatedDeath).toBe('冒険を途中で断念した');
    });

    it('9. resolve() の戻り値に translatedDeathJa が含まれ translatedDeath と同値であること (キー互換性保証)', () => {
        const patterns = [
            'ascended to demigod-hood',
            'quit',
            'escaped the dungeon',
            'died of starvation',
            'petrified by touching a chickatrice corpse',
            'choked on a meatball',
            'drowned in a pool of water',
            'killed by a goblin',
            'crushed by a falling boulder'
        ];
        for (const pattern of patterns) {
            const report = PostMortemKnowledgeResolver.resolve(pattern);
            expect(report.translatedDeathJa).toBeDefined();
            expect(report.translatedDeathJa).toBe(report.translatedDeath);
        }
    });

    describe('translateDeathReason 静的メソッドのテスト', () => {
        it('正常系: 代表的な死因が正しく日本語文字列として返ること', () => {
            // 昇天
            expect(PostMortemKnowledgeResolver.translateDeathReason('ascended to demigod-hood'))
                .toBe('世界の主として昇天した！');

            // 冒険断念
            expect(PostMortemKnowledgeResolver.translateDeathReason('quit'))
                .toBe('冒険を途中で断念した');

            // 飢餓死
            expect(PostMortemKnowledgeResolver.translateDeathReason('died of starvation'))
                .toBe('飢えにより力尽きた');

            // 石化死
            expect(PostMortemKnowledgeResolver.translateDeathReason('petrified by a cockatrice'))
                .toContain('石化した');

            // モンスターによる殺害
            expect(PostMortemKnowledgeResolver.translateDeathReason('killed by a cockatrice'))
                .toBe('コカトリスに倒された');

            // 窒息死
            expect(PostMortemKnowledgeResolver.translateDeathReason('choked on a meatball'))
                .toContain('窒息死した');

            // 溺死
            expect(PostMortemKnowledgeResolver.translateDeathReason('drowned in a pool of water'))
                .toBe('水底に沈んで溺死した');
        });

        it('異常系・エッジケース: null, undefined, 空文字を与えても例外を投げずに空文字を返却すること', () => {
            expect(PostMortemKnowledgeResolver.translateDeathReason(null)).toBe('');
            expect(PostMortemKnowledgeResolver.translateDeathReason(undefined)).toBe('');
            expect(PostMortemKnowledgeResolver.translateDeathReason('')).toBe('');
            expect(PostMortemKnowledgeResolver.translateDeathReason('   ')).toBe('');
            expect(PostMortemKnowledgeResolver.translateDeathReason(12345)).toBe('');
        });

        it('未知の死因英文が与えられた場合、例外を投げずに原文死因にフォールバックすること', () => {
            const unknownDeath = 'fell into a cosmic rift';
            const result = PostMortemKnowledgeResolver.translateDeathReason(unknownDeath);
            expect(result).toBe(unknownDeath);
        });
    });
});
