/**
 * StructuredKnowledgeEngine.js
 * NetHack 構造化ナレッジ＆ヘルプ基盤エンジン
 *
 * 【設計指針】
 * - マスターデータは「言語非依存 (英語原名 / Standard Key & English Text)」で保持。
 * - UIやコンポーネントがデータを取得する際、WebUICore の TranslationEngine を介して
 *   オンデマンドで動的に翻訳処理を行って返却する。
 */

import { classifyGlyph, getCmapInfo, getOnumFromGlyph, getCategoryFromOnum, ENTITY_TYPES, GLYPH_OFFSETS } from './glyphClassifier.js';
import { MONSTER_TILEMAP_NAMES, OBJECT_TILEMAP_NAMES } from "../data/tilemappings_data.js";
import { OBJECT_KNOWLEDGE_MAP } from "../data/OBJECT_KNOWLEDGE_FULL.js";
import { ALL_MONSTER_KNOWLEDGE_BASE } from "../data/MONSTER_KNOWLEDGE_FULL.js";
import { ItemIdentificationResolver, IDENTIFICATION_LEVELS } from './ItemIdentificationResolver.js';
import { OBJECT_CATEGORY_ADVICE, inferObjectCategory, OBJECT_CATEGORY_DEFINITIONS } from "../data/OBJECT_CATEGORY_ADVICE.js";
import { ITEM_KNOWLEDGE_BASE } from "../data/ITEM_KNOWLEDGE_BASE.js";
import { TERRAIN_KNOWLEDGE_MAP, getTerrainEntryByCmap, getTerrainEntryByKey } from "../data/TERRAIN_KNOWLEDGE_BASE.js";
import { getAdaptiveMonsterSpecs, getMonsterSpecSummaryStrings } from "../presenters/MonsterSpecPresenter.js";
import { getAdaptiveItemSpecs } from "../presenters/ItemSpecPresenter.js";
import { MONSTER_CLASS_DEFINITIONS, getMonsterClassDefinition, getAllMonsterClassDefinitions } from "../data/MONSTER_CLASS_KNOWLEDGE.js";
import { MonsterArmorRiskResolver } from './MonsterArmorRiskResolver.js';
import { ARTIFACT_KNOWLEDGE_BASE, getArtifactDefinition, getAllArtifactDefinitions } from "../data/ARTIFACT_KNOWLEDGE_BASE.js";

export { 
    OBJECT_CATEGORY_ADVICE, 
    inferObjectCategory, 
    OBJECT_CATEGORY_DEFINITIONS,
    ITEM_KNOWLEDGE_BASE, 
    TERRAIN_KNOWLEDGE_MAP,
    MONSTER_CLASS_DEFINITIONS,
    getMonsterClassDefinition,
    getAllMonsterClassDefinitions,
    MonsterArmorRiskResolver,
    ARTIFACT_KNOWLEDGE_BASE,
    getArtifactDefinition,
    getAllArtifactDefinitions
};

// ============================================================================
// 全 384 モンスター構造化マスターデータ (MONSTER_KNOWLEDGE_FULL.js よりインポート)
// ============================================================================
export const MONSTER_KNOWLEDGE_BASE = ALL_MONSTER_KNOWLEDGE_BASE;



export class StructuredKnowledgeEngine {
    /**
     * @param {Object} options 
     * @param {Object} [options.translationEngine] - WebUICore.TranslationEngine インスタンス
     * @param {'ja'|'en'} [options.language='ja'] - 表示言語
     */
    constructor(options = {}) {
        this.translationEngine = options.translationEngine || null;
        this.language = options.language || (this.translationEngine && this.translationEngine.language) || 'ja';

        this.monsters = new Map();
        this.items = new Map();
        this.monOffsetMap = new Map();
        this.onumMap = new Map();
        this.discoveryStateManager = options.discoveryStateManager || null;
        this.sagesWisdomMode = Boolean(options.sagesWisdomMode);
        this.staticCache = new Map();

        // マスターデータの初期化インデックス構築
        this._initDatabase();
    }

    /**
     * キャッシュのクリア（言語切替時や明示的パージ時）
     */
    clearCache() {
        if (this.staticCache) {
            this.staticCache.clear();
        }
    }

    /**
     * 表示言語の設定
     * @param {'ja'|'en'} lang
     */
    setLanguage(lang = 'ja') {
        const isJa = (lang === 'ja' || lang === 'jp' || lang === true);
        const newLang = isJa ? 'ja' : 'en';
        if (this.language !== newLang) {
            this.language = newLang;
            this.clearCache();
        }
    }

    /**
     * 🧙 賢者の知恵モードの設定
     * @param {boolean} val 
     */
    setSagesWisdomMode(val) {
        this.sagesWisdomMode = Boolean(val);
        this.clearCache();
    }

    /**
     * DiscoveryStateManager インスタンスの設定/更新
     * @param {Object} discoveryStateManager 
     */
    setDiscoveryStateManager(discoveryStateManager) {
        this.discoveryStateManager = discoveryStateManager;
    }

    /**
     * TranslationEngine インスタンスの設定/更新
     * @param {Object} translationEngine 
     */
    setTranslationEngine(translationEngine) {
        this.translationEngine = translationEngine;
        if (translationEngine && translationEngine.language) {
            this.language = translationEngine.language;
        }
        this.clearCache();
    }

    /**
     * マスターデータのインデックス構築
     * @private
     */
    _initDatabase() {
        // 0. MONSTER_TILEMAP_NAMES (全 384 モンスター: monOffset 0〜382) をあらかじめ 100% monOffsetMap にデフォルトインデックス登録！
        if (MONSTER_TILEMAP_NAMES) {
            for (const [mnumStr, fullName] of Object.entries(MONSTER_TILEMAP_NAMES)) {
                const mnum = parseInt(mnumStr, 10);
                if (!isNaN(mnum)) {
                    const monName = fullName ? fullName.split('/')[0].trim() : `Monster ${mnum}`;
                    this.monOffsetMap.set(mnum, {
                        id: `mon_${mnum}`,
                        monOffset: mnum,
                        name: monName,
                        dangerLevel: 'MEDIUM',
                        stats: { hd: 1, ac: 10, speed: 12, mr: 0 },
                        effectSummary: 'Standard dungeon monster.'
                    });
                }
            }
        }

        // 1. MONSTER_KNOWLEDGE_BASE (詳細設定辞書) で詳細データを上書きインデックス登録
        for (const mon of MONSTER_KNOWLEDGE_BASE) {
            this.monsters.set(mon.id, mon);
            this.monsters.set(mon.name.toLowerCase(), mon);

            // 単体設定値がある場合
            if (typeof mon.monOffset === 'number') {
                this.monOffsetMap.set(mon.monOffset, mon);
            }

            // MONSTER_TILEMAP_NAMES (Single Source of Truth) から mnum (monOffset) を全自動逆引きバインド！
            for (const [mnumStr, name] of Object.entries(MONSTER_TILEMAP_NAMES)) {
                if (name.toLowerCase() === mon.name.toLowerCase()) {
                    const mnum = parseInt(mnumStr, 10);
                    this.monOffsetMap.set(mnum, mon);
                }
            }
        }

        // 1. OBJECT_KNOWLEDGE_MAP (全 481 アイテムの完全マスター) を 100% 登録
        if (OBJECT_KNOWLEDGE_MAP && OBJECT_KNOWLEDGE_MAP.size > 0) {
            for (const [onum, entry] of OBJECT_KNOWLEDGE_MAP.entries()) {
                this.onumMap.set(onum, entry);
                this.items.set(entry.id, entry);
                if (entry.name) {
                    const nameLower = entry.name.toLowerCase();
                    this.items.set(nameLower, entry);
                    this.items.set(nameLower.replace(/\s+/g, '_'), entry);
                }
                if (entry.baseName && entry.baseName.toLowerCase() !== entry.name.toLowerCase()) {
                    const baseLower = entry.baseName.toLowerCase();
                    if (!this.items.has(baseLower)) {
                        this.items.set(baseLower, entry);
                        this.items.set(baseLower.replace(/\s+/g, '_'), entry);
                    }
                }
            }
        }
    }

    /**
     * 構造化オブジェクト内の各種テキストプロパティを TranslationEngine で動的ローカライズ
     * @param {Object} obj 
     * @param {Object} [options={}]
     * @returns {Object} ローカライズ済みディープコピー
     */
    localizeKnowledge(obj, options = {}) {
        if (!obj || typeof obj !== 'object') return obj;

        const lang = options.language || this.language || (this.translationEngine && this.translationEngine.language) || 'ja';
        const isEn = (lang === 'en' || (this.translationEngine && this.translationEngine.enabled === false));

        const tr = (str) => {
            if (!str || typeof str !== 'string') return str;
            if (isEn) return str;
            if (!this.translationEngine || typeof this.translationEngine.translate !== 'function') return str;
            return this.translationEngine.translate(str);
        };

        let cloned;
        try {
            const savedFloorObjects = obj.floorObjects;
            const savedDirectObject = obj.directObject;
            const hadFloor = 'floorObjects' in obj;
            const hadDirect = 'directObject' in obj;
            if (hadFloor) delete obj.floorObjects;
            if (hadDirect) delete obj.directObject;

            cloned = JSON.parse(JSON.stringify(obj));

            if (hadFloor) {
                obj.floorObjects = savedFloorObjects;
                cloned.floorObjects = savedFloorObjects;
            }
            if (hadDirect) {
                obj.directObject = savedDirectObject;
                cloned.directObject = savedDirectObject;
            }
        } catch (e) {
            cloned = { ...obj };
        }
        const originalName = obj.name || '';
        cloned.nameEn = obj.nameEn || originalName;
        // translationEngine がある場合は動的翻訳を優先し、フォールバックとして obj.nameJa を採用
        const translatedName = !isEn ? tr(originalName) : null;
        cloned.nameJa = (translatedName && translatedName !== originalName) ? translatedName : (obj.nameJa || translatedName);

        // 1. 名前の設定
        if (isEn) {
            cloned.name = cloned.nameEn;
        } else {
            cloned.name = cloned.nameJa || originalName;
        }

        // 2. モンスター死体・警告の動的解決 (フラグから動的補完)
        if (cloned.corpseInfo) {
            if (!cloned.corpseInfo.warningNote) {
                if (cloned.corpseInfo.causesPetrification) {
                    cloned.corpseInfo.warningNote = isEn ? 'Touch petrifies (Wear gloves)' : '接触石化 (手袋必須)';
                } else if (cloned.corpseInfo.causesSlime) {
                    cloned.corpseInfo.warningNote = isEn ? 'Slime hazard (Inedible)' : 'スライム化 (摂取不可)';
                }
            } else if (!isEn) {
                cloned.corpseInfo.warningNote = tr(cloned.corpseInfo.warningNote);
            }
            if (cloned.corpseInfo.grantResist) {
                cloned.corpseInfo.grantResist = tr(cloned.corpseInfo.grantResist);
            }
        }

        // 3. モンスター特徴・スペックのフラグ動的合成 (手書き tacticalAdvice を動的生成に置換)
        if (obj.type === 'MONSTER' || obj.dangerLevel !== undefined || obj.traits !== undefined) {
            cloned.specs = getAdaptiveMonsterSpecs(obj, { language: isEn ? 'en' : 'ja' });
            cloned.tacticalAdvice = getMonsterSpecSummaryStrings(obj, { language: isEn ? 'en' : 'ja' });

            // 3.5 モンスタークラス情報 & 変身防具破壊リスクのSSOT結合
            if (obj.symbol) {
                const classDef = getMonsterClassDefinition(obj.symbol);
                if (classDef) {
                    cloned.monsterClass = {
                        symbol: classDef.symbol,
                        name: isEn ? classDef.nameEn : classDef.nameJa,
                        nameEn: classDef.nameEn,
                        nameJa: classDef.nameJa,
                        danger: classDef.danger,
                        raceTrap: classDef.raceTrap || null,
                        desc: isEn ? (classDef.descEn || classDef.descJa) : (classDef.descJa || classDef.descEn)
                    };
                }
            }
            cloned.armorRisk = MonsterArmorRiskResolver.checkArmorRisk(obj);
        } else if (isEn && Array.isArray(obj.tacticalAdviceEn) && obj.tacticalAdviceEn.length > 0) {
            cloned.tacticalAdvice = obj.tacticalAdviceEn;
        } else if (Array.isArray(cloned.tacticalAdvice)) {
            cloned.tacticalAdvice = cloned.tacticalAdvice.map(adv => tr(adv));
        }

        // 4. アイテム・地形基本効果およびアクションラベルの翻訳
        if (isEn) {
            cloned.effectSummary = obj.effectSummaryEn || obj.effectSummary;
            cloned.actionLabel = obj.actionLabelEn || obj.actionLabel;
        } else {
            cloned.effectSummary = obj.effectSummaryJa || tr(cloned.effectSummary);
            cloned.actionLabel = obj.actionLabelJa || tr(cloned.actionLabel);
        }

        // 5. BUC効果の翻訳
        if (isEn && obj.bucEffectsEn) {
            cloned.bucEffects = obj.bucEffectsEn;
        } else if (cloned.bucEffects) {
            for (const key of Object.keys(cloned.bucEffects)) {
                cloned.bucEffects[key] = tr(cloned.bucEffects[key]);
            }
        }

        // 6. 未識別ヒント & 用途アドバイスの翻訳
        if (isEn && Array.isArray(obj.unidentifiedTipsEn) && obj.unidentifiedTipsEn.length > 0) {
            cloned.unidentifiedTips = obj.unidentifiedTipsEn;
        } else if (Array.isArray(cloned.unidentifiedTips)) {
            cloned.unidentifiedTips = cloned.unidentifiedTips.map(tip => tr(tip));
        }

        if (isEn && Array.isArray(obj.usageAdviceEn) && obj.usageAdviceEn.length > 0) {
            cloned.usageAdvice = obj.usageAdviceEn;
        } else if (Array.isArray(cloned.usageAdvice)) {
            cloned.usageAdvice = cloned.usageAdvice.map(adv => tr(adv));
        }

        // 6.5. モンスター脅威メタデータ (threat & counters) の動的ローカライズ
        if (cloned.threat) {
            if (cloned.threat.description) {
                cloned.threat.descriptionJa = !isEn ? tr(cloned.threat.description) : null;
                if (!isEn && cloned.threat.descriptionJa) {
                    cloned.threat.description = cloned.threat.descriptionJa;
                }
            }
            if (Array.isArray(cloned.threat.counters)) {
                cloned.threat.counters = cloned.threat.counters.map(counter => {
                    const c = { ...counter };
                    if (!c.message) {
                        if (c.id === 'COUNTER_BLINDFOLD') {
                            c.message = isEn ? 'Wear blindfold or towel' : '目隠しやタオルを着用';
                        } else if (c.id === 'COUNTER_GLOVES') {
                            c.message = isEn ? 'Wear gloves before melee' : '手袋を着用して接触';
                        } else if (c.id === 'COUNTER_RANGED') {
                            c.message = isEn ? 'Attack with ranged weapons' : '遠隔武器で攻撃';
                        } else if (c.id === 'COUNTER_SILVER') {
                            c.message = isEn ? 'Use silver weapons' : '銀製武器を使用';
                        } else {
                            c.message = isEn ? `Counter: ${c.type}` : `対策: ${c.type}`;
                        }
                    } else {
                        c.messageJa = !isEn ? tr(c.message) : null;
                        if (!isEn && c.messageJa) c.message = c.messageJa;
                        if (c.why) {
                            c.whyJa = !isEn ? tr(c.why) : null;
                            if (!isEn && c.whyJa) c.why = c.whyJa;
                        }
                    }
                    return c;
                });
            }
        }

        // 7. 構造化ステータス (stats) および直下プロパティの素材・属性の自動ローカライズ (1回翻訳で重複解消)
        const rawMat = (cloned.stats && cloned.stats.material) || (cloned.material && cloned.material !== 'none' ? cloned.material : null);
        if (rawMat) {
            const trMat = tr(rawMat);
            if (cloned.stats && cloned.stats.material) {
                cloned.stats.material = trMat;
            }
            if (cloned.material && cloned.material !== 'none') {
                cloned.material = trMat;
            }
        }

        // 8. 推奨アクションラベルのローカライズ
        if (isEn) {
            cloned.actionLabel = obj.actionLabelEn || obj.actionLabel || obj.defaultActionLabel || '';
        } else {
            cloned.actionLabel = obj.actionLabelJa || (obj.actionLabel ? tr(obj.actionLabel) : (obj.defaultActionLabel ? tr(obj.defaultActionLabel) : ''));
        }

        // 9. 不要な重複プロパティの削除（スキーマ一本化）
        delete cloned.actionLabelJa;
        delete cloned.actionLabelEn;
        delete cloned.defaultActionLabel;
        delete cloned.defaultActionLabelJa;
        delete cloned.nameJa;
        delete cloned.unidentifiedTipsEn;
        delete cloned.usageAdviceEn;
        delete cloned.tacticalAdviceEn;
        delete cloned.effectSummaryJa;
        delete cloned.effectSummaryEn;
        delete cloned.bucEffectsEn;

        return cloned;
    }

    /**
     * モンスター構造化ナレッジの取得
     * @param {number|string} identifier - monOffset, glyphId, または Monster Name/ID
     * @param {Object} [options] 
     * @param {boolean} [options.translate=true] - 翻訳処理を行うか
     * @returns {Object|null} モンスターナレッジ
     */
    getMonsterKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        const shouldTranslate = options.translate !== false;
        const lang = options.language || this.language || 'ja';

        // 1. identifier が直接 monOffset や ID の場合、早期キャッシュチェック
        if (typeof identifier === 'number' && (options.isMonOffset || (identifier >= 0 && identifier < 383)) && !options.dynamicState && !options.isPet && !options.isPlayer) {
            const directKey = `${lang}_mon_${identifier}`;
            if (this.staticCache.has(directKey)) {
                return this.staticCache.get(directKey);
            }
        }

        let found = null;
        let monOffset = null;

        // A. 数値指定 (monOffset または glyphId)
        if (typeof identifier === 'number') {
            if (options.isMonOffset === true || (identifier >= 0 && identifier < 383)) {
                monOffset = identifier;
            } else {
                const info = classifyGlyph(identifier);
                if (info && (info.type === ENTITY_TYPES.MONSTER || info.type === ENTITY_TYPES.PET)) {
                    monOffset = typeof info.subType === 'number' ? info.subType : identifier;
                }
            }

            if (typeof monOffset === 'number' && monOffset >= 0) {
                found = this.monOffsetMap.get(monOffset) || null;
                if (!found && MONSTER_TILEMAP_NAMES[monOffset]) {
                    const monName = MONSTER_TILEMAP_NAMES[monOffset] || 'monster';
                    found = {
                        id: `mon_${monOffset}`,
                        monOffset,
                        name: monName,
                        dangerLevel: 'MEDIUM',
                        stats: { hd: 1, ac: 10, speed: 12, mr: 0 },
                        effectSummary: 'Standard dungeon monster.'
                    };
                }
            }
        }

        // A-2. オブジェクト指定 ({ monOffset, subType, glyph, name, id ... })
        if (!found && typeof identifier === 'object' && identifier !== null) {
            const targetOffset = (typeof identifier.subType === 'number') ? identifier.subType :
                                 (typeof identifier.monOffset === 'number') ? identifier.monOffset :
                                 (typeof identifier.glyph === 'number') ? classifyGlyph(identifier.glyph)?.subType :
                                 (typeof identifier.rawGlyph === 'number') ? classifyGlyph(identifier.rawGlyph)?.subType : null;
            if (typeof targetOffset === 'number' && targetOffset >= 0) {
                monOffset = targetOffset;
                found = this.monOffsetMap.get(monOffset) || null;
            }
            if (!found && (identifier.name || identifier.id || identifier.str)) {
                return this.getMonsterKnowledge(identifier.name || identifier.id || identifier.str, {
                    ...options,
                    isPet: options.isPet ?? (identifier.type === 'PET' || identifier.isPet),
                    glyph: identifier.glyph ?? identifier.rawGlyph
                });
            }
        }

        // B. 文字列指定 (id または Name)
        if (!found && typeof identifier === 'string') {
            let clean = identifier.trim().toLowerCase();
            // "human samurai called Hero" -> "samurai" や "a peaceful Lord Carnarvon" -> "lord carnarvon" のクリーニング
            clean = clean.replace(/\bcalled\s+[^\s\(\)]+/gi, '')
                         .replace(/\bnamed\s+[^\s\(\)]+/gi, '')
                         .replace(/\b(an?|the|human|elf|dwarf|gnome|orc|peaceful|tamed|friendly|hostile|pet)\b/gi, '')
                         .replace(/[\(\)]/g, '')
                         .trim();

            const cleanKey = clean.replace(/\s+/g, '_');
            found = this.monsters.get(cleanKey) || this.monsters.get(clean) || this.monsters.get(identifier.trim().toLowerCase()) || null;

            if (!found && MONSTER_TILEMAP_NAMES) {
                const entry = Object.entries(MONSTER_TILEMAP_NAMES).find(([mOffset, fullName]) => {
                    if (!fullName) return false;
                    const parts = fullName.toLowerCase().split('/').map(p => p.trim());
                    return parts.some(part => part === clean || (clean.length >= 3 && part.includes(clean)) || (clean.length >= 3 && clean.includes(part)));
                });
                if (entry) {
                    monOffset = parseInt(entry[0], 10);
                    found = this.monOffsetMap.get(monOffset) || {
                        id: `mon_${monOffset}`,
                        monOffset,
                        name: entry[1].split('/')[0].trim(),
                        dangerLevel: 'MEDIUM',
                        stats: { hd: 1, ac: 10, speed: 12, mr: 0 },
                        effectSummary: 'Standard dungeon monster.'
                    };
                }
            }
        }

        // 未知の個人名表記（店主等）の場合、options.isShopkeeper や glyph 判定から shopkeeper (monOffset 271) へフォールバック
        if (!found) {
            const isSk = options.isShopkeeper || (typeof options.glyph === 'number' && classifyGlyph(options.glyph)?.isShopkeeper);
            if (isSk) {
                found = this.monOffsetMap.get(271) || null;
            }
        }

        // 不可視モンスター (1532) や警告グリフ (7220〜7225) のフォールバック
        if (!found) {
            const isInv = (typeof identifier === 'number' && identifier === 1532) || options.isInvisible;
            const isWarn = (typeof identifier === 'number' && identifier >= 7220 && identifier <= 7225) || options.isWarning;
            const idStr = String(identifier || '').toLowerCase();
            if (isInv || isWarn || idStr.includes('invisible') || idStr.includes('不可視') || idStr.includes('-1')) {
                found = {
                    id: isInv ? 'invisible_monster' : 'unknown_threat',
                    monOffset: -1,
                    name: isInv ? 'Invisible Monster' : 'Unknown Threat',
                    nameJa: isInv ? '不可視モンスター' : '未知の気配',
                    dangerLevel: 'MEDIUM',
                    defaultPeaceful: false,
                    stats: { hd: '?', ac: '?', speed: '?' },
                    attacks: [],
                    traits: {},
                    resistances: [],
                    weaknesses: [],
                    corpse: null,
                    tacticalAdviceEn: ['Unidentified creature or invisible monster. Move with caution.'],
                    tacticalAdviceJa: ['不可視の敵または未確認の気配です。慎重に対処してください。']
                };
            }
        }

        if (!found) return null;

        // 🎯 1. 静的マスターナレッジ（名前・戦術Tips・基本効果等）をキャッシュから取得 (初回のみローカライズ)
        const normKey = found.id || (typeof found.monOffset === 'number' ? `mon_${found.monOffset}` : null);
        const cacheKey = (normKey && shouldTranslate) ? `${lang}_mon_${normKey}` : null;
        let staticMon = null;

        if (cacheKey && this.staticCache.has(cacheKey)) {
            staticMon = this.staticCache.get(cacheKey);
        } else {
            const rawBase = {
                type: 'MONSTER',
                category: 'MONSTER',
                canBeUnidentified: false,
                ...found,
                dangerLevel: found.defaultPeaceful ? 'SAFE' : (found.dangerLevel || 'MEDIUM'),
                dispositionStatus: found.defaultPeaceful ? 'DEFAULT_PEACEFUL' : 'HOSTILE'
            };
            staticMon = shouldTranslate ? this.localizeKnowledge(rawBase, options) : rawBase;
            if (cacheKey && staticMon) {
                this.staticCache.set(cacheKey, staticMon);
            }
        }

        const isPet = Boolean(
            options.isPet ||
            options.isTame ||
            options.dynamicState?.isTamed ||
            options.dynamicState?.isTame ||
            (typeof identifier === 'object' && (identifier?.type === 'PET' || identifier?.isPet || identifier?.isTame || identifier?.directState?.tame || identifier?.dynamicState?.isTamed)) ||
            (typeof identifier === 'number' && classifyGlyph(identifier)?.type === ENTITY_TYPES.PET)
        );
        const isPlayer = Boolean(options.isPlayer);
        const dynamicState = options.dynamicState || null;
        const isShopkeeper = (found.monOffset === 271 || found.id === 'shopkeeper' || found.name === 'shopkeeper');
        const rawShopText = isShopkeeper ? (options.dynamicState?.rawText || (typeof identifier === 'string' ? identifier : '')) : '';

        // 動的ステートが一切ない標準モンスターの場合は、キャッシュオブジェクトそのものを即座に返却（ゼロアロケーション）
        if (!isPet && !isPlayer && !dynamicState && !rawShopText) {
            return staticMon;
        }

        // 🎯 3. 動的ステートが存在する場合: 静的ナレッジをシャローコピーし、動的フラグのみ上乗せ合成！
        const dynamicResult = { ...staticMon };

        // 🏪 店主 (Shopkeeper: 271) で Look 応答の個人名テキストが存在する場合、表示名を統合解決 ("Lord Carnarvon (Shopkeeper)")
        if (isShopkeeper && rawShopText) {
            const personName = rawShopText
                .replace(/\b(floor of a room|dark part of a room|corridor|open door|closed door|staircase|solid rock|wall)\b/gi, '')
                .replace(/\b(an?|the|peaceful|tamed|friendly|hostile)\b/gi, '')
                .replace(/[\(\)]/g, '')
                .trim();
            if (personName && personName.toLowerCase() !== 'shopkeeper' && personName.toLowerCase() !== '店主') {
                dynamicResult.personalName = personName;
                dynamicResult.name = `${personName} (Shopkeeper)`;
            }
        }

        if (isPlayer) {
            dynamicResult.dangerLevel = 'NONE';
            dynamicResult.dispositionStatus = 'PLAYER';
            dynamicResult.isPlayer = true;
            dynamicResult.isHostile = false;
        } else if (isPet) {
            dynamicResult.dangerLevel = 'SAFE';
            dynamicResult.dispositionStatus = 'TAMED';
            dynamicResult.isTame = true;
            dynamicResult.isHostile = false;
        } else if (dynamicState && dynamicState.hasResult !== false && (dynamicState.isPeaceful || dynamicState.isTamed || dynamicState.isHostile)) {
            if (dynamicState.isPeaceful) {
                dynamicResult.dangerLevel = 'SAFE';
                dynamicResult.dispositionStatus = 'PEACEFUL';
                dynamicResult.isPeaceful = true;
                dynamicResult.isHostile = false;
            } else if (dynamicState.isTamed) {
                dynamicResult.dangerLevel = 'SAFE';
                dynamicResult.dispositionStatus = 'TAMED';
                dynamicResult.isTame = true;
                dynamicResult.isHostile = false;
            } else if (dynamicState.isHostile) {
                dynamicResult.dangerLevel = found.hostileDangerLevel || found.dangerLevel || 'LETHAL';
                dynamicResult.dispositionStatus = 'HOSTILE';
                dynamicResult.isHostile = true;
                dynamicResult.isPeaceful = false;
            }
        } else if (found.defaultPeaceful || isShopkeeper) {
            dynamicResult.dangerLevel = 'SAFE';
            dynamicResult.dispositionStatus = 'DEFAULT_PEACEFUL';
            dynamicResult.isPeaceful = true;
            dynamicResult.isHostile = false;
        }

        if (dynamicState && dynamicState.stats) {
            dynamicResult.stats = {
                ...dynamicResult.stats,
                ...dynamicState.stats
            };
        }

        return dynamicResult;
    }

    /**
     * 文字列が未識別アイテムの外見表現か判定
     * @param {string} str 
     * @returns {boolean}
     */
    isUnidentifiedAppearance(str) {
        if (!str || typeof str !== 'string') return false;
        const res = ItemIdentificationResolver.resolve(str);
        return Boolean(res.isUnidentified);
    }

    /**
     * 未識別アイテム用の構造化ナレッジを自動生成
     * @param {string|Object} rawInput 
     * @param {Object} [options] 
     * @returns {Object} 未識別アイテムナレッジ
     */
    getUnidentifiedItemKnowledge(rawInput, options = {}) {
        const shouldTranslate = options.translate !== false;
        const lang = options.language || this.language || 'ja';

        const idRes = (rawInput && typeof rawInput === 'object' && rawInput.idLevel)
            ? rawInput
            : ItemIdentificationResolver.resolve(rawInput, options);

        const category = idRes.category || 'OTHER';

        // キャッシュキーの構築 (正規化された未識別外見名・カテゴリ・名付け・言語)
        let cacheKey = null;
        if (shouldTranslate && !options.dynamicState) {
            const appearance = (idRes.appearanceName || idRes.displayName || (typeof rawInput === 'string' ? rawInput : (rawInput.name || rawInput.str || ''))).trim().toLowerCase();
            const called = idRes.calledName ? `_called_${idRes.calledName.trim().toLowerCase()}` : '';
            const buc = idRes.bucStatus ? `_buc_${idRes.bucStatus}` : '';
            if (appearance) {
                cacheKey = `${lang}_unid_${category.toLowerCase()}_${appearance}${called}${buc}`;
                if (this.staticCache.has(cacheKey)) {
                    return this.staticCache.get(cacheKey);
                }
            }
        }

        const catUpper = (category || '').toUpperCase();
        let hintJa = '未鑑定のアイテム（使用、鑑定、または識別するまで正体不明）';
        let hintEn = 'Unidentified item (Identity unknown until tested or identified)';

        if (catUpper === 'POTION') {
            hintJa = '未鑑定の薬（飲む、投げる、または識別するまで正体不明）';
            hintEn = 'Unidentified potion (Identity unknown until quaffed, thrown, or identified)';
        } else if (catUpper === 'SCROLL') {
            hintJa = '未鑑定の巻物（読む、または識別するまで正体不明）';
            hintEn = 'Unidentified scroll (Identity unknown until read or identified)';
        } else if (catUpper === 'WAND') {
            hintJa = '未鑑定の杖（振る、床に彫る、または識別するまで正体不明）';
            hintEn = 'Unidentified wand (Identity unknown until zapped, engraved, or identified)';
        } else if (catUpper === 'RING') {
            hintJa = '未鑑定の指輪（指にはめる、流し台に落とす、または識別するまで正体不明）';
            hintEn = 'Unidentified ring (Identity unknown until worn, dropped in sink, or identified)';
        } else if (catUpper === 'AMULET') {
            hintJa = '未鑑定の魔除け（首にかける、または識別するまで正体不明）';
            hintEn = 'Unidentified amulet (Identity unknown until worn or identified)';
        } else if (catUpper === 'SPELLBOOK') {
            hintJa = '未鑑定の魔法書（読む、または識別するまで正体不明）';
            hintEn = 'Unidentified spellbook (Identity unknown until read or identified)';
        } else if (catUpper === 'ARMOR') {
            hintJa = '未鑑定の防具（装備、または識別するまで詳細性能は正体不明）';
            hintEn = 'Unidentified armor (Exact specs unknown until tested or identified)';
        } else if (catUpper === 'WEAPON') {
            hintJa = '未鑑定の武器（装備、または識別するまで詳細性能は正体不明）';
            hintEn = 'Unidentified weapon (Exact specs unknown until tested or identified)';
        }

        const rawNameStr = typeof rawInput === 'string' ? rawInput : (rawInput.appearanceName || rawInput.name || rawInput.str || '');
        const baseApp = (typeof rawInput === 'object' && rawInput.appearanceName) ? rawInput.appearanceName : (idRes.appearanceName || rawNameStr || `Unidentified ${category}`);
        const formattedEn = (typeof rawInput === 'object' && rawInput.nameEn) ? rawInput.nameEn : ItemIdentificationResolver.formatAppearanceName(baseApp, category, 'en');
        const formattedJa = (typeof rawInput === 'object' && rawInput.nameJa) ? rawInput.nameJa : ItemIdentificationResolver.formatAppearanceName(baseApp, category, 'ja');
        const displayName = lang === 'ja' ? formattedJa : formattedEn;

        const onum = (typeof rawInput === 'object' && typeof rawInput.onum === 'number')
            ? rawInput.onum
            : (typeof options.onum === 'number' ? options.onum : undefined);
        const directObject = (typeof rawInput === 'object' && rawInput.directObject)
            ? rawInput.directObject
            : (options.directObject || null);
        const floorObjects = (typeof rawInput === 'object' && rawInput.floorObjects)
            ? rawInput.floorObjects
            : (options.floorObjects || null);
        const extraPileCount = (typeof rawInput === 'object' && typeof rawInput.extraPileCount === 'number')
            ? rawInput.extraPileCount
            : (typeof options.extraPileCount === 'number' ? options.extraPileCount : 0);
        const isPile = Boolean(
            (typeof rawInput === 'object' && rawInput.isPile) ||
            options.isPile ||
            extraPileCount > 0
        );

        const rawObj = {
            id: `unidentified_${category.toLowerCase()}`,
            onum,
            name: (typeof rawInput === 'object' && rawInput.name) ? rawInput.name : displayName,
            nameJa: formattedJa,
            nameEn: formattedEn,
            category,
            isUnidentified: true,
            appearanceName: formattedEn,
            calledName: idRes.calledName,
            bucStatus: idRes.bucStatus,
            directObject,
            floorObjects,
            ...(isPile ? { isPile: true } : {}),
            extraPileCount,
            isGenericMasked: Boolean(typeof rawInput === 'object' && rawInput.isGenericMasked),
            wisdomTrueName: (typeof rawInput === 'object' && rawInput.wisdomTrueName) ? rawInput.wisdomTrueName : null,
            wisdomTrueNameJa: (typeof rawInput === 'object' && rawInput.wisdomTrueNameJa) ? rawInput.wisdomTrueNameJa : null,
            wisdomEffectSummary: (typeof rawInput === 'object' && rawInput.wisdomEffectSummary) ? rawInput.wisdomEffectSummary : null,
            wisdomEffectSummaryJa: (typeof rawInput === 'object' && rawInput.wisdomEffectSummaryJa) ? rawInput.wisdomEffectSummaryJa : null,
            wisdomMaterial: (typeof rawInput === 'object' && rawInput.wisdomMaterial) ? rawInput.wisdomMaterial : null,
            wisdomWeight: (typeof rawInput === 'object' && rawInput.wisdomWeight) ? rawInput.wisdomWeight : null,
            effectSummary: (lang === 'ja' ? hintJa : hintEn),
            effectSummaryJa: hintJa,
            effectSummaryEn: hintEn,
            unidentifiedTips: [],
            unidentifiedTipsEn: [],
            usageAdvice: [],
            usageAdviceEn: [],
            canBeUnidentified: true,
            identification: idRes,
            defaultVerb: (catUpper === 'POTION' ? 'q' : (catUpper === 'SCROLL' || catUpper === 'SPELLBOOK' ? 'r' : (catUpper === 'WAND' ? 'z' : (catUpper === 'RING' || catUpper === 'AMULET' ? 'P' : (catUpper === 'FOOD' ? 'e' : null))))),
            verb: (catUpper === 'POTION' ? 'q' : (catUpper === 'SCROLL' || catUpper === 'SPELLBOOK' ? 'r' : (catUpper === 'WAND' ? 'z' : (catUpper === 'RING' || catUpper === 'AMULET' ? 'P' : (catUpper === 'FOOD' ? 'e' : null))))),
            defaultActionLabel: (catUpper === 'POTION' ? 'Quaff' : (catUpper === 'SCROLL' ? 'Read' : (catUpper === 'SPELLBOOK' ? 'Read' : (catUpper === 'WAND' ? 'Zap' : (catUpper === 'RING' || catUpper === 'AMULET' ? 'Put on' : (catUpper === 'FOOD' ? 'Eat' : 'Select')))))),
            defaultActionLabelJa: (catUpper === 'POTION' ? '飲む' : (catUpper === 'SCROLL' ? '読む' : (catUpper === 'SPELLBOOK' ? '勉強する' : (catUpper === 'WAND' ? '振る' : (catUpper === 'RING' || catUpper === 'AMULET' ? '身につける' : (catUpper === 'FOOD' ? '食べる' : '選択'))))))
        };

        const finalResult = shouldTranslate ? this.localizeKnowledge(rawObj, options) : rawObj;
        if (cacheKey && finalResult) {
            this.staticCache.set(cacheKey, finalResult);
        }
        return finalResult;
    }

    /**
     * NetHack インベントリ表示テキストから純粋なアイテム名を自動抽出
     * 例: "a - 2 uncursed rations of cram" -> "ration of cram"
     * 例: "an uncursed +0 pair of water walking boots (being worn)" -> "water walking boots"
     * @param {string} str 
     * @returns {string} クリーニングされた英語アイテム名
     */
    cleanItemName(str) {
        if (!str || typeof str !== 'string') return '';
        let s = str.trim();

        // 1. スロット接頭辞除去 "a - ", "b) ", "c. ", "[c] ", "(d) "
        s = s.replace(/^(\[[a-zA-Z]\]|\([a-zA-Z]\)|[a-zA-Z]\s*[\-\)\.]|\([a-zA-Z]\))\s*/, '');

        // 2. 数量除去 "2 ", "10 "
        s = s.replace(/^\d+\s+/, '');

        // 3. 祝福/呪い修飾子除去 "blessed ", "uncursed ", "cursed "
        s = s.replace(/\b(blessed|uncursed|cursed)\s+/gi, '');

        // 4. 冠詞除去 "a ", "an ", "the "
        s = s.replace(/\b(a|an|the)\s+/gi, '');

        // 5. 強化値除去 "+0 ", "+1 ", "-2 "
        s = s.replace(/[+\-]\d+\s+/g, '');

        // 6. 単位・セット接頭辞除去 "pair of ", "pairs of ", "set of "
        s = s.replace(/\b(pairs?|sets?)\s+of\s+/gi, '');

        // 7. 付加修飾・装備中テキスト除去 "(being worn)", "(weapon in hand)", "(0:4)" 等
        s = s.replace(/\([^\)]+\)/g, '');

        // 8. プレイヤー仮名除去 "called foo", "named bar"
        s = s.replace(/\b(called|named)\s+.*$/gi, '');

        s = s.trim();

        // 9. 複数形 's' の慎重な除去（boots, shoes, gloves, glasses, gauntlets などの元々複数形の防具/アイテムは除外）
        const preservePlurals = ['boots', 'shoes', 'gloves', 'glasses', 'gauntlets', 'lenses', 'clothes', 'scales', 'shards'];
        const isPreserved = preservePlurals.some(p => s.toLowerCase().endsWith(p));
        if (!isPreserved) {
            s = s.replace(/(\w{3,})s\b/gi, '$1');
        }

        return s.trim();
    }

    /**
     * 入力識別子・オプションが PileTop (複数のアイテム・死体・像の積み重なり) を表すか判定する
     * @param {number|string|Object} identifier
     * @param {Object} [options]
     * @returns {boolean}
     * @private
     */
    _isPileInput(identifier, options = {}) {
        if (options?.isPile) return true;
        if (typeof identifier === 'object' && identifier !== null) {
            if (identifier.isPile || identifier.glyphInfo?.isPile) return true;
            const g = typeof identifier.glyph === 'number' ? identifier.glyph :
                      (typeof identifier.rawGlyph === 'number' ? identifier.rawGlyph :
                      (typeof identifier.glyphInfo?.glyph === 'number' ? identifier.glyphInfo.glyph : -1));
            if (g >= GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF && g < GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF) {
                return true;
            }
        } else if (typeof identifier === 'number' && !options?.isOnum) {
            if (identifier >= GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF && identifier < GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF) {
                return true;
            }
        }
        return false;
    }

    /**
     * 静的キャッシュを汚染せずに isPile: true フラグを付与する
     * @param {Object|null} result
     * @param {boolean} isPile
     * @returns {Object|null}
     * @private
     */
    _applyPileFlag(result, isPile) {
        if (!result || !isPile) return result;
        if (result.isPile === true) return result;
        return { ...result, isPile: true };
    }

    /**
     * アイテム構造化ナレッジの取得 (onum を一次識別軸とし、数値/オブジェクト/文字列に対応)
     * @param {number|string|Object} identifier - onum, glyphId, Item Object, または Item Text
     * @param {Object} [options] 
     * @returns {Object|null} アイテムナレッジ
     */
    getItemKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        const directObj = (typeof identifier === 'object' && identifier !== null)
            ? (identifier.directObject || options.directObject || null)
            : (options.directObject || null);
        const floorObjects = (typeof identifier === 'object' && identifier !== null)
            ? (identifier.floorObjects || options.floorObjects || null)
            : (options.floorObjects || null);
        const extraPileCount = (typeof options.extraPileCount === 'number')
            ? options.extraPileCount
            : ((typeof identifier === 'object' && typeof identifier?.extraPileCount === 'number')
                ? identifier.extraPileCount
                : ((directObj && typeof directObj.extraPileCount === 'number') ? directObj.extraPileCount : 0));

        const isPile = this._isPileInput(identifier, { ...options, extraPileCount });
        const shouldTranslate = options.translate !== false;
        const lang = options.language || this.language || 'ja';
        const isWisdomMode = Boolean(options.sagesWisdomMode !== undefined ? options.sagesWisdomMode : this.sagesWisdomMode);
        let cacheKey = null;
        if (shouldTranslate && !options.dynamicState && !this.discoveryStateManager && !directObj) {
            if (typeof identifier === 'number' && !options.identification && !options.isUnidentified) {
                cacheKey = `${lang}_item_num_${identifier}_${isWisdomMode ? 'w' : 'n'}`;
            } else if (typeof identifier === 'string') {
                cacheKey = `${lang}_item_str_${identifier}_${isWisdomMode ? 'w' : 'n'}`;
            } else if (typeof identifier === 'object' && identifier !== null && !identifier.dynamicState) {
                const rawName = identifier.rawText || identifier.str || identifier.label || identifier.name || '';
                const onum = typeof identifier.onum === 'number' ? identifier.onum : -1;
                const isUnid = Boolean(identifier.isUnidentified || identifier.identification?.isUnidentified || options.isUnidentified || options.identification?.isUnidentified);
                if (rawName || onum >= 0) {
                    cacheKey = `${lang}_item_obj_${onum}_${rawName}_${isUnid ? '1' : '0'}_${isWisdomMode ? 'w' : 'n'}`;
                }
            }
        }
        if (cacheKey && this.staticCache.has(cacheKey)) {
            return this._applyPileFlag(this.staticCache.get(cacheKey), isPile);
        }

        let found = null;
        let targetOnum = -1;
        let originalDisplayName = '';

        if (directObj && typeof directObj.otyp === 'number' && directObj.otyp >= 0) {
            targetOnum = directObj.otyp;
        }

        if (typeof identifier === 'object') {
            originalDisplayName = identifier.rawText || identifier.str || identifier.label || identifier.name || '';
        } else if (typeof identifier === 'string') {
            originalDisplayName = identifier;
        }

        // 1. オブジェクト指定 ({ onum, subType, glyph, rawGlyph, str, rawText, name, label })
        if (typeof identifier === 'object' && identifier !== null) {
            const rawName = identifier.label || identifier.rawText || identifier.str || identifier.name || '';
            const isUnidentifiedInput = Boolean(
                identifier.isUnidentified ||
                identifier.identification?.isUnidentified ||
                options.isUnidentified ||
                options.identification?.isUnidentified
            );

            if (rawName && this.isUnidentifiedAppearance(rawName) && !isWisdomMode) {
                return this._applyPileFlag(
                    this.getUnidentifiedItemKnowledge(rawName, { ...options, sagesWisdomMode: isWisdomMode, directObject: directObj, extraPileCount, isPile }),
                    isPile
                );
            }
            if (identifier.onum === 476 || identifier.subType === 476 || (identifier.name && identifier.name.toLowerCase() === 'statue')) {
                return this._applyPileFlag(this.getStatueKnowledge(identifier, options), isPile);
            }
            if (targetOnum < 0) {
                if (typeof identifier.onum === 'number' && identifier.onum >= 0) {
                    targetOnum = identifier.onum;
                } else if (typeof identifier.subType === 'number' && identifier.subType >= 0 && identifier.subType < 500) {
                    targetOnum = identifier.subType;
                } else if (identifier.identification && typeof identifier.identification.onum === 'number' && identifier.identification.onum >= 0) {
                    targetOnum = identifier.identification.onum;
                } else if (identifier.knowledge && typeof identifier.knowledge.onum === 'number' && identifier.knowledge.onum >= 0) {
                    targetOnum = identifier.knowledge.onum;
                } else if (typeof identifier.id === 'string' && identifier.id.startsWith('item_onum_')) {
                    const parsed = parseInt(identifier.id.replace('item_onum_', ''), 10);
                    if (!isNaN(parsed) && parsed >= 0) targetOnum = parsed;
                } else if (typeof identifier.glyph === 'number' && identifier.glyph >= 0) {
                    targetOnum = getOnumFromGlyph(identifier.glyph);
                    if (targetOnum < 0 && identifier.glyph < 500) targetOnum = identifier.glyph;
                } else if (typeof identifier.rawGlyph === 'number' && identifier.rawGlyph >= 0) {
                    targetOnum = getOnumFromGlyph(identifier.rawGlyph);
                    if (targetOnum < 0 && identifier.rawGlyph < 500) targetOnum = identifier.rawGlyph;
                }
            }

            // 🕵️ ネタバレ防止ルール: 遠距離未確認（dknown === false）のオブジェクト
            const isDistanceUnseen = Boolean(directObj && directObj.flags && directObj.flags.dknown === false);
            if (isDistanceUnseen && !isWisdomMode && targetOnum >= 0) {
                const catStr = getCategoryFromOnum(targetOnum);
                const genericNameEn = `unidentified ${catStr.toLowerCase()}`;
                const catJa = (typeof ItemIdentificationResolver.getCategoryNameJa === 'function')
                    ? ItemIdentificationResolver.getCategoryNameJa(catStr)
                    : (catStr === 'POTION' ? '薬' : (catStr === 'SCROLL' ? '巻物' : (catStr === 'WAND' ? '杖' : (catStr === 'RING' ? '指輪' : (catStr === 'AMULET' ? '魔除け' : (catStr === 'SPELLBOOK' ? '魔法書' : (catStr === 'GEM' ? '宝石' : catStr)))))));
                const genericNameJa = `未確認の${catJa}`;
                const masterObj = OBJECT_KNOWLEDGE_MAP ? OBJECT_KNOWLEDGE_MAP.get(targetOnum) : null;
                return this._applyPileFlag(
                    this.getUnidentifiedItemKnowledge({
                        category: catStr,
                        onum: targetOnum,
                        directObject: directObj,
                        floorObjects,
                        isPile,
                        extraPileCount,
                        isGenericMasked: true,
                        appearanceName: genericNameEn,
                        name: lang === 'ja' ? genericNameJa : genericNameEn,
                        nameJa: genericNameJa,
                        nameEn: genericNameEn,
                        wisdomTrueName: masterObj?.name || null,
                        wisdomTrueNameJa: masterObj?.nameJa || null,
                        wisdomEffectSummary: masterObj?.effectSummary || null,
                        wisdomEffectSummaryJa: masterObj?.effectSummaryJa || masterObj?.effectSummary || null,
                        wisdomMaterial: masterObj?.material || null,
                        wisdomWeight: masterObj?.weight || null
                    }, { ...options, sagesWisdomMode: false, directObject: directObj, extraPileCount, isPile }),
                    isPile
                );
            }

            // 未識別アイテムかつ通常モードの場合、未識別ナレッジを即座に返す
            if (targetOnum >= 0 && isUnidentifiedInput && !isWisdomMode && options.forceFullKnowledge !== true) {
                return this._applyPileFlag(
                    this.getUnidentifiedItemKnowledge(identifier, { ...options, sagesWisdomMode: isWisdomMode, directObject: directObj, extraPileCount, isPile }),
                    isPile
                );
            }

            if (targetOnum >= 0 && !isUnidentifiedInput && !options.identification && !options.isUnidentified && !directObj) {
                return this._applyPileFlag(this.getItemKnowledge(targetOnum, options), isPile);
            }
            if (targetOnum < 0) {
                const rawName = identifier.label || identifier.rawText || identifier.str || identifier.name || '';
                if (rawName) return this._applyPileFlag(this.getItemKnowledge(rawName, options), isPile);
            }
        }
        // 2. 数値指定 (onum または glyphId)
        else if (typeof identifier === 'number') {
            if (options.isOnum === true) {
                targetOnum = identifier;
            } else {
                targetOnum = getOnumFromGlyph(identifier);
                if (targetOnum < 0 && identifier >= 0 && identifier < 500) {
                    targetOnum = identifier;
                }
            }
        }
        // 3. 文字列指定 ("wand_of_digging" または インベントリ文章 "a - 2 uncursed rations of cram")
        else if (typeof identifier === 'string') {
            if (this.isUnidentifiedAppearance(identifier) && !isWisdomMode) {
                return this._applyPileFlag(
                    this.getUnidentifiedItemKnowledge(identifier, { ...options, sagesWisdomMode: isWisdomMode, directObject: directObj, extraPileCount, isPile }),
                    isPile
                );
            }

            const cleaned = this.cleanItemName(identifier);
            const cleanKey = cleaned.toLowerCase().replace(/\s+/g, '_');
            
            found = this.items.get(cleanKey) || 
                    this.items.get(cleaned.toLowerCase()) || 
                    this.items.get(identifier.trim().toLowerCase()) || null;

            if (!found && OBJECT_TILEMAP_NAMES) {
                const cleanLower = cleaned.toLowerCase();
                const entry = Object.entries(OBJECT_TILEMAP_NAMES).find(([onumStr, fullName]) => {
                    if (!fullName) return false;
                    const parts = fullName.toLowerCase().split('/').map(p => p.trim());
                    return parts.some(part => part === cleanLower || fullName.toLowerCase() === cleanLower);
                });
                if (entry) {
                    targetOnum = parseInt(entry[0], 10);
                }
            }

            if (!found && targetOnum < 0 && cleaned.length > 0) {
                const categoryData = inferObjectCategory(cleaned);
                if (categoryData && (categoryData.category !== 'TOOL' || options.allowFallback === true)) {
                    found = {
                        id: `item_${cleanKey}`,
                        name: cleaned,
                        category: categoryData.category,
                        effectSummary: categoryData.effectSummary
                    };
                }
            }
        }

        // onum が定まっている場合は onumMap からナレッジを取得
        if (!found && targetOnum >= 0) {
            const isIdentifiedInDiscovery = this.discoveryStateManager ? this.discoveryStateManager.isIdentified(targetOnum) : true;
            const isExplicitlyUnidentified = Boolean(
                options.isUnidentified ||
                options.identification?.isUnidentified ||
                (typeof identifier === 'object' && identifier && (identifier.isUnidentified || identifier.identification?.isUnidentified))
            );

            if (!isWisdomMode && options.forceFullKnowledge !== true) {
                if (!isIdentifiedInDiscovery || isExplicitlyUnidentified) {
                    const catStr = getCategoryFromOnum(targetOnum);
                    const masterObj = OBJECT_KNOWLEDGE_MAP ? OBJECT_KNOWLEDGE_MAP.get(targetOnum) : null;
                    const canBeUnidentified = masterObj ? masterObj.canBeUnidentified : true;
                    if (canBeUnidentified) {
                        const dynApp = (this.discoveryStateManager && typeof this.discoveryStateManager.getAppearance === 'function')
                            ? this.discoveryStateManager.getAppearance(targetOnum)
                            : null;
                        const descr = dynApp || masterObj?.descr || '';
                        const formattedEn = ItemIdentificationResolver.formatAppearanceName(descr, catStr, 'en');
                        const formattedJa = ItemIdentificationResolver.formatAppearanceName(descr, catStr, 'ja');
                        const targetName = lang === 'ja' ? formattedJa : formattedEn;
                        return this._applyPileFlag(
                            this.getUnidentifiedItemKnowledge({
                                category: catStr,
                                onum: targetOnum,
                                directObject: directObj,
                                floorObjects,
                                isPile,
                                extraPileCount,
                                appearanceName: formattedEn,
                                name: targetName,
                                nameJa: formattedJa,
                                nameEn: formattedEn,
                                wisdomTrueName: masterObj?.name || null,
                                wisdomTrueNameJa: masterObj?.nameJa || null,
                                wisdomEffectSummary: masterObj?.effectSummary || null,
                                wisdomEffectSummaryJa: masterObj?.effectSummaryJa || masterObj?.effectSummary || null,
                                wisdomMaterial: masterObj?.material || null,
                                wisdomWeight: masterObj?.weight || null
                            }, { ...options, sagesWisdomMode: isWisdomMode, directObject: directObj, extraPileCount, isPile }),
                            isPile
                        );
                    }
                }
            }

            found = this.onumMap.get(targetOnum) || null;

            if (!found && OBJECT_TILEMAP_NAMES[targetOnum]) {
                const itemName = OBJECT_TILEMAP_NAMES[targetOnum];
                const catStr = getCategoryFromOnum(targetOnum);
                found = {
                    id: `item_onum_${targetOnum}`,
                    onum: targetOnum,
                    name: itemName,
                    category: catStr,
                    effectSummary: 'Standard dungeon item.',
                    effectSummaryEn: 'Standard dungeon item.',
                    unidentifiedTips: [],
                    unidentifiedTipsEn: [],
                    usageAdvice: [],
                    usageAdviceEn: []
                };
            }
        }

        if (!found) return null;

        // 🧙 覗き見知恵（Peek Wisdom）モード時の真名・外見同時解放
        if (isWisdomMode) {
            const isUnid = Boolean(
                options.isUnidentified ||
                options.identification?.isUnidentified ||
                (typeof identifier === 'object' && identifier && (identifier.isUnidentified || identifier.identification?.isUnidentified)) ||
                (this.discoveryStateManager && targetOnum >= 0 && !this.discoveryStateManager.isIdentified(targetOnum)) ||
                (directObj && directObj.flags && directObj.flags.dknown === false)
            );
            if (isUnid && targetOnum >= 0) {
                const catStr = getCategoryFromOnum(targetOnum);
                const masterObj = OBJECT_KNOWLEDGE_MAP ? OBJECT_KNOWLEDGE_MAP.get(targetOnum) : null;
                const dynApp = (this.discoveryStateManager && typeof this.discoveryStateManager.getAppearance === 'function')
                    ? this.discoveryStateManager.getAppearance(targetOnum)
                    : null;
                const descr = dynApp || masterObj?.descr || '';
                const formattedEn = descr ? ItemIdentificationResolver.formatAppearanceName(descr, catStr, 'en') : (masterObj?.name || found.name);
                const formattedJa = descr ? ItemIdentificationResolver.formatAppearanceName(descr, catStr, 'ja') : (masterObj?.nameJa || found.nameJa || found.name);

                const trueNameEn = masterObj?.name || found.name;
                const trueNameJa = masterObj?.nameJa || found.nameJa || found.name;

                const combinedNameJa = (formattedJa && formattedJa !== trueNameJa) ? `${formattedJa} [${trueNameJa}]` : trueNameJa;
                const combinedNameEn = (formattedEn && formattedEn !== trueNameEn) ? `${formattedEn} [${trueNameEn}]` : trueNameEn;

                found = {
                    ...found,
                    name: lang === 'ja' ? combinedNameJa : combinedNameEn,
                    nameJa: combinedNameJa,
                    nameEn: combinedNameEn,
                    isUnidentified: true,
                    isWisdomRevealed: true,
                    wisdomBadge: true,
                    appearanceName: formattedEn,
                    wisdomTrueName: trueNameEn,
                    wisdomTrueNameJa: trueNameJa,
                    wisdomEffectSummary: masterObj?.effectSummary || found.effectSummary,
                    wisdomEffectSummaryJa: masterObj?.effectSummaryJa || masterObj?.effectSummary || found.effectSummaryJa || found.effectSummary
                };
            }
        }

        // 🥫 缶詰 (TIN, 247) / フィギュア (FIGURINE, 419) のモンスター名解決
        if ((targetOnum === 247 || targetOnum === 419) && directObj && typeof directObj.corpsenm === 'number' && directObj.corpsenm >= 0) {
            const mon = ALL_MONSTER_KNOWLEDGE_BASE[directObj.corpsenm] || (MONSTER_KNOWLEDGE_MAP && MONSTER_KNOWLEDGE_MAP.get(directObj.corpsenm));
            if (mon) {
                const monNameEn = mon.name || `monster ${directObj.corpsenm}`;
                const monNameJa = mon.nameJa || mon.name || `モンスター ${directObj.corpsenm}`;
                if (targetOnum === 247) {
                    const canReveal = Boolean(isWisdomMode || directObj.flags?.known || directObj.flags?.rknown);
                    if (canReveal) {
                        found = {
                            ...found,
                            nameEn: `tin of ${monNameEn} meat`,
                            nameJa: `${monNameJa} の缶詰`,
                            name: lang === 'ja' ? `${monNameJa} の缶詰` : `tin of ${monNameEn} meat`
                        };
                    }
                } else if (targetOnum === 419) {
                    const canReveal = Boolean(isWisdomMode || directObj.flags?.known);
                    if (canReveal) {
                        found = {
                            ...found,
                            nameEn: `figurine of ${monNameEn}`,
                            nameJa: `${monNameJa} のフィギュア`,
                            name: lang === 'ja' ? `${monNameJa} のフィギュア` : `figurine of ${monNameEn}`
                        };
                    }
                }
            }
        }

        if (originalDisplayName && originalDisplayName.trim().length > 0) {
            found = {
                ...found,
                inventoryLabel: originalDisplayName
            };
        }

        const finalResult = shouldTranslate ? this.localizeKnowledge(found, options) : found;

        // 動的スペック (specs / wisdomSpecs) および床スタック情報の付与
        finalResult.directObject = directObj;
        finalResult.floorObjects = floorObjects;
        finalResult.extraPileCount = extraPileCount;
        if (isPile) {
            finalResult.isPile = true;
        } else {
            delete finalResult.isPile;
        }
        finalResult.specs = getAdaptiveItemSpecs(finalResult, { ...options, isWisdomRevealed: false, directObject: directObj, extraPileCount, isPile });
        finalResult.wisdomSpecs = getAdaptiveItemSpecs(finalResult, { ...options, isWisdomRevealed: true, directObject: directObj, extraPileCount, isPile });

        if (cacheKey && finalResult && !directObj) {
            this.staticCache.set(cacheKey, finalResult);
        }
        return this._applyPileFlag(finalResult, isPile);
    }

    /**
     * 地形・仕掛けの構造化ナレッジ取得
     * @param {number|string} identifier - glyphId または 地形名/記号
     * @param {Object} [options] 
     * @returns {Object|null} 地形ナレッジ
     */
    getTerrainKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        const shouldTranslate = options.translate !== false;
        const lang = options.language || this.language || 'ja';

        // 早期キャッシュチェック（文字列ID直接指定時）
        if (typeof identifier === 'string' && shouldTranslate) {
            const directKey = `${lang}_terrain_${identifier.toLowerCase()}`;
            if (this.staticCache.has(directKey)) {
                return this.staticCache.get(directKey);
            }
        }

        let rawObj = null;

        if (typeof identifier === 'object') {
            const glyphId = (typeof identifier.glyph === 'number') ? identifier.glyph : (identifier.rawGlyph ?? -1);
            return this.getTerrainKnowledge(glyphId >= 0 ? glyphId : (identifier.name || identifier.id || ''), options);
        }

        if (typeof identifier === 'number') {
            const cmapInfo = getCmapInfo(identifier);
            rawObj = getTerrainEntryByCmap(cmapInfo);
        }

        if (!rawObj && typeof identifier === 'string') {
            rawObj = getTerrainEntryByKey(identifier);
        }

        if (!rawObj) return null;
        rawObj.canBeUnidentified = false;

        // 🎯 地形正規化キー（例: ja_terrain_stairs_down, ja_terrain_fountain）
        const cacheKey = (rawObj.id && shouldTranslate) ? `${lang}_terrain_${rawObj.id}` : null;
        if (cacheKey && this.staticCache.has(cacheKey)) {
            return this.staticCache.get(cacheKey);
        }

        const finalResult = shouldTranslate ? this.localizeKnowledge(rawObj, options) : rawObj;
        if (cacheKey && finalResult) {
            this.staticCache.set(cacheKey, finalResult);
        }
        return finalResult;
    }

    /**
     * モンスタークラスの構造化ナレッジ取得
     * @param {string} symbol - クラス記号 ('a'〜'~', '@' など)
     * @param {Object} [options]
     * @returns {Object|null} クラスナレッジ
     */
    getMonsterClassKnowledge(symbol, options = {}) {
        const classDef = getMonsterClassDefinition(symbol);
        if (!classDef) return null;
        const isEn = (options.language === 'en' || this.language === 'en' || !this.translationEngine || !this.translationEngine.enabled);
        return {
            symbol: classDef.symbol,
            name: isEn ? classDef.nameEn : classDef.nameJa,
            nameEn: classDef.nameEn,
            nameJa: classDef.nameJa,
            danger: classDef.danger,
            raceTrap: classDef.raceTrap || null,
            desc: isEn ? (classDef.descEn || classDef.descJa) : (classDef.descJa || classDef.descEn),
            descJa: classDef.descJa,
            descEn: classDef.descEn
        };
    }

    /**
     * 全モンスタークラス一覧の取得
     * @param {Object} [options]
     * @returns {Array<Object>} 全クラスナレッジ一覧
     */
    getAllMonsterClasses(options = {}) {
        return getAllMonsterClassDefinitions().map(c => this.getMonsterClassKnowledge(c.symbol, options));
    }

    /**
     * 変身時の防具破壊・脱落リスク判定
     * @param {Object|string} monsterOrName - モンスターオブジェクトまたは名前/サイズ
     * @returns {Object} 防具リスク判定結果
     */
    checkMonsterArmorRisk(monsterOrName) {
        return MonsterArmorRiskResolver.checkArmorRisk(monsterOrName, name => this.getMonsterKnowledge(name, { translate: false }));
    }

    /**
     * アーティファクトの構造化ナレッジ取得
     * @param {string} idOrName - アーティファクトIDまたは英語/日本語名称
     * @param {Object} [options]
     * @returns {Object|null}
     */
    getArtifactKnowledge(idOrName, options = {}) {
        const art = getArtifactDefinition(idOrName);
        if (!art) return null;

        const isEn = (options.language === 'en' || (this.language === 'en' && !options.language));
        const baseItem = (art.baseOnum !== undefined && art.baseOnum >= 0) 
            ? this.getItemKnowledge(art.baseOnum, { translate: !isEn, language: isEn ? 'en' : 'ja' }) 
            : null;

        return {
            ...art,
            displayName: isEn ? art.name : art.nameJa,
            desc: isEn ? art.descEn : art.descJa,
            baseItem
        };
    }

    /**
     * 全アーティファクト一覧の取得
     * @param {Object} [options]
     * @returns {Array<Object>}
     */
    getAllArtifacts(options = {}) {
        return getAllArtifactDefinitions().map(a => this.getArtifactKnowledge(a.id, options));
    }

    /**
     * 死体 (Corpse) の構造化ナレッジ取得
     * @param {number|Object|string} identifier 
     * @param {Object} [options] 
     * @returns {Object|null} 死体ナレッジ
     */
    getCorpseKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        const isPile = this._isPileInput(identifier, options);
        let glyphId = -1;
        let monOffset = -1;
        let rawName = '';

        if (typeof identifier === 'object') {
            glyphId = typeof identifier.glyph === 'number' ? identifier.glyph : (identifier.rawGlyph ?? -1);
            rawName = identifier.name || identifier.str || identifier.rawText || '';
        } else if (typeof identifier === 'number') {
            glyphId = identifier;
        } else if (typeof identifier === 'string') {
            rawName = identifier;
        }

        if (typeof identifier === 'object' && identifier !== null) {
            if (typeof identifier.corpsenm === 'number' && identifier.corpsenm >= 0) {
                monOffset = identifier.corpsenm % 383;
            } else if (typeof identifier.subType === 'number' && identifier.subType >= 0) {
                monOffset = identifier.subType % 383;
            }
        }

        if (monOffset < 0) {
            if (glyphId >= GLYPH_OFFSETS.GLYPH_BODY_OFF && glyphId < GLYPH_OFFSETS.GLYPH_RIDDEN_OFF) {
                monOffset = (glyphId - GLYPH_OFFSETS.GLYPH_BODY_OFF) % 383;
            } else if (glyphId >= GLYPH_OFFSETS.GLYPH_BODY_PILETOP_OFF && glyphId < GLYPH_OFFSETS.GLYPH_STATUE_MALE_PILETOP_OFF) {
                monOffset = (glyphId - GLYPH_OFFSETS.GLYPH_BODY_PILETOP_OFF) % 383;
            }
        }

        let monKnowledge = null;
        if (monOffset >= 0) {
            monKnowledge = this.getMonsterKnowledge(monOffset, { ...options, isMonOffset: true });
        } else if (rawName) {
            const cleanMonName = rawName.replace(/corpse/i, '').replace(/dead/i, '').replace(/死体/g, '').trim();
            if (cleanMonName.length > 0) {
                monKnowledge = this.getMonsterKnowledge(cleanMonName, options);
            }
        }

        const baseNameEn = monKnowledge ? (monKnowledge.nameEn || monKnowledge.name) : (monOffset >= 0 ? `Monster ${monOffset}` : '');
        const baseNameJa = monKnowledge ? (monKnowledge.nameJa || monKnowledge.name) : (monOffset >= 0 ? `モンスター ${monOffset}` : '');
        const isEn = (options.language || this.language) === 'en';
        const baseName = isEn ? baseNameEn : baseNameJa;
        const corpseName = isEn ? (baseNameEn ? `${baseNameEn} corpse` : 'corpse') : (baseNameJa ? `${baseNameJa} の死体 (corpse)` : '死体 (corpse)');

        const corpseObj = {
            id: `corpse_${monOffset >= 0 ? monOffset : 'unknown'}`,
            name: corpseName,
            nameEn: baseNameEn ? `${baseNameEn} corpse` : 'corpse',
            nameJa: baseNameJa ? `${baseNameJa} の死体 (corpse)` : '死体 (corpse)',
            category: 'CORPSE',
            canBeUnidentified: false,
            ...(isPile ? { isPile: true } : {}),
            corpseInfo: monKnowledge?.corpseInfo || null,
            effectSummary: isEn ?
                (monKnowledge?.corpseInfo?.warningNote ? `Warning: ${monKnowledge.corpseInfo.warningNote}` : (baseName ? `Corpse of ${baseName}. Can be eaten or offered at an altar.` : 'Monster corpse. Can be eaten or offered at an altar.')) :
                (monKnowledge?.corpseInfo?.warningNote ? 
                    `食中毒・呪い警告: ${monKnowledge.corpseInfo.warningNote}` : 
                    (baseName ? `モンスター (${baseName}) の死体です。食料として食べるか、祭壇で捧げることができます。` : 'モンスターの死体です。食料として食べるか、祭壇で捧げることができます。'))
        };

        const shouldTranslate = options.translate !== false;
        const localized = shouldTranslate ? this.localizeKnowledge(corpseObj, options) : corpseObj;
        return this._applyPileFlag(localized, isPile);
    }

    /**
     * 石像 (Statue) の構造化ナレッジ取得
     * @param {number|string|Object} identifier 
     * @param {Object} [options] 
     * @returns {Object|null} 石像ナレッジ
     */
    getStatueKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        const isPile = this._isPileInput(identifier, options);
        let glyphId = -1;
        let monOffset = -1;
        let rawName = '';

        if (typeof identifier === 'object') {
            glyphId = typeof identifier.glyph === 'number' ? identifier.glyph : 
                      (typeof identifier.rawGlyph === 'number' ? identifier.rawGlyph :
                      (typeof identifier.glyphInfo?.glyph === 'number' ? identifier.glyphInfo.glyph : -1));
            rawName = identifier.name || identifier.str || identifier.rawText || identifier.label || '';

            // corpsenm または subType (0〜382) を monOffset とする
            if (typeof identifier.corpsenm === 'number' && identifier.corpsenm >= 0 && identifier.corpsenm < 383) {
                monOffset = identifier.corpsenm;
            } else if (typeof identifier.subType === 'number' && identifier.subType >= 0 && identifier.subType < 383) {
                monOffset = identifier.subType;
            }
        } else if (typeof identifier === 'number') {
            glyphId = identifier;
        } else if (typeof identifier === 'string') {
            rawName = identifier;
        }

        if (monOffset < 0 && glyphId >= 0) {
            if (glyphId >= GLYPH_OFFSETS.GLYPH_STATUE_PILETOP_OFF && glyphId < GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF) {
                monOffset = (glyphId - GLYPH_OFFSETS.GLYPH_STATUE_PILETOP_OFF) % 383;
            } else if (glyphId >= GLYPH_OFFSETS.GLYPH_STATUE_OFF && glyphId < GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF) {
                monOffset = (glyphId - GLYPH_OFFSETS.GLYPH_STATUE_OFF) % 383;
            }
        }

        let monKnowledge = null;
        if (monOffset >= 0) {
            monKnowledge = this.getMonsterKnowledge(monOffset, { ...options, isMonOffset: true });
        } else if (rawName) {
            const cleanMonName = rawName.replace(/statue\s*(of)?/i, '').replace(/像/g, '').trim();
            if (cleanMonName.length > 0) {
                monKnowledge = this.getMonsterKnowledge(cleanMonName, options);
            }
        }

        const baseNameEn = monKnowledge ? (monKnowledge.nameEn || monKnowledge.name) : (monOffset >= 0 ? `Monster ${monOffset}` : '');
        const baseNameJa = monKnowledge ? (monKnowledge.nameJa || monKnowledge.name) : (monOffset >= 0 ? `モンスター ${monOffset}` : '');
        const isEn = (options.language || this.language) === 'en';
        const baseName = isEn ? baseNameEn : baseNameJa;
        const statueName = isEn ? (baseNameEn ? `statue of ${baseNameEn}` : 'statue') : (baseNameJa ? `${baseNameJa} の像 (statue)` : '石像 (statue)');

        const statueObj = {
            id: `statue_${monOffset >= 0 ? monOffset : 'unknown'}`,
            name: statueName,
            nameEn: baseNameEn ? `statue of ${baseNameEn}` : 'statue',
            nameJa: baseNameJa ? `${baseNameJa} の像 (statue)` : '石像 (statue)',
            category: 'STATUE',
            canBeUnidentified: false,
            ...(isPile ? { isPile: true } : {}),
            effectSummary: isEn ?
                (baseName ? `Statue of ${baseName}. Can be broken with pick-axe / wand of striking, or carried.` : 'Statue. Can be broken with pick-axe / wand of striking, or carried.') :
                (baseName ? 
                    `モンスター (${baseName}) の石像です。ツルハシ(#apply pick-axe)や打撃の杖(Wand of Striking)で破壊するか、持ち運ぶことができます。` :
                    `石像です。ツルハシ(#apply pick-axe)や打撃の杖(Wand of Striking)で破壊するか、持ち運ぶことができます。`)
        };

        const shouldTranslate = options.translate !== false;
        const localized = shouldTranslate ? this.localizeKnowledge(statueObj, options) : statueObj;
        return this._applyPileFlag(localized, isPile);
    }

    /**
     * 万能統合ナレッジアクセサ (アイテム -> モンスター -> 地形 -> 汎用フォールバックの自動判定取得)
     * @param {number|string|Object} identifier 
     * @param {Object} [options] 
     * @returns {Object|null} 構造化ナレッジ
     */
    getKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        const isPile = this._isPileInput(identifier, options);

        // 🎯 -1. すでに完成した構造化ナレッジオブジェクト (category 及び effectSummary を保持) の場合、二重検索で破壊せずにそのまま返却！
        // ただし、賢者の知恵モード(sagesWisdomMode)で未識別アイテムが渡された場合は真名開示のために再解決を許可！
        if (typeof identifier === 'object' && identifier !== null && identifier.category && identifier.effectSummary) {
            const isUnid = Boolean(
                identifier.isUnidentified ||
                identifier.identification?.isUnidentified ||
                options.isUnidentified ||
                (identifier.directObject && identifier.directObject.flags && identifier.directObject.flags.dknown === false)
            );
            const isWisdom = Boolean(options.sagesWisdomMode);
            if (!isWisdom || !isUnid) {
                return this._applyPileFlag(identifier, isPile);
            }
        }

        // 🎯 0. オブジェクト型指定の場合、type プロパティ (BODY, STATUE, TERRAIN, MONSTER, ITEM) に基づき最優先で直撃分岐！
        if (typeof identifier === 'object' && identifier !== null) {
            if (identifier.type === 'BODY') {
                return this._applyPileFlag(this.getCorpseKnowledge(identifier, options), isPile);
            }
            if (identifier.type === 'STATUE' || identifier.subType === 476 || identifier.onum === 476 || (identifier.name && identifier.name.toLowerCase() === 'statue')) {
                return this._applyPileFlag(this.getStatueKnowledge(identifier, options), isPile);
            }
            if (identifier.type === 'TERRAIN' || identifier.type === 'UNEXPLORED') {
                return this.getTerrainKnowledge(identifier, options);
            }
            if (identifier.type === 'MONSTER' || identifier.type === 'PET') {
                return this.getMonsterKnowledge(identifier, options);
            }
            if (identifier.type === 'ITEM' || identifier.onum !== undefined || identifier.directObject || identifier.category) {
                return this._applyPileFlag(this.getItemKnowledge(identifier, options), isPile);
            }
        }

        // 1. 数値 glyphId の場合、まず classifyGlyph でエンティティ種別を正確に物理統一検索！
        if (typeof identifier === 'number') {
            const info = classifyGlyph(identifier);
            if (info) {
                if (info.type === ENTITY_TYPES.MONSTER || info.type === ENTITY_TYPES.PET) {
                    return this.getMonsterKnowledge(identifier, options);
                } else if (info.type === ENTITY_TYPES.BODY) {
                    return this._applyPileFlag(this.getCorpseKnowledge(identifier, options), isPile);
                } else if (info.type === ENTITY_TYPES.STATUE) {
                    return this._applyPileFlag(this.getStatueKnowledge(identifier, options), isPile);
                } else if (info.type === ENTITY_TYPES.ITEM) {
                    return this._applyPileFlag(this.getItemKnowledge(identifier, options), isPile);
                } else if (info.type === ENTITY_TYPES.TERRAIN || info.type === ENTITY_TYPES.TRAP || info.type === ENTITY_TYPES.CMAP || info.type === ENTITY_TYPES.UNEXPLORED) {
                    return this.getTerrainKnowledge(identifier, options);
                }
            }
        }

        // 1.5. 文字列または型指定のないオブジェクトの場合のキー抽出とキーワード優先分岐
        let searchKey = '';
        if (typeof identifier === 'string') {
            searchKey = identifier;
        } else if (typeof identifier === 'object' && identifier !== null) {
            searchKey = identifier.name || identifier.label || identifier.str || identifier.rawText || identifier.id || '';
        }

        if (typeof searchKey === 'string' && searchKey.trim().length > 0) {
            const lowerKey = searchKey.toLowerCase();

            // 石像 (Statue) の優先判定
            if (lowerKey.includes('statue') || lowerKey.includes('石像') || lowerKey.includes('像')) {
                const statueData = this.getStatueKnowledge(identifier, options);
                if (statueData) return this._applyPileFlag(statueData, isPile);
            }

            // 死体 (Corpse/Body) の優先判定
            if (lowerKey.includes('corpse') || lowerKey.includes('死体')) {
                const corpseData = this.getCorpseKnowledge(identifier, options);
                if (corpseData) return this._applyPileFlag(corpseData, isPile);
            }
        }

        // 1. アイテムナレッジを最優先検索 (onum/辞書照合・未識別外見等)
        let data = this.getItemKnowledge(identifier, options);
        if (data) return this._applyPileFlag(data, isPile);

        // 2. 地形・仕掛けナレッジを検索 (Cmap/キーワード)
        data = this.getTerrainKnowledge(identifier, options);
        if (data) return data;

        // 3. モンスターナレッジを検索
        data = this.getMonsterKnowledge(identifier, options);
        if (data) return data;

        // 4. 未登録エンティティに対するスマートフォールバック (プレイヤー・一般モブ・容器等)
        if (typeof identifier === 'number') {
            const info = classifyGlyph(identifier);
            if (info) {
                if (info.type === ENTITY_TYPES.MONSTER || info.type === ENTITY_TYPES.PET) {
                    const rawObj = {
                        id: 'generic_monster',
                        name: 'Standard Dungeon Monster',
                        dangerLevel: 'MEDIUM',
                        stats: { hd: 1, ac: 10, speed: 12, mr: 0 },
                        effectSummary: 'Standard dungeon creature.'
                    };
                    return options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                } else if (info.type === ENTITY_TYPES.BODY) {
                    const rawObj = {
                        id: 'corpse',
                        name: 'Corpse',
                        category: 'BODY',
                        ...(isPile ? { isPile: true } : {}),
                        effectSummary: 'Monster corpse. Can be eaten with \'e\' for nutrition or resistances, but beware of taint/poison.'
                    };
                    const localized = options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                    return this._applyPileFlag(localized, isPile);
                } else if (info.type === ENTITY_TYPES.STATUE) {
                    const rawObj = {
                        id: 'statue',
                        name: 'Statue',
                        category: 'STATUE',
                        ...(isPile ? { isPile: true } : {}),
                        effectSummary: 'Stone statue. Pick up or break with Pick-axe / Wand of Striking.'
                    };
                    const localized = options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                    return this._applyPileFlag(localized, isPile);
                } else if (info.type === ENTITY_TYPES.ITEM) {
                    const onum = getOnumFromGlyph(identifier);
                    if (typeof onum === 'number' && onum >= 0) {
                        return this._applyPileFlag(this.getItemKnowledge(onum, options), isPile);
                    }
                    const rawObj = {
                        id: `item_glyph_${identifier}`,
                        name: 'Dungeon Item',
                        category: 'ITEM',
                        ...(isPile ? { isPile: true } : {}),
                        effectSummary: 'Standard dungeon item.'
                    };
                    const localized = options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                    return this._applyPileFlag(localized, isPile);
                }
            }
        }

        return null;
    }
}


