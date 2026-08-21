/**
 * DiscoveryStateManager.js
 * 
 * NetHack 発見済みアイテム知識管理マネージャー (Discovery Cache)
 * 
 * 【役割と責務】
 * 1. ゲームセッション全体のアイテム鑑定状態（発見済みアイテム・外見・仮名）をメモリ内にキャッシュ管理。
 * 2. ゲーム開始時・再開（Restore）時に、NetHackコアの `\`（Discoveries コマンド）の出力をパースして
 *    セーブデータ内の全鑑定状態（真名・外見・仮名）を一括リハイドレーション（再生）。
 * 3. 床落ちアイテム（Glyph ID / onum）に対するマウスホバー時、WASMへのコマンド発行を一切行わず、
 *    100% 同期的かつゼロ遅延で「識別済み（真名表示）」または「未識別（ネタバレ防止マスク）」を判定。
 */

import { OBJECT_TILEMAP_NAMES } from './tilemappings_data.js';
import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';

// 初回から真名が自明な非ランダム外見カテゴリ（食料、基本道具など）
export const INTRINSICALLY_KNOWN_CATEGORIES = new Set(['FOOD', 'TOOL', 'CONTAINER']);

export class DiscoveryStateManager {
    constructor(options = {}) {
        // 識別済み onum のセット
        this.discoveredOnums = new Set();
        // 外見名 ➡ 真名マッピング (例: "ruby potion" -> "potion of healing")
        this.appearanceMap = new Map();
        // 外見名/真名 ➡ プレイヤー仮名 (例: "silver wand" -> "digging?")
        this.calledNamesMap = new Map();
        // 同期完了フラグ
        this.isSynced = false;

        // onum 逆引き用辞書インデックスの構築
        this._nameToOnumMap = new Map();
        this._initNameIndex();
    }

    /**
     * 名前から onum を逆引きするためのインデックス作成
     * @private
     */
    _initNameIndex() {
        // 1. OBJECT_TILEMAP_NAMES からインデックス登録
        if (OBJECT_TILEMAP_NAMES) {
            for (const [onumStr, fullName] of Object.entries(OBJECT_TILEMAP_NAMES)) {
                if (!fullName) continue;
                const onum = parseInt(onumStr, 10);
                const parts = fullName.toLowerCase().split('/').map(p => p.trim());
                for (const part of parts) {
                    this._nameToOnumMap.set(part, onum);
                    this._nameToOnumMap.set(part.replace(/\s+/g, '_'), onum);
                    this._nameToOnumMap.set(`potion of ${part}`, onum);
                    this._nameToOnumMap.set(`scroll of ${part}`, onum);
                    this._nameToOnumMap.set(`wand of ${part}`, onum);
                    this._nameToOnumMap.set(`ring of ${part}`, onum);
                    this._nameToOnumMap.set(`amulet of ${part}`, onum);
                    this._nameToOnumMap.set(`spellbook of ${part}`, onum);
                }
                this._nameToOnumMap.set(fullName.toLowerCase(), onum);
            }
        }

        // 2. OBJECT_KNOWLEDGE_MAP から完全登録
        if (OBJECT_KNOWLEDGE_MAP) {
            for (const [onum, item] of OBJECT_KNOWLEDGE_MAP.entries()) {
                if (item && item.name) {
                    const nameLower = item.name.toLowerCase();
                    this._nameToOnumMap.set(nameLower, onum);
                    this._nameToOnumMap.set(nameLower.replace(/\s+/g, '_'), onum);
                    if (item.id) {
                        this._nameToOnumMap.set(item.id.toLowerCase(), onum);
                    }
                }
            }
        }
    }

    /**
     * キャッシュのリセット
     */
    reset() {
        this.discoveredOnums.clear();
        this.appearanceMap.clear();
        this.calledNamesMap.clear();
        this.isSynced = false;
    }

    /**
     * `\`（Discoveries コマンド）の出力テキストまたはメニューバッファから全件同期・再生
     * @param {string|Array<string|Object>} textOrLines 
     */
    updateFromDiscoveriesText(textOrLines) {
        if (!textOrLines) return;

        let lines = [];
        if (typeof textOrLines === 'string') {
            lines = textOrLines.split(/\r?\n/);
        } else if (Array.isArray(textOrLines)) {
            lines = textOrLines.map(item => {
                if (typeof item === 'string') return item;
                return item.rawStr || item.str || item.text || '';
            });
        }

        let currentCategory = '';

        for (const rawLine of lines) {
            const line = (rawLine || '').trim();
            if (!line || line.startsWith('Discoveries') || line.startsWith('---')) continue;

            // カテゴリヘッダーの検出 (例: "Potions:", "Scrolls:", "Wands:", "Rings:", "Amulets:", "Spellbooks:")
            const catMatch = line.match(/^([a-zA-Z\s]+):$/);
            if (catMatch) {
                currentCategory = catMatch[1].trim().toLowerCase();
                continue;
            }

            // アイテム行のパース (例: "healing (ruby)", "digging (silver) called dig?", "identify (labeled ZELGO MER)")
            this._parseDiscoveryLine(line, currentCategory);
        }

        this.isSynced = true;
    }

    /**
     * 単一の Discovery 行をパースして登録
     * @private
     */
    _parseDiscoveryLine(line, categoryHint) {
        if (!line) return;

        // 1. プレイヤー仮名 (called ...) の抽出
        let text = line;
        let calledName = null;
        const calledMatch = text.match(/\bcalled\s+([^\(\)]+)/i);
        if (calledMatch) {
            calledName = calledMatch[1].trim();
            text = text.replace(/\bcalled\s+[^\(\)]+/i, '').trim();
        }

        // 2. 外見名 (ruby), (labeled ZELGO MER), (silver) の抽出
        let appearance = null;
        const appMatch = text.match(/\(([^\)]+)\)/);
        if (appMatch) {
            appearance = appMatch[1].trim();
            text = text.replace(/\([^\)]+\)/, '').trim();
        }

        // 3. 真名（基本名称）
        let rawName = text.trim().toLowerCase();
        if (!rawName) return;

        // カテゴリプレフィックスの正規化 (例: "healing" + categoryHint "potions" -> "potion of healing")
        const fullTrueName = this._normalizeItemName(rawName, categoryHint);

        // onum の解決
        const onum = this.lookupOnum(fullTrueName) ?? this.lookupOnum(rawName);

        if (onum !== null && onum !== undefined) {
            this.discoveredOnums.add(onum);
        }

        if (appearance) {
            const normApp = appearance.toLowerCase();
            this.appearanceMap.set(normApp, fullTrueName);
            if (calledName) {
                this.calledNamesMap.set(normApp, calledName);
            }
        }
        if (calledName) {
            this.calledNamesMap.set(fullTrueName.toLowerCase(), calledName);
        }
    }

    /**
     * カテゴリに応じた正式真名の組み立て
     * @private
     */
    _normalizeItemName(name, categoryHint) {
        const cat = (categoryHint || '').toLowerCase();
        if (cat.includes('potion') && !name.includes('potion')) {
            return `potion of ${name}`;
        }
        if (cat.includes('scroll') && !name.includes('scroll')) {
            return `scroll of ${name}`;
        }
        if (cat.includes('wand') && !name.includes('wand')) {
            return `wand of ${name}`;
        }
        if (cat.includes('ring') && !name.includes('ring')) {
            return `ring of ${name}`;
        }
        if (cat.includes('amulet') && !name.includes('amulet')) {
            return `amulet of ${name}`;
        }
        if (cat.includes('spellbook') && !name.includes('spellbook') && !name.includes('book')) {
            return `spellbook of ${name}`;
        }
        return name;
    }

    /**
     * 名称から onum を逆引き
     * @param {string} name 
     * @returns {number|null}
     */
    lookupOnum(name) {
        if (!name || typeof name !== 'string') return null;
        const clean = name.trim().toLowerCase();
        if (this._nameToOnumMap.has(clean)) {
            return this._nameToOnumMap.get(clean);
        }
        const underscore = clean.replace(/\s+/g, '_');
        if (this._nameToOnumMap.has(underscore)) {
            return this._nameToOnumMap.get(underscore);
        }
        return null;
    }

    /**
     * 指定された onum または名称が「識別済み」か同期判定
     * @param {number|string|Object} identifier - onum, アイテム名, またはアイテムオブジェクト
     * @returns {boolean}
     */
    isIdentified(identifier) {
        if (identifier === null || identifier === undefined) return false;

        // A. 数値 (onum) 指定
        if (typeof identifier === 'number') {
            if (this.discoveredOnums.has(identifier)) return true;

            // ランダム外見を持たない本質的に既知のカテゴリ（食料・基本ツール・一部防具等）は常に既知
            if (OBJECT_KNOWLEDGE_MAP && OBJECT_KNOWLEDGE_MAP.has(identifier)) {
                const item = OBJECT_KNOWLEDGE_MAP.get(identifier);
                if (item && INTRINSICALLY_KNOWN_CATEGORIES.has(item.category)) {
                    return true;
                }
            }
            return false;
        }

        // B. オブジェクト指定
        if (typeof identifier === 'object') {
            if (typeof identifier.onum === 'number' && identifier.onum >= 0) {
                return this.isIdentified(identifier.onum);
            }
            const name = identifier.name || identifier.rawText || identifier.str || '';
            return this.isIdentified(name);
        }

        // C. 文字列指定
        if (typeof identifier === 'string') {
            const clean = identifier.trim().toLowerCase();
            const onum = this.lookupOnum(clean);
            if (onum !== null && this.discoveredOnums.has(onum)) {
                return true;
            }
            // 外見マップにあるか
            if (this.appearanceMap.has(clean)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 外見名または onum から識別済み真名を取得（未識別の場合は null）
     * @param {string|number} appearanceOrOnum 
     * @returns {string|null}
     */
    getKnownName(appearanceOrOnum) {
        if (typeof appearanceOrOnum === 'number') {
            if (this.discoveredOnums.has(appearanceOrOnum)) {
                return OBJECT_TILEMAP_NAMES[appearanceOrOnum] || null;
            }
            return null;
        }

        if (typeof appearanceOrOnum === 'string') {
            const lower = appearanceOrOnum.trim().toLowerCase();
            if (this.appearanceMap.has(lower)) {
                return this.appearanceMap.get(lower);
            }
        }

        return null;
    }

    /**
     * 新たに判明したアイテムを学習登録
     * @param {number} onum 
     * @param {string} [trueName] 
     * @param {string} [appearance] 
     * @param {string} [calledName] 
     */
    registerKnownItem(onum, trueName = '', appearance = '', calledName = '') {
        if (typeof onum === 'number' && onum >= 0) {
            this.discoveredOnums.add(onum);
        }
        if (appearance && trueName) {
            this.appearanceMap.set(appearance.toLowerCase(), trueName);
        }
        if (appearance && calledName) {
            this.calledNamesMap.set(appearance.toLowerCase(), calledName);
        }
        if (trueName && calledName) {
            this.calledNamesMap.set(trueName.toLowerCase(), calledName);
        }
    }
}
