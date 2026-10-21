import { describe, it, expect, beforeEach } from 'vitest';
import {
  FloorMarkerService,
  SYSTEM_PRESET_SLOTS,
  DEFAULT_CUSTOM_SLOTS,
  MARKER_STORAGE_KEY
} from '../../../../src/core/knowledge/services/FloorMarkerService.js';

describe('FloorMarkerService', () => {
  let service;
  let mockStorage;

  beforeEach(() => {
    const store = new Map();
    mockStorage = {
      getItem: (key) => store.get(key) || null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear()
    };
    service = new FloorMarkerService({ storage: mockStorage });
  });

  describe('1. 16bit HEX 4文字コードのエンコード & デコード', () => {
    it('設計仕様の例 (Type=1, X=42, Y=12) を正確に 154C にエンコードすること', () => {
      // (1 << 12) | (42 << 5) | 12 = 4096 | 1344 | 12 = 5452 = 0x154C
      const hex = service.encodeMarker(1, 42, 12);
      expect(hex).toBe('154C');
    });

    it('154C を正確に { type: 1, x: 42, y: 12 } にデコードすること', () => {
      const decoded = service.decodeMarker('154C');
      expect(decoded).toEqual({ type: 1, x: 42, y: 12 });
    });

    it('境界値 (Type=0, X=0, Y=0) を 0000 にエンコードし復元できること', () => {
      const hex = service.encodeMarker(0, 0, 0);
      expect(hex).toBe('0000');
      expect(service.decodeMarker('0000')).toEqual({ type: 0, x: 0, y: 0 });
    });

    it('境界値 (Type=15, X=127, Y=31) を FFFF にエンコードし復元できること', () => {
      // (15 << 12) | (127 << 5) | 31 = 61440 | 4064 | 31 = 65535 = 0xFFFF
      const hex = service.encodeMarker(15, 127, 31);
      expect(hex).toBe('FFFF');
      expect(service.decodeMarker('FFFF')).toEqual({ type: 15, x: 127, y: 31 });
    });

    it('小文字 hex (154c) や前後の空白も許容してデコードできること', () => {
      const decoded = service.decodeMarker('  154c  ');
      expect(decoded).toEqual({ type: 1, x: 42, y: 12 });
    });

    it('不正な hex 文字列 (長さ違い、不正文字) に対して null を返すこと', () => {
      expect(service.decodeMarker('154')).toBeNull();
      expect(service.decodeMarker('154CG')).toBeNull();
      expect(service.decodeMarker('XYZW')).toBeNull();
      expect(service.decodeMarker('')).toBeNull();
      expect(service.decodeMarker(null)).toBeNull();
    });
  });

  describe('2. マーカー列 (!M:...) のエンコード & デコード', () => {
    it('複数マーカーを !M:154C,2248 形式に変換できること', () => {
      const markers = [
        { type: 1, x: 42, y: 12 }, // 0x154C
        { type: 2, x: 18, y: 8 }   // (2 << 12) | (18 << 5) | 8 = 8192 | 576 | 8 = 8776 = 0x2248
      ];
      const str = service.encodeMarkerString(markers);
      expect(str).toBe('!M:154C,2248');
    });

    it('マーカー列文字列をデコードして各座標・種別を取得できること', () => {
      const decoded = service.decodeMarkerString('!M:154C,2248');
      expect(decoded).toHaveLength(2);
      expect(decoded[0]).toEqual({ type: 1, x: 42, y: 12, hex: '154C' });
      expect(decoded[1]).toEqual({ type: 2, x: 18, y: 8, hex: '2248' });
    });

    it('空配列または空文字に対して安全に処理すること', () => {
      expect(service.encodeMarkerString([])).toBe('');
      expect(service.decodeMarkerString('')).toEqual([]);
      expect(service.decodeMarkerString('!M:')).toEqual([]);
      expect(service.decodeMarkerString('Random text')).toEqual([]);
    });
  });

  describe('3. 通常英字メモとの混在パース & 統合', () => {
    it('メモとマーカーが共存する注釈文字列を正しく分離できること', () => {
      const raw = 'Shop and altar !M:154C,2248';
      const parsed = service.parseAnnotation(raw);
      expect(parsed.memo).toBe('Shop and altar');
      expect(parsed.rawMarkerString).toBe('!M:154C,2248');
      expect(parsed.markers).toHaveLength(2);
      expect(parsed.markers[0]).toEqual({ type: 1, x: 42, y: 12, hex: '154C' });
    });

    it('マーカーのみの文字列から空のメモとマーカー配列を抽出できること', () => {
      const raw = '!M:154C';
      const parsed = service.parseAnnotation(raw);
      expect(parsed.memo).toBe('');
      expect(parsed.markers).toHaveLength(1);
    });

    it('メモのみの文字列からメモを抽出しマーカー配列が空であること', () => {
      const raw = 'Bones level on dl:3';
      const parsed = service.parseAnnotation(raw);
      expect(parsed.memo).toBe('Bones level on dl:3');
      expect(parsed.markers).toHaveLength(0);
      expect(parsed.rawMarkerString).toBe('');
    });

    it('formatAnnotation でメモとマーカーを結合し ASCII 安全な注釈を生成すること', () => {
      const memo = 'Altar floor';
      const markers = [{ type: 4, x: 10, y: 5 }];
      const formatted = service.formatAnnotation(memo, markers);
      expect(formatted).toBe('Altar floor !M:4145');
    });

    it('formatAnnotation で非 ASCII 文字（日本語など）が除去され ASCII セーフになること', () => {
      const memo = '祭壇あり Altar here 日本語';
      const markers = [{ type: 0, x: 1, y: 1 }];
      const formatted = service.formatAnnotation(memo, markers);
      expect(formatted).toBe('Altar here !M:0021');
    });

    it('64文字制限を超過する場合、マーカー文字列を優先してメモ側を切り詰めること', () => {
      const longMemo = 'This is a very long note that exceeds sixty four characters limit for sure';
      const markers = [{ type: 1, x: 42, y: 12 }]; // !M:154C (7文字)
      const formatted = service.formatAnnotation(longMemo, markers, 64);
      expect(formatted.length).toBeLessThanOrEqual(64);
      expect(formatted.endsWith('!M:154C')).toBe(true);
    });
  });

  describe('4. スロット辞書管理 (プリセット6枠 & localStorage カスタム10枠)', () => {
    it('システムプリセット 6枠 (ID 0 〜 5) が正しく取得できること', () => {
      const presets = [
        { id: 0, icon: '🚩', labelJa: '拠点・デポ', labelEn: 'Main Base / Depot' },
        { id: 1, icon: '🔒', labelJa: '未開錠の箱', labelEn: 'Locked Chest' },
        { id: 2, icon: '⚠️', labelJa: '危険・強敵', labelEn: 'Hazard / Danger' },
        { id: 3, icon: '🦴', labelJa: '遺品・ボーンズ', labelEn: 'Bones / Grave' },
        { id: 4, icon: '🎒', labelJa: '保管品・アイテム', labelEn: 'Stash / Items' },
        { id: 5, icon: '⛪', labelJa: '祭壇・聖域', labelEn: 'Altar / Holy' }
      ];

      expect(SYSTEM_PRESET_SLOTS).toHaveLength(6);

      presets.forEach(expected => {
        const slot = service.getSlotDefinition(expected.id);
        expect(slot.id).toBe(expected.id);
        expect(slot.icon).toBe(expected.icon);
        expect(slot.labelJa).toBe(expected.labelJa);
        expect(slot.labelEn).toBe(expected.labelEn);
        expect(slot.isCustom).toBe(false);
        expect(slot.isConfigured).toBe(true);
      });
    });

    it('カスタムスロット (ID 6 〜 15) の初期状態は未設定 (isConfigured: false) であること', () => {
      for (let id = 6; id <= 15; id++) {
        const slot = service.getSlotDefinition(id);
        expect(slot.id).toBe(id);
        expect(slot.icon).toBe('📍');
        expect(slot.isCustom).toBe(true);
        expect(slot.isConfigured).toBe(false);
      }
      expect(service.getConfiguredCustomSlots()).toEqual([]);
    });

    it('saveCustomSlot で単一カスタムスロットを登録・更新し、localStorage に永続化できること', () => {
      const ok = service.saveCustomSlot(6, {
        icon: '💎',
        labelJa: '宝石・貴重品',
        labelEn: 'Gems / Valuables'
      });
      expect(ok).toBe(true);

      const slot6 = service.getSlotDefinition(6);
      expect(slot6.id).toBe(6);
      expect(slot6.icon).toBe('💎');
      expect(slot6.labelJa).toBe('宝石・貴重品');
      expect(slot6.labelEn).toBe('Gems / Valuables');
      expect(slot6.isCustom).toBe(true);
      expect(slot6.isConfigured).toBe(true);

      // 別インスタンスでストレージから復元確認
      const newService = new FloorMarkerService({ storage: mockStorage });
      const restored6 = newService.getSlotDefinition(6);
      expect(restored6.icon).toBe('💎');
      expect(restored6.labelJa).toBe('宝石・貴重品');
      expect(restored6.isConfigured).toBe(true);
      expect(newService.getConfiguredCustomSlots()).toHaveLength(1);
    });

    it('deleteCustomSlot でカスタムスロットを未設定に戻せること', () => {
      service.saveCustomSlot(7, {
        icon: '🧪',
        labelJa: '薬瓶',
        labelEn: 'Potions'
      });
      expect(service.getSlotDefinition(7).isConfigured).toBe(true);

      const deleted = service.deleteCustomSlot(7);
      expect(deleted).toBe(true);

      const resetSlot7 = service.getSlotDefinition(7);
      expect(resetSlot7.isConfigured).toBe(false);
      expect(resetSlot7.icon).toBe('📍');
    });

    it('無効なカスタムスロットID (0〜5, 16以上) の save/delete は安全に false を返すこと', () => {
      expect(service.saveCustomSlot(5, { icon: '★' })).toBe(false);
      expect(service.saveCustomSlot(16, { icon: '★' })).toBe(false);
      expect(service.deleteCustomSlot(3)).toBe(false);
      expect(service.deleteCustomSlot(20)).toBe(false);
    });

    it('resetCustomSlots で全カスタムスロットが未設定に初期化されること', () => {
      service.saveCustomSlot(6, { icon: 'A' });
      service.saveCustomSlot(10, { icon: 'B' });
      expect(service.getConfiguredCustomSlots()).toHaveLength(2);

      service.resetCustomSlots();
      expect(service.getConfiguredCustomSlots()).toHaveLength(0);
      expect(service.getSlotDefinition(6).isConfigured).toBe(false);
    });

    it('getAllSlots で全16スロット (0〜15) が返されること', () => {
      const all = service.getAllSlots();
      expect(all).toHaveLength(16);
      expect(all.map(s => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
      expect(all.slice(0, 6).every(s => !s.isCustom)).toBe(true);
      expect(all.slice(6).every(s => s.isCustom)).toBe(true);
    });
  });
});
