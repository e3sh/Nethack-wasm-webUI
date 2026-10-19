import { describe, it, expect } from 'vitest';
import { ItemNormalizer, VALID_CATEGORIES, OCLASS_TO_CATEGORY_MAP } from '../../../src/core/knowledge/models/ItemNormalizer.js';

describe('ItemNormalizer - 単一正規化アイテムスキーマ (Canonical Item Schema)', () => {

    describe('1. 基本契約とバリデーション (assertCanonicalItem)', () => {
        it('空オブジェクトまたは null を渡しても有効な CanonicalItem を生成すること', () => {
            const item = ItemNormalizer.normalize(null);
            expect(item._canonical).toBe(true);
            expect(item.source).toBe('VIRTUAL');
            expect(item.category).toBe('OTHER');
            expect(item.letter).toBeNull();
            expect(item.isUnidentified).toBe(false);
            expect(item.isDiscovered).toBe(true);
            expect(ItemNormalizer.assertCanonicalItem(item)).toBe(true);
        });

        it('正規化済みアイテムに対して assertCanonicalItem が true を返すこと', () => {
            const item = ItemNormalizer.normalize({
                letter: 'a',
                category: 'POTION',
                rawText: 'a smoky potion',
                name: 'smoky potion',
                displayNameJa: '煙った薬',
                isUnidentified: true
            });
            expect(ItemNormalizer.assertCanonicalItem(item)).toBe(true);
        });

        it('スキーマ違反オブジェクトに対して assertCanonicalItem が false を返すこと', () => {
            expect(ItemNormalizer.assertCanonicalItem(null)).toBe(false);
            expect(ItemNormalizer.assertCanonicalItem({})).toBe(false); // _canonical なし
            expect(ItemNormalizer.assertCanonicalItem({ _canonical: true, category: 'INVALID_CAT' })).toBe(false);
            expect(ItemNormalizer.assertCanonicalItem({
                _canonical: true,
                category: 'POTION',
                isUnidentified: true,
                isDiscovered: true // 矛盾
            })).toBe(false);
        });
    });

    describe('2. カテゴリの大文字正規化 (normalizeCategory)', () => {
        it('小文字やエイリアスを大文字 ItemCategory に統一すること', () => {
            expect(ItemNormalizer.normalizeCategory('potion')).toBe('POTION');
            expect(ItemNormalizer.normalizeCategory('potions')).toBe('POTION');
            expect(ItemNormalizer.normalizeCategory('weapons')).toBe('WEAPON');
            expect(ItemNormalizer.normalizeCategory('scrolls')).toBe('SCROLL');
            expect(ItemNormalizer.normalizeCategory('spbook')).toBe('SPELLBOOK');
            expect(ItemNormalizer.normalizeCategory('coin')).toBe('GOLD');
            expect(ItemNormalizer.normalizeCategory('gold_piece')).toBe('GOLD');
        });

        it('oclass 数値から正規化カテゴリを解決すること', () => {
            expect(ItemNormalizer.normalizeCategory(null, 1)).toBe('GOLD');
            expect(ItemNormalizer.normalizeCategory(null, 2)).toBe('WEAPON');
            expect(ItemNormalizer.normalizeCategory(null, 3)).toBe('ARMOR');
            expect(ItemNormalizer.normalizeCategory(null, 4)).toBe('RING');
            expect(ItemNormalizer.normalizeCategory(null, 5)).toBe('AMULET');
            expect(ItemNormalizer.normalizeCategory(null, 6)).toBe('TOOL');
            expect(ItemNormalizer.normalizeCategory(null, 7)).toBe('FOOD');
            expect(ItemNormalizer.normalizeCategory(null, 8)).toBe('POTION');
            expect(ItemNormalizer.normalizeCategory(null, 9)).toBe('SCROLL');
            expect(ItemNormalizer.normalizeCategory(null, 10)).toBe('SPELLBOOK');
            expect(ItemNormalizer.normalizeCategory(null, 11)).toBe('WAND');
            expect(ItemNormalizer.normalizeCategory(null, 13)).toBe('GEM');
        });

        it('シンボル文字から正規化カテゴリを解決すること', () => {
            expect(ItemNormalizer.normalizeCategory(null, '!')).toBe('POTION');
            expect(ItemNormalizer.normalizeCategory(null, '?')).toBe('SCROLL');
            expect(ItemNormalizer.normalizeCategory(null, ')')).toBe('WEAPON');
            expect(ItemNormalizer.normalizeCategory(null, '[')).toBe('ARMOR');
            expect(ItemNormalizer.normalizeCategory(null, '/')).toBe('WAND');
            expect(ItemNormalizer.normalizeCategory(null, '=')).toBe('RING');
            expect(ItemNormalizer.normalizeCategory(null, '"')).toBe('AMULET');
            expect(ItemNormalizer.normalizeCategory(null, '+')).toBe('SPELLBOOK');
            expect(ItemNormalizer.normalizeCategory(null, '$')).toBe('GOLD');
        });

        it('不明な値の場合は OTHER を返すこと', () => {
            expect(ItemNormalizer.normalizeCategory('unknown_xyz', 999)).toBe('OTHER');
        });
    });

    describe('3. インベントリレターの正規化 (normalizeLetter)', () => {
        it('letter, charStr 等の様々な階層から解決すること', () => {
            expect(ItemNormalizer.normalizeLetter({ letter: 'a' })).toBe('a');
            expect(ItemNormalizer.normalizeLetter({ charStr: 'd' })).toBe('d');
            expect(ItemNormalizer.normalizeLetter({ selector: 'e' })).toBe('e');
            expect(ItemNormalizer.normalizeLetter('f')).toBe('f');
            expect(ItemNormalizer.normalizeLetter({ letter: 97 })).toBe('a'); // ASCII コード
        });

        it('非所持（床・図鑑）の場合は null を返すこと', () => {
            expect(ItemNormalizer.normalizeLetter({})).toBeNull();
            expect(ItemNormalizer.normalizeLetter({ letter: '' })).toBeNull();
            expect(ItemNormalizer.normalizeLetter({ letter: 'invalid_long' })).toBeNull();
        });
    });

    describe('4. BUC ステータスの正規化 (normalizeBuc)', () => {
        it('文字列指定を大文字正規化すること', () => {
            expect(ItemNormalizer.normalizeBuc('blessed')).toBe('BLESSED');
            expect(ItemNormalizer.normalizeBuc('uncursed')).toBe('UNCURSED');
            expect(ItemNormalizer.normalizeBuc('cursed')).toBe('CURSED');
            expect(ItemNormalizer.normalizeBuc('unknown')).toBe('UNKNOWN');
        });

        it('Cコアの flags から判定すること', () => {
            expect(ItemNormalizer.normalizeBuc(null, { bknown: true, blessed: true })).toBe('BLESSED');
            expect(ItemNormalizer.normalizeBuc(null, { bknown: true, cursed: true })).toBe('CURSED');
            expect(ItemNormalizer.normalizeBuc(null, { bknown: true, blessed: false, cursed: false })).toBe('UNCURSED');
            expect(ItemNormalizer.normalizeBuc(null, { bknown: false })).toBe('UNKNOWN');
        });
    });

    describe('5. Producer別パターンの実戦正規化検証', () => {
        it('パターンA: InventoryStateManager (テキストパース方式) の生データを正規化できること', () => {
            const raw = {
                letter: 'a',
                category: 'POTION',
                rawText: 'a smoky potion',
                identification: {
                    isUnidentified: true,
                    displayName: '煙った薬',
                    calledName: null
                },
                spe: null
            };

            const canonical = ItemNormalizer.normalize(raw, { source: 'INVENTORY' });
            expect(canonical._canonical).toBe(true);
            expect(canonical.source).toBe('INVENTORY');
            expect(canonical.letter).toBe('a');
            expect(canonical.category).toBe('POTION');
            expect(canonical.isUnidentified).toBe(true);
            expect(canonical.isDiscovered).toBe(false);
            expect(canonical.idLevel).toBe('UNIDENTIFIED');
            expect(canonical.letter).toBe('a');
            expect(ItemNormalizer.assertCanonicalItem(canonical)).toBe(true);
        });

        it('パターンB: InventoryWasmAdapter (Direct Binding) の生データを正規化できること', () => {
            const raw = {
                onum: 280,
                oclass: 8,
                invlet: 'b',
                quan: 1,
                spe: 0,
                weight: 20,
                ptr: 123456,
                rawObjPtr: 123456,
                cobjPtr: 0,
                flags: {
                    dknown: false,
                    bknown: true,
                    blessed: false,
                    cursed: true
                },
                name: 'potion of healing',
                rawText: 'a cursed potion of healing'
            };

            const canonical = ItemNormalizer.normalize(raw, { source: 'INVENTORY' });
            expect(canonical.category).toBe('POTION');
            expect(canonical.letter).toBe('b');
            expect(canonical.rawObjPtr).toBe(123456);
            expect(canonical.bucStatus).toBe('CURSED');
            expect(canonical.isUnidentified).toBe(true); // dknown: false -> 未識別
            expect(canonical.isDiscovered).toBe(false);
            expect(canonical.idLevel).toBe('BUC_KNOWN'); // 未識別だがBUC判明
            expect(ItemNormalizer.assertCanonicalItem(canonical)).toBe(true);
        });

        it('パターンC: DiscoveryStateManager (図鑑エントリ) の生データを正規化できること', () => {
            const raw = {
                onum: 15,
                category: 'potion', // 小文字
                appearance: 'smoky potion',
                appearanceJa: '煙った薬',
                trueName: 'potion of extra healing',
                trueNameJa: '超回復の薬',
                isDiscovered: false,
                calledName: 'my heal'
            };

            const canonical = ItemNormalizer.normalize(raw, { source: 'CODEX' });
            expect(canonical.source).toBe('CODEX');
            expect(canonical.category).toBe('POTION'); // 大文字へ昇格
            expect(canonical.letter).toBeNull();
            expect(canonical.isUnidentified).toBe(true);
            expect(canonical.isDiscovered).toBe(false);
            expect(canonical.calledName).toBe('my heal');
            expect(canonical.idLevel).toBe('NAMED');
            expect(canonical.identification.calledName).toBe('my heal');
            expect(canonical.identification.isUnidentified).toBe(true);
            expect(ItemNormalizer.assertCanonicalItem(canonical)).toBe(true);
        });

        it('パターンD: 床落ちアイテム (AreaStateManager / Peek Wisdom) の生データを正規化できること', () => {
            const raw = {
                onum: 50,
                oclass: 2,
                rawText: 'an elven dagger',
                name: 'elven dagger',
                corpsenm: -1,
                cobjPtr: 98765,
                quan: 2,
                spe: 2,
                flags: { dknown: true, bknown: true, blessed: true }
            };

            const canonical = ItemNormalizer.normalize(raw, { source: 'FLOOR' });
            expect(canonical.source).toBe('FLOOR');
            expect(canonical.category).toBe('WEAPON');
            expect(canonical.letter).toBeNull();
            expect(canonical.quan).toBe(2);
            expect(canonical.spe).toBe(2);
            expect(canonical.bucStatus).toBe('BLESSED');
            expect(canonical.isUnidentified).toBe(false);
            expect(canonical.isDiscovered).toBe(true);
            expect(canonical.idLevel).toBe('FULLY_IDENTIFIED');
            expect(canonical.category).toBe('WEAPON');
            expect(ItemNormalizer.assertCanonicalItem(canonical)).toBe(true);
        });
    });

    describe('6. 仮名アトミック更新ヘルパー (withCalledName)', () => {
        it('calledName の更新がトップレベルと identification に同期反映されること', () => {
            const item = ItemNormalizer.normalize({
                letter: 'a',
                category: 'POTION',
                rawText: 'a smoky potion',
                isUnidentified: true,
                calledName: null
            });

            expect(item.calledName).toBeNull();
            expect(item.idLevel).toBe('UNIDENTIFIED');

            const namedItem = ItemNormalizer.withCalledName(item, 'super potion');
            expect(namedItem.calledName).toBe('super potion');
            expect(namedItem.identification.calledName).toBe('super potion');
            expect(namedItem.idLevel).toBe('NAMED');
            expect(namedItem.identification.idLevel).toBe('NAMED');
            expect(ItemNormalizer.assertCanonicalItem(namedItem)).toBe(true);

            // 仮名削除
            const uncalledItem = ItemNormalizer.withCalledName(namedItem, '');
            expect(uncalledItem.calledName).toBeNull();
            expect(uncalledItem.identification.calledName).toBeNull();
            expect(uncalledItem.idLevel).toBe('UNIDENTIFIED');
        });
    });

    describe('7. 装備スロットおよびスペック・エッジケース検証', () => {
        it('equipSlot に応じて isWielded, isWorn, isQuivered, isEquipped が正しく導出されること', () => {
            const weapon = ItemNormalizer.normalize({ category: 'WEAPON', equipSlot: 'weapon' });
            expect(weapon.isEquipped).toBe(true);
            expect(weapon.isWielded).toBe(true);
            expect(weapon.isWorn).toBe(false);

            const armor = ItemNormalizer.normalize({ category: 'ARMOR', equipSlot: 'suit' });
            expect(armor.isEquipped).toBe(true);
            expect(armor.isWielded).toBe(false);
            expect(armor.isWorn).toBe(true);

            const quiver = ItemNormalizer.normalize({ category: 'WEAPON', equipSlot: 'quiver' });
            expect(quiver.isEquipped).toBe(true);
            expect(quiver.isQuivered).toBe(true);
            expect(quiver.isWorn).toBe(false);

            const unequipped = ItemNormalizer.normalize({ category: 'WEAPON', equipSlot: null });
            expect(unequipped.isEquipped).toBe(false);
            expect(unequipped.isWielded).toBe(false);
            expect(unequipped.isWorn).toBe(false);
        });

        it('負の spe (呪い防具の-1等) やチャージ数が正しく反映されること', () => {
            const cursedArmor = ItemNormalizer.normalize({
                category: 'ARMOR',
                spe: -2,
                rawText: '-2 leather armor'
            });
            expect(cursedArmor.spe).toBe(-2);

            const wand = ItemNormalizer.normalize({
                category: 'WAND',
                identification: { charges: 5 },
                rawText: 'wand of striking (0:5)'
            });
            expect(wand.spe).toBe(5);
        });

        it('死体・像・缶詰 (corpsenm) が正しく保持されること', () => {
            const corpse = ItemNormalizer.normalize({
                category: 'FOOD',
                corpsenm: 105,
                rawText: 'kobold corpse'
            });
            expect(corpse.corpsenm).toBe(105);
        });

        it('正規化済みアイテムの source を指定して再正規化した際に source が上書きされること', () => {
            const invItem = ItemNormalizer.normalize({ letter: 'a', category: 'WEAPON' }, { source: 'INVENTORY' });
            expect(invItem.source).toBe('INVENTORY');

            const floorItem = ItemNormalizer.normalize(invItem, { source: 'FLOOR' });
            expect(floorItem.source).toBe('FLOOR');
            expect(floorItem._canonical).toBe(true);
        });
    });

    describe('8. 未識別アイテムの真名露出遮断・外見和名自動生成契約 (ネタバレ防止原則)', () => {
        it('未識別薬: flags.dknown: true であっても真名を遮断し、外見和名（ルビー色の薬）を出力すること', () => {
            const rawPotion = {
                letter: 'a',
                onum: 308, // potion of extra healing (強力回復のポーション)
                oclass: 8,
                rawText: 'a ruby potion',
                name: 'ruby potion',
                flags: { dknown: true, bknown: false } // 足元・手持ちで外見視認済み
            };

            const canonical = ItemNormalizer.normalize(rawPotion, { source: 'INVENTORY' });
            expect(canonical.isUnidentified).toBe(true);
            expect(canonical.isDiscovered).toBe(false);
            expect(canonical.nameJa).toBe('ルビー色の薬');
            expect(canonical.displayNameJa).toBe('ルビー色の薬');
            expect(canonical.nameJa).not.toContain('回復');
            expect(canonical.displayNameJa).not.toContain('回復');
            // 真名は trueName / trueNameJa にのみ格納される
            expect(canonical.trueNameJa).toBe('強力回復のポーション');
        });

        it('未識別巻物: ラベル付き巻物の外見和名を生成し、真名（鑑定の巻物等）を露出させないこと', () => {
            const rawScroll = {
                letter: 'b',
                onum: 337, // scroll of identify
                oclass: 9,
                rawText: 'a scroll labeled ZELGO MER',
                name: 'scroll labeled ZELGO MER',
                flags: { dknown: true }
            };

            const canonical = ItemNormalizer.normalize(rawScroll, { source: 'INVENTORY' });
            expect(canonical.isUnidentified).toBe(true);
            expect(canonical.nameJa).toBe('「ZELGO MER」と書かれた巻物');
            expect(canonical.displayNameJa).toBe('「ZELGO MER」と書かれた巻物');
            expect(canonical.nameJa).not.toContain('鑑定');
            expect(canonical.displayNameJa).not.toContain('鑑定');
        });

        it('未識別指輪: 素材外見和名（鉄の指輪）を生成し、真名を露出させないこと', () => {
            const rawRing = {
                letter: 'c',
                onum: 194, // ring of teleportation
                oclass: 4,
                rawText: 'an iron ring',
                name: 'iron ring',
                flags: { dknown: true }
            };

            const canonical = ItemNormalizer.normalize(rawRing, { source: 'INVENTORY' });
            expect(canonical.isUnidentified).toBe(true);
            expect(canonical.nameJa).toBe('鉄の指輪');
            expect(canonical.displayNameJa).toBe('鉄の指輪');
            expect(canonical.nameJa).not.toContain('瞬間移動');
            expect(canonical.displayNameJa).not.toContain('瞬間移動');
        });

        it('未識別杖: 素材外見和名（ガラスの杖）を生成し、真名を露出させないこと', () => {
            const rawWand = {
                letter: 'd',
                onum: 433, // wand of death
                oclass: 11,
                rawText: 'a glass wand',
                name: 'glass wand',
                flags: { dknown: true }
            };

            const canonical = ItemNormalizer.normalize(rawWand, { source: 'INVENTORY' });
            expect(canonical.isUnidentified).toBe(true);
            expect(canonical.nameJa).toBe('ガラスの杖');
            expect(canonical.displayNameJa).toBe('ガラスの杖');
            expect(canonical.nameJa).not.toContain('死');
            expect(canonical.displayNameJa).not.toContain('死');
        });

        it('仮名付き未識別アイテム: 外見和名に仮名サフィックスが付与されること', () => {
            const rawItem = {
                letter: 'e',
                onum: 308,
                oclass: 8,
                rawText: 'a ruby potion called super-heal',
                name: 'ruby potion',
                calledName: 'super-heal',
                flags: { dknown: true }
            };

            const canonical = ItemNormalizer.normalize(rawItem, { source: 'INVENTORY' });
            expect(canonical.isUnidentified).toBe(true);
            expect(canonical.calledName).toBe('super-heal');
            expect(canonical.idLevel).toBe('NAMED');
            expect(canonical.displayNameJa).toBe('ルビー色の薬 [仮名: super-heal]');
            expect(canonical.displayNameJa).not.toContain('超回復');
        });

        it('ツール分類フラグ保持: 鍵・ツルハシ・斧・氷の杖等のフラグが欠落せず正規化されること', () => {
            const keyItem = ItemNormalizer.normalize({
                letter: 'k',
                onum: 221, // skeleton key
                rawText: 'k - a skeleton key',
                isKey: true
            }, { source: 'INVENTORY' });
            expect(keyItem.isKey).toBe(true);
            expect(keyItem.isPickAxe).toBe(false);

            const pickAxe = ItemNormalizer.normalize({
                letter: 'p',
                onum: 259, // pick-axe
                rawText: 'p - a pick-axe',
                isPickAxe: true
            }, { source: 'INVENTORY' });
            expect(pickAxe.isPickAxe).toBe(true);
            expect(pickAxe.isDigTool).toBe(true);

            const axe = ItemNormalizer.normalize({
                letter: 'x',
                onum: 17, // axe
                rawText: 'x - an axe',
                isAxe: true
            }, { source: 'INVENTORY' });
            expect(axe.isAxe).toBe(true);

            const wand = ItemNormalizer.normalize({
                letter: 'w',
                onum: 418, // wand of cold
                rawText: 'w - a wand of cold',
                isFrostWand: true
            }, { source: 'INVENTORY' });
            expect(wand.isFrostWand).toBe(true);
        });
    });
});


