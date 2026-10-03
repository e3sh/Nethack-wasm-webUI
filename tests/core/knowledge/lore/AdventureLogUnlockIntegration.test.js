/**
 * AdventureLogUnlockIntegration.test.js
 *
 * 冒険手帳 (Adventure Log) ゲーム内リアルタイムアンロック統合テスト
 * - モンスターLOS視界内出現 (print_glyph)
 * - アイテム完全識別 (DiscoveryStateManager)
 * - 噂・伝承メッセージ検知 (LoreDetector)
 * - 初回アンロック時のみの adventureLogUnlocked イベント発行検証
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GKLPlugin } from '../../../../src/core/knowledge/GKLPlugin.js';
import { AdventureLogManager } from '../../../../src/core/knowledge/lore/AdventureLogManager.js';
import { LORE_MASTER } from '../../../../src/core/knowledge/lore/data/LoreMasterData.js';
import { EventEmitter } from 'events';

describe('AdventureLog - ゲーム内リアルタイムアンロック統合テスト', () => {
    let mockCore;
    let logManager;
    let gkl;
    let unlockedEvents;

    beforeEach(() => {
        mockCore = new EventEmitter();
        mockCore.emitFxTrigger = vi.fn();

        // 独立したテスト用 AdventureLogManager インスタンス (メモリ内ストレージ)
        logManager = new AdventureLogManager();
        logManager.reset(); // 全初期化

        gkl = new GKLPlugin({
            adventureLogManager: logManager
        });
        gkl.attach(mockCore);

        unlockedEvents = [];
        mockCore.on('adventureLogUnlocked', (data) => {
            unlockedEvents.push(data);
        });
    });

    it('1. モンスターLOS出現: print_glyph 受信時に新種モンスターが冒険手帳にアンロックされること', () => {
        expect(logManager.isMonsterUnlocked(0)).toBe(false); // 0: giant ant

        // 視界内に giant ant (glyph: 0) が描画される
        mockCore.emit('print_glyph', {
            x: 10,
            y: 10,
            glyph: 0,
            glyphInfo: { name: 'giant ant' }
        });

        // 手帳にアンロックされたこと
        expect(logManager.isMonsterUnlocked(0)).toBe(true);
        expect(unlockedEvents.length).toBe(1);
        expect(unlockedEvents[0].category).toBe('monster');
        expect(unlockedEvents[0].monOffset).toBe(0);
        expect(unlockedEvents[0].name).toBe('giant ant');

        // 同じモンスターを再度視界に捉えても、重複アンロック・イベント発行されないこと
        mockCore.emit('print_glyph', {
            x: 11,
            y: 10,
            glyph: 0,
            glyphInfo: { name: 'giant ant' }
        });
        expect(unlockedEvents.length).toBe(1);
    });

    it('2. アイテム完全識別: registerKnownItem で初識別アイテムが冒険手帳にアンロックされること', () => {
        expect(logManager.isObjectUnlocked(23)).toBe(false);

        // DiscoveryStateManager を通じてアイテムが真名識別される
        gkl.getDiscoveryStateManager().registerKnownItem(23, 'potion of healing', 'ruby potion');

        // 手帳にアンロックされたこと
        expect(logManager.isObjectUnlocked(23)).toBe(true);
        expect(unlockedEvents.length).toBe(1);
        expect(unlockedEvents[0].category).toBe('object');
        expect(unlockedEvents[0].onum).toBe(23);
        expect(unlockedEvents[0].name).toBe('potion of healing');

        // 再度同じアイテムが鑑定されても、重複アンロック・イベント発行されないこと
        gkl.getDiscoveryStateManager().registerKnownItem(23, 'potion of healing', 'ruby potion');
        expect(unlockedEvents.length).toBe(1);
    });

    it('3. 噂・伝承メッセージ検知: LoreDetector 経由で噂を受信した瞬間に冒険手帳にアンロックされること', () => {
        // 未解禁のマスター噂を取得
        const sampleRumor = LORE_MASTER.rumors[0];
        expect(sampleRumor).toBeDefined();
        expect(logManager.isRumorUnlocked(sampleRumor.id)).toBe(false);

        // クッキー開封から噂本文のメッセージストリーム
        mockCore.emit('messageText', { text: 'This cookie has a scrap of paper inside.' });
        mockCore.emit('messageText', { text: 'It reads:' });
        mockCore.emit('messageText', { text: sampleRumor.text });

        // 手帳にアンロックされたこと
        expect(logManager.isRumorUnlocked(sampleRumor.id)).toBe(true);
        expect(unlockedEvents.length).toBe(1);
        expect(unlockedEvents[0].category).toBe('rumor');
        expect(unlockedEvents[0].id).toBe(sampleRumor.id);

        // 再度同じ噂を聞いても重複発行されないこと
        mockCore.emit('messageText', { text: sampleRumor.text });
        expect(unlockedEvents.length).toBe(1);
    });

    it('4. 警告シンボルや不可視モンスターはアンロック対象から安全に除外されること', () => {
        // GLYPH_WARNING_OFF (7220)
        mockCore.emit('print_glyph', {
            x: 5,
            y: 5,
            glyph: 7220
        });

        // GLYPH_INVIS_OFF (1532)
        mockCore.emit('print_glyph', {
            x: 6,
            y: 5,
            glyph: 1532
        });

        expect(unlockedEvents.length).toBe(0);
    });

    it('5. 初期インベントリ連携: 初回同期時は識別済みアイテムを手帳にサイレント解禁し、通知イベントを発行しないこと', () => {
        // onum 28: long sword (武器), onum 386: food ration (食料)
        expect(logManager.isObjectUnlocked(28)).toBe(false);
        expect(logManager.isObjectUnlocked(386)).toBe(false);

        const initialInventory = [
            { letter: 'a', rawStr: 'a +0 long sword', onum: 28 },
            { letter: 'b', rawStr: 'an uncursed food ration', onum: 386 }
        ];

        // 初回インベントリ同期
        gkl.getInventoryStateManager().updateFromMenuItems(initialInventory);

        // 冒険手帳には確実にアンロックされていること
        expect(logManager.isObjectUnlocked(28)).toBe(true);
        expect(logManager.isObjectUnlocked(386)).toBe(true);

        // ゲーム開始時の初期装備なので、トースト通知イベントは発行されないこと (サイレント解禁)
        expect(unlockedEvents.length).toBe(0);
    });

    it('6. プレイ中のインベントリ更新: 新規入手した識別済みアイテムが手帳にアンロックされ、通知イベントが発行されること', () => {
        // 初期同期完了
        gkl.getInventoryStateManager().updateFromMenuItems([
            { letter: 'a', rawStr: 'a +0 long sword', onum: 28 }
        ]);
        expect(unlockedEvents.length).toBe(0);

        // ダンジョンで新しいアイテム (onum 259: pick-axe) を拾ってインベントリが更新される
        expect(logManager.isObjectUnlocked(259)).toBe(false);
        gkl.getInventoryStateManager().updateFromMenuItems([
            { letter: 'a', rawStr: 'a +0 long sword', onum: 28 },
            { letter: 'f', rawStr: 'an uncursed pick-axe', onum: 259 }
        ]);

        // 手帳にアンロックされ、通知イベントが発行されたこと
        expect(logManager.isObjectUnlocked(259)).toBe(true);
        expect(unlockedEvents.length).toBe(1);
        expect(unlockedEvents[0].category).toBe('object');
        expect(unlockedEvents[0].onum).toBe(259);
        expect(unlockedEvents[0].name).toBe('pick-axe');

        // 同じアイテムを再度同期しても二重通知されないこと
        gkl.getInventoryStateManager().updateFromMenuItems([
            { letter: 'a', rawStr: 'a +0 long sword', onum: 28 },
            { letter: 'f', rawStr: 'an uncursed pick-axe', onum: 259 }
        ]);
        expect(unlockedEvents.length).toBe(1);
    });

    it('7. 未識別アイテムの保護: 未識別アイテムはインベントリに存在しても手帳にアンロックされないこと', () => {
        // 未識別ポーション (ruby potion)
        const unidentPotion = [
            { letter: 'c', rawStr: 'a ruby potion' }
        ];

        gkl.getInventoryStateManager().updateFromMenuItems(unidentPotion);

        // 未識別ポーションは手帳にアンロックされず、イベントも出ないこと
        expect(unlockedEvents.length).toBe(0);
    });

    it('8. Discoveries コマンド同期: updateFromDiscoveriesText から既知アイテムが手帳にアンロックされること', () => {
        // onum 428: wand of digging
        expect(logManager.isObjectUnlocked(428)).toBe(false);

        const discoveriesText = [
            'Wands:',
            '  wand of digging (silver)'
        ];

        gkl.getDiscoveryStateManager().updateFromDiscoveriesText(discoveriesText);

        expect(logManager.isObjectUnlocked(428)).toBe(true);
    });
});
