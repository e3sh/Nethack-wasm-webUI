/**
 * TileConfig.js - NetHack GlyphTile 設定およびタイルリソース解決モジュール
 *
 * NetHack 5.0 準拠の 32x32px (40列アトラス) GlyphTile 画像のパス解決・フォールバック
 * および外部コンフィグ/URL/LocalStorage からのタイル差し替えを一元管理します。
 */

export const TILE_SIZE = 32;
export const ATLAS_COLS = 40;

export const DEFAULT_TILE_FILENAME = 'nethack_default_32_tr.png';
export const FALLBACK_TILE_FILENAME = 'nethack_default_32.png';

export const STORAGE_KEY_TILE_IMAGE = 'nethack_tile_image';

/**
 * プレフィックス候補リスト（環境に応じた相対パス・絶対パスの違いを吸収）
 */
const BASE_PATH_CANDIDATES = [
  '../../pict/',
  '../../assets/',
  'pict/',
  'assets/',
  '/pict/',
  '/assets/'
];

/**
 * 設定・URLパラメータ・LocalStorage からカスタムタイルの指定を取得します。
 * @param {string|null} [explicitTile] - 明示的なタイル指定
 * @returns {string|null}
 */
export function getConfiguredTileSource(explicitTile = null) {
  if (explicitTile && typeof explicitTile === 'string' && explicitTile.trim().length > 0) {
    return explicitTile.trim();
  }

  const globalScope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);

  if (globalScope) {
    try {
      // 1. URL クエリパラメータ (?tile=...)
      if (globalScope.location && globalScope.location.search) {
        const params = new URLSearchParams(globalScope.location.search);
        const tileParam = params.get('tile') || params.get('tileset');
        if (tileParam && tileParam.trim().length > 0) {
          return tileParam.trim();
        }
      }

      // 2. localStorage
      const storage = globalScope.localStorage;
      if (storage && typeof storage.getItem === 'function') {
        const stored = storage.getItem(STORAGE_KEY_TILE_IMAGE);
        if (stored && stored.trim().length > 0) {
          return stored.trim();
        }
      }
    } catch (e) {
      // セキュリティ制限やサンドボックス環境での例外を無視
    }
  }

  return null;
}

/**
 * 指定されたファイル名またはパスから探索候補リストを生成します。
 * @param {string} filenameOrPath
 * @returns {string[]}
 */
function buildPathCandidates(filenameOrPath) {
  if (!filenameOrPath) return [];

  // 完全なURL (http, https, data, blob) やルート絶対パス (/ から始まるパス)
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(filenameOrPath)) {
    return [filenameOrPath];
  }

  // すでにパス区切りを含む場合、その指定そのものを最優先
  const list = [];
  if (filenameOrPath.includes('/') || filenameOrPath.includes('\\')) {
    const normalized = filenameOrPath.replace(/\\/g, '/');
    list.push(normalized);
  }

  // ファイル名部分だけを抽出して各ベースパステンプレートに適用
  const baseName = filenameOrPath.split(/[/\\]/).pop();
  for (const prefix of BASE_PATH_CANDIDATES) {
    const full = `${prefix}${baseName}`;
    if (!list.includes(full)) {
      list.push(full);
    }
  }

  return list;
}

/**
 * タイル画像の探索候補パスリストを解決します。
 * カスタム指定があればそれを最優先し、デフォルトの透過タイル・不透明タイルをフォールバックとして連結します。
 * 
 * @param {string|null} [customSource] - 明示的なタイル画像パス/ファイル名
 * @returns {string[]} 重複のないロード候補パス配列
 */
export function getTileCandidatePaths(customSource = null) {
  const configured = getConfiguredTileSource(customSource);
  const candidates = [];

  if (configured) {
    const customList = buildPathCandidates(configured);
    for (const p of customList) {
      if (!candidates.includes(p)) candidates.push(p);
    }
  }

  // デフォルト（透過版）
  const defaultList = buildPathCandidates(DEFAULT_TILE_FILENAME);
  for (const p of defaultList) {
    if (!candidates.includes(p)) candidates.push(p);
  }

  // フォールバック（不透明版）
  const fallbackList = buildPathCandidates(FALLBACK_TILE_FILENAME);
  for (const p of fallbackList) {
    if (!candidates.includes(p)) candidates.push(p);
  }

  return candidates;
}

/**
 * 最も一般的な既定タイルパスを返します（HTML埋め込みや初期プロパティ用）。
 * @returns {string}
 */
export function getDefaultTilePath() {
  return `../../pict/${DEFAULT_TILE_FILENAME}`;
}

/**
 * カスタムタイルの設定を保存します。
 * @param {string} tilePathOrUrl
 */
export function setConfiguredTileSource(tilePathOrUrl) {
  const globalScope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  const storage = globalScope?.localStorage;
  if (storage && typeof storage.setItem === 'function') {
    try {
      if (tilePathOrUrl) {
        storage.setItem(STORAGE_KEY_TILE_IMAGE, tilePathOrUrl);
      } else {
        storage.removeItem(STORAGE_KEY_TILE_IMAGE);
      }
    } catch (e) {
      console.warn('[TileConfig] Failed to save tile source to localStorage:', e);
    }
  }
}
