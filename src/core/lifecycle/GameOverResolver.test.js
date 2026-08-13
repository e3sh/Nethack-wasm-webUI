import { describe, it, expect } from 'vitest';
import { GameOverResolver } from './GameOverResolver.js';

describe('GameOverResolver', () => {
    it('record テキスト行を ScoreboardEntry 配列へパースできること', () => {
        // NetHack record / logfile フォーマット例
        const rawRecord = "3.7.0 1050 1 1 50 60 1 Valkyrie Human Female Lawful Agent killed by a goblin";
        const entries = GameOverResolver.parseRecordText(rawRecord);

        expect(entries).toBeDefined();
        expect(Array.isArray(entries)).toBe(true);
    });

    it('driver が null の場合にデフォルトの判定結果を返すこと', async () => {
        const res = await GameOverResolver.resolveGameOver(null);
        expect(res.isGameOver).toBe(false);
        expect(res.reason).toBe('unknown');
        expect(res.scoreboard).toEqual([]);
    });
});
