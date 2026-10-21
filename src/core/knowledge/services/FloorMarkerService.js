/**
 * FloorMarkerService.js
 *
 * C コア (#annotate / svm.mapseenchn) と連携するフロアマーカー・階層注釈エンコード＆辞書管理サービス。
 *
 * 【アーキテクチャ原則】
 * 1. 100% ASCII 安全性:
 *    C コア内部の mapseen->custom には純粋な ASCII マーカー列（例: !M:154C,2248）および英字メモのみを書き込む。
 * 2. 16bit HEX 4文字コード仕様:
 *    (Type << 12) | (X << 5) | Y
 *    - Type: 4 bit (0 〜 15)
 *    - X: 7 bit (0 〜 127) ※NetHack ダンジョン座標: 0 〜 79
 *    - Y: 5 bit (0 〜 31)  ※NetHack ダンジョン座標: 0 〜 21
 * 3. 二重ストレージ分離 (localStorage 連携):
 *    - プレイ固有データ (Run SSOT): C コア svm.mapseenchn (パーマデス連動)
 *    - カスタムタグ辞書 (Persistent): localStorage (nethack_custom_marker_slots, セッション横断)
 */

export const MARKER_STORAGE_KEY = 'nethack_custom_marker_slots';
export const MARKER_PREFIX = '!M:';
export const MAX_ANNOTATION_LENGTH = 64;

/**
 * システム共通プリセットスロット定義 (6枠: ID 0 〜 5)
 */
export const SYSTEM_PRESET_SLOTS = Object.freeze([
  { id: 0, icon: '🚩', labelJa: '拠点・デポ', labelEn: 'Main Base / Depot' },
  { id: 1, icon: '🔒', labelJa: '未開錠の箱', labelEn: 'Locked Chest' },
  { id: 2, icon: '⚠️', labelJa: '危険・強敵', labelEn: 'Hazard / Danger' },
  { id: 3, icon: '🦴', labelJa: '遺品・ボーンズ', labelEn: 'Bones / Grave' },
  { id: 4, icon: '🎒', labelJa: '保管品・アイテム', labelEn: 'Stash / Items' },
  { id: 5, icon: '⛪', labelJa: '祭壇・聖域', labelEn: 'Altar / Holy' }
]);

/**
 * ユーザーカスタムスロットデフォルト定義 (ID 6 〜 15: 初期状態は未設定)
 */
export const DEFAULT_CUSTOM_SLOTS = Object.freeze([]);

let _sharedInstance = null;

export class FloorMarkerService {
  static getInstance(options = {}) {
    if (!_sharedInstance) {
      _sharedInstance = new FloorMarkerService(options);
    }
    return _sharedInstance;
  }

  static resetInstance() {
    _sharedInstance = null;
  }
  constructor(options = {}) {
    this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this._customSlots = null;
    this.loadCustomSlots();
  }

  /**
   * 16bit HEX 4文字コードの生成 (Type << 12 | X << 5 | Y)
   * @param {number} type - 0 〜 15
   * @param {number} x - 0 〜 127
   * @param {number} y - 0 〜 31
   * @returns {string} 4文字の16進数大文字 (例: "154C")
   */
  encodeMarker(type, x, y) {
    const t = Math.max(0, Math.min(15, Number(type) || 0));
    const posX = Math.max(0, Math.min(127, Number(x) || 0));
    const posY = Math.max(0, Math.min(31, Number(y) || 0));

    const packed = ((t & 0x0F) << 12) | ((posX & 0x7F) << 5) | (posY & 0x1F);
    return packed.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * 16bit HEX 4文字コードのパース
   * @param {string} hexCode - 4文字の16進数コード (例: "154C")
   * @returns {{ type: number, x: number, y: number } | null}
   */
  decodeMarker(hexCode) {
    if (typeof hexCode !== 'string' || !/^[0-9A-Fa-f]{4}$/.test(hexCode.trim())) {
      return null;
    }

    const packed = parseInt(hexCode.trim(), 16);
    const type = (packed >> 12) & 0x0F;
    const x = (packed >> 5) & 0x7F;
    const y = packed & 0x1F;

    return { type, x, y };
  }

  /**
   * 複数マーカーオブジェクト配列を接頭辞付き文字列に変換 (!M:154C,2248)
   * @param {Array<{ type: number, x: number, y: number }>} markers
   * @returns {string} 例: "!M:154C,2248" (マーカーがなければ空文字)
   */
  encodeMarkerString(markers) {
    if (!Array.isArray(markers) || markers.length === 0) {
      return '';
    }

    const hexList = markers
      .map(m => this.encodeMarker(m.type, m.x, m.y))
      .filter(Boolean);

    if (hexList.length === 0) return '';
    return `${MARKER_PREFIX}${hexList.join(',')}`;
  }

  /**
   * 接頭辞付きマーカー文字列 (!M:154C,2248) をパース
   * @param {string} markerStr
   * @returns {Array<{ type: number, x: number, y: number, hex: string }>}
   */
  decodeMarkerString(markerStr) {
    if (!markerStr || typeof markerStr !== 'string') {
      return [];
    }

    const trimmed = markerStr.trim();
    if (!trimmed.startsWith(MARKER_PREFIX)) {
      return [];
    }

    const payload = trimmed.substring(MARKER_PREFIX.length);
    if (!payload) return [];

    const codes = payload.split(',');
    const results = [];

    for (const code of codes) {
      const decoded = this.decodeMarker(code);
      if (decoded) {
        results.push({
          ...decoded,
          hex: code.trim().toUpperCase()
        });
      }
    }

    return results;
  }

  /**
   * C コアからの注釈文字列 (プレーンテキストと !M:コードの混在) を分離パース
   * 例: "Shop and altar !M:154C,2248" -> { memo: "Shop and altar", markers: [...], rawMarkerString: "!M:154C,2248" }
   * @param {string} rawAnnotation
   * @returns {{ memo: string, markers: Array<{ type: number, x: number, y: number, hex: string }>, rawMarkerString: string }}
   */
  parseAnnotation(rawAnnotation) {
    if (!rawAnnotation || typeof rawAnnotation !== 'string') {
      return { memo: '', markers: [], rawMarkerString: '' };
    }

    const text = rawAnnotation.trim();
    // !M:[0-9A-Fa-f]{4}(?:,[0-9A-Fa-f]{4})* にマッチ
    const markerRegex = /!M:[0-9A-Fa-f]{4}(?:,[0-9A-Fa-f]{4})*/g;
    const matches = text.match(markerRegex);

    let rawMarkerString = '';
    let markers = [];

    if (matches && matches.length > 0) {
      // 最初のマーカーブロックを採用（複数ある場合は連結も可）
      rawMarkerString = matches[0];
      markers = this.decodeMarkerString(rawMarkerString);
    }

    // マーカー文字列部分を除去してプレーンテキストを抽出
    const memo = text.replace(markerRegex, '').trim();

    return {
      memo,
      markers,
      rawMarkerString
    };
  }

  /**
   * プレーンテキストメモとマーカー配列を統合し、C コア書き込み用の 100% ASCII 文字列を生成
   * @param {string} memo - 通常メモ (英数字・記号推奨)
   * @param {Array<{ type: number, x: number, y: number }>} markers - マーカー配列
   * @param {number} [maxLength=MAX_ANNOTATION_LENGTH] - 最大文字数 (NetHack 5.0 custom は通常64バイト)
   * @returns {string} 合成された注釈文字列
   */
  formatAnnotation(memo = '', markers = [], maxLength = MAX_ANNOTATION_LENGTH) {
    const markerStr = this.encodeMarkerString(markers);
    
    // ASCII セーフガード: 非 ASCII 文字 (マルチバイト等) を除去または置換
    let cleanMemo = (typeof memo === 'string' ? memo : '')
      .replace(/[^\x20-\x7E]/g, '') // 印字可能 ASCII 文字 (0x20 〜 0x7E) のみ保持
      .trim();

    let combined = '';
    if (cleanMemo && markerStr) {
      combined = `${cleanMemo} ${markerStr}`;
    } else if (markerStr) {
      combined = markerStr;
    } else {
      combined = cleanMemo;
    }

    // 長さ制限の適用 (マーカー情報 !M:... は極力欠落させないよう配慮)
    if (combined.length > maxLength) {
      if (markerStr.length >= maxLength) {
        // マーカーだけで上限を超える場合はマーカーを切り詰め
        combined = markerStr.substring(0, maxLength);
      } else {
        // メモ側を切り詰めてマーカーを死守
        const availableMemoLen = maxLength - markerStr.length - (markerStr ? 1 : 0);
        if (availableMemoLen > 0) {
          cleanMemo = cleanMemo.substring(0, availableMemoLen).trim();
          combined = `${cleanMemo} ${markerStr}`.trim();
        } else {
          combined = markerStr;
        }
      }
    }

    return combined;
  }

  // --- カスタムスロット管理 (localStorage) ---

  /**
   * localStorage からユーザーカスタムスロット (ID 6 〜 15) を読み込み
   * @returns {Array<Object>}
   */
  loadCustomSlots() {
    if (!this.storage) {
      if (!this._customSlots) {
        this._customSlots = [];
      }
      return this._customSlots;
    }

    let slots = [];
    try {
      const raw = this.storage.getItem(MARKER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          slots = parsed
            .filter(s => s && typeof s.id === 'number' && s.id >= 6 && s.id <= 15)
            .map(s => ({
              id: s.id,
              icon: s.icon || '📍',
              labelJa: s.labelJa || `カスタム #${s.id}`,
              labelEn: s.labelEn || `Custom #${s.id}`,
              isCustom: true,
              isConfigured: true
            }));
        }
      }
    } catch (e) {
      console.warn('[FloorMarkerService] Failed to load custom slots from storage:', e);
      return this._customSlots || [];
    }

    this._customSlots = slots;
    return this._customSlots;
  }

  /**
   * 単一ユーザーカスタムスロット (ID 6 〜 15) の登録・編集
   * @param {number} id - スロット番号 (6 〜 15)
   * @param {Object} def - { icon: string, labelJa: string, labelEn: string }
   * @returns {boolean}
   */
  saveCustomSlot(id, def = {}) {
    const slotId = Number(id);
    if (isNaN(slotId) || slotId < 6 || slotId > 15) {
      return false;
    }

    const icon = (def.icon && typeof def.icon === 'string') ? def.icon.trim() : '📍';
    const labelJa = (def.labelJa && typeof def.labelJa === 'string') ? def.labelJa.trim() : `カスタム #${slotId}`;
    const labelEn = (def.labelEn && typeof def.labelEn === 'string') ? def.labelEn.trim() : `Custom #${slotId}`;

    const newDef = {
      id: slotId,
      icon,
      labelJa,
      labelEn,
      isCustom: true,
      isConfigured: true
    };

    const slots = this._customSlots ? [...this._customSlots] : [];
    const existingIndex = slots.findIndex(s => s.id === slotId);
    if (existingIndex >= 0) {
      slots[existingIndex] = newDef;
    } else {
      slots.push(newDef);
      slots.sort((a, b) => a.id - b.id);
    }

    this._customSlots = slots;
    if (this.storage) {
      try {
        this.storage.setItem(MARKER_STORAGE_KEY, JSON.stringify(this._customSlots));
      } catch (e) {
        console.warn('[FloorMarkerService] Failed to save custom slot to storage:', e);
        return false;
      }
    }
    return true;
  }

  /**
   * 単一ユーザーカスタムスロット (ID 6 〜 15) の削除（空きスロットへ初期化）
   * @param {number} id - スロット番号 (6 〜 15)
   * @returns {boolean}
   */
  deleteCustomSlot(id) {
    const slotId = Number(id);
    if (isNaN(slotId) || slotId < 6 || slotId > 15) {
      return false;
    }

    const slots = (this._customSlots || []).filter(s => s.id !== slotId);
    this._customSlots = slots;

    if (this.storage) {
      try {
        this.storage.setItem(MARKER_STORAGE_KEY, JSON.stringify(this._customSlots));
      } catch (e) {
        console.warn('[FloorMarkerService] Failed to delete custom slot from storage:', e);
        return false;
      }
    }
    return true;
  }

  /**
   * ユーザーカスタムスロット全件を localStorage に保存 (一括更新用)
   * @param {Array<Object>} slots
   * @returns {boolean}
   */
  saveCustomSlots(slots) {
    if (!Array.isArray(slots)) return false;
    this._customSlots = slots
      .filter(s => s && typeof s.id === 'number' && s.id >= 6 && s.id <= 15)
      .map(s => ({
        id: s.id,
        icon: s.icon || '📍',
        labelJa: s.labelJa || `カスタム #${s.id}`,
        labelEn: s.labelEn || `Custom #${s.id}`,
        isCustom: true,
        isConfigured: true
      }));

    if (this.storage) {
      try {
        this.storage.setItem(MARKER_STORAGE_KEY, JSON.stringify(this._customSlots));
        return true;
      } catch (e) {
        console.warn('[FloorMarkerService] Failed to save custom slots to storage:', e);
      }
    }
    return false;
  }

  /**
   * カスタムスロットを初期デフォルト（全未設定）にリセット
   * @returns {Array<Object>}
   */
  resetCustomSlots() {
    this._customSlots = [];
    if (this.storage) {
      try {
        this.storage.removeItem(MARKER_STORAGE_KEY);
      } catch (e) {
        console.warn('[FloorMarkerService] Failed to remove custom slots from storage:', e);
      }
    }
    return this._customSlots;
  }

  /**
   * 設定済みのカスタムスロット (ID 6 〜 15) のみを取得
   * @returns {Array<Object>}
   */
  getConfiguredCustomSlots() {
    return (this._customSlots || []).filter(s => s.isConfigured !== false);
  }

  /**
   * 単一スロットの取得 (ID 0 〜 15)
   * @param {number} typeId
   * @returns {Object} { id, icon, labelJa, labelEn, isCustom?, isConfigured? }
   */
  getSlotDefinition(typeId) {
    const id = Number(typeId) || 0;
    if (id >= 0 && id <= 5) {
      const preset = SYSTEM_PRESET_SLOTS.find(s => s.id === id) || SYSTEM_PRESET_SLOTS[0];
      return { ...preset, isCustom: false, isConfigured: true };
    }
    if (id >= 6 && id <= 15) {
      this.loadCustomSlots();
      const custom = (this._customSlots || []).find(s => s.id === id);
      if (custom) {
        return { ...custom, isCustom: true, isConfigured: true };
      }
      return {
        id,
        icon: '📍',
        labelJa: `カスタム #${id}`,
        labelEn: `Custom #${id}`,
        isCustom: true,
        isConfigured: false
      };
    }
    return { id, icon: '📍', labelJa: `マーカー #${id}`, labelEn: `Marker #${id}`, isCustom: false, isConfigured: false };
  }

  /**
   * 全スロット一覧の取得 (ID 0 〜 15)
   * @returns {Array<Object>} 16要素の配列 (プリセット6個 + カスタム10個)
   */
  getAllSlots() {
    this.loadCustomSlots();
    const results = [];
    for (let id = 0; id <= 15; id++) {
      results.push(this.getSlotDefinition(id));
    }
    return results;
  }
}
