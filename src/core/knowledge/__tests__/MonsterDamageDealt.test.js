import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GKLPlugin } from '../GKLPlugin.js';

function createMockCore() {
    const listeners = {};
    return {
        on: (evt, handler) => {
            if (!listeners[evt]) listeners[evt] = [];
            listeners[evt].push(handler);
        },
        off: (evt, handler) => {
            if (!listeners[evt]) return;
            listeners[evt] = listeners[evt].filter(h => h !== handler);
        },
        emit: (evt, payload) => {
            const list = listeners[evt] || [];
            for (const h of list) {
                h(payload);
            }
        },
        querySequenceSilent: vi.fn(),
        sendActionKey: vi.fn(),
        isMorePromptActive: false,
        isTextWindowOpen: false,
        isMenuOpen: false
    };
}

describe('Monster Damage Dealt Integration (R-01 - R-06)', () => {
    let plugin;
    let mockCore;
    let fxListener;

    beforeEach(() => {
        plugin = new GKLPlugin();
        mockCore = createMockCore();
        fxListener = vi.fn();
        mockCore.on('fx_trigger', fxListener);
    });

    it('R-01: inputRequired (settled) でモンスター HP 減少時に DAMAGE_DEALT イベントが正しく発行されること', () => {
        let snapshotMock = [
            { monsterId: 101, x: 12, y: 6, hp: 10, maxHp: 10, monOffset: 20, peaceful: false, tame: false }
        ];
        const diedMap = { 20: 0 };
        plugin.wasmDirectBindingService = {
            isAvailable: () => true,
            dumpVisibleMonsters: () => snapshotMock,
            getMvitalsDied: (mnum) => diedMap[mnum] ?? 0
        };

        plugin.attach(mockCore);

        // 1回目の settled (基準値スナップショット)
        mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });
        expect(fxListener).not.toHaveBeenCalled();

        // 2回目の settled (HP: 10 -> 6, 被弾 4)
        snapshotMock = [
            { monsterId: 101, x: 12, y: 6, hp: 6, maxHp: 10, monOffset: 20, peaceful: false, tame: false }
        ];
        mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });

        expect(fxListener).toHaveBeenCalledTimes(1);
        const payload = fxListener.mock.calls[0][0];
        expect(payload.type).toBe('DAMAGE_DEALT');
        expect(payload.monsterId).toBe(101);
        expect(payload.targetX).toBe(12);
        expect(payload.targetY).toBe(6);
        expect(payload.amount).toBe(4);
        expect(payload.currentHp).toBe(6);
        expect(payload.prevHp).toBe(10);
        expect(payload.isKill).toBe(false);
        expect(payload.isPlayer).toBe(false);
    });

    it('R-02: isMorePrompt: true では DAMAGE_DEALT の判定を実行しないこと', () => {
        let snapshotCalled = false;
        plugin.wasmDirectBindingService = {
            isAvailable: () => true,
            dumpVisibleMonsters: () => { snapshotCalled = true; return []; },
            getMvitalsDied: () => 0
        };

        plugin.attach(mockCore);

        mockCore.emit('inputRequired', { category: 'POSKEY', isMorePrompt: true });
        expect(snapshotCalled).toBe(false);
        expect(fxListener).not.toHaveBeenCalled();
    });

    it('R-03: 撃破メッセージ後にモンスター消失かつ died 増加で DAMAGE_DEALT (isKill=true, byPlayer=true) が発行されること', () => {
        let snapshotMock = [
            { monsterId: 101, x: 12, y: 6, hp: 3, maxHp: 10, monOffset: 20, peaceful: false, tame: false }
        ];
        const diedMap = { 20: 0 };
        plugin.wasmDirectBindingService = {
            isAvailable: () => true,
            dumpVisibleMonsters: () => snapshotMock,
            getMvitalsDied: (mnum) => diedMap[mnum] ?? 0
        };

        plugin.attach(mockCore);

        // 基準値
        mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });

        // 撃破メッセージ受信
        mockCore.emit('messageText', { text: 'You kill the jackal!' });
        expect(fxListener).toHaveBeenCalledTimes(1);
        expect(fxListener.mock.calls[0][0].type).toBe('KILL_CONFIRMED');

        // 次のターン確定 (モンスター消失、died 増加)
        snapshotMock = [];
        diedMap[20] = 1;
        mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });

        expect(fxListener).toHaveBeenCalledTimes(2);
        const killPayload = fxListener.mock.calls[1][0];
        expect(killPayload.type).toBe('DAMAGE_DEALT');
        expect(killPayload.monsterId).toBe(101);
        expect(killPayload.isKill).toBe(true);
        expect(killPayload.amount).toBe(3);
        expect(killPayload.amountIsLowerBound).toBe(true);
        expect(killPayload.byPlayer).toBe(true);
    });

    it('R-04: 階層移動 (isNewFloor) を伴う settled では DAMAGE_DEALT がリセットされ誤発行しないこと', () => {
        let snapshotMock = [
            { monsterId: 101, x: 12, y: 6, hp: 10, maxHp: 10, monOffset: 20, peaceful: false, tame: false }
        ];
        plugin.wasmDirectBindingService = {
            isAvailable: () => true,
            dumpVisibleMonsters: () => snapshotMock,
            getMvitalsDied: () => 0,
            getPlayerSummary: () => ({ dnum: 0, dlevel: 2 })
        };

        // 階層変更シミュレート
        plugin.areaStateManager.syncPlayerSummary = () => ({
            isNewFloor: true,
            floorKey: 'dungeon:2'
        });

        plugin.attach(mockCore);

        // 1回目のフロア
        mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });

        // 別フロアで前フロアのモンスターが消失しても、isNewFloor でリセットされるため DAMAGE_DEALT は発行されない
        snapshotMock = [];
        mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });
        expect(fxListener).not.toHaveBeenCalled();
    });

    it('R-05: restarted 時に monsterVitalsTracker.primed がリセットされること', () => {
        plugin.wasmDirectBindingService = {
            isAvailable: () => true,
            dumpVisibleMonsters: () => [
                { monsterId: 101, x: 12, y: 6, hp: 10, maxHp: 10, monOffset: 20, peaceful: false, tame: false }
            ],
            getMvitalsDied: () => 0
        };
        plugin.attach(mockCore);

        mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });
        expect(plugin.monsterVitalsTracker.primed).toBe(true);

        mockCore.emit('restarted');
        expect(plugin.monsterVitalsTracker.primed).toBe(false);
    });
});
