import { describe, it, expect } from 'vitest';
import { KeyMapper } from './KeyMapper.js';
import { GamepadManager } from './GamepadManager.js';
import { TouchCalculator } from './TouchCalculator.js';

describe('InputManagers 集約テストスイート', () => {
    describe('KeyMapper', () => {
        it('KeyboardEvent から正確な修飾キーフラグとキー情報を抽出できること', () => {
            const mapper = new KeyMapper();
            const dummyEvent = {
                code: 'KeyD',
                key: 'd',
                shiftKey: false,
                ctrlKey: true,
                altKey: false
            };

            const keyInfo = mapper.mapKeyEvent(dummyEvent);
            expect(keyInfo).toBe('\x04');
        });
    });

    describe('GamepadManager', () => {
        it('デフォルトのキー割り当てが正常にセットされていること', () => {
            const manager = new GamepadManager();
            expect(manager.keyAssign).toBeDefined();
            expect(manager.keyAssign.NORMAL).toBeDefined();
        });

        it('fCharToKeyArray で文字からキーアサイン配列へ逆引き変換できること', () => {
            const manager = new GamepadManager();
            const keyArr = manager.fCharToKeyArray('y');
            expect(keyArr).toEqual(['KeyY']);
        });

        it('applyContextOverlay で YN コンテキストのボタンオーバーレイが生成されること', () => {
            const manager = new GamepadManager();
            const overlay = manager.applyContextOverlay(manager.keyAssign.NORMAL, 'YN', 'yn');

            expect(overlay.A).toBeDefined();
            expect(overlay.A.label).toBe('y');
            expect(overlay.B.label).toBe('n');
        });

        it('十字キー（D-Pad）による移動と斜め入力が正確に判定されること', () => {
            const manager = new GamepadManager({ dpadOnlyMove: true });
            
            // 上(12) + 右(15) 押下 ➔ Numpad9
            const mockGp = {
                axes: [0, 0, 0, 0],
                buttons: Array.from({ length: 16 }, (_, i) => ({
                    pressed: (i === 12 || i === 15)
                }))
            };
            manager.getGamepadState = () => mockGp;

            const res = manager.pollSemanticInput('NORMAL', '', 1000);
            expect(res.keys).toEqual(['Numpad9']);
        });

        it('LBホールド時に単独方向が遮断され、斜めのみ通過すること', () => {
            const manager = new GamepadManager({ dpadOnlyMove: true });

            // 1. LB(4) + 上(12) 単独押下 ➔ 遮断されて空配列
            manager.getGamepadState = () => ({
                axes: [0, 0, 0, 0],
                buttons: Array.from({ length: 16 }, (_, i) => ({
                    pressed: (i === 4 || i === 12)
                }))
            });
            let res = manager.pollSemanticInput('NORMAL', '', 1000);
            expect(res.keys).toEqual([]);

            // 2. LB(4) + 上(12) + 左(14) ➔ 斜め(Numpad7)は通過
            manager.getGamepadState = () => ({
                axes: [0, 0, 0, 0],
                buttons: Array.from({ length: 16 }, (_, i) => ({
                    pressed: (i === 4 || i === 12 || i === 14)
                }))
            });
            res = manager.pollSemanticInput('NORMAL', '', 1100);
            expect(res.keys).toEqual(['Numpad7']);
        });

        it('RBホールド時にダッシュ走行キー (KeyG + Shift) が付加されること', () => {
            const manager = new GamepadManager({ dpadOnlyMove: true });

            // RB(5) + 右(15) 押下
            manager.getGamepadState = () => ({
                axes: [0, 0, 0, 0],
                buttons: Array.from({ length: 16 }, (_, i) => ({
                    pressed: (i === 5 || i === 15)
                }))
            });
            const res = manager.pollSemanticInput('NORMAL', '', 1000);
            expect(res.keys).toEqual(['KeyG', 'ShiftLeft', 'Numpad6']);
        });

        it('セマンティックモードで Aボタンを押すと ACTION:CONTEXT_PRIMARY が出力されること', () => {
            const manager = new GamepadManager({ useSemantic: true });

            // Aボタン (0) 押下
            manager.getGamepadState = () => ({
                axes: [0, 0, 0, 0],
                buttons: Array.from({ length: 16 }, (_, i) => ({
                    pressed: (i === 0)
                }))
            });
            const res = manager.pollSemanticInput('NORMAL', '', 1000);
            expect(res.actions).toContain('ACTION:CONTEXT_PRIMARY');
        });

        it('右スティックのフリックによってラジアルパレットコマンドが発火すること', () => {
            const manager = new GamepadManager({ useRadialPalette: true, radialStickIndex: 'right' });

            // 1. 右スティック (axes 2, 3) を真上（N: 飲む）へ倒す
            manager.getGamepadState = () => ({
                axes: [0, 0, 0, -0.9],
                buttons: Array.from({ length: 16 }, () => ({ pressed: false }))
            });
            let res = manager.pollSemanticInput('NORMAL', '', 1000);
            expect(res.radial.state).toBe('ENGAGED');
            expect(res.radial.currentSector).toBe('N');
            expect(res.radial.selectedItem.id).toBe('QUAFF');

            // 2. 100ms 後にスティックをニュートラルに戻す (フリック決定)
            manager.getGamepadState = () => ({
                axes: [0, 0, 0, 0],
                buttons: Array.from({ length: 16 }, () => ({ pressed: false }))
            });
            res = manager.pollSemanticInput('NORMAL', '', 1100);
            expect(res.radial.flickTriggered).toBeDefined();
            expect(res.radial.flickTriggered.sector).toBe('N');
            // QUAFF (KeyQ) が keys に投入されること
            expect(res.keys).toContain('KeyQ');
        });

    });

    describe('TouchCalculator', () => {
        it('タッチ座標から 12x9 グリッド ID および移動キーを取得できること', () => {
            const touch = new TouchCalculator({ resoX: 960, resoY: 600, dw: 12, dh: 9 });
            const targetRect = { left: 0, top: 0, width: 960, height: 600 };

            // 960x600 内の (150, 25) 座標 ➔ グリッド ID 1 (1行目の2セル目)
            const gridId = touch.pointToGridId(150, 25, targetRect);
            expect(gridId).toBe(1);

            const action = touch.gridIdToKey(gridId);
            expect(action).toEqual(["Numpad8"]);
        });

        it('アスペクト比黒枠領域外のタップが -1 に判定されること', () => {
            const touch = new TouchCalculator({ resoX: 960, resoY: 600, dw: 12, dh: 9 });
            const targetRect = { left: 0, top: 0, width: 1200, height: 600 }; // 左右に黒枠

            // 左端黒枠領域 (x = 10px) ➔ -1
            const gridId = touch.pointToGridId(10, 300, targetRect);
            expect(gridId).toBe(-1);
        });

        it('コンテキスト更新による表示ページの切り替えができること', () => {
            const touch = new TouchCalculator();
            touch.setContext("YN");
            expect(touch.currentPage).toBe("YN");

            touch.setContext("NORMAL");
            expect(touch.currentPage).toBe("Center");
        });
    });
});
