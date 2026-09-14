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
