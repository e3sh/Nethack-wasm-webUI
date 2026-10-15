import { describe, it, expect, vi } from 'vitest';
import { SpellStateManager } from '../../../../src/core/knowledge/state/SpellStateManager.js';
import { parseSpellBookBuffer } from '../../../../src/core/knowledge/services/WasmDirectBindingService.js';
import { GKLPlugin } from '../../../../src/core/knowledge/GKLPlugin.js';

describe('SpellStateManager Direct Binding Integration', () => {
    it('parseSpellBookBuffer: NO_SPELL (0) で直ちに終端し、バッファ末尾のゴミデータを拾わないこと', () => {
        // 例: 376 = force bolt (level 1), 377 = confuse monster (level 2)
        // 0 = NO_SPELL (終端)
        // 以降は未初期化ヒープのゴミデータ (例: 10, 20 など)
        const raw = [
            376, 1, 1000, // slot 0 -> 'a'
            377, 2, 800,  // slot 1 -> 'b'
            0, 0, 0,      // slot 2 -> NO_SPELL (終端)
            10, 5, 9999,  // ゴミデータ (武器等) -> 終端後なので到達してはならない
            25, 1, 8888   // ゴミデータ
        ];
        const parsed = parseSpellBookBuffer(raw);
        expect(parsed).toHaveLength(2);

        expect(parsed[0].letter).toBe('a');
        expect(parsed[0].id).toBe(376);
        expect(parsed[0].level).toBe(1);
        expect(parsed[0].retention).toBe(1000);
        expect(parsed[0].isForgotten).toBe(false);

        expect(parsed[1].letter).toBe('b');
        expect(parsed[1].id).toBe(377);
        expect(parsed[1].level).toBe(2);
        expect(parsed[1].retention).toBe(800);
    });

    it('parseSpellBookBuffer: 呪文を覚えていない初期状態 (先頭が 0) では空配列を返すこと', () => {
        const raw = [0, 0, 0, 10, 20, 30]; // 先頭が NO_SPELL
        const parsed = parseSpellBookBuffer(raw);
        expect(parsed).toEqual([]);
    });

    it('parseSpellBookBuffer: Cコアが成功コード 0 を返した場合 (countLimit = 0) でも習得呪文が正しくパースされること', () => {
        const raw = [
            376, 1, 1000, // force bolt
            0, 0, 0       // NO_SPELL
        ];
        // countLimit = 0 (古い/現行 Wasm C コアの return 0)
        const parsed = parseSpellBookBuffer(raw, 0);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].id).toBe(376);
        expect(parsed[0].letter).toBe('a');
    });

    it('SpellStateManager.syncFromDirectBinding: 魔法書以外のアイテム (武器や食料等) が混入しても確実に除外すること', () => {
        const sm = new SpellStateManager();
        const mockBindingService = {
            getSpellBook: vi.fn(() => [
                { id: 376, onum: 376, level: 1, retention: 1000 }, // Force Bolt (Spellbook)
                { id: 10, onum: 10, level: 1, retention: 500 },    // Weapon/Armor (Not spellbook) -> 除外されるべき
                { id: 357, onum: 357, level: 0, retention: 0 }     // Blank Paper -> 除外されるべき
            ])
        };

        const changed = sm.syncFromDirectBinding(mockBindingService);
        expect(changed).toBe(true);
        expect(sm.isSynced).toBe(true);

        const spells = sm.getSpells();
        expect(spells).toHaveLength(1);
        expect(spells[0].name.toLowerCase()).toContain('force bolt');
        expect(spells[0].letter).toBe('a');
    });

    it('SpellStateManager.syncFromDirectBinding: Direct Binding Service から呪文名・系統を解決し isSynced=true になること', () => {
        const sm = new SpellStateManager();
        expect(sm.isSynced).toBe(false);

        const mockBindingService = {
            getSpellBook: vi.fn(() => [
                {
                    index: 0,
                    letter: 'a',
                    id: 376,
                    onum: 376,
                    level: 1,
                    retention: 1000,
                    isForgotten: false
                }
            ])
        };

        const changed = sm.syncFromDirectBinding(mockBindingService);
        expect(changed).toBe(true);
        expect(sm.isSynced).toBe(true);

        const spells = sm.getSpells();
        expect(spells).toHaveLength(1);
        expect(spells[0].letter).toBe('a');
        expect(spells[0].name.toLowerCase()).toContain('force bolt');
        expect(spells[0].category).toBe('attack');
        expect(spells[0].level).toBe(1);
        expect(spells[0].retention).toBe('1000');
    });

    it('GKLPlugin.syncSpellsOnDemand: Direct Binding 経由で呪文をオンデマンド同期し spellsStateUpdated を発火すること', async () => {
        const mockCore = {
            on: vi.fn(),
            emit: vi.fn(),
            off: vi.fn()
        };

        const mockDbs = {
            isAvailable: vi.fn(() => true),
            syncSpellBookOnDemand: vi.fn(async () => true),
            getSpellBook: vi.fn(() => [
                {
                    index: 0,
                    letter: 'a',
                    id: 376,
                    onum: 376,
                    level: 1,
                    retention: 999
                }
            ])
        };

        const plugin = new GKLPlugin();
        plugin.attach(mockCore);
        plugin.wasmDirectBindingService = mockDbs;

        const changed = await plugin.syncSpellsOnDemand();
        expect(changed).toBe(true);
        expect(mockDbs.syncSpellBookOnDemand).toHaveBeenCalled();
        expect(mockCore.emit).toHaveBeenCalledWith('spellsStateUpdated', plugin.spellStateManager);
        expect(plugin.spellStateManager.isSynced).toBe(true);
    });
});
