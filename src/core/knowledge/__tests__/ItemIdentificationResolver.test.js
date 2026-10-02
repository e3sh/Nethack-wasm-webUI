import { describe, it, expect } from 'vitest';
import { ItemIdentificationResolver, IDENTIFICATION_LEVELS } from "../engines/ItemIdentificationResolver.js";

describe('ItemIdentificationResolver', () => {
    it('1. 完全未識別アイテム (Lv.0: UNIDENTIFIED) を正しく解決する', () => {
        const res = ItemIdentificationResolver.resolve('a - a ruby potion');
        expect(res.idLevel).toBe(IDENTIFICATION_LEVELS.UNIDENTIFIED);
        expect(res.isUnidentified).toBe(true);
        expect(res.category).toBe('POTION');
        expect(res.appearanceName).toBe('ruby potion');
        expect(res.bucStatus).toBe('UNKNOWN');
        expect(res.calledName).toBeNull();
        expect(Array.isArray(res.identificationTips)).toBe(true);
        expect(res.identificationTips.length).toBe(0);
    });

    it('2. BUC判明済み未識別アイテム (Lv.1: BUC_KNOWN) を正しく解決する', () => {
        const res = ItemIdentificationResolver.resolve('b - a blessed conical hat');
        expect(res.idLevel).toBe(IDENTIFICATION_LEVELS.BUC_KNOWN);
        expect(res.isUnidentified).toBe(true);
        expect(res.category).toBe('ARMOR');
        expect(res.appearanceName).toBe('conical hat');
        expect(res.bucStatus).toBe('BLESSED');
        expect(res.calledName).toBeNull();
    });

    it('3. 仮名付き未識別アイテム (Lv.2: NAMED) を正しく解決する', () => {
        const res = ItemIdentificationResolver.resolve('c - an uncursed silver wand called digging?');
        expect(res.idLevel).toBe(IDENTIFICATION_LEVELS.NAMED);
        expect(res.isUnidentified).toBe(true);
        expect(res.category).toBe('WAND');
        expect(res.appearanceName).toBe('silver wand');
        expect(res.bucStatus).toBe('UNCURSED');
        expect(res.calledName).toBe('digging?');
    });

    it('4. タイプ識別済みアイテム (Lv.3: TYPE_IDENTIFIED) を正しく解決する', () => {
        const res = ItemIdentificationResolver.resolve('d - a potion of healing');
        expect(res.idLevel).toBe(IDENTIFICATION_LEVELS.TYPE_IDENTIFIED);
        expect(res.isUnidentified).toBe(false);
        expect(res.category).toBe('POTION');
        expect(res.coreName).toBe('potion of healing');
    });

    it('5. 完全個別識別済みアイテム (Lv.4: FULLY_IDENTIFIED) を正しく解決する', () => {
        const resArmor = ItemIdentificationResolver.resolve('e - a blessed +2 leather armor (being worn)');
        expect(resArmor.idLevel).toBe(IDENTIFICATION_LEVELS.FULLY_IDENTIFIED);
        expect(resArmor.isUnidentified).toBe(false);
        expect(resArmor.enchantment).toBe(2);
        expect(resArmor.bucStatus).toBe('BLESSED');

        const resWand = ItemIdentificationResolver.resolve('f - a wand of digging (0:4)');
        expect(resWand.idLevel).toBe(IDENTIFICATION_LEVELS.FULLY_IDENTIFIED);
        expect(resWand.isUnidentified).toBe(false);
        expect(resWand.charges).toBe('0:4');
    });

    it('6. 巻物のラベル外見 (Scroll labeled ...) を判定できる', () => {
        const res = ItemIdentificationResolver.resolve('g - a scroll labeled ZELGO MER');
        expect(res.isUnidentified).toBe(true);
        expect(res.category).toBe('SCROLL');
        expect(res.appearanceName).toBe('scroll labeled ZELGO MER');
    });

    it('7. 灰色の石 (gray stone) を未識別として判定できる', () => {
        const res = ItemIdentificationResolver.resolve('h - a cursed gray stone');
        expect(res.isUnidentified).toBe(true);
        expect(res.category).toBe('GEM_STONE');
        expect(res.bucStatus).toBe('CURSED');
    });

    it('8. 角括弧スロット表記と装備修飾子付き識別済み指輪 ([n] an uncursed ring of free action (on left hand)) を正しく TYPE_IDENTIFIED と判定する', () => {
        const res = ItemIdentificationResolver.resolve('[n] an uncursed ring of free action (on left hand)');
        expect(res.isUnidentified).toBe(false);
        expect(res.idLevel).toBe(IDENTIFICATION_LEVELS.TYPE_IDENTIFIED);
        expect(res.category).toBe('RING');
        expect(res.bucStatus).toBe('UNCURSED');
        expect(res.coreName).toBe('ring of free action');
    });

    it('9. リングメイル (ring mail / crude ring mail / orcish ring mail) が ARMOR カテゴリと判定され RING にならないこと', () => {
        const res1 = ItemIdentificationResolver.resolve('a - an orcish ring mail');
        expect(res1.category).toBe('ARMOR');

        const res2 = ItemIdentificationResolver.resolve('b - a crude ring mail');
        expect(res2.category).toBe('ARMOR');

        const res3 = ItemIdentificationResolver.resolve('c - a +0 ring mail');
        expect(res3.category).toBe('ARMOR');
    });

    it('10. ランダム外見カテゴリ（Potion, Scroll, Wand, Ring, Amulet, Spellbook）の真名ガードと未識別判定', () => {
        // ポーション
        const potUnk1 = ItemIdentificationResolver.resolve('a clear potion');
        expect(potUnk1.isUnidentified).toBe(true);
        expect(potUnk1.category).toBe('POTION');

        const potUnk2 = ItemIdentificationResolver.resolve('a potion called mystery');
        expect(potUnk2.isUnidentified).toBe(true);
        expect(potUnk2.category).toBe('POTION');
        expect(potUnk2.calledName).toBe('mystery');

        const potTrue = ItemIdentificationResolver.resolve('2 potions of extra healing');
        expect(potTrue.isUnidentified).toBe(false);
        expect(potTrue.category).toBe('POTION');

        // 巻物
        const scrUnk1 = ItemIdentificationResolver.resolve('a scroll called teleport');
        expect(scrUnk1.isUnidentified).toBe(true);
        expect(scrUnk1.category).toBe('SCROLL');
        expect(scrUnk1.calledName).toBe('teleport');

        const scrUnk2 = ItemIdentificationResolver.resolve('an uncursed scroll');
        expect(scrUnk2.isUnidentified).toBe(true);
        expect(scrUnk2.category).toBe('SCROLL');

        const scrTrue1 = ItemIdentificationResolver.resolve('a scroll of identify');
        expect(scrTrue1.isUnidentified).toBe(false);
        expect(scrTrue1.category).toBe('SCROLL');

        const scrTrue2 = ItemIdentificationResolver.resolve('an uncursed blank paper');
        expect(scrTrue2.isUnidentified).toBe(false);
        expect(scrTrue2.category).toBe('SCROLL');

        // 杖
        const wandUnk = ItemIdentificationResolver.resolve('a wand called digger');
        expect(wandUnk.isUnidentified).toBe(true);
        expect(wandUnk.category).toBe('WAND');

        const wandTrue = ItemIdentificationResolver.resolve('a wand of digging');
        expect(wandTrue.isUnidentified).toBe(false);
        expect(wandTrue.category).toBe('WAND');

        // 指輪
        const ringUnk = ItemIdentificationResolver.resolve('a shiny ring called invis');
        expect(ringUnk.isUnidentified).toBe(true);
        expect(ringUnk.category).toBe('RING');

        const ringTrue1 = ItemIdentificationResolver.resolve('a ring of conflict');
        expect(ringTrue1.isUnidentified).toBe(false);
        expect(ringTrue1.category).toBe('RING');

        const ringTrue2 = ItemIdentificationResolver.resolve('an uncursed meat ring');
        expect(ringTrue2.isUnidentified).toBe(false);
        expect(ringTrue2.category).toBe('RING');

        // アミュレット
        const amUnk = ItemIdentificationResolver.resolve('a circular amulet');
        expect(amUnk.isUnidentified).toBe(true);
        expect(amUnk.category).toBe('AMULET');

        const amTrue1 = ItemIdentificationResolver.resolve('an amulet of ESP');
        expect(amTrue1.isUnidentified).toBe(false);
        expect(amTrue1.category).toBe('AMULET');

        const amTrue2 = ItemIdentificationResolver.resolve('the Amulet of Yendor');
        expect(amTrue2.isUnidentified).toBe(false);
        expect(amTrue2.category).toBe('AMULET');

        // 魔法書
        const bookUnk = ItemIdentificationResolver.resolve('a parchment spellbook');
        expect(bookUnk.isUnidentified).toBe(true);
        expect(bookUnk.category).toBe('SPELLBOOK');

        const bookTrue1 = ItemIdentificationResolver.resolve('a spellbook of force bolt');
        expect(bookTrue1.isUnidentified).toBe(false);
        expect(bookTrue1.category).toBe('SPELLBOOK');

        const bookTrue2 = ItemIdentificationResolver.resolve('the Book of the Dead');
        expect(bookTrue2.isUnidentified).toBe(false);
        expect(bookTrue2.category).toBe('SPELLBOOK');
    });

    it('11. 部族武器・防具の外見名、複数形、修飾子付きアイテムの未識別判定', () => {
        // 矢の複数形・毒修飾子
        const arrows1 = ItemIdentificationResolver.resolve('15 crude arrows');
        expect(arrows1.isUnidentified).toBe(true);
        expect(arrows1.category).toBe('WEAPON');
        expect(arrows1.appearanceName).toBe('crude arrow');

        const arrows2 = ItemIdentificationResolver.resolve('3 poisoned crude arrows');
        expect(arrows2.isUnidentified).toBe(true);
        expect(arrows2.category).toBe('WEAPON');

        const bamboo = ItemIdentificationResolver.resolve('10 bamboo arrows (in quiver)');
        expect(bamboo.isUnidentified).toBe(true);
        expect(bamboo.category).toBe('WEAPON');
        expect(bamboo.appearanceName).toBe('bamboo arrow');

        // 外見防具
        const crudeRingMail = ItemIdentificationResolver.resolve('a crude ring mail');
        expect(crudeRingMail.isUnidentified).toBe(true);
        expect(crudeRingMail.category).toBe('ARMOR');
        expect(crudeRingMail.appearanceName).toBe('crude ring mail');

        const orcishRingMail = ItemIdentificationResolver.resolve('an orcish ring mail');
        expect(orcishRingMail.isUnidentified).toBe(false);
        expect(orcishRingMail.category).toBe('ARMOR');

        const crudeChainMail = ItemIdentificationResolver.resolve('an uncursed crude chain mail');
        expect(crudeChainMail.isUnidentified).toBe(true);
        expect(crudeChainMail.category).toBe('ARMOR');

        const crystalHelm = ItemIdentificationResolver.resolve('a crystal helmet');
        expect(crystalHelm.isUnidentified).toBe(true);
        expect(crystalHelm.category).toBe('ARMOR');

        const woodShield = ItemIdentificationResolver.resolve('a wooden shield');
        expect(woodShield.isUnidentified).toBe(true);
        expect(woodShield.category).toBe('ARMOR');
    });

    it('12. onum および discoveryStateManager 連携による二重防御', () => {
        // onum 300: potion of healing
        // 外見名 "ruby potion" のオブジェクトを渡した場合
        const resUnk = ItemIdentificationResolver.resolve({
            onum: 300,
            rawText: 'a ruby potion'
        });
        expect(resUnk.isUnidentified).toBe(true);

        // discoveryStateManager で識別済みのモックを渡した場合
        const mockDiscoveryMgr = {
            isIdentified: (target) => target === 300 || target === 'ruby potion'
        };
        const resKnown = ItemIdentificationResolver.resolve({
            onum: 300,
            rawText: 'a ruby potion'
        }, { discoveryStateManager: mockDiscoveryMgr });
        expect(resKnown.isUnidentified).toBe(false);
    });

    it('13. 複数形ポーション (4 potions of extra healing) および日本語名アイテムの識別判定', () => {
        // 初期所持アイテム: 4 potions of extra healing (複数形 potions of ...)
        const potPlural = ItemIdentificationResolver.resolve('d - 4 potions of extra healing');
        expect(potPlural.isUnidentified).toBe(false);
        expect(potPlural.category).toBe('POTION');
        expect(potPlural.coreName).toBe('potion of extra healing');

        // 日本語名: 4本の超回復のポーション
        const potJa = ItemIdentificationResolver.resolve('4本の超回復のポーション');
        expect(potJa.isUnidentified).toBe(false);
        expect(potJa.category).toBe('POTION');

        // 日本語名: 祝福された回復のポーション
        const potJaBlessed = ItemIdentificationResolver.resolve('祝福された回復のポーション');
        expect(potJaBlessed.isUnidentified).toBe(false);
        expect(potJaBlessed.bucStatus).toBe('BLESSED');
    });
});
