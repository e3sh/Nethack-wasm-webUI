/**
 * NhCodexGrid.test.js
 *
 * <nh-codex-grid> Web Component の単体テスト。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import { NhCodexGrid } from '../../src/components/NhCodexGrid.js';
import { AdventureLogManager } from '../../src/core/knowledge/lore/AdventureLogManager.js';
import { AdventureLogStorage } from '../../src/core/knowledge/lore/AdventureLogStorage.js';

describe('NhCodexGrid (<nh-codex-grid>) (Gap 4)', () => {
    let restoreDom;
    let mockStorage;
    let manager;

    beforeEach(() => {
        restoreDom = setupMockDom();
        mockStorage = new AdventureLogStorage({ storageKey: 'test_grid_storage' });
        mockStorage.clear();
        manager = new AdventureLogManager({
            storage: mockStorage,
            autoLoad: false
        });
    });

    afterEach(() => {
        restoreDom();
    });

    it('初期状態でコンポーネントがクラッシュせず描画されること', () => {
        const grid = new NhCodexGrid();
        grid.setManager(manager);
        grid.connectedCallback();

        const html = grid.shadowRoot.innerHTML;
        expect(html).toContain('冒険手帳');
        expect(html).toContain('Adventure Log');
        expect(html).toContain('0 / 1651 (0%)');
    });

    it('解禁したモンスター・アイテム・噂の進捗が集計・表示されること', () => {
        manager.unlockMonster(0); // giant ant
        manager.unlockObject(0);
        manager.unlockRumor('RUMOR_001');

        const grid = new NhCodexGrid();
        grid.setManager(manager);
        grid.connectedCallback();

        const html = grid.shadowRoot.innerHTML;
        expect(html).toContain('3 / 1651');
    });

    it('未解禁エントリは locked クラスがつきシルエット化されること', () => {
        const grid = new NhCodexGrid();
        grid.setManager(manager);
        grid.setCategory('monster');
        grid.connectedCallback();

        const lockedTiles = grid.shadowRoot.querySelectorAll('.tile-item.locked');
        expect(lockedTiles.length).toBe(383); // 全て未解禁
    });

    it('解禁済みエントリは locked クラスが外れ、NEW! バッジが表示されること', () => {
        manager.unlockMonster(0); // giant ant

        const grid = new NhCodexGrid();
        grid.setManager(manager);
        grid.setCategory('monster');
        grid.connectedCallback();

        const allTiles = Array.from(grid.shadowRoot.querySelectorAll('.tile-item'));
        const unlockedTiles = allTiles.filter(t => !t.classList.contains('locked'));
        expect(unlockedTiles.length).toBe(1);

        const newBadges = grid.shadowRoot.querySelectorAll('.new-badge');
        expect(newBadges.length).toBe(1);
    });

    it('カテゴリタブを切り替えると表示内容が更新されること', () => {
        const grid = new NhCodexGrid();
        grid.setManager(manager);
        grid.connectedCallback();

        grid.setCategory('rumor');
        const rumorGrid = grid.shadowRoot.querySelector('.rumor-grid');
        expect(rumorGrid).not.toBeNull();

        grid.setCategory('object');
        const tileGrid = grid.shadowRoot.querySelector('.tile-grid');
        expect(tileGrid).not.toBeNull();
    });

    it('解禁済みエントリをクリックすると entry-selected イベントが発火すること', () => {
        manager.unlockMonster(0); // giant ant

        const grid = new NhCodexGrid();
        grid.setManager(manager);
        grid.setCategory('monster');
        grid.connectedCallback();

        const handler = vi.fn();
        grid.addEventListener('entry-selected', handler);

        const allTiles = Array.from(grid.shadowRoot.querySelectorAll('.tile-item'));
        const tile = allTiles.find(t => !t.classList.contains('locked'));
        expect(tile).not.toBeNull();
        tile.click();

        expect(handler).toHaveBeenCalledTimes(1);
        const eventDetail = handler.mock.calls[0][0].detail;
        expect(eventDetail.category).toBe('monster');
        expect(eventDetail.entry.name).toBe('giant ant');
    });

    it('未解禁エントリをクリックしても entry-selected イベントは発火しないこと', () => {
        const grid = new NhCodexGrid();
        grid.setManager(manager);
        grid.setCategory('monster');
        grid.connectedCallback();

        const handler = vi.fn();
        grid.addEventListener('entry-selected', handler);

        const lockedTile = grid.shadowRoot.querySelector('.tile-item.locked');
        expect(lockedTile).not.toBeNull();
        lockedTile.click();

        expect(handler).not.toHaveBeenCalled();
    });

    it('検索ボックスで解禁済みエントリをインクリメンタル検索できること', () => {
        manager.unlockMonster(0); // giant ant
        manager.unlockMonster(1); // killer bee

        const grid = new NhCodexGrid();
        grid.setManager(manager);
        grid.setCategory('monster');
        grid.connectedCallback();

        grid.searchQuery = 'giant';
        grid.render();

        const visibleTiles = grid.shadowRoot.querySelectorAll('.tile-item');
        expect(visibleTiles.length).toBe(1);
        expect(visibleTiles[0].getAttribute('data-entry-id')).toBe('giant_ant');
    });

    it('selectEntryById で指定エントリの選択イベントが発火すること', () => {
        manager.unlockMonster(0); // giant ant
        const grid = new NhCodexGrid();
        grid.setManager(manager);
        grid.connectedCallback();

        let selectedDetail = null;
        grid.addEventListener('entry-selected', (e) => {
            selectedDetail = e.detail;
        });

        grid.selectEntryById('giant_ant', 'monster');
        expect(selectedDetail).not.toBeNull();
        expect(selectedDetail.entry.id).toBe('giant_ant');
        expect(grid.selectedEntryId).toBe('giant_ant');
    });

    it('言語設定（lang属性 / setLanguage）に応じてタブやフィルタメニューが多言語化されること', () => {
        const grid = new NhCodexGrid();
        grid.setManager(manager);
        grid.connectedCallback();

        // 初期（日本語）
        let html = grid.shadowRoot.innerHTML;
        expect(html).toContain('すべて');
        expect(html).toContain('👾 モンスター');
        expect(html).toContain('未遭遇・未識別');
        expect(html).toContain('検索...');

        // 英語に切替
        grid.setLanguage('en');
        html = grid.shadowRoot.innerHTML;
        expect(html).toContain('All');
        expect(html).toContain('👾 Monsters');
        expect(html).toContain('⚔️ Items');
        expect(html).toContain('📜 Rumors & Lore');
        expect(html).toContain('Locked / Undiscovered');
        expect(html).toContain('Search...');

        // 再び日本語へ
        grid.setLanguage('ja');
        html = grid.shadowRoot.innerHTML;
        expect(html).toContain('すべて');
        expect(html).toContain('👾 モンスター');
    });
});

