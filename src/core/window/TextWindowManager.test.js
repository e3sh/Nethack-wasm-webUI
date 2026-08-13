import { describe, it, expect } from 'vitest';
import { TextWindowManager } from './TextWindowManager.js';

describe('TextWindowManager', () => {
    it('ウィンドウID別のテキスト行バッファリングとタイトルの抽出ができること', () => {
        const manager = new TextWindowManager();
        
        manager.appendLine(4, "Inventory");
        manager.appendLine(4, "a - a dagger");
        manager.appendLine(4, "b - 10 gold pieces");

        expect(manager.hasBuffer(4)).toBe(true);

        const flushed = manager.flushBuffer(4);
        expect(flushed).not.toBeNull();
        expect(flushed.title).toBe('Inventory');
        expect(flushed.lines).toEqual(["Inventory", "a - a dagger", "b - 10 gold pieces"]);
        expect(flushed.text).toContain("a - a dagger");

        // 消化後は空になること
        expect(manager.hasBuffer(4)).toBe(false);
    });

    it('clearWindow で特定ウィンドウのバッファが消去されること', () => {
        const manager = new TextWindowManager();
        manager.appendLine(5, "Dungeon History");
        
        manager.clearWindow(5);
        expect(manager.hasBuffer(5)).toBe(false);
    });

    it('resetAll で全バッファがクリアされること', () => {
        const manager = new TextWindowManager();
        manager.appendLine(4, "Line 1");
        manager.appendLine(5, "Line 2");

        manager.resetAll();
        expect(manager.hasBuffer(4)).toBe(false);
        expect(manager.hasBuffer(5)).toBe(false);
    });
});
