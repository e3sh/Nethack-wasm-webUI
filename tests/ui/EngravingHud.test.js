/**
 * EngravingHud.test.js
 *
 * GKL 床文字・考古学的復元 HUD バナー (案A) の単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EngravingHud } from '../../examples/gkl-pure-js-client/modules/components/EngravingHud.js';

// 軽量 DOM 要素モック
function createMockElement(id = '') {
  const classListSet = new Set(['hidden']);
  const style = {};
  return {
    id,
    textContent: '',
    style,
    classList: {
      add: (cls) => classListSet.add(cls),
      remove: (cls) => classListSet.delete(cls),
      contains: (cls) => classListSet.has(cls),
      className: ''
    },
    parentElement: {
      style: {}
    },
    onclick: null
  };
}

describe('EngravingHud - ステータスバー直下の床文字考古学復元 HUD (案A)', () => {
  let engravingHud;
  let elements;
  let mockCore;

  beforeEach(() => {
    vi.useFakeTimers();

    elements = {
      elEngravingHud: createMockElement('engraving-hud'),
      elEngravingHudIcon: createMockElement('engraving-hud-icon'),
      elEngravingActual: createMockElement('engraving-actual'),
      elEngravingArrow: createMockElement('engraving-arrow'),
      elEngravingPristine: createMockElement('engraving-pristine'),
      elEngravingConfidenceBadge: createMockElement('engraving-confidence-badge'),
      elEngravingTranslation: createMockElement('engraving-translation'),
      elEngravingSourceBadge: createMockElement('engraving-source-badge'),
      elBtnEngraveReapply: createMockElement('btn-engrave-reapply'),
      elBtnEngravingClose: createMockElement('btn-engraving-close')
    };

    mockCore = {
      executeSequence: vi.fn(),
      gkl: {
        getSituation: vi.fn().mockReturnValue({
          player: { x: 10, y: 5 }
        })
      }
    };

    engravingHud = new EngravingHud({
      ...elements,
      getCore: () => mockCore
    });
  });

  it('1. 劣化 Elbereth を受け取ったとき、ward-degraded と再刻みボタンが表示されること', () => {
    engravingHud.show({
      actualText: 'El?ereth',
      isElbereth: true,
      isWardActive: false,
      elberethIntegrity: 0.85,
      restored: {
        pristineText: 'Elbereth',
        translation: 'エルベレス',
        confidence: 0.85,
        source: '魔除けの結界文字'
      }
    });

    expect(elements.elEngravingHud.classList.contains('hidden')).toBe(false);
    expect(elements.elEngravingHud.classList.contains('ward-degraded')).toBe(true);
    expect(elements.elEngravingHudIcon.textContent).toBe('⚠️');
    expect(elements.elEngravingActual.textContent).toBe('El?ereth');
    expect(elements.elEngravingPristine.textContent).toBe('Elbereth');
    expect(elements.elEngravingConfidenceBadge.textContent).toContain('結界無効');
    expect(elements.elEngravingTranslation.textContent).toContain('エルベレス');
    expect(elements.elBtnEngraveReapply.classList.contains('hidden')).toBe(false);
  });

  it('2. 完全な Elbereth を受け取ったとき、ward-active と結界有効バッジが表示され再刻みボタンは隠れること', () => {
    engravingHud.show({
      actualText: 'Elbereth',
      isElbereth: true,
      isWardActive: true,
      elberethIntegrity: 1.0,
      restored: {
        pristineText: 'Elbereth',
        translation: 'エルベレス',
        confidence: 1.0,
        source: '魔除けの結界文字'
      }
    });

    expect(elements.elEngravingHud.classList.contains('ward-active')).toBe(true);
    expect(elements.elEngravingHudIcon.textContent).toBe('🛡️');
    expect(elements.elEngravingConfidenceBadge.textContent).toContain('結界有効');
    expect(elements.elBtnEngraveReapply.classList.contains('hidden')).toBe(true);
  });

  it('3. Portal などの格言落書きの復元結果を受け取ったとき、原型と日本語訳・出典が表示されること', () => {
    engravingHud.show({
      actualText: 'Th? c?ke ?s a l?e',
      isElbereth: false,
      isWardActive: false,
      restored: {
        pristineText: 'The cake is a lie',
        translation: 'ケーキは嘘だ（『Portal』より）',
        confidence: 0.88,
        source: 'Portal (Valve)',
        category: 'ENGRAVING',
        subCategory: 'GAME'
      }
    });

    expect(elements.elEngravingHud.classList.contains('lore-engrave')).toBe(true);
    expect(elements.elEngravingHudIcon.textContent).toBe('🏛️');
    expect(elements.elEngravingActual.textContent).toBe('Th? c?ke ?s a l?e');
    expect(elements.elEngravingPristine.textContent).toBe('The cake is a lie');
    expect(elements.elEngravingTranslation.textContent).toBe('ケーキは嘘だ（『Portal』より）');
    expect(elements.elEngravingSourceBadge.textContent).toBe('Portal (Valve)');
    expect(elements.elEngravingConfidenceBadge.textContent).toBe('88% 同定');
  });

  it('4. 未知の手書きメモを受け取ったとき、手書き文字バッジが表示され原型差分が出ないこと', () => {
    engravingHud.show({
      actualText: 'st?sh h?re',
      isElbereth: false,
      isWardActive: false,
      restored: null
    });

    expect(elements.elEngravingHud.classList.contains('lore-engrave')).toBe(true);
    expect(elements.elEngravingActual.textContent).toBe('st?sh h?re');
    expect(elements.elEngravingPristine.textContent).toBe('');
    expect(elements.elEngravingConfidenceBadge.textContent).toBe('手書き文字');
  });

  it('5. 閉じるボタンを押したときにバナーが非表示になること', () => {
    engravingHud.show({ actualText: 'Elbereth', isElbereth: true, isWardActive: true });
    expect(elements.elEngravingHud.classList.contains('hidden')).toBe(false);

    elements.elBtnEngravingClose.onclick({ stopPropagation: vi.fn() });
    vi.advanceTimersByTime(350);

    expect(elements.elEngravingHud.classList.contains('hidden')).toBe(true);
  });

  it('6. 再刻みボタンを押したときに core.executeSequence で刻みコマンドが実行されること', async () => {
    engravingHud.show({
      actualText: 'El?ereth',
      isElbereth: true,
      isWardActive: false
    });

    await elements.elBtnEngraveReapply.onclick({ stopPropagation: vi.fn() });

    expect(mockCore.executeSequence).toHaveBeenCalledWith(['E', '-']);
  });

  it('7. プレイヤーが別の座標に移動したとき、自動でフェードアウトすること', () => {
    engravingHud.show({ actualText: 'Elbereth', isElbereth: true, isWardActive: true });
    expect(elements.elEngravingHud.classList.contains('hidden')).toBe(false);

    // 同じ座標なら消えない
    engravingHud.onPlayerMoved(10, 5);
    expect(elements.elEngravingHud.classList.contains('hidden')).toBe(false);

    // 別の座標に移動したら消える
    engravingHud.onPlayerMoved(11, 5);
    vi.advanceTimersByTime(350);
    expect(elements.elEngravingHud.classList.contains('hidden')).toBe(true);
  });

  it('8. 墓碑銘 (HEADSTONE) を受け取ったとき、専用の🪦アイコンと墓碑銘バッジが表示され、再刻みボタンや矢印が隠れること', () => {
    engravingHud.show({
      actualText: 'Rest in Peace',
      isHeadstone: true,
      engraveType: 'HEADSTONE',
      isElbereth: false,
      isWardActive: false
    });

    expect(elements.elEngravingHud.classList.contains('headstone')).toBe(true);
    expect(elements.elEngravingHudIcon.textContent).toBe('🪦');
    expect(elements.elEngravingConfidenceBadge.textContent).toContain('墓碑銘');
    expect(elements.elBtnEngraveReapply.classList.contains('hidden')).toBe(true);
    expect(elements.elEngravingArrow.style.display).toBe('none');
    expect(elements.elEngravingActual.textContent).toBe('Rest in Peace');
  });

  it('9. 完全一致時および手書き文字の時は矢印が隠れ、かすれ時のみ矢印が表示されること', () => {
    // A. かすれ時
    engravingHud.show({
      actualText: 'El?ereth',
      isElbereth: true,
      isWardActive: false,
      restored: { pristineText: 'Elbereth' }
    });
    expect(elements.elEngravingArrow.style.display).toBe('inline');

    // B. 完全一致時
    engravingHud.show({
      actualText: 'Elbereth',
      isElbereth: true,
      isWardActive: true,
      restored: { pristineText: 'Elbereth' }
    });
    expect(elements.elEngravingArrow.style.display).toBe('none');

    // C. 手書きメモ時
    engravingHud.show({
      actualText: 'secret stash',
      isElbereth: false,
      isWardActive: false,
      restored: null
    });
    expect(elements.elEngravingArrow.style.display).toBe('none');
  });

  it('10. core.ActionRecipeFactory が存在する場合、再刻みボタンでレシピが実行されること', async () => {
    const mockRecipe = { id: 'RECIPE_ENGRAVE_ELBERETH' };
    mockCore.ActionRecipeFactory = {
      createEngraveElberethRecipe: vi.fn().mockReturnValue(mockRecipe)
    };

    engravingHud.show({
      actualText: 'El?ereth',
      isElbereth: true,
      isWardActive: false
    });

    await elements.elBtnEngraveReapply.onclick({ stopPropagation: vi.fn() });

    expect(mockCore.ActionRecipeFactory.createEngraveElberethRecipe).toHaveBeenCalledWith('-');
    expect(mockCore.executeSequence).toHaveBeenCalledWith(mockRecipe);
  });
});
