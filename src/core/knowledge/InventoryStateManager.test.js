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

    it('箱(box)は d(置く)、袋(sack)は a(中を見る)、宝石/石は t(投げる)、缶切りは缶詰がある場合スマートシーケンス(a+缶切り+缶詰)となること', () => {
        const manager = new InventoryStateManager();
        const lines = [
            "a - a heavy iron box",
            "b - an oilskin sack",
            "c - a can opener",
            "d - a tin of spinach",
            "e - a ruby",
            "f - a touchstone"
        ];

        manager.updateFromLines(lines);

        // a: box -> d (drop container)
        const box = manager.getItemByLetter('a');
        expect(box.defaultVerb).toBe('d');
        expect(box.defaultSequence).toEqual(['d', 'a']);
        expect(box.alternativeActions.some(alt => alt.verb === 'a')).toBe(true);

        // b: sack -> a (look inside)
        const sack = manager.getItemByLetter('b');
        expect(sack.defaultVerb).toBe('a');
        expect(sack.defaultSequence).toEqual(['a', 'b']);
        expect(sack.alternativeActions.some(alt => alt.verb === 'd')).toBe(true);

        // c: can opener + d: tin -> smart sequence ['a', 'c', 'd']
        const canOpener = manager.getItemByLetter('c');
        expect(canOpener.defaultVerb).toBe('a');
        expect(canOpener.defaultSequence).toEqual(['a', 'c', 'd']);
        expect(canOpener.defaultActionLabelJa).toContain('缶詰を開ける');

        // d: tin -> e (eat)
        const tin = manager.getItemByLetter('d');
        expect(tin.defaultVerb).toBe('e');
        expect(tin.defaultSequence).toEqual(['e', 'd']);

        // e: ruby -> t (throw)
        const ruby = manager.getItemByLetter('e');
        expect(ruby.defaultVerb).toBe('t');
        expect(ruby.defaultSequence).toEqual(['t', 'e']);
        expect(ruby.itemCategory).toBe('GEM');

        // f: touchstone -> a (apply)
        const touchstone = manager.getItemByLetter('f');
        expect(touchstone.defaultVerb).toBe('a');
        expect(touchstone.defaultSequence).toEqual(['a', 'f']);

        // getItemDefaultAction から alternativeActions が正しく取得できること
        const actionInfo = manager.getItemDefaultAction('a');
        expect(actionInfo).toBeDefined();
        expect(Array.isArray(actionInfo.alternativeActions)).toBe(true);
        expect(actionInfo.alternativeActions.length).toBeGreaterThan(0);
    });

    it('onum / glyphId から直接 isCanOpener, isTin, isBox, isBag, isTouchstone, isGem が確実判定されること', () => {
        const manager = new InventoryStateManager();
        const menuItems = [
            { letter: 'a', text: 'unidentified object A', glyph: 3687, onum: 239 }, // tin opener (onum 239)
            { letter: 'b', text: 'unidentified object B', glyph: 3744, onum: 296 }, // tin (onum 296)
            { letter: 'c', text: 'unidentified object C', glyph: 3663, onum: 215 }, // chest (onum 215)
            { letter: 'd', text: 'unidentified object D', glyph: 3665, onum: 217 }, // sack (onum 217)
            { letter: 'e', text: 'unidentified object E', glyph: 3920, onum: 472 }  // touchstone (onum 472)
        ];

        manager.updateFromMenuItems(menuItems);

        // a: can opener + b: tin -> smart sequence ['a', 'a', 'b']
        const canOpener = manager.getItemByLetter('a');
        expect(canOpener.isCanOpener).toBe(true);
        expect(canOpener.defaultSequence).toEqual(['a', 'a', 'b']);

        // b: tin -> eat (e)
        const tin = manager.getItemByLetter('b');
        expect(tin.isTin).toBe(true);
        expect(tin.defaultVerb).toBe('e');

        // c: chest -> drop (d)
        const chest = manager.getItemByLetter('c');
        expect(chest.isBox).toBe(true);
        expect(chest.defaultVerb).toBe('d');

        // d: sack -> look inside (a)
        const sack = manager.getItemByLetter('d');
        expect(sack.isBag).toBe(true);
        expect(sack.defaultVerb).toBe('a');

        // e: touchstone -> apply (a)
        const touchstone = manager.getItemByLetter('e');
        expect(touchstone.isTouchstone).toBe(true);
        expect(touchstone.defaultVerb).toBe('a');
    });

    it('updateFromSequenceBuffer: 手ぶら・所持品ゼロ (空バッファ/Not carrying anything) の場合でも isSynced = true と items = [] が正しく設定されること', () => {
        const manager = new InventoryStateManager();
        manager.invalidate();
        expect(manager.isSynced).toBe(false);

        // 空バッファまたは putstr のみのバッファを渡す
        manager.updateFromSequenceBuffer([{ type: 'putstr', text: 'Not carrying anything.' }]);
        expect(manager.isSynced).toBe(true);
        expect(manager.items).toEqual([]);
    });

    it('updateFromMessage: 日本語および英語の拾得 (pickup / 拾った / 手に入れた) メッセージを正しく検知して dirty 化すること', () => {
        const manager = new InventoryStateManager();
        manager.isSynced = true;

        // 英語 "You pick up: a dagger."
        let updated = manager.updateFromMessage("You pick up: a dagger.");
        expect(updated).toBe(true);
        expect(manager.isSynced).toBe(false);

        // 日本語 "短剣を拾った。"
        manager.isSynced = true;
        updated = manager.updateFromMessage("短剣を拾った。");
        expect(updated).toBe(true);
        expect(manager.isSynced).toBe(false);

        // 日本語 "鍵を手に入れた。"
        manager.isSynced = true;
        updated = manager.updateFromMessage("鍵を手に入れた。");
        expect(updated).toBe(true);
        expect(manager.isSynced).toBe(false);

        // アイテム名のみのメッセージ "f - a dagger." / "a - 短剣"
        manager.isSynced = true;
        updated = manager.updateFromMessage("f - a dagger.");
        expect(updated).toBe(true);
        expect(manager.isSynced).toBe(false);

        manager.isSynced = true;
        updated = manager.updateFromMessage("a - 短剣");
        expect(updated).toBe(true);
        expect(manager.isSynced).toBe(false);

        // 投げる・射出メッセージ "You throw a dagger." / "You fire a dagger." / "短剣を投げた。"
        manager.isSynced = true;
        updated = manager.updateFromMessage("You throw a dagger.");
        expect(updated).toBe(true);
        expect(manager.isSynced).toBe(false);

        manager.isSynced = true;
        updated = manager.updateFromMessage("短剣を投げた。");
        expect(updated).toBe(true);
        expect(manager.isSynced).toBe(false);
    });

    it('未識別アイテムがインベントリに追加された際、identification 構造化データが正しく付与されること', () => {
        const manager = new InventoryStateManager();
        const menuItems = [
            { letter: 'a', text: 'a ruby potion', glyph: 3748, onum: 300 },
            { letter: 'b', text: 'a blessed conical hat called brilliance?', glyph: 3569, onum: 121 },
            { letter: 'c', text: 'an uncursed +1 dagger', glyph: 3482, onum: 34 }
        ];

        manager.updateFromMenuItems(menuItems);

        const rubyPotion = manager.getItemByLetter('a');
        expect(rubyPotion.identification).toBeDefined();
        expect(rubyPotion.identification.isUnidentified).toBe(true);
        expect(rubyPotion.identification.idLevel).toBe('UNIDENTIFIED');
        expect(rubyPotion.identification.appearanceName).toBe('ruby potion');

        const conicalHat = manager.getItemByLetter('b');
        expect(conicalHat.identification).toBeDefined();
        expect(conicalHat.identification.isUnidentified).toBe(true);
        expect(conicalHat.identification.idLevel).toBe('NAMED');
        expect(conicalHat.identification.calledName).toBe('brilliance?');
        expect(conicalHat.identification.bucStatus).toBe('BLESSED');

        const dagger = manager.getItemByLetter('c');
        expect(dagger.identification).toBeDefined();
        expect(dagger.identification.isUnidentified).toBe(false);
        expect(dagger.identification.idLevel).toBe('FULLY_IDENTIFIED');
        expect(dagger.identification.enchantment).toBe(1);
    });

    it('jungle boots および 識別後の water walking boots が地形 WATER にならずアイテムナレッジとして正しく解決されること', async () => {
        const { StructuredKnowledgeEngine } = await import('./StructuredKnowledgeEngine.js');
        const engine = new StructuredKnowledgeEngine();
        const manager = new InventoryStateManager();
        manager.setStructuredKnowledgeEngine(engine);

        // 1. 未鑑定状態: a +0 pair of jungle boots
        manager.updateFromLines([
            "a - a +0 pair of jungle boots"
        ]);
        const jungleBoots = manager.getItemByLetter('a');
        expect(jungleBoots).toBeDefined();
        expect(jungleBoots.knowledge).toBeDefined();
        expect(jungleBoots.knowledge.category).not.toBe('WATER');
        expect(['ARMOR', 'BOOTS', 'TOOL'].includes(jungleBoots.knowledge.category)).toBe(true);

        // 2. 鑑定後状態: an uncursed +0 pair of water walking boots
        manager.updateFromLines([
            "a - an uncursed +0 pair of water walking boots"
        ]);
        const wwBoots = manager.getItemByLetter('a');
        expect(wwBoots).toBeDefined();
        expect(wwBoots.knowledge).toBeDefined();
        expect(wwBoots.knowledge.category).not.toBe('WATER');
        expect(wwBoots.knowledge.name.toLowerCase()).toContain('water walking boots');

        // 3. 識別メッセージ受信による未同期 (dirty) 化
        manager.isSynced = true;
        const updated = manager.updateFromMessage("This identifies the water walking boots.");
        expect(updated).toBe(true);
        expect(manager.isSynced).toBe(false);
    });

    it('updateFromMenuItems: シグネチャ差分検知により同一インベントリ時は false を返し再生成をスキップすること', () => {
        const manager = new InventoryStateManager();
        const menuItems = [
            { letter: 'a', text: 'a dagger', glyph: 3700, onum: 200 },
            { letter: 'b', text: 'a food ration', glyph: 3800, onum: 300 }
        ];

        // 初回更新 -> 変更あり (true)
        const changed1 = manager.updateFromMenuItems(menuItems);
        expect(changed1).toBe(true);
        expect(manager.items.length).toBe(2);
        expect(manager.isSynced).toBe(true);

        // 同一アイテムで2回目更新 -> 変更なし (false)
        const changed2 = manager.updateFromMenuItems(menuItems);
        expect(changed2).toBe(false);
        expect(manager.items.length).toBe(2);

        // アイテム変更 (装備状態変化) -> 変更あり (true)
        const updatedMenuItems = [
            { letter: 'a', text: 'a dagger (weapon in hand)', glyph: 3700, onum: 200 },
            { letter: 'b', text: 'a food ration', glyph: 3800, onum: 300 }
        ];
        const changed3 = manager.updateFromMenuItems(updatedMenuItems);
        expect(changed3).toBe(true);
        expect(manager.getItemByLetter('a').isWielded).toBe(true);
    });
});




