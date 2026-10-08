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
});
