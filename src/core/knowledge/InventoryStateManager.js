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

    /**
     * driver.getLastSequenceBuffer() のバッファデータからインベントリメニュー・テキスト行を抽出して一括更新
     * @param {Array<Object>} sequenceBuffer - シーケンスバッファの配列
     */
    updateFromSequenceBuffer(sequenceBuffer) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) return;

        for (const item of sequenceBuffer) {
            if (!item) continue;

            if (item.menuItems || item.items) {
                const menuItems = item.menuItems || item.items;
                if (Array.isArray(menuItems) && menuItems.length > 0) {
                    this.updateFromMenuItems(menuItems);
                    return;
                }
            }

            if (item.lines || item.text) {
                const lines = item.lines || (typeof item.text === 'string' ? item.text.split('\n') : []);
                if (Array.isArray(lines) && lines.length > 0) {
                    this.updateFromLines(lines);
                    return;
                }
            }
        }
    }

    /**
     * テキスト行の配列（例: ["a - a lock pick", "b - a +0 dagger"]）からインベントリ状態を抽出・同期
     * @param {Array<string>} lines 
     */
    updateFromLines(lines) {
        if (!Array.isArray(lines) || lines.length === 0) return;

        const menuItems = [];
        lines.forEach(line => {
            if (!line || typeof line !== 'string') return;
            const match = line.match(/^([a-zA-Z])[\s\-\.\)]+(.+)$/);
            if (match) {
                menuItems.push({
                    letter: match[1],
                    rawStr: match[2].trim(),
                    str: match[2].trim()
                });
            }
        });

        if (menuItems.length > 0) {
            this.updateFromMenuItems(menuItems);
        }
    }

    /** エイリアスメソッド (互換性担保) */
    syncFromMenu(menuItems) {
        return this.updateFromMenuItems(menuItems);
    }

    /**
     * ログメッセージ（例: "You pick up...", "You drop...", "Your pick-axe breaks!"）を受信した際の状態判定
     * 不確実なアドホック推測登録を行わず、インベントリが変更された可能性があるとして未同期（dirty）化する。
     * @param {string} message 
     */
    updateFromMessage(message) {
        if (!message) return;

        // 壊れたメッセージ検知 ("Your pick-axe breaks!")
        if (message.includes('breaks') || message.includes('destroyed')) {
            if (message.includes('pick-axe')) {
                this.items = this.items.filter(i => !i.isPickAxe);
            }
            this.isSynced = false;
            return;
        }

        // ドロップメッセージ・拾得・状態変更メッセージ検知
        if (message.includes('You drop') || message.includes('you drop') ||
            message.includes('pick up') || message.includes('start with') ||
            message.includes('put on') || message.includes('take off') ||
            message.includes('wield') || message.includes('wear') || message.includes('remove')) {
            
            // 能動取得が必要であることを示すため未同期 (dirty) フラグに変更
            this.isSynced = false;
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
     * @returns {Object} フラグ構造体 { isPickAxe, isKey, isAxe, isFrostWand, isDigWand, isDigTool, verb }
     */
    categorizeItem(rawText, glyphId = -1, onum = -1) {
        let isPickAxe = false;
        let isDigWand = false;
        let isKey = false;
        let isAxe = false;
        let isFrostWand = false;

        // 【層1】onum (オブジェクト固有番号) 判定
        if (onum >= 0) {
            if (onum === 259) isPickAxe = true; // pick-axe
            if (onum === 251 || onum === 250 || onum === 249 || onum === 248) isKey = true; // key, lock pick, credit card, osaku key
            if (onum === 197 || onum === 198) isAxe = true; // axe, battle-axe
            if (onum === 299) isDigWand = true; // wand of digging (onum 299)
        }

        // 【層2】Glyph ID 判定 (GLYPH_OBJ_OFF オフセット)
        if (!isPickAxe && !isDigWand && !isKey && !isAxe && glyphId >= GLYPH_OFFSETS.GLYPH_OBJ_OFF) {
            const info = classifyGlyph(glyphId);
            if (info.type === ENTITY_TYPES.ITEM) {
                if (info.subType === 259 - 1) isPickAxe = true;
                if (info.subType === 299 - 1) isDigWand = true;
            }
        }

        // 【層3】テキストパース（前処理で不要なBuc/数量/装備タグを除去した上で正規表現）
        const cleanText = this.cleanItemText(rawText);

        if (!isPickAxe && !isDigWand) {
            if (/\b(wand of digging)\b/i.test(cleanText) || /採掘の杖/.test(cleanText)) {
                isDigWand = true;
            } else if (/\b(pick-axe|dwarvish mattock)\b/i.test(cleanText) || /(つるはし|ドワーフのマトック)/.test(cleanText)) {
                isPickAxe = true;
            }
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

        // 発動コマンドキー (verb) の付与
        const verb = isDigWand ? 'z' : 'a';

        return {
            isPickAxe,
            isDigWand,
            isDigTool: isPickAxe || isDigWand,
            verb,
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

    /** ツルハシ/掘削ツールを取得 (所持していない場合は null)。verb ('a' か 'z') を含む */
    getPickAxe() {
        return this.items.find(i => i.isPickAxe || i.isDigWand || i.isDigTool) || null;
    }

    /** 掘削ツール (ツルハシまたは採掘の杖) を取得 */
    getDigTool() {
        return this.items.find(i => i.isDigTool || i.isPickAxe || i.isDigWand) || null;
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
