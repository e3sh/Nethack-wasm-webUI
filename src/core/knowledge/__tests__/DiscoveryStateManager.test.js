import { describe, it, expect } from 'vitest';
import { DiscoveryStateManager } from "../state/DiscoveryStateManager.js";

describe('DiscoveryStateManager', () => {
    it('1. `\\` コマンドの出力テキストから識別済みアイテムと外見マッピングを一括再生・同期できる', () => {
        const manager = new DiscoveryStateManager();
        const discoveryText = `
Discoveries
Potions:
  healing (ruby)
  extra healing (pink)
Scrolls:
  identify (labeled ZELGO MER)
  teleportation (labeled FOOBAR)
Wands:
  digging (silver) called dig?
Rings:
  free action (granite)
        `;

        manager.updateFromDiscoveriesText(discoveryText);

        expect(manager.isSynced).toBe(true);
        expect(manager.discoveredOnums.size).toBeGreaterThan(0);

        // potion of healing (ruby)
        expect(manager.appearanceMap.get('ruby')).toBe('potion of healing');
        expect(manager.appearanceMap.get('granite')).toBe('ring of free action');
        expect(manager.calledNamesMap.get('silver')).toBe('dig?');

        // isIdentified
        expect(manager.isIdentified('potion of healing')).toBe(true);
        expect(manager.isIdentified('ruby')).toBe(true);
        expect(manager.isIdentified('ring of free action')).toBe(true);

        // 未識別のアイテム
        expect(manager.isIdentified('wand of death')).toBe(false);
        expect(manager.isIdentified('balsa')).toBe(false);
    });

    it('2. 食料や基本道具などの非ランダムアイテムは本質的に識別済みと判定される', () => {
        const manager = new DiscoveryStateManager();
        // onum 288: food ration (FOOD)
        expect(manager.isIdentified(288)).toBe(true);
    });

    it('3. 新たに判明したアイテムを手動学習登録できる', () => {
        const manager = new DiscoveryStateManager();
        expect(manager.isIdentified(325)).toBe(false); // scroll of teleportation

        manager.registerKnownItem(325, 'scroll of teleportation', 'labeled FOOBAR', 'tele?');
        expect(manager.isIdentified(325)).toBe(true);
        expect(manager.appearanceMap.get('labeled foobar')).toBe('scroll of teleportation');
        expect(manager.calledNamesMap.get('labeled foobar')).toBe('tele?');
    });

    it('4. reset で全キャッシュがクリアされる', () => {
        const manager = new DiscoveryStateManager();
        manager.registerKnownItem(300, 'potion of healing');
        expect(manager.discoveredOnums.size).toBe(1);

        manager.reset();
        expect(manager.discoveredOnums.size).toBe(0);
        expect(manager.isSynced).toBe(false);
    });

    it('5. getDiscoveredItems: 外見マッピング、初期識別済み onum、仮名がすべて統合された図鑑リストを返却すること', () => {
        const manager = new DiscoveryStateManager();
        // 外見と真名のペア
        manager.registerKnownItem(300, 'potion of healing', 'ruby');
        // 外見なし真名（初期識別アイテム）
        manager.registerKnownItem(301, 'potion of extra healing');
        // 仮名のみ
        manager.calledNamesMap.set('silver wand', 'digging?');

        const items = manager.getDiscoveredItems();
        expect(items.length).toBeGreaterThanOrEqual(3);

        const rubyItem = items.find(it => it.trueName === 'potion of healing');
        expect(rubyItem).toBeDefined();
        expect(rubyItem.appearance).toBe('ruby');
        expect(rubyItem.isDiscovered).toBe(true);
        expect(rubyItem.category).toBe('potion');

        const extraItem = items.find(it => it.trueName === 'potion of extra healing');
        expect(extraItem).toBeDefined();
        expect(extraItem.isDiscovered).toBe(true);

        const calledItem = items.find(it => it.appearance === 'silver wand');
        expect(calledItem).toBeDefined();
        expect(calledItem.calledName).toBe('digging?');
    });

    it('6. ring mail が指輪 (ring) ではなく防具 (armor) に正しく分類され、日本語名 (nameJa) が取得できること', () => {
        const manager = new DiscoveryStateManager();
        manager.registerKnownItem(null, 'ring mail');

        const items = manager.getDiscoveredItems();
        const ringMail = items.find(it => it.trueName === 'ring mail');
        expect(ringMail).toBeDefined();
        expect(ringMail.category).toBe('armor'); // ❌ 'ring' ではなく 'armor' であること！
        expect(ringMail.nameJa).toBe('リングメイル'); // ナレッジマスターから公式日本語名が引けること
    });

    describe('Stage 5.4C: MessageContext Driven Item Discovery Tests', () => {
        it('5. 効果メッセージから巻物の真名を自動昇格できる', () => {
            const manager = new DiscoveryStateManager();
            expect(manager.isIdentified('scroll of identify')).toBe(false);

            const context = {
                messageId: 'read.c:L105:pline:0',
                rawText: 'This is an identify scroll.'
            };
            const result = manager.processDiscoveryMessage(context);
            expect(result).not.toBeNull();
            expect(result.trueName).toBe('scroll of identify');
            expect(manager.isIdentified('scroll of identify')).toBe(true);
        });

        it('6. 杖放射の効果メッセージから真名と外見を紐づけて自動昇格できる', () => {
            const manager = new DiscoveryStateManager();
            expect(manager.isIdentified('wand of digging')).toBe(false);

            const context = {
                messageId: 'zap.c:L180:pline:0',
                rawText: 'The floor collapses!'
            };
            const recentUsed = {
                name: 'a silver wand',
                appearance: 'silver'
            };
            const result = manager.processDiscoveryMessage(context, recentUsed);
            expect(result).not.toBeNull();
            expect(result.trueName).toBe('wand of digging');
            expect(manager.isIdentified('wand of digging')).toBe(true);
            expect(manager.appearanceMap.get('silver')).toBe('wand of digging');
        });

        it('7. 未登録メッセージの場合は null を返し、状態を変更しない', () => {
            const manager = new DiscoveryStateManager();
            const context = {
                messageId: 'unknown.c:message:0',
                rawText: 'Nothing happens.'
            };
            const result = manager.processDiscoveryMessage(context);
            expect(result).toBeNull();
        });
    });

    describe('未識別アイテムの Single Source of Truth 保証テスト', () => {
        it('8. 未鑑定アイテム（外見名アイテム）は所持しても勝手に識別済みにならず、床落ち・ホバーでマスクが維持されること', () => {
            const manager = new DiscoveryStateManager();
            const healPotionOnum = 307; // potion of healing

            // 初期状態: 未識別
            expect(manager.isIdentified(healPotionOnum)).toBe(false);
            expect(manager.isIdentified('ruby')).toBe(false);
            expect(manager.isIdentified('potion of healing')).toBe(false);

            // インベントリで拾っただけでは registerKnownItem を呼ばないため、未識別が維持される
            expect(manager.isIdentified(healPotionOnum)).toBe(false);

            // Cコアの Discoveries 同期が走った時のみ識別済みに昇格する
            manager.updateFromDiscoveriesText('Potions:\n  healing (ruby)');
            expect(manager.isIdentified(healPotionOnum)).toBe(true);
            expect(manager.isIdentified('ruby')).toBe(true);
            expect(manager.isIdentified('potion of healing')).toBe(true);
        });

        it('9. Discoveries テキスト中の仮名のみ行 (called) は識別済みにならず isDiscovered: false となること', () => {
            const manager = new DiscoveryStateManager();
            const discoveryText = `
Discoveries
Potions:
  potion called mypotion (ruby)
Weapons:
  crude dagger called mydagger
            `;
            manager.updateFromDiscoveriesText(discoveryText);

            // ruby や crude dagger は真名未判明なので isIdentified は false
            expect(manager.isIdentified('ruby')).toBe(false);
            expect(manager.isIdentified('crude dagger')).toBe(false);

            // calledNamesMap には登録される
            expect(manager.calledNamesMap.get('ruby')).toBe('mypotion');
            expect(manager.calledNamesMap.get('crude dagger')).toBe('mydagger');

            const items = manager.getDiscoveredItems();
            const rubyItem = items.find(it => it.appearance === 'ruby');
            expect(rubyItem).toBeDefined();
            expect(rubyItem.isDiscovered).toBe(false);
            expect(rubyItem.calledName).toBe('mypotion');

            const daggerItem = items.find(it => it.appearance === 'crude dagger');
            expect(daggerItem).toBeDefined();
            expect(daggerItem.isDiscovered).toBe(false);
            expect(daggerItem.calledName).toBe('mydagger');
        });

        it('10. 翻訳エンジン (TranslationEngine) 連携時に変名 (appearanceJa) および仮名アイテムの翻訳が取得できること', () => {
            const manager = new DiscoveryStateManager();
            const mockTranslator = {
                translate: (text) => {
                    const dict = {
                        'ruby': 'ルビー',
                        'potion of healing': '回復のポーション',
                        'crude dagger': '粗末な短剣'
                    };
                    return dict[text] || text;
                },
                containsJapanese: (text) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)
            };
            manager.setTranslationEngine(mockTranslator);

            // 1. 識別済みアイテム (potion of healing / ruby)
            manager.registerKnownItem(300, 'potion of healing', 'ruby');

            // 2. 仮名のみアイテム (crude dagger called mydagger)
            manager.calledNamesMap.set('crude dagger', 'mydagger');

            const items = manager.getDiscoveredItems();

            const healItem = items.find(it => it.trueName === 'potion of healing');
            expect(healItem).toBeDefined();
            expect(healItem.appearance).toBe('ruby');
            expect(healItem.appearanceJa).toBe('ルビー');
            expect(healItem.isDiscovered).toBe(true);

            const daggerItem = items.find(it => it.appearance === 'crude dagger');
            expect(daggerItem).toBeDefined();
            expect(daggerItem.appearanceJa).toBe('粗末な短剣');
            expect(daggerItem.nameJa).toBe('粗末な短剣');
            expect(daggerItem.isDiscovered).toBe(false);
        });

        it('11. Cコア出力の "*" 付きバリエーションアイテム (* elven arrow (runed arrow) 等) を正しく認識し本来のスペックナレッジが紐づくこと', () => {
            const manager = new DiscoveryStateManager();
            const discoveryText = `
Discoveries
Weapons:
  * elven arrow (runed arrow)
  * orcish arrow (crude arrow)
            `;
            manager.updateFromDiscoveriesText(discoveryText);

            // 1. isIdentified の判定
            expect(manager.isIdentified('elven arrow')).toBe(true);
            expect(manager.isIdentified('runed arrow')).toBe(true);
            expect(manager.isIdentified('orcish arrow')).toBe(true);
            expect(manager.isIdentified('crude arrow')).toBe(true);

            // 2. onum が正しく登録されていること (elven arrow: onum 19, orcish arrow: onum 20)
            expect(manager.discoveredOnums.has(19)).toBe(true);
            expect(manager.discoveredOnums.has(20)).toBe(true);

            // 3. getDiscoveredItems の検証
            const items = manager.getDiscoveredItems();
            const elvenItem = items.find(it => it.trueName === 'elven arrow');
            expect(elvenItem).toBeDefined();
            expect(elvenItem.trueName).toBe('elven arrow'); // ❌ '* elven arrow' ではなく 'elven arrow' であること
            expect(elvenItem.appearance).toBe('runed arrow');
            expect(elvenItem.isDiscovered).toBe(true);
            expect(elvenItem.knowledge).not.toBeNull();
            // 本来の実用スペック (sdam: '1d7', ldam: '1d6') が紐づいていること！
            expect(elvenItem.knowledge.stats?.sdam || elvenItem.knowledge.sdam).toBe('1d7');
            expect(elvenItem.knowledge.stats?.ldam || elvenItem.knowledge.ldam).toBe('1d6');

            const orcishItem = items.find(it => it.trueName === 'orcish arrow');
            expect(orcishItem).toBeDefined();
            expect(orcishItem.trueName).toBe('orcish arrow');
            expect(orcishItem.appearance).toBe('crude arrow');
            expect(orcishItem.knowledge).not.toBeNull();
            expect(orcishItem.knowledge.stats?.sdam || orcishItem.knowledge.sdam).toBe('1d5');
        });
        it('12. Cコア実ログのコロンなしヘッダー (Weapons, Armor 等) がアイテムとして誤登録されず、アイテムが正しく登録されること', () => {
            const manager = new DiscoveryStateManager();
            const realLog = `[Win 5] Discoveries, by order of discovery within each class
[Win 5] 
[Win 5] Weapons
[Win 5] * shuriken (throwing star)
[Win 5] Armor
[Win 5] * elven leather helm (leather hat)
[Win 5] * orcish helm (iron skull cap)
[Win 5] * dwarvish iron helm (hard hat)
[Win 5] * helmet (crested helmet)
[Win 5] * orcish chain mail (crude chain mail)
[Win 5] * orcish ring mail (crude ring mail)
[Win 5] * orcish cloak (coarse mantelet)
[Win 5] * dwarvish cloak (hooded cloak)
[Win 5] * oilskin cloak (slippery cloak)
[Win 5] * elven shield (blue and green shield)
[Win 5] * Uruk-hai shield (white-handed shield)
[Win 5] * orcish shield (red-eyed shield)
[Win 5] * dwarvish roundshield (large round shield)
[Win 5]   pair of leather gloves (padded gloves)
[Win 5] * pair of low boots (walking shoes)
[Win 5] * pair of iron shoes (hard shoes)
[Win 5] * pair of high boots (jackboots)
[Win 5] Scrolls
[Win 5]   scroll of enchant armor (EIRIS SAZUN IDISI)
[Win 5] Spellbooks
[Win 5]   spellbook of confuse monster (light green)
[Win 5] Potions
[Win 5]   potion of healing (pink)`;

            manager.updateFromDiscoveriesText(realLog);

            // 1. カテゴリ見出し文字列自体がアイテムとして登録されていないこと！
            expect(manager.isIdentified('Weapons')).toBe(false);
            expect(manager.isIdentified('Armor')).toBe(false);
            expect(manager.isIdentified('Scrolls')).toBe(false);
            expect(manager.isIdentified('Spellbooks')).toBe(false);
            expect(manager.isIdentified('Potions')).toBe(false);

            const items = manager.getDiscoveredItems();
            const invalidCategoryItems = items.filter(it => 
                ['weapons', 'armor', 'scrolls', 'spellbooks', 'potions'].includes((it.trueName || '').toLowerCase())
            );
            expect(invalidCategoryItems.length).toBe(0);

            // 2. アイテムが正しく登録されていること
            expect(manager.isIdentified('shuriken')).toBe(true);
            expect(manager.isIdentified('throwing star')).toBe(true);
            expect(manager.isIdentified('elven leather helm')).toBe(true);
            expect(manager.isIdentified('scroll of enchant armor')).toBe(true);
            expect(manager.isIdentified('potion of healing')).toBe(true);
            expect(manager.appearanceMap.get('pink')).toBe('potion of healing');

            const shuriken = items.find(it => it.trueName === 'shuriken');
            expect(shuriken).toBeDefined();
            expect(shuriken.category).toBe('weapon');
            expect(shuriken.appearance).toBe('throwing star');

            const healing = items.find(it => it.trueName === 'potion of healing');
            expect(healing).toBeDefined();
            expect(healing.category).toBe('potion');
            expect(healing.appearance).toBe('pink');
        });

        it('13. インベントリ内の所持品 (inventoryStateManager) がディスカバリー図鑑に動的に統合されること', () => {
            const manager = new DiscoveryStateManager();
            const mockInvMgr = {
                getItems: () => [
                    {
                        key: 'a',
                        count: 1,
                        name: 'a +1 long sword',
                        onum: 54,
                        identification: {
                            isUnidentified: false,
                            trueName: 'long sword',
                            appearance: null,
                            calledName: null
                        }
                    },
                    {
                        key: 'b',
                        count: 1,
                        name: 'a smoky potion called myjump',
                        onum: 310,
                        identification: {
                            isUnidentified: true,
                            trueName: null,
                            appearance: 'smoky potion',
                            calledName: 'myjump'
                        }
                    }
                ]
            };

            manager.setInventoryStateManager(mockInvMgr);

            const items = manager.getDiscoveredItems();

            // 1. 所持品の識別済みアイテム (long sword) が図鑑に含まれること
            const sword = items.find(it => it.trueName === 'long sword');
            expect(sword).toBeDefined();
            expect(sword.isDiscovered).toBe(true);

            // 2. 所持品の仮名アイテム (smoky potion / myjump) が図鑑に含まれること
            const potion = items.find(it => it.appearance === 'smoky potion');
            expect(potion).toBeDefined();
            expect(potion.calledName).toBe('myjump');
            expect(potion.isDiscovered).toBe(false);
        });
    });
});
