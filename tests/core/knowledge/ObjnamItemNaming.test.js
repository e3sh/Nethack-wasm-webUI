/**
 * ObjnamItemNaming.test.js
 * 
 * NetHack公式 src/objnam.c (xname_flags / doname_base) 準拠
 * 決定論的アイテム名称生成エンジンの包括的仕様網羅テスト
 */

import { describe, it, expect } from 'vitest';
import { ItemNormalizer } from '../../../src/core/knowledge/models/ItemNormalizer.js';
import { ItemDisplayPresenter } from '../../../src/core/knowledge/presenters/ItemDisplayPresenter.js';

describe('src/objnam.c 準拠 決定論的アイテム名称生成テスト', () => {

    describe('1. 未視認・未識別・識別の3段階基礎名決定 (!dknown vs !oc_name_known vs oc_name_known)', () => {
        it('Lv.0: 遠隔・盲目未視認 (!dknown) の場合、カテゴリ総称名（potion, scroll, ring, wand, gem 等）となること', () => {
            // 薬 (POTION)
            const potion = ItemNormalizer.normalize({
                category: 'POTION',
                onum: 300,
                flags: { dknown: false }
            });
            expect(potion.name).toBe('potion');
            expect(potion.nameJa).toBe('薬');

            // 巻物 (SCROLL)
            const scroll = ItemNormalizer.normalize({
                category: 'SCROLL',
                onum: 330,
                flags: { dknown: false }
            });
            expect(scroll.name).toBe('scroll');
            expect(scroll.nameJa).toBe('巻物');

            // 杖 (WAND)
            const wand = ItemNormalizer.normalize({
                category: 'WAND',
                onum: 400,
                flags: { dknown: false }
            });
            expect(wand.name).toBe('wand');
            expect(wand.nameJa).toBe('杖');

            // 指輪 (RING)
            const ring = ItemNormalizer.normalize({
                category: 'RING',
                onum: 180,
                flags: { dknown: false }
            });
            expect(ring.name).toBe('ring');
            expect(ring.nameJa).toBe('指輪');

            // 宝石 (GEM)
            const gem = ItemNormalizer.normalize({
                category: 'GEM',
                onum: 450,
                flags: { dknown: false }
            });
            expect(gem.name).toBe('gem');
            expect(gem.nameJa).toBe('宝石');
        });

        it('Lv.1: 視認済み未識別 (dknown && isUnidentified) の場合、外見記述ベース（ruby potion 等）となること', () => {
            const rubyPotion = ItemNormalizer.normalize({
                category: 'POTION',
                name: 'ruby potion',
                rawText: 'a ruby potion',
                isUnidentified: true,
                flags: { dknown: true }
            });
            expect(rubyPotion.name).toBe('ruby potion');
            expect(rubyPotion.nameJa).toBe('ルビー色の薬');

            const wireRing = ItemNormalizer.normalize({
                category: 'RING',
                name: 'wire ring',
                rawText: 'a wire ring',
                isUnidentified: true,
                flags: { dknown: true }
            });
            expect(wireRing.name).toBe('wire ring');
            expect(wireRing.nameJa).toBe('針金の指輪');

            const glassWand = ItemNormalizer.normalize({
                category: 'WAND',
                name: 'glass wand',
                rawText: 'a glass wand',
                isUnidentified: true,
                flags: { dknown: true }
            });
            expect(glassWand.name).toBe('glass wand');
            expect(glassWand.nameJa).toBe('ガラスの杖');
        });

        it('Lv.2: 視認済み識別済み (dknown && !isUnidentified) の場合、公式真名（potion of healing 等）となること', () => {
            const healPotion = ItemNormalizer.normalize({
                category: 'POTION',
                onum: 307, // potion of healing
                trueName: 'healing',
                flags: { dknown: true, known: true },
                isUnidentified: false
            });
            expect(healPotion.name).toBe('potion of healing');
            expect(healPotion.nameJa).toBe('回復の薬');

            const teleScroll = ItemNormalizer.normalize({
                category: 'SCROLL',
                onum: 333,
                trueName: 'teleportation',
                flags: { dknown: true, known: true },
                isUnidentified: false
            });
            expect(teleScroll.name).toBe('scroll of teleportation');
            expect(teleScroll.nameJa).toBe('テレポートの巻物');
        });
    });

    describe('2. 強化値 (%+d) の表示条件（武器・防具・weptool・oc_chargedな指輪のみ）', () => {
        it('武器: known: true のときのみ強化値が表示され、known: false では非表示となること', () => {
            const identifiedSword = ItemNormalizer.normalize({
                category: 'WEAPON',
                name: 'long sword',
                spe: 2,
                flags: { known: true, dknown: true }
            });
            expect(identifiedSword.displayName).toBe('+2 long sword');

            const unidentifiedSword = ItemNormalizer.normalize({
                category: 'WEAPON',
                name: 'long sword',
                spe: 2,
                flags: { known: false, dknown: true }
            });
            expect(unidentifiedSword.displayName).toBe('long sword');
        });

        it('防具: known: true のときのみ強化値が表示され、0 でも +0 と表示されること', () => {
            const helmKnown = ItemNormalizer.normalize({
                category: 'ARMOR',
                name: 'helmet',
                spe: 0,
                flags: { known: true, dknown: true }
            });
            expect(helmKnown.displayName).toBe('+0 helmet');

            const helmUnknown = ItemNormalizer.normalize({
                category: 'ARMOR',
                name: 'helmet',
                spe: 0,
                flags: { known: false, dknown: true }
            });
            expect(helmUnknown.displayName).toBe('helmet');
        });

        it('指輪: oc_charged な指輪 (increase damage等) のみ known 時に強化値が表示されること', () => {
            // onum 177: ring of increase damage (oc_charged)
            const ringDmg = ItemNormalizer.normalize({
                category: 'RING',
                onum: 177,
                trueName: 'increase damage',
                spe: 1,
                flags: { known: true, dknown: true },
                isUnidentified: false
            });
            expect(ringDmg.displayName).toBe('+1 ring of increase damage');

            // onum 178: ring of protection (oc_charged)
            const ringProt = ItemNormalizer.normalize({
                category: 'RING',
                onum: 178,
                trueName: 'protection',
                spe: 2,
                flags: { known: true, dknown: true },
                isUnidentified: false
            });
            expect(ringProt.displayName).toBe('+2 ring of protection');
        });

        it('通常指輪・食料・薬・一般道具: spe が存在しても絶対に +0 等を表示してはならないこと', () => {
            // 浮遊の指輪 (ring of levitation: onum 183)
            const levRing = ItemNormalizer.normalize({
                category: 'RING',
                onum: 183,
                trueName: 'levitation',
                spe: 0,
                flags: { known: true, dknown: true },
                isUnidentified: false
            });
            expect(levRing.displayName).toBe('ring of levitation');
            expect(levRing.displayName).not.toContain('+0');

            // 食料 (FOOD)
            const food = ItemNormalizer.normalize({
                category: 'FOOD',
                name: 'food ration',
                spe: 0,
                flags: { known: true, dknown: true }
            });
            expect(food.displayName).toBe('food ration');
            expect(food.displayName).not.toContain('+0');

            // 薬 (POTION)
            const potion = ItemNormalizer.normalize({
                category: 'POTION',
                name: 'potion of speed',
                spe: 0,
                flags: { known: true, dknown: true }
            });
            expect(potion.displayName).toBe('potion of speed');
            expect(potion.displayName).not.toContain('+0');

            // 一般道具 (TOOL: lock pick)
            const pick = ItemNormalizer.normalize({
                category: 'TOOL',
                name: 'lock pick',
                spe: 0,
                flags: { known: true, dknown: true }
            });
            expect(pick.displayName).toBe('lock pick');
            expect(pick.displayName).not.toContain('+0');
        });
    });

    describe('3. チャージ数の表示条件（杖・oc_charged な道具）', () => {
        it('杖 (WAND): known: true のときのみ (recharged:spe) 形式でチャージが表示されること', () => {
            const wandKnown = ItemNormalizer.normalize({
                category: 'WAND',
                name: 'wand of wishing',
                spe: 3,
                recharged: 0,
                flags: { known: true, dknown: true },
                isUnidentified: false
            });
            expect(wandKnown.displayName).toBe('wand of wishing (0:3)');

            const wandUnknown = ItemNormalizer.normalize({
                category: 'WAND',
                name: 'wand of wishing',
                spe: 3,
                recharged: 0,
                flags: { known: false, dknown: true },
                isUnidentified: false
            });
            expect(wandUnknown.displayName).toBe('wand of wishing');
            expect(wandUnknown.displayName).not.toContain('(0:3)');
        });

        it('チャージ系道具 (crystal ball 等): known: true のときのみチャージ数が表示されること', () => {
            const ballKnown = ItemNormalizer.normalize({
                category: 'TOOL',
                onum: 231, // crystal ball
                trueName: 'crystal ball',
                spe: 5,
                recharged: 1,
                flags: { known: true, dknown: true },
                isUnidentified: false
            });
            expect(ballKnown.displayName).toBe('crystal ball (1:5)');
        });
    });

    describe('4. 特殊アイテム名称変化', () => {
        it('水の薬 (POT_WATER): bknown かつ blessed で聖水 (holy water) に変化すること', () => {
            const holyWater = ItemNormalizer.normalize({
                category: 'POTION',
                onum: 300,
                trueName: 'water',
                flags: { bknown: true, blessed: true, dknown: true },
                isUnidentified: false
            });
            expect(holyWater.name).toBe('potion of holy water');
            expect(holyWater.nameJa).toBe('聖水');
        });

        it('水の薬 (POT_WATER): bknown かつ cursed で邪水 (unholy water) に変化すること', () => {
            const unholyWater = ItemNormalizer.normalize({
                category: 'POTION',
                onum: 300,
                trueName: 'water',
                flags: { bknown: true, cursed: true, dknown: true },
                isUnidentified: false
            });
            expect(unholyWater.name).toBe('potion of unholy water');
            expect(unholyWater.nameJa).toBe('邪水');
        });

        it('死体 (CORPSE) & 像 (STATUE) & フィギュア (FIGURINE): モンスター名が正しく結合されること', () => {
            // 死体 (onum 265, corpsenm 322 = newt)
            const corpse = ItemNormalizer.normalize({
                category: 'FOOD',
                onum: 265,
                corpsenm: 322,
                flags: { dknown: true }
            });
            expect(corpse.name).toBe('newt corpse');
            expect(corpse.nameJa).toBe('イモリの死体');

            // 像 (onum 476, corpsenm 322 = newt)
            const statue = ItemNormalizer.normalize({
                category: 'ROCK',
                onum: 476,
                corpsenm: 322,
                flags: { dknown: true }
            });
            expect(statue.name).toBe('statue of a newt');
            expect(statue.nameJa).toBe('イモリの像');

            // フィギュア (onum 277, corpsenm 322 = newt)
            const figurine = ItemNormalizer.normalize({
                category: 'TOOL',
                onum: 277,
                corpsenm: 322,
                flags: { dknown: true }
            });
            expect(figurine.name).toBe('figurine of a newt');
            expect(figurine.nameJa).toBe('イモリのフィギュア');
        });

        it('容器・箱の状態表記 (empty, locked, unlocked, broken, trapped) が正しく反映されること', () => {
            const emptySack = ItemNormalizer.normalize({
                category: 'TOOL',
                onum: 217,
                name: 'sack',
                flags: { cknown: true, dknown: true }
            });
            expect(emptySack.displayName).toBe('empty sack');

            const lockedBox = ItemNormalizer.normalize({
                category: 'TOOL',
                onum: 214,
                name: 'large box',
                flags: { lknown: true, olocked: true, dknown: true }
            });
            expect(lockedBox.displayName).toBe('locked large box');

            const brokenChest = ItemNormalizer.normalize({
                category: 'TOOL',
                onum: 215,
                name: 'chest',
                flags: { lknown: true, obroken: true, dknown: true }
            });
            expect(brokenChest.displayName).toBe('broken chest');

            const trappedChest = ItemNormalizer.normalize({
                category: 'TOOL',
                onum: 215,
                name: 'chest',
                flags: { tknown: true, otrapped: true, dknown: true }
            });
            expect(trappedChest.displayName).toBe('trapped chest');
        });

        it('腐食・耐腐食状態 (oeroded, oeroded2, rknown && oerodeproof) が反映されること', () => {
            const rustySword = ItemNormalizer.normalize({
                category: 'WEAPON',
                name: 'iron sword',
                flags: { oeroded: 1, dknown: true }
            });
            expect(rustySword.displayName).toBe('rusty iron sword');

            const fireproofRobe = ItemNormalizer.normalize({
                category: 'ARMOR',
                name: 'robe',
                flags: { rknown: true, oerodeproof: true, dknown: true }
            });
            expect(fireproofRobe.displayName).toBe('fireproof robe');
        });

        it('個別銘 (named ...) および種別仮名 (called ...) にダブルクォーテーションを付けないこと', () => {
            const excalibur = ItemNormalizer.normalize({
                category: 'WEAPON',
                name: 'long sword',
                namedInstance: 'Excalibur',
                flags: { dknown: true }
            });
            expect(excalibur.displayName).toBe('long sword named Excalibur');
            expect(excalibur.displayName).not.toContain('"Excalibur"');

            const calledPotion = ItemNormalizer.normalize({
                category: 'POTION',
                name: 'ruby potion',
                calledName: 'fast',
                isUnidentified: true,
                flags: { dknown: true }
            });
            expect(calledPotion.displayName).toBe('ruby potion called fast');
            expect(calledPotion.displayName).not.toContain('"fast"');
        });
    });

    describe('5. 賢者の知恵（透視モード）のハイブリッド決定論的表示', () => {
        it('未識別アイテムに対し、外見名 [真名] を決定論的に併記すること', () => {
            const wisdomItem = ItemNormalizer.normalize({
                category: 'POTION',
                name: 'ruby potion',
                onum: 307,
                trueName: 'healing',
                isUnidentified: true,
                flags: { dknown: true, bknown: true, blessed: true }
            }, { sagesWisdomMode: true });

            expect(wisdomItem.displayName).toBe('blessed ruby potion [potion of healing]');
            expect(wisdomItem.displayNameJa).toBe('祝福された ルビー色の薬 [回復の薬]');
        });

        it('隠された真の強化値・チャージ数がブラケット内に表示されること', () => {
            const wisdomSword = ItemNormalizer.normalize({
                category: 'WEAPON',
                name: 'runed broadsword',
                onum: 50,
                trueName: 'broadsword',
                spe: 3,
                isUnidentified: true,
                flags: { dknown: true, known: false }
            }, { sagesWisdomMode: true });

            expect(wisdomSword.displayName).toBe('runed broadsword [+3 broadsword]');
        });

        it('ItemDisplayPresenter が正規表現を使わずに安全に各バッジ・表示要素を分離生成できること', () => {
            const item = ItemNormalizer.normalize({
                category: 'WEAPON',
                name: 'long sword',
                spe: 1,
                isWielded: true,
                flags: { bknown: true, blessed: true, known: true, dknown: true }
            });

            const equipBadge = ItemDisplayPresenter.getEquipBadgeHtml(item);
            expect(equipBadge).toContain('badge-wielded');

            const bucBadge = ItemDisplayPresenter.getBucBadgeHtml(item);
            expect(bucBadge).toContain('badge-buc-blessed');

            const enchBadge = ItemDisplayPresenter.getEnchantmentBadgeHtml(item);
            expect(enchBadge).toContain('+1');
        });
    });
});
