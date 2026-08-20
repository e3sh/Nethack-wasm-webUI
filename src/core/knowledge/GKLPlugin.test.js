import { describe, it, expect, vi } from 'vitest';
import { GKLPlugin } from './GKLPlugin.js';

function createMockDriver() {
    return {
        on: vi.fn(),
        emit: vi.fn(),
        queueSequence: vi.fn(),
        getPromptCategory: vi.fn(),
        getLastSequenceBuffer: vi.fn().mockReturnValue([])
    };
}

function createMockCore() {
    const listeners = new Map();
    return {
        driver: createMockDriver(),
        on: (event, fn) => {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event).push(fn);
        },
        emit: (event, payload) => {
            if (listeners.has(event)) {
                listeners.get(event).forEach(fn => fn(payload));
            }
        },
        querySequenceSilent: vi.fn().mockResolvedValue([]),
        sendExtCommand: vi.fn(),
        sendActionKey: vi.fn(),
        sendKey: vi.fn(),
        currentPromptCategory: null,
        lastPutstrText: ''
    };
}

describe('GKLPlugin - 独立モジュール＆イベント連携機能', () => {
    it('isNonItemSequence: 移動キー、カウントキー、抽象方向キーを判定できること', () => {
        const plugin = new GKLPlugin();

        expect(plugin.isNonItemSequence(['k'])).toBe(true);
        expect(plugin.isNonItemSequence(['j'])).toBe(true);
        expect(plugin.isNonItemSequence(['5'])).toBe(true);
        expect(plugin.isNonItemSequence(['DIR_N'])).toBe(true);
        expect(plugin.isNonItemSequence(['5', 'k'])).toBe(true);

        // アイテム操作を含むキーは false
        expect(plugin.isNonItemSequence(['d', 'a'])).toBe(false);
        expect(plugin.isNonItemSequence(['a', 'f'])).toBe(false);
    });

    it('attach: WebUICore にアタッチされ、userActionSent イベントを受信して非アイテム操作以外で invalidate が呼ばれること', () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        
        plugin.inventoryStateManager = {
            isSynced: true,
            invalidate: vi.fn()
        };

        plugin.attach(mockCore);

        // 1. 移動キー (非アイテム操作) の場合: invalidate は呼ばれない
        mockCore.emit('userActionSent', { sequence: ['k'] });
        expect(plugin.inventoryStateManager.invalidate).not.toHaveBeenCalled();

        // 2. ドロップキー 'd' (アイテム操作) の場合: invalidate が呼ばれること
        mockCore.emit('userActionSent', { sequence: ['d', 'a'] });
        expect(plugin.inventoryStateManager.invalidate).toHaveBeenCalledTimes(1);
    });

    it('getSituation: 統合状況 (Situation: status, inventory, area, spells, attributes, actions) を返却すること', () => {
        const plugin = new GKLPlugin();
        const situation = plugin.getSituation();

        expect(situation).toHaveProperty('status');
        expect(situation).toHaveProperty('inventory');
        expect(situation).toHaveProperty('area');
        expect(situation).toHaveProperty('spells');
        expect(situation).toHaveProperty('attributes');
        expect(situation).toHaveProperty('actions');

        expect(Array.isArray(situation.spells.items)).toBe(true);
        expect(situation.attributes).toHaveProperty('effectiveResistances');
    });

    it('syncSpellsSilent & syncAttributesSilent: サイレント同期が実行され状態が更新されること', async () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        mockCore.querySequenceSilent.mockResolvedValue([
            { lines: ['a - force bolt          1      attack      0%'] }
        ]);

        plugin.attach(mockCore);

        const spellRes = await plugin.syncSpellsSilent();
        expect(spellRes).toBe(true);
        expect(mockCore.querySequenceSilent).toHaveBeenCalledWith(['+', ' ', '\x1b'], expect.anything());
        expect(plugin.spellStateManager.getSpells().length).toBe(1);

        mockCore.querySequenceSilent.mockResolvedValue([
            { lines: ['You are fire resistant.'] }
        ]);
        const attrRes = await plugin.syncAttributesSilent();
        expect(attrRes).toBe(true);
        expect(mockCore.querySequenceSilent).toHaveBeenCalledWith(['\x18', ' ', '\x1b'], expect.anything());
        expect(plugin.attributeStateManager.getEffectiveResistances().fire).toBe(true);
    });

    it('syncPendingStateSilent: 未同期ステートを直列・排他制御で安全に同期すること', async () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        mockCore.querySequenceSilent.mockResolvedValue([]);
        plugin.attach(mockCore);

        plugin.inventoryStateManager.isSynced = false;
        plugin.spellStateManager.isSynced = false;

        const res = await plugin.syncPendingStateSilent();
        expect(res).toBe(true);
        expect(mockCore.querySequenceSilent).toHaveBeenCalledTimes(2);
        expect(mockCore.querySequenceSilent).toHaveBeenNthCalledWith(1, ['i', ' ', '\x1b'], { syncType: 'inventory' });
        expect(mockCore.querySequenceSilent).toHaveBeenNthCalledWith(2, ['+', ' ', '\x1b'], { syncType: 'spells' });
    });

    it('getRecommendedActions: 推奨アクション配列を返却すること', () => {
        const plugin = new GKLPlugin();
        const actions = plugin.getRecommendedActions(1);
        expect(Array.isArray(actions)).toBe(true);
    });

    it('structuredKnowledge: GKL プラグインが StructuredKnowledgeEngine を保持し attach 時に translator がバインドされること', () => {
        const plugin = new GKLPlugin();
        expect(plugin.structuredKnowledge).toBeDefined();

        const mockTranslator = { translate: vi.fn(text => `TR:${text}`) };
        const mockCore = createMockCore();
        mockCore.translator = mockTranslator;

        plugin.attach(mockCore);

        const mon = plugin.structuredKnowledge.getMonsterKnowledge('cockatrice', { translate: true });
        expect(mockTranslator.translate).toHaveBeenCalled();
        expect(mon.name).toBe('TR:cockatrice');
    });

    it('travelTo: 指定座標への隣接移動・遠隔トラベルシーケンスを生成・実行できること', async () => {
        const plugin = new GKLPlugin();
        const mockCore = createMockCore();
        plugin.attach(mockCore);

        // プレイヤー初期位置 (10, 10)
        plugin.areaStateManager.playerX = 10;
        plugin.areaStateManager.playerY = 10;

        // 1. 隣接マス (11, 10) への移動 ➔ DIR_E
        const res1 = await plugin.travelTo({ x: 11, y: 10 });
        expect(res1).toBe(true);
        expect(mockCore.driver.queueSequence).toHaveBeenCalledWith(['DIR_E'], expect.anything());

        // 2. 遠隔マス (13, 10) へのトラベル (10->13: 3ステップ) ➔ ['_', '@', 'DIR_E', 'DIR_E', 'DIR_E', '.']
        mockCore.driver.queueSequence.mockClear();
        const res2 = await plugin.travelTo({ x: 13, y: 10 });
        expect(res2).toBe(true);
        expect(mockCore.driver.queueSequence).toHaveBeenCalledWith(['_', '@', 'DIR_E', 'DIR_E', 'DIR_E', '.'], expect.anything());
    });
});
