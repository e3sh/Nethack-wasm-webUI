import { describe, it, expect } from 'vitest';
import { WishService, WISH_PRESETS, BLESSING_STATES, PROOF_TYPES } from './WishService.js';

describe('WishService', () => {
    const wishService = new WishService();

    it('getCatalog should return full items catalog with valid structure', () => {
        const catalog = wishService.getCatalog();
        expect(catalog.length).toBeGreaterThan(300);

        const sdsm = catalog.find(it => it.name === 'silver dragon scale mail');
        expect(sdsm).toBeDefined();
        expect(sdsm.category).toBe('ARMOR');
        expect(sdsm.options.allowEnchantment).toBe(true);
        expect(sdsm.options.allowErosionProof).toBe(true);

        const genocide = catalog.find(it => it.name === 'scroll of genocide');
        expect(genocide).toBeDefined();
        expect(genocide.category).toBe('SCROLL');
        expect(genocide.options.allowCount).toBe(true);
        expect(genocide.options.allowEnchantment).toBe(false);
    });

    it('getCatalogByCategory should categorize items properly', () => {
        const byCat = wishService.getCatalogByCategory();
        expect(byCat.ARMOR).toBeDefined();
        expect(byCat.WEAPON).toBeDefined();
        expect(byCat.WAND).toBeDefined();
        expect(byCat.SCROLL).toBeDefined();
        expect(byCat.POTION).toBeDefined();
        expect(byCat.ARTIFACT).toBeDefined();
    });

    it('getPresets should return predefined popular wishes', () => {
        const presets = wishService.getPresets();
        expect(presets.length).toBeGreaterThan(5);
        expect(presets.find(p => p.id === 'sdsm')).toBeDefined();
        expect(presets.find(p => p.id === 'scroll_genocide')).toBeDefined();
    });

    describe('serializeWish', () => {
        it('should serialize standard armor wish correctly', () => {
            const cmd = wishService.serializeWish({
                itemName: 'silver dragon scale mail',
                blessing: BLESSING_STATES.BLESSED,
                enchantment: 2,
                erosion: PROOF_TYPES.RUSTPROOF
            });
            expect(cmd).toBe('blessed rustproof +2 silver dragon scale mail');
        });

        it('should serialize plural scrolls correctly', () => {
            const cmd = wishService.serializeWish({
                itemName: 'scroll of genocide',
                blessing: BLESSING_STATES.BLESSED,
                count: 2
            });
            expect(cmd).toBe('2 blessed scrolls of genocide');
        });

        it('should serialize wand with charges correctly', () => {
            const cmd = wishService.serializeWish({
                itemName: 'wand of wishing',
                blessing: BLESSING_STATES.BLESSED,
                charges: 3
            });
            expect(cmd).toBe('blessed wand of wishing (0:3)');
        });

        it('should serialize negative enchantment and greased status', () => {
            const cmd = wishService.serializeWish({
                itemName: 'long sword',
                blessing: BLESSING_STATES.CURSED,
                enchantment: -1,
                isGreased: true
            });
            expect(cmd).toBe('cursed greased -1 long sword');
        });
    });

    describe('suggest', () => {
        it('should suggest items by English prefix', () => {
            const results = wishService.suggest('dragon scale mail');
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.name.includes('dragon scale mail'))).toBe(true);
        });

        it('should resolve alias like sdsm', () => {
            const results = wishService.suggest('sdsm');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].name).toBe('silver dragon scale mail');
        });

        it('should resolve Japanese alias like 銀鱗 or 虐殺', () => {
            const results = wishService.suggest('銀鱗');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].name).toBe('silver dragon scale mail');

            const geno = wishService.suggest('虐殺');
            expect(geno.length).toBeGreaterThan(0);
            expect(geno[0].name).toBe('scroll of genocide');
        });
    });

    describe('parseWish', () => {
        it('should parse complex wish text back to structured spec', () => {
            const spec = wishService.parseWish('+2 blessed rustproof silver dragon scale mail');
            expect(spec).toBeDefined();
            expect(spec.itemName).toBe('silver dragon scale mail');
            expect(spec.blessing).toBe('blessed');
            expect(spec.erosion).toBe('rustproof');
            expect(spec.enchantment).toBe(2);
        });

        it('should parse plural scrolls text', () => {
            const spec = wishService.parseWish('2 blessed scrolls of genocide');
            expect(spec).toBeDefined();
            expect(spec.itemName).toBe('scroll of genocide');
            expect(spec.blessing).toBe('blessed');
            expect(spec.count).toBe(2);
        });
    });

    describe('SSOT Translation Integration', () => {
        it('should resolve nameJa via injected translator', () => {
            const mockTranslator = {
                translate: (text) => {
                    if (text === 'silver dragon scale mail') return '銀色ドラゴンの鱗鎧';
                    if (text === 'scroll of genocide') return '虐殺の巻物';
                    return text;
                }
            };
            const svc = new WishService({ translator: mockTranslator });
            const cat = svc.getCatalog();
            const sdsm = cat.find(it => it.name === 'silver dragon scale mail');
            expect(sdsm).toBeDefined();
            expect(sdsm.nameJa).toBe('銀色ドラゴンの鱗鎧');
        });

        it('should resolve nameJa directly from OBJECT_JP_MAP even without any translator', () => {
            const standaloneSvc = new WishService(); // 引数なし
            const cat = standaloneSvc.getCatalog();
            const sdsm = cat.find(it => it.name === 'silver dragon scale mail');
            expect(sdsm).toBeDefined();
            expect(sdsm.nameJa).toBe('銀色ドラゴンの鱗鎧');

            const geno = cat.find(it => it.name === 'scroll of genocide');
            expect(geno).toBeDefined();
            expect(geno.nameJa).toBe('虐殺の巻物');
        });

        it('should suggest items using Japanese name directly without translator', () => {
            const standaloneSvc = new WishService();
            const results = standaloneSvc.suggest('銀色');
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.name === 'silver dragon scale mail')).toBe(true);

            const deathResults = standaloneSvc.suggest('死の杖');
            expect(deathResults.length).toBeGreaterThan(0);
            expect(deathResults[0].name).toBe('wand of death');
        });
    });

    describe('checkWishSafety (願いセーフティガード判定)', () => {
        const wishService = new WishService();

        it('通常アイテムは安全（isSafe: true, safetyLevel: SAFE）と判定されること', () => {
            const safety = wishService.checkWishSafety('silver dragon scale mail', { alignment: 'chaotic', role: 'wizard' });
            expect(safety.isSafe).toBe(true);
            expect(safety.safetyLevel).toBe('SAFE');
            expect(safety.isArtifact).toBe(false);
            expect(safety.warningsJa.length).toBe(0);
        });

        it('他職業のクエストアーティファクトを願おうとした場合、FATAL（願い無駄消費）警告が出ること', () => {
            // ワルキューレが侍の「村正のツルギ」を願う
            const safety = wishService.checkWishSafety('The Tsurugi of Muramasa', { alignment: 'lawful', role: 'valkyrie' });
            expect(safety.isSafe).toBe(false);
            expect(safety.safetyLevel).toBe('FATAL');
            expect(safety.warningsJa.some(w => w.includes('他職業') && w.includes('SAMURAI'))).toBe(true);
        });

        it('属性不一致のアーティファクトを願おうとした場合、WARNING（爆破ダメージ）警告が出ること', () => {
            // 混沌のプレイヤーが秩序の「Excalibur」を願う
            const safety = wishService.checkWishSafety('Excalibur', { alignment: 'chaotic', role: 'wizard' });
            expect(safety.isSafe).toBe(false);
            expect(safety.safetyLevel).toBe('WARNING');
            expect(safety.warningsJa.some(w => w.includes('爆破'))).toBe(true);
        });

        it('自属性かつ自職業のアーティファクトは警告なしで受け入れられること', () => {
            // 秩序の騎士が「Excalibur」を願う
            const safety = wishService.checkWishSafety('Excalibur', { alignment: 'lawful', role: 'knight' });
            expect(safety.isSafe).toBe(true);
            expect(safety.safetyLevel).toBe('SAFE');
            expect(safety.warningsJa.length).toBe(0);
            expect(safety.advicesJa.length).toBeGreaterThan(0); // 確率注意等の情報アドバイスは付与
        });
    });
});
