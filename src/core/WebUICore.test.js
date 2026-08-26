import { describe, it, expect, vi } from 'vitest';
import { WebUICore } from './WebUICore.js';
import { PROMPT_CATEGORY } from './types.js';

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

    it('respond: DIRECTION プロンプト時に DIR_* トークンを正しくキー文字に解決して応答すること', () => {
        const mockDriver = createMockDriver();
        const core = new WebUICore({ driver: mockDriver, keyMode: 'numpad' });
        const mockResolver = { respond: vi.fn() };
        core.activeResolver = mockResolver;
        core.currentPromptCategory = PROMPT_CATEGORY.DIRECTION;

        // DIR_N ➔ '8' (ASCII 56)
        core.respond('DIR_N');
        expect(mockResolver.respond).toHaveBeenCalledWith(56);

        // DIR_SELF ➔ '.' (ASCII 46)
        core.activeResolver = mockResolver;
        core.currentPromptCategory = PROMPT_CATEGORY.DIRECTION;
        core.respond('DIR_SELF');
        expect(mockResolver.respond).toHaveBeenCalledWith(46);

        // DIR_CANCEL ➔ ESC (ASCII 27)
        core.activeResolver = mockResolver;
        core.currentPromptCategory = PROMPT_CATEGORY.DIRECTION;
        core.respond('DIR_CANCEL');
        expect(mockResolver.respond).toHaveBeenCalledWith(27);
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
            inputRequiredHandler({ context: 'poskey', type: 'poskey' });
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

    it('メニュー項目 (select_menu) およびテキストウィンドウ (display_nhwindow) 処理時にも translationLog が漏れなく発火されること', () => {
        let inputRequiredHandler = null;
        let displayNhwindowHandler = null;
        let putstrHandler = null;
        const mockDriver = createMockDriver();
        mockDriver.on.mockImplementation((event, handler) => {
            if (event === 'inputRequired') inputRequiredHandler = handler;
            if (event === 'display_nhwindow') displayNhwindowHandler = handler;
            if (event === 'putstr') putstrHandler = handler;
        });

        const core = new WebUICore({ driver: mockDriver });
        core.translator.trMap.set('Inventory', '所持品');
        core.translator.trMap.set('a - a dagger', 'a - ダガー');

        const trLogs = [];
        const untranslatedLogs = [];

        core.on('translationLog', (log) => trLogs.push(log));
        core.on('messageUntranslated', (log) => untranslatedLogs.push(log));

        // 1. メニュー画面 (inputRequired context: 'select_menu')
        inputRequiredHandler({
            context: 'select_menu',
            prompt: 'Inventory',
            items: [
                { str: 'a - a dagger', ch: 'a'.charCodeAt(0) },
                { str: 'b - an unquoted unknown wand', ch: 'b'.charCodeAt(0) }
            ],
            resolver: { respond: vi.fn() }
        });

        // プロンプト + アイテム2件 = 計3件のログ
        expect(trLogs.length).toBeGreaterThanOrEqual(3);
        const invPromptLog = trLogs.find(l => l.raw === 'Inventory');
        expect(invPromptLog).toBeDefined();
        expect(invPromptLog.translated).toBe('所持品');
        expect(invPromptLog.success).toBe(true);

        const daggerLog = trLogs.find(l => l.raw === 'a - a dagger');
        expect(daggerLog).toBeDefined();
        expect(daggerLog.translated).toBe('a - ダガー');
        expect(daggerLog.success).toBe(true);

        const wandLog = trLogs.find(l => l.raw === 'b - an unquoted unknown wand');
        expect(wandLog).toBeDefined();
        expect(wandLog.success).toBe(false);
        expect(untranslatedLogs.some(l => l.raw === 'b - an unquoted unknown wand')).toBe(true);

        // 2. テキストウィンドウ (putstr windowId: 4 + display_nhwindow)
        putstrHandler({ windowId: 4, text: 'First line of text window' });
        putstrHandler({ windowId: 4, text: 'Second line of text window' });

        displayNhwindowHandler({
            windowId: 4,
            blocking: true,
            resolver: { respond: vi.fn() }
        });

        expect(trLogs.some(l => l.raw === 'First line of text window')).toBe(true);
        expect(trLogs.some(l => l.raw === 'Second line of text window')).toBe(true);
        expect(untranslatedLogs.some(l => l.raw === 'First line of text window')).toBe(true);
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

    it('restart: 状態を初期化し、イベントを発行して安全に再起動できること', async () => {
        const mockDriver = createMockDriver();
        mockDriver.restart = vi.fn().mockResolvedValue(true);
        mockDriver.init = vi.fn();
        mockDriver.start = vi.fn().mockResolvedValue(0);

        const core = new WebUICore({ driver: mockDriver });
        core.isPendingPrefix = true;
        core.activeMenuItems = [{ key: 'a', label: 'item' }];

        const stateChanges = [];
        core.on('stateChange', (payload) => stateChanges.push(payload.state));

        const restartedHandler = vi.fn();
        core.on('restarted', restartedHandler);

        const mapClearedHandler = vi.fn();
        core.on('map_cleared', mapClearedHandler);

        // autoStart: false で restart 実行
        const res = await core.restart({ clearStorage: false, autoStart: false });
        expect(res).toBe(true);
        expect(mockDriver.restart).toHaveBeenCalled();
        expect(core.isPendingPrefix).toBe(false);
        expect(core.activeMenuItems).toEqual([]);
        expect(mapClearedHandler).toHaveBeenCalled();
        expect(restartedHandler).toHaveBeenCalled();
        expect(stateChanges).toContain('INITIALIZING');
    });

    describe('autoCancelItemNaming: アイテム使用時名前付けプロンプトの自動キャンセル', () => {
        it('isItemCallPrompt: アイテム使用中 (isItemUsingActive: true) のみ種別名付けプロンプトを検知し、手動操作時やペット・個別命名を除外すること', () => {
            const core = new WebUICore({ driver: createMockDriver() });

            // 手動操作時 (isItemUsingActive === false) は docall プロンプトであっても常に false (抑止しない)
            core.isItemUsingActive = false;
            expect(core.isItemCallPrompt('Call a scroll labeled PHOL ENDE WODAN:')).toBe(false);
            expect(core.isItemCallPrompt('What do you want to call this type of potion?')).toBe(false);
            expect(core.isItemCallPrompt('赤い薬を何と呼びますか?')).toBe(false);

            // アイテム使用中 (isItemUsingActive === true)
            core.isItemUsingActive = true;

            // 英語アイテム種別（NetHack 5.0 形式: "Call <item>:"）
            expect(core.isItemCallPrompt('Call a scroll labeled PHOL ENDE WODAN:')).toBe(true);
            expect(core.isItemCallPrompt('Call a red potion:')).toBe(true);
            expect(core.isItemCallPrompt('Call a glass wand:')).toBe(true);
            expect(core.isItemCallPrompt('Call a wooden ring:')).toBe(true);
            expect(core.isItemCallPrompt('Call a stream of smoky fluid:')).toBe(true);
            expect(core.isItemCallPrompt('Call this ruby:')).toBe(true);

            // 英語アイテム種別（NetHack クラシック形式: "What do you want to call ...?"）
            expect(core.isItemCallPrompt('What do you want to call this scroll?')).toBe(true);
            expect(core.isItemCallPrompt('What do you want to call this type of potion?')).toBe(true);
            expect(core.isItemCallPrompt('What do you want to call this wand?')).toBe(true);
            expect(core.isItemCallPrompt('What do you want to call this ring?')).toBe(true);
            expect(core.isItemCallPrompt('What do you want to call a scroll labeled ZELGO MER?')).toBe(true);
            expect(core.isItemCallPrompt('What do you want to call this red potion?')).toBe(true);
            expect(core.isItemCallPrompt('What do you want to call this smoky potion?')).toBe(true);
            expect(core.isItemCallPrompt('What do you want to call this glass wand?')).toBe(true);
            expect(core.isItemCallPrompt('What do you want to call this wooden ring?')).toBe(true);
            expect(core.isItemCallPrompt('What do you want to call this ruby?')).toBe(true);
            expect(core.isItemCallPrompt('What do you want to call this triangular amulet?')).toBe(true);

            // 日本語アイテム種別（NetHackJP 形式: 「...を何と呼びますか?」）
            expect(core.isItemCallPrompt('この種類の巻物を何と呼びますか？')).toBe(true);
            expect(core.isItemCallPrompt('この種類の薬を何と呼びますか？')).toBe(true);
            expect(core.isItemCallPrompt('この種類の杖を何と呼びますか？')).toBe(true);
            expect(core.isItemCallPrompt('赤い薬を何と呼びますか?')).toBe(true);
            expect(core.isItemCallPrompt('暗い薬を何と呼びますか？')).toBe(true);
            expect(core.isItemCallPrompt('「ELAM EBOW」と書かれた巻物を何と呼びますか?')).toBe(true);
            expect(core.isItemCallPrompt('木製の杖を何と呼びますか?')).toBe(true);
            expect(core.isItemCallPrompt('ガラスの杖を何と呼びますか?')).toBe(true);
            expect(core.isItemCallPrompt('ルビーを何と呼びますか?')).toBe(true);
            expect(core.isItemCallPrompt('青い石を何と呼びますか?')).toBe(true);
            expect(core.isItemCallPrompt('四角い魔除けを何と呼びますか?')).toBe(true);
            expect(core.isItemCallPrompt('この液体を何と呼びますか?')).toBe(true);

            // ペット・モンスター命名（除外）
            expect(core.isItemCallPrompt('What do you want to call this kitten?')).toBe(false);
            expect(core.isItemCallPrompt('What do you want to call this little dog?')).toBe(false);
            expect(core.isItemCallPrompt('What do you want to call this horse?')).toBe(false);
            expect(core.isItemCallPrompt('この子猫を何と呼びますか？')).toBe(false);
            expect(core.isItemCallPrompt('この小犬を何と呼びますか？')).toBe(false);
            expect(core.isItemCallPrompt('この馬を何と呼びますか？')).toBe(false);
            expect(core.isItemCallPrompt('このモンスターを何と呼びますか？')).toBe(false);

            // 個別アイテム命名（除外）
            expect(core.isItemCallPrompt('What do you want to name this broadsword?')).toBe(false);
            expect(core.isItemCallPrompt('この剣を何と名付けますか？')).toBe(false);
            expect(core.isItemCallPrompt('このブロードソードを何と名付けますか?')).toBe(false);

            // その他プロンプト（除外）
            expect(core.isItemCallPrompt('What do you want to write on the floor with?')).toBe(false);
            expect(core.isItemCallPrompt('What do you want to wish for?')).toBe(false);
        });

        it('getAutoMemoName: 直前の英語メッセージを最大24文字の安全なASCII文字列にサニタイズ・整形すること', () => {
            const core = new WebUICore({ driver: createMockDriver() });

            core.lastRawMessageText = 'You feel much better.';
            expect(core.getAutoMemoName()).toBe('You feel much better');

            core.lastRawMessageText = 'An unseen monster suddenly appears nearby!';
            expect(core.getAutoMemoName().length).toBeLessThanOrEqual(24);
            expect(core.getAutoMemoName()).toBe('An unseen monster sudden');

            core.lastRawMessageText = '"The floor shakes violently!"';
            expect(core.getAutoMemoName()).toBe('The floor shakes violent');

            core.lastRawMessageText = '';
            expect(core.getAutoMemoName()).toBe('');
        });

        it('itemNamingMode: "auto_memo" 時に、直前の英語メッセージが自動で名前として登録されること', () => {
            let inputRequiredHandler = null;
            let putstrHandler = null;
            const mockDriver = {
                on: vi.fn((event, handler) => {
                    if (event === 'inputRequired') inputRequiredHandler = handler;
                    if (event === 'putstr') putstrHandler = handler;
                }),
                emit: vi.fn(),
                queueSequence: vi.fn(),
                getPromptCategory: vi.fn().mockReturnValue(PROMPT_CATEGORY.TEXT)
            };

            const core = new WebUICore({ driver: mockDriver, itemNamingMode: 'auto_memo' });
            core.isItemUsingActive = true;
            const mockResolver = { respond: vi.fn() };
            const autoMemoListener = vi.fn();
            core.on('itemNamingAutoMemo', autoMemoListener);

            // 効果メッセージの受信
            putstrHandler({ windowId: 1, text: 'You float in the air!' });

            // docall プロンプトの発行
            inputRequiredHandler({
                promptCategory: PROMPT_CATEGORY.TEXT,
                context: 'getlin',
                prompt: 'Call a red potion:',
                rawPrompt: 'Call a red potion:',
                resolver: mockResolver
            });

            // 直前メッセージ 'You float in the air' が自動入力されること
            expect(mockResolver.respond).toHaveBeenCalledWith('You float in the air');
            expect(autoMemoListener).toHaveBeenCalledTimes(1);
            expect(autoMemoListener).toHaveBeenCalledWith(expect.objectContaining({
                name: 'You float in the air',
                prompt: 'Call a red potion:'
            }));
        });

        it('itemNamingMode: "skip" 時に、空文字を自動応答して名前付けをスキップすること', () => {
            let inputRequiredHandler = null;
            const mockDriver = {
                on: vi.fn((event, handler) => {
                    if (event === 'inputRequired') inputRequiredHandler = handler;
                }),
                emit: vi.fn(),
                queueSequence: vi.fn(),
                getPromptCategory: vi.fn().mockReturnValue(PROMPT_CATEGORY.TEXT)
            };

            const core = new WebUICore({ driver: mockDriver, itemNamingMode: 'skip' });
            core.isItemUsingActive = true;
            const mockResolver = { respond: vi.fn() };
            const skippedListener = vi.fn();
            core.on('itemNamingSkipped', skippedListener);

            // docall プロンプトの発行
            inputRequiredHandler({
                promptCategory: PROMPT_CATEGORY.TEXT,
                context: 'getlin',
                prompt: 'Call a scroll labeled PHOL ENDE WODAN:',
                rawPrompt: 'Call a scroll labeled PHOL ENDE WODAN:',
                resolver: mockResolver
            });

            // 即座に空文字で respond され、イベントが発行されること
            expect(mockResolver.respond).toHaveBeenCalledWith('');
            expect(skippedListener).toHaveBeenCalledTimes(1);
        });

        it('itemNamingMode: "manual" (または autoCancelItemNaming: false) の場合は自動スキップされず、通常の inputRequired イベントが発行されること', () => {
            let inputRequiredHandler = null;
            const mockDriver = {
                on: vi.fn((event, handler) => {
                    if (event === 'inputRequired') inputRequiredHandler = handler;
                }),
                emit: vi.fn(),
                queueSequence: vi.fn(),
                getPromptCategory: vi.fn().mockReturnValue(PROMPT_CATEGORY.TEXT)
            };

            const core = new WebUICore({ driver: mockDriver, itemNamingMode: 'manual' });
            core.isItemUsingActive = true;
            const mockResolver = { respond: vi.fn() };
            const inputRequiredListener = vi.fn();
            core.on('inputRequired', inputRequiredListener);

            inputRequiredHandler({
                promptCategory: PROMPT_CATEGORY.TEXT,
                context: 'getlin',
                prompt: 'Call a scroll labeled PHOL ENDE WODAN:',
                rawPrompt: 'Call a scroll labeled PHOL ENDE WODAN:',
                resolver: mockResolver
            });

            // 自動 respond は行われず、UIイベントが発行されること
            expect(mockResolver.respond).not.toHaveBeenCalled();
            expect(inputRequiredListener).toHaveBeenCalledTimes(1);
        });

        it('手動で #call 拡張コマンドを実行した場合は、docall プロンプトであっても自動スキップされないこと', async () => {
            let inputRequiredHandler = null;
            const mockDriver = {
                on: vi.fn((event, handler) => {
                    if (event === 'inputRequired') inputRequiredHandler = handler;
                }),
                emit: vi.fn(),
                queueSequence: vi.fn(),
                getPromptCategory: vi.fn().mockReturnValue(PROMPT_CATEGORY.TEXT)
            };

            const core = new WebUICore({ driver: mockDriver, autoCancelItemNaming: true });
            const mockResolver = { respond: vi.fn() };
            const inputRequiredListener = vi.fn();
            core.on('inputRequired', inputRequiredListener);

            // 手動で #call を送信
            await core.sendExtCommand('call');
            expect(core.isManualNamingActive).toBe(true);

            // その後にプロンプトが来た場合
            inputRequiredHandler({
                promptCategory: PROMPT_CATEGORY.TEXT,
                context: 'getlin',
                prompt: 'What do you want to call this type of potion?',
                rawPrompt: 'What do you want to call this type of potion?',
                resolver: mockResolver
            });

            // 手動操作のため自動スキップされないこと
            expect(mockResolver.respond).not.toHaveBeenCalled();
            expect(inputRequiredListener).toHaveBeenCalledTimes(1);
        });
    });
});
