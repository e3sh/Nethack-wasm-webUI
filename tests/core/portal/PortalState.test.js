import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom, createMockNode } from '../../components/testElementHelper.js';
import { PortalState } from '../../../src/core/portal/PortalState.js';

describe('PortalStateManager', () => {
    let mockStorage = {};
    let restoreDom;

    beforeEach(() => {
        restoreDom = setupMockDom();
        const mockWindow = createMockNode('window');
        global.window = mockWindow;
        mockStorage = {};
        global.localStorage = {
            getItem: vi.fn((key) => mockStorage[key] || null),
            setItem: vi.fn((key, value) => { mockStorage[key] = String(value); }),
            removeItem: vi.fn((key) => { delete mockStorage[key]; }),
            clear: vi.fn(() => { mockStorage = {}; })
        };
    });

    afterEach(() => {
        delete global.window;
        if (restoreDom) restoreDom();
    });

    it('デフォルトで日本語（true / ja）を返すこと', () => {
        expect(PortalState.isJapanese()).toBe(true);
        expect(PortalState.getLanguage()).toBe('ja');
    });

    it('setLanguage で英語（false / en）に設定および保存できること', () => {
        let eventFired = false;
        let eventDetail = null;
        window.addEventListener('nh-lang-changed', (e) => {
            eventFired = true;
            eventDetail = e.detail;
        }, { once: true });

        PortalState.setLanguage(false);

        expect(PortalState.isJapanese()).toBe(false);
        expect(PortalState.getLanguage()).toBe('en');
        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            'nh.config',
            expect.stringContaining('"lang":false')
        );
        expect(eventFired).toBe(true);
        expect(eventDetail).toEqual({ lang: 'en', isJapanese: false });
    });

    it('toggleLanguage で日本語と英語が交互に切り替わること', () => {
        PortalState.setLanguage(true);
        expect(PortalState.isJapanese()).toBe(true);

        const next = PortalState.toggleLanguage();
        expect(next).toBe(false);
        expect(PortalState.isJapanese()).toBe(false);
        expect(PortalState.getLanguage()).toBe('en');

        const again = PortalState.toggleLanguage();
        expect(again).toBe(true);
        expect(PortalState.isJapanese()).toBe(true);
        expect(PortalState.getLanguage()).toBe('ja');
    });

    it('既存の nh.config 設定（sound_mode 等）を破壊せずに lang だけ更新すること', () => {
        mockStorage['nh.config'] = JSON.stringify({ sound_mode: 'wave', sound_volume: 50 });

        PortalState.setLanguage(false);

        const saved = JSON.parse(mockStorage['nh.config']);
        expect(saved.sound_mode).toBe('wave');
        expect(saved.sound_volume).toBe(50);
        expect(saved.lang).toBe(false);
    });
});
