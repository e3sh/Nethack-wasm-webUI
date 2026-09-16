import { describe, it, expect } from 'vitest';
import { EquipmentDependencyAnalyzer } from './EquipmentDependencyAnalyzer.js';
import { resolveEligibleSlots, estimateActionTurns, EQUIP_SLOTS } from './EquipmentRules.js';

describe('EquipmentRules', () => {
    it('resolveEligibleSlots: 防具サブタイプから適合スロットを正しく解決できること', () => {
        expect(resolveEligibleSlots({ armorSlot: 'cloak', name: 'cloak of magic resistance' })).toEqual(['cloak']);
        expect(resolveEligibleSlots({ armorSlot: 'suit', name: 'plate mail' })).toEqual(['suit']);
        expect(resolveEligibleSlots({ armorSlot: 'shirt', name: 'Hawaiian shirt' })).toEqual(['shirt']);
        expect(resolveEligibleSlots({ armorSlot: 'helm', name: 'helmet' })).toEqual(['helm']);
        expect(resolveEligibleSlots({ armorSlot: 'gloves', name: 'leather gloves' })).toEqual(['gloves']);
        expect(resolveEligibleSlots({ armorSlot: 'shield', name: 'small shield' })).toEqual(['shield']);
        expect(resolveEligibleSlots({ armorSlot: 'boots', name: 'speed boots' })).toEqual(['boots']);
    });

    it('resolveEligibleSlots: 装身具・武器・矢筒の適合スロットを解決できること', () => {
        expect(resolveEligibleSlots({ category: 'RING', name: 'ring of regeneration' })).toEqual(['left_ring', 'right_ring']);
        expect(resolveEligibleSlots({ category: 'AMULET', name: 'amulet of ESP' })).toEqual(['amulet']);
        expect(resolveEligibleSlots({ isBlindfoldOrTowel: true, name: 'blindfold' })).toEqual(['blindfold']);
        expect(resolveEligibleSlots({ isAmmo: true, name: 'arrows' })).toEqual(['quiver', 'main_hand']);
        expect(resolveEligibleSlots({ category: 'WEAPON', name: 'long sword' })).toEqual(['main_hand']);
    });

    it('estimateActionTurns: 鎧の重さに応じた所要ターン数を正しく算出できること', () => {
        // 重装（Plate mail）: 5ターン
        expect(estimateActionTurns('take_off', { armorSlot: 'suit', name: 'plate mail', weight: 450 })).toBe(5);
        // 中装（Chain mail）: 3ターン
        expect(estimateActionTurns('take_off', { armorSlot: 'suit', name: 'chain mail', weight: 200 })).toBe(3);
        // 軽装（Leather armor）: 1ターン
        expect(estimateActionTurns('take_off', { armorSlot: 'suit', name: 'leather armor', weight: 100 })).toBe(1);
        // 外套: 1ターン
        expect(estimateActionTurns('take_off', { armorSlot: 'cloak', name: 'oilskin cloak' })).toBe(1);
    });
});

describe('EquipmentDependencyAnalyzer', () => {
    // 1. 基本 3 層アーマー換装テスト
    it('3層アーマー換装: [Cloak, Suit] 着用中に Shirt を着用する場合、外側から脱ぎ、逆順で着直すこと', () => {
        const inventory = [
            { letter: 'b', name: 'cloak of protection', armorSlot: 'cloak', isWorn: true, rawText: 'b - a cloak of protection (being worn)' },
            { letter: 'c', name: 'plate mail', armorSlot: 'suit', isWorn: true, weight: 450, rawText: 'c - a plate mail (being worn)' },
            { letter: 'd', name: 'Hawaiian shirt', armorSlot: 'shirt', isWorn: false, rawText: 'd - a Hawaiian shirt' }
        ];

        const targetItem = inventory[2]; // shirt
        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, targetItem);

        expect(report.canExecute).toBe(true);
        expect(report.targetItem.targetSlot).toBe('shirt');

        // ブロッカー: 外套 → 鎧 の順で脱ぐ
        expect(report.blockers.map(b => b.letter)).toEqual(['b', 'c']);
        expect(report.blockers[0].slot).toBe('cloak');
        expect(report.blockers[1].slot).toBe('suit');

        // 着直し: 鎧 → 外套 の順（LIFO）
        expect(report.itemsToRewear.map(r => r.letter)).toEqual(['c', 'b']);
        expect(report.itemsToRewear[0].slot).toBe('suit');
        expect(report.itemsToRewear[1].slot).toBe('cloak');

        // 所要ターン: 脱ぐ(1+5) + シャツ着る(1) + 着直す(5+1) = 13ターン
        expect(report.risks.totalEstimatedTurns).toBe(13);
        expect(report.risks.isMultiTurn).toBe(true);
    });

    // 2. 鎧の交換 (Swap) テスト
    it('鎧の交換 (Swap): [Cloak, Leather armor] 着用中に Plate mail を着る場合、旧鎧は着直さないこと', () => {
        const inventory = [
            { letter: 'b', name: 'elven cloak', armorSlot: 'cloak', isWorn: true, rawText: 'b - an elven cloak (being worn)' },
            { letter: 'c', name: 'leather armor', armorSlot: 'suit', isWorn: true, weight: 100, rawText: 'c - a leather armor (being worn)' },
            { letter: 'd', name: 'plate mail', armorSlot: 'suit', isWorn: false, weight: 450, rawText: 'd - a plate mail' }
        ];

        const targetItem = inventory[2]; // plate mail
        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, targetItem);

        expect(report.canExecute).toBe(true);
        expect(report.targetItem.targetSlot).toBe('suit');

        // ブロッカー: Cloak を脱ぐ → 旧鎧 c を脱ぐ
        expect(report.blockers.map(b => b.letter)).toEqual(['b', 'c']);

        // 着直し: Cloak のみ着直す（旧鎧 c は交換されたので着直さない）
        expect(report.itemsToRewear.map(r => r.letter)).toEqual(['b']);

        // 所要ターン: 脱ぐ(1+1) + プレートメイル着る(5) + クローク着直す(1) = 8ターン
        expect(report.risks.totalEstimatedTurns).toBe(8);
    });

    // 3. 外套のみ着用時の鎧着用テスト
    it('外套のみ着用時に鎧を着る場合、外套のみ脱いで着直すこと', () => {
        const inventory = [
            { letter: 'b', name: 'cloak of displacement', armorSlot: 'cloak', isWorn: true, rawText: 'b - a cloak of displacement (being worn)' },
            { letter: 'c', name: 'leather armor', armorSlot: 'suit', isWorn: false, weight: 100, rawText: 'c - a leather armor' }
        ];

        const targetItem = inventory[1];
        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, targetItem);

        expect(report.canExecute).toBe(true);
        expect(report.blockers.map(b => b.letter)).toEqual(['b']);
        expect(report.itemsToRewear.map(r => r.letter)).toEqual(['b']);
        // 脱ぐ(1) + 着る(1) + 着直す(1) = 3ターン
        expect(report.risks.totalEstimatedTurns).toBe(3);
    });

    // 4. 呪詛ブロッカー阻止テスト
    it('呪詛ブロッカー阻止: Cloak が呪われている場合、Shirt を着用できないこと', () => {
        const inventory = [
            { letter: 'b', name: 'cursed cloak of protection', armorSlot: 'cloak', isWorn: true, isCursed: true, rawText: 'b - a cursed cloak of protection (being worn)' },
            { letter: 'c', name: 'plate mail', armorSlot: 'suit', isWorn: true, rawText: 'c - a plate mail (being worn)' },
            { letter: 'd', name: 'Hawaiian shirt', armorSlot: 'shirt', isWorn: false, rawText: 'd - a Hawaiian shirt' }
        ];

        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, inventory[2]);

        expect(report.canExecute).toBe(false);
        expect(report.risks.hasCursedBlocker).toBe(true);
        expect(report.risks.blockingReason).toContain('呪われていて脱げないため');
    });

    // 5. 手袋と指輪の相互干渉テスト
    it('手袋と指輪の相互干渉: 手袋着用中に指輪を着ける場合、手袋を脱いで着直すこと', () => {
        const inventory = [
            { letter: 'f', name: 'leather gloves', armorSlot: 'gloves', isWorn: true, rawText: 'f - a pair of leather gloves (being worn)' },
            { letter: 'g', name: 'ring of protection', category: 'RING', isWorn: false, rawText: 'g - a ring of protection' }
        ];

        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, inventory[1]);

        expect(report.canExecute).toBe(true);
        expect(report.blockers.map(b => b.letter)).toEqual(['f']);
        expect(report.itemsToRewear.map(r => r.letter)).toEqual(['f']);
        expect(report.targetItem.targetSlot).toBe('left_ring'); // 空いている左手を優先
    });

    // 6. 呪われた手袋と指輪テスト
    it('呪われた手袋と指輪: 手袋が呪われている場合、指輪を装着できないこと', () => {
        const inventory = [
            { letter: 'f', name: 'cursed leather gloves', armorSlot: 'gloves', isWorn: true, isCursed: true, rawText: 'f - a pair of cursed leather gloves (being worn)' },
            { letter: 'g', name: 'ring of slow digestion', category: 'RING', isWorn: false, rawText: 'g - a ring of slow digestion' }
        ];

        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, inventory[1]);

        expect(report.canExecute).toBe(false);
        expect(report.risks.hasCursedBlocker).toBe(true);
        expect(report.risks.blockingReason).toContain('呪われていて脱げないため');
    });

    // 7. 両手武器と盾の排他テスト
    it('両手武器と盾: 両手武器装備中に盾を装備しようとすると、両手武器がブロッカーになること', () => {
        const inventory = [
            { letter: 'a', name: 'two-handed sword', isTwoHanded: true, isWielded: true, rawText: 'a - a two-handed sword (weapon in hands)' },
            { letter: 's', name: 'roundshield', armorSlot: 'shield', isWorn: false, rawText: 's - a roundshield' }
        ];

        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, inventory[1]);

        expect(report.canExecute).toBe(true);
        expect(report.targetItem.targetSlot).toBe('shield');
        expect(report.blockers.map(b => b.letter)).toEqual(['a']);
        expect(report.blockers[0].actionNeeded).toBe('unwield');
    });

    // 8. 盾装備中の両手武器テスト
    it('盾装備中に両手武器を装備しようとすると、盾がブロッカーになること', () => {
        const inventory = [
            { letter: 's', name: 'shield of reflection', armorSlot: 'shield', isWorn: true, rawText: 's - a shield of reflection (being worn)' },
            { letter: 'a', name: 'tsurugi', isTwoHanded: true, isWielded: false, rawText: 'a - a blessed tsurugi' }
        ];

        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, inventory[1]);

        expect(report.canExecute).toBe(true);
        expect(report.targetItem.targetSlot).toBe('main_hand');
        expect(report.blockers.map(b => b.letter)).toEqual(['s']);
        expect(report.blockers[0].actionNeeded).toBe('take_off');
    });

    // 9. コカトリス死体セーフティテスト（素手）
    it('コカトリス死体セーフティ: 手袋未着用（素手）でコカトリスの死体をwieldしようとした場合、石化即死警告でブロックされること', () => {
        const inventory = [
            { letter: 'c', name: 'cockatrice corpse', isCorpse: true, rawText: 'c - a cockatrice corpse' }
        ];

        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, inventory[0]);

        expect(report.canExecute).toBe(false);
        expect(report.risks.blockingReason).toContain('素手でコカトリスの死体に触れると石化即死します');
    });

    // 10. 手袋着用時のコカトリス死体テスト
    it('手袋着用時のコカトリス死体: 手袋着用中であればコカトリスの死体を安全にwieldできること', () => {
        const inventory = [
            { letter: 'g', name: 'leather gloves', armorSlot: 'gloves', isWorn: true, rawText: 'g - a pair of leather gloves (being worn)' },
            { letter: 'c', name: 'cockatrice corpse', isCorpse: true, rawText: 'c - a cockatrice corpse' }
        ];

        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, inventory[1]);

        expect(report.canExecute).toBe(true);
        expect(report.blockers.length).toBe(0);
    });

    // 11. BUC未確定警告および呪い警告
    it('対象アイテム自身の呪い・BUC未確定警告が正確に発行されること', () => {
        const cursedItem = { letter: 'r', name: 'cursed ring of teleportation', category: 'RING', isCursed: true, rawText: 'r - a cursed ring of teleportation' };
        const reportCursed = EquipmentDependencyAnalyzer.analyzeDependency([], cursedItem);
        expect(reportCursed.risks.targetBucStatus).toBe('cursed');
        expect(reportCursed.risks.warnings.some(w => w.includes('呪われています'))).toBe(true);

        const unknownItem = { letter: 'k', name: 'helmet', armorSlot: 'helm', rawText: 'k - a helmet' };
        const reportUnknown = EquipmentDependencyAnalyzer.analyzeDependency([], unknownItem);
        expect(reportUnknown.risks.targetBucStatus).toBe('unknown');
        expect(reportUnknown.risks.warnings.some(w => w.includes('BUC未確定'))).toBe(true);
    });
});
