import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TILE_SIZE,
  ATLAS_COLS,
  DEFAULT_TILE_FILENAME,
  FALLBACK_TILE_FILENAME,
  getTileCandidatePaths,
  getDefaultTilePath,
  getConfiguredTileSource,
  setConfiguredTileSource,
  STORAGE_KEY_TILE_IMAGE
} from '../../examples/gkl-pure-js-client/modules/config/TileConfig.js';

describe('TileConfig - タイル設定・パス解決管理', () => {
  const mockStorage = new Map();
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    mockStorage.clear();
    globalThis.localStorage = {
      getItem: (key) => mockStorage.get(key) || null,
      setItem: (key, val) => mockStorage.set(key, String(val)),
      removeItem: (key) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    };
  });

  afterEach(() => {
    if (originalLocalStorage) {
      globalThis.localStorage = originalLocalStorage;
    } else {
      delete globalThis.localStorage;
    }
  });

  it('1. 定数が正しく定義されていること', () => {
    expect(TILE_SIZE).toBe(32);
    expect(ATLAS_COLS).toBe(40);
    expect(DEFAULT_TILE_FILENAME).toBe('nethack_default_32_tr.png');
    expect(FALLBACK_TILE_FILENAME).toBe('nethack_default_32.png');
    expect(getDefaultTilePath()).toBe('../../pict/nethack_default_32_tr.png');
  });

  it('2. デフォルトの探索候補パスリストを正しく生成すること', () => {
    const candidates = getTileCandidatePaths();
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);

    // デフォルトの透過版候補が含まれていること
    expect(candidates).toContain('../../pict/nethack_default_32_tr.png');
    expect(candidates).toContain('pict/nethack_default_32_tr.png');
    expect(candidates).toContain('/pict/nethack_default_32_tr.png');

    // 不透明版フォールバック候補が含まれていること
    expect(candidates).toContain('../../pict/nethack_default_32.png');
    expect(candidates).toContain('pict/nethack_default_32.png');
  });

  it('3. 明示的なカスタムタイル指定時に、それを最優先候補に含めること', () => {
    const custom = 'my_custom_tiles_32.png';
    const candidates = getTileCandidatePaths(custom);

    expect(candidates[0]).toBe(`../../pict/${custom}`);
    expect(candidates).toContain(`pict/${custom}`);
    // デフォルト候補もフォールバックとして後方に残っていること
    expect(candidates).toContain('../../pict/nethack_default_32_tr.png');
  });

  it('4. 絶対URL (https://...) が指定された場合はプレフィックス付与せずそのまま最優先にすること', () => {
    const url = 'https://example.com/custom_tiles.png';
    const candidates = getTileCandidatePaths(url);

    expect(candidates[0]).toBe(url);
    // デフォルトもフォールバックとして含む
    expect(candidates).toContain('../../pict/nethack_default_32_tr.png');
  });

  it('5. localStorage に保存された設定を優先解決できること', () => {
    setConfiguredTileSource('stored_custom_tiles.png');
    expect(getConfiguredTileSource()).toBe('stored_custom_tiles.png');

    const candidates = getTileCandidatePaths();
    expect(candidates[0]).toBe('../../pict/stored_custom_tiles.png');

    setConfiguredTileSource(null);
    expect(getConfiguredTileSource()).toBeNull();
  });
});
