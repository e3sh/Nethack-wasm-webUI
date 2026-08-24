import { describe, it, expect, beforeEach } from 'vitest';
import { MonsterTracker } from './MonsterTracker.js';

describe('MonsterTracker (Cognitive Mental Map & Weight Decay)', () => {
    let tracker;

    beforeEach(() => {
        tracker = new MonsterTracker();
    });

    it('視認したモンスターを Weight 1.0 (VISIBLE) で追跡登録できる', () => {
        // コカトリス (monOffset: 10, glyph: 10)
        const entry = tracker.updateVisibleMonster(10, 5, 10, { name: 'cockatrice', nameJa: 'コカトリス' });
        expect(entry).toBeDefined();
        expect(entry.monOffset).toBe(10);
        expect(entry.weight).toBe(1.0);
        expect(entry.decayStatus).toBe('VISIBLE');
        expect(entry.inLoS).toBe(true);

        const tracked = tracker.getTrackedMonsters();
        expect(tracked.length).toBe(1);
        expect(tracked[0].name).toBe('cockatrice');
    });

    it('ターン経過に伴い確信度が段階的に減衰する (1.0 -> 0.8 -> 0.4 -> 0.0/削除)', () => {
        tracker.advanceTurn(100);
        tracker.updateVisibleMonster(15, 10, 10, { name: 'cockatrice' });
        
        // 視界外へロスト通知
        tracker.notifyCellLostMonster(15, 10);

        // 1ターン経過 (Δturn = 1) -> Weight 0.8 (NEARBY_UNSEEN)
        tracker.advanceTurn(101);
        let list = tracker.getTrackedMonsters();
        expect(list.length).toBe(1);
        expect(list[0].weight).toBe(0.8);
        expect(list[0].decayStatus).toBe('NEARBY_UNSEEN');

        // 3ターン経過 (Δturn = 3) -> Weight 0.8 (NEARBY_UNSEEN)
        tracker.advanceTurn(103);
        list = tracker.getTrackedMonsters();
        expect(list[0].weight).toBe(0.8);

        // 4ターン経過 (Δturn = 4) -> Weight 0.4 (DECAYING)
        tracker.advanceTurn(104);
        list = tracker.getTrackedMonsters();
        expect(list[0].weight).toBe(0.4);
        expect(list[0].decayStatus).toBe('DECAYING');

        // 7ターン経過 (Δturn = 7) -> Weight 0.4 (DECAYING)
        tracker.advanceTurn(107);
        list = tracker.getTrackedMonsters();
        expect(list[0].weight).toBe(0.4);

        // 8ターン経過 (Δturn = 8) -> 追跡解除 (EXPIRED / 削除)
        tracker.advanceTurn(108);
        list = tracker.getTrackedMonsters();
        expect(list.length).toBe(0);
    });

    it('プレイヤーがモンスターの最終確認位置に侵入した場合、位置不整合として削除される', () => {
        tracker.updateVisibleMonster(20, 10, 28, { name: 'floating eye' });
        expect(tracker.getTrackedMonsters().length).toBe(1);

        tracker.handlePlayerPosition(20, 10);
        expect(tracker.getTrackedMonsters().length).toBe(0);
    });

    it('撃破ログメッセージを受信したとき、該当モンスターが追跡から削除される', () => {
        tracker.updateVisibleMonster(5, 5, 10, { name: 'cockatrice', nameJa: 'コカトリス' });
        tracker.updateVisibleMonster(8, 8, 27, { name: 'gas spore', nameJa: 'ガス胞子' });
        expect(tracker.getTrackedMonsters().length).toBe(2);

        tracker.handleMessage('You kill the cockatrice!');
        const list = tracker.getTrackedMonsters();
        expect(list.length).toBe(1);
        expect(list[0].name).toBe('gas spore');
    });

    it('日本語の撃破メッセージでも削除される', () => {
        tracker.updateVisibleMonster(5, 5, 10, { name: 'cockatrice', nameJa: 'コカトリス' });
        tracker.handleMessage('コカトリスを倒した。');
        expect(tracker.getTrackedMonsters().length).toBe(0);
    });

    it('階層変更時に全追跡データがクリアされる', () => {
        tracker.updateVisibleMonster(5, 5, 10, { name: 'cockatrice' });
        expect(tracker.getTrackedMonsters().length).toBe(1);

        tracker.handleDlevelChange(2);
        expect(tracker.getTrackedMonsters().length).toBe(0);
    });

    it('getPerceivedMonstersSummary: 距離・方角・確信度を含むサマリー一覧が距離順に取得できる', () => {
        tracker.advanceTurn(20);
        
        // プレイヤー位置: (10, 10)
        // 1. 視認中のコカトリス (13, 10) -> 距離 3, 東 (E), Weight 1.0 (100%)
        tracker.updateVisibleMonster(13, 10, 10, { name: 'cockatrice', nameJa: 'コカトリス' });

        // 2. 2ターン前に目撃した浮遊目玉 (10, 5) -> 距離 5, 北 (N), 潜伏中 (Weight 0.8 / 80%)
        tracker.updateVisibleMonster(10, 5, 28, { name: 'floating eye', nameJa: '浮遊する目玉' });
        tracker.notifyCellLostMonster(10, 5);
        tracker.advanceTurn(22);

        const summary = tracker.getPerceivedMonstersSummary({ playerX: 10, playerY: 10, language: 'ja' });
        expect(summary.length).toBe(2);

        // 距離が近い順 (距離3のコカトリスが先頭)
        expect(summary[0].name).toBe('cockatrice');
        expect(summary[0].distance).toBe(3);
        expect(summary[0].direction.name).toBe('東');
        expect(summary[0].confidencePercent).toBe(80); // ターン22に進んだためコカトリスも2ターン経過で80%
        expect(summary[0].statusLabel).toBe('潜伏中');

        expect(summary[1].name).toBe('floating eye');
        expect(summary[1].distance).toBe(5);
        expect(summary[1].direction.name).toBe('北');
    });

    it('同一ターン内に同一種族の敵が複数体（例: ジャッカル3体）存在する場合、すべて個別に追跡・カウントされること', () => {
        tracker.advanceTurn(30);

        // 同一ターンで (10, 5), (10, 6), (12, 8) にそれぞれジャッカル (monOffset: 3) が出現
        tracker.updateVisibleMonster(10, 5, 3, { name: 'jackal', nameJa: 'ジャッカル' });
        tracker.updateVisibleMonster(10, 6, 3, { name: 'jackal', nameJa: 'ジャッカル' });
        tracker.updateVisibleMonster(12, 8, 3, { name: 'jackal', nameJa: 'ジャッカル' });

        const tracked = tracker.getTrackedMonsters();
        expect(tracked.length).toBe(3);

        const summary = tracker.getPerceivedMonstersSummary({ playerX: 10, playerY: 10 });
        expect(summary.length).toBe(3);
    });

    it('視界の出入りを繰り返しても同一モンスターとして引き継がれ、ゴーストが増殖しないこと', () => {
        tracker.advanceTurn(50);

        // 1. コカトリスを視認
        tracker.updateVisibleMonster(10, 5, 10, { name: 'cockatrice', nameJa: 'コカトリス' });
        expect(tracker.getTrackedMonsters().length).toBe(1);

        // 2. 視界外に消える
        tracker.notifyCellLostMonster(10, 5);
        tracker.advanceTurn(51);
        expect(tracker.getTrackedMonsters()[0].decayStatus).toBe('NEARBY_UNSEEN');

        // 3. 移動して別の座標 (14, 5) で再視認
        tracker.updateVisibleMonster(14, 5, 10, { name: 'cockatrice', nameJa: 'コカトリス' });
        
        // ゴーストは増えず、1体のまま (VISIBLE / 100%) に復帰
        const tracked = tracker.getTrackedMonsters();
        expect(tracked.length).toBe(1);
        expect(tracked[0].lastKnownPos).toEqual({ x: 14, y: 5 });
        expect(tracked[0].decayStatus).toBe('VISIBLE');
        expect(tracked[0].weight).toBe(1.0);
    });
});
