import { describe, it, expect, beforeEach } from 'vitest';
import { StatusView } from '../../examples/gkl-pure-js-client/modules/components/StatusView.js';

describe('StatusView - renderGklAttributes 種族・ロール表示機能', () => {
  let statusView;
  let elementsMap;

  beforeEach(() => {
    elementsMap = {
      'status-attr-detail': { innerHTML: '' },
      'status-attr-badges': { innerHTML: '' },
      'status-bar': { classList: { toggle: () => {} } }
    };

    globalThis.document = {
      getElementById: (id) => elementsMap[id] || null
    };

    statusView = new StatusView({
      elStatusBar: elementsMap['status-bar'],
      getCore: () => null
    });
  });

  it('未同期（isSynced: false）時は「検出中...」タグが表示されること', () => {
    statusView.renderGklAttributes({
      isSynced: false,
      characterSummary: null,
      activeResistances: []
    });

    const html = elementsMap['status-attr-detail'].innerHTML;
    expect(html).toContain('👤 [種族・職業: 検出中...]');
    expect(html).toContain('detecting');
  });

  it('同期完了時（Human Barbarian Lv.1）に「人間 / 野蛮人 Lv.1」と毒耐性バッジが表示されること', () => {
    statusView.renderGklAttributes({
      isSynced: true,
      characterSummary: {
        race: 'human',
        role: 'barbarian',
        displayTagJa: '👤 [人間 / 野蛮人 Lv.1]',
        displayTagEn: '👤 [Human / Barbarian Lv.1]'
      },
      activeResistances: [{ key: 'poison', label: '🧪毒', en: 'Poison' }]
    });

    const elContainer = elementsMap['status-attr-detail'];
    expect(elContainer.innerHTML).toContain('👤 [人間 / 野蛮人 Lv.1]');
    expect(elContainer.innerHTML).toContain('🧪毒');
  });

  it('女性別名職（Cavewoman / 洞窟の女）が正しく日本語表示されること', () => {
    statusView.renderGklAttributes({
      isSynced: true,
      characterSummary: {
        race: 'dwarf',
        role: 'caveman',
        displayTagJa: '👤 [ドワーフ / 洞窟の女 Lv.1]',
        displayTagEn: '👤 [Dwarf / Cavewoman Lv.1]'
      },
      activeResistances: [{ key: 'infravision', label: '🌙暗視', en: 'Infravision' }]
    });

    const html = elementsMap['status-attr-detail'].innerHTML;
    expect(html).toContain('👤 [ドワーフ / 洞窟の女 Lv.1]');
    expect(html).toContain('🌙暗視');
  });

  it('英語モード（currentLanguage = "en"）で英語名が表示されること', () => {
    statusView.setLanguage('en');
    statusView.renderGklAttributes({
      isSynced: true,
      characterSummary: {
        race: 'elf',
        role: 'monk',
        displayTagJa: '👤 [エルフ / 修道士 Lv.3]',
        displayTagEn: '👤 [Elf / Monk Lv.3]'
      },
      activeResistances: [
        { key: 'sleep', label: '💤睡眠', en: 'Sleep' },
        { key: 'fast', label: '⚡俊足', en: 'Fast' }
      ]
    });

    const html = elementsMap['status-attr-detail'].innerHTML;
    expect(html).toContain('👤 [Elf / Monk Lv.3]');
    expect(html).toContain('Resistances:');
    expect(html).toContain('Sleep');
  });

  it('初期耐性なし（観光客 Tourist Lv.1）でも種族・ロールタグと「属性耐性: なし」が表示されること', () => {
    statusView.renderGklAttributes({
      isSynced: true,
      characterSummary: {
        race: 'human',
        role: 'tourist',
        displayTagJa: '👤 [人間 / 観光客 Lv.1]',
        displayTagEn: '👤 [Human / Tourist Lv.1]'
      },
      activeResistances: []
    });

    const html = elementsMap['status-attr-detail'].innerHTML;
    expect(html).toContain('👤 [人間 / 観光客 Lv.1]');
    expect(html).toContain('属性耐性: なし');
  });
});
