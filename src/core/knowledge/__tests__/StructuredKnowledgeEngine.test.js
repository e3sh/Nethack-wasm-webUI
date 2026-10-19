import { describe, it, expect, beforeEach } from 'vitest';
import { StructuredKnowledgeEngine } from "../engines/StructuredKnowledgeEngine.js";
import { GLYPH_OFFSETS } from "../engines/glyphClassifier.js";

describe('StructuredKnowledgeEngine', () => {
    let engine;
    let mockTranslationEngine;

    beforeEach(() => {
        mockTranslationEngine = {
            translate: (text) => {
                const dict = {
                    'cockatrice': 'コカトリス',
                    'plains centaur': '平原のケンタウロス',
                    'kitten': '子猫',
                    'little dog': '小犬',
                    'wand of digging': '掘削の杖',
                    'mineral': '鉱物',
                    'Petrifies instantly if touched or eaten without gloves!': '手袋なしで触ると石化します！',
                    'Engrave Elbereth to keep away': 'Elbereth(Eの字)を刻んで遠ざける',
                    'Digs holes or tunnels in walls and floor.': '壁や床に穴や通路を掘る。'
                };
                return dict[text] || text;
            }
        };

        engine = new StructuredKnowledgeEngine({
            translationEngine: mockTranslationEngine
        });
    });

    describe('Monster Knowledge Retrieval', () => {
        it('should retrieve monster knowledge by ID string', () => {
            const mon = engine.getMonsterKnowledge('cockatrice', { translate: false });
            expect(mon).not.toBeNull();
            expect(mon.id).toBe('cockatrice');
            expect(mon.name).toBe('cockatrice');
            expect(mon.dangerLevel).toBe('LETHAL');
            expect(mon.stats.hd).toBe(5);
        });

        it('should retrieve monster knowledge by monOffset number', () => {
            const mon = engine.getMonsterKnowledge(28, { translate: false }); // tilemappings.lst floating eye mnum = 28
            expect(mon).not.toBeNull();
            expect(mon.id).toBe('floating_eye');
            expect(mon.dangerLevel).toBe('HIGH');
        });

        it('should retrieve monster knowledge by glyphId number', () => {
            // NetHack cockatrice monOffset = 10
            const mon = engine.getMonsterKnowledge(10, { translate: false });
            expect(mon).not.toBeNull();
            expect(mon.id).toBe('cockatrice');
        });

        it('should return null for unknown monster', () => {
            const mon = engine.getMonsterKnowledge('non_existent_monster');
            expect(mon).toBeNull();
        });
    });

    describe('Item Knowledge Retrieval', () => {
        it('should retrieve item knowledge by ID string', () => {
            const item = engine.getItemKnowledge('wand_of_digging', { translate: false });
            expect(item).not.toBeNull();
            expect(item.onum).toBe(428);
            expect(item.name).toBe('wand of digging');
            expect(item.category).toBe('WAND');
        });

        it('should retrieve item knowledge by onum number', () => {
            const item = engine.getItemKnowledge(428, { translate: false });
            expect(item).not.toBeNull();
            expect(item.onum).toBe(428);
            expect(item.name).toBe('wand of digging');
        });

        it('should retrieve item knowledge by glyphId number', () => {
            // GLYPH_OBJ_OFF (3448) + 428 = 3876
            const wandGlyph = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 428;
            const item = engine.getItemKnowledge(wandGlyph, { translate: false });
            expect(item).not.toBeNull();
            expect(item.onum).toBe(428);
            expect(item.name).toBe('wand of digging');
        });

        it('should resolve item knowledge from complex NetHack inventory strings', () => {
            const item = engine.getItemKnowledge('a - 2 uncursed rations of cram', { translate: false });
            expect(item).not.toBeNull();
            expect(item.name).toBe('ration of cram');
            expect(item.category).toBe('FOOD');
        });
    });

    describe('TranslationEngine Localizing Integration', () => {
        it('should return raw English data when translate is false', () => {
            const mon = engine.getMonsterKnowledge('cockatrice', { translate: false });
            expect(mon.name).toBe('cockatrice');
            expect(mon.corpseInfo.causesPetrification).toBe(true);
            expect(mon.traits.petrifiesOnTouch).toBe(true);
            expect(mon.tacticalAdvice).toBeDefined();
        });

        it('should return localized Japanese data when translate is true', () => {
            const mon = engine.getMonsterKnowledge('cockatrice', { translate: true });
            expect(mon.name).toBe('コカトリス');
            expect(mon.corpseInfo.causesPetrification).toBe(true);
            expect(mon.traits.petrifiesOnTouch).toBe(true);
            expect(mon.corpseInfo.warningNote).toBe('接触石化 (手袋必須)');
            expect(mon.tacticalAdvice[0]).toContain('接触石化');
        });

        it('should automatically detect unidentified item appearances and return unidentified tips', () => {
            const unidPotion = engine.getItemKnowledge('ruby potion', { translate: false });
            expect(unidPotion).not.toBeNull();
            expect(unidPotion.isUnidentified).toBe(true);
            expect(unidPotion.category).toBe('POTION');
            expect(Array.isArray(unidPotion.unidentifiedTips)).toBe(true);
            expect(unidPotion.unidentifiedTips.length).toBe(0);

            const unidScroll = engine.getItemKnowledge('scroll labelled FOO', { translate: false });
            expect(unidScroll).not.toBeNull();
            expect(unidScroll.isUnidentified).toBe(true);
            expect(unidScroll.category).toBe('SCROLL');
        });

        it('should localize item fields when translate is true', () => {
            const item = engine.getItemKnowledge('wand_of_digging', { translate: true });
            expect(item.name).toBe('掘削の杖');
            expect(item.effectSummary).toBe('壁や床に穴や通路を掘る。');
            expect(item.actionLabel).toBe('振る (z)');
        });

        it('should localize stats.material (e.g. mineral) when translate is true', () => {
            // onum 472 (black opal 等の mineral 素材アイテム)
            const item = engine.getItemKnowledge(472, { translate: true });
            expect(item).not.toBeNull();
            expect(item.stats.material).toBe('鉱物');
        });

        it('should return empty tips and clean specs when language is en', () => {
            const unidPotion = engine.getItemKnowledge('ruby potion', { language: 'en' });
            expect(unidPotion).not.toBeNull();
            expect(unidPotion.isUnidentified).toBe(true);
            expect(unidPotion.unidentifiedTips.length).toBe(0);
            expect(unidPotion.usageAdvice.length).toBe(0);
            expect(unidPotion.appearanceName).toBe('ruby potion');
        });

        it('should return empty tips and clean specs when language is ja', () => {
            const unidPotion = engine.getItemKnowledge('ruby potion', { language: 'ja' });
            expect(unidPotion).not.toBeNull();
            expect(unidPotion.isUnidentified).toBe(true);
            expect(unidPotion.unidentifiedTips.length).toBe(0);
            expect(unidPotion.usageAdvice.length).toBe(0);
            expect(unidPotion.appearanceName).toBe('ruby potion');
        });

        it('should keep English action labels when translate is false', () => {
            const item = engine.getItemKnowledge('wand_of_digging', { translate: false });
            expect(item.name).toBe('wand of digging');
            expect(item.actionLabelEn).toBe('Zap (z)');
            expect(item.actionLabelJa).toBe('振る (z)');
        });
    });

    describe('Statue Knowledge Tests', () => {
        it('should resolve Statue knowledge by glyph ID for both single and pile statues', () => {
            // 単体像 (GLYPH_STATUE_OFF = 7226) -> monOffset 0 (ジャッカル / jackal など)
            const statue1 = engine.getKnowledge(7226, { translate: true });
            expect(statue1).not.toBeNull();
            expect(statue1.category).toBe('STATUE');
            expect(statue1.name).toContain('像');
            expect(statue1.effectSummary).toContain('石像');

            // 山積み像 (GLYPH_STATUE_PILETOP_OFF = 8856)
            const statuePile = engine.getKnowledge(8856, { translate: true });
            expect(statuePile).not.toBeNull();
            expect(statuePile.category).toBe('STATUE');
            expect(statuePile.name).toContain('像');
        });

        it('should resolve Statue knowledge from classifier entity object', () => {
            const entity = { type: 'STATUE', subType: 0, rawGlyph: 7226 };
            const statue = engine.getKnowledge(entity, { translate: true });
            expect(statue).not.toBeNull();
            expect(statue.category).toBe('STATUE');
            expect(statue.name).toContain('像');
        });

        it('should resolve Statue and Terrain knowledge correctly from text/name without falling back to TOOL', () => {
            // 石像 (statue)
            const statueStr = engine.getKnowledge('statue of goblin', { translate: true });
            expect(statueStr).not.toBeNull();
            expect(statueStr.category).toBe('STATUE');

            // 噴水 (fountain)
            const fountainStr = engine.getKnowledge('fountain', { translate: true });
            expect(fountainStr).not.toBeNull();
            expect(fountainStr.category).toBe('FOUNTAIN');

            // ダンジョン壁 (dungeon wall)
            const wallStr = engine.getKnowledge('dungeon wall', { translate: true });
            expect(wallStr).not.toBeNull();
            expect(wallStr.category).toBe('WALL');

            // ダンジョン床 (dungeon floor)
            const floorStr = engine.getKnowledge('dungeon floor', { translate: true });
            expect(floorStr).not.toBeNull();
            expect(floorStr.category).toBe('FLOOR');

            // オブジェクト ({ name: 'fountain' })
            const fountainObj = engine.getKnowledge({ name: 'fountain' }, { translate: true });
            expect(fountainObj).not.toBeNull();
            expect(fountainObj.category).toBe('FOUNTAIN');
        });

        it('should resolve specific monster name for statue glyph IDs (e.g. plains centaur 7356 / subType 130) even on hover', () => {
            // Glyph ID 7356 = GLYPH_STATUE_OFF (7226) + 130 (plains centaur)
            const statueGlyph = engine.getKnowledge(7356, { translate: true });
            expect(statueGlyph).not.toBeNull();
            expect(statueGlyph.category).toBe('STATUE');
            expect(statueGlyph.name).toContain('平原のケンタウロス');

            // オブジェクト { type: 'STATUE', subType: 130, rawGlyph: 7356 }
            const statueEntity = engine.getKnowledge({ type: 'STATUE', subType: 130, rawGlyph: 7356 }, { translate: true });
            expect(statueEntity).not.toBeNull();
            expect(statueEntity.category).toBe('STATUE');
            expect(statueEntity.name).toContain('平原のケンタウロス');

            // モンスター情報のない単なる石像テキスト/オブジェクトの場合、Unknown Creature にならずシンプルな「石像」になること
            const genericStatue = engine.getKnowledge({ name: 'statue' }, { translate: true });
            expect(genericStatue).not.toBeNull();
            expect(genericStatue.category).toBe('STATUE');
            expect(genericStatue.name).not.toContain('Unknown Creature');
            expect(genericStatue.name).toContain('石像');

            // マップセル上のアイテムオブジェクト ({ type: 'ITEM', subType: 476, glyph: 7356 }) も正しく転送され平原のケンタウロス像になること
            const mapItemStatue = engine.getKnowledge({ type: 'ITEM', subType: 476, glyph: 7356 }, { translate: true });
            expect(mapItemStatue).not.toBeNull();
            expect(mapItemStatue.category).toBe('STATUE');
            expect(mapItemStatue.name).toContain('平原のケンタウロス');

            // すでに完成したナレッジカードオブジェクトが getKnowledge に再投入されてもそのまま返却され上書き破棄されないこと
            const re投入Result = engine.getKnowledge(mapItemStatue, { translate: true });
            expect(re投入Result).toEqual(mapItemStatue);
            expect(re投入Result.name).toContain('平原のケンタウロス');
        });
    });

    describe('Pet and Special Monster Knowledge Tests', () => {
        it('should correctly resolve pet knowledge from pet glyph IDs (GLYPH_PET_OFF: 766~1531)', () => {
            // GLYPH_PET_OFF (766) + 32 (子猫 / kitten)
            const kittenGlyph = 766 + 32;
            const kittenKnowledge = engine.getKnowledge(kittenGlyph, { translate: true });
            expect(kittenKnowledge).not.toBeNull();
            expect(kittenKnowledge.category).toBe('MONSTER');
            expect(kittenKnowledge.name).toContain('子猫');
            expect(kittenKnowledge.dangerLevel).toBe('SAFE');
            expect(kittenKnowledge.dispositionStatus).toBe('TAMED');

            // GLYPH_PET_OFF (766) + 16 (小犬 / little dog)
            const dogGlyph = 766 + 16;
            const dogKnowledge = engine.getMonsterKnowledge(dogGlyph, { translate: true });
            expect(dogKnowledge).not.toBeNull();
            expect(dogKnowledge.name).toContain('小犬');
            expect(dogKnowledge.dangerLevel).toBe('SAFE');
            expect(dogKnowledge.dispositionStatus).toBe('TAMED');
        });

        it('should correctly resolve pet knowledge from classifier entity object ({ type: "PET", ... })', () => {
            const petEntity = { type: 'PET', subType: 32, rawGlyph: 766 + 32 };
            const petKnowledge = engine.getKnowledge(petEntity, { translate: true });
            expect(petKnowledge).not.toBeNull();
            expect(petKnowledge.name).toContain('子猫');
            expect(petKnowledge.dangerLevel).toBe('SAFE');
            expect(petKnowledge.dispositionStatus).toBe('TAMED');
        });

        it('should resolve ridden and detected monsters by glyph ID', () => {
            // GLYPH_RIDDEN_OFF (2682) + 130 (平原のケンタウロス)
            const riddenGlyph = 2682 + 130;
            const riddenKnowledge = engine.getKnowledge(riddenGlyph, { translate: true });
            expect(riddenKnowledge).not.toBeNull();
            expect(riddenKnowledge.name).toContain('平原のケンタウロス');

            // GLYPH_DETECT_OFF (1533) + 130
            const detectGlyph = 1533 + 130;
            const detectKnowledge = engine.getKnowledge(detectGlyph, { translate: true });
            expect(detectKnowledge).not.toBeNull();
            expect(detectKnowledge.name).toContain('平原のケンタウロス');
        });
    });

    describe('Static Caching & Translation Dedup Tests (Lazy Memoization)', () => {
        it('should perform zero translations at startup, lazily translate once on first access, and reuse cache thereafter', () => {
            let trCallCount = 0;
            const spyTranslationEngine = {
                translate: (text) => {
                    if (text === 'wood') {
                        trCallCount++;
                        return '木';
                    }
                    return text;
                }
            };

            // 1. 起動時・初期化時: 事前翻訳は一切行わず 0ms 起動 (trCallCount === 0)
            const customEngine = new StructuredKnowledgeEngine({
                translationEngine: spyTranslationEngine
            });
            expect(trCallCount).toBe(0);

            // 2. 初回アクセス時: 初めてオンデマンドで 1 回だけ翻訳され、静的キャッシュに固定登録
            const item1 = customEngine.getItemKnowledge(428, { translate: true });
            expect(item1.stats.material).toBe('木');
            expect(item1.material).toBe('木');
            expect(trCallCount).toBe(1);

            // 3. 2回目以降のアクセス（数値指定）: キャッシュから即時返却され、追加の translate() は 0 回
            const item2 = customEngine.getItemKnowledge(428, { translate: true });
            expect(item2.stats.material).toBe('木');
            expect(trCallCount).toBe(1);

            // 4. 2回目以降のインベントリアイテム取得（オブジェクト指定）: onum からキャッシュ即時返却され、追加の translate() は 0 回
            const itemObj = { onum: 428, str: 'a - wand of digging' };
            const item3 = customEngine.getItemKnowledge(itemObj, { translate: true });
            expect(item3.stats.material).toBe('木');
            expect(trCallCount).toBe(1);

            // 5. 言語切り替えまたは clearCache() 後: キャッシュがパージされ、次回のアクセスで再度 1 回翻訳
            customEngine.clearCache();
            const item4 = customEngine.getItemKnowledge(428, { translate: true });
            expect(item4.stats.material).toBe('木');
            expect(trCallCount).toBe(2);
        });

        it('未識別アイテム（ポーション・巻物等）も初回オンデマンド翻訳後にキャッシュされ、2回目以降再翻訳されないこと', () => {
            let trCallCount = 0;
            const spyTranslationEngine = {
                translate: (text) => {
                    trCallCount++;
                    return `訳:${text}`;
                }
            };

            const customEngine = new StructuredKnowledgeEngine({
                translationEngine: spyTranslationEngine
            });

            // 1. 初回: 未識別ポーション "ruby potion" の取得 -> 翻訳が実行されてキャッシュされる
            const p1 = customEngine.getItemKnowledge('ruby potion', { translate: true });
            expect(p1.isUnidentified).toBe(true);
            const initialCount = trCallCount;
            expect(initialCount).toBeGreaterThan(0);

            // 2. 2回目: 同一未識別ポーションの取得 -> キャッシュヒットにより翻訳呼び出しが 0 回
            const p2 = customEngine.getItemKnowledge('ruby potion', { translate: true });
            expect(p2.isUnidentified).toBe(true);
            expect(trCallCount).toBe(initialCount);

            // 3. 3回目: オブジェクト形式での取得 -> キャッシュヒットにより翻訳呼び出しが 0 回
            const p3 = customEngine.getItemKnowledge({ rawText: 'a - a ruby potion', onum: -1, isUnidentified: true }, { translate: true });
            expect(p3.isUnidentified).toBe(true);
            expect(trCallCount).toBe(initialCount);
        });

        it('should lazily memoize monster knowledge once and reuse cache for glyph, object, and string queries', () => {
            let trCallCount = 0;
            const spyTranslationEngine = {
                translate: (text) => {
                    if (text === 'cockatrice') {
                        trCallCount++;
                        return 'コカトリス';
                    }
                    return text;
                }
            };

            const customEngine = new StructuredKnowledgeEngine({
                translationEngine: spyTranslationEngine
            });

            // 1. 初回: monOffset (10) で取得 ➔ 1回翻訳
            const mon1 = customEngine.getMonsterKnowledge(10, { translate: true });
            expect(mon1.name).toBe('コカトリス');
            expect(trCallCount).toBe(1);

            // 2. 2回目: オブジェクト指定 ({ type: 'MONSTER', subType: 10 }) ➔ 追加翻訳0回（キャッシュヒット）
            const monObj = { type: 'MONSTER', subType: 10 };
            const mon2 = customEngine.getKnowledge(monObj, { translate: true });
            expect(mon2.name).toBe('コカトリス');
            expect(trCallCount).toBe(1);

            // 3. 3回目: 文字列指定 ('cockatrice') ➔ 追加翻訳0回（キャッシュヒット）
            const mon3 = customEngine.getMonsterKnowledge('cockatrice', { translate: true });
            expect(mon3.name).toBe('コカトリス');
            expect(trCallCount).toBe(1);

            // 4. 4回目: ペット指定 (isPet: true) ➔ 静的キャッシュを再利用し動的フラグのみ合成、追加翻訳0回！
            const petMon = customEngine.getMonsterKnowledge(10, { isPet: true, translate: true });
            expect(petMon.name).toBe('コカトリス');
            expect(petMon.dangerLevel).toBe('SAFE');
            expect(petMon.dispositionStatus).toBe('TAMED');
            expect(petMon.isTame).toBe(true);
            expect(petMon.isHostile).toBe(false);
            expect(trCallCount).toBe(1);

            // 5. 5回目: 確定Look (dynamicState あり) ➔ 静的キャッシュを再利用し動的フラグのみ合成、追加翻訳0回！
            const lookMon = customEngine.getMonsterKnowledge(10, {
                dynamicState: { hasResult: true, isPeaceful: true, stats: { hp: '24/24' } },
                translate: true
            });
            expect(lookMon.name).toBe('コカトリス');
            expect(lookMon.dangerLevel).toBe('SAFE');
            expect(lookMon.dispositionStatus).toBe('PEACEFUL');
            expect(lookMon.isPeaceful).toBe(true);
            expect(lookMon.isHostile).toBe(false);
            expect(lookMon.stats.hp).toBe('24/24');
            expect(trCallCount).toBe(1);
        });

        it('should lazily memoize terrain knowledge once and reuse cache for cmap glyph, object, and string queries', () => {
            let trCallCount = 0;
            const spyTranslationEngine = {
                translate: (text) => {
                    if (text === 'Stairs Down') {
                        trCallCount++;
                        return '下り階段';
                    }
                    return text;
                }
            };

            const customEngine = new StructuredKnowledgeEngine({
                translationEngine: spyTranslationEngine
            });

            // 1. 初回: 文字列 ('stairs_down') で取得 ➔ 1回翻訳
            const t1 = customEngine.getTerrainKnowledge('stairs_down', { translate: true });
            expect(t1.name).toBe('下り階段');
            expect(trCallCount).toBe(1);

            // 2. 2回目: 地形オブジェクト ({ type: 'TERRAIN', id: 'stairs_down' }) ➔ 追加翻訳0回（キャッシュヒット）
            const tObj = { type: 'TERRAIN', id: 'stairs_down' };
            const t2 = customEngine.getKnowledge(tObj, { translate: true });
            expect(t2.name).toBe('下り階段');
            expect(trCallCount).toBe(1);
        });

        it('water walking boots, holy water, potion of water が地形 WATER にならずアイテムナレッジとして解決されること', () => {
            const engine = new StructuredKnowledgeEngine();

            // 1. cleanItemName
            expect(engine.cleanItemName('an uncursed +0 pair of water walking boots (being worn)')).toBe('water walking boots');
            expect(engine.cleanItemName('a blessed potion of water')).toBe('potion of water');
            expect(engine.cleanItemName('a +0 pair of jungle boots')).toBe('jungle boots');

            // 2. getItemKnowledge
            const bootsItem = engine.getItemKnowledge('an uncursed +0 pair of water walking boots', { translate: false });
            expect(bootsItem).not.toBeNull();
            expect(bootsItem.category).not.toBe('WATER');
            expect(bootsItem.name.toLowerCase()).toContain('water walking boots');

            // 3. 汎用 getKnowledge
            const bootsKnowledge = engine.getKnowledge('an uncursed +0 pair of water walking boots', { translate: false });
            expect(bootsKnowledge).not.toBeNull();
            expect(bootsKnowledge.category).not.toBe('WATER');
            expect(bootsKnowledge.name.toLowerCase()).toContain('water walking boots');

            // 4. 地形の pool of water は引き続き WATER として解決されること
            const waterTerrain = engine.getKnowledge('pool of water', { translate: false });
            expect(waterTerrain).not.toBeNull();
            expect(waterTerrain.category).toBe('WATER');
        });

        it('モンスタークラス定義および変身時防具破壊リスクがSSOTとしてモンスターナレッジに結合されること', () => {
            const engine = new StructuredKnowledgeEngine();

            // 1. getMonsterClassKnowledge
            const lichClass = engine.getMonsterClassKnowledge('L');
            expect(lichClass).not.toBeNull();
            expect(lichClass.danger).toBe('CRITICAL');
            expect(lichClass.symbol).toBe('L');

            // 2. getAllMonsterClasses
            const allClasses = engine.getAllMonsterClasses();
            expect(allClasses.length).toBeGreaterThanOrEqual(45);

            // 3. getMonsterKnowledge で monsterClass と armorRisk が自動付与されること
            const mon = engine.getMonsterKnowledge('cockatrice');
            expect(mon).not.toBeNull();
            expect(mon.monsterClass).toBeDefined();
            expect(mon.monsterClass.symbol).toBe('c');
            expect(mon.monsterClass.danger).toBe('CRITICAL');
            expect(mon.armorRisk).toBeDefined();
            expect(typeof mon.armorRisk.willBreakArmor).toBe('boolean');

            // 4. checkMonsterArmorRisk 単体テスト
            const dragonRisk = engine.checkMonsterArmorRisk('silver dragon');
            expect(dragonRisk.willBreakArmor).toBe(true);
            expect(dragonRisk.severity).toBe('DANGER');
        });

        it('未識別インベントリアイテムに対するネタバレ防止ガードと安全ヒント文が機能すること', () => {
            const mockDiscoveryMgr = {
                isIdentified: (target) => false
            };
            const engine = new StructuredKnowledgeEngine({
                discoveryStateManager: mockDiscoveryMgr
            });

            // 未識別のインベントリアイテムオブジェクト (potion of healing)
            const itemTarget = {
                type: 'ITEM',
                rawText: 'a ruby potion',
                onum: 307,
                glyph: 3755,
                identification: {
                    isUnidentified: true,
                    appearanceName: 'ruby potion'
                }
            };

            const k = engine.getItemKnowledge(itemTarget, { language: 'ja' });
            expect(k).not.toBeNull();
            expect(k.isUnidentified).toBe(true);
            expect(k.effectSummary).toContain('未鑑定の薬');
            expect(k.effectSummary).toContain('正体不明');
            expect(k.name).not.toContain('potion of healing');
        });

        it('賢者の知恵モード (sagesWisdomMode: true) 有効時は未識別アイテムでも詳細ナレッジを開放すること', () => {
            const mockDiscoveryMgr = {
                isIdentified: (target) => false
            };
            const engine = new StructuredKnowledgeEngine({
                discoveryStateManager: mockDiscoveryMgr
            });

            const itemTarget = {
                type: 'ITEM',
                rawText: 'a ruby potion',
                onum: 307,
                glyph: 3755,
                identification: {
                    isUnidentified: true,
                    appearanceName: 'ruby potion'
                }
            };

            const k = engine.getItemKnowledge(itemTarget, { language: 'ja', sagesWisdomMode: true });
            expect(k).not.toBeNull();
            expect(k.isUnidentified).toBe(true);
            expect(k.isWisdomRevealed).toBe(true);
            // 詳細ナレッジが開放されていること（HP回復などの効果解説が存在）
            expect(k.effectSummary).toBeDefined();
            expect(k.effectSummary).not.toContain('正体不明');
        });

        it('床アイテム（onum指定）の未鑑定時に色や材料だけでなく完全な外見アイテム名（ルビー色の薬、鉄の杖等）が合成されること', () => {
            const mockDiscoveryMgr = {
                isIdentified: () => false
            };
            const engine = new StructuredKnowledgeEngine({
                discoveryStateManager: mockDiscoveryMgr
            });

            // 1. onum 307: potion of healing (descr: "purple-red")
            const potJa = engine.getItemKnowledge(307, { language: 'ja' });
            expect(potJa.isUnidentified).toBe(true);
            expect(potJa.name).toBe('赤紫色の薬');
            expect(potJa.nameEn).toBe('purple-red potion');

            const potEn = engine.getItemKnowledge(307, { language: 'en' });
            expect(potEn.name).toBe('purple-red potion');

            // 2. onum 428: wand of digging (descr: "iron")
            const wandJa = engine.getItemKnowledge(428, { language: 'ja' });
            expect(wandJa.isUnidentified).toBe(true);
            expect(wandJa.name).toBe('鉄の杖');
            expect(wandJa.nameEn).toBe('iron wand');

            const wandEn = engine.getItemKnowledge(428, { language: 'en' });
            expect(wandEn.name).toBe('iron wand');
        });

        it('床セルオブジェクト（cell.middle）が getKnowledge に渡された時、未鑑定なら外見名で保護され真名が漏洩しないこと', () => {
            const mockDiscoveryMgr = {
                isIdentified: (target) => false
            };
            const engine = new StructuredKnowledgeEngine({
                discoveryStateManager: mockDiscoveryMgr
            });

            // マップセル上の床アイテム（cell.middle: { type: 'ITEM', subType: 307, glyph: 3755 }）
            const floorEntity = {
                type: 'ITEM',
                subType: 307, // potion of healing
                glyph: 3755,
                rawGlyph: 3755,
                isContainer: false,
                isPile: false
            };

            const k = engine.getKnowledge(floorEntity, { language: 'ja' });
            expect(k).not.toBeNull();
            expect(k.isUnidentified).toBe(true);
            expect(k.name).toBe('赤紫色の薬');
            expect(k.name).not.toContain('potion of healing');
            expect(k.effectSummary).toContain('未鑑定の薬');
            expect(k.effectSummary).toContain('正体不明');
        });

        it('C言語の oc_descr_idx シャッフル同期後、床の gauntlets of power (onum=161) が初期固定名 (riding gloves) ではなく実際のシャッフル外見名 (fencing gloves / フェンシング用の手袋) で解決されること', () => {
            const mockDiscoveryMgr = {
                isIdentified: () => false,
                getAppearance: (onum) => (onum === 161 ? 'fencing gloves' : null)
            };
            const engine = new StructuredKnowledgeEngine({
                discoveryStateManager: mockDiscoveryMgr
            });

            // 床グリフ 3609 (onum 161: gauntlets of power, 静的descrは "riding gloves")
            const floorEntity = {
                type: 'ITEM',
                subType: 161,
                glyph: 3609,
                rawGlyph: 3609
            };

            const kJa = engine.getKnowledge(floorEntity, { language: 'ja' });
            expect(kJa).not.toBeNull();
            expect(kJa.isUnidentified).toBe(true);
            expect(kJa.name).toBe('フェンシング用の手袋');
            expect(kJa.nameEn).toBe('fencing gloves');
            expect(kJa.name).not.toContain('riding gloves');
            expect(kJa.name).not.toContain('乗馬用の手袋');
            expect(kJa.name).not.toContain('gauntlets of power');

            const kEn = engine.getKnowledge(floorEntity, { language: 'en' });
            expect(kEn.name).toBe('fencing gloves');
        });

        it('PileTop グリフ・エンティティ (アイテム・未識別アイテム・死体・石像) の解決時に isPile: true が保持され、単体参照キャッシュを汚染しないこと', () => {
            const engine = new StructuredKnowledgeEngine();

            // 1. 単体アイテム参照 (onum 428: wand of digging) -> isPile は未設定 (falsy)
            const singleWand = engine.getItemKnowledge(428);
            expect(singleWand.isPile).toBeUndefined();

            // 2. PileTop アイテムグリフ (GLYPH_OBJ_PILETOP_OFF 7992 + 428 = 8420) -> isPile: true
            const pileWandByGlyph = engine.getKnowledge(GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF + 428);
            expect(pileWandByGlyph.isPile).toBe(true);

            // 3. cell.middle オブジェクト ({ type: 'ITEM', subType: 428, isPile: true }) -> isPile: true
            const pileWandByEntity = engine.getKnowledge({
                type: 'ITEM',
                subType: 428,
                glyph: GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF + 428,
                isPile: true
            });
            expect(pileWandByEntity.isPile).toBe(true);

            // 4. 再度単体アイテム参照 -> キャッシュが isPile: true で汚染されていないこと
            const singleWandAfter = engine.getItemKnowledge(428);
            expect(singleWandAfter.isPile).toBeUndefined();

            // 5. 未識別アイテムの PileTop -> isPile: true が保持されること
            const unidEngine = new StructuredKnowledgeEngine({
                discoveryStateManager: { isIdentified: () => false }
            });
            const unidPile = unidEngine.getKnowledge({
                type: 'ITEM',
                subType: 307,
                glyph: GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF + 307,
                isPile: true
            });
            expect(unidPile.isUnidentified).toBe(true);
            expect(unidPile.isPile).toBe(true);

            // 6. 死体 (BODY) の PileTop (GLYPH_BODY_PILETOP_OFF = 8473) -> isPile: true
            const singleCorpse = engine.getKnowledge(GLYPH_OFFSETS.GLYPH_BODY_OFF + 10);
            expect(singleCorpse.isPile).toBeUndefined();
            const pileCorpse = engine.getKnowledge(GLYPH_OFFSETS.GLYPH_BODY_PILETOP_OFF + 10);
            expect(pileCorpse.category).toBe('CORPSE');
            expect(pileCorpse.isPile).toBe(true);

            // 7. 石像 (STATUE) の PileTop (GLYPH_STATUE_PILETOP_OFF = 8856) -> isPile: true
            const singleStatue = engine.getKnowledge(GLYPH_OFFSETS.GLYPH_STATUE_OFF + 130);
            expect(singleStatue.isPile).toBeUndefined();
            const pileStatue = engine.getKnowledge(GLYPH_OFFSETS.GLYPH_STATUE_PILETOP_OFF + 130);
            expect(pileStatue.category).toBe('STATUE');
            expect(pileStatue.isPile).toBe(true);
        });

        it('金貨 (GOLD / onum: 438) の数量 quan が反映され、正確な数量名称が生成されること', () => {
            const engineJa = new StructuredKnowledgeEngine({ language: 'ja' });
            const engineEn = new StructuredKnowledgeEngine({ language: 'en' });

            // 1. 日本語モードで複数枚 (quan: 250) の金貨
            const goldJa = engineJa.getItemKnowledge(438, { quan: 250 });
            expect(goldJa.quan).toBe(250);
            expect(goldJa.count).toBe(250);
            expect(goldJa.name).toBe('250枚の金貨');
            expect(goldJa.nameJa).toBe('250枚の金貨');
            expect(goldJa.displayNameJa).toBe('250枚の金貨');

            // 2. 英語モードで複数枚 (quan: 250) の金貨
            const goldEn = engineEn.getItemKnowledge(438, { quan: 250 });
            expect(goldEn.quan).toBe(250);
            expect(goldEn.name).toBe('250 gold pieces');
            expect(goldEn.nameEn).toBe('250 gold pieces');
            expect(goldEn.displayName).toBe('250 gold pieces');

            // 3. 1枚 (quan: 1) の金貨
            const singleGoldJa = engineJa.getItemKnowledge(438, { quan: 1 });
            expect(singleGoldJa.quan).toBe(1);
            expect(singleGoldJa.name).toBe('1枚の金貨');

            const singleGoldEn = engineEn.getItemKnowledge(438, { quan: 1 });
            expect(singleGoldEn.quan).toBe(1);
            expect(singleGoldEn.name).toBe('1 gold piece');

            // 4. directObject 経由の数量反映
            const directGold = engineJa.getItemKnowledge({
                onum: 438,
                directObject: { otyp: 438, quan: 500 }
            });
            expect(directGold.quan).toBe(500);
            expect(directGold.name).toBe('500枚の金貨');
        });
    });
});

