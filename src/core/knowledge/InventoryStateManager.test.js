import { describe, it, expect } from 'vitest';
import { InventoryStateManager } from './InventoryStateManager.js';

describe('InventoryStateManager', () => {
    it('インベントリテキスト行から所持品アイテムが更新・抽出できること', () => {
        const manager = new InventoryStateManager();
        const lines = [
            "Weapons",
            "a - a blessed +1 dagger (weapon in hand)",
            "Armor",
            "b - an uncursed +0 leather armor (being worn)"
        ];

        manager.updateFromLines(lines);
        const items = manager.items;

        expect(items).toBeDefined();
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(2);
        expect(items[0].isWielded).toBe(true);
        expect(items[1].isWorn).toBe(true);
    });

    it('二刀流・副武器・矢筒・装着指輪のパースおよび getEquipmentMap() が正常に機能すること', () => {
        const manager = new InventoryStateManager();
        const lines = [
            "a - a blessed +2 silver saber (weapon in right hand)",
            "b - a +1 long sword (weapon in left hand)",
            "c - 20 +0 arrows (in quiver)",
            "d - a ring of protection (on left hand)"
        ];

        manager.updateFromLines(lines);

        expect(manager.getWieldedWeapon().letter).toBe('a');
        expect(manager.getOffhandWeapon().letter).toBe('b');
        expect(manager.isTwoWeaponing()).toBe(true);
        expect(manager.getQuiveredItem().letter).toBe('c');

        const equipMap = manager.getEquipmentMap();
        expect(equipMap.isTwoWeapon).toBe(true);
        expect(equipMap.weapon.letter).toBe('a');
        expect(equipMap.offhand.letter).toBe('b');
        expect(equipMap.quiver.letter).toBe('c');
        expect(equipMap.wornList.length).toBe(1);
        expect(equipMap.wornList[0].letter).toBe('d');
    });

    it('アイテムのカテゴリ別デフォルト推奨アクション (defaultVerb, defaultSequence) が自動判定・付与されること', () => {
        const manager = new InventoryStateManager();
        const lines = [
            "a - a potion of healing",
            "b - a food ration",
            "c - a scroll of identify",
            "d - a wand of digging",
            "e - a towel",
            "f - a +0 leather armor",
            "g - a +0 leather armor (being worn)",
            "h - a +1 dagger (weapon in hand)"
        ];

        manager.updateFromLines(lines);

        // a: potion -> q (quaff)
        const potion = manager.getItemByLetter('a');
        expect(potion.defaultVerb).toBe('q');
        expect(potion.defaultSequence).toEqual(['q', 'a']);
        expect(potion.itemCategory).toBe('POTION');

        // b: food -> e (eat)
        const food = manager.getItemByLetter('b');
        expect(food.defaultVerb).toBe('e');
        expect(food.defaultSequence).toEqual(['e', 'b']);
        expect(food.itemCategory).toBe('FOOD');

        // c: scroll -> r (read)
        const scroll = manager.getItemByLetter('c');
        expect(scroll.defaultVerb).toBe('r');
        expect(scroll.defaultSequence).toEqual(['r', 'c']);
        expect(scroll.itemCategory).toBe('SCROLL');

        // d: wand -> z (zap)
        const wand = manager.getItemByLetter('d');
        expect(wand.defaultVerb).toBe('z');
        expect(wand.defaultSequence).toEqual(['z', 'd']);
        expect(wand.itemCategory).toBe('WAND');

        // e: towel (tool) -> a (apply)
        const towel = manager.getItemByLetter('e');
        expect(towel.defaultVerb).toBe('a');
        expect(towel.defaultSequence).toEqual(['a', 'e']);
        expect(towel.itemCategory).toBe('TOOL');

        // f: unworn armor -> W (wear)
        const unwornArmor = manager.getItemByLetter('f');
        expect(unwornArmor.defaultVerb).toBe('W');
        expect(unwornArmor.defaultSequence).toEqual(['W', 'f']);

        // g: worn armor -> T (take off)
        const wornArmor = manager.getItemByLetter('g');
        expect(wornArmor.defaultVerb).toBe('T');
        expect(wornArmor.defaultSequence).toEqual(['T', 'g']);

        // h: wielded weapon -> w (unwield w-)
        const wieldedWeapon = manager.getItemByLetter('h');
        expect(wieldedWeapon.defaultVerb).toBe('w');
        expect(wieldedWeapon.defaultSequence).toEqual(['w', '-']);
    });

    it('未識別アイテム（milky potion, runed wand）や多彩な食品（corpse, K-ration, pancake）の推奨判定が正常に行われること', () => {
        const manager = new InventoryStateManager();
        const lines = [
            "a - a milky potion",
            "b - a kobold corpse",
            "c - a K-ration",
            "d - a pancake",
            "e - a tin of spinach",
            "f - a runed wand",
            "g - a stamped scroll"
        ];

        manager.updateFromLines(lines);

        // a: milky potion -> q (quaff)
        expect(manager.getItemByLetter('a').defaultVerb).toBe('q');

        // b: kobold corpse -> e (eat)
        expect(manager.getItemByLetter('b').defaultVerb).toBe('e');

        // c: K-ration -> e (eat)
        expect(manager.getItemByLetter('c').defaultVerb).toBe('e');

        // d: pancake -> e (eat)
        expect(manager.getItemByLetter('d').defaultVerb).toBe('e');

        // e: tin of spinach -> e (eat)
        expect(manager.getItemByLetter('e').defaultVerb).toBe('e');

        // f: runed wand -> z (zap)
        expect(manager.getItemByLetter('f').defaultVerb).toBe('z');

        // g: stamped scroll -> r (read)
        expect(manager.getItemByLetter('g').defaultVerb).toBe('r');
    });

    it('判定不能・未知の変名アイテムは i コマンド前置の安全フォールバック ([\'i\', letter]) となること', () => {
        const manager = new InventoryStateManager();
        const lines = [
            "x - a weird artifact named mystery-object"
        ];

        manager.updateFromLines(lines);

        const unknownItem = manager.getItemByLetter('x');
        expect(unknownItem.itemCategory).toBe('OTHER');
        expect(unknownItem.defaultVerb).toBe('i');
        expect(unknownItem.defaultSequence).toEqual(['i', 'x']);
    });
});




