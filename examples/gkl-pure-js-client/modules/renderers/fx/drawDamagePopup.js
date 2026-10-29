/**
 * @file drawDamagePopup.js
 * @description 浮遊ダメージ数値の共通描画 (MainViewport / Zoom / HD-2D オーバーレイで共有)
 */

/**
 * 浮遊ダメージ数値の共通描画
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ text:string, color:string, scale?:number, stackIndex?:number }} fx
 * @param {number} screenX セル左上 X
 * @param {number} screenY セル左上 Y
 * @param {number} ts タイルサイズ
 * @param {number} progress 0..1
 */
export function drawDamagePopup(ctx, fx, screenX, screenY, ts, progress) {
  if (!ctx || !fx || !fx.text) return;
  const easeOut = 1 - Math.pow(1 - progress, 2);
  const alpha = Math.max(0, 1 - progress);
  const stackOffset = (fx.stackIndex || 0) * ts * 0.35; // 同一セルでの重なり回避
  const textX = screenX + ts / 2;
  const textY = screenY + ts * 0.25 - easeOut * ts * 0.75 - stackOffset;
  const fontSize = Math.max(12, Math.round(ts * 0.45 * (fx.scale || 1)));

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${fontSize}px monospace, sans-serif`;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.strokeText(fx.text, textX, textY);
  ctx.fillStyle = fx.color || '#fff59d';
  ctx.fillText(fx.text, textX, textY);
  ctx.restore();
}
