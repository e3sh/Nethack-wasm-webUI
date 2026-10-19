/**
 * ItemNormalizer.js
 * 
 * JS層におけるアイテムデータモデルの単一正規化エンジン (Canonical Item Schema ゲートウェイ)
 * NetHack公式 C コア (src/objnam.c: xname_flags / doname_base) の決定木アルゴリズムに忠実に準拠し、
 * Cコアの構造化フラグ・数値群から決定論的に英語・日本語・賢者の知恵表示名称を構築する。
 * 
 * 準拠:
 * - NetHack 5.0 (3.7) src/objnam.c
 * - docs/3_gkl/canonical_item_schema_and_normalization_architecture.ja.md
 */

import { OBJECT_KNOWLEDGE_MAP } from '../data/OBJECT_KNOWLEDGE_FULL.js';
import { MONSTER_KNOWLEDGE_MAP } from '../data/MONSTER_KNOWLEDGE_FULL.js';
import { ItemIdentificationResolver } from '../engines/ItemIdentificationResolver.js';

/**
 * 許可される正規化カテゴリ（大文字厳格）
 */
export const VALID_CATEGORIES = new Set([
    'WEAPON',
    'ARMOR',
    'RING',
    'AMULET',
    'TOOL',
    'FOOD',
    'POTION',
    'SCROLL',
    'SPELLBOOK',
    'WAND',
    'GOLD',
    'GEM',
    'ROCK',
    'BALL',
    'CHAIN',
    'VENOM',
    'CORPSE',
    'STATUE',
    'OTHER'
]);

/**
 * Cコア oclass 数値およびシンボル文字から正規化カテゴリへのマッピング
 */
export const OCLASS_TO_CATEGORY_MAP = Object.freeze({
    1: 'GOLD',
    2: 'WEAPON',
    3: 'ARMOR',
    4: 'RING',
    5: 'AMULET',
    6: 'TOOL',
    7: 'FOOD',
    8: 'POTION',
    9: 'SCROLL',
    10: 'SPELLBOOK',
    11: 'WAND',
    12: 'GOLD',
    13: 'GEM',
    14: 'ROCK',
    15: 'BALL',
    16: 'CHAIN',
    17: 'VENOM',

    // シンボル文字
    ')': 'WEAPON',
    '[': 'ARMOR',
    '=': 'RING',
    '"': 'AMULET',
    '(': 'TOOL',
    '%': 'FOOD',
    '!': 'POTION',
    '?': 'SCROLL',
    '+': 'SPELLBOOK',
    '/': 'WAND',
    '$': 'GOLD',
    '*': 'GEM',
    '`': 'ROCK',
    '0': 'BALL',
    '_': 'CHAIN',
    '.': 'VENOM'
});

/**
 * カテゴリエイリアス・小文字対応マップ
 */
export const CATEGORY_ALIAS_MAP = Object.freeze({
    'WEAPONS': 'WEAPON',
    'ARMORS': 'ARMOR',
    'RINGS': 'RING',
    'AMULETS': 'AMULET',
    'TOOLS': 'TOOL',
    'FOODS': 'FOOD',
    'POTIONS': 'POTION',
    'SCROLLS': 'SCROLL',
    'SPELLBOOKS': 'SPELLBOOK',
    'SPBOOK': 'SPELLBOOK',
    'BOOK': 'SPELLBOOK',
    'BOOKS': 'SPELLBOOK',
    'WANDS': 'WAND',
    'COIN': 'GOLD',
    'COINS': 'GOLD',
    'GOLD_PIECE': 'GOLD',
    'GEMS': 'GEM',
    'ROCKS': 'ROCK',
    'BALLS': 'BALL',
    'CHAINS': 'CHAIN',
    'VENOMS': 'VENOM',
    'CORPSES': 'CORPSE',
    'STATUES': 'STATUE',
    'OBJECT': 'OTHER',
    'MISC': 'OTHER'
});

let nameToOnumMap = null;
function singularizeItemCandidate(str) {
    if (!str) return str;
    let s = str.trim();
    // 構造的複数形
    s = s.replace(/\bpotions\s+of\s+/i, 'potion of ');
    s = s.replace(/\bscrolls\s+of\s+/i, 'scroll of ');
    s = s.replace(/\bwands\s+of\s+/i, 'wand of ');
    s = s.replace(/\brings\s+of\s+/i, 'ring of ');
    s = s.replace(/\bspellbooks\s+of\s+/i, 'spellbook of ');
    s = s.replace(/\bamulets\s+(of|versus)\s+/i, 'amulet $1 ');
    s = s.replace(/\bbooks\s+of\s+/i, 'book of ');
    s = s.replace(/\bgold\s+pieces\b/i, 'gold piece');
    s = s.replace(/\bpieces\s+of\s+gold\b/i, 'gold piece');
    s = s.replace(/\bzorkmids\b/i, 'zorkmid');
    return s;
}

function pluralizeBaseNameEn(name) {
    if (!name) return name;
    if (/^potion of /i.test(name)) return name.replace(/^potion of /i, 'potions of ');
    if (/^scroll of /i.test(name)) return name.replace(/^scroll of /i, 'scrolls of ');
    if (/^wand of /i.test(name)) return name.replace(/^wand of /i, 'wands of ');
    if (/^ring of /i.test(name)) return name.replace(/^ring of /i, 'rings of ');
    if (/^spellbook of /i.test(name)) return name.replace(/^spellbook of /i, 'spellbooks of ');
    if (/^amulet (of|versus) /i.test(name)) return name.replace(/^amulet (of|versus) /i, 'amulets $1 ');
    if (/^book of /i.test(name)) return name.replace(/^book of /i, 'books of ');
    if (name.endsWith('s') || name.endsWith('sh') || name.endsWith('ch') || name.endsWith('x')) return `${name}es`;
    return `${name}s`;
}

function getOnumByName(rawName) {
    if (!rawName || typeof rawName !== 'string') return -1;
    if (!nameToOnumMap) {
        nameToOnumMap = new Map();
        if (OBJECT_KNOWLEDGE_MAP) {
            for (const [onum, k] of OBJECT_KNOWLEDGE_MAP.entries()) {
                if (k.name) nameToOnumMap.set(k.name.toLowerCase(), onum);
                if (k.baseName) nameToOnumMap.set(k.baseName.toLowerCase(), onum);
                if (k.nameJa) nameToOnumMap.set(k.nameJa, onum);
            }
        }
    }

    // 金貨の即座判定
    if (/(?:gold\s+pieces?|pieces?\s+of\s+gold|zorkmids?|枚の金貨|^金貨$)/i.test(rawName.trim())) {
        return 438;
    }

    // サフィックス・付帯情報の除去 (called, named, (weapon in hand), etc.)
    let working = rawName.trim().toLowerCase();
    working = working.replace(/\s*\(((?:weapon in hand|in off hand|in quiver|being worn|on left hand|on right hand|around neck|手|副|矢筒|装備中|左手|右手|首))\)\s*$/i, '');
    working = working.replace(/\s*\((\d+):(\d+)\)\s*$/, '');
    working = working.replace(/\s*(?:called\s+"[^"]+"|called\s+[^\s\(\]]+|\[仮名:\s*[^\]]+\])\s*/i, '');
    working = working.replace(/\s*(?:named\s+"[^"]+"|named\s+[^\s\(\]]+|\[銘:\s*[^\]]+\])\s*/i, '');

    const clean = working.replace(/^[\*\-\+\s]+/, '')
        .replace(/^[a-zA-Z]\s*[\-\)\.]\s*/, '')
        .replace(/^(\d+)(?:個|本|枚|つ|杯|巻|着|缶|服|袋)?の?\s+/, '')
        .replace(/^(a|an|the)\s+/i, '')
        .replace(/\s*\([^\)]*\)$/, '')
        .trim();

    if (nameToOnumMap.has(clean)) {
        return nameToOnumMap.get(clean);
    }

    const singularClean = singularizeItemCandidate(clean);
    if (nameToOnumMap.has(singularClean)) {
        return nameToOnumMap.get(singularClean);
    }

    // 連続する修飾語プレフィックス（empty, uncursed, blessed, cursed, 等）を除去して再試行
    let stripped = singularClean;
    const prefixRegex = /^(empty|uncursed|blessed|cursed|diluted|locked|unlocked|broken|trapped|poisoned|historic|rustproof|fireproof|corrodeproof|corroded|very corroded|thoroughly corroded|rusty|very rusty|thoroughly rusty|burnt|very burnt|thoroughly burnt|rotted|very rotted|thoroughly rotted|\+?\-?\d+|空の|普通の|呪われていない|祝福された|呪われた)\s+/i;
    let prev = '';
    while (stripped !== prev) {
        prev = stripped;
        stripped = stripped.replace(prefixRegex, '').trim();
    }

    if (stripped) {
        if (nameToOnumMap.has(stripped)) {
            return nameToOnumMap.get(stripped);
        }
        const singularStripped = singularizeItemCandidate(stripped);
        if (nameToOnumMap.has(singularStripped)) {
            return nameToOnumMap.get(singularStripped);
        }
        // 単純末尾 s / es の単数化
        if (singularStripped.endsWith('s') && !singularStripped.endsWith('ss')) {
            const noS = singularStripped.slice(0, -1);
            if (nameToOnumMap.has(noS)) return nameToOnumMap.get(noS);
            if (singularStripped.endsWith('es')) {
                const noEs = singularStripped.slice(0, -2);
                if (nameToOnumMap.has(noEs)) return nameToOnumMap.get(noEs);
            }
        }
    }

    return -1;
}

export class ItemNormalizer {
    /**
     * 任意のアイテム生オブジェクトを CanonicalItem スキーマへ決定論的に正規化する
     * @param {Object|string} rawItem 
     * @param {Object} [options={}]
     * @param {string} [options.source='INVENTORY']
     * @param {string} [options.defaultSource='INVENTORY']
     * @param {boolean} [options.sagesWisdomMode=false]
     * @returns {import('../../index').CanonicalItem}
     */
    static normalize(rawItem, options = {}) {
        if (!rawItem) {
            return this._createDefaultItem(options.source || options.defaultSource || 'VIRTUAL');
        }

        // 文字列型が渡された場合はテキストパースしてオブジェクト化
        if (typeof rawItem === 'string') {
            const parsed = this.parseRawItemText(rawItem);
            rawItem = {
                rawText: rawItem,
                name: parsed.cleanName,
                str: rawItem,
                rawStr: rawItem,
                ...parsed
            };
        } else if (typeof rawItem !== 'object') {
            return this._createDefaultItem(options.source || options.defaultSource || 'VIRTUAL');
        }

        // すでに正規化済みかつ上書き不要な場合は安全なクローンを返す
        if (rawItem._canonical === true && (!options.source || rawItem.source === options.source) && !options.sagesWisdomMode) {
            const resolvedId = (typeof rawItem.identifier === 'number') ? rawItem.identifier : (rawItem.rawObjPtr > 0 ? rawItem.rawObjPtr : undefined);
            return {
                ...rawItem,
                ...(resolvedId !== undefined ? { identifier: resolvedId } : {}),
                identification: { ...(rawItem.identification || {}) },
                alternativeActions: Array.isArray(rawItem.alternativeActions) ? rawItem.alternativeActions.map(a => ({ ...a })) : [],
                defaultSequence: Array.isArray(rawItem.defaultSequence) ? [...rawItem.defaultSequence] : []
            };
        }

        const source = options.source || rawItem.source || options.defaultSource || 'INVENTORY';
        const isWisdom = Boolean(options.sagesWisdomMode || rawItem.isWisdomRevealed || rawItem.identification?.isWisdomRevealed || rawItem.sagesWisdomMode);

        // 0. テキスト候補の抽出と事前解析
        const textCand = (rawItem.rawText || rawItem.rawStr || rawItem.str || rawItem.text || rawItem.name || '').trim();
        const parsedFromText = textCand ? this.parseRawItemText(textCand) : null;

        // 1. 識別子・出所
        const letter = this.normalizeLetter(rawItem) ?? (parsedFromText?.letter || null);
        const onum = this._resolveOnum(rawItem, parsedFromText);
        const glyphId = (typeof rawItem.glyphId === 'number') ? rawItem.glyphId : (typeof rawItem.glyph === 'number' ? rawItem.glyph : -1);
        const rawObjPtr = rawItem.rawObjPtr || rawItem.ptr || rawItem.directObject?.rawObjPtr || rawItem.directObject?.ptr || (typeof rawItem.identifier === 'number' && rawItem.identifier > 0 ? rawItem.identifier : 0);
        const identifier = (typeof rawItem.identifier === 'number') ? rawItem.identifier : (rawObjPtr > 0 ? rawObjPtr : undefined);
        const o_id = rawItem.o_id || rawItem.directObject?.o_id || 0;
        const corpsenm = (rawItem.corpsenm !== undefined && rawItem.corpsenm !== null) ? Number(rawItem.corpsenm) : -1;

        // 2. カテゴリ・分類
        const oclass = this._resolveOclass(rawItem, parsedFromText);
        const master = (onum >= 0 && OBJECT_KNOWLEDGE_MAP) ? OBJECT_KNOWLEDGE_MAP.get(onum) : null;
        let category = this.normalizeCategory(rawItem.category || rawItem.itemCategory || rawItem.onumCategory || rawItem.identification?.category || rawItem.knowledge?.category || parsedFromText?.category, oclass);
        if (category === 'OTHER' && (parsedFromText?.isGold || rawItem.isGold || onum === 438)) {
            category = 'GOLD';
        }
        if (category === 'OTHER' && master?.category) {
            category = this.normalizeCategory(master.category, oclass);
        }
        if (category === 'OTHER' && !rawItem.category && !rawItem.itemCategory) {
            const rawTextCand = (rawItem.rawText || rawItem.rawStr || rawItem.str || rawItem.text || rawItem.name || '').trim();
            if (rawTextCand) {
                const inferred = ItemIdentificationResolver.inferCategory(rawTextCand);
                if (inferred && inferred !== 'OTHER' && inferred !== 'TOOL') {
                    category = inferred;
                }
            }
        }

        // 3. フラグ構造体の正規化（Cコア構造体フラグ・明示的プロパティのみを信頼）
        const flags = this._normalizeFlags(rawItem, parsedFromText);

        // 4. 識別・命名状態の解決
        const cleanText = (rawItem.rawText || rawItem.rawStr || rawItem.str || rawItem.text || rawItem.name || rawItem.displayName || parsedFromText?.cleanName || '').trim();
        const isUnidentified = this._resolveIsUnidentified(rawItem, onum, category, cleanText, flags, options, parsedFromText);
        const isDiscovered = !isUnidentified;
        const bucStatus = this.normalizeBuc(rawItem.bucStatus || rawItem.identification?.bucStatus, flags);
        const calledName = rawItem.calledName || rawItem.identification?.calledName || rawItem.uname || null;
        const namedInstance = rawItem.namedInstance || rawItem.identification?.namedInstance || rawItem.oname || null;
        const spe = this._resolveSpe(rawItem, parsedFromText);
        const recharged = (typeof rawItem.recharged === 'number') ? rawItem.recharged : (typeof rawItem.directObject?.recharged === 'number' ? rawItem.directObject.recharged : 0);
        const idLevel = this._resolveIdLevel(rawItem, isUnidentified, calledName, bucStatus, spe);

        // 5. 数量・スペック・装備状態
        const quan = (typeof rawItem.quan === 'number' && !isNaN(rawItem.quan) && rawItem.quan > 0)
            ? rawItem.quan
            : ((typeof rawItem.count === 'number' && rawItem.count > 0)
                ? rawItem.count
                : ((typeof rawItem.directObject?.quan === 'number' && rawItem.directObject.quan > 0)
                    ? rawItem.directObject.quan
                    : (parsedFromText?.quan || 1)));
        const weight = (typeof rawItem.weight === 'number') ? rawItem.weight : (Number(rawItem.owt) || 0);
        const equipSlot = rawItem.equipSlot || null;
        const isEquipped = Boolean(rawItem.isEquipped || equipSlot);
        const isWielded = Boolean(rawItem.isWielded || equipSlot === 'weapon');
        const isOffhand = Boolean(rawItem.isOffhand || equipSlot === 'offhand');
        const isQuivered = Boolean(rawItem.isQuivered || equipSlot === 'quiver');
        const isWorn = Boolean(rawItem.isWorn || (isEquipped && !isWielded && !isOffhand && !isQuivered));

        // 6. NetHack 公式 src/objnam.c 準拠の決定論的名称生成
        const names = this._buildItemNames({
            onum,
            category,
            oclass,
            quan,
            spe,
            recharged,
            corpsenm,
            flags,
            calledName,
            namedInstance,
            isUnidentified,
            isDiscovered,
            isWisdom,
            isWielded,
            isOffhand,
            isQuivered,
            isWorn,
            equipSlot,
            master,
            rawItem,
            options
        });

        // 7. アクション
        const defaultVerb = rawItem.defaultVerb || null;
        const defaultSequence = Array.isArray(rawItem.defaultSequence) ? [...rawItem.defaultSequence] : (rawItem.verbKey && letter ? [rawItem.verbKey, letter] : []);
        const defaultActionLabel = rawItem.defaultActionLabel || null;
        const defaultActionLabelJa = rawItem.defaultActionLabelJa || rawItem.actionLabelJa || null;
        const alternativeActions = Array.isArray(rawItem.alternativeActions) ? rawItem.alternativeActions.map(a => ({ ...a })) : [];

        // 8. 構造化オブジェクト同期
        const identification = {
            ...(rawItem.identification || {}),
            isUnidentified,
            isDiscovered,
            isWisdomRevealed: isWisdom,
            idLevel,
            bucStatus,
            calledName,
            namedInstance,
            category,
            letter,
            enchantment: spe,
            charges: spe
        };

        const knowledge = rawItem.knowledge ? { ...rawItem.knowledge } : null;
        const skillBadge = rawItem.skillBadge ? { ...rawItem.skillBadge } : null;

        const rawText = (typeof rawItem.rawText === 'string' && rawItem.rawText.trim().length > 0) ? rawItem.rawText : names.rawText;
        const isContainer = (source === 'CONTAINER');

        // 英語表示時: CONTAINER 由来かつ Cコア完成文字列が存在する場合は無加工の真値（完全な土管）
        let displayName = names.displayName;
        if (isContainer && rawText && !rawItem.isGold) {
            displayName = rawText;
        }

        // 日本語表示時: CONTAINER 由来で translator があれば rawText を翻訳、通常は names.displayNameJa (SSOT)
        let displayNameJa = names.displayNameJa;
        const translator = options.translator || rawItem.translator || options.translationEngine || null;
        if (isContainer && translator && typeof translator.translate === 'function' && rawText && !rawItem.isGold) {
            const tr = translator.translate(rawText);
            if (tr && tr !== rawText) {
                displayNameJa = tr;
            }
        }

        return {
            _canonical: true,
            source,
            letter,
            ...(identifier !== undefined ? { identifier } : {}),
            onum,
            glyphId,
            rawObjPtr,
            cobjPtr: (typeof rawItem.cobjPtr === 'number') ? rawItem.cobjPtr : (typeof rawItem.directObject?.cobjPtr === 'number' ? rawItem.directObject.cobjPtr : 0),
            ptr: rawItem.ptr || rawObjPtr,
            flags,
            o_id,
            corpsenm,
            category,
            oclass,
            isUnidentified,
            isDiscovered,
            isWisdomRevealed: isWisdom,
            idLevel,
            bucStatus,
            calledName,
            namedInstance,
            rawText,
            name: names.name,
            nameJa: (rawItem.nameJa && !rawItem.nameJa.includes('[仮名:')) ? rawItem.nameJa : names.nameJa,
            baseName: names.name,
            appearanceName: names.appearanceName,
            appearanceNameJa: names.appearanceNameJa,
            appearance: rawItem.appearance || names.appearanceName,
            appearanceJa: rawItem.appearanceJa || names.appearanceNameJa,
            trueName: names.trueName,
            trueNameJa: names.trueNameJa,
            displayName,
            displayNameJa,
            quan,
            count: quan,
            spe,
            recharged,
            weight,
            equipSlot,
            isEquipped,
            isWielded,
            isOffhand,
            isQuivered,
            isWorn,
            isAmmo: Boolean(rawItem.isAmmo || master?.isAmmo),
            isLauncher: Boolean(rawItem.isLauncher || master?.isLauncher),
            isCanOpener: Boolean(rawItem.isCanOpener || master?.isCanOpener),
            isTin: Boolean(rawItem.isTin || master?.isTin || onum === 296),
            isBox: Boolean(rawItem.isBox || (master?.isBox) || onum === 214 || onum === 215 || onum === 216),
            isBag: Boolean(rawItem.isBag || (master?.isBag) || onum === 217 || onum === 218 || onum === 220),
            isTouchstone: Boolean(rawItem.isTouchstone || master?.isTouchstone),
            isDigWand: Boolean(rawItem.isDigWand),
            isGem: Boolean(rawItem.isGem || category === 'GEM'),
            isGold: Boolean(rawItem.isGold || category === 'GOLD' || onum === 438 || parsedFromText?.isGold),
            actionRecipe: rawItem.actionRecipe || null,
            defaultVerb,
            defaultSequence,
            defaultActionLabel,
            defaultActionLabelJa,
            alternativeActions,
            identification,
            knowledge,
            skillBadge,
            directObject: rawItem.directObject || null,
            floorObjects: rawItem.floorObjects || null,
            extraPileCount: rawItem.extraPileCount ?? 0,
            isPile: Boolean(rawItem.isPile)
        };
    }

    /**
     * 文字列入力に対するプロパティ正規化と金貨等の基本情報抽出
     * ※BUC・強化値・状態異常・チャージ数の逆算・捏造は完全排除（CコアSSOT原則）
     * @param {string} text 
     * @returns {Object}
     */
    static parseRawItemText(text) {
        if (!text || typeof text !== 'string') return {};
        const trimmed = text.trim();
        if (!trimmed) return {};

        const res = {
            flags: {},
            bucStatus: 'UNKNOWN',
            quan: null,
            spe: null,
            recharged: 0,
            calledName: null,
            namedInstance: null,
            equipSlot: null,
            isWielded: false,
            isOffhand: false,
            isQuivered: false,
            isWorn: false,
            category: null,
            onum: -1,
            isGold: false,
            cleanName: trimmed
        };

        let working = trimmed;

        // 1. 金貨判定: "150 gold pieces", "1 gold piece", "250枚の金貨", "金貨"
        const goldMatch = working.match(/^(\d+)\s*(?:gold\s+pieces?|pieces?\s+of\s+gold|zorkmids?|枚の金貨)/i);
        if (goldMatch) {
            res.isGold = true;
            res.category = 'GOLD';
            res.onum = 438;
            res.quan = parseInt(goldMatch[1], 10);
            res.cleanName = 'gold piece';
            return res;
        } else if (/^(?:a|one|1)\s+gold\s+piece/i.test(working) || working === '金貨' || working === '1枚の金貨') {
            res.isGold = true;
            res.category = 'GOLD';
            res.onum = 438;
            res.quan = 1;
            res.cleanName = 'gold piece';
            return res;
        }

        // 2. 数量プレフィックス・冠詞のトリム（辞書引き用クリーンアップ）
        const quanMatch = working.match(/^(\d+)(?:個|本|枚|つ|杯|巻|着|缶|服|袋)?の?\s+(.+)$/);
        if (quanMatch) {
            res.quan = parseInt(quanMatch[1], 10);
            working = quanMatch[2].trim();
        } else {
            const articleMatch = working.match(/^(?:an?|the)\s+(.+)$/i);
            if (articleMatch) {
                working = articleMatch[1].trim();
            }
        }

        // 3. 強化値プレフィックスの抽出 (+1, -2 等)
        const enchMatch = working.match(/^([+-]\d+)\s+(.+)$/);
        if (enchMatch) {
            res.spe = parseInt(enchMatch[1], 10);
            res.flags.known = true;
            working = enchMatch[2].trim();
        }

        res.cleanName = working;
        return res;
    }

    /**
     * カテゴリを大文字正規化する
     * @param {any} rawCategory 
     * @param {number|string} [oclass=0] 
     * @returns {import('../../index').ItemCategory}
     */
    static normalizeCategory(rawCategory, oclass = 0) {
        if (typeof rawCategory === 'string') {
            const upper = rawCategory.trim().toUpperCase();
            if (VALID_CATEGORIES.has(upper)) {
                return upper;
            }
            if (CATEGORY_ALIAS_MAP[upper]) {
                return CATEGORY_ALIAS_MAP[upper];
            }
        }

        if (oclass !== undefined && oclass !== null && oclass !== 0) {
            if (OCLASS_TO_CATEGORY_MAP[oclass]) {
                return OCLASS_TO_CATEGORY_MAP[oclass];
            }
            if (typeof oclass === 'string') {
                const upperOclass = oclass.trim().toUpperCase();
                if (VALID_CATEGORIES.has(upperOclass)) {
                    return upperOclass;
                }
                if (CATEGORY_ALIAS_MAP[upperOclass]) {
                    return CATEGORY_ALIAS_MAP[upperOclass];
                }
            }
        }

        return 'OTHER';
    }

    /**
     * インベントリレター ('a'〜'z', 'A'〜'Z', '$' 等) を正規化する
     * @param {any} rawItem 
     * @returns {string|null}
     */
    static normalizeLetter(rawItem) {
        if (!rawItem) return null;
        if (typeof rawItem === 'string') {
            const trimmed = rawItem.trim();
            return (trimmed.length === 1) ? trimmed : null;
        }

        const cand = rawItem.letter ?? rawItem.invlet ?? rawItem.directObject?.invlet ?? rawItem.charStr ?? rawItem.selector ?? null;
        if (typeof cand === 'string') {
            const trimmed = cand.trim();
            if (trimmed.length === 1) return trimmed;
        }
        if (typeof cand === 'number' && cand > 0 && cand < 128) {
            return String.fromCharCode(cand);
        }
        return null;
    }

    /**
     * BUC ステータスを正規化する
     * @param {any} rawBuc 
     * @param {Object} [flags] 
     * @returns {import('../../index').BucStatusType}
     */
    static normalizeBuc(rawBuc, flags) {
        if (flags && typeof flags === 'object' && flags.bknown) {
            if (flags.blessed) return 'BLESSED';
            if (flags.cursed) return 'CURSED';
            return 'UNCURSED';
        }

        if (typeof rawBuc === 'string') {
            const upper = rawBuc.trim().toUpperCase();
            if (['BLESSED', 'UNCURSED', 'CURSED'].includes(upper)) {
                return upper;
            }
        }

        return 'UNKNOWN';
    }

    /**
     * 仮名 (calledName) を安全かつアトミックに同期更新した CanonicalItem を返す
     * @param {import('../../index').CanonicalItem} canonicalItem 
     * @param {string|null} newCalledName 
     * @returns {import('../../index').CanonicalItem}
     */
    static withCalledName(canonicalItem, newCalledName) {
        const normalized = this.normalize(canonicalItem);
        const cleanCall = (typeof newCalledName === 'string' && newCalledName.trim().length > 0) ? newCalledName.trim() : null;

        normalized.calledName = cleanCall;
        normalized.identification.calledName = cleanCall;

        // 仮名付与に伴う識別レベルの再判定
        normalized.idLevel = this._resolveIdLevel(
            normalized,
            normalized.isUnidentified,
            cleanCall,
            normalized.bucStatus,
            normalized.spe
        );
        normalized.identification.idLevel = normalized.idLevel;

        return normalized;
    }

    /**
     * CanonicalItem の不変条件（契約）を検証する
     * @param {any} item 
     * @returns {boolean}
     */
    static assertCanonicalItem(item) {
        if (!item || typeof item !== 'object') return false;
        if (item._canonical !== true) return false;
        if (!VALID_CATEGORIES.has(item.category)) return false;
        if (typeof item.isUnidentified !== 'boolean') return false;
        if (typeof item.isDiscovered !== 'boolean') return false;
        if (item.isUnidentified !== !item.isDiscovered) return false;
        if (item.identification?.isUnidentified !== item.isUnidentified) return false;
        if (item.identification?.isDiscovered !== item.isDiscovered) return false;
        if (!['BLESSED', 'UNCURSED', 'CURSED', 'UNKNOWN'].includes(item.bucStatus)) return false;
        if (!['UNIDENTIFIED', 'BUC_KNOWN', 'NAMED', 'TYPE_IDENTIFIED', 'FULLY_IDENTIFIED'].includes(item.idLevel)) return false;
        if (typeof item.rawText !== 'string') return false;
        if (typeof item.displayName !== 'string') return false;
        if (typeof item.displayNameJa !== 'string') return false;
        if (item.letter !== null && typeof item.letter !== 'string') return false;
        if (typeof item.quan !== 'number' || isNaN(item.quan)) return false;
        if (item.identifier !== undefined && typeof item.identifier !== 'number') return false;
        return true;
    }

    /**
     * 指定された表示オプションに従って決定論的タイトル文字列を生成する
     * （正規表現による事後削りを一切行わず、最初から必要なパーツのみを直接結合する）
     * @param {Object} item - CanonicalItem または任意のアイテムオブジェクト
     * @param {Object} [options={}]
     * @param {'ja'|'en'} [options.language='ja']
     * @param {boolean} [options.sagesWisdomMode=false]
     * @param {boolean} [options.includeLetter=false] - 'a - ' をプレフィックスに含めるか
     * @param {boolean} [options.includeCalled=true] - [仮名: xxx] を含めるか
     * @param {boolean} [options.includeEnchantment=true] - 強化値やチャージ数を含めるか
     * @param {boolean} [options.includeCount=true] - 数量を含めるか
     * @param {boolean} [options.includeBuc=true] - BUCプレフィックスを含めるか
     * @param {boolean} [options.includeEquip=true] - 装備状態サフィックスを含めるか
     * @param {boolean} [options.includeBilingualSubname=false] - 日本語時に (dagger) などの英語真名を併記するか
     * @returns {string} 整形済みタイトル文字列
     */
    static formatTitle(item, options = {}) {
        if (!item) return '';
        const isWisdom = Boolean(options.sagesWisdomMode);
        const canonical = (item._canonical === true && !isWisdom) ? item : this.normalize(item, { sagesWisdomMode: isWisdom });
        const language = options.language === 'en' ? 'en' : 'ja';
        const isEn = language === 'en';

        const includeBuc = options.includeBuc !== false;
        const includeEquip = options.includeEquip !== false;
        const includeCount = options.includeCount !== false;
        const includeCalled = options.includeCalled !== false;
        const includeEnchantment = options.includeEnchantment !== false;
        const includeBilingualSubname = Boolean(options.includeBilingualSubname);

        const isDefault = includeBuc && includeEquip && includeCount && includeCalled && includeEnchantment && !includeBilingualSubname;

        let title = '';
        if (isDefault) {
            title = isEn ? (canonical.displayName || canonical.rawText || canonical.name || '') : (canonical.displayNameJa || canonical.nameJa || canonical.name || '');
        } else {
            // オプション指定あり: パーツ単位で直接組み立て
            const names = this._buildItemNames({
                ...canonical,
                rawItem: canonical,
                isWisdom,
                flags: {
                    ...(canonical.flags || {}),
                    known: Boolean(canonical.flags?.known || canonical.isDiscovered || isWisdom)
                },
                master: (canonical.onum >= 0 && OBJECT_KNOWLEDGE_MAP) ? OBJECT_KNOWLEDGE_MAP.get(canonical.onum) : null
            }, {
                includeBuc,
                includeEquip,
                includeCount,
                includeCalled,
                includeEnchantment,
                includeBilingualSubname
            });
            title = isEn ? names.displayName : names.displayNameJa;
        }

        if (options.includeLetter && canonical.letter) {
            title = `${canonical.letter} - ${title}`;
        }

        return title.trim();
    }

    // =========================================================================
    // NetHack 公式 src/objnam.c 準拠の決定論的名称生成エンジン
    // =========================================================================

    /**
     * objnam.c (xname_flags & doname_base) を忠実に再現し、全名称パーツを決定論的に生成する
     * @private
     */
    static _buildItemNames(ctx, options = {}) {
        const {
            includeBuc = true,
            includeEquip = true,
            includeCount = true,
            includeCalled = true,
            includeEnchantment = true,
            includeBilingualSubname = false
        } = options;

        const {
            onum,
            category,
            quan,
            spe,
            recharged,
            corpsenm,
            flags = {},
            calledName,
            namedInstance,
            isUnidentified,
            isDiscovered,
            isWisdom,
            isWielded,
            isOffhand,
            isQuivered,
            isWorn,
            equipSlot,
            master
        } = ctx;

        const dknown = flags.dknown !== false;
        const bknown = Boolean(flags.bknown);
        const known = Boolean(flags.known || isWisdom);
        const cknown = Boolean(flags.cknown);
        const lknown = Boolean(flags.lknown);
        const tknown = Boolean(flags.tknown);
        const rknown = Boolean(flags.rknown);

        // 0. 金貨 (GOLD: onum 438) の決定論的完全名称 (NetHack 5.0 objnam.c 準拠)
        if (category === 'GOLD' || onum === 438 || ctx.rawItem?.isGold) {
            const goldNameEn = quan === 1 ? '1 gold piece' : `${quan} gold pieces`;
            const goldNameJa = quan === 1 ? '1枚の金貨' : `${quan}枚の金貨`;
            return {
                name: 'gold piece',
                nameJa: '金貨',
                appearanceName: null,
                appearanceNameJa: null,
                trueName: 'gold piece',
                trueNameJa: '金貨',
                displayName: goldNameEn,
                displayNameJa: goldNameJa,
                rawText: goldNameEn
            };
        }

        // 1. 真名の確定 (actualn & actualnJa)
        let actualn = ctx.trueName || (isWisdom && ctx.rawItem?.wisdomTrueName) || ctx.rawItem?.trueName || master?.name || (!isUnidentified && ctx.rawItem?.name ? ctx.rawItem.name : null) || ctx.rawItem?.name || ctx.rawItem?.identification?.coreName || 'item';
        let actualnJa = ctx.trueNameJa || (isWisdom && ctx.rawItem?.wisdomTrueNameJa) || ctx.rawItem?.trueNameJa || master?.nameJa || master?.japaneseName || (!isUnidentified && ctx.rawItem?.nameJa ? ctx.rawItem.nameJa : null) || actualn;

        // 特殊アイテム真名解決
        if (category === 'FOOD' && (onum === 265 || actualn.includes('corpse')) && corpsenm >= 0) {
            const mon = MONSTER_KNOWLEDGE_MAP.get(corpsenm);
            const mName = mon?.name || 'monster';
            const mNameJa = mon?.nameJa || mName;
            actualn = `${mName} corpse`;
            actualnJa = `${mNameJa}の死体`;
        } else if (category === 'ROCK' && onum === 476 && corpsenm >= 0) {
            const mon = MONSTER_KNOWLEDGE_MAP.get(corpsenm);
            const mName = mon?.name || 'creature';
            const mNameJa = mon?.nameJa || mName;
            const hist = (spe !== null && (spe & 1)) ? 'historic ' : '';
            const histJa = (spe !== null && (spe & 1)) ? '歴史的な' : '';
            actualn = `${hist}statue of a ${mName}`;
            actualnJa = `${histJa}${mNameJa}の像`;
        } else if (category === 'TOOL' && onum === 277 && corpsenm >= 0) { // FIGURINE
            const mon = MONSTER_KNOWLEDGE_MAP.get(corpsenm);
            const mName = mon?.name || 'creature';
            const mNameJa = mon?.nameJa || mName;
            actualn = `figurine of a ${mName}`;
            actualnJa = `${mNameJa}のフィギュア`;
        } else if (category === 'FOOD' && onum === 296) { // TIN
            if (spe === 1) {
                actualn = 'tin of spinach';
                actualnJa = 'ほうれん草の缶詰';
            } else if (corpsenm >= 0) {
                const mon = MONSTER_KNOWLEDGE_MAP.get(corpsenm);
                const mName = mon?.name || 'meat';
                const mNameJa = mon?.nameJa || '肉';
                const home = (spe !== null && spe < 0) ? 'homemade ' : '';
                const homeJa = (spe !== null && spe < 0) ? '自家製の' : '';
                actualn = `${home}tin of ${mName} meat`;
                actualnJa = `${homeJa}${mNameJa}の缶詰`;
            } else if (corpsenm < 0 && known) {
                actualn = 'empty tin';
                actualnJa = '空の缶詰';
            }
        }

        // 2. 外見名 (appearanceName & appearanceNameJa) の決定
        let dn = ctx.appearanceName || ctx.rawItem?.appearanceName || ctx.rawItem?.appearance || ctx.rawItem?.descr || null;
        if (!dn && isUnidentified) {
            const rawTextCand = ctx.rawItem?.rawText || ctx.rawItem?.name || '';
            const detected = ItemIdentificationResolver.detectAppearance(ctx.rawItem?.name || '', rawTextCand);
            if (detected && detected.appearanceName) {
                dn = detected.appearanceName;
            } else if (ctx.rawItem?.name && !ctx.rawItem.name.includes(' of ')) {
                dn = ctx.rawItem.name;
            }
        }
        if (!dn) {
            dn = master?.descr || master?.appearance || null;
        }

        let cleanDescr = dn;
        if (cleanDescr) {
            cleanDescr = cleanDescr.replace(/\s+(potion|wand|ring|scroll|amulet|spellbook|book|gem)$/i, '').replace(/^scroll\s+labeled\s+/i, '').trim();
        }

        let dnJa = null;
        if (cleanDescr) {
            dnJa = ItemIdentificationResolver.formatAppearanceName(cleanDescr, category, 'ja');
        } else if (dn) {
            dnJa = ItemIdentificationResolver.formatAppearanceName(dn, category, 'ja');
        }

        let appearanceName = null;
        let appearanceNameJa = null;
        if (master?.canBeUnidentified !== false) {
            appearanceName = this._formatAppearancePhrase(cleanDescr || dn, category, 'en');
            appearanceNameJa = dnJa || this._formatAppearancePhrase(cleanDescr || dn, category, 'ja');
        }

        // 3. 基礎名 (xname: 強化値・数量・BUCを含まない本体名) の決定
        let baseNameEn = '';
        let baseNameJa = '';

        if (!dknown) {
            // 🕵️ Lv.0: 遠隔・盲目未視認
            baseNameEn = this._getBlindCategoryName(category, master?.material, 'en');
            baseNameJa = this._getBlindCategoryName(category, master?.material, 'ja');
        } else if (isUnidentified) {
            // 🕵️ Lv.1〜Lv.2: 未識別 (外見記述ベース)
            const appEn = appearanceName || this._getBlindCategoryName(category, master?.material, 'en');
            const appJa = appearanceNameJa || this._getBlindCategoryName(category, master?.material, 'ja');

            if (calledName && includeCalled) {
                baseNameEn = `${appEn} called ${calledName}`;
                baseNameJa = `${appJa} [仮名: ${calledName}]`;
            } else {
                baseNameEn = appEn;
                baseNameJa = appJa;
            }
        } else {
            // ✅ Lv.3: 識別済み (真名ベース)
            // 特殊アイテム: 水の薬 (POT_WATER) + bknown
            if (onum === 300 && bknown && (flags.blessed || flags.cursed)) {
                if (flags.blessed) {
                    baseNameEn = 'potion of holy water';
                    baseNameJa = '聖水';
                } else {
                    baseNameEn = 'potion of unholy water';
                    baseNameJa = '邪水';
                }
            } else {
                baseNameEn = this._formatIdentifiedTrueName(actualn, category, onum, 'en');
                baseNameJa = this._formatIdentifiedTrueName(actualnJa, category, onum, 'ja');
            }
        }

        // 個別銘 (named ...) の付与 (dknown 時のみ: NetHack src/objnam.c 準拠でクォートなし)
        if (namedInstance && dknown) {
            baseNameEn += ` named ${namedInstance}`;
            baseNameJa += ` [銘: ${namedInstance}]`;
        }

        // 4. doname_base のプレフィックス (修飾語群) の生成
        // (1) 容器 empty
        let emptyPrefixEn = '';
        let emptyPrefixJa = '';
        if (cknown || flags.empty) {
            const isBoxOrBag = (category === 'TOOL' && (master?.isContainer || master?.isBox || master?.isBag || [214, 215, 216, 217, 218, 220].includes(onum) || ['sack', 'box', 'chest'].some(n => actualn.includes(n)))) || onum === 476;
            const hasContents = Boolean(ctx.rawItem?.hasContents || ctx.rawItem?.cobjPtr);
            const isBagOfTricks = (onum === 220); // BAG_OF_TRICKS
            if (flags.empty || (isBagOfTricks ? (spe === 0 && !known) : (isBoxOrBag && !hasContents))) {
                emptyPrefixEn = 'empty ';
                emptyPrefixJa = '空の ';
            }
        }

        // (2) BUC プレフィックス
        // ※ 水の薬で holy/unholy water の場合は prefix に blessed/cursed を重ねない (objnam.c L1321)
        let bucPrefixEn = '';
        let bucPrefixJa = '';
        const isHolyOrUnholyWater = (onum === 300 && isDiscovered && bknown && (flags.blessed || flags.cursed));
        if (includeBuc && bknown && !isHolyOrUnholyWater && category !== 'GOLD') {
            if (flags.blessed) {
                bucPrefixEn = 'blessed ';
                bucPrefixJa = '祝福された ';
            } else if (flags.cursed) {
                bucPrefixEn = 'cursed ';
                bucPrefixJa = '呪われた ';
            } else {
                bucPrefixEn = 'uncursed ';
                bucPrefixJa = '普通の ';
            }
        }

        // (3) 箱の罠・施錠状態
        let boxPrefixEn = '';
        let boxPrefixJa = '';
        const isBox = (master?.isBox || [214, 215, 216].includes(onum) || ['box', 'chest'].some(n => actualn.includes(n)));
        if (isBox && dknown) {
            if ((tknown || flags.otrapped) && flags.otrapped) {
                boxPrefixEn += 'trapped ';
                boxPrefixJa += '罠付きの ';
            }
            if (lknown || flags.olocked || flags.obroken) {
                if (flags.obroken) {
                    boxPrefixEn += 'broken ';
                    boxPrefixJa += '壊れた ';
                } else if (flags.olocked) {
                    boxPrefixEn += 'locked ';
                    boxPrefixJa += '施錠された ';
                } else if (lknown) {
                    boxPrefixEn += 'unlocked ';
                    boxPrefixJa += '解錠された ';
                }
            }
        }

        // (4) グリス・毒・腐食 (erosion_matters)
        let condPrefixEn = '';
        let condPrefixJa = '';
        if (flags.greased) {
            condPrefixEn += 'greased ';
            condPrefixJa += '油を塗られた ';
        }
        if (flags.poisoned && category === 'WEAPON') {
            condPrefixEn += 'poisoned ';
            condPrefixJa += '毒の塗られた ';
        }

        // 腐食
        const isWeptool = Boolean(master?.isWeptool || (category === 'TOOL' && master?.skill && master?.skill !== 'none'));
        const erosionMatters = (category === 'WEAPON' || category === 'ARMOR' || category === 'BALL' || category === 'CHAIN' || isWeptool);
        if (erosionMatters) {
            if (flags.oeroded) {
                const degree = flags.oeroded === 3 ? 'thoroughly ' : (flags.oeroded === 2 ? 'very ' : '');
                const degreeJa = flags.oeroded === 3 ? '完全に' : (flags.oeroded === 2 ? 'ひどく' : '');
                const isRustType = (master?.material === 'iron' || master?.material === 'metal' || category === 'WEAPON' || actualn.includes('iron') || !master?.material);
                const type = isRustType ? 'rusty ' : 'burnt ';
                const typeJa = isRustType ? '錆びた' : '焼けた';
                condPrefixEn += `${degree}${type}`;
                condPrefixJa += `${degreeJa}${typeJa} `;
            }
            if (flags.oeroded2) {
                const degree = flags.oeroded2 === 3 ? 'thoroughly ' : (flags.oeroded2 === 2 ? 'very ' : '');
                const degreeJa = flags.oeroded2 === 3 ? '完全に' : (flags.oeroded2 === 2 ? 'ひどく' : '');
                condPrefixEn += `${degree}corroded `;
                condPrefixJa += `${degreeJa}腐食した `;
            }
            if ((rknown || flags.oerodeproof) && flags.oerodeproof) {
                const mat = master?.material;
                let proof = 'corrodeproof ';
                let proofJa = '耐腐食の ';
                if (mat === 'cloth' || mat === 'leather' || mat === 'wood' || mat === 'paper' || actualn.includes('robe') || actualn.includes('cloak')) {
                    proof = 'fireproof ';
                    proofJa = '耐火の ';
                } else if (mat === 'iron' || mat === 'metal' || !mat) {
                    proof = 'rustproof ';
                    proofJa = '錆びない ';
                }
                condPrefixEn += proof;
                condPrefixJa += proofJa;
            }
        }

        // (5) 強化値 (spe): 厳格な表示条件判定
        // NetHack 公式: known かつ (WEAPON | ARMOR | is_weptool | (RING && oc_charged)) のみ！
        let enchPrefixEn = '';
        let enchPrefixJa = '';
        const CHARGED_RING_ONUMS = new Set([173, 174, 175, 176, 177, 178]);
        const isChargedRing = (category === 'RING' && (Boolean(master?.isCharged) || CHARGED_RING_ONUMS.has(onum) || ['adornment', 'gain strength', 'gain constitution', 'increase accuracy', 'increase damage', 'protection'].some(n => actualn.includes(n))));
        const canShowEnchantment = (known || isWisdom || (isDiscovered && ctx.rawItem?.flags?.known !== false && ctx.rawItem?.known !== false)) && typeof spe === 'number' &&
            (category === 'WEAPON' || category === 'ARMOR' || isWeptool || isChargedRing);

        if (includeEnchantment && canShowEnchantment) {
            const sign = spe >= 0 ? `+${spe}` : `${spe}`;
            enchPrefixEn = `${sign} `;
            enchPrefixJa = `${sign} `;
        }

        // 5. doname_base のサフィックス (チャージ数・装備状態等) の生成
        let chargeSuffixEn = '';
        let chargeSuffixJa = '';
        const isChargedTool = (category === 'TOOL' && Boolean(master?.isCharged));
        const canShowCharges = (known || isWisdom) && typeof spe === 'number' &&
            (category === 'WAND' || isChargedTool);

        if (includeEnchantment && canShowCharges) {
            chargeSuffixEn = ` (${recharged}:${spe})`;
            chargeSuffixJa = ` (${recharged}:${spe})`;
        } else if (onum === 254 && typeof spe === 'number') { // CANDELABRUM_OF_INVOCATION
            chargeSuffixEn = ` (${spe} of 7 candles attached)`;
            chargeSuffixJa = ` (7本中${spe}本のろうそく装着)`;
        } else if (flags.lamplit) {
            chargeSuffixEn = ' (lit)';
            chargeSuffixJa = ' (点灯)';
        }

        // 装備状態サフィックス
        let equipSuffixEn = '';
        let equipSuffixJa = '';
        if (includeEquip) {
            if (isWielded) {
                equipSuffixEn = ' (weapon in hand)';
                equipSuffixJa = ' (手)';
            } else if (isOffhand) {
                equipSuffixEn = ' (in off hand)';
                equipSuffixJa = ' (副)';
            } else if (isQuivered) {
                equipSuffixEn = ' (in quiver)';
                equipSuffixJa = ' (矢筒)';
            } else if (equipSlot === 'ring_left') {
                equipSuffixEn = ' (on left hand)';
                equipSuffixJa = ' (左手)';
            } else if (equipSlot === 'ring_right') {
                equipSuffixEn = ' (on right hand)';
                equipSuffixJa = ' (右手)';
            } else if (equipSlot === 'amulet') {
                equipSuffixEn = ' (around neck)';
                equipSuffixJa = ' (首)';
            } else if (isWorn) {
                equipSuffixEn = ' (being worn)';
                equipSuffixJa = ' (装備中)';
            }
        }

        // 数量プレフィックスと複数形
        let finalBaseNameEn = baseNameEn;
        if (quan > 1 && !isUnidentified) {
            finalBaseNameEn = pluralizeBaseNameEn(baseNameEn);
        }
        const showCount = includeCount && category !== 'GOLD';
        const countPrefixEn = (showCount && quan > 1) ? `${quan} ` : '';
        const countPrefixJa = (showCount && quan > 1) ? `${quan}個の` : '';

        // バイリンガル併記 (日本語時に (dagger) 等を装備サフィックス直前に付加)
        let bilingualSubnameJa = '';
        if (includeBilingualSubname && !isUnidentified) {
            const trueEn = (actualn || master?.name || '').trim();
            if (trueEn) {
                bilingualSubnameJa = ` (${trueEn})`;
            }
        }

        // 6. 表示名称の最終組み立て
        let displayName = '';
        let displayNameJa = '';

        if (isUnidentified && isWisdom) {
            // 🧙 賢者の知恵モード: 外見 [真名 (強化値/チャージ)] 併記
            const trueEnch = (includeEnchantment && canShowEnchantment) ? `${spe >= 0 ? `+${spe} ` : `${spe} `}` : '';
            const trueEnchJa = (includeEnchantment && canShowEnchantment) ? `${spe >= 0 ? `+${spe} ` : `${spe} `}` : '';
            const trueCharge = (includeEnchantment && canShowCharges) ? ` (${recharged}:${spe})` : '';
            const trueChargeJa = (includeEnchantment && canShowCharges) ? ` (${recharged}:${spe})` : '';

            const trueFullNameEn = `${trueEnch}${this._formatIdentifiedTrueName(actualn, category, onum, 'en')}${trueCharge}`;
            const trueFullNameJa = `${trueEnchJa}${this._formatIdentifiedTrueName(actualnJa, category, onum, 'ja')}${trueChargeJa}`;

            displayName = `${countPrefixEn}${emptyPrefixEn}${bucPrefixEn}${boxPrefixEn}${condPrefixEn}${finalBaseNameEn} [${trueFullNameEn}]${equipSuffixEn}`.trim();
            displayNameJa = `${countPrefixJa}${emptyPrefixJa}${bucPrefixJa}${boxPrefixJa}${condPrefixJa}${baseNameJa} [${trueFullNameJa}]${bilingualSubnameJa}${equipSuffixJa}`.trim();
        } else {
            displayName = `${countPrefixEn}${emptyPrefixEn}${bucPrefixEn}${boxPrefixEn}${condPrefixEn}${enchPrefixEn}${finalBaseNameEn}${chargeSuffixEn}${equipSuffixEn}`.trim();
            displayNameJa = `${countPrefixJa}${emptyPrefixJa}${bucPrefixJa}${boxPrefixJa}${condPrefixJa}${enchPrefixJa}${baseNameJa}${chargeSuffixJa}${bilingualSubnameJa}${equipSuffixJa}`.trim();
        }

        // 7. rawText は 100% 英語 ASCII 表記
        let rawText = displayName;
        if (ctx.rawItem?.rawText && ctx.rawItem.rawText.includes('zorkmids') && !rawText.includes('zorkmids')) {
            const zorkMatch = ctx.rawItem.rawText.match(/\([^\)]*zorkmids[^\)]*\)/i);
            if (zorkMatch) {
                rawText += ` ${zorkMatch[0]}`;
            }
        }

        return {
            name: baseNameEn,
            nameJa: baseNameJa,
            appearanceName,
            appearanceNameJa,
            trueName: actualn || null,
            trueNameJa: actualnJa || null,
            displayName,
            displayNameJa,
            rawText
        };
    }

    /**
     * カテゴリ・外見記述から英語・日本語の外見成形文字列を生成する
     * @private
     */
    static _formatAppearancePhrase(descr, category, lang = 'en') {
        if (!descr) return null;
        const isEn = lang === 'en';
        const cat = String(category || '').toUpperCase();
        const lowerDescr = descr.toLowerCase();

        if (isEn) {
            switch (cat) {
                case 'POTION': return lowerDescr.includes('potion') ? descr : `${descr} potion`;
                case 'SCROLL': return (lowerDescr.includes('scroll') || lowerDescr.startsWith('labeled ')) ? descr : `scroll labeled ${descr}`;
                case 'WAND': return lowerDescr.includes('wand') ? descr : `${descr} wand`;
                case 'RING': return lowerDescr.includes('ring') ? descr : `${descr} ring`;
                case 'AMULET': return lowerDescr.includes('amulet') ? descr : `${descr} amulet`;
                case 'SPELLBOOK': return (lowerDescr.includes('spellbook') || lowerDescr.includes('book')) ? descr : `${descr} spellbook`;
                case 'GEM': return (lowerDescr.includes('gem') || lowerDescr.includes('stone')) ? descr : `${descr} gem`;
                default: return descr;
            }
        } else {
            switch (cat) {
                case 'POTION': return descr.includes('薬') ? descr : `${descr}の薬`;
                case 'SCROLL': return descr.includes('巻物') ? descr : `${descr}の巻物`;
                case 'WAND': return descr.includes('杖') ? descr : `${descr}の杖`;
                case 'RING': return descr.includes('指輪') ? descr : `${descr}の指輪`;
                case 'AMULET': return descr.includes('魔よけ') ? descr : `${descr}の魔よけ`;
                case 'SPELLBOOK': return descr.includes('魔法書') ? descr : `${descr}の魔法書`;
                case 'GEM': return descr.includes('石') ? descr : `${descr}の石`;
                default: return descr;
            }
        }
    }

    /**
     * 盲目・未視認時のカテゴリ総称名を取得
     * @private
     */
    static _getBlindCategoryName(category, material = 'iron', lang = 'en') {
        const isEn = lang === 'en';
        const cat = String(category || '').toUpperCase();
        switch (cat) {
            case 'AMULET': return isEn ? 'amulet' : '魔よけ';
            case 'POTION': return isEn ? 'potion' : '薬';
            case 'SCROLL': return isEn ? 'scroll' : '巻物';
            case 'WAND': return isEn ? 'wand' : '杖';
            case 'RING': return isEn ? 'ring' : '指輪';
            case 'SPELLBOOK': return isEn ? 'spellbook' : '魔法書';
            case 'GEM': return (material === 'mineral') ? (isEn ? 'stone' : '石') : (isEn ? 'gem' : '宝石');
            case 'ARMOR': return isEn ? 'armor' : '防具';
            case 'WEAPON': return isEn ? 'weapon' : '武器';
            case 'TOOL': return isEn ? 'tool' : '道具';
            case 'FOOD': return isEn ? 'food' : '食料';
            case 'ROCK': return isEn ? 'rock' : '岩';
            default: return isEn ? 'item' : 'アイテム';
        }
    }

    /**
     * 識別済み真名を表示用フォーマットに整形
     * @private
     */
    static _formatIdentifiedTrueName(actualn, category, onum, lang = 'en') {
        const isEn = lang === 'en';
        const cat = String(category || '').toUpperCase();
        const lower = actualn.toLowerCase();

        if (isEn) {
            if (lower.startsWith('potion of ') || lower.startsWith('scroll of ') ||
                lower.startsWith('wand of ') || lower.startsWith('ring of ') ||
                lower.startsWith('spellbook of ') || lower.startsWith('amulet of ') ||
                lower.startsWith('amulet versus ')) {
                return actualn;
            }

            switch (cat) {
                case 'POTION':
                    if (['water', 'acid', 'oil', 'booze', 'fruit juice'].includes(lower)) return `potion of ${actualn}`;
                    return `potion of ${actualn}`;
                case 'SCROLL':
                    if (lower === 'mail') return 'mail';
                    if (lower === 'blank paper') return 'scroll of blank paper';
                    return `scroll of ${actualn}`;
                case 'WAND':
                    return `wand of ${actualn}`;
                case 'RING':
                    if (lower === 'meat ring') return 'meat ring';
                    return `ring of ${actualn}`;
                case 'SPELLBOOK':
                    if (lower === 'book of the dead') return 'Book of the Dead';
                    if (lower === 'novel') return 'novel';
                    if (lower === 'blank paper') return 'spellbook of blank paper';
                    return `spellbook of ${actualn}`;
                case 'AMULET':
                    if (lower.includes('yendor') || lower.includes('amulet')) return actualn;
                    return `amulet of ${actualn}`;
                default:
                    return actualn;
            }
        } else {
            // 日本語
            if (actualn.endsWith('の薬') || actualn.endsWith('の巻物') ||
                actualn.endsWith('の杖') || actualn.endsWith('の指輪') ||
                actualn.endsWith('の魔法書') || actualn.endsWith('の魔よけ')) {
                return actualn;
            }

            switch (cat) {
                case 'POTION':
                    if (['水', '酸', '油', '酒', '果汁'].includes(actualn)) return actualn;
                    if (actualn.endsWith('のポーション')) return actualn.replace(/のポーション$/, 'の薬');
                    if (actualn.endsWith('ポーション')) return actualn;
                    return `${actualn}の薬`;
                case 'SCROLL':
                    if (actualn === '手紙') return '手紙';
                    if (actualn === '白紙') return '白紙の巻物';
                    return `${actualn}の巻物`;
                case 'WAND':
                    return `${actualn}の杖`;
                case 'RING':
                    if (actualn === '肉の指輪') return '肉の指輪';
                    return `${actualn}の指輪`;
                case 'SPELLBOOK':
                    if (['死者の書', '小説'].includes(actualn)) return actualn;
                    if (actualn === '白紙') return '白紙の魔法書';
                    return `${actualn}の魔法書`;
                case 'AMULET':
                    if (actualn.includes('魔よけ') || actualn.includes('護符')) return actualn;
                    return `${actualn}の魔よけ`;
                default:
                    return actualn;
            }
        }
    }

    // =========================================================================
    // 内部ヘルパー
    // =========================================================================

    static _createDefaultItem(source) {
        return {
            _canonical: true,
            source,
            letter: null,
            onum: -1,
            glyphId: -1,
            rawObjPtr: 0,
            o_id: 0,
            corpsenm: -1,
            category: 'OTHER',
            oclass: 0,
            isUnidentified: false,
            isDiscovered: true,
            idLevel: 'TYPE_IDENTIFIED',
            bucStatus: 'UNKNOWN',
            calledName: null,
            namedInstance: null,
            rawText: '',
            name: '',
            nameJa: '',
            appearanceName: null,
            appearanceNameJa: null,
            trueName: null,
            trueNameJa: null,
            displayName: '',
            displayNameJa: '',
            quan: 1,
            count: 1,
            spe: null,
            recharged: 0,
            weight: 0,
            equipSlot: null,
            isEquipped: false,
            isWielded: false,
            isOffhand: false,
            isQuivered: false,
            isWorn: false,
            isGold: false,
            defaultVerb: null,
            defaultSequence: [],
            defaultActionLabel: null,
            defaultActionLabelJa: null,
            alternativeActions: [],
            identification: {
                isUnidentified: false,
                isDiscovered: true,
                idLevel: 'TYPE_IDENTIFIED',
                bucStatus: 'UNKNOWN',
                calledName: null,
                namedInstance: null,
                category: 'OTHER',
                letter: null
            },
            knowledge: null,
            skillBadge: null
        };
    }

    static _resolveOnum(rawItem, parsedFromText = null) {
        if (typeof rawItem.onum === 'number' && !isNaN(rawItem.onum) && rawItem.onum >= 0) return rawItem.onum;
        if (typeof rawItem.otyp === 'number' && !isNaN(rawItem.otyp) && rawItem.otyp >= 0) return rawItem.otyp;
        if (rawItem.identification && typeof rawItem.identification.onum === 'number' && rawItem.identification.onum >= 0) return rawItem.identification.onum;
        if (rawItem.knowledge && typeof rawItem.knowledge.onum === 'number' && rawItem.knowledge.onum >= 0) return rawItem.knowledge.onum;

        // グリフ番号からの Cコア SSOT 直接解決
        const glyphId = (typeof rawItem.glyphId === 'number') ? rawItem.glyphId : (typeof rawItem.glyph === 'number' ? rawItem.glyph : -1);
        if (glyphId >= 3448 && glyphId <= 3928) {
            return glyphId - 3448;
        } else if (glyphId >= 7992 && glyphId <= 8472) {
            return glyphId - 7992;
        }

        if (parsedFromText && typeof parsedFromText.onum === 'number' && parsedFromText.onum >= 0) return parsedFromText.onum;

        const candidates = [
            rawItem.trueName,
            rawItem.name,
            rawItem.identification?.coreName,
            rawItem.identification?.name,
            rawItem.rawText,
            rawItem.rawStr,
            rawItem.str,
            rawItem.text,
            parsedFromText?.cleanName
        ];

        for (const cand of candidates) {
            if (cand && typeof cand === 'string') {
                const found = getOnumByName(cand);
                if (found >= 0) return found;
            }
        }
        return -1;
    }

    static _resolveOclass(rawItem, parsedFromText = null) {
        if (rawItem.oclass !== undefined && rawItem.oclass !== null) return rawItem.oclass;
        if (rawItem.directObject?.oclass !== undefined) return rawItem.directObject.oclass;
        if (parsedFromText && parsedFromText.category === 'GOLD') return 1;
        return 0;
    }

    static _resolveSpe(rawItem, parsedFromText = null) {
        if (rawItem.spe !== undefined && rawItem.spe !== null && !isNaN(rawItem.spe)) return Number(rawItem.spe);
        if (rawItem.identification?.enchantment !== undefined && rawItem.identification.enchantment !== null) {
            return Number(rawItem.identification.enchantment);
        }
        if (rawItem.identification?.charges !== undefined && rawItem.identification.charges !== null) {
            return Number(rawItem.identification.charges);
        }
        if (parsedFromText && parsedFromText.spe !== null && parsedFromText.spe !== undefined) {
            return Number(parsedFromText.spe);
        }
        return null;
    }

    static _normalizeFlags(rawItem, parsedFromText = null) {
        const rawFlags = rawItem.flags || rawItem.directObject?.flags || {};
        const dknownVal = (rawFlags.dknown !== undefined) ? rawFlags.dknown : rawItem.dknown;
        let dknown = true;
        if (dknownVal !== undefined && dknownVal !== null) {
            dknown = (dknownVal === true || dknownVal === 1);
        }

        const rawBuc = String(rawItem.bucStatus || rawItem.identification?.bucStatus || '').toUpperCase();
        const known = (rawFlags.known === true || rawFlags.known === 1 || rawItem.known === true || rawItem.known === 1 || Boolean(parsedFromText?.flags?.known));
        const bknown = (rawFlags.bknown === true || rawFlags.bknown === 1 || rawItem.bknown === true || rawBuc === 'BLESSED' || rawBuc === 'CURSED' || rawBuc === 'UNCURSED');
        const blessed = (rawFlags.blessed === true || rawFlags.blessed === 1 || rawItem.blessed === true || rawBuc === 'BLESSED');
        const cursed = (rawFlags.cursed === true || rawFlags.cursed === 1 || rawItem.cursed === true || rawBuc === 'CURSED');
        const oeroded = Number(rawFlags.oeroded || rawItem.oeroded || 0);
        const oeroded2 = Number(rawFlags.oeroded2 || rawItem.oeroded2 || 0);
        const oerodeproof = Boolean(rawFlags.oerodeproof || rawItem.oerodeproof);
        const olocked = Boolean(rawFlags.olocked || rawItem.olocked);
        const obroken = Boolean(rawFlags.obroken || rawItem.obroken);
        const otrapped = Boolean(rawFlags.otrapped || rawItem.otrapped);
        const greased = Boolean(rawFlags.greased || rawItem.greased);
        const diluted = Boolean(rawFlags.diluted || rawFlags.odiluted || rawItem.diluted);
        const lamplit = Boolean(rawFlags.lamplit || rawItem.lamplit);
        const empty = Boolean(rawFlags.empty || rawItem.empty);

        return {
            known,
            dknown,
            bknown,
            cknown: (rawFlags.cknown === true || rawFlags.cknown === 1),
            lknown: (rawFlags.lknown === true || rawFlags.lknown === 1 || olocked || obroken),
            tknown: (rawFlags.tknown === true || rawFlags.tknown === 1 || otrapped),
            rknown: (rawFlags.rknown === true || rawFlags.rknown === 1 || oerodeproof),
            blessed,
            cursed,
            oeroded,
            oeroded2,
            oerodeproof,
            olocked,
            obroken,
            otrapped,
            greased,
            diluted,
            lamplit,
            empty,
            unpaid: Boolean(rawFlags.unpaid || rawItem.unpaid)
        };
    }

    static _resolveIsUnidentified(rawItem, onum = -1, category = 'OTHER', cleanText = '', flags = {}, options = {}, parsedFromText = null) {
        // 1. 明示的なフラグがあれば最優先
        if (typeof rawItem.isUnidentified === 'boolean') return rawItem.isUnidentified;
        if (rawItem.identification && typeof rawItem.identification.isUnidentified === 'boolean') {
            return rawItem.identification.isUnidentified;
        }
        if (typeof rawItem.isDiscovered === 'boolean') return !rawItem.isDiscovered;
        if (rawItem.identification && typeof rawItem.identification.isDiscovered === 'boolean') {
            return !rawItem.identification.isDiscovered;
        }

        // 2. Cコア flags のチェック (dknown === false は遠隔未視認のため確実に未識別)
        if (flags.dknown === false) {
            return true;
        }

        // 3. DiscoveryStateManager が渡されているか確認
        const dsm = options.discoveryStateManager || rawItem.discoveryStateManager;
        if (dsm && typeof dsm.isIdentified === 'function' && onum >= 0) {
            return !dsm.isIdentified(onum);
        }

        // 4. OBJECT_KNOWLEDGE_MAP による master チェック
        const master = (onum >= 0 && OBJECT_KNOWLEDGE_MAP) ? OBJECT_KNOWLEDGE_MAP.get(onum) : null;
        if (master) {
            if (master.canBeUnidentified === false) {
                return false;
            }

            const isRandomCategory = ['POTION', 'SCROLL', 'WAND', 'RING', 'AMULET', 'SPELLBOOK'].includes(master.category || category);
            if (isRandomCategory) {
                const trueLower = (master.name || '').toLowerCase();
                const textLower = cleanText.toLowerCase();
                const singularTextLower = singularizeItemCandidate(cleanText).toLowerCase();
                const hasTrueName = trueLower && (
                    textLower.includes(trueLower) ||
                    singularTextLower.includes(trueLower) ||
                    (master.nameJa && (textLower.includes(master.nameJa.toLowerCase()) || singularTextLower.includes(master.nameJa.toLowerCase())))
                );
                if (hasTrueName) {
                    return false;
                }
                return true;
            } else {
                const appearanceMatch = ItemIdentificationResolver.detectAppearance(cleanText, cleanText);
                if (appearanceMatch && appearanceMatch.isAppearance) {
                    return true;
                }
                return false;
            }
        }

        const appearanceMatch = ItemIdentificationResolver.detectAppearance(cleanText, cleanText);
        if (appearanceMatch && appearanceMatch.isAppearance) {
            return true;
        }

        return false;
    }

    static _resolveIdLevel(rawItem, isUnidentified, calledName, bucStatus, spe) {
        if (isUnidentified) {
            if (calledName) return 'NAMED';
            if (bucStatus && bucStatus !== 'UNKNOWN') return 'BUC_KNOWN';
            return 'UNIDENTIFIED';
        }

        const rawLevel = rawItem.idLevel || rawItem.identification?.idLevel;
        if (rawLevel && ['TYPE_IDENTIFIED', 'FULLY_IDENTIFIED'].includes(rawLevel)) {
            return rawLevel;
        }

        if (spe !== null) return 'FULLY_IDENTIFIED';
        return 'TYPE_IDENTIFIED';
    }
}
