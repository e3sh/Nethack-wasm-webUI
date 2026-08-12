/**
 * InventoryStateManager.js
 * 
 * プレイヤーのインベントリ（所持品）状態を管理・キャッシュし、
 * コンテキストアクションに必要なツール（ツルハシ・鍵・斧・杖等）の所持状況とインベントリレターを提供するマネージャー。
 */

import { GLYPH_OFFSETS, classifyGlyph, ENTITY_TYPES } from './glyphClassifier.js';

export class InventoryStateManager {
    constructor() {
        // 所持品アイテムのリスト
        // item: { letter: 'f', name: 'pick-axe', rawText: '...', glyphId: 3707, onum: 259, isPickAxe: true, ... }
        this.items = [];
        this.isSynced = false; // 一度でもインベントリを同期したかフラグ
    }

    /**
     * キャッシュのリセット
     */
    reset() {
        this.items = [];
        this.isSynced = false;
    }

    /**
     * インベントリメニューダイアログ等のデータから全リストを更新・同期
     * @param {Array<Object>} menuItems - メニュー項目の配列 [{ letter: 'a', text: 'a blessed +1 pick-axe', glyph: 3707, onum: 259 }, ...]
     */
    updateFromMenuItems(menuItems) {
        if (!Array.isArray(menuItems) || menuItems.length === 0) return;

        const parsedItems = [];

        menuItems.forEach(mi => {
            if (!mi) return;
            const rawText = mi.rawStr || mi.str || mi.text || (typeof mi === 'string' ? mi : '');
            if (!rawText) return;

            let letter = '';
            const rawCh = mi.charStr || mi.letter || mi.accelerator || mi.selector || mi.ch || 0;
            if (typeof rawCh === 'number' && rawCh > 0) {
                letter = String.fromCharCode(rawCh);
            } else if (typeof rawCh === 'string' && rawCh.length > 0) {
                letter = rawCh.trim();
            }

            if (!letter && rawText) {
                const match = rawText.match(/^([a-zA-Z])[\s\-\.\)]/);
                if (match) letter = match[1];
            }

            // 英字1文字のアイテムのみ有効なスロット項目としてパース
            if (letter && /^[a-zA-Z]$/.test(letter)) {
                const glyphId = typeof mi.glyph === 'number' ? mi.glyph : (mi.glyphInfo ? mi.glyphInfo.glyph : -1);
                const onum = typeof mi.onum === 'number' ? mi.onum : (mi.glyphInfo ? mi.glyphInfo.onum : -1);
                const categoryFlags = this.categorizeItem(rawText, glyphId, onum);

                parsedItems.push({
                    letter,
                    rawText,
                    glyphId,
                    onum,
                    ...categoryFlags
                });
            }
        });

        if (parsedItems.length > 0) {
            this.items = parsedItems;
            this.isSynced = true;
        }
    }

    /** エイリアスメソッド (互換性担保) */
    syncFromMenu(menuItems) {
        return this.updateFromMenuItems(menuItems);
    }

    /**
     * ログメッセージ（例: "You pick up a key.", "You drop a pick-axe."）を受信した際の差分更新または状態判定
     * @param {string} message 
     */
    /**
     * ログメッセージ（例: "You start with a lock pick.", "You pick up a key.", "You drop a pick-axe."）を受信した際の差分更新または状態判定
     * @param {string} message 
     */
    updateFromMessage(message) {
        if (!message) return;

        // 壊れたメッセージ検知 ("Your pick-axe breaks!")
        if (message.includes('breaks') || message.includes('destroyed')) {
            if (message.includes('pick-axe')) {
                this.items = this.items.filter(i => !i.isPickAxe);
            }
        }

        // ドロップメッセージ検知 (例: "You drop a lock pick.", "You drop the axe.")
        if (message.includes('You drop') || message.includes('you drop')) {
            const clean = this.cleanItemText(message);
            const categoryFlags = this.categorizeItem(clean);
            if (categoryFlags.isPickAxe) this.items = this.items.filter(i => !i.isPickAxe);
            if (categoryFlags.isKey) this.items = this.items.filter(i => !i.isKey);
            if (categoryFlags.isAxe) this.items = this.items.filter(i => !i.isAxe);
            if (categoryFlags.isFrostWand) this.items = this.items.filter(i => !i.isFrostWand);
        }

        // 初期所持・拾得メッセージ自動検出 (例: "You start with a lock pick.", "You pick up a lock pick")
        if (message.includes('start with') || message.includes('pick up') || message.includes('have')) {
            const clean = this.cleanItemText(message);
            const categoryFlags = this.categorizeItem(clean);

            if (categoryFlags.isKey || categoryFlags.isPickAxe || categoryFlags.isAxe || categoryFlags.isFrostWand) {
                // 自動検知されたキーアイテムを推定登録 (デフォルトレター 'a' 等)
                const existing = this.items.find(i => 
                    (categoryFlags.isKey && i.isKey) || 
                    (categoryFlags.isPickAxe && i.isPickAxe) ||
                    (categoryFlags.isAxe && i.isAxe) ||
                    (categoryFlags.isFrostWand && i.isFrostWand)
                );

                if (!existing) {
                    this.items.push({
                        letter: 'a', // 推定レター
                        rawText: message,
                        ...categoryFlags
                    });
                }
                this.isSynced = true;
            }
        }
    }

    /** エイリアスメソッド (互換性担保) */
    syncFromMessage(message) {
        return this.updateFromMessage(message);
    }

    /**
     * 三層識別アルゴリズム (Glyph ID -> onum -> 正規表現) によるアイテム分類
     * @param {string} rawText 
     * @param {number} glyphId 
     * @param {number} onum 
     * @returns {Object} フラグ構造体 { isPickAxe, isKey, isAxe, isFrostWand }
     */
    categorizeItem(rawText, glyphId = -1, onum = -1) {
        let isPickAxe = false;
        let isKey = false;
        let isAxe = false;
        let isFrostWand = false;

        // 【層1】onum (オブジェクト固有番号) 判定
        if (onum >= 0) {
            if (onum === 259) isPickAxe = true; // pick-axe
            if (onum === 251 || onum === 250 || onum === 249 || onum === 248) isKey = true; // key, lock pick, credit card, osaku key
            if (onum === 197 || onum === 198) isAxe = true; // axe, battle-axe
        }

        // 【層2】Glyph ID 判定 (GLYPH_OBJ_OFF オフセット)
        if (!isPickAxe && !isKey && !isAxe && glyphId >= GLYPH_OFFSETS.GLYPH_OBJ_OFF) {
            const info = classifyGlyph(glyphId);
            if (info.type === ENTITY_TYPES.ITEM) {
                if (info.subType === 259 - 1) isPickAxe = true;
            }
        }

        // 【層3】テキストパース（前処理で不要なBuc/数量/装備タグを除去した上で正規表現）
        const cleanText = this.cleanItemText(rawText);

        if (!isPickAxe) {
            isPickAxe = /\b(pick-axe|dwarvish mattock|wand of digging)\b/i.test(cleanText) ||
                         /(つるはし|ドワーフのマトック|採掘の杖)/.test(cleanText);
        }

        if (!isKey) {
            isKey = /\b(skeleton key|lock\s*pick|lockpick|lock-pick|credit card|\b\w+\s+key|keys?)\b/i.test(cleanText) ||
                    /(鍵|合鍵|ロックピック|クレジットカード)/.test(cleanText);
        }

        if (!isAxe && !isPickAxe) {
            isAxe = (/(^|[\s])(axe|battle-axe)($|[\s])/i.test(cleanText) || /(斧|戦斧)/.test(cleanText)) && !/pick-axe/i.test(cleanText);
        }

        if (!isFrostWand) {
            isFrostWand = /\bwand of frost\b/i.test(cleanText) ||
                          /氷の杖/.test(cleanText);
        }

        return {
            isPickAxe,
            isKey,
            isAxe,
            isFrostWand
        };
    }

    /**
     * テキストパース前処理（レター・数量・BUC・状態・装備タグの削除）
     * @param {string} text 
     * @returns {string} 除去済みテキスト
     */
    cleanItemText(text) {
        if (!text) return '';
        return text
            .replace(/^[a-zA-Z][\s\-\.\)]+/, '') // "a - ", "a) ", "a. " レタープレフィックス削除
            .replace(/\(.*?\)/g, '')             // "(weapon in hand)" 削除
            .replace(/\b(a|an|the|\d+)\b/gi, '') // 冠詞・数値削除
            .replace(/\b(blessed|uncursed|cursed)\b/gi, '') // BUC削除
            .replace(/\b(rusty|corroded|burnt|poisoned|\+\d+|-\d+)\b/gi, '') // 状態・強化値削除
            .trim();
    }

    // =========================================================================
    // クエリ API (ContextActionEngine から利用)
    // =========================================================================

    /** ツルハシ/掘削アイテムを取得 (所持していない場合は null) */
    getPickAxe() {
        return this.items.find(i => i.isPickAxe) || null;
    }

    /** 鍵/解錠アイテムを取得 (所持していない場合は null) */
    getKeyOrLockPick() {
        return this.items.find(i => i.isKey) || null;
    }

    /** 斧/伐採アイテムを取得 (所持していない場合は null) */
    getAxe() {
        return this.items.find(i => i.isAxe) || null;
    }

    /** 氷の杖を取得 (所持していない場合は null) */
    getFrostWand() {
        return this.items.find(i => i.isFrostWand) || null;
    }
}
