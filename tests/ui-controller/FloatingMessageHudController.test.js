import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FloatingMessageHudController,
  LINE_STATE
} from '../../examples/gkl-pure-js-client/modules/controller/FloatingMessageHudController.js';

describe('FloatingMessageHudController (Headless Floating HUD State)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('メッセージの push と最大行数制限・世代更新が正しく行われること', () => {
    const controller = new FloatingMessageHudController({ maxLines: 3 });

    controller.pushMessage({ id: 1, text: 'メッセージ1' });
    controller.pushMessage({ id: 2, text: 'メッセージ2' });

    let lines = controller.getLines();
    expect(lines).toHaveLength(2);
    expect(lines[0].id).toBe(1);
    expect(lines[0].age).toBe(1); // 1つ前
    expect(lines[1].id).toBe(2);
    expect(lines[1].age).toBe(0); // 最新

    // 3行目
    controller.pushMessage({ id: 3, text: 'メッセージ3' });
    expect(controller.getLines()).toHaveLength(3);

    // 4行目（maxLines=3 を超えるため最古の id:1 がドロップ）
    controller.pushMessage({ id: 4, text: 'メッセージ4' });
    lines = controller.getLines();
    expect(lines).toHaveLength(3);
    expect(lines.map(l => l.id)).toEqual([2, 3, 4]);
    expect(lines[2].age).toBe(0);
    expect(lines[0].age).toBe(2);
  });

  it('同一IDメッセージの連続push時に新規追加ではなく内容更新されること', () => {
    const controller = new FloatingMessageHudController({ maxLines: 3 });
    controller.pushMessage({ id: 1, text: '攻撃！' });
    controller.pushMessage({ id: 1, text: '会心の一撃！', isBold: true });

    const lines = controller.getLines();
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('会心の一撃！');
    expect(lines[0].isBold).toBe(true);
  });

  it('ユーザー操作時に active から stale への移行およびフェード猶予タイマーが動作すること', () => {
    const controller = new FloatingMessageHudController({
      maxLines: 5,
      fadeDelayAfterActionMs: 2000
    });

    controller.pushMessage({ id: 1, text: '敵を発見' });
    expect(controller.getLines()[0].state).toBe(LINE_STATE.ACTIVE);

    // ユーザー操作発生 -> stale
    controller.notifyUserAction();
    expect(controller.getLines()[0].state).toBe(LINE_STATE.STALE);

    // 2000ms 経過後 -> fadeLine (FADING) へ移行
    vi.advanceTimersByTime(2000);
    expect(controller.getLines()[0].state).toBe(LINE_STATE.FADING);
  });

  it('連続したユーザー操作時に stale な行が即座に FADING へ移行すること', () => {
    const controller = new FloatingMessageHudController({
      maxLines: 5,
      fadeDelayAfterActionMs: 2000
    });

    controller.pushMessage({ id: 1, text: '行1' });
    controller.notifyUserAction(); // 行1 は stale
    expect(controller.getLines()[0].state).toBe(LINE_STATE.STALE);

    // 連続操作 -> 即座に FADING へ移行
    controller.notifyUserAction();
    expect(controller.getLines()[0].state).toBe(LINE_STATE.FADING);
  });
});
