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

import { OBJECT_TILEMAP_NAMES } from "../data/tilemappings_data.js";
import { OBJECT_KNOWLEDGE_MAP } from "../data/OBJECT_KNOWLEDGE_FULL.js";
import { DISCOVERY_MESSAGE_MAP } from "../data/DISCOVERY_MESSAGE_MAP.js";
import { APPEARANCE_PATTERNS } from "../engines/ItemIdentificationResolver.js";

// 初回から真名が自明な非ランダム外見カテゴリ（食料、基本道具など）
export const INTRINSICALLY_KNOWN_CATEGORIES = new Set(['FOOD', 'TOOL', 'CONTAINER']);

// NetHack Cコアの Discoveries 出力における既知アイテムクラス（カテゴリヘッダー）
export const KNOWN_DISCOVERY_CATEGORIES = new Set([
    'weapons',
    'armor',
    'scrolls',
    'spellbooks',
    'potions',
    'rings',
    'wands',
    'amulets',
    'tools',
    'gems',
    'gems/stones',
    'stones',
    'food'
]);

export class DiscoveryStateManager {
    constructor(options = {}) {
        // 識別済み onum のセット
        this.discoveredOnums = new Set();
        // 外見名 ➡ 真名マッピング (例: "ruby potion" -> "potion of healing")
        this.appearanceMap = new Map();
        // 外見名/真名 ➡ プレイヤー仮名 (例: "silver wand" -> "digging?")
        this.calledNamesMap = new Map();
        // 翻訳エンジン (TranslationEngine)
        this.translator = options.translator || options.translationEngine || null;
        // インベントリマネージャー (InventoryStateManager)
        this.inventoryStateManager = options.inventoryStateManager || null;
        // 同期完了フラグ
        this.isSynced = false;

        // onum 逆引き用辞書インデックスの構築
        this._nameToOnumMap = new Map();
        this._initNameIndex();
    }

    /**
     * 翻訳エンジンの設定・更新
     * @param {Object} translator 
     */
    setTranslationEngine(translator) {
        this.translator = translator;
    }

    /**
     * インベントリマネージャーの設定・更新
     * @param {Object} invMgr 
     */
    setInventoryStateManager(invMgr) {
        this.inventoryStateManager = invMgr;
    }

    /**
     * 指定された名前が既知の外見名・変名パターンかどうかを判定
     * @param {string} name 
     * @returns {boolean}
     */
    _isKnownAppearance(name) {
        if (!name || typeof name !== 'string') return false;
        const lower = name.toLowerCase().trim();
        for (const list of Object.values(APPEARANCE_PATTERNS)) {
            if (list.includes(lower)) return true;
        }
        return false;
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
            let line = (rawLine || '').trim();
            // DriverTestClient や NetHack のウィンドウデバッグプレフィックス "[Win <id>] " を除去
            line = line.replace(/^\[Win\s+\d+\]\s*/i, '').trim();
            if (!line || line.startsWith('Discoveries') || line.startsWith('---')) continue;

            const lower = line.toLowerCase();

            // カテゴリヘッダー（アイテムクラス）の検出
            // 1. "Potions:" などのコロン付き
            // 2. "Weapons", "Armor", "Scrolls", "Spellbooks", "Potions" などの単独行（コロンなし）
            const catMatch = line.match(/^([a-zA-Z\s\/]+):$/);
            if (catMatch) {
                currentCategory = catMatch[1].trim().toLowerCase();
                continue;
            }
            if (KNOWN_DISCOVERY_CATEGORIES.has(lower)) {
                currentCategory = lower;
                continue;
            }

            // アイテム行のパース (例: "* shuriken (throwing star)", "  potion of healing (pink)")
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

        // 0. NetHack Cコアの装飾文字除去 ('*', '-', '+', スペース, タブ)
        // 例: "* elven arrow (runed arrow)" -> "elven arrow (runed arrow)"
        let text = line.trim().replace(/^[\*\-\+\s]+/, '').trim();

        // 1. プレイヤー仮名 (called ...) の抽出
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

        // 3. 真名（基本名称）の抽出と厳密判定
        let rawName = text.trim().replace(/^[\*\-\+\s]+/, '').toLowerCase();

        // 🎯 カテゴリヘッダー（"weapons", "armor", "scrolls" 等）が誤って渡された場合の防御
        if (KNOWN_DISCOVERY_CATEGORIES.has(rawName) && !appearance && !calledName) {
            return;
        }

        // 🎯 真名が判明しているかどうかの判定 (NetHack Cコア objnam.c / dodiscovered 準拠)
        // A. rawName が空、または単なるカテゴリ名（"potion", "scroll", "wand", "ring", "amulet", "spellbook", "book"）の場合
        //    -> 真名は未識別！(例: "potion called foo (ruby)" や "(silver) called dig?")
        const isGenericCategoryName = /^(potions?|scrolls?|wands?|rings?|amulets?|spellbooks?|books?)$/i.test(rawName);

        // B. rawName 自体がランダム外見・変名そのものである場合 (例: "crude dagger called mydagger", "conical hat called foo")
        //    -> 括弧がなく外見名が直接表示されているため、真名は未識別！
        const isRawNameAppearance = this._isKnownAppearance(rawName);

        const isUnidentifiedLine = !rawName || isGenericCategoryName || isRawNameAppearance;

        if (isUnidentifiedLine) {
            // 真名未判明の仮名アイテム
            const appKey = appearance ? appearance.toLowerCase() : (rawName ? rawName.toLowerCase() : '');
            if (appKey && calledName) {
                this.calledNamesMap.set(appKey, calledName);
            }
            return;
        }

        // C. 真名（基本名称）が判明している場合
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
        const clean = name.trim().replace(/^[\*\-\+\s]+/, '').toLowerCase();
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
            if (!trueName && OBJECT_KNOWLEDGE_MAP && OBJECT_KNOWLEDGE_MAP.has(onum)) {
                const k = OBJECT_KNOWLEDGE_MAP.get(onum);
                trueName = k.name || k.id || '';
            }
        }
        if (trueName) {
            const key = appearance ? appearance.toLowerCase() : trueName.toLowerCase();
            this.appearanceMap.set(key, trueName);
        }
        if (appearance && calledName) {
            this.calledNamesMap.set(appearance.toLowerCase(), calledName);
        }
        if (trueName && calledName) {
            this.calledNamesMap.set(trueName.toLowerCase(), calledName);
        }
    }

    /**
     * テキストの日本語訳を取得（translator が利用可能な場合）
     * @private
     * @param {string} text
     * @returns {string|null}
     */
    _translateText(text) {
        if (!text || typeof text !== 'string') return null;
        if (!this.translator || typeof this.translator.translate !== 'function') return null;
        try {
            const tr = this.translator.translate(text);
            if (tr && tr !== text) {
                return tr;
            }
        } catch (e) {}
        return null;
    }

    /**
     * 発見済みアイテムの一覧（外見・真名・仮名・カテゴリ）を統合取得
     * @returns {Array<{ onum: number|null, trueName: string, nameJa: string|null, appearance: string, appearanceJa: string|null, calledName: string|null, category: string, isDiscovered: boolean }>}
     */
    getDiscoveredItems() {
        const items = [];
        const seenNames = new Set();

        // 1. appearanceMap (例: "ruby" -> "potion of healing", または "potion of healing" -> "potion of healing")
        for (const [app, trueName] of this.appearanceMap.entries()) {
            const cleanTrueName = (trueName || '').replace(/^[\*\-\+\s]+/, '').trim();
            const lowerName = cleanTrueName.toLowerCase();
            const called = this.calledNamesMap.get(app) || this.calledNamesMap.get(lowerName) || null;
            const onum = this.lookupOnum(cleanTrueName);
            const k = (onum !== null && onum !== undefined && OBJECT_KNOWLEDGE_MAP) ? OBJECT_KNOWLEDGE_MAP.get(onum) : null;
            seenNames.add(lowerName);

            const appearanceStr = (app !== lowerName) ? app : '';
            const appJa = appearanceStr ? this._translateText(appearanceStr) : null;
            const nameJa = k?.nameJa || this._translateText(cleanTrueName) || null;

            items.push({
                onum: onum ?? null,
                trueName: k?.name || cleanTrueName,
                nameJa: nameJa,
                appearance: appearanceStr,
                appearanceJa: appJa,
                calledName: called,
                category: (k?.category ? k.category.toLowerCase() : this._inferCategory(cleanTrueName, app)),
                knowledge: k || null,
                isDiscovered: true
            });
        }

        // 2. discoveredOnums (識別済み onum)
        for (const onum of this.discoveredOnums) {
            if (OBJECT_KNOWLEDGE_MAP && OBJECT_KNOWLEDGE_MAP.has(onum)) {
                const k = OBJECT_KNOWLEDGE_MAP.get(onum);
                const name = k.name || k.id || '';
                const lowerName = name.toLowerCase();
                if (lowerName && !seenNames.has(lowerName)) {
                    seenNames.add(lowerName);
                    const called = this.calledNamesMap.get(lowerName) || null;
                    const nameJa = k.nameJa || this._translateText(name) || null;
                    items.push({
                        onum,
                        trueName: name,
                        nameJa: nameJa,
                        appearance: '',
                        appearanceJa: null,
                        calledName: called,
                        category: (k.category ? k.category.toLowerCase() : this._inferCategory(name, '')),
                        knowledge: k,
                        isDiscovered: true
                    });
                }
            }
        }

        // 3. calledNamesMap だけに存在する仮名アイテム
        for (const [key, called] of this.calledNamesMap.entries()) {
            if (!seenNames.has(key)) {
                seenNames.add(key);
                const onum = this.lookupOnum(key);
                const k = (onum !== null && onum !== undefined && OBJECT_KNOWLEDGE_MAP) ? OBJECT_KNOWLEDGE_MAP.get(onum) : null;
                const appJa = this._translateText(key);
                const nameJa = appJa || key;
                items.push({
                    onum: onum ?? null,
                    trueName: key,
                    nameJa: nameJa,
                    appearance: key,
                    appearanceJa: appJa,
                    calledName: called,
                    category: (k?.category ? k.category.toLowerCase() : this._inferCategory(key, '')),
                    knowledge: null,
                    isDiscovered: false
                });
            }
        }

        // 4. インベントリ（所持品）内のアイテムとの動的統合 (後から拾ったアイテムの抜け落ち防止)
        const invItems = this.inventoryStateManager 
            ? (typeof this.inventoryStateManager.getItems === 'function' 
                ? this.inventoryStateManager.getItems() 
                : (Array.isArray(this.inventoryStateManager.items) ? this.inventoryStateManager.items : []))
            : [];

        if (Array.isArray(invItems)) {
            for (const item of invItems) {
                if (!item) continue;
                const iden = item.identification;
                const onum = (typeof item.onum === 'number' && item.onum >= 0) 
                    ? item.onum 
                    : this.lookupOnum(iden?.trueName || iden?.coreName || item.rawText || item.name);
                const k = (onum !== null && onum !== undefined && OBJECT_KNOWLEDGE_MAP) ? OBJECT_KNOWLEDGE_MAP.get(onum) : item.knowledge;
                const candidateTrueName = iden?.trueName || iden?.coreName || k?.name || item.name || item.rawText || '';
                const cleanTrue = candidateTrueName.replace(/^[\*\-\+\s]+/, '').trim();
                const lowerName = cleanTrue.toLowerCase();

                // A. 識別済みインベントリアイテム (真名が判明しているアイテム)
                if (iden && !iden.isUnidentified && lowerName && !seenNames.has(lowerName)) {
                    seenNames.add(lowerName);
                    const app = iden.appearanceName || iden.appearance || '';
                    const appJa = app ? this._translateText(app) : null;
                    const nameJa = k?.nameJa || item.nameJa || this._translateText(cleanTrue) || null;
                    items.push({
                        onum: onum ?? null,
                        trueName: k?.name || cleanTrue,
                        nameJa: nameJa,
                        appearance: app,
                        appearanceJa: appJa,
                        calledName: iden.calledName || null,
                        category: (k?.category ? k.category.toLowerCase() : this._inferCategory(cleanTrue, app)),
                        knowledge: k || null,
                        isDiscovered: true
                    });
                }
                // B. 仮名付きインベントリアイテム (未識別だが仮名が付いているアイテム)
                else if (iden && iden.calledName) {
                    const appKey = (iden.appearanceName || iden.appearance || item.rawText || item.name || '').trim();
                    const appLower = appKey.toLowerCase();
                    if (appLower && !seenNames.has(appLower)) {
                        seenNames.add(appLower);
                        const appJa = this._translateText(appKey);
                        const nameJa = appJa || appKey;
                        items.push({
                            onum: onum ?? null,
                            trueName: appKey,
                            nameJa: nameJa,
                            appearance: appKey,
                            appearanceJa: appJa,
                            calledName: iden.calledName,
                            category: (k?.category ? k.category.toLowerCase() : this._inferCategory(appKey, '')),
                            knowledge: null,
                            isDiscovered: false
                        });
                    }
                }
            }
        }

        return items;
    }

    _inferCategory(trueName, app) {
        // 1. ナレッジマスターからの逆引き最優先
        const onum = this.lookupOnum(trueName);
        if (onum !== null && onum !== undefined && OBJECT_KNOWLEDGE_MAP && OBJECT_KNOWLEDGE_MAP.has(onum)) {
            const k = OBJECT_KNOWLEDGE_MAP.get(onum);
            if (k && k.category) {
                return k.category.toLowerCase();
            }
        }

        const t = (trueName || '').toLowerCase();
        const a = (app || '').toLowerCase();

        // 2. 防具・鎧判定 (ring mail, scale mail, chain mail, plate mail 等を最優先で防具へ)
        if (/\bmail\b/i.test(t) || /\b(armor|shield|helmet|helm|boots|gloves|cloak|suit)\b/i.test(t)) return 'armor';

        // 3. 武器判定
        if (/\b(sword|blade|dagger|knife|bow|arrow|axe|spear|mace|flail|dart|shuriken|polearm)\b/i.test(t)) return 'weapon';

        // 4. ランダム外見カテゴリ (単語境界判定)
        if (/\bpotion\b/i.test(t) || /\bpotion\b/i.test(a)) return 'potion';
        if (/\bscroll\b/i.test(t) || /\bscroll\b/i.test(a)) return 'scroll';
        if (/\bwand\b/i.test(t) || /\bwand\b/i.test(a)) return 'wand';
        if (/\bring\b/i.test(t) || /\bring\b/i.test(a)) return 'ring';
        if (/\bamulet\b/i.test(t) || /\bamulet\b/i.test(a)) return 'amulet';
        if (/\b(spellbook|book)\b/i.test(t) || /\b(spellbook|book)\b/i.test(a)) return 'spellbook';

        // 5. 食料・道具
        if (/\b(food|corpse|meat|ration|apple|pear|slime)\b/i.test(t)) return 'food';
        if (/\b(lamp|lantern|key|lock|horn|whistle|bell|bag|box|chest|towel|mirror)\b/i.test(t)) return 'tool';

        return 'other';
    }

    /**
     * 効果メッセージ (MessageContext) から真名を特定し、発見済み (Discovered) へ昇格
     * @param {Object} context - MessageContext
     * @param {Object} [recentUsedItem] - 直前使用アイテム情報 (onum, appearance 等)
     * @returns {Object|null} 昇格したアイテム情報 { trueName, onum, appearance } または null
     */
    processDiscoveryMessage(context, recentUsedItem = null) {
        if (!context || !context.messageId) return null;

        const mapping = DISCOVERY_MESSAGE_MAP[context.messageId];
        if (!mapping || !mapping.itemType) return null;

        const trueName = mapping.itemType;
        const onum = this.lookupOnum(trueName) ?? (recentUsedItem?.onum ?? null);
        const appearance = recentUsedItem?.appearance || (recentUsedItem?.name ? this._extractAppearance(recentUsedItem.name) : null);

        this.registerKnownItem(onum, trueName, appearance);

        return {
            trueName,
            onum,
            appearance,
            context
        };
    }

    /**
     * "a ruby potion", "a silver wand" などの文字列から外見記述を抽出
     * @private
     */
    _extractAppearance(text) {
        if (!text || typeof text !== 'string') return null;
        let clean = text.replace(/^(a|an|the|\d+)\s+/i, '').trim();
        const m = clean.match(/^([a-zA-Z\s]+)\s+(potion|scroll|wand|ring|amulet|spellbook|book)\b/i);
        if (m) {
            return m[1].trim().toLowerCase();
        }
        return clean.toLowerCase();
    }
}
