import { describe, it, expect } from 'vitest';
import { StatusAccessor } from './StatusAccessor.js';

describe('StatusAccessor', () => {
    it('フィールド更新により構造化ステータスが生成されること', () => {
        const status = new StatusAccessor();
        
        // BL_HP = 18, BL_HPMAX = 19, BL_GOLD = 10 (NetHack c-header 定義数値)
        status.updateField(18, 25);
        status.updateField(19, 30);
        status.updateField(10, 150);

        const res = status.getStatus();
        expect(res.hp).toBeDefined();
        expect(res.hp.current).toBe(25);
        expect(res.hp.max).toBe(30);
        expect(res.gold.amount).toBe(150);
    });

    it('ダンジョン階層 (BL_DLEVEL = 20) がパースできること', () => {
        const status = new StatusAccessor();
        status.updateField(20, "Dlvl:3");

        const res = status.getStatus();
        expect(res.dlevel).toBeDefined();
        expect(res.dlevel.text).toBe("Dlvl:3");
        expect(res.dlevel.level).toBe(3);
    });

    it('アライメント (BL_ALIGN = 7) および各基本能力値 (BL_STR~BL_CHA = 1~6) が正常にパースできること', () => {
        const status = new StatusAccessor();
        status.updateField(7, "Neutral");
        status.updateField(1, "18/50");
        status.updateField(2, 16);
        status.updateField(3, 15);
        status.updateField(4, 12);
        status.updateField(5, 10);
        status.updateField(6, 9);

        const res = status.getStatus();
        expect(res.align).toBe("Neutral");
        expect(res.stats.str).toBe("18/50");
        expect(res.stats.dex).toBe(16);
        expect(res.stats.con).toBe(15);
        expect(res.stats.int).toBe(12);
        expect(res.stats.wis).toBe(10);
        expect(res.stats.cha).toBe(9);
    });
});
