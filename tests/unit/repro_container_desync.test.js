import { describe, it, expect } from 'vitest';
import { ItemNormalizer } from '../../src/core/knowledge/models/ItemNormalizer.js';
import { ContainerDraftController, TRANSFER_DIRECTION } from '../../src/ui-controller/ContainerDraftController.js';
import { ContainerSequenceBuilder } from '../../src/core/container/ContainerSequenceBuilder.js';

describe('Container State Desync Reproduction Tests', () => {

    it('Bug 1: ItemNormalizer cobjPtr corruption when cobjPtr is 0 or empty', () => {
        // 通常のアイテム（ダガー）や、中身が空の箱
        const dagger = {
            rawObjPtr: 5001,
            ptr: 5001,
            cobjPtr: 0, // 中身なし
            name: 'dagger',
            rawText: 'a dagger',
            onum: 247,
        };

        const normalizedDagger = ItemNormalizer.normalize(dagger);
        // cobjPtr は 0 のはずが、rawObjPtr (5001) で上書きされてしまう問題
        expect(normalizedDagger.cobjPtr).toBe(0);
        expect(normalizedDagger.rawObjPtr).toBe(5001);

        // 中身が空のチェスト
        const emptyChest = {
            rawObjPtr: 6001,
            ptr: 6001,
            cobjPtr: 0,
            name: 'chest',
            rawText: 'empty chest',
            onum: 215,
            flags: { empty: true }
        };
        const normalizedChest = ItemNormalizer.normalize(emptyChest);
        expect(normalizedChest.cobjPtr).toBe(0);
        expect(normalizedChest.displayName).toContain('empty');
    });

    it('Bug 2: ItemNormalizer count === -1 corrupts quan to -1', () => {
        const itemWithMinusOneCount = {
            name: 'apple',
            rawText: 'an apple',
            count: -1, // コンテナメニュー等での全量フラグ
            onum: 284
        };

        const normalized = ItemNormalizer.normalize(itemWithMinusOneCount);
        // quan は正の整数 (1) になるべき
        expect(normalized.quan).toBe(1);
    });

    it('Bug 3: ContainerSequenceBuilder rejects distinct container of same onum as SELF_CONTAINER', () => {
        const builder = new ContainerSequenceBuilder();
        // コンテナ: 開いている袋 A (letter: 'a', onum: 217, identifier: 1001)
        const openSack = {
            letter: 'a',
            name: 'sack',
            onum: 217,
            identifier: 1001
        };

        // 投入候補: 別の袋 B (letter: 'b', onum: 217, identifier: 1002)
        const anotherSack = {
            letter: 'b',
            name: 'sack',
            onum: 217,
            identifier: 1002
        };

        const { validItems, excludedItems } = builder.validatePutInItems(openSack, [anotherSack]);
        // 別の袋なので投入可能であるべき！
        expect(validItems.length).toBe(1);
        expect(excludedItems.length).toBe(0);
    });

    it('Bug 4: ContainerDraftController ignores CanonicalItem quan property', () => {
        const controller = new ContainerDraftController();
        // CanonicalItem: 数量が quan: 5 で保持されている (count は undefined)
        const canonicalArrows = {
            letter: 'd',
            name: 'arrow',
            quan: 5,
            _canonical: true
        };

        const res = controller.stageTransfer(canonicalArrows, TRANSFER_DIRECTION.TO_CONTAINER);
        // 全量投入 (-1) 時は quan の 5 が反映されるべき
        expect(res.draft.count).toBe(5);
    });

    it('Bug 5: ContainerController emits renderRequired and turn_ready upon transferItem and closeSession', async () => {
        const emitSpy = vi.fn();
        const mockCore = {
            emit: emitSpy,
            gkl: { syncInventorySilent: vi.fn().mockResolvedValue(true) },
            interactiveController: {
                acquireSessionLock: vi.fn(),
                releaseSessionLock: vi.fn(),
                querySequenceSilent: vi.fn().mockResolvedValue({ success: true })
            }
        };

        const { ContainerController } = await import('../../src/core/container/ContainerController.js');
        const ctrl = new ContainerController({ core: mockCore });
        ctrl.isSessionActive = true;
        ctrl.currentContainer = { name: 'sack', letter: 'c' };

        const res = await ctrl.transferItem({
            direction: 'in',
            item: { letter: 'f', name: 'food ration', quan: 1 }
        });

        expect(res.success).toBe(true);
        // transferItem 完了時に画面再描画イベントがトリガーされること
        expect(emitSpy).toHaveBeenCalledWith('renderRequired', { reason: 'containerTransfer' });
        expect(emitSpy).toHaveBeenCalledWith('turn_ready', expect.anything());

        // closeSession 時に画面再描画イベントがトリガーされること
        ctrl.closeSession();
        expect(emitSpy).toHaveBeenCalledWith('renderRequired', { reason: 'containerClose' });
    });

    it('Bug 6: InteractiveRequestController _matchesRule properly evaluates function matches and does not falsely match all payloads', async () => {
        const { InteractiveRequestController } = await import('../../src/core/request/InteractiveRequestController.js');
        const irc = new InteractiveRequestController({ on: vi.fn(), emit: vi.fn() });

        const funcMatch = (payload) => payload.prompt === 'loot it?';
        const ctx = { state: 'IDLE', signal: null };

        // 一致しないペイロードに対しては false を返すこと
        expect(irc._matchesRule(funcMatch, { prompt: 'Put in what?' }, ctx)).toBe(false);
        // 一致するペイロードに対しては true を返すこと
        expect(irc._matchesRule(funcMatch, { prompt: 'loot it?' }, ctx)).toBe(true);
    });
});

