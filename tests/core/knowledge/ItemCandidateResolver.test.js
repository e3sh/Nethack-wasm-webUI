import { describe, it, expect, beforeEach } from 'vitest';
import { ItemCandidateResolver } from '../../../src/core/knowledge/engines/ItemCandidateResolver.js';
import { DiscoveryStateManager } from '../../../src/core/knowledge/state/DiscoveryStateManager.js';

describe('ItemCandidateResolver - 未識別アイテム候補逆引き＆命名アシストエンジン', () => {
    let discoveryStateManager;

    beforeEach(() => {
        discoveryStateManager = new DiscoveryStateManager();
    });

    describe('1. カテゴリ正規化 ＆ ショートハンド生成', () => {
        it('カテゴリ文字列を大文字・単数形キーに正規化できること', () => {
            expect(ItemCandidateResolver.normalizeCategory('scrolls')).toBe('SCROLL');
            expect(ItemCandidateResolver.normalizeCategory('Potion')).toBe('POTION');
            expect(ItemCandidateResolver.normalizeCategory('wands')).toBe('WAND');
            expect(ItemCandidateResolver.normalizeCategory('rings')).toBe('RING');
            expect(ItemCandidateResolver.normalizeCategory('spellbooks')).toBe('SPELLBOOK');
            expect(ItemCandidateResolver.normalizeCategory('armors')).toBe('ARMOR');
            expect(ItemCandidateResolver.normalizeCategory('')).toBe('');
        });

        it('アイテム名からプレフィックスを除去してコア名を抽出できること', () => {
            expect(ItemCandidateResolver.getCoreItemName('scroll of identify')).toBe('identify');
            expect(ItemCandidateResolver.getCoreItemName('potion of healing')).toBe('healing');
            expect(ItemCandidateResolver.getCoreItemName('wand of digging')).toBe('digging');
            expect(ItemCandidateResolver.getCoreItemName('ring of slow digestion')).toBe('slow digestion');
        });

        it('自然で分かりやすいショートハンド命名候補を生成できること', () => {
            expect(ItemCandidateResolver.generateShorthand('scroll of identify')).toBe('identify?');
            expect(ItemCandidateResolver.generateShorthand('scroll of teleportation')).toBe('teleport?');
            expect(ItemCandidateResolver.generateShorthand('potion of extra healing')).toBe('extra healing?');
            expect(ItemCandidateResolver.generateShorthand('wand of digging')).toBe('digging?');
            expect(ItemCandidateResolver.generateShorthand('ring of slow digestion')).toBe('slow digest?');
            expect(ItemCandidateResolver.generateShorthand('scroll of remove curse', false)).toBe('rem curse');
        });

        it('多様なアイテムデータ構造からカテゴリを正確に抽出・推測できること (resolveCategory)', () => {
            // A. category からの解決
            expect(ItemCandidateResolver.resolveCategory({ category: 'SCROLL' })).toBe('SCROLL');
            // B. oclass 文字・数値からの解決
            expect(ItemCandidateResolver.resolveCategory({ oclass: '?' })).toBe('SCROLL');
            expect(ItemCandidateResolver.resolveCategory({ oclass: 8 })).toBe('POTION');
            expect(ItemCandidateResolver.resolveCategory({ oclass: '/' })).toBe('WAND');
            expect(ItemCandidateResolver.resolveCategory({ oclass: '=' })).toBe('RING');
            // C. knowledge / identification からの解決
            expect(ItemCandidateResolver.resolveCategory({ knowledge: { category: 'POTION' } })).toBe('POTION');
            expect(ItemCandidateResolver.resolveCategory({ identification: { category: 'WAND' } })).toBe('WAND');
            // D. 名前・外見からの推測
            expect(ItemCandidateResolver.resolveCategory({ name: 'scroll labeled FOO' })).toBe('SCROLL');
            expect(ItemCandidateResolver.resolveCategory({ rawText: 'ruby potion' })).toBe('POTION');
            expect(ItemCandidateResolver.resolveCategory({ appearanceName: 'glass wand' })).toBe('WAND');
            expect(ItemCandidateResolver.resolveCategory('scroll of teleportation')).toBe('SCROLL');
        });
    });

    describe('2. 店頭価格からの基礎価格逆算 (estimateBaseCostsFromShopPrice)', () => {
        it('購入時（buy）の店頭価格から基礎価格候補を逆算できること', () => {
            // NetHack では標準買値 = base_cost * 4 / 3 (1.333倍)
            // 例: 基礎価格 100 の巻物は 約 133 ゴールド
            const baseFor133 = ItemCandidateResolver.estimateBaseCostsFromShopPrice(133, 'buy');
            expect(baseFor133).toContain(100);

            // 例: 基礎価格 50 の巻物は 約 66 〜 67 ゴールド
            const baseFor67 = ItemCandidateResolver.estimateBaseCostsFromShopPrice(67, 'buy');
            expect(baseFor67).toContain(50);

            // 例: 基礎価格 300 の巻物は 約 400 ゴールド
            const baseFor400 = ItemCandidateResolver.estimateBaseCostsFromShopPrice(400, 'buy');
            expect(baseFor400).toContain(300);
        });

        it('売却時（sell）の店頭価格から基礎価格候補を逆算できること', () => {
            // 売却時 = base_cost / 3 (0.333倍) または base_cost / 2 (0.5倍)
            // 例: 基礎価格 300 の巻物を売ると 100 ゴールド
            const baseFor100Sell = ItemCandidateResolver.estimateBaseCostsFromShopPrice(100, 'sell');
            expect(baseFor100Sell).toContain(300);
        });
    });

    describe('3. カテゴリ内価格帯グルーピング (getPriceGroups)', () => {
        it('巻物（SCROLL）カテゴリ内の全価格帯グループを取得できること', () => {
            const groups = ItemCandidateResolver.getPriceGroups('SCROLL');
            expect(groups.size).toBeGreaterThan(0);

            // 代表的な巻物の基礎価格（20, 50, 60, 80, 100, 200, 300 等）が存在すること
            const costs = Array.from(groups.keys());
            expect(costs).toContain(20);
            expect(costs).toContain(100);

            // 20G の巻物グループ（identify）の内容検証
            const scrolls20 = groups.get(20);
            expect(scrolls20.length).toBeGreaterThan(0);
            const identifyScroll = scrolls20.find(s => s.name === 'scroll of identify');
            expect(identifyScroll).toBeDefined();
            expect(identifyScroll.cost).toBe(20);

            // 100G の巻物グループ（teleportation 等）の内容検証
            const scrolls100 = groups.get(100);
            expect(scrolls100.length).toBeGreaterThan(0);
            const teleportScroll = scrolls100.find(s => s.name === 'scroll of teleportation');
            expect(teleportScroll).toBeDefined();
            expect(teleportScroll.cost).toBe(100);
        });

        it('excludeDiscovered = true の場合、識別済みアイテムがグループから除外されること', () => {
            // identify を識別済みに登録
            const identifyOnum = discoveryStateManager.lookupOnum('scroll of identify');
            expect(identifyOnum).not.toBeNull();
            discoveryStateManager.registerKnownItem(identifyOnum, 'scroll of identify');

            const groups = ItemCandidateResolver.getPriceGroups('SCROLL', {
                discoveryStateManager,
                excludeDiscovered: true
            });

            const scrolls20 = groups.get(20) || [];
            const hasIdentify = scrolls20.some(s => s.name === 'scroll of identify');
            expect(hasIdentify).toBe(false);
        });
    });

    describe('4. 総合候補解決 (resolveCandidates)', () => {
        it('基礎価格 100 の巻物候補とショートハンドを解決できること', () => {
            const res = ItemCandidateResolver.resolveCandidates({
                category: 'SCROLL',
                baseCost: 100,
                discoveryStateManager
            });

            expect(res.candidates.length).toBeGreaterThan(0);
            expect(res.candidates.every(c => c.cost === 100)).toBe(true);
            expect(res.candidates.some(c => c.name === 'scroll of teleportation')).toBe(true);

            // ショートハンドに価格 ("100G?") と アイテム名 ("teleport?") が含まれること
            expect(res.shorthands).toContain('100G?');
            expect(res.shorthands).toContain('teleport?');
        });

        it('店頭価格（buy: 133G）から基礎価格 100 の巻物候補を逆引きできること', () => {
            const res = ItemCandidateResolver.resolveCandidates({
                category: 'SCROLL',
                shopPrice: 133,
                shopPriceType: 'buy',
                discoveryStateManager
            });

            expect(res.candidates.length).toBeGreaterThan(0);
            expect(res.candidates.some(c => c.name === 'scroll of teleportation')).toBe(true);
            expect(res.shorthands).toContain('100G?');
        });

        it('識別済みアイテムは excludeDiscovered = true で安全に除外されること', () => {
            const teleportOnum = discoveryStateManager.lookupOnum('scroll of teleportation');
            discoveryStateManager.registerKnownItem(teleportOnum, 'scroll of teleportation');

            const res = ItemCandidateResolver.resolveCandidates({
                category: 'SCROLL',
                baseCost: 100,
                discoveryStateManager,
                excludeDiscovered: true
            });

            const hasTeleport = res.candidates.some(c => c.name === 'scroll of teleportation');
            expect(hasTeleport).toBe(false);
        });

        it('効果メッセージにマッチするアイテムが存在する場合、推奨候補の先頭に昇格すること', () => {
            const res = ItemCandidateResolver.resolveCandidates({
                category: 'SCROLL',
                baseCost: 100,
                lastEffectText: 'You feel confused! This was a scroll of confuse monster.',
                discoveryStateManager
            });

            expect(res.recommendedCandidate).toBeDefined();
            expect(res.recommendedCandidate.name).toBe('scroll of confuse monster');
        });
    });

    describe('5. アーティファクト個別命名候補リゾルバ (resolveArtifactCandidates / hasArtifactCandidates)', () => {
        it('long sword (onum: 54) から複数の固有アーティファクト候補を抽出できること', () => {
            const candidates = ItemCandidateResolver.resolveArtifactCandidates({
                onum: 54,
                baseName: 'long sword'
            });

            expect(candidates.length).toBeGreaterThanOrEqual(6);
            const names = candidates.map(c => c.name);
            expect(names).toContain('Excalibur');
            expect(names).toContain('Frost Brand');
            expect(names).toContain('Fire Brand');
            expect(names).toContain('Vorpal Blade');
            expect(names).toContain('Sunsword');
            expect(names).toContain('Giantslayer');

            // 属性の検証
            const excalibur = candidates.find(c => c.name === 'Excalibur');
            expect(excalibur.nameJa).toBe('エクスカリバー');
            expect(excalibur.alignment).toBe('LAWFUL');
            expect(excalibur.role).toBe('knight');
            expect(excalibur.canNameDirectly).toBe(true);
            expect(excalibur.isQuestArtifact).toBe(false);
            expect(excalibur.attackEffect).toBeTruthy();
        });

        it('athame から Magicbane を抽出できること', () => {
            const candidates = ItemCandidateResolver.resolveArtifactCandidates({
                baseName: 'athame'
            });

            expect(candidates.length).toBe(1);
            expect(candidates[0].name).toBe('Magicbane');
            expect(candidates[0].nameJa).toBe('マジックベイン');
            expect(candidates[0].canNameDirectly).toBe(true);
        });

        it('修飾語付きのアイテム名（+1 long sword, blessed long sword等）でもマッチすること', () => {
            const c1 = ItemCandidateResolver.resolveArtifactCandidates({ baseName: '+1 long sword' });
            expect(c1.some(c => c.name === 'Excalibur')).toBe(true);

            const c2 = ItemCandidateResolver.resolveArtifactCandidates({ baseName: 'blessed uncursed corroded long sword' });
            expect(c2.some(c => c.name === 'Excalibur')).toBe(true);
        });

        it('クエストアーティファクト（The Heart of Ahriman 等）は canNameDirectly が false になること', () => {
            const candidates = ItemCandidateResolver.resolveArtifactCandidates({
                baseName: 'luckstone',
                onum: 470
            });

            expect(candidates.length).toBe(1);
            expect(candidates[0].name).toBe('The Heart of Ahriman');
            expect(candidates[0].isQuestArtifact).toBe(true);
            expect(candidates[0].canNameDirectly).toBe(false);
        });

        it('プレイヤーの職業/アライメントに基づく推奨順序ソートが機能すること', () => {
            // knight & LAWFUL の場合、Excalibur が最上位推奨
            const candidates = ItemCandidateResolver.resolveArtifactCandidates({
                baseName: 'long sword',
                role: 'knight',
                alignment: 'LAWFUL'
            });

            expect(candidates[0].name).toBe('Excalibur');
            expect(candidates[0].isRecommended).toBe(true);
        });

        it('hasArtifactCandidates がアーティファクト元アイテムを正しく判定できること', () => {
            expect(ItemCandidateResolver.hasArtifactCandidates({ baseName: 'long sword' })).toBe(true);
            expect(ItemCandidateResolver.hasArtifactCandidates({ onum: 54 })).toBe(true);
            expect(ItemCandidateResolver.hasArtifactCandidates({ baseName: 'athame' })).toBe(true);
            expect(ItemCandidateResolver.hasArtifactCandidates({ baseName: 'broadsword' })).toBe(true);

            // アーティファクトが存在しない一般アイテム
            expect(ItemCandidateResolver.hasArtifactCandidates({ baseName: 'rock' })).toBe(false);
            expect(ItemCandidateResolver.hasArtifactCandidates({ baseName: 'apple' })).toBe(false);
            expect(ItemCandidateResolver.hasArtifactCandidates({ baseName: 'food ration' })).toBe(false);
            expect(ItemCandidateResolver.hasArtifactCandidates({})).toBe(false);
        });
    });

    describe('6. 価格情報抽出と自動候補絞り込み (extractPriceInfo & auto resolveCandidates)', () => {
        it('店主未払い・販売テキストから買値（shopPrice）を抽出できること', () => {
            const info1 = ItemCandidateResolver.extractPriceInfo('(unpaid, 133 zorkmids)');
            expect(info1).toEqual(expect.objectContaining({
                shopPrice: 133,
                priceType: 'buy'
            }));

            const info2 = ItemCandidateResolver.extractPriceInfo('a scroll labeled FOO (for sale, 100 a piece)');
            expect(info2).toEqual(expect.objectContaining({
                shopPrice: 100,
                priceType: 'buy'
            }));

            const info3 = ItemCandidateResolver.extractPriceInfo({ rawText: 'potion of clear water (unpaid, 67 zm)' });
            expect(info3).toEqual(expect.objectContaining({
                shopPrice: 67,
                priceType: 'buy'
            }));
        });

        it('仮名文字列（100 zm, 133G, 100?等）から適切に baseCost または shopPrice を抽出できること', () => {
            // 標準基礎価格 100 ZM に一致する場合
            const info100 = ItemCandidateResolver.extractPriceInfo('100 zm');
            expect(info100).toEqual(expect.objectContaining({
                baseCost: 100,
                shopPrice: 100
            }));

            // 店頭端数 133G (基礎100の買値)
            const info133 = ItemCandidateResolver.extractPriceInfo('133G');
            expect(info133).toEqual(expect.objectContaining({
                shopPrice: 133
            }));

            // 純粋な数値仮名 "100" または "100?"
            const infoNum = ItemCandidateResolver.extractPriceInfo('100?');
            expect(infoNum).toEqual(expect.objectContaining({
                baseCost: 100
            }));
        });

        it('resolveCandidates: calledName や rawText から自動的に価格帯を特定し候補を絞り込めること', () => {
            // "100 zm" の巻物 -> 基礎価格 100 の巻物（teleportation, create monster等）のみに絞り込まれる
            const res100 = ItemCandidateResolver.resolveCandidates({
                category: 'SCROLL',
                calledName: '100 zm'
            });
            expect(res100.matchedCosts).toContain(100);
            expect(res100.candidates.length).toBeGreaterThan(0);
            expect(res100.candidates.every(c => c.cost === 100)).toBe(true);
            expect(res100.candidates.some(c => c.name === 'scroll of teleportation')).toBe(true);
            // 20G の identify は除外されていること
            expect(res100.candidates.some(c => c.name === 'scroll of identify')).toBe(false);

            // 店頭価格 133G の巻物 -> 逆算により基礎価格 100 の巻物に絞り込まれる
            const res133 = ItemCandidateResolver.resolveCandidates({
                category: 'SCROLL',
                calledName: '133G'
            });
            expect(res133.matchedCosts).toContain(100);
            expect(res133.candidates.every(c => c.cost === 100)).toBe(true);

            // rawText "(unpaid, 67 zorkmids)" のポーション -> 逆算により基礎価格 50 のポーションに絞り込まれる
            const resShop = ItemCandidateResolver.resolveCandidates({
                targetData: {
                    category: 'POTION',
                    rawText: 'a ruby potion (unpaid, 67 zorkmids)'
                }
            });
            expect(resShop.matchedCosts).toContain(50);
            expect(resShop.candidates.every(c => c.cost === 50)).toBe(true);
        });
    });
});


