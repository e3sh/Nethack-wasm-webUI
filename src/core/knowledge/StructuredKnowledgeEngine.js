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
import { MONSTER_TILEMAP_NAMES, OBJECT_TILEMAP_NAMES } from './tilemappings_data.js';
import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';
import { ALL_MONSTER_KNOWLEDGE_BASE } from './MONSTER_KNOWLEDGE_FULL.js';
import { ItemIdentificationResolver, IDENTIFICATION_LEVELS } from './ItemIdentificationResolver.js';
import { OBJECT_CATEGORY_ADVICE, inferObjectCategory, OBJECT_CATEGORY_DEFINITIONS } from './OBJECT_CATEGORY_ADVICE.js';
import { ITEM_KNOWLEDGE_BASE } from './ITEM_KNOWLEDGE_BASE.js';
import { TERRAIN_KNOWLEDGE_MAP, getTerrainEntryByCmap, getTerrainEntryByKey } from './TERRAIN_KNOWLEDGE_BASE.js';
import { getAdaptiveMonsterSpecs, getMonsterSpecSummaryStrings } from './MonsterSpecPresenter.js';
import { MONSTER_CLASS_DEFINITIONS, getMonsterClassDefinition, getAllMonsterClassDefinitions } from './MONSTER_CLASS_KNOWLEDGE.js';
import { MonsterArmorRiskResolver } from './MonsterArmorRiskResolver.js';
import { ARTIFACT_KNOWLEDGE_BASE, getArtifactDefinition, getAllArtifactDefinitions } from './ARTIFACT_KNOWLEDGE_BASE.js';

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

        const cloned = JSON.parse(JSON.stringify(obj));
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

        // 🎯 2. 動的ステート（店主名、Look確定HP/状態、ペット、プレイヤー）のチェック
        const isPet = Boolean(options.isPet || (typeof identifier === 'object' && (identifier?.type === 'PET' || identifier?.isPet)) || (typeof identifier === 'number' && classifyGlyph(identifier)?.type === ENTITY_TYPES.PET));
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
        } else if (isPet) {
            dynamicResult.dangerLevel = 'SAFE';
            dynamicResult.dispositionStatus = 'TAMED';
        } else if (dynamicState && dynamicState.hasResult !== false && (dynamicState.isPeaceful || dynamicState.isTamed || dynamicState.isHostile)) {
            if (dynamicState.isPeaceful) {
                dynamicResult.dangerLevel = 'SAFE';
                dynamicResult.dispositionStatus = 'PEACEFUL';
            } else if (dynamicState.isTamed) {
                dynamicResult.dangerLevel = 'SAFE';
                dynamicResult.dispositionStatus = 'TAMED';
            } else if (dynamicState.isHostile) {
                dynamicResult.dangerLevel = found.hostileDangerLevel || found.dangerLevel || 'LETHAL';
                dynamicResult.dispositionStatus = 'HOSTILE';
            }
        } else if (found.defaultPeaceful || isShopkeeper) {
            dynamicResult.dangerLevel = 'SAFE';
            dynamicResult.dispositionStatus = 'DEFAULT_PEACEFUL';
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

        const rawObj = {
            id: `unidentified_${category.toLowerCase()}`,
            name: idRes.displayName || idRes.appearanceName || (typeof rawInput === 'string' ? rawInput : (rawInput.name || rawInput.str || 'Unidentified item')),
            category,
            isUnidentified: true,
            appearanceName: idRes.appearanceName,
            calledName: idRes.calledName,
            bucStatus: idRes.bucStatus,
            effectSummary: 'Unidentified item.',
            effectSummaryEn: 'Unidentified item.',
            unidentifiedTips: [],
            unidentifiedTipsEn: [],
            usageAdvice: [],
            usageAdviceEn: [],
            canBeUnidentified: true,
            identification: idRes
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
     * アイテム構造化ナレッジの取得 (onum を一次識別軸とし、数値/オブジェクト/文字列に対応)
     * @param {number|string|Object} identifier - onum, glyphId, Item Object, または Item Text
     * @param {Object} [options] 
     * @returns {Object|null} アイテムナレッジ
     */
    getItemKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        const shouldTranslate = options.translate !== false;
        const lang = options.language || this.language || 'ja';
        let cacheKey = null;
        if (shouldTranslate && !options.dynamicState) {
            if (typeof identifier === 'number' && !options.identification && !options.isUnidentified) {
                cacheKey = `${lang}_item_num_${identifier}`;
            } else if (typeof identifier === 'string') {
                cacheKey = `${lang}_item_str_${identifier}`;
            } else if (typeof identifier === 'object' && identifier !== null && !identifier.dynamicState) {
                const rawName = identifier.rawText || identifier.str || identifier.label || identifier.name || '';
                const onum = typeof identifier.onum === 'number' ? identifier.onum : -1;
                const isUnid = Boolean(identifier.isUnidentified || identifier.identification?.isUnidentified || options.isUnidentified || options.identification?.isUnidentified);
                if (rawName || onum >= 0) {
                    cacheKey = `${lang}_item_obj_${onum}_${rawName}_${isUnid ? '1' : '0'}`;
                }
            }
        }
        if (cacheKey && this.staticCache.has(cacheKey)) {
            return this.staticCache.get(cacheKey);
        }

        let found = null;
        let targetOnum = -1;
        let originalDisplayName = '';

        if (typeof identifier === 'object') {
            originalDisplayName = identifier.rawText || identifier.str || identifier.label || identifier.name || '';
        } else if (typeof identifier === 'string') {
            originalDisplayName = identifier;
        }

        // 1. オブジェクト指定 ({ onum, subType, glyph, rawGlyph, str, rawText, name, label })
        if (typeof identifier === 'object' && identifier !== null) {
            const rawName = identifier.label || identifier.rawText || identifier.str || identifier.name || '';
            if (rawName && this.isUnidentifiedAppearance(rawName)) {
                return this.getUnidentifiedItemKnowledge(rawName, options);
            }
            if (identifier.onum === 476 || identifier.subType === 476 || (identifier.name && identifier.name.toLowerCase() === 'statue')) {
                return this.getStatueKnowledge(identifier, options);
            }
            if (typeof identifier.onum === 'number' && identifier.onum >= 0) {
                targetOnum = identifier.onum;
            } else if (typeof identifier.subType === 'number' && identifier.subType >= 0 && identifier.subType < 500) {
                targetOnum = identifier.subType;
            } else if (typeof identifier.glyph === 'number' && identifier.glyph >= 0) {
                targetOnum = getOnumFromGlyph(identifier.glyph);
                if (targetOnum < 0 && identifier.glyph < 500) targetOnum = identifier.glyph;
            } else if (typeof identifier.rawGlyph === 'number' && identifier.rawGlyph >= 0) {
                targetOnum = getOnumFromGlyph(identifier.rawGlyph);
                if (targetOnum < 0 && identifier.rawGlyph < 500) targetOnum = identifier.rawGlyph;
            }
            if (targetOnum >= 0 && !identifier.isUnidentified && !options.identification && !options.isUnidentified) {
                return this.getItemKnowledge(targetOnum, { ...options, forceFullKnowledge: true });
            }
            if (targetOnum < 0) {
                const rawName = identifier.label || identifier.rawText || identifier.str || identifier.name || '';
                if (rawName) return this.getItemKnowledge(rawName, options);
            }
        }
        // 2. 数値指定 (onum または glyphId)
        else if (typeof identifier === 'number') {
            if (options.isOnum === true) {
                targetOnum = identifier;
            } else {
                // 統一 Glyph 検索: glyphId (例: 3448〜3928, 7992等) から onum 抽出
                targetOnum = getOnumFromGlyph(identifier);
                if (targetOnum < 0 && identifier >= 0 && identifier < 500) {
                    targetOnum = identifier; // 直接 onum フォールバック
                }
            }
        }
        // 3. 文字列指定 ("wand_of_digging" または インベントリ文章 "a - 2 uncursed rations of cram")
        else if (typeof identifier === 'string') {
            if (this.isUnidentifiedAppearance(identifier)) {
                return this.getUnidentifiedItemKnowledge(identifier, options);
            }

            const cleaned = this.cleanItemName(identifier);
            const cleanKey = cleaned.toLowerCase().replace(/\s+/g, '_');
            
            // 手動登録辞書から検索
            found = this.items.get(cleanKey) || 
                    this.items.get(cleaned.toLowerCase()) || 
                    this.items.get(identifier.trim().toLowerCase()) || null;

            // onum 逆引きテーブル (OBJECT_TILEMAP_NAMES) からのスラッシュ分割スマート逆引き検索！
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
            // 🕵️ DiscoveryStateManager による未識別床アイテムのネタバレ防止ガード
            // (床アイテムまたは明示的にネタバレ防止が要求されている場合のみ適用)
            if (this.discoveryStateManager && options.forceFullKnowledge !== true && (options.isFloorItem === true || typeof identifier === 'number')) {
                if (!this.discoveryStateManager.isIdentified(targetOnum)) {
                    const catStr = getCategoryFromOnum(targetOnum);
                    const randomizableCats = ['POTION', 'SCROLL', 'WAND', 'RING', 'AMULET', 'SPELLBOOK'];
                    if (randomizableCats.includes(catStr)) {
                        return this.getUnidentifiedItemKnowledge({ category: catStr, onum: targetOnum, name: originalDisplayName || `Unidentified ${catStr}` }, options);
                    }
                }
            }

            found = this.onumMap.get(targetOnum) || null;

            // onumMap に手動エントリーが未登録でも公式名前 & onum 範囲カテゴリから100%正確に生成！
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

        if (originalDisplayName && originalDisplayName.trim().length > 0) {
            found = {
                ...found,
                inventoryLabel: originalDisplayName
            };
        }

        const finalResult = shouldTranslate ? this.localizeKnowledge(found, options) : found;
        if (cacheKey && finalResult) {
            this.staticCache.set(cacheKey, finalResult);
        }
        return finalResult;
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
            if (typeof identifier.subType === 'number' && identifier.subType >= 0) {
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

        const isEn = (options.language || this.language) === 'en';
        const baseName = monKnowledge ? (isEn ? (monKnowledge.nameEn || monKnowledge.name) : monKnowledge.name) : (monOffset >= 0 ? `Monster ${monOffset}` : '');
        const corpseName = isEn ? (baseName ? `${baseName} corpse` : 'corpse') : (baseName ? `${baseName} の死体 (corpse)` : '死体 (corpse)');

        const corpseObj = {
            id: `corpse_${monOffset >= 0 ? monOffset : 'unknown'}`,
            name: corpseName,
            nameEn: baseName ? `${baseName} corpse` : 'corpse',
            category: 'CORPSE',
            canBeUnidentified: false,
            corpseInfo: monKnowledge?.corpseInfo || null,
            effectSummary: isEn ?
                (monKnowledge?.corpseInfo?.warningNote ? `Warning: ${monKnowledge.corpseInfo.warningNote}` : (baseName ? `Corpse of ${baseName}. Can be eaten or offered at an altar.` : 'Monster corpse. Can be eaten or offered at an altar.')) :
                (monKnowledge?.corpseInfo?.warningNote ? 
                    `食中毒・呪い警告: ${monKnowledge.corpseInfo.warningNote}` : 
                    (baseName ? `モンスター (${baseName}) の死体です。食料として食べるか、祭壇で捧げることができます。` : 'モンスターの死体です。食料として食べるか、祭壇で捧げることができます。'))
        };

        const shouldTranslate = options.translate !== false;
        return shouldTranslate ? this.localizeKnowledge(corpseObj, options) : corpseObj;
    }

    /**
     * 石像 (Statue) の構造化ナレッジ取得
     * @param {number|string|Object} identifier 
     * @param {Object} [options] 
     * @returns {Object|null} 石像ナレッジ
     */
    getStatueKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        let glyphId = -1;
        let monOffset = -1;
        let rawName = '';

        if (typeof identifier === 'object') {
            glyphId = typeof identifier.glyph === 'number' ? identifier.glyph : 
                      (typeof identifier.rawGlyph === 'number' ? identifier.rawGlyph :
                      (typeof identifier.glyphInfo?.glyph === 'number' ? identifier.glyphInfo.glyph : -1));
            rawName = identifier.name || identifier.str || identifier.rawText || identifier.label || '';

            // subType が 476 (アイテム番号) 以外の 0〜382 (モンスター番号) の場合のみ monOffset とする
            if (typeof identifier.subType === 'number' && identifier.subType >= 0 && identifier.subType < 383) {
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

        const isEn = (options.language || this.language) === 'en';
        const baseName = monKnowledge ? (isEn ? (monKnowledge.nameEn || monKnowledge.name) : monKnowledge.name) : (monOffset >= 0 ? `Monster ${monOffset}` : '');
        const statueName = isEn ? (baseName ? `statue of ${baseName}` : 'statue') : (baseName ? `${baseName} の像 (statue)` : '石像 (statue)');

        const statueObj = {
            id: `statue_${monOffset >= 0 ? monOffset : 'unknown'}`,
            name: statueName,
            nameEn: baseName ? `statue of ${baseName}` : 'statue',
            category: 'STATUE',
            canBeUnidentified: false,
            effectSummary: isEn ?
                (baseName ? `Statue of ${baseName}. Can be broken with pick-axe / wand of striking, or carried.` : 'Statue. Can be broken with pick-axe / wand of striking, or carried.') :
                (baseName ? 
                    `モンスター (${baseName}) の石像です。ツルハシ(#apply pick-axe)や打撃の杖(Wand of Striking)で破壊するか、持ち運ぶことができます。` :
                    `石像です。ツルハシ(#apply pick-axe)や打撃の杖(Wand of Striking)で破壊するか、持ち運ぶことができます。`)
        };

        const shouldTranslate = options.translate !== false;
        return shouldTranslate ? this.localizeKnowledge(statueObj, options) : statueObj;
    }

    /**
     * 万能統合ナレッジアクセサ (アイテム -> モンスター -> 地形 -> 汎用フォールバックの自動判定取得)
     * @param {number|string|Object} identifier 
     * @param {Object} [options] 
     * @returns {Object|null} 構造化ナレッジ
     */
    getKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        // 🎯 -1. すでに完成した構造化ナレッジオブジェクト (category 及び effectSummary を保持) の場合、二重検索で破壊せずにそのまま返却！
        if (typeof identifier === 'object' && identifier !== null && identifier.category && identifier.effectSummary) {
            return identifier;
        }

        // 🎯 0. オブジェクト型指定の場合、type プロパティ (BODY, STATUE, TERRAIN, MONSTER, ITEM) に基づき最優先で直撃分岐！
        if (typeof identifier === 'object' && identifier !== null) {
            if (identifier.type === 'BODY') {
                return this.getCorpseKnowledge(identifier, options);
            }
            if (identifier.type === 'STATUE' || identifier.subType === 476 || identifier.onum === 476 || (identifier.name && identifier.name.toLowerCase() === 'statue')) {
                return this.getStatueKnowledge(identifier, options);
            }
            if (identifier.type === 'TERRAIN' || identifier.type === 'UNEXPLORED') {
                return this.getTerrainKnowledge(identifier, options);
            }
            if (identifier.type === 'MONSTER' || identifier.type === 'PET') {
                return this.getMonsterKnowledge(identifier, options);
            }
            if (identifier.type === 'ITEM') {
                return this.getItemKnowledge(identifier, options);
            }
        }

        // 1. 数値 glyphId の場合、まず classifyGlyph でエンティティ種別を正確に物理統一検索！
        if (typeof identifier === 'number') {
            const info = classifyGlyph(identifier);
            if (info) {
                if (info.type === ENTITY_TYPES.MONSTER || info.type === ENTITY_TYPES.PET) {
                    return this.getMonsterKnowledge(identifier, options);
                } else if (info.type === ENTITY_TYPES.BODY) {
                    return this.getCorpseKnowledge(identifier, options);
                } else if (info.type === ENTITY_TYPES.STATUE) {
                    return this.getStatueKnowledge(identifier, options);
                } else if (info.type === ENTITY_TYPES.ITEM) {
                    return this.getItemKnowledge(identifier, options);
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
                if (statueData) return statueData;
            }

            // 死体 (Corpse/Body) の優先判定
            if (lowerKey.includes('corpse') || lowerKey.includes('死体')) {
                const corpseData = this.getCorpseKnowledge(identifier, options);
                if (corpseData) return corpseData;
            }
        }

        // 1. アイテムナレッジを最優先検索 (onum/辞書照合・未識別外見等)
        let data = this.getItemKnowledge(identifier, options);
        if (data) return data;

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
                        effectSummary: 'Monster corpse. Can be eaten with \'e\' for nutrition or resistances, but beware of taint/poison.'
                    };
                    return options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                } else if (info.type === ENTITY_TYPES.STATUE) {
                    const rawObj = {
                        id: 'statue',
                        name: 'Statue',
                        category: 'STATUE',
                        effectSummary: 'Stone statue. Pick up or break with Pick-axe / Wand of Striking.'
                    };
                    return options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                } else if (info.type === ENTITY_TYPES.ITEM) {
                    const onum = getOnumFromGlyph(identifier);
                    const itemName = (typeof onum === 'number' && onum >= 0 && OBJECT_TILEMAP_NAMES[onum]) ? OBJECT_TILEMAP_NAMES[onum] : 'Dungeon Item';
                    const categoryData = inferObjectCategory(itemName);

                    const rawObj = {
                        id: `item_${onum}`,
                        name: itemName,
                        category: categoryData.category,
                        effectSummary: categoryData.effectSummary
                    };
                    return options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                }
            }
        }

        return null;
    }
}


