/**
 * ContainerTransactionFSM.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContainerTransactionFSM, ContainerState } from './ContainerTransactionFSM.js';
import { ContainerPromptType, ContainerAction } from './ContainerPromptDetector.js';
import { DangerLevel } from './ContainerSafetyGuard.js';

// ========================================================================
// WebUICore モック
// ========================================================================

function createMockCore() {
    const listeners = new Map();
    return {
        _listeners: listeners,
        gkl: {
            inventoryStateManager: null,
        },
        on(event, fn) {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event).push(fn);
        },
        off(event, fn) {
            if (!listeners.has(event)) return;
            const arr = listeners.get(event);
            const idx = arr.indexOf(fn);
            if (idx >= 0) arr.splice(idx, 1);
        },
        emit(event, data) {
            const fns = listeners.get(event);
            if (fns) fns.forEach(fn => fn(data));
        },
        respond: vi.fn(),
        executeSequence: vi.fn().mockResolvedValue(true),
        querySequenceSilent: vi.fn().mockResolvedValue([]),
    };
}

/**
 * コンテナ操作の inputRequired payload を生成
 */
function makeActionPromptPayload(containerName = 'the bag of holding') {
    return {
        rawPrompt: `Do what with ${containerName}?`,
        prompt: `Do what with ${containerName}?`,
        context: 'select_menu',
        promptCategory: 'MENU',
        items: [],
    };
}

function makeContentsViewPayload(items = []) {
    return {
        rawPrompt: 'Contents of the bag of holding:',
        prompt: 'Contents of the bag of holding:',
        context: 'select_menu',
        promptCategory: 'MENU',
        items,
        menuItems: items,
    };
}

function makeContainerSelectPayload() {
    return {
        rawPrompt: 'Loot which containers?',
        prompt: 'Loot which containers?',
        context: 'select_menu',
        promptCategory: 'MENU',
        items: [],
    };
}

function makeCategorySelectPayload(direction = 'out') {
    const prefix = direction === 'in' ? 'Put in' : 'Take out';
    return {
        rawPrompt: `${prefix} what type of objects?`,
        prompt: `${prefix} what type of objects?`,
        context: 'select_menu',
        promptCategory: 'MENU',
        items: [],
    };
}

function makeItemSelectPayload(direction = 'out') {
    const prefix = direction === 'in' ? 'Put in' : 'Take out';
    return {
        rawPrompt: `${prefix} what?`,
        prompt: `${prefix} what?`,
        context: 'select_menu',
        promptCategory: 'MENU',
        items: [],
    };
}


describe('ContainerTransactionFSM', () => {
    let core;
    let fsm;

    beforeEach(() => {
        core = createMockCore();
        fsm = new ContainerTransactionFSM(core, { debug: false });
    });

    afterEach(() => {
        fsm.detach();
    });

    // ========================================================================
    // 初期化・ライフサイクル
    // ========================================================================

    describe('initialization', () => {
        it('should start in IDLE state', () => {
            expect(fsm.state).toBe(ContainerState.IDLE);
        });

        it('should throw if no core provided', () => {
            expect(() => new ContainerTransactionFSM(null)).toThrow();
        });

        it('should register event listeners on attach', () => {
            expect(core._listeners.get('inputRequired').length).toBeGreaterThanOrEqual(1);
            expect(core._listeners.get('message').length).toBeGreaterThanOrEqual(1);
        });

        it('should unregister event listeners on detach', () => {
            const prevInputRequired = core._listeners.get('inputRequired')?.length || 0;
            fsm.detach();
            const afterInputRequired = core._listeners.get('inputRequired')?.length || 0;
            expect(afterInputRequired).toBeLessThan(prevInputRequired);
        });
    });

    // ========================================================================
    // IDLE → INTERCEPTING → PREFETCHING_CONTENTS
    // ========================================================================

    describe('IDLE → ACTION_PROMPT (Zero Pre-emptive Input)', () => {
        it('should exit menu with (q) to keep C-core at poskey and transition to ACTION_PROMPT', () => {
            const payload = makeActionPromptPayload();
            core.emit('inputRequired', payload);

            expect(fsm.state).toBe(ContainerState.ACTION_PROMPT);
            // 'q' (charCode 113) を送信して C コアを通常ターンに着地させる
            expect(core.respond).toHaveBeenCalledWith(113);
        });

        it('should set container name from prompt', () => {
            core.emit('inputRequired', makeActionPromptPayload('the oilskin sack'));
            expect(fsm.contentsManager.containerName).toBe('the oilskin sack');
        });

        it('中身が存在する場合、その場で o を送出して公式アイテムリストを先読み回収すること', () => {
            core.respond.mockClear();
            core.emit('inputRequired', {
                ...makeActionPromptPayload('the sack'),
                items: [
                    { accelerator: ':', str: 'Look inside the sack' },
                    { accelerator: 'o', str: 'take something out' },
                    { accelerator: 'i', str: 'put something in' },
                ],
            });
            // 'o' (charCode 111) を返答して中身回収に入る
            expect(core.respond).toHaveBeenCalledWith(111);
            expect(fsm.state).toBe(ContainerState.PREFETCHING_CONTENTS);

            // 続く Take out what? を受領したら中身を確定し、ESC (27) でキャンセルして poskey に着地
            core.respond.mockClear();
            core.emit('inputRequired', {
                category: 'MENU',
                promptCategory: 'MENU',
                rawPrompt: 'Take out what?',
                items: [
                    { accelerator: 'a', identifier: 1001, str: 'a food ration' },
                ],
            });
            expect(core.respond).toHaveBeenCalledWith(27);
            expect(fsm.state).toBe(ContainerState.ACTION_PROMPT);
            expect(fsm.contentsManager.items).toHaveLength(1);
            expect(fsm.contentsManager.items[0].accelerator).toBe('a');
        });
    });

    // ========================================================================
    // CONTAINER_SELECT
    // ========================================================================

    describe('CONTAINER_SELECT', () => {
        it('should transition to CONTAINER_SELECT for multi-container loot', () => {
            core.emit('inputRequired', makeContainerSelectPayload());
            expect(fsm.state).toBe(ContainerState.CONTAINER_SELECT);
        });
    });

    // ========================================================================
    // selectAction() — アクション選択
    // ========================================================================

    describe('selectAction()', () => {
        beforeEach(() => {
            // ACTION_PROMPT 状態にする
            core.emit('inputRequired', makeActionPromptPayload());
            core.emit('inputRequired', makeContentsViewPayload([]));
            core.emit('inputRequired', makeActionPromptPayload());
            core.respond.mockClear();
        });

        it('should reject actions when not in ACTION_PROMPT', () => {
            fsm._reset();
            expect(fsm.selectAction(ContainerAction.TAKE_OUT)).toBe(false);
        });

        it('should handle QUIT action', () => {
            const result = fsm.selectAction(ContainerAction.QUIT);
            expect(result).toBe(true);
            expect(core.respond).toHaveBeenCalledWith('q'.charCodeAt(0));
            expect(fsm.state).toBe(ContainerState.IDLE);
        });

        it('should handle NEXT action', () => {
            fsm.selectAction(ContainerAction.NEXT);
            expect(core.respond).toHaveBeenCalledWith('n'.charCodeAt(0));
            expect(fsm.state).toBe(ContainerState.IDLE);
        });

        it('should handle LOOK action', () => {
            fsm.selectAction(ContainerAction.LOOK);
            expect(core.respond).toHaveBeenCalledWith(':'.charCodeAt(0));
            expect(fsm.state).toBe(ContainerState.VIEWING);
        });

        it('should handle TAKE_OUT action', () => {
            fsm.selectAction(ContainerAction.TAKE_OUT);
            expect(core.respond).toHaveBeenCalledWith('o'.charCodeAt(0));
            expect(fsm.state).toBe(ContainerState.TAKING_OUT);
        });

        it('should handle PUT_IN action', () => {
            fsm.selectAction(ContainerAction.PUT_IN);
            expect(core.respond).toHaveBeenCalledWith('i'.charCodeAt(0));
            expect(fsm.state).toBe(ContainerState.PUTTING_IN);
        });

        it('should handle BOTH action', () => {
            fsm.selectAction(ContainerAction.BOTH);
            expect(core.respond).toHaveBeenCalledWith('b'.charCodeAt(0));
            expect(fsm.state).toBe(ContainerState.TAKING_OUT);
        });

        it('should handle REVERSED action', () => {
            fsm.selectAction(ContainerAction.REVERSED);
            expect(core.respond).toHaveBeenCalledWith('r'.charCodeAt(0));
            expect(fsm.state).toBe(ContainerState.PUTTING_IN);
        });

        it('should handle STASH action', () => {
            fsm.selectAction(ContainerAction.STASH);
            expect(core.respond).toHaveBeenCalledWith('s'.charCodeAt(0));
            expect(fsm.state).toBe(ContainerState.STASHING_ONE);
        });
    });

    // ========================================================================
    // 取り出し/投入フェーズ → カテゴリ/アイテム選択
    // ========================================================================

    describe('loot phase transitions', () => {
        beforeEach(() => {
            core.emit('inputRequired', makeActionPromptPayload());
            core.emit('inputRequired', makeContentsViewPayload([]));
            core.emit('inputRequired', makeActionPromptPayload());
            core.respond.mockClear();
        });

        it('should transition TAKING_OUT → CATEGORY_SELECT', () => {
            fsm.selectAction(ContainerAction.TAKE_OUT);
            core.emit('inputRequired', makeCategorySelectPayload('out'));
            expect(fsm.state).toBe(ContainerState.CATEGORY_SELECT);
        });

        it('should transition PUTTING_IN → ITEM_SELECT', () => {
            fsm.selectAction(ContainerAction.PUT_IN);
            core.emit('inputRequired', makeItemSelectPayload('in'));
            expect(fsm.state).toBe(ContainerState.ITEM_SELECT);
        });

        it('should return to ACTION_PROMPT after loot phase completes', () => {
            fsm.selectAction(ContainerAction.TAKE_OUT);
            // C コアがアイテム選択後に再度アクション選択を表示
            core.emit('inputRequired', makeActionPromptPayload());
            expect(fsm.state).toBe(ContainerState.ACTION_PROMPT);
        });
    });

    // ========================================================================
    // BoH 爆発検知
    // ========================================================================

    describe('explosion detection', () => {
        beforeEach(() => {
            core.emit('inputRequired', makeActionPromptPayload());
            core.emit('inputRequired', makeContentsViewPayload([]));
            core.emit('inputRequired', makeActionPromptPayload());
        });

        it('should detect explosion from English message', () => {
            const events = [];
            core.on('containerTransaction', (data) => events.push(data));

            core.emit('message', 'As you put the wand inside, you are blasted by a magical explosion!');

            expect(fsm.state).toBe(ContainerState.IDLE);
            const explosionEvent = events.find(e => e.state === ContainerState.EXPLODED);
            expect(explosionEvent).toBeDefined();
        });

        it('should ignore unrelated messages', () => {
            core.emit('message', 'You see a potion here.');
            expect(fsm.state).toBe(ContainerState.ACTION_PROMPT);
        });
    });

    // ========================================================================
    // checkSafety() — セーフティチェック
    // ========================================================================

    describe('checkSafety()', () => {
        it('should assess items against current container', () => {
            core.emit('inputRequired', makeActionPromptPayload('the bag of holding'));
            core.emit('inputRequired', makeContentsViewPayload([]));
            core.emit('inputRequired', makeActionPromptPayload('the bag of holding'));

            const result = fsm.checkSafety([
                { onum: 263, rawText: 'a wand of cancellation (0:5)' },
                { onum: 100, rawText: 'a +2 long sword' },
            ]);

            expect(result.hasDanger).toBe(true);
            expect(result.critical).toHaveLength(1);
            expect(result.safe).toHaveLength(1);
        });
    });

    // ========================================================================
    // getSnapshot() / isActive() / abort()
    // ========================================================================

    describe('getSnapshot()', () => {
        it('should return current FSM state', () => {
            const snap = fsm.getSnapshot();
            expect(snap.state).toBe(ContainerState.IDLE);
            expect(snap.enabled).toBe(true);
        });
    });

    describe('isActive()', () => {
        it('should return false when IDLE', () => {
            expect(fsm.isActive()).toBe(false);
        });

        it('should return true when in a transaction', () => {
            core.emit('inputRequired', makeActionPromptPayload());
            expect(fsm.isActive()).toBe(true);
        });
    });

    describe('abort()', () => {
        it('should reset to IDLE', () => {
            core.emit('inputRequired', makeActionPromptPayload());
            core.emit('inputRequired', makeContentsViewPayload([]));
            core.emit('inputRequired', makeActionPromptPayload());

            fsm.abort();
            expect(fsm.state).toBe(ContainerState.IDLE);
            expect(core.respond).toHaveBeenCalledWith('q'.charCodeAt(0));
        });

        it('should be no-op when already IDLE', () => {
            core.respond.mockClear();
            fsm.abort();
            expect(core.respond).not.toHaveBeenCalled();
        });
    });

    // ========================================================================
    // containerTransaction イベント通知
    // ========================================================================

    describe('containerTransaction events', () => {
        it('should emit events on state transitions', () => {
            const events = [];
            core.on('containerTransaction', (data) => events.push(data));

            core.emit('inputRequired', makeActionPromptPayload('the bag of holding'));
            // INTERCEPTING → PREFETCHING_CONTENTS
            expect(events.length).toBeGreaterThanOrEqual(1);

            const interceptEvent = events.find(e => e.state === ContainerState.INTERCEPTING);
            expect(interceptEvent).toBeDefined();
            expect(interceptEvent.containerName).toBe('the bag of holding');
        });

        it('should include container snapshot in events', () => {
            const events = [];
            core.on('containerTransaction', (data) => events.push(data));

            core.emit('inputRequired', makeActionPromptPayload('the bag of holding'));

            const actionEvent = events.find(e => e.state === ContainerState.ACTION_PROMPT);
            expect(actionEvent).toBeDefined();
            expect(actionEvent.isBagOfHolding).toBe(true);
        });
    });

    // ========================================================================
    // transferItems 自動消化パイプライン
    // ========================================================================

    describe('transferItems auto-resolution pipeline', () => {
        function setupActionPrompt(containerName = 'the sack') {
            core.emit('inputRequired', makeActionPromptPayload(containerName));
            core.emit('inputRequired', makeContentsViewPayload([]));
            core.emit('inputRequired', makeActionPromptPayload(containerName));
            expect(fsm.state).toBe(ContainerState.ACTION_PROMPT);
            core.respond.mockClear();
        }

        it('投入 (direction: in): openPrefix を送信し動的対話パイプラインを開始すること (\\r を送らない)', () => {
            setupActionPrompt();
            fsm._lastAppliedLetter = 'e';

            const success = fsm.transferItems({
                direction: 'in',
                items: [{ letter: 'i', count: 1, rawText: 'a food ration' }],
            });
            expect(success).toBe(true);
            const runner = core.executeSequence.mock.calls.length > 0 ? core.executeSequence : core.querySequenceSilent;
            expect(runner).toHaveBeenCalledWith(['a', 'e']);
            expect(fsm.state).toBe(ContainerState.PUTTING_IN);
        });

        it('取り出し (direction: out): openPrefix を送信し動的対話パイプラインを開始すること (\\r を送らない)', () => {
            setupActionPrompt();
            fsm._lastAppliedLetter = 'e';

            const success = fsm.transferItems({
                direction: 'out',
                items: [{ letter: 'a', rawText: 'a potion' }],
            });
            expect(success).toBe(true);
            const runner = core.executeSequence.mock.calls.length > 0 ? core.executeSequence : core.querySequenceSilent;
            expect(runner).toHaveBeenCalledWith(['a', 'e']);
            expect(fsm.state).toBe(ContainerState.TAKING_OUT);
        });

        it('アイテムがメニューに見つからない場合は 0 (キャンセル) を返答する', () => {
            setupActionPrompt();

            fsm.transferItems({
                direction: 'in',
                items: [{ letter: 'z', rawText: 'non-existent item' }],
            });
            core.respond.mockClear();

            const itemPayload = {
                ...makeItemSelectPayload('in'),
                items: [
                    { identifier: 11111, accelerator: 'a', str: 'a dagger' },
                ],
            };
            core.emit('inputRequired', itemPayload);
            expect(core.respond).toHaveBeenCalledWith(0);
        });

        it('BoH に CRITICAL 危険アイテムを投入しようとした場合は transferItems が拒絶(false)される', () => {
            setupActionPrompt('the bag of holding');

            const success = fsm.transferItems({
                direction: 'in',
                items: [
                    { onum: 263, spe: 1, rawText: 'a wand of cancellation' },
                ],
            });
            expect(success).toBe(false);
            expect(core.respond).not.toHaveBeenCalled();
        });

        it('ACTION_PROMPT 状態以外では transferItems が拒絶(false)される', () => {
            expect(fsm.state).toBe(ContainerState.IDLE);
            const success = fsm.transferItems({
                direction: 'in',
                items: [{ letter: 'a' }],
            });
            expect(success).toBe(false);
        });

        it('display_nhwindow 由来の lines から中身をパースして contentsManager に保持できること', () => {
            const lines = [
                'Contents of the large box:',
                '',
                '  a food ration',
                '  6 uncursed daggers',
            ];
            const updated = fsm.contentsManager.updateFromLines(lines);

            expect(updated).toBe(true);
            expect(fsm.contentsManager.items).toHaveLength(2);
            expect(fsm.contentsManager.items[0].name).toBe('food ration');
            expect(fsm.contentsManager.items[1].count).toBe(6);
        });

        it('ITEM_SELECT 解決時に同一 identifier が二重に選択されることを防止する (Double Free防止)', () => {
            setupActionPrompt('the large box');

            // 2つの target が同じメニューアイテムにマッチしそうな状況
            fsm.transferItems({
                direction: 'in',
                items: [
                    { identifier: 99999, rawText: 'a dagger', name: 'dagger' },
                    { identifier: 99999, rawText: 'a dagger', name: 'dagger' },
                ],
            });

            core.respond.mockClear();

            // カテゴリ選択自動通過
            core.emit('inputRequired', {
                category: 'MENU',
                promptCategory: 'MENU',
                rawPrompt: 'Put in what type of objects?',
                items: [{ identifier: -2, accelerator: 'a', str: 'All types' }],
            });

            // アイテム選択メニュー
            core.emit('inputRequired', {
                category: 'MENU',
                promptCategory: 'MENU',
                rawPrompt: 'Put in what?',
                items: [
                    { identifier: 99999, accelerator: 'a', str: 'a - a dagger' },
                ],
            });

            // selectedResponses に同じ identifier は 1 回だけ含まれる
            expect(core.respond).toHaveBeenCalledWith([
                { identifier: 99999, count: -1 },
            ]);
        });

        it('ITEM_SELECT 解決時に装備中アイテムや開いているコンテナ自身が除外される', () => {
            setupActionPrompt('the large box');

            fsm.transferItems({
                direction: 'in',
                items: [
                    { identifier: 1001, isWielded: true, rawText: 'a long sword (weapon in hand)' },
                    { identifier: 1002, isWorn: true, rawText: 'a ring mail (being worn)' },
                    { identifier: 1003, name: 'the large box', rawText: 'a large box' },
                    { identifier: 1004, rawText: 'an apple' },
                ],
            });

            // カテゴリ選択
            core.emit('inputRequired', {
                rawPrompt: 'Put in what type of objects?',
                items: [{ identifier: -2, accelerator: 'a', str: 'All types' }],
            });

            core.respond.mockClear();

            // アイテム選択
            core.emit('inputRequired', {
                rawPrompt: 'Put in what?',
                items: [
                    { identifier: 1001, accelerator: 'a', str: 'a - a long sword (weapon in hand)' },
                    { identifier: 1002, accelerator: 'b', str: 'b - a ring mail (being worn)' },
                    { identifier: 1003, accelerator: 'c', str: 'c - a large box' },
                    { identifier: 1004, accelerator: 'd', str: 'd - an apple' },
                ],
            });

            // apple (1004) だけが選択される
            expect(core.respond).toHaveBeenCalledWith([
                { identifier: 1004, count: -1 },
            ]);
        });

        it('転送完了後に通常ターン (poskey) を受信した際、セッションが維持されて ACTION_PROMPT に復帰すること', () => {
            setupActionPrompt('the large box');

            // 1回目のアイテム投入
            fsm.transferItems({
                direction: 'in',
                items: [{ identifier: 1001, rawText: 'a food ration', name: 'food ration' }],
            });

            // カテゴリ選択 → アイテム選択
            core.emit('inputRequired', {
                rawPrompt: 'Put in what type of objects?',
                items: [{ identifier: -2, accelerator: 'a', str: 'All types' }],
            });
            core.emit('inputRequired', {
                rawPrompt: 'Put in what?',
                items: [{ identifier: 1001, accelerator: 'a', str: 'a food ration' }],
            });

            let transitionEvent = null;
            core.on('containerTransaction', (data) => {
                transitionEvent = data;
            });

            // NetHack C コアがアイテム投入を完了し、通常ターン (poskey) に復帰
            core.emit('inputRequired', {
                context: 'poskey',
                type: 'poskey',
                promptCategory: 'POSKEY',
            });

            // セッションが維持され、ACTION_PROMPT に復帰して再描画通知が届く
            expect(fsm.state).toBe(ContainerState.ACTION_PROMPT);
            expect(transitionEvent).not.toBeNull();
            expect(transitionEvent.state).toBe(ContainerState.ACTION_PROMPT);
            expect(transitionEvent.contents).toBeDefined();
        });

        it('2回目の個別操作時、poskey 状態からオンデマンドシーケンスが一括実行されること', () => {
            setupActionPrompt('the sack');
            fsm._lastAppliedLetter = 'f';

            // 1回目の操作完了で poskey に戻った状態
            core.emit('inputRequired', {
                context: 'poskey',
                type: 'poskey',
                promptCategory: 'POSKEY',
            });
            expect(fsm.state).toBe(ContainerState.ACTION_PROMPT);

            core.executeSequence.mockClear();
            core.querySequenceSilent.mockClear();

            // 2回目の個別操作 (取り出し)
            const success = fsm.transferItems({
                direction: 'out',
                items: [{ identifier: 2001, letter: 'a', rawText: 'a food ration' }],
            });
            expect(success).toBe(true);

            // poskey からは openPrefix (['a', 'f']) が送出され動的パイプラインが動く
            const runner = core.executeSequence.mock.calls.length > 0 ? core.executeSequence : core.querySequenceSilent;
            expect(runner).toHaveBeenCalledWith(['a', 'f']);
        });

        it('床のコンテナに対して transferItems を実行した場合、loot プレフィックスが実行されること', () => {
            setupActionPrompt('the chest');
            fsm._lastAppliedLetter = '.';

            // poskey 状態へ
            core.emit('inputRequired', {
                context: 'poskey',
                type: 'poskey',
                promptCategory: 'POSKEY',
            });

            core.executeSequence.mockClear();
            core.querySequenceSilent.mockClear();

            const success = fsm.transferItems({
                direction: 'in',
                items: [{ identifier: 3001, letter: 'g', rawText: 'a gold piece' }],
            });
            expect(success).toBe(true);

            // 床コンテナ用のプレフィックスが実行される
            const runner = core.executeSequence.mock.calls.length > 0 ? core.executeSequence : core.querySequenceSilent;
            expect(runner).toHaveBeenCalledWith(['#', 'loot', '\r', '.']);
        });

        it('closeSession() を呼んだ際、セッションが安全に終了し IDLE に復帰すること', () => {
            setupActionPrompt('the sack');
            expect(fsm._sessionActive).toBe(true);

            fsm.closeSession();
            expect(fsm.state).toBe(ContainerState.IDLE);
            expect(fsm._sessionActive).toBe(false);
        });

        it('長押しや右クリック (i + letter) などの非 apply コマンドではコンテナUIが起動しないこと', () => {
            // ユーザーが長押し/右クリックで 'i', 'f' を送出
            core.emit('userActionSent', { sequence: ['i', 'f'] });
            expect(fsm._isApplyActive).toBe(false);

            // インベントリアクションメニュー (drop, name などが含まれる) が届く
            core.emit('inputRequired', {
                category: 'MENU',
                promptCategory: 'MENU',
                rawPrompt: 'Do what with the sack?',
                items: [
                    { accelerator: ':', str: 'Look inside the sack' },
                    { accelerator: 'i', str: 'put something in' },
                    { accelerator: 'd', str: 'drop the sack' },
                    { accelerator: 'C', str: 'name the sack' },
                ],
            });

            // FSM は横取りせず IDLE のままであること
            expect(fsm.state).toBe(ContainerState.IDLE);
            expect(core.respond).not.toHaveBeenCalled();
        });

        it('transferItems (ACTION_PROMPT 待機中): poskey から一括アトミックシーケンスが executeSequence で実行されること', () => {
            fsm._sessionActive = true;
            fsm.state = ContainerState.ACTION_PROMPT;
            fsm._lastAppliedLetter = 'e';
            fsm.contentsManager.openContainer({ name: 'sack' });

            const itemsToPut = [
                { letter: 'f', name: 'food ration' },
                { letter: 'w', name: 'dagger', isWielded: true }, // 装備中（除外対象）
            ];

            core.executeSequence.mockClear();
            core.querySequenceSilent.mockClear();
            const result = fsm.transferItems({ direction: 'in', items: itemsToPut });
            expect(result).toBe(true);

            // openPrefix が実行されること
            const runner = core.executeSequence.mock.calls.length > 0 ? core.executeSequence : core.querySequenceSilent;
            expect(runner).toHaveBeenCalledWith(['a', 'e']);
        });

        it('syncContentsSilent: 空であることが確定している場合は無駄な Look inside (:) を抑止すること', async () => {
            core.querySequenceSilent = vi.fn().mockResolvedValue([]);
            fsm._lastAppliedLetter = 'e';
            fsm.contentsManager.openContainer({ name: 'sack' });
            fsm.contentsManager.isEmpty = true;
            fsm.contentsManager.items = [];

            const result = await fsm.syncContentsSilent();
            expect(result).toBe(true);
            expect(core.querySequenceSilent).not.toHaveBeenCalled();

            // force: true の場合は空でも送出する ('o' + 'a' + ESC)
            await fsm.syncContentsSilent({ force: true });
            expect(core.querySequenceSilent).toHaveBeenCalledWith(['a', 'e', 'o', 'a', '\x1b']);
        });

        it('transferItems (TAKE_OUT): openPrefix が実行され、中身が更新されること', () => {
            setupActionPrompt('the sack');
            fsm._lastAppliedLetter = 'e';
            fsm.contentsManager.openContainer({ name: 'sack' });
            fsm.contentsManager.items = [{ letter: 'a', identifier: 2001, name: 'food ration' }];
            fsm.contentsManager.isEmpty = false;

            core.executeSequence.mockClear();
            core.querySequenceSilent.mockClear();
            const result = fsm.transferItems({
                direction: 'out',
                items: [{ letter: 'a', identifier: 2001, name: 'food ration' }]
            });
            expect(result).toBe(true);
            const runner = core.executeSequence.mock.calls.length > 0 ? core.executeSequence : core.querySequenceSilent;
            expect(runner).toHaveBeenCalledWith(['a', 'e']);
            expect(fsm.contentsManager.items).toHaveLength(0);
            expect(fsm.contentsManager.isEmpty).toBe(true);
        });

        it('transferItems (PUT_IN): openPrefix が実行され、中身キャッシュに追加されること', () => {
            setupActionPrompt('the sack');
            fsm._lastAppliedLetter = 'e';
            fsm.contentsManager.openContainer({ name: 'sack' });
            fsm.contentsManager.isEmpty = true;
            fsm.contentsManager.items = [];

            core.executeSequence.mockClear();
            core.querySequenceSilent.mockClear();
            const result = fsm.transferItems({
                direction: 'in',
                items: [{ letter: 'f', identifier: 3001, name: 'food ration', rawText: 'a food ration' }]
            });
            expect(result).toBe(true);
            const runner = core.executeSequence.mock.calls.length > 0 ? core.executeSequence : core.querySequenceSilent;
            expect(runner).toHaveBeenCalledWith(['a', 'e']);
            expect(fsm.contentsManager.items).toHaveLength(1);
            expect(fsm.contentsManager.isEmpty).toBe(false);
        });

        it('床コンテナ (#loot / 箱): executeSequence に #loot プレフィックスが含まれること', () => {
            fsm._sessionActive = true;
            fsm.state = ContainerState.ACTION_PROMPT;
            fsm._lastAppliedLetter = '.'; // 床
            fsm._containerContext = { isFloorContainer: true };
            fsm.contentsManager.openContainer({ name: 'large box' });
            fsm.contentsManager.items = [{ letter: '$', identifier: 4001, name: '20 gold pieces' }];
            fsm.contentsManager.isEmpty = false;

            core.executeSequence.mockClear();
            core.querySequenceSilent.mockClear();
            const result = fsm.transferItems({
                direction: 'out',
                items: [{ letter: '$', identifier: 4001, name: '20 gold pieces' }]
            });
            expect(result).toBe(true);
            const runner = core.executeSequence.mock.calls.length > 0 ? core.executeSequence : core.querySequenceSilent;
            expect(runner).toHaveBeenCalled();
            const seq = runner.mock.calls[0][0];
            expect(seq[0]).toBe('#');
            expect(seq[1]).toBe('loot');
        });

        it('validatePutIn: 自分自身・装備中・BoH危険物を正しく判定すること', () => {
            fsm._lastAppliedLetter = 'e';
            fsm.contentsManager.openContainer({ name: 'bag of holding', onum: 100 });

            // 1. 自分自身 (letter 一致)
            const selfItem = { letter: 'e', name: 'bag of holding', onum: 100 };
            expect(fsm.validatePutIn(selfItem)).toEqual({ valid: false, reason: 'SELF_CONTAINER' });

            // 2. 装備中アイテム
            const equippedItem = { letter: 'a', name: 'short sword', isWielded: true };
            expect(fsm.validatePutIn(equippedItem)).toEqual({ valid: false, reason: 'EQUIPPED' });

            // 3. BoH 確定危険物 (打ち消しの杖)
            const wand = { letter: 'w', name: 'wand of cancellation', onum: 263 };
            expect(fsm.validatePutIn(wand)).toEqual({ valid: false, reason: 'BOH_CRITICAL' });

            // 4. 有効な通常アイテム
            const food = { letter: 'f', name: 'food ration' };
            expect(fsm.validatePutIn(food)).toEqual({ valid: true, reason: null });
        });

        it('waitForCompletion: transferItems 実行後、C コアが poskey に着地した時点で Promise が解決すること', async () => {
            fsm.state = ContainerState.ACTION_PROMPT;
            fsm._sessionActive = true;
            fsm._actionPromptPayload = { context: 'yn_function', prompt: 'Do what with sack?' };

            const started = fsm.transferItems({
                direction: 'in',
                items: [{ letter: 'f', name: 'food ration', count: 1 }],
            });
            expect(started).toBe(true);

            // Promise を取得
            const completionPromise = fsm.waitForCompletion(1000);

            // C コアから poskey が返る
            core.emit('inputRequired', { context: 'poskey', type: 'poskey' });

            const result = await completionPromise;
            expect(result.success).toBe(true);
            expect(fsm.state).toBe(ContainerState.ACTION_PROMPT);
        });

        it('内部差分更新: アイテム投入時に inventoryStateManager からアイテムが減少し、取出時に増加すること', () => {
            const mockInvManager = {
                items: [
                    { letter: 'a', name: 'apple', count: 3 },
                    { letter: 'f', name: 'food ration', count: 1 },
                ],
            };
            fsm.inventoryStateManager = mockInvManager;

            // 投入 (remove)
            fsm._updateInventoryDiff('remove', { letter: 'a', count: 1 });
            expect(mockInvManager.items.find(it => it.letter === 'a').count).toBe(2);

            fsm._updateInventoryDiff('remove', { letter: 'f', count: 1 });
            expect(mockInvManager.items.find(it => it.letter === 'f')).toBeUndefined();

            // 取出 (add)
            fsm._updateInventoryDiff('add', { letter: 'd', name: 'dagger', count: 1 });
            const added = mockInvManager.items.find(it => it.name === 'dagger');
            expect(added).toBeDefined();
            expect(added.count).toBe(1);
        });

        it('【課題①】床の箱アイテム送信後 (ITEM_SENT) に ACTION_MENU が届いた際、直ちに (q) を送信して poskey 着地すること', async () => {
            // コンテナオープン & ACTION_PROMPT へ遷移
            core.emit('inputRequired', makeActionPromptPayload('the chest'));
            core.emit('inputRequired', makeCategorySelectPayload('out'));
            core.emit('inputRequired', makeItemSelectPayload('out'));
            core.emit('inputRequired', makeActionPromptPayload('the chest'));

            // 転送開始 (Take Out)
            fsm.transferItems({
                direction: 'out',
                items: [{ letter: 'a', identifier: 101, name: 'dagger', count: 1 }],
            });

            // 床の箱オープンプロンプト (#loot) をシミュレート
            core.respond.mockClear();
            core.emit('inputRequired', makeActionPromptPayload('the chest'));
            // 初動の 'o' が送出されているはず
            expect(core.respond).toHaveBeenCalledWith('o'.charCodeAt(0));

            // カテゴリ選択
            core.emit('inputRequired', makeCategorySelectPayload('out'));

            // アイテム選択
            core.emit('inputRequired', {
                ...makeItemSelectPayload('out'),
                items: [{ identifier: 101, charStr: 'a', str: 'a dagger' }],
            });

            // phase は ITEM_SENT に移行し、応答が送られた
            expect(fsm._pendingTransfer.phase).toBe('ITEM_SENT');

            // C コアから再度 ACTION_MENU が戻ってくる
            core.respond.mockClear();
            core.emit('inputRequired', makeActionPromptPayload('the chest'));

            // 二重送信せず、'q' (Leave it alone) を送信して use_container ループを抜けること
            expect(core.respond).toHaveBeenCalledWith('q'.charCodeAt(0));
            expect(fsm._pendingTransfer).toBeNull();

            // poskey 受信で完了
            core.emit('inputRequired', { context: 'poskey', type: 'poskey' });
            expect(fsm.state).toBe(ContainerState.ACTION_PROMPT);
            expect(fsm.lastTransactionDebug.status).toBe('SUCCESS');
        });

        it('【課題②】スタックアイテム転送時、指定数量または全量がメニュー応答の count に明示設定されること', () => {
            // コンテナオープン & ACTION_PROMPT へ遷移
            core.emit('inputRequired', makeActionPromptPayload('the sack'));
            core.emit('inputRequired', makeCategorySelectPayload('out'));
            core.emit('inputRequired', makeItemSelectPayload('out'));
            core.emit('inputRequired', makeActionPromptPayload('the sack'));

            // 1. 指定数量 (3個)
            fsm.transferItems({
                direction: 'in',
                items: [{ letter: 'd', identifier: 202, name: 'daggers', count: 3, rawText: '6 uncursed daggers' }],
            });

            // 初動 'i'
            core.emit('inputRequired', makeActionPromptPayload('the sack'));
            core.emit('inputRequired', makeCategorySelectPayload('in'));

            core.respond.mockClear();
            core.emit('inputRequired', {
                ...makeItemSelectPayload('in'),
                items: [{ identifier: 202, charStr: 'd', str: '6 uncursed daggers' }],
            });

            expect(core.respond).toHaveBeenCalledWith([
                { identifier: 202, count: 3 },
            ]);
        });

        it('【課題②】C コアが COUNT_PROMPT (How many?) を求めてきた場合、指定数量で自動応答すること', () => {
            core.emit('inputRequired', makeActionPromptPayload('the sack'));
            core.emit('inputRequired', makeCategorySelectPayload('out'));
            core.emit('inputRequired', makeItemSelectPayload('out'));
            core.emit('inputRequired', makeActionPromptPayload('the sack'));

            fsm.transferItems({
                direction: 'in',
                items: [{ letter: 'd', identifier: 202, name: 'daggers', count: 5 }],
            });

            core.respond.mockClear();
            core.emit('inputRequired', {
                rawPrompt: 'How many daggers?',
                prompt: 'How many daggers?',
                context: 'getlin',
            });

            expect(core.respond).toHaveBeenCalledWith('5\n');
        });

        it('【課題③】ContainerContentsManager が reindexLetters により連続再採番し、部分取り出しで数量減算すること', () => {
            const cm = fsm.contentsManager;
            cm.openContainer({ name: 'chest' });

            // 1. アイテム投入
            cm.onItemPutIn({ letter: 'x', name: 'food ration', count: 2 });
            cm.onItemPutIn({ letter: 'y', name: 'dagger', count: 6 });

            // レターは移動元の 'x', 'y' ではなく 'a', 'b' に連続再採番される
            expect(cm.items[0].letter).toBe('a');
            expect(cm.items[0].accelerator).toBe('a');
            expect(cm.items[1].letter).toBe('b');
            expect(cm.items[1].accelerator).toBe('b');

            // 2. 部分取り出し (6個中2個取り出し)
            cm.onItemTakenOut({ letter: 'b', name: 'dagger', count: 2 });
            expect(cm.items.length).toBe(2);
            expect(cm.items[1].count).toBe(4);
            expect(cm.items[1].letter).toBe('b');

            // 3. 全量取り出し (残り4個を取り出し)
            cm.onItemTakenOut({ letter: 'b', name: 'dagger', count: 4 });
            expect(cm.items.length).toBe(1);
            expect(cm.items[0].letter).toBe('a');
            expect(cm.items[0].name).toBe('food ration');
        });
    });
});



