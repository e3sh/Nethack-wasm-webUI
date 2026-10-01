import { describe, it, expect, vi } from 'vitest';
import { GamepadInputController } from '../GamepadInputController.js';
import { GamepadManager } from '../GamepadManager.js';

describe('GamepadInputController ユニットテストスイート', () => {
    it('物理キーが core.sendKey に透過ディスパッチされること', () => {
        const mockCore = {
            sendKey: vi.fn(),
            knowledge: null,
            requestController: null
        };
        const mockGpad = new GamepadManager();
        mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
            keys: ['Numpad6'],
            actions: [],
            signals: [],
            modifiers: { lb: false, rb: false, lt: false, rt: false },
            radial: null
        });

        const controller = new GamepadInputController({
            core: mockCore,
            gamepadManager: mockGpad
        });

        controller.pollAndDispatch('NORMAL', '', 1000);
        expect(mockCore.sendKey).toHaveBeenCalledWith('Numpad6');
    });

    it('ACTION:CONTEXT_PRIMARY で ContextActionEngine の最優先アクションが実行されること', async () => {
        const mockCore = {
            sendKey: vi.fn(),
            knowledge: {
                areaStateManager: {
                    getAreaState: vi.fn().mockReturnValue({ feet: { trap: null, stairsDown: true } })
                }
            },
            requestController: {
                executeRecipe: vi.fn()
            }
        };

        const mockEngine = {
            generateActions: vi.fn().mockReturnValue([
                { id: 'ACTION_STAIRS_DOWN', labelJa: '階段を降りる', key: '>' }
            ])
        };

        const mockGpad = new GamepadManager();
        mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
            keys: [],
            actions: ['ACTION:CONTEXT_PRIMARY'],
            signals: [],
            modifiers: { lb: false, rb: false, lt: false, rt: false },
            radial: null
        });

        const controller = new GamepadInputController({
            core: mockCore,
            gamepadManager: mockGpad,
            contextActionEngine: mockEngine
        });

        controller.pollAndDispatch('NORMAL', '', 1000);
        expect(mockEngine.generateActions).toHaveBeenCalled();
        expect(mockCore.sendKey).toHaveBeenCalledWith('>');
    });

    it('右ホイールでセクターを選択した場合、Aボタン(ACTION:CONTEXT_PRIMARY)で選択されたアクションが実行されること', async () => {
        const kickAction = { id: 'ACTION_KICK_DOOR', labelJa: '扉を蹴破る', key: 'k' };
        const openAction = { id: 'ACTION_OPEN_DOOR', labelJa: '扉を開ける', key: 'o' };

        const mockCore = {
            sendKey: vi.fn(),
            executeAction: vi.fn()
        };

        const mockGpad = new GamepadManager();
        mockGpad.radialPalette = {
            E: { labelJa: '扉を開ける', actionObj: openAction },
            NE: { labelJa: '扉を蹴破る', actionObj: kickAction }
        };

        // 1. スティックを NE (扉を蹴破る) に倒した状態
        mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
            keys: [],
            actions: [],
            signals: [],
            modifiers: { lb: false, rb: false, lt: false, rt: false },
            radial: {
                state: 'ENGAGED',
                currentSector: 'NE',
                radius: 0.9,
                angleDeg: 45
            }
        });

        const controller = new GamepadInputController({
            core: mockCore,
            gamepadManager: mockGpad
        });

        const selectSpy = vi.fn();
        controller.on('contextActionSelected', selectSpy);

        // スティック傾き検知
        controller.pollAndDispatch('NORMAL', '', 1000);
        expect(selectSpy).toHaveBeenCalledWith(kickAction);
        expect(controller.getPrimaryContextAction()).toBe(kickAction);

        // 2. その状態で A ボタン (ACTION:CONTEXT_PRIMARY) 押下
        mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
            keys: [],
            actions: ['ACTION:CONTEXT_PRIMARY'],
            signals: [],
            modifiers: { lb: false, rb: false, lt: false, rt: false },
            radial: null
        });

        controller.pollAndDispatch('NORMAL', '', 1016);
        expect(mockCore.executeAction).toHaveBeenCalledWith(kickAction);

        // 3. 移動キー入力で選択アクションがリセットされること
        mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
            keys: ['Numpad6'],
            actions: [],
            signals: [],
            modifiers: { lb: false, rb: false, lt: false, rt: false },
            radial: null
        });

        controller.pollAndDispatch('NORMAL', '', 1032);
        expect(mockCore.sendKey).toHaveBeenCalledWith('Numpad6');
        expect(controller._selectedContextAction).toBeNull();
    });

    it('ACTION:CONTEXT_PRIMARY でアクションが存在しない場合、足踏み (.) が送信されること', () => {
        const mockCore = {
            sendKey: vi.fn(),
            knowledge: {
                areaStateManager: {
                    getAreaState: vi.fn().mockReturnValue({ feet: {} })
                }
            }
        };

        const mockEngine = {
            generateActions: vi.fn().mockReturnValue([])
        };

        const mockGpad = new GamepadManager();
        mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
            keys: [],
            actions: ['ACTION:CONTEXT_PRIMARY'],
            signals: [],
            modifiers: { lb: false, rb: false, lt: false, rt: false },
            radial: null
        });

        const controller = new GamepadInputController({
            core: mockCore,
            gamepadManager: mockGpad,
            contextActionEngine: mockEngine
        });

        controller.pollAndDispatch('NORMAL', '', 1000);
        expect(mockCore.sendKey).toHaveBeenCalledWith('.');
    });

    it('SIGNAL:TOGGLE_INVENTORY で modalStack.toggleModal が呼び出され、イベントが発行されること', () => {
        const mockModalStack = {
            toggleModal: vi.fn()
        };
        const mockGpad = new GamepadManager();
        mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
            keys: [],
            actions: [],
            signals: ['SIGNAL:TOGGLE_INVENTORY'],
            modifiers: { lb: false, rb: false, lt: false, rt: false },
            radial: null
        });

        const controller = new GamepadInputController({
            core: {},
            gamepadManager: mockGpad,
            modalStack: mockModalStack
        });

        const toggleSpy = vi.fn();
        controller.on('toggleInventory', toggleSpy);

        controller.pollAndDispatch('NORMAL', '', 1000);
        expect(toggleSpy).toHaveBeenCalled();
        expect(mockModalStack.toggleModal).toHaveBeenCalledWith('paperdoll');
    });

    it('ラジアルパレットの更新とフリックイベントが発火すること', () => {
        const mockGpad = new GamepadManager();
        const radialData = {
            state: 'ENGAGED',
            currentSector: 'N',
            radius: 0.8,
            angleDeg: -90,
            flickTriggered: { sector: 'N', holdDuration: 100 },
            selectedItem: { id: 'QUAFF', label: '飲む' }
        };
        mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
            keys: [],
            actions: [],
            signals: [],
            modifiers: { lb: false, rb: false, lt: false, rt: false },
            radial: radialData
        });

        const controller = new GamepadInputController({
            core: {},
            gamepadManager: mockGpad
        });

        const updateSpy = vi.fn();
        const flickSpy = vi.fn();
        controller.on('radialUpdate', updateSpy);
        controller.on('radialFlick', flickSpy);

        controller.pollAndDispatch('NORMAL', '', 1000);
        expect(updateSpy).toHaveBeenCalledWith(radialData);
        expect(flickSpy).toHaveBeenCalledWith(radialData.flickTriggered);
    });

    describe('動的コンテキストマップ & Fail-Safe テスト', () => {
        it('UI状態に応じて resolveCurrentContext が正しく判定すること', () => {
            const mockModalStack = {
                hasOpenModal: vi.fn().mockReturnValue(false)
            };
            const mockCore = {
                currentPromptCategory: null
            };
            const controller = new GamepadInputController({
                core: mockCore,
                modalStack: mockModalStack
            });

            // 1. 通常状態
            expect(controller.resolveCurrentContext()).toBe('NORMAL');

            // 2. isInventoryOpen = true
            controller.setInventoryOpen(true);
            expect(controller.resolveCurrentContext()).toBe('MODAL_INVENTORY');
            controller.setInventoryOpen(false);

            // 3. modalStack にモーダルが開いている
            mockModalStack.hasOpenModal.mockReturnValue(true);
            expect(controller.resolveCurrentContext()).toBe('MODAL_INVENTORY');
            mockModalStack.hasOpenModal.mockReturnValue(false);

            // 4. 方向待ちプロンプト
            mockCore.currentPromptCategory = 'DIRECTION';
            expect(controller.resolveCurrentContext()).toBe('DIRECTION');

            // 5. YN プロンプト
            mockCore.currentPromptCategory = 'YN';
            expect(controller.resolveCurrentContext()).toBe('YN');
        });

        it('MODAL_INVENTORY 時、移動キーが遮断され、inventoryNav イベントが発火すること (Fail-Safe)', () => {
            const mockCore = {
                sendKey: vi.fn()
            };
            const mockGpad = new GamepadManager({ useSemantic: true });
            mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
                keys: [], // 移動キーは一切生成されない
                actions: [],
                signals: ['SIGNAL:INVENTORY_NEXT', 'SIGNAL:INVENTORY_SELECT'],
                modifiers: { lb: false, rb: false, lt: false, rt: false },
                radial: null
            });

            const controller = new GamepadInputController({
                core: mockCore,
                gamepadManager: mockGpad
            });
            controller.setInventoryOpen(true);

            const navSpy = vi.fn();
            controller.on('inventoryNav', navSpy);

            controller.pollAndDispatch(); // context 自動解決で MODAL_INVENTORY になる
            expect(mockGpad.pollSemanticInput).toHaveBeenCalledWith('MODAL_INVENTORY', '', expect.any(Number));
            expect(mockCore.sendKey).not.toHaveBeenCalled();
            expect(navSpy).toHaveBeenCalledWith({ type: 'next' });
            expect(navSpy).toHaveBeenCalledWith({ type: 'select' });
        });

        it('DIRECTION 時、Bボタンで Escape が sendKey に送出されること', () => {
            const mockCore = {
                sendKey: vi.fn(),
                currentPromptCategory: 'DIRECTION'
            };
            const mockGpad = new GamepadManager({ useSemantic: true });
            mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
                keys: ['Escape'],
                actions: [],
                signals: [],
                modifiers: { lb: false, rb: false, lt: false, rt: false },
                radial: null
            });

            const controller = new GamepadInputController({
                core: mockCore,
                gamepadManager: mockGpad
            });

            controller.pollAndDispatch();
            expect(mockGpad.pollSemanticInput).toHaveBeenCalledWith('DIRECTION', '', expect.any(Number));
            expect(mockCore.sendKey).toHaveBeenCalledWith('Escape');
        });

        it('コンテキスト遷移時に contextChanged イベントが発火すること', () => {
            const mockCore = {
                currentPromptCategory: null
            };
            const mockGpad = new GamepadManager({ useSemantic: true });
            mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
                keys: [],
                actions: [],
                signals: [],
                modifiers: { lb: false, rb: false, lt: false, rt: false },
                radial: null
            });

            const controller = new GamepadInputController({
                core: mockCore,
                gamepadManager: mockGpad
            });

            const contextChangedSpy = vi.fn();
            controller.on('contextChanged', contextChangedSpy);

            // 初回 (NORMAL) -> 変化なし (初期値NORMALのため)
            controller.pollAndDispatch();
            expect(contextChangedSpy).not.toHaveBeenCalled();

            // DIRECTION へ遷移
            mockCore.currentPromptCategory = 'DIRECTION';
            controller.pollAndDispatch();
            expect(contextChangedSpy).toHaveBeenCalledWith({ previous: 'NORMAL', current: 'DIRECTION' });
        });

        it('isDialogOpen または modalManager.isAnyModalOpen で DIALOG コンテキストが解決され、dialogNav/Submit/Cancel イベントが発行されること', () => {
            const mockModalManager = {
                isAnyModalOpen: vi.fn().mockReturnValue(true)
            };
            const mockGpad = new GamepadManager({ useSemantic: true });
            mockGpad.pollSemanticInput = vi.fn().mockReturnValue({
                keys: [],
                actions: [],
                signals: ['SIGNAL:DIALOG_NEXT'],
                modifiers: { lb: false, rb: false, lt: false, rt: false },
                radial: null
            });

            const controller = new GamepadInputController({
                core: {},
                gamepadManager: mockGpad,
                modalManager: mockModalManager
            });

            const navSpy = vi.fn();
            const submitSpy = vi.fn();
            const cancelSpy = vi.fn();
            controller.on('dialogNav', navSpy);
            controller.on('dialogSubmit', submitSpy);
            controller.on('dialogCancel', cancelSpy);

            expect(controller.resolveCurrentContext()).toBe('DIALOG');

            controller.pollAndDispatch();
            expect(navSpy).toHaveBeenCalledWith({ type: 'next' });

            // SUBMIT & CANCEL の実行確認
            controller.executeSignal('SIGNAL:DIALOG_SUBMIT');
            expect(submitSpy).toHaveBeenCalled();

            controller.executeSignal('SIGNAL:DIALOG_CANCEL');
            expect(cancelSpy).toHaveBeenCalled();
            expect(controller.isDialogOpen).toBe(false);
        });
    });
});

