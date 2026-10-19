/**
 * testItemFactory.test.js
 * ナレッジ連動型テストファクトリ createTestItem の単体テスト
 */
import { describe, it, expect } from 'vitest';
import { createTestItem } from './testItemFactory.js';

describe('testItemFactory - createTestItem', () => {

    it('名前文字列から完全なアイテムナレッジ構造体を生成できること', () => {
        const item = createTestItem('long sword', 'a');

        expect(item.letter).toBe('a');
        expect(item.name).toBe('long sword');
        expect(item.category).toBe('WEAPON');
        expect(item.knowledge).toBeDefined();
        expect(item.rawText).toBe('a - an uncursed long sword');
    });

    it('onum 番号から直接アイテムナレッジ構造体を生成できること', () => {
        // onum 54 = long sword
        const item = createTestItem(54, 'b');

        expect(item.letter).toBe('b');
        expect(item.onum).toBe(54);
        expect(item.name).toBe('long sword');
        expect(item.category).toBe('WEAPON');
        expect(item.knowledge).toBeDefined();
    });

    it('overrides によるプロパティ上書きが正常に適用されること', () => {
        const item = createTestItem('potion of extra healing', 'c', {
            count: 3,
            isBLESSED: true,
            rawText: 'c - 3 blessed potions of extra healing'
        });

        expect(item.letter).toBe('c');
        expect(item.count).toBe(3);
        expect(item.isBLESSED).toBe(true);
        expect(item.rawText).toBe('c - 3 blessed potions of extra healing');
        expect(item.category).toBe('POTION');
    });

    it('corpse (死体) アイテムが自動的に FOOD カテゴリおよび corpse ナレッジに紐付くこと', () => {
        const item = createTestItem('lizard corpse', 'f');

        expect(item.letter).toBe('f');
        expect(item.name).toBe('lizard corpse');
        expect(item.category).toBe('FOOD');
        expect(item.knowledge).toBeDefined();
        expect(item.onum).toBe(269);
    });

    it('カテゴリ (category) がアイテム種別に応じて正確に設定されること', () => {
        const wand = createTestItem('wand of fire', 'w');
        expect(wand.category).toBe('WAND');

        const weapon = createTestItem('dagger', 'd');
        expect(weapon.category).toBe('WEAPON');

        const armor = createTestItem('helmet', 'h');
        expect(armor.category).toBe('ARMOR');
    });
});
