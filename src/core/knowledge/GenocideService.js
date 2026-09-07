/**
 * GenocideService.js - NetHack 虐殺（Genocide）支援ナレッジサービス
 *
 * GKL (Game Knowledge Layer) の一部として、以下の機能を提供します：
 * 1. クラス虐殺（大文字シンボル）および単体虐殺の危険度別プリセットの提供
 * 2. プレイヤーの種族・職業に応じた「自己虐殺（Self-Genocide）即死セーフティガード」判定
 * 3. SSOTマスター（ALL_MONSTER_KNOWLEDGE_BASE & TranslationEngine）連携による動的カタログ・サジェスト検索
 * 4. クラスシンボルと所属モンスターの動的リレーション解決
 * 5. 無虐殺（none - コンダクト維持）のサポートと正規コマンド文字列生成
 */

import { ALL_MONSTER_KNOWLEDGE_BASE } from './MONSTER_KNOWLEDGE_FULL.js';
import { MONSTER_CLASS_DEFINITIONS, getMonsterClassDefinition, getAllMonsterClassDefinitions } from './MONSTER_CLASS_KNOWLEDGE.js';

export { MONSTER_CLASS_DEFINITIONS, getMonsterClassDefinition, getAllMonsterClassDefinitions };

/**
 * おすすめ虐殺プリセット（Class ＆ Single）
 */
export const GENOCIDE_PRESETS = [
    {
        id: 'class_lich',
        type: 'CLASS',
        target: 'L',
        labelJa: '【クラス】L : リッチ一族 (最優先)',
        labelEn: '[Class] L : Lich (Arch-Lich, Master Lich)',
        dangerLevel: 'CRITICAL',
        descriptionJa: '深層での召喚・即死・破壊魔法を根絶'
    },
    {
        id: 'class_cockatrice',
        type: 'CLASS',
        target: 'c',
        labelJa: '【クラス】c : コカトリス一族 (石化根絶)',
        labelEn: '[Class] c : Cockatrice (Cockatrice, Pyrolisk)',
        dangerLevel: 'CRITICAL',
        descriptionJa: 'うっかり触れたり踏んだりする石化即死事故を100%防止'
    },
    {
        id: 'class_mindflayer',
        type: 'CLASS',
        target: 'h',
        labelJa: '【クラス】h : 人型 / 触手一族 (※ドワーフ危険)',
        labelEn: '[Class] h : Humanoid / Mind Flayer',
        dangerLevel: 'CRITICAL',
        cautionRace: 'dwarf',
        descriptionJa: '知力吸引即死のマインドフレイヤを根絶（※自キャラがドワーフ時は即死）'
    },
    {
        id: 'class_sea_monster',
        type: 'CLASS',
        target: ';',
        labelJa: '【クラス】; : 海の怪物一族 (水没死防止)',
        labelEn: '[Class] ; : Sea monsters (Kraken, Eels)',
        dangerLevel: 'HIGH',
        descriptionJa: 'メデューサ島や水路での巻きつき即死・電気麻痺を根絶'
    },
    {
        id: 'class_demon',
        type: 'CLASS',
        target: '&',
        labelJa: '【クラス】& : 大悪魔一族 (魔界安定)',
        labelEn: '[Class] & : Major demons',
        dangerLevel: 'HIGH',
        descriptionJa: '地獄層でのデーモン召喚・激しい打撃を抑制'
    },
    {
        id: 'class_disenchanter',
        type: 'CLASS',
        target: 'R',
        labelJa: '【クラス】R : サビ怪物・ディスエンチャンター',
        labelEn: '[Class] R : Rust monster / Disenchanter',
        dangerLevel: 'HIGH',
        descriptionJa: '大切なアーティファクトや防具の強化値消失・腐食を防止'
    },
    {
        id: 'single_master_mind_flayer',
        type: 'SINGLE',
        target: 'master mind flayer',
        labelJa: '【単体】master mind flayer (マスターマインドフレイヤ)',
        labelEn: '[Single] master mind flayer',
        dangerLevel: 'CRITICAL',
        descriptionJa: '安全にドワーフでも虐殺可能。遠隔触手吸引の脅威を排除'
    },
    {
        id: 'single_mind_flayer',
        type: 'SINGLE',
        target: 'mind flayer',
        labelJa: '【単体】mind flayer (マインドフレイヤ)',
        labelEn: '[Single] mind flayer',
        dangerLevel: 'CRITICAL',
        descriptionJa: '脳みそ吸引即死の脅威を単体指定で安全に排除'
    },
    {
        id: 'single_arch_lich',
        type: 'SINGLE',
        target: 'arch-lich',
        labelJa: '【単体】arch-lich (アーチリッチ)',
        labelEn: '[Single] arch-lich',
        dangerLevel: 'CRITICAL',
        descriptionJa: '最凶アンデッドの単体虐殺'
    },
    {
        id: 'single_disenchanter',
        type: 'SINGLE',
        target: 'disenchanter',
        labelJa: '【単体】disenchanter (ディスエンチャンター)',
        labelEn: '[Single] disenchanter',
        dangerLevel: 'HIGH',
        descriptionJa: '武器・防具の強化値（+値）吸収を単体ピンポイントで根絶'
    }
];

export class GenocideService {
    /**
     * @param {Object} [options={}]
     * @param {Object} [options.translator] - WebUICore.TranslationEngine インスタンス
     * @param {'ja'|'en'} [options.language='ja'] - 言語設定
     */
    constructor(options = {}) {
        this.translator = options.translator || null;
        this.language = options.language || 'ja';
        this.classes = MONSTER_CLASS_DEFINITIONS;
        this.presets = GENOCIDE_PRESETS;
        this._catalog = null;
    }

    setLanguage(lang = 'ja') {
        this.language = (lang === 'en' || lang === 'english') ? 'en' : 'ja';
        this._catalog = null; // キャッシュクリア
    }

    setTranslator(translator) {
        this.translator = translator;
        this._catalog = null; // キャッシュクリア
    }

    /**
     * SSOTマスター（ALL_MONSTER_KNOWLEDGE_BASE）と TranslationEngine による動的カタログ構築
     */
    _buildMonsterCatalog() {
        const catalog = [];
        const seen = new Set();

        for (const mon of ALL_MONSTER_KNOWLEDGE_BASE) {
            const rawName = mon.name;
            if (!rawName) continue;
            const cleanName = rawName.replace(/\{[^}]+\}/g, '').trim();
            const lower = cleanName.toLowerCase();
            if (seen.has(lower)) continue;
            seen.add(lower);

            // SSOTマスター公式和名 (mon_jp.c) および TranslationEngine による解決
            let nameJa = mon.nameJa;
            if (!nameJa || nameJa === cleanName) {
                nameJa = this._translateMonsterName(cleanName) || this._translateMonsterName(rawName) || cleanName;
            }

            catalog.push({
                id: mon.id || `mon_${mon.monOffset}`,
                monOffset: mon.monOffset,
                name: cleanName,
                nameJa: nameJa,
                aliases: mon.aliases || [],
                symbol: mon.symbol || '?',
                className: mon.className || '',
                canGenocide: mon.canGenocide ?? true,
                isUnique: mon.isUnique ?? false,
                canPolymorph: mon.canPolymorph ?? true,
                dangerLevel: mon.dangerLevel || 'LOW',
                isDangerous: mon.dangerLevel === 'CRITICAL' || mon.dangerLevel === 'HIGH' || /lich|flayer|cockatrice|disenchanter|eel|kraken/i.test(cleanName)
            });
        }
        return catalog;
    }

    /**
     * モンスター一覧カタログ取得（キャッシュ付き、虐殺可能フィルタ可能）
     * @param {Object} [filter={}]
     * @param {string} [filter.symbol] - 特定クラス記号（例: 'L', 'h'）で絞り込み
     * @param {boolean} [filter.onlyGenocidable=true] - 虐殺可能なモンスターのみ抽出
     */
    getMonsterCatalog(filter = {}) {
        if (!this._catalog) {
            this._catalog = this._buildMonsterCatalog();
        }

        let list = this._catalog;
        if (filter.onlyGenocidable !== false) {
            list = list.filter(m => m.canGenocide);
        }
        if (filter.symbol) {
            list = list.filter(m => m.symbol === filter.symbol);
        }
        return list;
    }

    /**
     * おすすめ危険プリセット取得
     * @param {'CLASS'|'SINGLE'|'ALL'} type
     */
    getPresets(type = 'ALL') {
        if (type === 'CLASS') {
            return this.presets.filter(p => p.type === 'CLASS');
        } else if (type === 'SINGLE') {
            return this.presets.filter(p => p.type === 'SINGLE');
        }
        return this.presets;
    }

    /**
     * SSOTマスターから全クラスのモンスター所属関係を動的構築
     * @private
     */
    _buildClassCatalog() {
        const catalog = this.getMonsterCatalog({ onlyGenocidable: false });
        const classMap = new Map();

        for (const cls of this.classes) {
            classMap.set(cls.symbol, {
                ...cls,
                monsters: [],
                examples: [],
                examplesJa: [],
                count: 0
            });
        }

        for (const mon of catalog) {
            const sym = mon.symbol || '?';
            if (!classMap.has(sym)) {
                classMap.set(sym, {
                    symbol: sym,
                    nameEn: mon.className || sym,
                    nameJa: mon.className || sym,
                    danger: 'NORMAL',
                    monsters: [],
                    examples: [],
                    examplesJa: [],
                    count: 0
                });
            }

            const c = classMap.get(sym);
            c.monsters.push(mon);
            c.count++;
            if (c.examples.length < 4) {
                c.examples.push(mon.name);
                c.examplesJa.push(mon.nameJa || mon.name);
            }
            if (mon.dangerLevel === 'CRITICAL') {
                c.danger = 'CRITICAL';
            } else if (mon.dangerLevel === 'HIGH' && c.danger !== 'CRITICAL') {
                c.danger = 'HIGH';
            }
        }

        return Array.from(classMap.values());
    }

    /**
     * 全モンスタークラス定義取得（所属モンスター・代表例付き）
     */
    getMonsterClasses() {
        if (!this._enrichedClasses) {
            this._enrichedClasses = this._buildClassCatalog();
        }
        return this._enrichedClasses;
    }

    /**
     * クラス記号に属するモンスター一覧を取得
     * @param {string} symbol クラス記号 (e.g. 'L', 'c', 'h')
     */
    getMonstersBySymbol(symbol) {
        return this.getMonsterCatalog({ symbol, onlyGenocidable: false });
    }

    /**
     * 自己虐殺（Self-Genocide）リスク判定 ⚠️
     * プレイヤーの種族・ロールと照合し、即死ゲームオーバーの危険があるかを検証
     *
     * @param {string} targetStr 虐殺対象（シンボルまたはモンスター名）
     * @param {string} playerRace プレイヤー種族 (e.g. 'human', 'elf', 'dwarf', 'gnome', 'orc')
     * @param {string} playerRole プレイヤーロール (e.g. 'valkyrie', 'wizard', 'tourist')
     * @returns {{ isSelf: boolean, dangerLevel: 'LETHAL' | 'SAFE', reasonJa: string, reasonEn: string, matchedType: string | null }}
     */
    checkSelfGenocide(targetStr, playerRace = '', playerRole = '') {
        if (!targetStr) {
            return { isSelf: false, dangerLevel: 'SAFE', reasonJa: '', reasonEn: '', matchedType: null };
        }

        const clean = targetStr.trim();
        const lower = clean.toLowerCase();
        const race = (playerRace || '').toLowerCase().trim();
        const role = (playerRole || '').toLowerCase().trim();

        // 1. 特殊シンボル '@' (Human / Elf / プレイヤーシンボル)
        if (clean === '@' || lower === 'human' || lower === 'player') {
            if (race === 'human' || race === 'elf' || !race) {
                return {
                    isSelf: true,
                    dangerLevel: 'LETHAL',
                    reasonJa: '⚠️ 自身（人間 / エルフ）が虐殺対象です！ 実行すると即死ゲームオーバーになります！',
                    reasonEn: '⚠️ You (Human / Elf) are in this class! Choosing this causes immediate game over (Self-Genocide)!',
                    matchedType: 'RACE'
                };
            }
        }

        // 2. クラスシンボル 'h' (Humanoid) - ⚠️ ドワーフが即死
        if (clean === 'h' || lower === 'humanoid') {
            if (race === 'dwarf') {
                return {
                    isSelf: true,
                    dangerLevel: 'LETHAL',
                    reasonJa: '⚠️ ドワーフは「h (Humanoid)」クラスに含まれます！ 実行すると即死します！',
                    reasonEn: '⚠️ Dwarves belong to the humanoid (h) class! This causes immediate death!',
                    matchedType: 'RACE'
                };
            }
        }

        // 3. クラスシンボル 'o' (Orc) - ⚠️ オークが即死
        if (clean === 'o' || lower === 'orc') {
            if (race === 'orc') {
                return {
                    isSelf: true,
                    dangerLevel: 'LETHAL',
                    reasonJa: '⚠️ 自身の種族（オーク）です！ 実行すると即死します！',
                    reasonEn: '⚠️ You are an Orc! This causes immediate death!',
                    matchedType: 'RACE'
                };
            }
        }

        // 4. クラスシンボル 'G' (Gnome) - ⚠️ ノームが即死
        if (clean === 'G' || lower === 'gnome') {
            if (race === 'gnome') {
                return {
                    isSelf: true,
                    dangerLevel: 'LETHAL',
                    reasonJa: '⚠️ 自身の種族（ノーム）です！ 実行すると即死します！',
                    reasonEn: '⚠️ You are a Gnome! This causes immediate death!',
                    matchedType: 'RACE'
                };
            }
        }

        // 5. 単体指定での自種族完全一致
        if (race && lower === race) {
            return {
                isSelf: true,
                dangerLevel: 'LETHAL',
                reasonJa: `⚠️ 自身の種族（${playerRace}）そのものです！ 実行すると即死します！`,
                reasonEn: `⚠️ Target matches your race (${playerRace})! This causes immediate death!`,
                matchedType: 'RACE'
            };
        }

        // 6. 単体指定での自ロール（職業）完全一致
        if (role && (lower === role || (role === 'valkyrie' && lower.includes('valkyrie')))) {
            return {
                isSelf: true,
                dangerLevel: 'LETHAL',
                reasonJa: `⚠️ 自身の職業（${playerRole}）が虐殺対象です！ 実行すると即死します！`,
                reasonEn: `⚠️ Target matches your role (${playerRole})! This causes immediate death!`,
                matchedType: 'ROLE'
            };
        }

        return { isSelf: false, dangerLevel: 'SAFE', reasonJa: '', reasonEn: '', matchedType: null };
    }

    /**
     * 指定されたターゲットが危険（自己虐殺リスクまたは単体虐殺でのクラス記号指定無効）かを検証
     * @param {string} targetStr 虐殺対象（記号またはモンスター名）
     * @param {Object|string} [options={}] オプションまたは種族文字列
     * @param {string} [options.playerRace=''] プレイヤー種族
     * @param {string} [options.playerRole=''] プレイヤー職業
     * @param {'CLASS'|'SINGLE'|'ALL'} [options.mode='CLASS'] 虐殺モード
     * @returns {{ isDangerous: boolean, isSelf: boolean, dangerLevel: string, reasonJa: string, reasonEn: string } | null}
     */
    isDangerousGenocide(targetStr, options = {}) {
        if (!targetStr) return null;
        const race = typeof options === 'string' ? options : (options.playerRace || '');
        const role = typeof options === 'object' ? (options.playerRole || '') : '';
        const mode = typeof options === 'object' ? (options.mode || this.mode || 'CLASS') : (this.mode || 'CLASS');

        const clean = targetStr.trim();

        // 1. 単体虐殺モードで1文字のクラス記号が入力されている場合の警告
        if (mode === 'SINGLE' && clean.length === 1 && clean !== '?') {
            return {
                isDangerous: true,
                isSelf: false,
                dangerLevel: 'WARNING',
                reasonJa: '単体虐殺ではクラス記号（L, c 等）は無効です。具体的なモンスター名（例: master mind flayer）を入力または選択してください。',
                reasonEn: 'Class symbols cannot be genocided in Single mode. Specify an individual monster name (e.g. master mind flayer).'
            };
        }

        // 2. 自己虐殺（Self-Genocide）リスク判定
        const check = this.checkSelfGenocide(targetStr, race, role);
        if (check && check.isSelf) {
            return {
                isDangerous: true,
                isSelf: true,
                dangerLevel: check.dangerLevel,
                reasonJa: check.reasonJa,
                reasonEn: check.reasonEn
            };
        }

        return null;
    }

    /**
     * インテリジェント・サジェスト検索
     * クラス虐殺時は記号完全一致およびモンスター名からの逆引きを強力サポート
     *
     * @param {string} query 検索クエリ
     * @param {Object} options
     * @param {number} options.limit 最大件数 (default: 10)
     * @param {'ja'|'en'} options.lang 言語
     * @param {'CLASS'|'SINGLE'|'ALL'} options.mode 虐殺モード
     */
    suggest(query, options = {}) {
        if (!query || !query.trim()) return [];

        const rawQ = query.trim();
        const lowerQ = rawQ.toLowerCase();
        const limit = options.limit || 10;
        const mode = options.mode || 'ALL';
        const results = [];
        const seenTargets = new Set();

        const enrichedClasses = this.getMonsterClasses();
        const catalog = this.getMonsterCatalog({ onlyGenocidable: true });

        // =========================================================================
        // 1. クラス虐殺モード (mode === 'CLASS' または 'ALL')
        // =========================================================================
        if (mode !== 'SINGLE') {
            // A. 記号の完全一致（大文字小文字区別）を最優先
            const exactClass = enrichedClasses.find(c => c.symbol === rawQ);
            if (exactClass) {
                seenTargets.add(exactClass.symbol);
                results.push({
                    type: 'CLASS',
                    target: exactClass.symbol,
                    symbol: exactClass.symbol,
                    nameEn: exactClass.nameEn,
                    nameJa: exactClass.nameJa,
                    danger: exactClass.danger,
                    descJa: exactClass.descJa || (exactClass.examplesJa.length > 0 ? `例: ${exactClass.examplesJa.join(', ')}` : ''),
                    descEn: exactClass.descEn || (exactClass.examples.length > 0 ? `e.g. ${exactClass.examples.join(', ')}` : ''),
                    examples: exactClass.examples,
                    examplesJa: exactClass.examplesJa,
                    count: exactClass.count,
                    score: 100, // 最高優先度
                    isExact: true
                });
            }

            // B. 記号の大文字小文字違い一致（例: 'l' 入力で 'L'）
            if (rawQ.length === 1) {
                const caseInsensitiveClass = enrichedClasses.find(c => 
                    c.symbol !== rawQ && c.symbol.toLowerCase() === lowerQ
                );
                if (caseInsensitiveClass && !seenTargets.has(caseInsensitiveClass.symbol)) {
                    seenTargets.add(caseInsensitiveClass.symbol);
                    results.push({
                        type: 'CLASS',
                        target: caseInsensitiveClass.symbol,
                        symbol: caseInsensitiveClass.symbol,
                        nameEn: caseInsensitiveClass.nameEn,
                        nameJa: caseInsensitiveClass.nameJa,
                        danger: caseInsensitiveClass.danger,
                        descJa: caseInsensitiveClass.descJa || (caseInsensitiveClass.examplesJa.length > 0 ? `例: ${caseInsensitiveClass.examplesJa.join(', ')}` : ''),
                        descEn: caseInsensitiveClass.descEn || (caseInsensitiveClass.examples.length > 0 ? `e.g. ${caseInsensitiveClass.examples.join(', ')}` : ''),
                        examples: caseInsensitiveClass.examples,
                        examplesJa: caseInsensitiveClass.examplesJa,
                        count: caseInsensitiveClass.count,
                        score: 90,
                        isExact: false
                    });
                }
            }

            // C. モンスター名からの「クラス逆引き」検索 🎯
            // ユーザーが 'mind flayer' や 'リッチ' と入力した時、そのモンスターが属するクラス記号を提示
            const matchedClassSymbolsFromMonsters = new Map();
            for (const mon of catalog) {
                const matchEn = mon.name.toLowerCase().includes(lowerQ);
                const matchJa = mon.nameJa ? mon.nameJa.toLowerCase().includes(lowerQ) : false;
                if (matchEn || matchJa) {
                    const sym = mon.symbol;
                    if (!matchedClassSymbolsFromMonsters.has(sym)) {
                        matchedClassSymbolsFromMonsters.set(sym, []);
                    }
                    matchedClassSymbolsFromMonsters.get(sym).push(mon);
                }
            }

            for (const [sym, matchedMons] of matchedClassSymbolsFromMonsters.entries()) {
                if (!seenTargets.has(sym)) {
                    const cls = enrichedClasses.find(c => c.symbol === sym);
                    if (cls) {
                        seenTargets.add(sym);
                        const matchedNames = matchedMons.map(m => m.name).slice(0, 3).join(', ');
                        const matchedNamesJa = matchedMons.map(m => m.nameJa || m.name).slice(0, 3).join(', ');

                        results.push({
                            type: 'CLASS',
                            target: cls.symbol,
                            symbol: cls.symbol,
                            nameEn: cls.nameEn,
                            nameJa: cls.nameJa,
                            danger: cls.danger,
                            descJa: `【該当】${matchedNamesJa} が属するクラス`,
                            descEn: `[Matched] Class containing ${matchedNames}`,
                            examples: cls.examples,
                            examplesJa: cls.examplesJa,
                            count: cls.count,
                            score: 80,
                            isExact: false
                        });
                    }
                }
            }

            // D. クラス名・説明文による部分一致
            for (const cls of enrichedClasses) {
                if (seenTargets.has(cls.symbol)) continue;

                const matchNameEn = cls.nameEn.toLowerCase().includes(lowerQ);
                const matchNameJa = cls.nameJa.toLowerCase().includes(lowerQ);
                const matchDescJa = cls.descJa ? cls.descJa.toLowerCase().includes(lowerQ) : false;

                if (matchNameEn || matchNameJa || matchDescJa) {
                    seenTargets.add(cls.symbol);
                    results.push({
                        type: 'CLASS',
                        target: cls.symbol,
                        symbol: cls.symbol,
                        nameEn: cls.nameEn,
                        nameJa: cls.nameJa,
                        danger: cls.danger,
                        descJa: cls.descJa || (cls.examplesJa.length > 0 ? `例: ${cls.examplesJa.join(', ')}` : ''),
                        descEn: cls.descEn || (cls.examples.length > 0 ? `e.g. ${cls.examples.join(', ')}` : ''),
                        examples: cls.examples,
                        examplesJa: cls.examplesJa,
                        count: cls.count,
                        score: 70,
                        isExact: false
                    });
                }
            }
        }

        // =========================================================================
        // 2. 単体虐殺モード (mode === 'SINGLE' または 'ALL')
        // =========================================================================
        if (mode !== 'CLASS') {
            const isSingleChar = rawQ.length === 1;

            for (const mon of catalog) {
                if (seenTargets.has(mon.name)) continue;

                const nameEnLower = mon.name.toLowerCase();
                const nameJaLower = (mon.nameJa || '').toLowerCase();

                const exactEn = nameEnLower === lowerQ;
                const exactJa = nameJaLower === lowerQ;
                const startsWithEn = nameEnLower.startsWith(lowerQ);
                const startsWithJa = nameJaLower.startsWith(lowerQ);
                const matchEn = nameEnLower.includes(lowerQ);
                const matchJa = nameJaLower.includes(lowerQ);
                const matchSymbol = isSingleChar && (mon.symbol === rawQ || mon.symbol.toLowerCase() === lowerQ);

                const aliases = (mon.aliases || []).map(a => a.toLowerCase());
                const exactAlias = aliases.some(a => a === lowerQ);
                const startsWithAlias = aliases.some(a => a.startsWith(lowerQ));
                const matchAlias = aliases.some(a => a.includes(lowerQ));

                if (exactEn || exactJa || exactAlias) {
                    seenTargets.add(mon.name);
                    results.push({
                        type: 'SINGLE',
                        target: mon.name,
                        nameEn: mon.name,
                        nameJa: mon.nameJa,
                        symbol: mon.symbol,
                        danger: mon.isDangerous ? 'CRITICAL' : 'NORMAL',
                        score: 100,
                        isExact: true
                    });
                } else if (startsWithEn || startsWithJa || startsWithAlias) {
                    seenTargets.add(mon.name);
                    results.push({
                        type: 'SINGLE',
                        target: mon.name,
                        nameEn: mon.name,
                        nameJa: mon.nameJa,
                        symbol: mon.symbol,
                        danger: mon.isDangerous ? 'CRITICAL' : 'NORMAL',
                        score: 85,
                        isExact: false
                    });
                } else if (matchEn || matchJa || matchAlias) {
                    seenTargets.add(mon.name);
                    results.push({
                        type: 'SINGLE',
                        target: mon.name,
                        nameEn: mon.name,
                        nameJa: mon.nameJa,
                        symbol: mon.symbol,
                        danger: mon.isDangerous ? 'CRITICAL' : 'NORMAL',
                        score: 75,
                        isExact: false
                    });
                } else if (matchSymbol && isSingleChar) {
                    // 1文字記号一致（例: 'L' で lich一族）
                    seenTargets.add(mon.name);
                    results.push({
                        type: 'SINGLE',
                        target: mon.name,
                        nameEn: mon.name,
                        nameJa: mon.nameJa,
                        symbol: mon.symbol,
                        danger: mon.isDangerous ? 'CRITICAL' : 'NORMAL',
                        descJa: `クラス [${mon.symbol}] のモンスター`,
                        descEn: `Monster of class [${mon.symbol}]`,
                        score: 70,
                        isExact: false
                    });
                }
            }
        }

        // スコア降順ソート
        results.sort((a, b) => b.score - a.score);

        return results.slice(0, limit);
    }

    /**
     * モンスター名の多言語翻訳ヘルパー (SSOT)
     * @private
     */
    _translateMonsterName(enName) {
        if (!this.translator || !enName) return enName;
        if (typeof this.translator.translateMonster === 'function') {
            const tr = this.translator.translateMonster(enName);
            if (tr && tr !== enName) return tr;
        }
        if (typeof this.translator.t === 'function') {
            const tr = this.translator.t(enName);
            if (tr && tr !== enName) return tr;
        }
        if (typeof this.translator.translate === 'function') {
            const tr = this.translator.translate(enName, 'ja');
            if (tr && tr !== enName) return tr;
        }
        return enName;
    }

    /**
     * コマンド文字列の正規化出力
     * @param {string} target 入力・選択された対象（シンボル、モンスター名、none等）
     */
    serializeCommand(target) {
        if (!target) return 'none';
        const t = target.trim();
        if (t.toLowerCase() === 'none' || t.toLowerCase() === 'nothing') {
            return 'none';
        }
        return t;
    }
}
