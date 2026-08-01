/**
 * param/tileMapping.js (グローバル関数 window.tileMapping) を
 * TypeScript / ES モジュールとして安全に呼び出すための ESM ラッパー
 */
export function getTileMapping(): Record<number, number> {
  if (typeof (window as any).tileMapping === 'function') {
    return (window as any).tileMapping();
  }
  return {};
}
