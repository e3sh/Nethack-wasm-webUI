import { describe, it, expect } from 'vitest';
import { GamepadManager } from './GamepadManager.js';

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
