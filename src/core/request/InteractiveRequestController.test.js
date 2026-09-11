/**
 * InteractiveRequestController.test.js
 * 
 * InteractiveRequestController (汎用連続リクエストコントローラ) 単体・結合テスト
 * 
 * 【テストカテゴリ】
 * 1. モードA: 従来配列渡し互換 (後方互換性 100% 保証)
 * 2. モードB: スクリプト・レシピ型動的対話 (シグナル同定・分岐・データ抽出・until完了)
 * 3. セーフティガード: タイムアウト時 ESC 自動復帰 (デッドロック防止)
 * 4. 実機等価エミュレーション: 本物 NetHackWasmDriver + C-Shim による結合検証
 * 5. WebUICore 経由の委譲結合テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractiveRequestController } from './InteractiveRequestController.js';
import { SignalDetector } from '../prompt/SignalDetector.js';
import { WebUICore } from '../WebUICore.js';
import { NetHackWasmDriver } from '../../driver/NetHackWasmDriver.js';
import '../../driver/InputResolver.js';

describe('InteractiveRequestController (汎用連続リクエストコントローラ)', () => {
    let mockDriver;
    let signalDetector;
    let controller;

    beforeEach(() => {
        mockDriver = {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
            queueSequence: vi.fn(),
            cancelSequence: vi.fn(),
            sendKey: vi.fn(),
            activeResolver: null
        };
        signalDetector = SignalDetector.createDefault();
        controller = new InteractiveRequestController({
            driver: mockDriver,
            signalDetector
        });
    });

    // =========================================================================
    // 1. モードA: 従来配列渡し互換テスト
    // =========================================================================
    describe('1. モードA: 従来配列渡し互換 (後方互換性)', () => {
        it('querySequenceSilent: 配列渡し時に driver.queueSequence を呼び、バッファ配列をそのまま返却すること', async () => {
            const expectedBuffer = [
                { type: 'putstr', text: 'a - an uncursed +1 dagger' },
                { type: 'putstr', text: 'b - 2 apples' }
            ];
            mockDriver.queueSequence.mockResolvedValue(expectedBuffer);

            const tokens = ['i', ' ', '\x1b'];
            const options = { syncType: 'inventory' };

            const result = await controller.querySequenceSilent(tokens, options);

            expect(mockDriver.queueSequence).toHaveBeenCalledWith(tokens, {
                suppressPrompts: true,
                isSilentSync: true,
                syncType: 'inventory'
            });
            expect(result).toEqual(expectedBuffer);
            expect(controller.getState()).toBe(InteractiveRequestController.State.IDLE);
        });

        it('querySequenceSilent: 空配列や無効な引数の場合は空配列を返却し Driver を呼ばないこと', async () => {
            const result1 = await controller.querySequenceSilent([]);
            expect(result1).toEqual([]);
            expect(mockDriver.queueSequence).not.toHaveBeenCalled();

            const result2 = await controller.querySequenceSilent(null);
            expect(result2).toEqual([]);
        });

        it('executeSequence: 配列渡し時に driver.queueSequence を呼び、boolean (true) を返却すること', async () => {
            mockDriver.queueSequence.mockResolvedValue([]);
            const result = await controller.executeSequence(['k']);

            expect(mockDriver.queueSequence).toHaveBeenCalledWith(['k'], {});
            expect(result).toBe(true);
            expect(controller.getState()).toBe(InteractiveRequestController.State.IDLE);
        });
    });

    // =========================================================================
    // 2. モードB: スクリプト・レシピ型動的対話テスト
    // =========================================================================
    describe('2. モードB: スクリプト・レシピ型動的対話', () => {
        it('シグナル同定・動的ハンドラ分岐・データ抽出・until 完了が正常に行われること', async () => {
            // イベントリスナーを保持する簡易エミュレータ
            const listeners = {};
            mockDriver.on = vi.fn((evt, fn) => {
                listeners[evt] = fn;
            });
            mockDriver.off = vi.fn((evt, fn) => {
                if (listeners[evt] === fn) delete listeners[evt];
            });

            const recipe = {
                start: ['a', 'e'],
                handlers: [
                    {
                        // コンテナルートメニューで中身があれば 'o' (Take out) を選択
                        match: {
                            subCategory: 'CONTAINER_ACTION_MENU',
                            type: 'menu'
                        },
                        action: (ctx) => {
                            if (ctx.hasMenuItem('o')) return 'o';
                            return 'q';
                        }
                    },
                    {
                        // 取り出しアイテム一覧からデータを抽出し、ESC で抜ける
                        match: {
                            prompt: /Take out what/i
                        },
                        action: (ctx) => {
                            ctx.data = ctx.menuItems.map(it => ({
                                name: it.str,
                                count: it.count || 1
                            }));
                            ctx.state = 'ITEMS_EXTRACTED';
                            return '\x1b';
                        }
                    }
                ],
                until: { type: 'turn_ready' },
                timeoutMs: 1000
            };

            // レシピ開始時点で通常ターン (poskey) 待機状態をシミュレート
            const resolverTurnStart = { respond: vi.fn() };
            mockDriver.activeResolver = resolverTurnStart;

            const executePromise = controller.querySequenceSilent(recipe);

            // 初動キー 'a' が直ちに activeResolver に投入されること
            expect(resolverTurnStart.respond).toHaveBeenCalledWith('a');

            // Step 1: 'a' 入力後のプロンプト (道具選択)
            const resolverApply = { respond: vi.fn() };
            listeners['inputRequired']({
                type: 'getlin',
                prompt: 'What do you want to use or apply? [e or ?*]',
                safeResolver: resolverApply
            });
            // startQueue に残っている 'e' が送出されること
            expect(resolverApply.respond).toHaveBeenCalledWith('e');

            // Step 2: 箱のアクションメニュー (CONTAINER_ROOT)
            const resolverMenu = { respond: vi.fn() };
            listeners['inputRequired']({
                type: 'menu',
                rawPrompt: 'Do what with your sack?',
                prompt: 'Do what with your sack?',
                items: [
                    { selector: 'o', str: 'Take out some items', charStr: 'o' },
                    { selector: 'i', str: 'Put in some items', charStr: 'i' }
                ],
                safeResolver: resolverMenu
            });
            // handlers により 'o' が動的に応答されること
            expect(resolverMenu.respond).toHaveBeenCalledWith('o');

            // Step 3: 取り出しアイテム選択画面
            const resolverItems = { respond: vi.fn() };
            listeners['inputRequired']({
                type: 'menu',
                rawPrompt: 'Take out what?',
                prompt: 'Take out what?',
                items: [
                    { selector: 'a', str: 'a blessed +1 dagger', count: 1 },
                    { selector: 'b', str: '2 food rations', count: 2 }
                ],
                safeResolver: resolverItems
            });
            // handlers により ESC が応答され、ctx.data に抽出されること
            expect(resolverItems.respond).toHaveBeenCalledWith('\x1b');

            // Step 4: 通常ターン復帰 (turn_ready / poskey)
            const resolverTurn = { respond: vi.fn() };
            listeners['inputRequired']({
                type: 'poskey',
                context: 'poskey',
                safeResolver: resolverTurn
            });
            // turn_ready にはキーを応答せずそのまま通常復帰させる
            expect(resolverTurn.respond).not.toHaveBeenCalled();

            const result = await executePromise;

            expect(result.success).toBe(true);
            expect(result.data).toEqual([
                { name: 'a blessed +1 dagger', count: 1 },
                { name: '2 food rations', count: 2 }
            ]);
            expect(controller.getState()).toBe(InteractiveRequestController.State.IDLE);
        });

        it('ctx.finish() で明示的に完了できること', async () => {
            const listeners = {};
            mockDriver.on = vi.fn((evt, fn) => { listeners[evt] = fn; });
            mockDriver.off = vi.fn((evt, fn) => { if (listeners[evt] === fn) delete listeners[evt]; });

            const recipe = {
                handlers: [
                    {
                        match: { prompt: /Single prompt/i },
                        action: (ctx) => {
                            ctx.finish({ extracted: 42 });
                            return ' ';
                        }
                    }
                ]
            };

            const executePromise = controller.querySequenceSilent(recipe);

            const resolver = { respond: vi.fn() };
            listeners['inputRequired']({
                type: 'text',
                prompt: 'Single prompt test',
                safeResolver: resolver
            });

            expect(resolver.respond).toHaveBeenCalledWith(' ');

            const result = await executePromise;
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ extracted: 42 });
        });
    });

    // =========================================================================
    // 3. セーフティガード: タイムアウト時 ESC 自動復帰テスト
    // =========================================================================
    describe('3. セーフティガード: タイムアウト時 ESC 自動復帰', () => {
        it('タイムアウト発生時に abortWithESC が発動し、ESC 連打が投入されて通常状態へ安全復帰すること', async () => {
            vi.useFakeTimers();

            const listeners = {};
            mockDriver.on = vi.fn((evt, fn) => { listeners[evt] = fn; });
            mockDriver.off = vi.fn((evt, fn) => { if (listeners[evt] === fn) delete listeners[evt]; });
            mockDriver.queueSequence.mockResolvedValue([]);

            const activeResolver = { respond: vi.fn() };
            mockDriver.activeResolver = activeResolver;

            const recipe = {
                start: ['a'],
                handlers: [],
                timeoutMs: 500
            };

            const executePromise = controller.querySequenceSilent(recipe);

            // タイムアウト時間を進める
            await vi.advanceTimersByTimeAsync(550);

            const result = await executePromise;

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error.message).toContain('timed out');

            // 1. 待機中だった activeResolver に ESC が応答されたこと
            expect(activeResolver.respond).toHaveBeenCalledWith('\x1b');

            // 2. ドライバの cancelSequence が呼ばれたこと
            expect(mockDriver.cancelSequence).toHaveBeenCalled();

            // 3. 安全復帰のための ESC 連打 (['\x1b', '\x1b', '\x1b']) が投入されたこと
            expect(mockDriver.queueSequence).toHaveBeenCalledWith(['\x1b', '\x1b', '\x1b'], {
                suppressPrompts: true,
                isSilentSync: true
            });

            // 4. 最終状態が IDLE に復帰していること
            expect(controller.getState()).toBe(InteractiveRequestController.State.IDLE);

            vi.useRealTimers();
        });
    });

    // =========================================================================
    // 4. 実機等価エミュレーション: 本物 NetHackWasmDriver + C-Shim 結合検証
    // =========================================================================
    describe('4. 実機等価エミュレーション (Headless C-Shim 駆動)', () => {
        it('本物の NetHackWasmDriver インスタンスを用いて、C-Shim 呼び出しからレシピ完走までデッドロックなく動作すること', async () => {
            const realDriver = new NetHackWasmDriver();
            realDriver.initSubModules();

            const irc = new InteractiveRequestController({
                driver: realDriver,
                signalDetector
            });

            const recipe = {
                start: ['a'],
                handlers: [
                    {
                        match: { prompt: /apply/i },
                        action: () => 'e'
                    },
                    {
                        match: { prompt: /Do what/i },
                        action: (ctx) => {
                            ctx.data = 'sack_handled';
                            return '\x1b';
                        }
                    }
                ],
                until: { type: 'turn_ready' },
                timeoutMs: 2000
            };

            // 1. 初動キー投入前の poskey 入力待ちをセット
            let poskeyPromise = realDriver.eventHook('shim_nh_poskey');
            expect(realDriver.activeResolver).toBeDefined();

            // 2. レシピ開始 (start: ['a'] が直ちに activeResolver に投入される)
            const recipePromise = irc.querySequenceSilent(recipe);

            // Cコアが 'a' を受け取る
            const keyReceived = await poskeyPromise;
            expect(keyReceived).toBe('a'.charCodeAt(0));

            // 3. Cコアが「What do you want to use or apply?」の getlin 入力待ちを発行
            const getlinPromise = realDriver.eventHook('shim_getlin', 'What do you want to use or apply?');
            // ハンドラが 'e' を自動応答し、C-Shim はステータスコード 0 を返却
            const getlinStatus = await getlinPromise;
            expect(getlinStatus).toBe(0);

            // 4. Cコアが「Do what with your sack?」のメニュー入力待ちを発行
            realDriver.menuBuffer[1] = {
                items: [
                    { isHeader: false, identifier: 1, accelerator: 'o', str: 'Take out some items' }
                ],
                prompt: 'Do what with your sack?'
            };
            const menuPromise = realDriver.eventHook('shim_select_menu', 1, 0);
            // ハンドラが '\x1b' を応答
            const menuResult = await menuPromise;
            expect(menuResult).toBeDefined();

            // 5. Cコアが通常ターン (poskey) に復帰
            const nextTurnPromise = realDriver.eventHook('shim_nh_poskey');

            const finalResult = await recipePromise;
            expect(finalResult.success).toBe(true);
            expect(finalResult.data).toBe('sack_handled');

            // 次のターン待ちが残っており、プレイヤーの入力が可能であること
            expect(realDriver.activeResolver).toBeDefined();
            realDriver.sendInput(32); // Space で通常ターンを解放
            await nextTurnPromise;
        });
    });

    // =========================================================================
    // 5. WebUICore 経由の委譲結合テスト
    // =========================================================================
    describe('5. WebUICore 統合検証', () => {
        it('WebUICore.querySequenceSilent および executeSequence が InteractiveRequestController に委譲されること', async () => {
            const core = new WebUICore({ driver: mockDriver });
            expect(core.interactiveController).toBeInstanceOf(InteractiveRequestController);

            // モードA: 配列渡し
            mockDriver.queueSequence.mockResolvedValue([{ type: 'putstr', text: 'inventory item' }]);
            const buffer = await core.querySequenceSilent(['i', ' ', '\x1b']);
            expect(buffer).toHaveLength(1);
            expect(mockDriver.queueSequence).toHaveBeenCalled();

            // executeSequence
            const execResult = await core.executeSequence(['k']);
            expect(execResult).toBe(true);
        });
    });
});
