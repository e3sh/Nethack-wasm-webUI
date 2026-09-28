import { describe, it, expect } from 'vitest';
import { DiscoveryStateManager } from "../state/DiscoveryStateManager.js";

describe('DiscoveryStateManager', () => {
    it('1. `\\` コマンドの出力テキストから識別済みアイテムと外見マッピングを一括再生・同期できる', () => {
        const manager = new DiscoveryStateManager();
        const discoveryText = `
Discoveries
Potions:
  healing (ruby)
  extra healing (pink)
Scrolls:
  identify (labeled ZELGO MER)
  teleportation (labeled FOOBAR)
Wands:
  digging (silver) called dig?
Rings:
  free action (granite)
        `;

        manager.updateFromDiscoveriesText(discoveryText);

        expect(manager.isSynced).toBe(true);
        expect(manager.discoveredOnums.size).toBeGreaterThan(0);

        // potion of healing (ruby)
        expect(manager.appearanceMap.get('ruby')).toBe('potion of healing');
        expect(manager.appearanceMap.get('granite')).toBe('ring of free action');
        expect(manager.calledNamesMap.get('silver')).toBe('dig?');

        // isIdentified
        expect(manager.isIdentified('potion of healing')).toBe(true);
        expect(manager.isIdentified('ruby')).toBe(true);
        expect(manager.isIdentified('ring of free action')).toBe(true);

        // 未識別のアイテム
        expect(manager.isIdentified('wand of death')).toBe(false);
        expect(manager.isIdentified('balsa')).toBe(false);
    });

    it('2. 食料や基本道具などの非ランダムアイテムは本質的に識別済みと判定される', () => {
        const manager = new DiscoveryStateManager();
        // onum 288: food ration (FOOD)
        expect(manager.isIdentified(288)).toBe(true);
    });

    it('3. 新たに判明したアイテムを手動学習登録できる', () => {
        const manager = new DiscoveryStateManager();
        expect(manager.isIdentified(325)).toBe(false); // scroll of teleportation

        manager.registerKnownItem(325, 'scroll of teleportation', 'labeled FOOBAR', 'tele?');
        expect(manager.isIdentified(325)).toBe(true);
        expect(manager.appearanceMap.get('labeled foobar')).toBe('scroll of teleportation');
        expect(manager.calledNamesMap.get('labeled foobar')).toBe('tele?');
    });

    it('4. reset で全キャッシュがクリアされる', () => {
        const manager = new DiscoveryStateManager();
        manager.registerKnownItem(300, 'potion of healing');
        expect(manager.discoveredOnums.size).toBe(1);

        manager.reset();
        expect(manager.discoveredOnums.size).toBe(0);
        expect(manager.isSynced).toBe(false);
    });

    describe('Stage 5.4C: MessageContext Driven Item Discovery Tests', () => {
        it('5. 効果メッセージから巻物の真名を自動昇格できる', () => {
            const manager = new DiscoveryStateManager();
            expect(manager.isIdentified('scroll of identify')).toBe(false);

            const context = {
                messageId: 'read.c:L105:pline:0',
                rawText: 'This is an identify scroll.'
            };
            const result = manager.processDiscoveryMessage(context);
            expect(result).not.toBeNull();
            expect(result.trueName).toBe('scroll of identify');
            expect(manager.isIdentified('scroll of identify')).toBe(true);
        });

        it('6. 杖放射の効果メッセージから真名と外見を紐づけて自動昇格できる', () => {
            const manager = new DiscoveryStateManager();
            expect(manager.isIdentified('wand of digging')).toBe(false);

            const context = {
                messageId: 'zap.c:L180:pline:0',
                rawText: 'The floor collapses!'
            };
            const recentUsed = {
                name: 'a silver wand',
                appearance: 'silver'
            };
            const result = manager.processDiscoveryMessage(context, recentUsed);
            expect(result).not.toBeNull();
            expect(result.trueName).toBe('wand of digging');
            expect(manager.isIdentified('wand of digging')).toBe(true);
            expect(manager.appearanceMap.get('silver')).toBe('wand of digging');
        });

        it('7. 未登録メッセージの場合は null を返し、状態を変更しない', () => {
            const manager = new DiscoveryStateManager();
            const context = {
                messageId: 'unknown.c:message:0',
                rawText: 'Nothing happens.'
            };
            const result = manager.processDiscoveryMessage(context);
            expect(result).toBeNull();
        });
    });
});
