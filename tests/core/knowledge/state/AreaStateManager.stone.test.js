/**
 * AreaStateManager.stone.test.js
 * 
 * 観測済み無地岩盤 (glyph === 3929 / GLYPH_STONE) と完全未踏領域 (glyph >= 9622) の識別保持テスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AreaStateManager } from '../../../../src/core/knowledge/state/AreaStateManager.js';
import { ENTITY_TYPES, GLYPH_STONE } from '../../../../src/core/knowledge/engines/glyphClassifier.js';

describe('AreaStateManager - 観測済み無地岩盤 (STONE) 識別テスト', () => {
  let asm;

  beforeEach(() => {
    asm = new AreaStateManager();
  });

  it('1. glyphId === 3929 (ch: " ") 受信時に isObservedStone: true が保持されること', () => {
    asm.updateGlyph(10, 5, GLYPH_STONE, { ch: ' ', color: 7 });

    const cell = asm.grid[5][10];
    expect(cell.bottom).toBeDefined();
    expect(cell.bottom.type).toBe(ENTITY_TYPES.UNEXPLORED);
    expect(cell.bottom.glyph).toBe(3929);
    expect(cell.bottom.rawGlyph).toBe(3929);
    expect(cell.bottom.isObservedStone).toBe(true);
    expect(cell.bottom.typ).toBe(0); // STONE
  });

  it('2. glyphId >= 9622 (完全未踏領域) 受信時は isObservedStone: false であること', () => {
    asm.updateGlyph(11, 5, 9622, { ch: ' ', color: 7 });

    const cell = asm.grid[5][11];
    expect(cell.bottom).toBeDefined();
    expect(cell.bottom.type).toBe(ENTITY_TYPES.UNEXPLORED);
    expect(cell.bottom.glyph).toBe(9622);
    expect(cell.bottom.isObservedStone).toBe(false);
  });

  it('3. DirectBindingService が存在する場合、真の typ が優先反映されること', () => {
    const mockDirectBinding = {
      getCellInfo: (x, y) => {
        if (x === 12 && y === 5) {
          return { typ: 0, lit: 0 };
        }
        return null;
      }
    };
    asm.setDirectBindingService(mockDirectBinding);

    asm.updateGlyph(12, 5, GLYPH_STONE, { ch: ' ', color: 7 });

    const cell = asm.grid[5][12];
    expect(cell.bottom.isObservedStone).toBe(true);
    expect(cell.bottom.typ).toBe(0);
  });

  it('4. glyphInfo が null の場合でも glyphId === 3929 なら isObservedStone: true と判定されること', () => {
    asm.updateGlyph(13, 5, GLYPH_STONE);

    const cell = asm.grid[5][13];
    expect(cell.bottom).toBeDefined();
    expect(cell.bottom.type).toBe(ENTITY_TYPES.UNEXPLORED);
    expect(cell.bottom.isObservedStone).toBe(true);
    expect(cell.bottom.rawGlyph).toBe(3929);
  });
});
