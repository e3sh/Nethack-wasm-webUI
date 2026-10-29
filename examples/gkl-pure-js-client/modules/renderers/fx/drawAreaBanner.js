/**
 * @file drawAreaBanner.js
 * @description ダンジョンブランチ突入バナー (AREA_ENTERED) の共通描画 (MainViewport / Zoom / HD-2D オーバーレイで共有)
 */

export const AREA_BANNER_THEMES = {
  dungeon:   { accent: '#94a3b8', border: 'rgba(148, 163, 184, 0.75)', glow: '#64748b' },
  cave:      { accent: '#fbbf24', border: 'rgba(251, 191, 36, 0.85)',  glow: '#f59e0b' },
  hell:      { accent: '#f87171', border: 'rgba(239, 68, 68, 0.85)',   glow: '#dc2626' },
  puzzle:    { accent: '#38bdf8', border: 'rgba(56, 189, 248, 0.85)',  glow: '#0284c7' },
  quest:     { accent: '#c084fc', border: 'rgba(192, 132, 252, 0.85)', glow: '#9333ea' },
  gold:      { accent: '#facc15', border: 'rgba(250, 204, 21, 0.85)',  glow: '#ca8a04' },
  vampire:   { accent: '#ef4444', border: 'rgba(220, 38, 38, 0.85)',   glow: '#991b1b' },
  celestial: { accent: '#2dd4bf', border: 'rgba(45, 212, 191, 0.85)',  glow: '#0d9488' },
  tutorial:  { accent: '#4ade80', border: 'rgba(74, 222, 128, 0.85)',  glow: '#16a34a' }
};

/**
 * バナーの進行度 (0..1) からフェードイン・ホールド・フェードアウトのアルファ値を算出
 * @param {number} progress 0..1
 * @returns {number} 0..1
 */
export function computeAreaBannerAlpha(progress) {
  if (typeof progress !== 'number' || isNaN(progress)) return 0;
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.15) {
    return p / 0.15;
  }
  if (p <= 0.80) {
    return 1.0;
  }
  return Math.max(0, (1.0 - p) / 0.20);
}

/**
 * エリア突入バナー (AREA_ENTERED) の Canvas オーバーレイ描画
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} fx
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {number} progress 0..1
 * @param {string} [lang='ja']
 */
export function drawAreaBanner(ctx, fx, canvasW, canvasH, progress, lang = 'ja') {
  if (!ctx || !fx || canvasW <= 0 || canvasH <= 0) return;

  const alpha = computeAreaBannerAlpha(progress);
  if (alpha <= 0) return;

  const isEn = lang === 'en';
  const mainTitle = isEn
    ? (fx.title || fx.titleJa || 'Dungeon')
    : (fx.titleJa || fx.title || 'ダンジョン');

  let subTitle = '';
  if (isEn) {
    subTitle = fx.subtitle || (fx.dlevel ? `Level ${fx.dlevel}` : '');
  } else {
    const levelStr = fx.subtitleJa || fx.subtitle || (fx.dlevel ? `Level ${fx.dlevel}` : '');
    if (fx.title && fx.titleJa && fx.title !== fx.titleJa) {
      subTitle = levelStr ? `${fx.title} — ${levelStr}` : fx.title;
    } else {
      subTitle = levelStr;
    }
  }

  const themePalette = AREA_BANNER_THEMES[fx.theme] || AREA_BANNER_THEMES.dungeon;
  const slideOffset = progress < 0.15 ? (1 - progress / 0.15) * -10 : 0;

  const cx = Math.round(canvasW / 2);
  const cy = Math.round(Math.max(48, Math.min(96, canvasH * 0.22)) + slideOffset);
  const bannerW = Math.min(Math.round(canvasW * 0.72), 420);
  const bannerH = subTitle ? 54 : 40;
  const left = Math.round(cx - bannerW / 2);
  const top = Math.round(cy - bannerH / 2);

  ctx.save();
  ctx.globalAlpha = alpha;

  // 背景プレート
  ctx.fillStyle = 'rgba(9, 13, 24, 0.86)';
  ctx.fillRect(left, top, bannerW, bannerH);

  // 上下の装飾アクセントライン
  ctx.strokeStyle = themePalette.border;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = themePalette.glow;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left + bannerW, top);
  ctx.moveTo(left, top + bannerH);
  ctx.lineTo(left + bannerW, top + bannerH);
  ctx.stroke();

  // メインタイトル
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 16px "Segoe UI", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(mainTitle, cx, subTitle ? top + 20 : cy);

  // サブタイトル (英語ブランチ名 + 階層)
  if (subTitle) {
    ctx.shadowBlur = 0;
    ctx.font = '600 11px monospace, sans-serif';
    ctx.fillStyle = themePalette.accent;
    ctx.fillText(subTitle, cx, top + 40);
  }

  ctx.restore();
}
