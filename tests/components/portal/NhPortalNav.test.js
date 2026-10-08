import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom, createMockNode } from '../testElementHelper.js';
import { PortalState } from '../../../src/core/portal/PortalState.js';
import { NhPortalNav } from '../../../src/components/portal/NhPortalNav.js';

describe('NhPortalNav Web Component (<nh-portal-nav>)', () => {
    let restoreDom;
    let mockStorage = {};

    beforeEach(() => {
        restoreDom = setupMockDom();
        global.window = createMockNode('window');
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

    it('group="user" で一般ツールタブと戻るボタンが生成されること (日本語)', () => {
        PortalState.setLanguage(true);
        const nav = new NhPortalNav();
        nav.setAttribute('group', 'user');
        nav.setAttribute('active', 'scoreboard');
        nav.connectedCallback();

        expect(nav.innerHTML).toContain('🏆 殿堂・スコアボード');
        expect(nav.innerHTML).toContain('👣 冒険手帳');
        expect(nav.innerHTML).toContain('⚙️ システム設定');
        expect(nav.innerHTML).toContain('💾 セーブデータ管理');
        expect(nav.innerHTML).toContain('← タイトルへ戻る');
        expect(nav.innerHTML).toContain('🌐 English');
    });

    it('group="user" で英語モード時に各タブと戻るボタンが英語に切り替わること', () => {
        PortalState.setLanguage(false);
        const nav = new NhPortalNav();
        nav.setAttribute('group', 'user');
        nav.setAttribute('active', 'scoreboard');
        nav.connectedCallback();

        expect(nav.innerHTML).toContain('🏆 Hall of Fame');
        expect(nav.innerHTML).toContain('👣 Adventure Log');
        expect(nav.innerHTML).toContain('⚙️ System Config');
        expect(nav.innerHTML).toContain('💾 Save Data Manager');
        expect(nav.innerHTML).toContain('← Back to Title');
        expect(nav.innerHTML).toContain('🌐 日本語');
    });

    it('group="dev" で開発者用タブと Debug Inspector ボタンが生成されること', () => {
        PortalState.setLanguage(true);
        const nav = new NhPortalNav();
        nav.setAttribute('group', 'dev');
        nav.setAttribute('active', 'cltest');
        nav.connectedCallback();

        expect(nav.innerHTML).toContain('🧪 クライアント検証');
        expect(nav.innerHTML).toContain('🛠️ 開発者ツール一覧');
        expect(nav.innerHTML).toContain('🔍 Debug Inspector');
    });
});
