import { describe, it, expect, vi } from 'vitest';
import { WebUICore } from './WebUICore.js';

function createMockDriver() {
    return {
        on: vi.fn(),
        emit: vi.fn(),
        queueSequence: vi.fn(),
        getPromptCategory: vi.fn()
    };
}

describe('WebUICore - isNonItemSequence and syncInventorySilent Guard', () => {
    it('isNonItemSequence: 移動キー・カウントキー・抽象方向キーを正しい非アイテム操作と判定すること', () => {
        const core = new WebUICore({ driver: createMockDriver() });

        expect(core.gkl.isNonItemSequence(['k'])).toBe(true);
        expect(core.gkl.isNonItemSequence(['j'])).toBe(true);
        expect(core.gkl.isNonItemSequence(['5'])).toBe(true);
        expect(core.gkl.isNonItemSequence(['DIR_N'])).toBe(true);
        expect(core.gkl.isNonItemSequence(['_'])).toBe(true);
        expect(core.gkl.isNonItemSequence(['5', 'k'])).toBe(true);

        // アイテム操作を含むシーケンスは false
        expect(core.gkl.isNonItemSequence(['d', 'a'])).toBe(false);
        expect(core.gkl.isNonItemSequence(['a', 'f'])).toBe(false);
        expect(core.gkl.isNonItemSequence(['w', 'b'])).toBe(false);
    });

    it('executeSequence: 移動キーやカウントキー実行時に invalidate() を呼ばないこと', async () => {
        const mockDriver = createMockDriver();
        const core = new WebUICore({ driver: mockDriver });
        const mockInventoryStateManager = {
            isSynced: true,
            invalidate: vi.fn()
        };

        core.gkl.inventoryStateManager = mockInventoryStateManager;

        // 1. 移動キー 'k' 実行
        await core.executeSequence(['k']);
        expect(mockInventoryStateManager.invalidate).not.toHaveBeenCalled();
        expect(mockInventoryStateManager.isSynced).toBe(true);

        // 2. カウントキー '5' 実行
        await core.executeSequence(['5']);
        expect(mockInventoryStateManager.invalidate).not.toHaveBeenCalled();
        expect(mockInventoryStateManager.isSynced).toBe(true);

        // 3. アイテム操作 'd' (drop) 実行
        await core.executeSequence(['d', 'a']);
        expect(mockInventoryStateManager.invalidate).toHaveBeenCalledTimes(1);
    });

    it('respond: 単発キー入力・応答時に無条件で invalidate() を呼ばないこと', () => {
        const mockDriver = createMockDriver();
        const core = new WebUICore({ driver: mockDriver });
        const mockInventoryStateManager = {
            isSynced: true,
            invalidate: vi.fn()
        };

        core.gkl.inventoryStateManager = mockInventoryStateManager;
        const mockResolver = { respond: vi.fn() };

        // 'k' 応答
        core.respond('k', mockResolver);
        expect(mockInventoryStateManager.invalidate).not.toHaveBeenCalled();

        // '5' カウントキー応答
        core.respond('5', mockResolver);
        expect(mockInventoryStateManager.invalidate).not.toHaveBeenCalled();
    });

    it('syncInventorySilent: カウントプレフィックス待機中の場合、クエリ送出をガードして false を返すこと', async () => {
        const mockDriver = createMockDriver();
        const core = new WebUICore({ driver: mockDriver });
        core.querySequenceSilent = vi.fn().mockResolvedValue([]);
        core.gkl.inventoryStateManager = { items: [], updateFromSequenceBuffer: vi.fn() };

        // 通常状態: syncInventorySilent はクエリを発行する
        core.lastPutstrText = "You move forward.";
        await core.gkl.syncInventorySilent();
        expect(core.querySequenceSilent).toHaveBeenCalledWith(['i', ' ', '\x1b'], { syncType: 'inventory' });

        core.querySequenceSilent.mockClear();

        // カウントプレフィックス待機中メッセージ検出時: ガードが働き false を返し querySequenceSilent は呼ばれない
        core.lastPutstrText = "「5」プレフィックスの後には移動コマンドを続けてください。";
        const result = await core.gkl.syncInventorySilent();
        expect(result).toBe(false);
        expect(core.querySequenceSilent).not.toHaveBeenCalled();
    });

    it('handleMessageText: 通常メッセージ受信時に無条件で inventoryStateUpdated を emit しないこと', () => {
        let emitted = false;
        const mockDriver = createMockDriver();

        let putstrHandler = null;
        mockDriver.on.mockImplementation((event, handler) => {
            if (event === 'putstr') putstrHandler = handler;
        });

        const core = new WebUICore({ driver: mockDriver });
        core.gkl.inventoryStateManager = {
            items: [],
            isSynced: true,
            updateFromMessage: vi.fn().mockReturnValue(false) // 変更なし
        };

        core.on('inventoryStateUpdated', () => {
            emitted = true;
        });

        // テキストメッセージ（"You see here a gold piece."）を受信
        if (putstrHandler) {
            putstrHandler({ windowId: 1, text: "You see here a gold piece." });
        }

        expect(core.gkl.inventoryStateManager.updateFromMessage).toHaveBeenCalledWith("You see here a gold piece.");
        expect(emitted).toBe(false); // 無用な emit は行われないこと！
    });

    it('inputRequired: 未同期ステートが存在する場合に syncPendingStateSilent が自動的に実行されること', async () => {
        let inputRequiredHandler = null;
        const mockDriver = createMockDriver();
        mockDriver.on.mockImplementation((event, handler) => {
            if (event === 'inputRequired') inputRequiredHandler = handler;
        });

        const core = new WebUICore({ driver: mockDriver });
        core.gkl.syncSpellsSilent = vi.fn().mockResolvedValue(true);
        core.gkl.syncInventorySilent = vi.fn().mockResolvedValue(true);

        // 魔法未同期・インベントリ同期済みの状態で inputRequired 発火
        core.gkl.spellStateManager.isSynced = false;
        core.gkl.inventoryStateManager.isSynced = true;

        if (inputRequiredHandler) {
            inputRequiredHandler({ context: 'yn', prompt: 'Continue? [yn]' });
        }

        await new Promise(r => setTimeout(r, 10));

        expect(core.gkl.syncSpellsSilent).toHaveBeenCalledTimes(1);
        expect(core.gkl.syncInventorySilent).not.toHaveBeenCalled();
    });

    it('メッセージ受信時に translationLog および messageUntranslated が正しく発火されること', () => {
        let putstrHandler = null;
        const mockDriver = createMockDriver();
        mockDriver.on.mockImplementation((event, handler) => {
            if (event === 'putstr') putstrHandler = handler;
        });

        const core = new WebUICore({ driver: mockDriver });
        core.translator.trMap.set('Known message', '既知のメッセージ');

        const trLogs = [];
        const untranslatedLogs = [];

        core.on('translationLog', (log) => trLogs.push(log));
        core.on('messageUntranslated', (log) => untranslatedLogs.push(log));

        // 1. 既知メッセージの受信
        putstrHandler({ windowId: 1, text: 'Known message' });
        expect(trLogs).toHaveLength(1);
        expect(trLogs[0].raw).toBe('Known message');
        expect(trLogs[0].translated).toBe('既知のメッセージ');
        expect(trLogs[0].success).toBe(true);
        expect(untranslatedLogs).toHaveLength(0);

        // 2. 未翻訳メッセージの受信
        putstrHandler({ windowId: 1, text: 'The goblin hits you hard!' });
        expect(trLogs).toHaveLength(2);
        expect(trLogs[1].raw).toBe('The goblin hits you hard!');
        expect(trLogs[1].success).toBe(false);
        expect(untranslatedLogs).toHaveLength(1);
        expect(untranslatedLogs[0].raw).toBe('The goblin hits you hard!');

        // 3. ノイズメッセージ（数字のみ）の受信時は messageUntranslated を発火しないこと
        putstrHandler({ windowId: 1, text: '12345' });
        expect(trLogs).toHaveLength(3);
        expect(trLogs[2].success).toBe(false);
        expect(untranslatedLogs).toHaveLength(1); // 増加しないこと
    });

    it('「5」などのプレフィックスキー入力直後は isPendingPrefix により syncPendingStateSilent が抑止され、デバウンスがバイパスされること', async () => {
        let inputRequiredHandler = null;
        const mockDriver = createMockDriver();
        mockDriver.on.mockImplementation((event, handler) => {
            if (event === 'inputRequired') inputRequiredHandler = handler;
        });

        const core = new WebUICore({ driver: mockDriver });
        core.gkl.syncSpellsSilent = vi.fn().mockResolvedValue(true);
        core.gkl.syncInventorySilent = vi.fn().mockResolvedValue(true);
        core.gkl.spellStateManager.isSynced = true;
        core.gkl.inventoryStateManager.isSynced = true;

        const mockResolver1 = { respond: vi.fn(), cancel: vi.fn() };
        const mockResolver2 = { respond: vi.fn(), cancel: vi.fn() };

        // 1. 最初の入力待ちで「5」キーを送信
        if (inputRequiredHandler) {
            inputRequiredHandler({ context: 'poskey', promptCategory: 'POSKEY', resolver: mockResolver1 });
        }
        core.respond('5');
        expect(mockResolver1.respond).toHaveBeenCalledWith(53);
        expect(core.isPendingPrefix).toBe(true);

        // 2. 「5」直後の方向入力待ち inputRequired が発生した際、未同期ステートがあっても自動同期が抑止されること
        core.gkl.syncSpellsSilent.mockClear();
        core.gkl.syncInventorySilent.mockClear();
        core.gkl.spellStateManager.isSynced = false;
        if (inputRequiredHandler) {
            inputRequiredHandler({ context: 'poskey', promptCategory: 'POSKEY', resolver: mockResolver2 });
        }
        await new Promise(r => setTimeout(r, 10));
        expect(core.gkl.syncSpellsSilent).not.toHaveBeenCalled();
        expect(core.gkl.syncInventorySilent).not.toHaveBeenCalled();

        // 3. 素早い2打目の方向キー入力（120ms以内）がデバウンスでドロップされずに届くこと
        core.lastInputTime = Date.now();
        core.sendKey('Numpad8', false, false, false, '8');
        expect(mockResolver2.respond).toHaveBeenCalledWith(56);
        expect(core.isPendingPrefix).toBe(false); // 方向入力完了でプレフィックス解除
    });
});
