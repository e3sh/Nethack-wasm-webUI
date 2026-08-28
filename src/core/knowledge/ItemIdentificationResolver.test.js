import { describe, it, expect } from 'vitest';
import { ItemIdentificationResolver, IDENTIFICATION_LEVELS } from './ItemIdentificationResolver.js';

describe('ItemIdentificationResolver', () => {
    it('1. 完全未識別アイテム (Lv.0: UNIDENTIFIED) を正しく解決する', () => {
        const res = ItemIdentificationResolver.resolve('a - a ruby potion');
        expect(res.idLevel).toBe(IDENTIFICATION_LEVELS.UNIDENTIFIED);
        expect(res.isUnidentified).toBe(true);
        expect(res.category).toBe('POTION');
        expect(res.appearanceName).toBe('ruby potion');
        expect(res.bucStatus).toBe('UNKNOWN');
        expect(res.calledName).toBeNull();
        expect(res.identificationTips.length).toBeGreaterThan(0);
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
});
