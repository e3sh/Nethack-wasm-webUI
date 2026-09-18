import { describe, it, expect } from 'vitest';
import { ElberethAnalyzer, WARD_STATUS, PRISTINE_ELBERETH } from './ElberethAnalyzer.js';

describe('ElberethAnalyzer - 床の刻み文字 & 結界解析器', () => {
    it('完全一致の "Elbereth" で 100% 残存率かつ結界有効 (ACTIVE) であること', () => {
        const result = ElberethAnalyzer.analyze('Elbereth');
        expect(result.isElbereth).toBe(true);
        expect(result.isWardActive).toBe(true);
        expect(result.elberethIntegrity).toBe(1.0);
        expect(result.status).toBe(WARD_STATUS.ACTIVE);
        expect(result.pristineText).toBe('Elbereth');
        expect(result.warning).toContain('結界有効');
    });

    it('末尾文字が欠けた "Elber" で劣化判定 (DEGRADED) かつ結界無効であること', () => {
        const result = ElberethAnalyzer.analyze('Elber');
        expect(result.isElbereth).toBe(true);
        expect(result.isWardActive).toBe(false);
        expect(result.elberethIntegrity).toBeGreaterThan(0.5);
        expect(result.elberethIntegrity).toBeLessThan(1.0);
        expect(result.status).toBe(WARD_STATUS.DEGRADED);
        expect(result.pristineText).toBe('Elbereth');
        expect(result.warning).toContain('結界無効');
    });

    it('文字消え "?" や "." を含む "Elber?th" で劣化判定されること', () => {
        const result = ElberethAnalyzer.analyze('Elber?th');
        expect(result.isElbereth).toBe(true);
        expect(result.isWardActive).toBe(false);
        expect(result.elberethIntegrity).toBeGreaterThanOrEqual(0.8);
        expect(result.status).toBe(WARD_STATUS.DEGRADED);
    });

    it('wipeout_text 劣化文字 (例: "Flbereth", "Elbcret|") でも正しく原型照合されること', () => {
        const result = ElberethAnalyzer.analyze('Elbcret|');
        expect(result.isElbereth).toBe(true);
        expect(result.isWardActive).toBe(false);
        expect(result.status).toBe(WARD_STATUS.DEGRADED);
    });

    it('大文字小文字違い "elbereth" は結界無効 (DEGRADED) として扱われること', () => {
        const result = ElberethAnalyzer.analyze('elbereth');
        expect(result.isElbereth).toBe(true);
        expect(result.isWardActive).toBe(false);
        expect(result.status).toBe(WARD_STATUS.DEGRADED);
    });

    it('無関係な落書き ("Rest in Peace", "Kilroy was here", "hello") で NONE となること', () => {
        const r1 = ElberethAnalyzer.analyze('Rest in Peace');
        expect(r1.isElbereth).toBe(false);
        expect(r1.isWardActive).toBe(false);
        expect(r1.elberethIntegrity).toBe(0.0);
        expect(r1.status).toBe(WARD_STATUS.NONE);
        expect(r1.pristineText).toBeNull();

        const r2 = ElberethAnalyzer.analyze('Kilroy was here');
        expect(r2.isElbereth).toBe(false);

        const r3 = ElberethAnalyzer.analyze('');
        expect(r3.isElbereth).toBe(false);

        const r4 = ElberethAnalyzer.analyze(null);
        expect(r4.isElbereth).toBe(false);
    });
});
