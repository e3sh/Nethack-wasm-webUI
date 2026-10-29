import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MessageTokenCatalog, { TOKEN_PATTERNS, TOKEN_PREFIX_BUCKETS } from '../src/core/message/data/MessageTokenCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 1: MessageTokenCatalog 整合性テスト', () => {
    it('カタログファイルが 300KB 未満であること (DoD制約)', () => {
        const catalogPath = path.resolve(__dirname, '../src/core/message/data/MessageTokenCatalog.js');
        const stats = fs.statSync(catalogPath);
        const sizeKb = stats.size / 1024.0;
        expect(sizeKb).toBeLessThan(300.0);
        console.log(`[MessageTokenCatalog.test] Actual size: ${sizeKb.toFixed(2)} KB`);
    });

    it('TOKEN_PATTERNS と TOKEN_PREFIX_BUCKETS が正しくエクスポートされていること', () => {
        expect(Array.isArray(TOKEN_PATTERNS)).toBe(true);
        expect(TOKEN_PATTERNS.length).toBeGreaterThan(500);
        expect(typeof TOKEN_PREFIX_BUCKETS).toBe('object');
        expect(TOKEN_PREFIX_BUCKETS).not.toBeNull();
        expect(Array.isArray(TOKEN_PREFIX_BUCKETS['You '])).toBe(true);
        expect(Array.isArray(TOKEN_PREFIX_BUCKETS['*'])).toBe(true);
    });

    it('全エントリが妥当なタプル構造を持ち、正規表現としてコンパイル可能であること', () => {
        const allowedTypes = new Set(['monster', 'item', 'text']);

        for (let i = 0; i < TOKEN_PATTERNS.length; i++) {
            const entry = TOKEN_PATTERNS[i];
            expect(Array.isArray(entry)).toBe(true);
            expect(entry.length).toBe(5);

            const [patternStr, tokenTypes, id, callee, file] = entry;
            expect(typeof patternStr).toBe('string');
            expect(patternStr.startsWith('^')).toBe(true);
            expect(patternStr.endsWith('$')).toBe(true);

            expect(Array.isArray(tokenTypes)).toBe(true);
            expect(tokenTypes.length).toBeGreaterThan(0);
            const hasEntity = tokenTypes.some(t => t === 'monster' || t === 'item');
            expect(hasEntity).toBe(true);

            for (const t of tokenTypes) {
                expect(allowedTypes.has(t)).toBe(true);
            }

            expect(typeof id).toBe('string');
            expect(typeof callee).toBe('string');
            expect(typeof file).toBe('string');

            // 正規表現コンパイル検証
            expect(() => new RegExp(patternStr)).not.toThrow();
        }
    });

    it('TOKEN_PREFIX_BUCKETS のインデックスが全て有効な範囲内であること', () => {
        const totalPatterns = TOKEN_PATTERNS.length;
        for (const [bucketKey, indices] of Object.entries(TOKEN_PREFIX_BUCKETS)) {
            for (const idx of indices) {
                expect(typeof idx).toBe('number');
                expect(idx).toBeGreaterThanOrEqual(0);
                expect(idx).toBeLessThan(totalPatterns);
            }
        }
    });

    it('代表的なメッセージパターンが正しくマッチし、トークン型が判定できること', () => {
        // 例: "^You\\ drop\\ (.*?)\\.$"
        const dropPattern = TOKEN_PATTERNS.find(p => p[0] === '^You\\ drop\\ (.*?)\\.$');
        expect(dropPattern).toBeDefined();

        const regex = new RegExp(dropPattern[0]);
        const testMsg = "You drop an elven dagger.";
        const match = regex.exec(testMsg);
        expect(match).not.toBeNull();
        if (match) {
            expect(match[1]).toBe('an elven dagger');
            expect(dropPattern[1][0]).toBe('item');
        }

        // 例: "You displace %s." またはモンスター解放パターン "^You\\ release\\ (.*?)\\.$"
        const monPattern = TOKEN_PATTERNS.find(p => p[0] === '^You\\ release\\ (.*?)\\.$');
        expect(monPattern).toBeDefined();
        const monRegex = new RegExp(monPattern[0]);
        const monMatch = monRegex.exec("You release the kitten.");
        expect(monMatch).not.toBeNull();
        if (monMatch) {
            expect(monMatch[1]).toBe('the kitten');
            expect(monPattern[1][0]).toBe('monster');
        }
    });

    it('過剰一般化されたパターン (dokick.c の ^There is (.*?) here\\.$ や mhitu.c の ^You get (.*?)!$ 等) が除外されていること', () => {
        const dokickEntry = TOKEN_PATTERNS.find(p => p[2] === 'dokick.c:L169:There:3');
        expect(dokickEntry).toBeUndefined();

        const broadTherePattern = TOKEN_PATTERNS.find(p => p[0] === '^There\\ is\\ (.*?)\\ here\\.$');
        expect(broadTherePattern).toBeUndefined();

        const mhituEntry = TOKEN_PATTERNS.find(p => p[2] === 'mhitu.c:L1560:You:70');
        expect(mhituEntry).toBeUndefined();

        const broadYouGetPattern = TOKEN_PATTERNS.find(p => p[0] === '^You\\ get\\ (.*?)\\!$');
        expect(broadYouGetPattern).toBeUndefined();
    });
});
