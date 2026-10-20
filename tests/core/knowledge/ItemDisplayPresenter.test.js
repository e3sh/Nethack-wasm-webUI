/**
 * ItemDisplayPresenter.test.js
 * 
 * ItemDisplayPresenter の表示契約・一貫性テスト
 */

import { describe, it, expect } from 'vitest';
import { ItemDisplayPresenter } from '../../../src/core/knowledge/presenters/ItemDisplayPresenter.js';
import { ItemNormalizer } from '../../../src/core/knowledge/models/ItemNormalizer.js';

describe('ItemDisplayPresenter', () => {
    describe('getFormattedTitle', () => {
        it('完全識別済みアイテムのタイトルを日本語・英語で正しく出力する', () => {
            const item = ItemNormalizer.normalize({
                letter: 'a',
                onum: 34,
                name: 'dagger',
                nameJa: '短剣',
                spe: 1,
                quan: 1,
                bucStatus: 'UNCURSED',
                isUnidentified: false
            });

            // 1. オプションで BUC を除外し、バイリンガル併記を有効にした場合
            const titleJaWithSubname = ItemDisplayPresenter.getFormattedTitle(item, { language: 'ja', includeBuc: false, includeBilingualSubname: true });
            expect(titleJaWithSubname).toContain('+1 短剣');
            expect(titleJaWithSubname).toContain('(dagger)');

            const titleEnNoBuc = ItemDisplayPresenter.getFormattedTitle(item, { language: 'en', includeBuc: false });
            expect(titleEnNoBuc).toBe('+1 dagger');

            // 2. SSOT デフォルト（Cコア完全名称）
            const titleJaFull = ItemDisplayPresenter.getFormattedTitle(item, { language: 'ja' });
            expect(titleJaFull).toBe('普通の +1 短剣');

            const titleEnFull = ItemDisplayPresenter.getFormattedTitle(item, { language: 'en' });
            expect(titleEnFull).toBe('uncursed +1 dagger');
        });

        it('未識別アイテム（外見名＋仮名）のタイトルを正しく出力する', () => {
            const item = ItemNormalizer.normalize({
                letter: 'b',
                onum: 300,
                category: 'POTION',
                appearanceName: 'smoky potion',
                appearanceNameJa: '煙った薬',
                calledName: '回復?',
                isUnidentified: true
            });

            const titleJa = ItemDisplayPresenter.getFormattedTitle(item, { language: 'ja' });
            expect(titleJa).toBe('煙った薬 [仮名: 回復?]');

            const titleEn = ItemDisplayPresenter.getFormattedTitle(item, { language: 'en' });
            expect(titleEn).toBe('smoky potion called 回復?');
        });

        it('賢者の知恵透視モード時のタイトル（外見名 [真名] 併記）を正しく出力する', () => {
            const item = ItemNormalizer.normalize({
                letter: 'c',
                onum: 301,
                category: 'POTION',
                appearanceName: 'ruby potion',
                appearanceNameJa: 'ルビー色の薬',
                name: 'potion of healing',
                nameJa: '回復の薬',
                trueName: 'potion of healing',
                trueNameJa: '回復の薬',
                calledName: 'ヒール',
                isUnidentified: true
            });

            const titleJa = ItemDisplayPresenter.getFormattedTitle(item, { language: 'ja', sagesWisdomMode: true });
            expect(titleJa).toContain('ルビー色の薬');
            expect(titleJa).toContain('[回復の薬]');
            expect(titleJa).toContain('[仮名: ヒール]');

            const titleEn = ItemDisplayPresenter.getFormattedTitle(item, { language: 'en', sagesWisdomMode: true });
            expect(titleEn).toContain('ruby potion');
            expect(titleEn).toContain('[potion of healing]');
            expect(titleEn).toContain('called ヒール');
        });

        it('数量が2個以上の場合に数量プレフィックスが付与される', () => {
            const item = ItemNormalizer.normalize({
                letter: 'd',
                name: 'arrow',
                nameJa: '矢',
                quan: 15,
                isUnidentified: false
            });

            const titleJa = ItemDisplayPresenter.getFormattedTitle(item, { language: 'ja' });
            expect(titleJa).toContain('15個の矢');

            const titleEn = ItemDisplayPresenter.getFormattedTitle(item, { language: 'en' });
            expect(titleEn).toContain('15 arrow');
        });
    });

    describe('getBucBadgeHtml', () => {
        it('format: symbol で祝呪シンボルを出力する', () => {
            const cursed = ItemNormalizer.normalize({ bucStatus: 'CURSED', isUnidentified: false });
            expect(ItemDisplayPresenter.getBucBadgeHtml(cursed, { format: 'symbol' })).toContain('buc-cursed');
            expect(ItemDisplayPresenter.getBucBadgeHtml(cursed, { format: 'symbol' })).toContain('-');
            expect(ItemDisplayPresenter.getBucBadgeHtml(cursed, { format: 'symbol', language: 'ja' })).toContain('title="呪い"');
            expect(ItemDisplayPresenter.getBucBadgeHtml(cursed, { format: 'symbol', language: 'en' })).toContain('title="Cursed"');

            const blessed = ItemNormalizer.normalize({ bucStatus: 'BLESSED', isUnidentified: false });
            expect(ItemDisplayPresenter.getBucBadgeHtml(blessed, { format: 'symbol' })).toContain('buc-blessed');
            expect(ItemDisplayPresenter.getBucBadgeHtml(blessed, { format: 'symbol' })).toContain('+');
            expect(ItemDisplayPresenter.getBucBadgeHtml(blessed, { format: 'symbol', language: 'ja' })).toContain('title="祝福"');
            expect(ItemDisplayPresenter.getBucBadgeHtml(blessed, { format: 'symbol', language: 'en' })).toContain('title="Blessed"');

            const unid = ItemNormalizer.normalize({ isUnidentified: true });
            expect(ItemDisplayPresenter.getBucBadgeHtml(unid, { format: 'symbol' })).toContain('badge-buc-unid');
            expect(ItemDisplayPresenter.getBucBadgeHtml(unid, { format: 'symbol' })).toContain('?');
            expect(ItemDisplayPresenter.getBucBadgeHtml(unid, { format: 'symbol', language: 'ja' })).toContain('title="未識別"');
            expect(ItemDisplayPresenter.getBucBadgeHtml(unid, { format: 'symbol', language: 'en' })).toContain('title="Unidentified"');

            const wisdom = ItemNormalizer.normalize({ isUnidentified: true, bucStatus: 'UNCURSED' });
            expect(ItemDisplayPresenter.getBucBadgeHtml(wisdom, { format: 'symbol', sagesWisdomMode: true })).toContain('badge-buc-wisdom');
            expect(ItemDisplayPresenter.getBucBadgeHtml(wisdom, { format: 'symbol', sagesWisdomMode: true })).toContain('🧙');
        });

        it('未識別アイテムで呪い・祝福が判明している場合は BUC シンボルと未識別(?)バッジの両方を表示する', () => {
            // 未識別の呪われたアイテム
            const unidCursed = ItemNormalizer.normalize({ isUnidentified: true, bucStatus: 'CURSED' });
            const cursedBadgeJa = ItemDisplayPresenter.getBucBadgeHtml(unidCursed, { format: 'symbol', language: 'ja' });
            expect(cursedBadgeJa).toContain('badge-buc-cursed');
            expect(cursedBadgeJa).toContain('-');
            expect(cursedBadgeJa).toContain('title="呪い (未識別)"');
            expect(cursedBadgeJa).toContain('badge-buc-unid');
            expect(cursedBadgeJa).toContain('?');

            const cursedBadgeEn = ItemDisplayPresenter.getBucBadgeHtml(unidCursed, { format: 'symbol', language: 'en' });
            expect(cursedBadgeEn).toContain('title="Cursed (Unidentified)"');
            expect(cursedBadgeEn).toContain('badge-buc-unid');

            // 未識別の祝福されたアイテム
            const unidBlessed = ItemNormalizer.normalize({ isUnidentified: true, bucStatus: 'BLESSED' });
            const blessedBadgeJa = ItemDisplayPresenter.getBucBadgeHtml(unidBlessed, { format: 'symbol', language: 'ja' });
            expect(blessedBadgeJa).toContain('badge-buc-blessed');
            expect(blessedBadgeJa).toContain('+');
            expect(blessedBadgeJa).toContain('title="祝福 (未識別)"');
            expect(blessedBadgeJa).toContain('badge-buc-unid');
            expect(blessedBadgeJa).toContain('?');

            const blessedBadgeEn = ItemDisplayPresenter.getBucBadgeHtml(unidBlessed, { format: 'symbol', language: 'en' });
            expect(blessedBadgeEn).toContain('title="Blessed (Unidentified)"');
            expect(blessedBadgeEn).toContain('badge-buc-unid');

            // 未識別で UNCURSED のアイテム (祝福・呪いシンボルがないため未識別の ? バッジのみを表示する)
            const unidUncursed = ItemNormalizer.normalize({ isUnidentified: true, bucStatus: 'UNCURSED' });
            const uncursedBadgeJa = ItemDisplayPresenter.getBucBadgeHtml(unidUncursed, { format: 'symbol', language: 'ja' });
            expect(uncursedBadgeJa).toContain('badge-buc-unid');
            expect(uncursedBadgeJa).toContain('?');
            expect(uncursedBadgeJa).toContain('title="未識別"');

            // 賢者の知恵下で未識別かつ呪われているアイテム
            const wisdomCursed = ItemNormalizer.normalize({ isUnidentified: true, bucStatus: 'CURSED' });
            const wisdomCursedBadge = ItemDisplayPresenter.getBucBadgeHtml(wisdomCursed, { format: 'symbol', sagesWisdomMode: true, language: 'ja' });
            expect(wisdomCursedBadge).toContain('badge-buc-cursed');
            expect(wisdomCursedBadge).toContain('title="呪い (賢者の知恵)"');
            expect(wisdomCursedBadge).toContain('badge-buc-wisdom');

            // 賢者の知恵下で未識別かつ祝福されているアイテム
            const wisdomBlessed = ItemNormalizer.normalize({ isUnidentified: true, bucStatus: 'BLESSED' });
            const wisdomBlessedBadge = ItemDisplayPresenter.getBucBadgeHtml(wisdomBlessed, { format: 'symbol', sagesWisdomMode: true, language: 'ja' });
            expect(wisdomBlessedBadge).toContain('badge-buc-blessed');
            expect(wisdomBlessedBadge).toContain('title="祝福 (賢者の知恵)"');
            expect(wisdomBlessedBadge).toContain('badge-buc-wisdom');
        });

        it('format: pill でラベル付きバッジを出力する', () => {
            const blessed = ItemNormalizer.normalize({ bucStatus: 'BLESSED', isUnidentified: false });
            const pillJa = ItemDisplayPresenter.getBucBadgeHtml(blessed, { language: 'ja', format: 'pill' });
            expect(pillJa).toContain('✨ 祝福');

            const pillEn = ItemDisplayPresenter.getBucBadgeHtml(blessed, { language: 'en', format: 'pill' });
            expect(pillEn).toContain('✨ BLESSED');
        });
    });

    describe('getEquipBadgeHtml', () => {
        it('装備状態に応じたバッジを日本語・英語で正しく出力する', () => {
            const wielded = ItemNormalizer.normalize({ isWielded: true });
            expect(ItemDisplayPresenter.getEquipBadgeHtml(wielded, { language: 'ja' })).toContain('badge-wielded');
            expect(ItemDisplayPresenter.getEquipBadgeHtml(wielded, { language: 'ja' })).toContain('手');
            expect(ItemDisplayPresenter.getEquipBadgeHtml(wielded, { language: 'en' })).toContain('W');

            const offhand = ItemNormalizer.normalize({ isOffhand: true });
            expect(ItemDisplayPresenter.getEquipBadgeHtml(offhand, { language: 'ja' })).toContain('副');

            const quivered = ItemNormalizer.normalize({ isQuivered: true });
            expect(ItemDisplayPresenter.getEquipBadgeHtml(quivered, { language: 'ja' })).toContain('筒');

            const worn = ItemNormalizer.normalize({ isWorn: true });
            expect(ItemDisplayPresenter.getEquipBadgeHtml(worn, { language: 'ja' })).toContain('着');
        });
    });

    describe('getItemMenuRowContentHtml', () => {
        it('実インベントリメニュー行のHTML要素（レター・バッジ・名称）を統合出力する', () => {
            const item = ItemNormalizer.normalize({
                letter: 'a',
                onum: 34,
                name: 'dagger',
                nameJa: '短剣',
                spe: 2,
                bucStatus: 'BLESSED',
                isWielded: true,
                isUnidentified: false
            });

            const html = ItemDisplayPresenter.getItemMenuRowContentHtml(item, { language: 'ja' });
            expect(html).toContain('a)');
            expect(html).toContain('badge-wielded');
            expect(html).toContain('buc-blessed');
            expect(html).toContain('+2 短剣');
        });

        it('未識別アイテム行で sagesWisdomMode: false の時は ? バッジと外見名が出力され、真名が一切含まれないこと', () => {
            const rawUnidPotion = {
                letter: 'c',
                onum: 308,
                category: 'POTION',
                rawText: 'a ruby potion',
                name: 'potion of extra healing',
                nameJa: '強力回復の薬',
                trueName: 'potion of extra healing',
                trueNameJa: '強力回復の薬',
                appearanceName: 'ruby potion',
                appearanceNameJa: 'ルビー色の薬',
                isUnidentified: true,
                bucStatus: 'UNKNOWN'
            };
            const canonical = ItemNormalizer.normalize(rawUnidPotion);

            const normalHtml = ItemDisplayPresenter.getItemMenuRowContentHtml(canonical, { language: 'ja', sagesWisdomMode: false });
            expect(normalHtml).toContain('ルビー色の薬');
            expect(normalHtml).toContain('badge-buc-unid');
            expect(normalHtml).toContain('?');
            expect(normalHtml).not.toContain('強力回復');
            expect(normalHtml).not.toContain('extra healing');

            const wisdomHtml = ItemDisplayPresenter.getItemMenuRowContentHtml(canonical, { language: 'ja', sagesWisdomMode: true });
            expect(wisdomHtml).toContain('ルビー色の薬 [強力回復の薬]');
            expect(wisdomHtml).toContain('badge-buc-wisdom');
        });
    });

    describe('未識別アイテムの真名露出ゼロ（0文字漏洩）契約', () => {
        const testCases = [
            {
                type: '薬 (Potion)',
                raw: {
                    category: 'POTION',
                    appearanceName: 'ruby potion',
                    appearanceNameJa: 'ルビー色の薬',
                    name: 'potion of extra healing',
                    nameJa: '超回復の薬',
                    trueName: 'potion of extra healing',
                    trueNameJa: '超回復の薬',
                    isUnidentified: true
                },
                expectedJa: 'ルビー色の薬',
                expectedEn: 'ruby potion',
                forbiddenWords: ['超回復', 'extra healing', 'healing']
            },
            {
                type: '巻物 (Scroll)',
                raw: {
                    category: 'SCROLL',
                    appearanceName: 'scroll labeled ZELGO MER',
                    appearanceNameJa: '「ZELGO MER」と書かれた巻物',
                    name: 'scroll of identify',
                    nameJa: '鑑定の巻物',
                    trueName: 'scroll of identify',
                    trueNameJa: '鑑定の巻物',
                    isUnidentified: true
                },
                expectedJa: '「ZELGO MER」と書かれた巻物',
                expectedEn: 'scroll labeled ZELGO MER',
                forbiddenWords: ['鑑定', 'identify']
            },
            {
                type: '指輪 (Ring)',
                raw: {
                    category: 'RING',
                    appearanceName: 'iron ring',
                    appearanceNameJa: '鉄の指輪',
                    name: 'ring of teleportation',
                    nameJa: 'テレポートの指輪',
                    trueName: 'ring of teleportation',
                    trueNameJa: 'テレポートの指輪',
                    isUnidentified: true
                },
                expectedJa: '鉄の指輪',
                expectedEn: 'iron ring',
                forbiddenWords: ['テレポート', 'teleportation']
            },
            {
                type: '杖 (Wand)',
                raw: {
                    category: 'WAND',
                    appearanceName: 'glass wand',
                    appearanceNameJa: 'ガラスの杖',
                    name: 'wand of death',
                    nameJa: '死の杖',
                    trueName: 'wand of death',
                    trueNameJa: '死の杖',
                    isUnidentified: true
                },
                expectedJa: 'ガラスの杖',
                expectedEn: 'glass wand',
                forbiddenWords: ['死の杖', 'death']
            }
        ];

        for (const tc of testCases) {
            it(`${tc.type}: 通常時は外見名のみ表示され、真名が日本語・英語ともに0文字漏洩であること`, () => {
                const item = ItemNormalizer.normalize(tc.raw);

                const titleJa = ItemDisplayPresenter.getFormattedTitle(item, { language: 'ja', sagesWisdomMode: false });
                expect(titleJa).toBe(tc.expectedJa);
                for (const word of tc.forbiddenWords) {
                    expect(titleJa).not.toContain(word);
                }

                const titleEn = ItemDisplayPresenter.getFormattedTitle(item, { language: 'en', sagesWisdomMode: false });
                expect(titleEn).toBe(tc.expectedEn);
                for (const word of tc.forbiddenWords) {
                    expect(titleEn).not.toContain(word);
                }
            });
        }
    });
});
