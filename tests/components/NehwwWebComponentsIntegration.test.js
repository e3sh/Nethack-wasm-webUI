/**
 * NehwwWebComponentsIntegration.test.js
 *
 * Phase E Step 4: Nehww への Web Components 逆輸入・連携検証テスト
 * - <nh-floating-hud> と FloatingMessageHud の連携
 * - <nh-modal> と PaperdollModal / ContainerModal の開閉同期
 * - <nh-ui-config> と UIConfigStore の双方向バインド
 * - KeyHandler と ModalStackController の <nh-modal> 注入連携
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom, createMockNode } from './testElementHelper.js';
import { FloatingMessageHud } from '../../examples/gkl-pure-js-client/modules/components/FloatingMessageHud.js';
import { PaperdollModal } from '../../examples/gkl-pure-js-client/modules/components/PaperdollModal.js';
import { ContainerModal } from '../../examples/gkl-pure-js-client/modules/components/ContainerModal.js';
import { KeyHandler } from '../../examples/gkl-pure-js-client/modules/handlers/KeyHandler.js';
import { UIConfigStore, PRESETS, ModalStackController } from '../../src/ui-controller/index.js';
import { NhFloatingHud, NhModal, NhUiConfig } from '../../src/components/index.js';

describe('Nehww Web Components Integration (Step 4 逆輸入連携)', () => {
  let restoreDom;

  beforeEach(() => {
    vi.useFakeTimers();
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    if (restoreDom) restoreDom();
  });

  it('1. FloatingMessageHud が <nh-floating-hud> インスタンスと連携し、メッセージが反映されること', () => {
    const nhHud = new NhFloatingHud();
    nhHud.connectedCallback();

    const hud = new FloatingMessageHud({
      container: nhHud,
      maxLines: 3,
      fadeTimeoutMs: 1000
    });

    expect(hud.isWebComponent).toBe(true);

    hud.pushMessage({ id: 101, text: 'The door opens.', isBold: true });
    expect(nhHud.controller.getLines().length).toBe(1);
    expect(nhHud.controller.getLines()[0].text).toBe('The door opens.');
    expect(nhHud.controller.getLines()[0].isBold).toBe(true);

    hud.updateMessage({ id: 101, text: 'The door slams shut!' });
    expect(nhHud.controller.getLines()[0].text).toBe('The door slams shut!');

    hud.notifyUserAction();
    expect(nhHud.controller.getLines()[0].state).toBe('stale');

    hud.clear();
    expect(nhHud.controller.getLines().length).toBe(0);
  });

  it('2. PaperdollModal の show/hide が <nh-modal> の open 属性と同期すること', () => {
    const nhModal = new NhModal();
    nhModal.modalId = 'paperdoll';

    const innerDiv = createMockNode('div');
    innerDiv.id = 'paperdoll-modal';
    innerDiv.classList.add('hidden');
    innerDiv.closest = vi.fn((sel) => sel === 'nh-modal' ? nhModal : null);

    const paperdoll = new PaperdollModal({
      elPaperdollModal: innerDiv,
      getCore: () => null
    });

    expect(paperdoll.nhModal).toBe(nhModal);

    // show
    paperdoll.show();
    expect(paperdoll.isVisible).toBe(true);
    expect(nhModal.open).toBe(true);
    expect(innerDiv.classList.contains('hidden')).toBe(false);

    // hide
    paperdoll.hide();
    expect(paperdoll.isVisible).toBe(false);
    expect(nhModal.open).toBe(false);
    expect(innerDiv.classList.contains('hidden')).toBe(true);
  });

  it('3. ContainerModal の show/hide が <nh-modal> の open 属性と同期すること', () => {
    const nhModal = new NhModal();
    nhModal.modalId = 'container';

    const innerDiv = createMockNode('div');
    innerDiv.id = 'container-modal';
    innerDiv.classList.add('hidden');
    innerDiv.closest = vi.fn((sel) => sel === 'nh-modal' ? nhModal : null);

    const containerModal = new ContainerModal({
      elContainerModal: innerDiv,
      getCore: () => null
    });

    expect(containerModal.nhModal).toBe(nhModal);

    containerModal.show({ containerName: 'Chest', contents: [] });
    expect(containerModal.isVisible).toBe(true);
    expect(nhModal.open).toBe(true);

    containerModal.hide();
    expect(containerModal.isVisible).toBe(false);
    expect(nhModal.open).toBe(false);
  });

  it('4. <nh-ui-config> と UIConfigStore の双方向バインドが機能すること', () => {
    const store = new UIConfigStore();
    const nhConfig = new NhUiConfig();
    nhConfig.setConfigStore(store);

    let notifiedConfig = null;
    nhConfig.addEventListener('config-change', (e) => {
      notifiedConfig = e.detail.config;
    });

    // Web Component 側から変更
    nhConfig.setConfig('panelInventory', false);
    expect(store.get().panelInventory).toBe(false);
    expect(notifiedConfig.panelInventory).toBe(false);

    // Store 側から変更
    store.setProperty('panelActions', false);
    expect(nhConfig.getConfig().panelActions).toBe(false);

    // プリセット適用
    store.applyPreset(PRESETS.CLASSIC);
    expect(nhConfig.getConfig().preset).toBe(PRESETS.CLASSIC);
    expect(nhConfig.getConfig().panelInventory).toBe(false);
  });

  it('5. KeyHandler が <nh-modal> 要素へ modalStack を自動注入できること', () => {
    const nhModal = new NhModal();
    nhModal.modalId = 'settings';
    nhModal.setModalStack = vi.fn();

    document.body.appendChild(nhModal);

    const keyHandler = new KeyHandler({});
    expect(nhModal.setModalStack).toHaveBeenCalledWith(keyHandler.modalStack);
    expect(keyHandler.modalStack.modals.has('settings')).toBe(true);
  });
});
