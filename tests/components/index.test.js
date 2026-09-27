/**
 * index.test.js
 *
 * @nethack-webui/components パッケージのエクスポートと一括登録の単体テスト。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import {
  NhBaseElement,
  NhFloatingHud,
  NhModal,
  NhPaperdoll,
  NhContainerFiler,
  NhUiConfig,
  COMPONENT_MAP,
  registerAllComponents
} from '../../src/components/index.js';

describe('Web Components Package Index (src/components/index.js)', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    restoreDom();
  });

  it('すべての Web Components クラスが正しくエクスポートされていること', () => {
    expect(NhBaseElement).toBeDefined();
    expect(NhFloatingHud).toBeDefined();
    expect(NhModal).toBeDefined();
    expect(NhPaperdoll).toBeDefined();
    expect(NhContainerFiler).toBeDefined();
    expect(NhUiConfig).toBeDefined();
  });

  it('COMPONENT_MAP に 5 つのコンポーネントが対応付けられていること', () => {
    expect(Object.keys(COMPONENT_MAP)).toEqual([
      'nh-floating-hud',
      'nh-modal',
      'nh-paperdoll',
      'nh-container-filer',
      'nh-ui-config'
    ]);
  });

  it('registerAllComponents で customElements.define が一括実行されること', () => {
    const defineSpy = vi.fn();
    const getSpy = vi.fn(() => null);
    const mockRegistry = {
      define: defineSpy,
      get: getSpy
    };

    registerAllComponents(mockRegistry);

    expect(defineSpy).toHaveBeenCalledTimes(5);
    expect(defineSpy).toHaveBeenCalledWith('nh-floating-hud', NhFloatingHud);
    expect(defineSpy).toHaveBeenCalledWith('nh-modal', NhModal);
    expect(defineSpy).toHaveBeenCalledWith('nh-paperdoll', NhPaperdoll);
    expect(defineSpy).toHaveBeenCalledWith('nh-container-filer', NhContainerFiler);
    expect(defineSpy).toHaveBeenCalledWith('nh-ui-config', NhUiConfig);
  });
});
