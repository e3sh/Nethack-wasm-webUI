import { describe, it, expect } from 'vitest';
import { EquipmentActionPlanner } from './EquipmentActionPlanner.js';
import { EquipmentDependencyAnalyzer } from './EquipmentDependencyAnalyzer.js';
import { EQUIP_SLOTS } from './EquipmentRules.js';

describe('EquipmentActionPlanner', () => {

    // 1. 3層アーマー換装 (Cloak, Suit 着用中に Shirt を着用)
    it('3層アーマー換装: 外套と鎧を脱いでシャツ着用後、鎧と外套を着直す5ステップのシーケンスを生成する', () => {
        const inventory = [
            { letter: 'b', name: 'leather cloak', equipSlot: 'cloak', isWorn: true, rawText: 'b - a leather cloak (being worn)' },
            { letter: 'c', name: 'plate mail', equipSlot: 'suit', isWorn: true, rawText: 'c - a plate mail (being worn)' },
            { letter: 'h', name: 'iron helm', equipSlot: 'helm', isWorn: true, rawText: 'h - an iron helm (being worn)' },
            { letter: 'e', name: 'Hawaiian shirt', category: 'ARMOR', rawText: 'e - a Hawaiian shirt' }
        ];

        const targetItem = inventory[3];
        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, targetItem);
        const recipe = EquipmentActionPlanner.plan(report, { inventory });

        expect(recipe.canExecute).toBe(true);
        expect(recipe.steps).toHaveLength(5);

        // 1: Cloak脱ぐ (防具は helm, cloak(外層) で Narmorpieces=2 -> ['T', 'b'])
        expect(recipe.steps[0]).toMatchObject({
            type: 'take_off',
            slot: EQUIP_SLOTS.CLOAK,
            letter: 'b',
            sequence: ['T', 'b']
        });

        // 2: Suit脱ぐ (防具は helm, suit(外層) で Narmorpieces=2 -> ['T', 'c'])
        expect(recipe.steps[1]).toMatchObject({
            type: 'take_off',
            slot: EQUIP_SLOTS.SUIT,
            letter: 'c',
            sequence: ['T', 'c']
        });

        // 3: Shirt着る (['W', 'e'])
        expect(recipe.steps[2]).toMatchObject({
            type: 'wear',
            slot: EQUIP_SLOTS.SHIRT,
            letter: 'e',
            sequence: ['W', 'e']
        });

        // 4: Suit着直す (['W', 'c'])
        expect(recipe.steps[3]).toMatchObject({
            type: 'wear',
            slot: EQUIP_SLOTS.SUIT,
            letter: 'c',
            sequence: ['W', 'c']
        });

        // 5: Cloak着直す (['W', 'b'])
        expect(recipe.steps[4]).toMatchObject({
            type: 'wear',
            slot: EQUIP_SLOTS.CLOAK,
            letter: 'b',
            sequence: ['W', 'b']
        });

        // フラットシーケンスの確認
        expect(recipe.sequence).toEqual(['T', 'b', 'T', 'c', 'W', 'e', 'W', 'c', 'W', 'b']);
        expect(recipe.isMultiTurn).toBe(true);
        expect(recipe.totalEstimatedTurns).toBeGreaterThan(1);
    });

    // 2. 防具が1点のみの場合の脱衣最適化 (NetHack C-Core: Narmorpieces == 1 -> ['T'] のみ)
    it('防具が1点のみの場合: 文字プロンプトが出ないため [\"T\"] のみの脱衣キーを生成する', () => {
        const inventory = [
            { letter: 'b', name: 'leather cloak', equipSlot: 'cloak', isWorn: true, rawText: 'b - a leather cloak (being worn)' },
            { letter: 'e', name: 'Hawaiian shirt', category: 'ARMOR', rawText: 'e - a Hawaiian shirt' }
        ];

        const targetItem = inventory[1];
        const recipe = EquipmentActionPlanner.planForTarget(inventory, targetItem);

        expect(recipe.canExecute).toBe(true);
        expect(recipe.steps).toHaveLength(3);

        // Cloak 脱衣時は防具が cloak 1点のみなので ['T']
        expect(recipe.steps[0]).toMatchObject({
            type: 'take_off',
            slot: EQUIP_SLOTS.CLOAK,
            letter: 'b',
            sequence: ['T']
        });

        // Shirt 着用
        expect(recipe.steps[1]).toMatchObject({
            type: 'wear',
            slot: EQUIP_SLOTS.SHIRT,
            letter: 'e',
            sequence: ['W', 'e']
        });

        // Cloak 着直し
        expect(recipe.steps[2]).toMatchObject({
            type: 'wear',
            slot: EQUIP_SLOTS.CLOAK,
            letter: 'b',
            sequence: ['W', 'b']
        });

        expect(recipe.sequence).toEqual(['T', 'W', 'e', 'W', 'b']);
    });

    // 3. 手袋着用中の指輪装着 (手袋脱ぐ -> 指輪はめる -> 手袋着直す)
    it('手袋着用中の指輪装着: 手袋を脱ぎ、指輪を嵌め、手袋を着直すシーケンスを生成する', () => {
        const inventory = [
            { letter: 'g', name: 'leather gloves', equipSlot: 'gloves', isWorn: true, rawText: 'g - leather gloves (being worn)' },
            { letter: 'r', name: 'ring of protection', category: 'RING', rawText: 'r - a ring of protection' }
        ];

        const targetItem = inventory[1];
        const recipe = EquipmentActionPlanner.planForTarget(inventory, targetItem, EQUIP_SLOTS.LEFT_RING);

        expect(recipe.canExecute).toBe(true);
        expect(recipe.steps).toHaveLength(3);

        // 手袋脱ぐ (防具1点 -> ['T'])
        expect(recipe.steps[0]).toMatchObject({
            type: 'take_off',
            slot: EQUIP_SLOTS.GLOVES,
            letter: 'g',
            sequence: ['T']
        });

        // 左手指輪はめる (指輪0個装着 -> ['P', 'r', 'l'])
        expect(recipe.steps[1]).toMatchObject({
            type: 'put_on',
            slot: EQUIP_SLOTS.LEFT_RING,
            letter: 'r',
            sequence: ['P', 'r', 'l']
        });

        // 手袋着直す (['W', 'g'])
        expect(recipe.steps[2]).toMatchObject({
            type: 'wear',
            slot: EQUIP_SLOTS.GLOVES,
            letter: 'g',
            sequence: ['W', 'g']
        });

        expect(recipe.sequence).toEqual(['T', 'P', 'r', 'l', 'W', 'g']);
    });

    // 4. 既存指輪の交換 (Swap: 1個装着中 -> 外して新規装着)
    it('既存指輪の交換: 装着中の指輪を外し、新しい指輪を嵌める', () => {
        const inventory = [
            { letter: 'r', name: 'ring of adornment', equipSlot: 'ring_left', isWorn: true, rawText: 'r - a ring of adornment (on left hand)' },
            { letter: 's', name: 'ring of conflict', category: 'RING', rawText: 's - a ring of conflict' }
        ];

        const targetItem = inventory[1];
        const recipe = EquipmentActionPlanner.planForTarget(inventory, targetItem, EQUIP_SLOTS.LEFT_RING);

        expect(recipe.canExecute).toBe(true);
        expect(recipe.steps).toHaveLength(2);

        // 指輪外し (指輪1個装着中 -> ['R'] のみ)
        expect(recipe.steps[0]).toMatchObject({
            type: 'remove',
            slot: EQUIP_SLOTS.LEFT_RING,
            letter: 'r',
            sequence: ['R']
        });

        // 新しい指輪装着 (0個になったので 'l' を指定 -> ['P', 's', 'l'])
        expect(recipe.steps[1]).toMatchObject({
            type: 'put_on',
            slot: EQUIP_SLOTS.LEFT_RING,
            letter: 's',
            sequence: ['P', 's', 'l']
        });

        expect(recipe.sequence).toEqual(['R', 'P', 's', 'l']);
    });

    // 5. 2個の指輪装着中での特定指輪交換
    it('指輪が2個装着されている場合の交換: 外す文字を指定し、自動装着されるため嵌める指は省略する', () => {
        const inventory = [
            { letter: 'l', name: 'ring of adornment', equipSlot: 'ring_left', isWorn: true, rawText: 'l - a ring of adornment (on left hand)' },
            { letter: 'm', name: 'ring of protection', equipSlot: 'ring_right', isWorn: true, rawText: 'm - a ring of protection (on right hand)' },
            { letter: 'n', name: 'ring of conflict', category: 'RING', rawText: 'n - a ring of conflict' }
        ];

        const targetItem = inventory[2];
        const recipe = EquipmentActionPlanner.planForTarget(inventory, targetItem, EQUIP_SLOTS.LEFT_RING);

        expect(recipe.canExecute).toBe(true);
        expect(recipe.steps).toHaveLength(2);

        // 左手指輪外し (指輪2個装着中 -> ['R', 'l'])
        expect(recipe.steps[0]).toMatchObject({
            type: 'remove',
            slot: EQUIP_SLOTS.LEFT_RING,
            letter: 'l',
            sequence: ['R', 'l']
        });

        // 新しい指輪装着 (右手に1個残っているので空いている左手に自動装着 -> ['P', 'n'])
        expect(recipe.steps[1]).toMatchObject({
            type: 'put_on',
            slot: EQUIP_SLOTS.LEFT_RING,
            letter: 'n',
            sequence: ['P', 'n']
        });

        expect(recipe.sequence).toEqual(['R', 'l', 'P', 'n']);
    });

    // 6. 両手武器所持時に盾を装備 (両手武器外す -> 盾を装備)
    it('両手武器所持時に盾を装備: 両手武器を外してから盾を装備する', () => {
        const inventory = [
            { letter: 'w', name: 'two-handed sword', isWielded: true, isTwoHanded: true, rawText: 'w - a two-handed sword (weapon in hands)' },
            { letter: 's', name: 'small shield', category: 'ARMOR', armorSlot: 'shield', rawText: 's - a small shield' }
        ];

        const targetItem = inventory[1];
        const recipe = EquipmentActionPlanner.planForTarget(inventory, targetItem);

        expect(recipe.canExecute).toBe(true);
        expect(recipe.steps).toHaveLength(2);

        // 両手武器外す (['w', '-'])
        expect(recipe.steps[0]).toMatchObject({
            type: 'unwield',
            slot: EQUIP_SLOTS.MAIN_HAND,
            letter: 'w',
            sequence: ['w', '-']
        });

        // 盾装備 (['W', 's'])
        expect(recipe.steps[1]).toMatchObject({
            type: 'wear',
            slot: EQUIP_SLOTS.SHIELD,
            letter: 's',
            sequence: ['W', 's']
        });

        expect(recipe.sequence).toEqual(['w', '-', 'W', 's']);
    });

    // 7. 盾装備時に両手武器を装備 (盾脱ぐ -> 両手武器持つ)
    it('盾装備時に両手武器を装備: 盾を脱いでから両手武器を持つ', () => {
        const inventory = [
            { letter: 's', name: 'small shield', equipSlot: 'shield', isWorn: true, rawText: 's - a small shield (being worn)' },
            { letter: 'w', name: 'two-handed sword', isTwoHanded: true, rawText: 'w - a two-handed sword' }
        ];

        const targetItem = inventory[1];
        const recipe = EquipmentActionPlanner.planForTarget(inventory, targetItem);

        expect(recipe.canExecute).toBe(true);
        expect(recipe.steps).toHaveLength(2);

        // 盾脱ぐ (防具1点 -> ['T'])
        expect(recipe.steps[0]).toMatchObject({
            type: 'take_off',
            slot: EQUIP_SLOTS.SHIELD,
            letter: 's',
            sequence: ['T']
        });

        // 両手武器持つ (['w', 'w'])
        expect(recipe.steps[1]).toMatchObject({
            type: 'wield',
            slot: EQUIP_SLOTS.MAIN_HAND,
            letter: 'w',
            sequence: ['w', 'w']
        });

        expect(recipe.sequence).toEqual(['T', 'w', 'w']);
    });

    // 8. 呪詛ブロッカーによる阻止
    it('呪詛ブロッカー阻止: 外套が呪われている場合は canExecute=false となり空シーケンスを返す', () => {
        const inventory = [
            { letter: 'b', name: 'cursed cloak of protection', equipSlot: 'cloak', isWorn: true, isCursed: true, rawText: 'b - a cursed cloak of protection (being worn)' },
            { letter: 'e', name: 'Hawaiian shirt', category: 'ARMOR', rawText: 'e - a Hawaiian shirt' }
        ];

        const targetItem = inventory[1];
        const recipe = EquipmentActionPlanner.planForTarget(inventory, targetItem);

        expect(recipe.canExecute).toBe(false);
        expect(recipe.blockingReason).toContain('呪われていて脱げないため');
        expect(recipe.steps).toHaveLength(0);
        expect(recipe.sequence).toHaveLength(0);
    });

    // 9. コカトリス死体セーフティ (手袋未着用)
    it('コカトリス死体セーフティ: 手袋未着用でコカトリス死体を手に持とうとした場合は石化警告で阻止する', () => {
        const inventory = [
            { letter: 'c', name: 'cockatrice corpse', rawText: 'c - a cockatrice corpse' }
        ];

        const targetItem = inventory[0];
        const recipe = EquipmentActionPlanner.planForTarget(inventory, targetItem);

        expect(recipe.canExecute).toBe(false);
        expect(recipe.blockingReason).toContain('石化即死');
        expect(recipe.steps).toHaveLength(0);
        expect(recipe.sequence).toHaveLength(0);
    });

    // 10. 依存関係なしの単純装備
    it('依存関係なし: 何も着ていない状態で外套を着る場合、1ステップのみ生成する', () => {
        const inventory = [
            { letter: 'b', name: 'leather cloak', category: 'ARMOR', rawText: 'b - a leather cloak' }
        ];

        const targetItem = inventory[0];
        const recipe = EquipmentActionPlanner.planForTarget(inventory, targetItem);

        expect(recipe.canExecute).toBe(true);
        expect(recipe.steps).toHaveLength(1);
        expect(recipe.steps[0]).toMatchObject({
            type: 'wear',
            slot: EQUIP_SLOTS.CLOAK,
            letter: 'b',
            sequence: ['W', 'b']
        });
        expect(recipe.sequence).toEqual(['W', 'b']);
        expect(recipe.isMultiTurn).toBe(false);
    });
});
