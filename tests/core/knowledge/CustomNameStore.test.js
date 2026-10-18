import { describe, it, expect, beforeEach } from 'vitest';
import { CustomNameStore } from '../../../src/core/knowledge/state/CustomNameStore.js';
import { DiscoveryStateManager } from '../../../src/core/knowledge/state/DiscoveryStateManager.js';

describe('CustomNameStore - プレイヤー命名（仮名・個別名）管理ストア', () => {
    let store;
    let discoveryStateManager;

    beforeEach(() => {
        discoveryStateManager = new DiscoveryStateManager();
        store = new CustomNameStore({
            storageKey: 'test_custom_names',
            autoPersist: false,
            discoveryStateManager
        });
    });

    describe('1. 基本登録・取得・削除', () => {
        it('アイテム仮名を登録し、取得できること', () => {
            store.setCustomName('ruby potion', 'healing?');
            expect(store.getCustomName('ruby potion')).toBe('healing?');
            expect(store.hasCustomName('ruby potion')).toBe(true);

            // 大文字小文字を正規化して取得できること
            expect(store.getCustomName('RUBY POTION')).toBe('healing?');
        });

        it('日本語エイリアスを含むエントリを正しく管理できること', () => {
            const entry = store.setCustomName('silver wand', 'digging?', {
                japaneseAlias: '穴掘り？',
                category: 'WAND'
            });

            expect(entry.customName).toBe('digging?');
            expect(entry.japaneseAlias).toBe('穴掘り？');
            expect(entry.category).toBe('WAND');

            const fetched = store.getEntry('silver wand');
            expect(fetched.japaneseAlias).toBe('穴掘り？');
        });

        it('仮名を削除（解除）できること', () => {
            store.setCustomName('scroll labeled ZELGO MER', 'identify?');
            expect(store.hasCustomName('scroll labeled ZELGO MER')).toBe(true);

            const removed = store.removeCustomName('scroll labeled ZELGO MER');
            expect(removed).toBe(true);
            expect(store.hasCustomName('scroll labeled ZELGO MER')).toBe(false);
            expect(store.getCustomName('scroll labeled ZELGO MER')).toBeNull();
        });

        it('空文字の setCustomName は削除扱いとなること', () => {
            store.setCustomName('runed broadsword', 'vorpal?');
            expect(store.hasCustomName('runed broadsword')).toBe(true);

            store.setCustomName('runed broadsword', '   ');
            expect(store.hasCustomName('runed broadsword')).toBe(false);
        });
    });

    describe('2. DiscoveryStateManager との双方向同期', () => {
        it('setCustomName 実行時に discoveryStateManager.calledNamesMap へ即時反映されること', () => {
            store.setCustomName('glass potion', 'extra healing?');

            expect(discoveryStateManager.calledNamesMap.get('glass potion')).toBe('extra healing?');
            expect(discoveryStateManager.getCalledName('glass potion')).toBe('extra healing?');
        });

        it('removeCustomName 実行時に discoveryStateManager.calledNamesMap からも削除されること', () => {
            store.setCustomName('glass potion', 'extra healing?');
            expect(discoveryStateManager.calledNamesMap.has('glass potion')).toBe(true);

            store.removeCustomName('glass potion');
            expect(discoveryStateManager.calledNamesMap.has('glass potion')).toBe(false);
        });

        it('syncFromDiscoveryState で DiscoveryStateManager の既存仮名を取り込めること', () => {
            discoveryStateManager.calledNamesMap.set('wooden ring', 'slow digest?');

            const count = store.syncFromDiscoveryState(discoveryStateManager);
            expect(count).toBeGreaterThanOrEqual(1);
            expect(store.getCustomName('wooden ring')).toBe('slow digest?');
        });

        it('syncToDiscoveryState で Store のエントリを一括反映できること', () => {
            store.setCustomName('brass lantern', 'magic lamp?');
            const newDSM = new DiscoveryStateManager();

            const count = store.syncToDiscoveryState(newDSM);
            expect(count).toBeGreaterThanOrEqual(1);
            expect(newDSM.calledNamesMap.get('brass lantern')).toBe('magic lamp?');
        });
    });

    describe('3. LocalStorage 永続化と復元', () => {
        it('モックストレージを用いた save / load が正常に動作すること', () => {
            const mockStorage = new Map();
            globalThis.window = {
                localStorage: {
                    getItem: (key) => mockStorage.get(key) || null,
                    setItem: (key, val) => mockStorage.set(key, val)
                }
            };

            const storeA = new CustomNameStore({
                storageKey: 'persist_test',
                autoPersist: true
            });

            storeA.setCustomName('topaz ring', 'teleport?');

            const storeB = new CustomNameStore({
                storageKey: 'persist_test',
                autoPersist: true
            });

            expect(storeB.getCustomName('topaz ring')).toBe('teleport?');

            delete globalThis.window;
        });
    });
});
