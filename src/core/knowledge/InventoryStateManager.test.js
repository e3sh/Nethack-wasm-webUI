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

    it('onum が null の場合でも glyphId から onum が自動算出され推奨コマンドが正確に判定されること', () => {
        const manager = new InventoryStateManager();
        const menuItems = [
            { letter: 'a', text: 'a mysterious liquid', glyph: 3748, onum: null }, // glyph 3748 -> onum 300 (POTION)
            { letter: 'b', text: 'a strange paper', glyph: 3778, onum: null },  // glyph 3778 -> onum 330 (SCROLL)
            { letter: 'c', text: 'a wooden stick', glyph: 3876, onum: null },   // glyph 3876 -> onum 428 (WAND of digging)

            { letter: 'd', text: 'a shiny band', glyph: 3628, onum: null },     // glyph 3628 -> onum 180 (RING)
            { letter: 'e', text: 'a heavy chestplate', glyph: 3569, onum: null }, // glyph 3569 -> onum 121 (ARMOR)
            { letter: 'f', text: 'a sharp blade', glyph: 3488, onum: null }      // glyph 3488 -> onum 40 (WEAPON)
        ];

        manager.updateFromMenuItems(menuItems);

        // a: Potion (onum 300) -> q (quaff)
        const potion = manager.getItemByLetter('a');
        expect(potion.onum).toBe(300);
        expect(potion.itemCategory).toBe('POTION');
        expect(potion.defaultVerb).toBe('q');

        // b: Scroll (onum 330) -> r (read)
        const scroll = manager.getItemByLetter('b');
        expect(scroll.onum).toBe(330);
        expect(scroll.itemCategory).toBe('SCROLL');
        expect(scroll.defaultVerb).toBe('r');

        // c: Wand of Digging (onum 428) -> z (zap) & isDigWand
        const wand = manager.getItemByLetter('c');
        expect(wand.onum).toBe(428);
        expect(wand.itemCategory).toBe('WAND');
        expect(wand.isDigWand).toBe(true);
        expect(wand.defaultVerb).toBe('z');


        // d: Ring (onum 180) -> P (put on)
        const ring = manager.getItemByLetter('d');
        expect(ring.onum).toBe(180);
        expect(ring.itemCategory).toBe('RING');
        expect(ring.defaultVerb).toBe('P');

        // e: Armor (onum 121) -> W (wear)
        const armor = manager.getItemByLetter('e');
        expect(armor.onum).toBe(121);
        expect(armor.itemCategory).toBe('ARMOR');
        expect(armor.defaultVerb).toBe('W');

        // f: Weapon (onum 40) -> w (wield)
        const weapon = manager.getItemByLetter('f');
        expect(weapon.onum).toBe(40);
        expect(weapon.itemCategory).toBe('WEAPON');
        expect(weapon.defaultVerb).toBe('w');
    });

    it('矢(arrow)・火打ち石(flint)・岩(rock)等の弾薬系は Q (Quiver/装填) が推奨され、スリング本体(sling)は w (Wield) となること', () => {
        const manager = new InventoryStateManager();
        const menuItems = [
            { letter: 'a', text: '15 arrows', glyph: 3466, onum: 18 },      // arrow -> Q (Quiver)
            { letter: 'b', text: '3 flints', glyph: 3921, onum: 473 },      // flint -> Q (Quiver)
            { letter: 'c', text: '5 rocks', glyph: 3922, onum: 474 },       // rock -> Q (Quiver)
            { letter: 'd', text: 'a +0 sling', glyph: 3535, onum: 87 },     // sling -> w (Wield)
            { letter: 'e', text: '10 arrows (in quiver)', glyph: 3466, onum: 18 } // quivered -> Q-
        ];

        manager.updateFromMenuItems(menuItems);

        // a: arrow -> Q
        const arrow = manager.getItemByLetter('a');
        expect(arrow.isAmmo).toBe(true);
        expect(arrow.defaultVerb).toBe('Q');
        expect(arrow.defaultSequence).toEqual(['Q', 'a']);

        // b: flint -> Q
        const flint = manager.getItemByLetter('b');
        expect(flint.isAmmo).toBe(true);
        expect(flint.defaultVerb).toBe('Q');
        expect(flint.defaultSequence).toEqual(['Q', 'b']);

        // c: rock -> Q
        const rock = manager.getItemByLetter('c');
        expect(rock.isAmmo).toBe(true);
        expect(rock.defaultVerb).toBe('Q');
        expect(rock.defaultSequence).toEqual(['Q', 'c']);

        // d: sling -> w
        const sling = manager.getItemByLetter('d');
        expect(sling.isLauncher).toBe(true);
        expect(sling.defaultVerb).toBe('w');
        expect(sling.defaultSequence).toEqual(['w', 'd']);

        // e: quivered arrow -> Q- (Unquiver)
        const quiveredArrow = manager.getItemByLetter('e');
        expect(quiveredArrow.isQuivered).toBe(true);
        expect(quiveredArrow.defaultVerb).toBe('Q');
        expect(quiveredArrow.defaultSequence).toEqual(['Q', '-']);
    });

    it('自発同期(syncInventorySilent)による全件インベントリ更新が正しく機能すること', () => {
        const manager = new InventoryStateManager();

        // 自発同期で全件登録
        manager.updateFromMenuItems([
            { letter: 'a', text: 'a +0 dagger', glyph: 3482, onum: 34 },
            { letter: 'b', text: 'a +0 leather armor', glyph: 3569, onum: 121 },
            { letter: 'c', text: 'a potion of healing', glyph: 3748, onum: 300 }
        ]);

        expect(manager.items.length).toBe(3);
        expect(manager.isSynced).toBe(true);

        // 新しい自発同期データで全件が正しく置き換わること
        manager.updateFromMenuItems([
            { letter: 'x', text: 'a wand of wishing', glyph: 3864, onum: 416 }
        ]);

        expect(manager.items.length).toBe(1);
        expect(manager.getItemByLetter('x')).not.toBeNull();
        expect(manager.getItemByLetter('a')).toBeNull();
    });
});




