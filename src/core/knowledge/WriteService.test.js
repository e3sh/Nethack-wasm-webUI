import { describe, it, expect, beforeEach } from 'vitest';
import { WriteService, WRITE_SAFETY_STATUS, SCROLL_BASE_COSTS, WRITE_PRESETS } from './WriteService.js';

describe('WriteService', () => {
    let service;

    beforeEach(() => {
        service = new WriteService();
    });

    describe('カタログ生成 (getCatalog)', () => {
        it('巻物カタログが正しく取得でき、除外対象が含まれないこと', () => {
            const scrolls = service.getCatalog('SCROLL');
            expect(scrolls.length).toBeGreaterThan(15);

            // 虐殺の巻物が含まれること
            const geno = scrolls.find(s => s.writeName === 'genocide');
            expect(geno).toBeDefined();
            expect(geno.baseCost).toBe(30);
            expect(geno.costRange).toEqual([15, 30]);

            // 鑑定の巻物が含まれること
            const iden = scrolls.find(s => s.writeName === 'identify');
            expect(iden).toBeDefined();
            expect(iden.baseCost).toBe(14);
            expect(iden.costRange).toEqual([7, 14]);

            // 除外アイテム（白紙、汎用）が含まれないこと
            expect(scrolls.some(s => s.writeName === 'blank paper')).toBe(false);
            expect(scrolls.some(s => s.writeName === 'generic scroll')).toBe(false);
        });

        it('魔法書カタログが正しく取得でき、レベル・コストが正しく計算されること', () => {
            const books = service.getCatalog('SPELLBOOK');
            expect(books.length).toBeGreaterThan(20);

            // 識別の呪文書 (Lv3)
            const idenBook = books.find(b => b.writeName === 'identify');
            expect(idenBook).toBeDefined();
            expect(idenBook.level).toBe(3);
            expect(idenBook.baseCost).toBe(30);
            expect(idenBook.costRange).toEqual([15, 30]);

            // 魔法の矢 (Lv2)
            const mmBook = books.find(b => b.writeName === 'magic missile');
            expect(mmBook).toBeDefined();
            expect(mmBook.level).toBe(2);
            expect(mmBook.baseCost).toBe(20);
            expect(mmBook.costRange).toEqual([10, 20]);

            // 除外アイテム（死者の書、小説、白紙）が含まれないこと
            expect(books.some(b => b.writeName === 'book of the dead')).toBe(false);
            expect(books.some(b => b.writeName === 'novel')).toBe(false);
            expect(books.some(b => b.writeName === 'blank paper')).toBe(false);
        });
    });

    describe('定番プリセット (getPresets)', () => {
        it('巻物と魔法書それぞれのプリセットが取得できること', () => {
            const scrollPresets = service.getPresets('SCROLL');
            expect(scrollPresets.length).toBeGreaterThanOrEqual(5);
            expect(scrollPresets[0].writeName).toBe('genocide');

            const bookPresets = service.getPresets('SPELLBOOK');
            expect(bookPresets.length).toBeGreaterThanOrEqual(4);
            expect(bookPresets.some(b => b.writeName === 'identify')).toBe(true);
        });
    });

    describe('安全性判定 (evaluateSafety)', () => {
        it('識別済みのアイテムは IDENTIFIED (isSafe: true) となること', () => {
            const mockDsm = {
                isIdentified: (ident) => ident === 'scroll of genocide' || ident === 331,
                appearanceMap: new Map()
            };
            service.setDiscoveryStateManager(mockDsm);

            const safety = service.evaluateSafety('genocide', 'SCROLL');
            expect(safety.status).toBe(WRITE_SAFETY_STATUS.IDENTIFIED);
            expect(safety.isSafe).toBe(true);
            expect(safety.warningMessageJa).toBeNull();
        });

        it('未識別だが外見ラベル遭遇済みの巻物は ENCOUNTERED_LABEL (isSafe: true) となること', () => {
            const appMap = new Map();
            appMap.set('FOOBIE BLETCH', 'scroll of identify');

            const mockDsm = {
                isIdentified: () => false,
                appearanceMap: appMap
            };
            service.setDiscoveryStateManager(mockDsm);

            const safety = service.evaluateSafety('identify', 'SCROLL');
            expect(safety.status).toBe(WRITE_SAFETY_STATUS.ENCOUNTERED_LABEL);
            expect(safety.isSafe).toBe(true);
            expect(safety.appearanceLabel).toBe('FOOBIE BLETCH');
        });

        it('未識別だが習得中の呪文書は KNOWN_SPELL (isSafe: true) となること', () => {
            const mockDsm = {
                isIdentified: () => false,
                appearanceMap: new Map()
            };
            const mockSsm = {
                getSpells: () => [
                    { name: 'magic missile', level: 2 }
                ]
            };
            service.setDiscoveryStateManager(mockDsm);
            service.setSpellStateManager(mockSsm);

            const safety = service.evaluateSafety('magic missile', 'SPELLBOOK');
            expect(safety.status).toBe(WRITE_SAFETY_STATUS.KNOWN_SPELL);
            expect(safety.isSafe).toBe(true);
        });

        it('未識別・未遭遇・未習得のアイテムは UNKNOWN_RISKY (isSafe: false) となること', () => {
            const mockDsm = {
                isIdentified: () => false,
                appearanceMap: new Map()
            };
            service.setDiscoveryStateManager(mockDsm);

            const safety = service.evaluateSafety('genocide', 'SCROLL');
            expect(safety.status).toBe(WRITE_SAFETY_STATUS.UNKNOWN_RISKY);
            expect(safety.isSafe).toBe(false);
            expect(safety.warningMessageJa).toContain('⚠️ このアイテムは未識別です');
        });
    });

    describe('検索 (search)', () => {
        it('英語名での絞り込み検索ができること', () => {
            const results = service.search('geno', 'SCROLL');
            expect(results.length).toBe(1);
            expect(results[0].writeName).toBe('genocide');
        });

        it('エイリアス（虐殺）での検索ができること', () => {
            const results = service.search('虐殺', 'SCROLL');
            expect(results.length).toBe(1);
            expect(results[0].writeName).toBe('genocide');
        });

        it('空文字の場合は全件返すこと', () => {
            const allScrolls = service.getCatalog('SCROLL');
            const results = service.search('', 'SCROLL');
            expect(results.length).toBe(allScrolls.length);
        });
    });

    describe('コマンド文字列生成 (buildWriteCommand / serializeCommand)', () => {
        it('アイテム名からシンプルな英名（\\n なし）が生成されること', () => {
            const cmd1 = service.buildWriteCommand('scroll of genocide');
            expect(cmd1).toBe('genocide');

            const cmd2 = service.buildWriteCommand({ writeName: 'identify' });
            expect(cmd2).toBe('identify');

            // serializeCommand でも同様
            expect(service.serializeCommand('genocide')).toBe('genocide');
        });

        it('ラベル使用指定時はラベル名が生成されること', () => {
            const cmd = service.buildWriteCommand('identify', {
                useLabel: true,
                label: 'FOOBIE BLETCH'
            });
            expect(cmd).toBe('FOOBIE BLETCH');
        });
    });
});
