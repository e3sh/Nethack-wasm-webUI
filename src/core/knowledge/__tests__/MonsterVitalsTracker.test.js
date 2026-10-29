import { describe, it, expect, beforeEach } from 'vitest';
import { MonsterVitalsTracker } from '../state/MonsterVitalsTracker.js';

describe('MonsterVitalsTracker (HP Snapshot & Disappearance Reconciliation)', () => {
    let tracker;

    const mon = (id, x, y, hp, maxHp = 10, mnum = 20, extra = {}) => ({
        monsterId: id,
        x,
        y,
        hp,
        maxHp,
        monOffset: mnum,
        peaceful: false,
        tame: false,
        directlySeen: true,
        isShopkeeper: false,
        isPriest: false,
        ...extra
    });

    const diedOf = (table) => ({
        getDied: (mnum) => table[mnum] ?? 0
    });

    beforeEach(() => {
        tracker = new MonsterVitalsTracker();
    });

    it('V-01: 初回スナップショットは基準値記録のみでイベントを発行しない (primed=true)', () => {
        const events = tracker.reconcile([mon(1, 5, 5, 10)], diedOf({ 20: 0 }));
        expect(events).toEqual([]);
        expect(tracker.primed).toBe(true);
        expect(tracker.entries.size).toBe(1);
    });

    it('V-02: 通常被弾時に HP 減少分の DAMAGE_DEALT イベントを導出する', () => {
        tracker.reconcile([mon(1, 5, 5, 10)], diedOf({ 20: 0 }));
        const events = tracker.reconcile([mon(1, 5, 5, 6)], diedOf({ 20: 0 }));
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            monsterId: 1,
            monOffset: 20,
            x: 5,
            y: 5,
            amount: 4,
            prevHp: 10,
            currentHp: 6,
            maxHp: 10,
            isKill: false,
            amountIsLowerBound: false,
            byPlayer: false
        });
    });

    it('V-03: 移動後に被弾した場合、新しい座標でイベントを導出する', () => {
        tracker.reconcile([mon(1, 5, 5, 10)], diedOf({ 20: 0 }));
        const events = tracker.reconcile([mon(1, 6, 5, 7)], diedOf({ 20: 0 }));
        expect(events).toHaveLength(1);
        expect(events[0].amount).toBe(3);
        expect(events[0].x).toBe(6);
        expect(events[0].y).toBe(5);
    });

    it('V-04: HP 変動のない移動のみの場合はイベントを発行しない', () => {
        tracker.reconcile([mon(1, 5, 5, 10)], diedOf({ 20: 0 }));
        const events = tracker.reconcile([mon(1, 7, 5, 10)], diedOf({ 20: 0 }));
        expect(events).toEqual([]);
    });

    it('V-05: HP 回復時はイベントを発行せず基準値を更新する', () => {
        tracker.reconcile([mon(1, 5, 5, 6)], diedOf({ 20: 0 }));
        const events = tracker.reconcile([mon(1, 5, 5, 8)], diedOf({ 20: 0 }));
        expect(events).toEqual([]);
        expect(tracker.entries.get(1).hp).toBe(8);
    });

    it('V-06: 消失かつ died が増加した場合、撃破イベントを導出する (amount=prevHp, isKill=true)', () => {
        tracker.reconcile([mon(1, 5, 5, 3)], diedOf({ 20: 0 }));
        const events = tracker.reconcile([], diedOf({ 20: 1 }));
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            monsterId: 1,
            monOffset: 20,
            x: 5,
            y: 5,
            amount: 3,
            prevHp: 3,
            currentHp: 0,
            isKill: true,
            amountIsLowerBound: true,
            byPlayer: false
        });
    });

    it('V-07: 撃破メッセージヒントがある場合、byPlayer=true が付与される', () => {
        tracker.reconcile([mon(1, 5, 5, 3)], diedOf({ 20: 0 }));
        tracker.noteKillMessage({ x: 5, y: 5, byPlayer: true });
        const events = tracker.reconcile([], diedOf({ 20: 1 }));
        expect(events).toHaveLength(1);
        expect(events[0].isKill).toBe(true);
        expect(events[0].byPlayer).toBe(true);
    });

    it('V-08: テレポートや視界外離脱 (died 増加なし) ではイベントを発行せず削除する', () => {
        tracker.reconcile([mon(1, 5, 5, 10)], diedOf({ 20: 0 }));
        const events = tracker.reconcile([], diedOf({ 20: 0 }));
        expect(events).toEqual([]);
        expect(tracker.entries.size).toBe(0);
    });

    it('V-09: 視界外から再出現した個体は新しい基準値として扱い誤イベントを発行しない', () => {
        tracker.reconcile([mon(1, 5, 5, 10)], diedOf({ 20: 0 }));
        tracker.reconcile([], diedOf({ 20: 0 })); // 視界外へ
        const events = tracker.reconcile([mon(1, 9, 9, 4)], diedOf({ 20: 0 })); // 再出現
        expect(events).toEqual([]);
        expect(tracker.entries.get(1).hp).toBe(4);
    });

    it('V-10: 同一種族2体が同時に視界から消え died が 1 増加時、ヒントで一意に特定できる', () => {
        tracker.reconcile([mon(1, 5, 5, 3), mon(2, 15, 5, 8)], diedOf({ 20: 0 }));
        tracker.noteKillMessage({ x: 5, y: 5, byPlayer: true });
        const events = tracker.reconcile([], diedOf({ 20: 1 }));
        expect(events).toHaveLength(1);
        expect(events[0].monsterId).toBe(1);
        expect(events[0].isKill).toBe(true);
    });

    it('V-11: 同一種族2体が同時に消え died が 1 増加時、ヒントなしで曖昧な場合は誤表示防止で発行しない', () => {
        tracker.reconcile([mon(1, 5, 5, 3), mon(2, 15, 5, 8)], diedOf({ 20: 0 }));
        const events = tracker.reconcile([], diedOf({ 20: 1 }));
        expect(events).toEqual([]);
    });

    it('V-12: 異なる種族2体が同時に撃破された場合、両方のイベントを導出する', () => {
        tracker.reconcile([
            mon(1, 5, 5, 3, 10, 20),
            mon(2, 6, 6, 5, 12, 30)
        ], diedOf({ 20: 0, 30: 0 }));
        const events = tracker.reconcile([], diedOf({ 20: 1, 30: 1 }));
        expect(events).toHaveLength(2);
        expect(events.map(e => e.monsterId).sort()).toEqual([1, 2]);
    });

    it('V-13: 多相変化 (monOffset 変化) 時はダメージと見なさない', () => {
        tracker.reconcile([mon(1, 5, 5, 10, 10, 20)], diedOf({ 20: 0 }));
        const events = tracker.reconcile([mon(1, 5, 5, 4, 15, 99)], diedOf({ 20: 0 }));
        expect(events).toEqual([]);
        expect(tracker.entries.get(1).monOffset).toBe(99);
    });

    it('V-14: 最大 HP 変動 (レベルドレイン等) 時はダメージと見なさない', () => {
        tracker.reconcile([mon(1, 5, 5, 10, 10)], diedOf({ 20: 0 }));
        const events = tracker.reconcile([mon(1, 5, 5, 6, 8)], diedOf({ 20: 0 }));
        expect(events).toEqual([]);
    });

    it('V-15: ポインタ再利用相当 (同じ座標に別の m_id が出現) でも m_id により誤検知しない', () => {
        tracker.reconcile([mon(1, 5, 5, 3)], diedOf({ 20: 0 }));
        // id 1 が撃破され、同じマス (5,5) に新個体 id 2 が出現
        const events = tracker.reconcile([mon(2, 5, 5, 12)], diedOf({ 20: 1 }));
        expect(events).toHaveLength(1);
        expect(events[0].monsterId).toBe(1);
        expect(events[0].isKill).toBe(true);
        expect(tracker.entries.has(2)).toBe(true);
    });

    it('V-16: スナップショット取得失敗 (null) 時は状態を変更せず空配列を返す', () => {
        tracker.reconcile([mon(1, 5, 5, 10)], diedOf({ 20: 0 }));
        const events = tracker.reconcile(null, diedOf({ 20: 0 }));
        expect(events).toEqual([]);
        expect(tracker.entries.size).toBe(1);
    });

    it('V-17: reset 実行後は次回スナップショットを再度基準値として扱う', () => {
        tracker.reconcile([mon(1, 5, 5, 10)], diedOf({ 20: 0 }));
        tracker.reset();
        expect(tracker.primed).toBe(false);
        const events = tracker.reconcile([mon(1, 5, 5, 2)], diedOf({ 20: 0 }));
        expect(events).toEqual([]);
        expect(tracker.primed).toBe(true);
    });

    it('V-18: 登録された killHints は reconcile 実行後にクリアされる', () => {
        tracker.reconcile([mon(1, 5, 5, 10)], diedOf({ 20: 0 }));
        tracker.noteKillMessage({ x: 5, y: 5, byPlayer: true });
        expect(tracker.killHints).toHaveLength(1);
        tracker.reconcile([mon(1, 5, 5, 8)], diedOf({ 20: 0 }));
        expect(tracker.killHints).toHaveLength(0);
    });

    it('V-19: 多数のモンスターが同時に被弾した場合、全員のイベントを導出する', () => {
        const list1 = [];
        const list2 = [];
        for (let i = 1; i <= 8; i++) {
            list1.push(mon(i, i, 5, 10));
            list2.push(mon(i, i, 5, 7));
        }
        tracker.reconcile(list1, diedOf({ 20: 0 }));
        const events = tracker.reconcile(list2, diedOf({ 20: 0 }));
        expect(events).toHaveLength(8);
        events.forEach(ev => {
            expect(ev.amount).toBe(3);
        });
    });
});
