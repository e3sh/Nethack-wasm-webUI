/**
 * @file VisualFxDispatcher.js
 * @description GKL Pure JS Client の視覚演出 (Visual FX) ディスパッチャー (2D Canvas & WebGPU HD-2D 両対応)
 */

export class VisualFxDispatcher {
  /**
   * @param {Object} client - GklPureJSClient インスタンス参照
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * 2D および WebGPU HD-2D レンダラーへ共通 FX オブジェクトを登録
   * @param {Object} fxObj
   */
  dispatchFx(fxObj) {
    this.client.mainViewportRenderer?.addVisualFx(fxObj);
    if (this.client.webgpuRenderer) {
      this.client.webgpuRenderer.addVisualFx(fxObj);
    }
  }

  /**
   * 画面シェイク (揺れ) 演出を登録
   * @param {number} intensity - 揺れの強さ (ピクセル)
   * @param {number} duration - 持続時間 (ミリ秒)
   */
  dispatchShake(intensity, duration) {
    this.client.mainViewportRenderer?.triggerScreenShake(intensity, duration);
    if (this.client.webgpuRenderer) {
      this.client.webgpuRenderer.triggerScreenShake(intensity, duration);
    }
  }

  /**
   * Core からの 'fx_trigger' イベントをディスパッチ
   * @param {Object} fx - FX イベント定義
   */
  handleFxTrigger(fx) {
    if (!fx || !fx.type) return;
    const now = performance.now();
    const renderer = this.client.mainViewportRenderer;
    const webgpu = this.client.webgpuRenderer;

    if (fx.type === 'ATTACK_HIT') {
      this.dispatchFx({
        type: 'SLASH',
        gx: fx.targetX,
        gy: fx.targetY,
        startTime: now,
        durationMs: 130,
        color: '#ffffff'
      });
    } else if (fx.type === 'DAMAGE_TAKEN') {
      this.dispatchFx({
        type: 'DAMAGE_FLASH',
        gx: fx.targetX,
        gy: fx.targetY,
        followPlayer: true,
        amount: fx.amount,
        startTime: now,
        durationMs: 500,
        color: '#ff1744'
      });
      this.dispatchShake(3, 100);
    } else if (fx.type === 'DAMAGE_DEALT') {
      const ratio = (fx.maxHp && fx.maxHp > 0) ? (fx.amount / fx.maxHp) : 0;
      const isCritical = !fx.isKill && ratio >= 0.5;
      const color = fx.isTame ? '#4dd0e1'          // ペット被弾: シアン
        : fx.isPeaceful ? '#b0bec5'                // 平和モンスター: グレー
        : fx.isKill ? '#ff9100'                    // 撃破: オレンジ
        : isCritical ? '#ffea00'                   // 大ダメージ: 明るい黄色
        : '#fff59d';                               // 通常: 淡い黄色
      this.dispatchFx({
        type: 'DAMAGE_POPUP',
        gx: fx.targetX,
        gy: fx.targetY,
        followPlayer: false,
        amount: fx.amount,
        text: `-${fx.amount}`,
        color,
        scale: (fx.isKill || isCritical) ? 1.3 : 1.0,
        startTime: now,
        durationMs: fx.isKill ? 700 : 550
      });
      if (isCritical) this.dispatchShake(1, 80);
    } else if (fx.type === 'KILL_CONFIRMED') {
      this.dispatchFx({
        type: 'KILL_BURST',
        gx: fx.targetX,
        gy: fx.targetY,
        startTime: now,
        durationMs: 200,
        color: '#ffd700'
      });
    } else if (fx.type === 'RECOVER_HEAL') {
      this.dispatchFx({
        type: 'HEAL_RING',
        gx: fx.targetX,
        gy: fx.targetY,
        followPlayer: true,
        amount: fx.amount,
        startTime: now,
        durationMs: 500,
        color: '#00e676'
      });
    } else if (fx.type === 'PLAYER_DIED') {
      if (renderer) {
        renderer.isPlayerDead = true;
        renderer.deathPosition = { x: fx.targetX, y: fx.targetY };
      }
      if (webgpu) {
        webgpu.isPlayerDead = true;
        webgpu.deathPosition = { x: fx.targetX, y: fx.targetY };
      }
      this.dispatchShake(5, 300);
      this.dispatchFx({
        type: 'DEATH_BURST',
        gx: fx.targetX,
        gy: fx.targetY,
        followPlayer: true,
        startTime: now,
        durationMs: 1200,
        color: '#ef4444'
      });
      if (fx.targetX !== undefined && fx.targetY !== undefined && renderer) {
        renderer.redrawSingleCell(fx.targetX, fx.targetY);
      }
      webgpu?.markDirty();
      webgpu?.wakeUp();
    } else if (fx.type === 'PLAYER_RESURRECTED') {
      const prevDeathPos = renderer?.deathPosition;
      if (renderer) {
        renderer.isPlayerDead = false;
        renderer.deathPosition = null;
      }
      if (webgpu) {
        webgpu.isPlayerDead = false;
        webgpu.deathPosition = null;
      }
      this.dispatchFx({
        type: 'HEAL_RING',
        gx: fx.targetX,
        gy: fx.targetY,
        followPlayer: true,
        startTime: now,
        durationMs: 400,
        color: '#ffd700'
      });
      if (prevDeathPos && renderer) {
        renderer.redrawSingleCell(prevDeathPos.x, prevDeathPos.y);
      }
      webgpu?.markDirty();
      webgpu?.wakeUp();
    } else if (fx.type === 'AREA_ENTERED') {
      const durationMs = fx.bannerDurationMs || fx.durationMs || 4000;
      this.dispatchFx({
        type: 'AREA_ENTERED',
        branchId: fx.branchId,
        floorKey: fx.floorKey,
        dlevel: fx.dlevel,
        title: fx.title,
        titleJa: fx.titleJa,
        subtitle: fx.subtitle,
        subtitleJa: fx.subtitleJa,
        theme: fx.theme || 'dungeon',
        startTime: now,
        durationMs
      });
      webgpu?.wakeUp();
    }
  }
}
