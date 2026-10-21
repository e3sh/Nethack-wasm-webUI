import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from '../components/testElementHelper.js';
import { FloorTrackerModal } from '../../examples/gkl-pure-js-client/modules/components/FloorTrackerModal.js';
import { FloorMarkerService } from '../../src/core/knowledge/services/FloorMarkerService.js';

describe('FloorTrackerModal', () => {
  let restoreDom;
  let modal;
  let mockCore;
  let mockMarkerService;
  let mockOverview;

  beforeEach(() => {
    restoreDom = setupMockDom();

    const elModal = document.createElement('div');
    elModal.id = 'floor-tracker-modal';
    elModal.className = 'modal-backdrop hidden';
    document.body.appendChild(elModal);

    mockOverview = [
      {
        dnum: 0,
        dlevel: 1,
        branchId: 'dungeon',
        branchName: 'Dungeons of Doom',
        branchNameJa: '運命の迷宮',
        floorKey: 'Dlvl:1',
        features: { fountains: 1, shops: 0, altars: 0 },
        flags: {},
        annotation: ''
      },
      {
        dnum: 0,
        dlevel: 3,
        branchId: 'dungeon',
        branchName: 'Dungeons of Doom',
        branchNameJa: '運命の迷宮',
        floorKey: 'Dlvl:3',
        features: {
          fountains: 0,
          shops: 1,
          shopName: 'General Store',
          shopNameJa: '一般商店',
          altars: 1,
          altarAlign: 'neutral',
          altarAlignJa: '中立'
        },
        flags: { oracle: false },
        annotation: 'Base !M:154C'
      }
    ];

    mockCore = {
      getStatus: vi.fn(() => ({
        dlevel: { dlevel: 3, text: 'Dlvl:3' }
      })),
      gkl: {
        areaStateManager: {
          currentDnum: 0,
          currentDlevel: 3,
          currentBranchId: 'dungeon',
          playerSummary: {
            branchName: 'Dungeons of Doom',
            branchNameJa: '運命の迷宮',
            floorKey: 'Dlvl:3'
          },
          playerX: 42,
          playerY: 12
        }
      },
      getDungeonOverview: vi.fn(() => mockOverview),
      syncDungeonOverviewOnDemand: vi.fn(async () => mockOverview),
      annotateFloor: vi.fn(async () => true),
      on: vi.fn()
    };

    const store = new Map();
    const mockStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    };
    mockMarkerService = new FloorMarkerService({ storage: mockStorage });

    modal = new FloorTrackerModal({
      elModal,
      getCore: () => mockCore,
      floorMarkerService: mockMarkerService,
      language: 'ja'
    });
  });

  afterEach(() => {
    if (restoreDom) restoreDom();
  });

  it('初期化時にモーダル DOM が存在し、非表示状態であること', () => {
    expect(modal.elModal).toBeTruthy();
    expect(modal.isOpen()).toBe(false);
    expect(modal.elModal.classList.contains('hidden')).toBe(true);
  });

  it('open() 時にオンデマンド同期が呼ばれ、現在フロアが選択されて描画されること', async () => {
    await modal.open();
    expect(mockCore.syncDungeonOverviewOnDemand).toHaveBeenCalled();
    expect(modal.isOpen()).toBe(true);
    expect(modal.selectedFloorKey).toBe('Dlvl:3');

    // 観測施設 (中立祭壇、一般商店) が表示されていること
    const html = modal.elModal.innerHTML;
    expect(html).toContain('祭壇 (中立)');
    expect(html).toContain('一般商店');
    expect(html).toContain('(X: 42, Y: 12)');
  });

  it('現在地ピン打ちボタンをクリックするとドラフトにマーカーが追加されること', async () => {
    await modal.open();
    // 既存のマーカー: Base !M:154C (type: 1, x: 42, y: 12)
    expect(modal.draftMarkers).toHaveLength(1);

    // [🚩 拠点・デポ] (ID 0) をクリック
    const btnBase = modal.elModal.querySelector('.quick-tag-btn[data-slot-id="0"]');
    expect(btnBase).toBeTruthy();
    btnBase.click();

    expect(modal.draftMarkers).toHaveLength(2);
    expect(modal.draftMarkers[1]).toEqual({
      type: 0,
      x: 42,
      y: 12
    });
  });

  it('マーカー削除ボタンをクリックするとドラフトから削除されること', async () => {
    await modal.open();
    expect(modal.draftMarkers).toHaveLength(1);

    const deleteBtn = modal.elModal.querySelector('.marker-delete-btn[data-marker-index="0"]');
    expect(deleteBtn).toBeTruthy();
    deleteBtn.click();

    expect(modal.draftMarkers).toHaveLength(0);
  });

  it('保存ボタンをクリックすると core.annotateFloor が正しいフォーマット文字列で呼ばれること', async () => {
    await modal.open();
    // 現在ドラフト: memo="Base", markers=[{type:1, x:42, y:12}] -> !M:154C
    const saveBtn = modal.elModal.querySelector('#ft-btn-save');
    expect(saveBtn).toBeTruthy();
    expect(saveBtn.disabled).toBe(false);

    await modal.saveAnnotation();
    expect(mockCore.annotateFloor).toHaveBeenCalledWith('Base !M:154C');
  });

  it('他フロア (Dlvl:1) を選択した際はピン打ちボタンが無効化され注意が表示されること', async () => {
    await modal.open();
    const select = modal.elModal.querySelector('#ft-floor-select');
    expect(select).toBeTruthy();

    select.value = 'Dlvl:1';
    select.dispatchEvent({ type: 'change', target: select });

    expect(modal.selectedFloorKey).toBe('Dlvl:1');
    const html = modal.elModal.innerHTML;
    expect(html).toContain('現在滞在しているフロアでのみ行えます');

    const saveBtn = modal.elModal.querySelector('#ft-btn-save');
    expect(saveBtn.disabled).toBe(true);
  });

  it('setLanguage で英語と日本語を切り替えられること', async () => {
    await modal.open();
    modal.setLanguage('en');
    expect(modal.elModal.innerHTML).toContain('Floor Tracker & Markers');
    expect(modal.elModal.innerHTML).toContain('Observed Features & Flags');

    modal.setLanguage('ja');
    expect(modal.elModal.innerHTML).toContain('フロア記録・マーカー管理');
    expect(modal.elModal.innerHTML).toContain('観測済み施設・特徴');
  });

  it('close() でモーダルが非表示になること', async () => {
    await modal.open();
    expect(modal.isOpen()).toBe(true);

    modal.close();
    expect(modal.isOpen()).toBe(false);
    expect(modal.elModal.classList.contains('hidden')).toBe(true);
  });

  it('バラバラな順序や無効階層データが混在していても、dnumおよびdlevel順に整然とソートされラベル表示されること', async () => {
    // ユーザー報告のケース:
    // Dlvl 6, Dlvl 2, Dlvl 5, Dlvl 3, Mines 4, 不正階層 (dlevel: 0)
    mockCore.getDungeonOverview = vi.fn(() => [
      { dnum: 0, dlevel: 6, floorKey: 'Dlvl:6', branchNameJa: '運命の迷宮', features: { sinks: 1 } },
      { dnum: 0, dlevel: 2, floorKey: 'Dlvl:2', branchNameJa: '運命の迷宮', features: { shops: 1 } },
      { dnum: 0, dlevel: 0, floorKey: 'dungeon:0' }, // 無効階層
      { dnum: 1, dlevel: 4, floorKey: 'mines:4', branchNameJa: 'ノームの鉱山', features: {} },
      { dnum: 0, dlevel: 5, floorKey: 'Dlvl:5', branchNameJa: '運命の迷宮', features: { shops: 1 } },
      { dnum: 0, dlevel: 3, floorKey: 'Dlvl:3', branchNameJa: '運命の迷宮', features: {}, annotation: 'Stairs to Mines' }
    ]);

    await modal.open();

    const select = modal.elModal.querySelector('#ft-floor-select');
    const options = Array.from(select.querySelectorAll('option'));

    // 有効な 5 件 (Dlvl:2, Dlvl:3, Dlvl:5, Dlvl:6, mines:4)
    expect(options).toHaveLength(5);

    // 順序の検証: Dlvl:2 -> Dlvl:3 -> Dlvl:5 -> Dlvl:6 -> mines:4
    expect(options[0].value).toBe('Dlvl:2');
    expect(options[1].value).toBe('Dlvl:3');
    expect(options[2].value).toBe('Dlvl:5');
    expect(options[3].value).toBe('Dlvl:6');
    expect(options[4].value).toBe('mines:4');

    // ラベルの検証
    expect(options[0].textContent).toContain('運命の迷宮 地下2階 (Dlvl:2)');
    expect(options[0].textContent).toContain('[🏪]');
    expect(options[1].textContent).toContain('運命の迷宮 地下3階 (Dlvl:3)');
    expect(options[1].textContent).toContain('Stairs to Mines');
    expect(options[2].textContent).toContain('運命の迷宮 地下5階 (Dlvl:5)');
    expect(options[3].textContent).toContain('運命の迷宮 地下6階 (Dlvl:6)');
    expect(options[3].textContent).toContain('[🚰]');
    expect(options[4].textContent).toContain('ノームの鉱山 4階 (mines:4)');
  });

  it('isInputFocused() がモーダル内の input / select フォーカス時に正しく true を返すこと', async () => {
    await modal.open();
    const memoInput = modal.elModal.querySelector('#ft-memo-input');
    expect(modal.isInputFocused()).toBe(false);

    document.activeElement = memoInput;
    expect(modal.isInputFocused()).toBe(true);

    document.activeElement = document.body;
    expect(modal.isInputFocused()).toBe(false);
  });

  it('システムプリセット6枠が表示され、カスタムタグ作成・編集・削除が正常に動作すること', async () => {
    await modal.open();

    // プリセットボタングループの検証 (6枠)
    const presetBtns = modal.elModal.querySelectorAll('.quick-tag-btn.preset');
    expect(presetBtns).toHaveLength(6);
    expect(presetBtns[0].textContent).toContain('🚩');
    expect(presetBtns[5].textContent).toContain('⛪');

    // 初期状態ではカスタムタグボタンは 0件
    let customTagBtns = modal.elModal.querySelectorAll('.quick-tag-btn.custom');
    expect(customTagBtns).toHaveLength(0);

    // 「タグ作成・編集」ボタンをクリックしてエディタを開く
    const btnOpenEditor = modal.elModal.querySelector('#ft-btn-open-custom-editor');
    expect(btnOpenEditor).toBeTruthy();
    btnOpenEditor.dispatchEvent({ type: 'click' });

    // エディタが表示されていること
    expect(modal.isCustomEditorOpen).toBe(true);
    const editorBox = modal.elModal.querySelector('.custom-tag-editor-box');
    expect(editorBox).toBeTruthy();

    // スロット 6 に「💎 宝石保管」を登録
    const slotSelect = modal.elModal.querySelector('#ft-editor-slot-select');
    expect(slotSelect.value).toBe('6');

    const iconInput = modal.elModal.querySelector('#ft-editor-icon-input');
    iconInput.value = '💎';
    const labelJaInput = modal.elModal.querySelector('#ft-editor-label-ja');
    labelJaInput.value = '宝石保管';
    const labelEnInput = modal.elModal.querySelector('#ft-editor-label-en');
    labelEnInput.value = 'Gem Depot';

    // 保存ボタンをクリック
    const btnSave = modal.elModal.querySelector('#ft-btn-editor-save');
    btnSave.dispatchEvent({ type: 'click' });

    // エディタが閉じ、カスタムタグ一覧に反映されたこと
    expect(modal.isCustomEditorOpen).toBe(false);
    customTagBtns = modal.elModal.querySelectorAll('.quick-tag-btn.custom');
    expect(customTagBtns).toHaveLength(1);
    expect(customTagBtns[0].textContent).toContain('💎');
    expect(customTagBtns[0].textContent).toContain('宝石保管');

    // 作成したカスタムタグをクリックして現在地にピン打ち
    customTagBtns[0].dispatchEvent({ type: 'click' });
    expect(modal.draftMarkers).toContainEqual({
      type: 6,
      x: 42,
      y: 12
    });

    // 鉛筆編集アイコンをクリックして編集モードを開く
    const editIconBtn = modal.elModal.querySelector('[data-edit-slot-id="6"]');
    expect(editIconBtn).toBeTruthy();
    editIconBtn.dispatchEvent({ type: 'click' });
    expect(modal.isCustomEditorOpen).toBe(true);
    expect(modal.editingSlotId).toBe(6);

    // 削除ボタンをクリックして初期化
    const btnDelete = modal.elModal.querySelector('#ft-btn-editor-delete');
    expect(btnDelete).toBeTruthy();
    btnDelete.dispatchEvent({ type: 'click' });

    // 削除後、カスタムタグ一覧から消えること
    expect(modal.isCustomEditorOpen).toBe(false);
    customTagBtns = modal.elModal.querySelectorAll('.quick-tag-btn.custom');
    expect(customTagBtns).toHaveLength(0);
  });

  it('モーダル内の keydown イベントが e.stopPropagation() でゲーム背景へ伝播しないこと', async () => {
    await modal.open();
    const memoInput = modal.elModal.querySelector('#ft-memo-input');
    const stopPropagationSpy = vi.fn();
    const preventDefaultSpy = vi.fn();

    modal.elModal.dispatchEvent({
      type: 'keydown',
      key: 'j',
      target: memoInput,
      stopPropagation: stopPropagationSpy,
      preventDefault: preventDefaultSpy
    });

    expect(stopPropagationSpy).toHaveBeenCalled();
  });
});
