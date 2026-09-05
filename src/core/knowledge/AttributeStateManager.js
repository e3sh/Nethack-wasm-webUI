/**
 * AttributeStateManager.js
 * 
 * 全25種類の属性耐性・固有能力 (Intrinsics & Extrinsics) を管理・キャッシュし、
 * 内因性（^X コマンドからのパースやメッセージ検知）と外因性（装備品からの耐性付与）を統合して
 * 実効耐性 (Effective Resistances) を提供するマネージャー。
 */

import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';

import { calculateInnateResistances, parseAttributesLine, RACE_KNOWLEDGE_MAP, ROLE_KNOWLEDGE_MAP } from './CHARACTER_KNOWLEDGE_BASE.js';

export const ATTRIBUTE_KEYS = [
    // 1. 基本元素耐性 (5種)
    'fire',
    'cold',
    'shock',
    'disint',
    'acid',

    // 2. 生体・状態・即死耐性 (6種)
    'sleep',
    'poison',
    'drain',
    'death',
    'stoning',
    'antimagic',

    // 3. 精神・感覚耐性 (2種)
    'conf',
    'hallu',

    // 4. 特殊保護・能力 (11種)
    'reflect',
    'protection',
    'invis',
    'seeInvis',
    'teleport',
    'teleportControl',
    'polymorph',
    'polymorphControl',
    'regen',
    'warning',
    'lifesaved',

    // 5. 身体能力・行動・代謝属性 (12種)
    'slowDigest',
    'freeAction',
    'stealth',
    'levitation',
    'fast',
    'wwalking',
    'jumping',
    'magicalBreathing',
    'infravision',
    'searching',
    'telepat',
    'clairvoyant',
    'displaced',
    'fixedAbil'
];

export const ATTRIBUTE_DEFINITIONS = [
    { key: 'fire', label: '🔥火炎', en: 'Fire Resistance' },
    { key: 'cold', label: '❄️冷気', en: 'Cold Resistance' },
    { key: 'shock', label: '⚡電撃', en: 'Shock Resistance' },
    { key: 'disint', label: '💥分解', en: 'Disintegration Resistance' },
    { key: 'acid', label: '🧪耐酸', en: 'Acid Resistance' },
    { key: 'sleep', label: '💤睡眠', en: 'Sleep Resistance' },
    { key: 'poison', label: '🧪毒', en: 'Poison Resistance' },
    { key: 'drain', label: '🩸ドレイン', en: 'Drain Resistance' },
    { key: 'death', label: '💀即死', en: 'Death Resistance' },
    { key: 'stoning', label: '🗿石化', en: 'Stoning Resistance' },
    { key: 'antimagic', label: '🔮耐魔', en: 'Magic Resistance' },
    { key: 'conf', label: '💫混乱', en: 'Confusion Resistance' },
    { key: 'hallu', label: '🌀幻覚', en: 'Hallucination Resistance' },
    { key: 'reflect', label: '🛡️反射', en: 'Reflection' },
    { key: 'protection', label: '✨加護', en: 'Protection' },
    { key: 'invis', label: '👻透明', en: 'Invisibility' },
    { key: 'seeInvis', label: '👁️可視', en: 'See Invisible' },
    { key: 'teleport', label: '🔮テレポ', en: 'Teleportation' },
    { key: 'teleportControl', label: '🎯テレポ制御', en: 'Teleport Control' },
    { key: 'polymorph', label: '🌀変化', en: 'Polymorph' },
    { key: 'polymorphControl', label: '🎯変化制御', en: 'Polymorph Control' },
    { key: 'regen', label: '💖再生', en: 'Regeneration' },
    { key: 'warning', label: '⚠️警戒', en: 'Warning' },
    { key: 'lifesaved', label: '💖救命', en: 'Life Saving' },
    { key: 'slowDigest', label: '🍖腹減りにくい', en: 'Slow Digestion' },
    { key: 'freeAction', label: '🤸自由行動', en: 'Free Action' },
    { key: 'stealth', label: '👟隠密', en: 'Stealth' },
    { key: 'levitation', label: '🪶浮遊', en: 'Levitation' },
    { key: 'fast', label: '⚡倍速', en: 'Fast / Speed' },
    { key: 'wwalking', label: '🌊水上歩行', en: 'Water Walking' },
    { key: 'jumping', label: '🦘跳躍', en: 'Jumping' },
    { key: 'magicalBreathing', label: '🫧水中呼吸', en: 'Magical Breathing' },
    { key: 'infravision', label: '🌙暗視', en: 'Infravision' },
    { key: 'searching', label: '🔍探索', en: 'Searching' },
    { key: 'telepat', label: '🧠テレパシー', en: 'Telepathy (ESP)' },
    { key: 'clairvoyant', label: '🔮透視', en: 'Clairvoyance' },
    { key: 'displaced', label: '👥幻影', en: 'Displacement' },
    { key: 'fixedAbil', label: '🔒能力維持', en: 'Sustain Ability' }
];

export class AttributeStateManager {
    constructor(options = {}) {
        this.characterInfo = { race: 'human', role: 'archeologist', level: 1 };
        this.innate = this._createEmptyMap();
        this.acquiredIntrinsics = this._createEmptyMap();
        this.intrinsics = this._createEmptyMap();
        this.extrinsics = this._createEmptyMap();
        this.isSynced = false;
    }

    _createEmptyMap() {
        const map = {};
        for (const k of ATTRIBUTE_KEYS) {
            map[k] = false;
        }
        return map;
    }

    /**
     * 内在耐性の再集計 (innate + acquiredIntrinsics)
     * @private
     */
    _recalculateIntrinsics() {
        for (const k of ATTRIBUTE_KEYS) {
            this.intrinsics[k] = Boolean(this.innate[k] || this.acquiredIntrinsics[k]);
        }
    }

    /**
     * キャッシュのリセット
     */
    reset() {
        this.characterInfo = { race: 'human', role: 'archeologist', level: 1, gender: 'male' };
        this.innate = this._createEmptyMap();
        this.acquiredIntrinsics = this._createEmptyMap();
        this.intrinsics = this._createEmptyMap();
        this.extrinsics = this._createEmptyMap();
        this.isSynced = false;
    }

    /**
     * キャラクター情報（種族・職業・レベル・性別）の確定値から決定論的に内在耐性を即時計算・復元
     * NetHack Cソース attrib.c に基づく SSOT モデル
     * @param {Object} charInfo 
     * @param {string} [charInfo.race] 
     * @param {string} [charInfo.role] 
     * @param {number} [charInfo.level] 
     * @param {string} [charInfo.gender]
     * @returns {boolean} 
     */
    updateCharacter(charInfo = {}) {
        if (!charInfo || typeof charInfo !== 'object') return false;

        if (charInfo.race !== undefined) this.characterInfo.race = charInfo.race;
        if (charInfo.role !== undefined) this.characterInfo.role = charInfo.role;
        if (charInfo.level !== undefined) this.characterInfo.level = charInfo.level;
        if (charInfo.gender !== undefined) this.characterInfo.gender = charInfo.gender;

        const newInnateMap = calculateInnateResistances(this.characterInfo);
        const newInnate = this._createEmptyMap();
        for (const [k, v] of Object.entries(newInnateMap)) {
            if (newInnate[k] !== undefined) {
                newInnate[k] = Boolean(v);
            }
        }

        this.innate = newInnate;
        this._recalculateIntrinsics();
        if (charInfo.race !== undefined || charInfo.role !== undefined) {
            this.isSynced = true;
        }
        return true;
    }

    /**
     * 内因性耐性 (Intrinsics) と 外因性耐性 (Extrinsics) を合成した実効耐性 (Effective Resistances) を取得
     * @returns {Object<string, boolean>}
     */
    getEffectiveResistances() {
        const effective = {};
        for (const k of ATTRIBUTE_KEYS) {
            effective[k] = Boolean(this.intrinsics[k] || this.extrinsics[k]);
        }
        return effective;
    }

    /**
     * 現在有効な耐性・能力の一覧をUI描画用オブジェクト配列として取得
     * @param {'ja'|'en'} [language='ja']
     * @returns {Array<{ key: string, id: string, label: string, en: string, name: string, isIntrinsic: boolean, isExtrinsic: boolean, source: string }>}
     */
    getActiveResistances(language = 'ja') {
        const isEn = (language === 'en');
        const effective = this.getEffectiveResistances();
        const defMap = new Map(ATTRIBUTE_DEFINITIONS.map(d => [d.key, d]));
        const list = [];

        for (const [k, val] of Object.entries(effective)) {
            if (val) {
                const def = defMap.get(k) || { key: k, label: k, en: k };
                const isIntrinsic = Boolean(this.intrinsics[k]);
                const isExtrinsic = Boolean(this.extrinsics[k]);
                let source = 'intrinsic';
                if (isIntrinsic && isExtrinsic) source = 'both';
                else if (isExtrinsic) source = 'extrinsic';

                list.push({
                    key: k,
                    id: k,
                    label: def.label,
                    en: def.en,
                    name: isEn ? def.en : def.label,
                    isIntrinsic,
                    isExtrinsic,
                    source
                });
            }
        }
        return list;
    }

    /**
     * キャラクター情報（種族・職業・レベル・性別）のローカライズ済みサマリーを取得
     * @param {'ja'|'en'} [language='ja']
     * @returns {Object} { race, role, gender, level, raceName, roleName, raceNameJa, raceNameEn, roleNameJa, roleNameEn, displayTag, displayTagJa, displayTagEn }
     */
    getCharacterSummary(language = 'ja') {
        const isEn = (language === 'en');
        const charInfo = this.characterInfo || {};
        const race = charInfo.race || '';
        const role = charInfo.role || '';
        const gender = charInfo.gender || 'male';
        const isFemale = (gender === 'female');
        const level = typeof charInfo.level === 'number' ? charInfo.level : 1;

        const raceData = race ? RACE_KNOWLEDGE_MAP[race.toLowerCase()] : null;
        const roleData = role ? ROLE_KNOWLEDGE_MAP[role.toLowerCase()] : null;

        const raceNameJa = raceData?.nameJa || race || '不明';
        const raceNameEn = raceData?.name || race || 'Unknown';

        const roleNameJa = (isFemale && roleData?.nameFemaleJa) || roleData?.nameJa || role || '不明';
        const roleNameEn = (isFemale && roleData?.nameFemale) || roleData?.name || role || 'Unknown';

        const raceName = isEn ? raceNameEn : raceNameJa;
        const roleName = isEn ? roleNameEn : roleNameJa;
        const lvlStr = level ? ` Lv.${level}` : '';

        const displayTagJa = `👤 ${raceNameJa} / ${roleNameJa}${lvlStr}`;
        const displayTagEn = `👤 ${raceNameEn} / ${roleNameEn}${lvlStr}`;
        const displayTag = isEn ? displayTagEn : displayTagJa;

        return {
            race,
            role,
            gender,
            level,
            raceName,
            roleName,
            raceNameJa,
            raceNameEn,
            roleNameJa,
            roleNameEn,
            displayTag,
            displayTagJa,
            displayTagEn
        };
    }

    /**
     * 属性・耐性の統合オブジェクトを取得
     * @param {'ja'|'en'} [language='ja']
     * @returns {Object}
     */
    getAttributes(language = 'ja') {
        return {
            effectiveResistances: this.getEffectiveResistances(),
            activeResistances: this.getActiveResistances(language),
            characterSummary: this.getCharacterSummary(language),
            intrinsics: { ...this.intrinsics },
            innate: { ...this.innate },
            acquiredIntrinsics: { ...this.acquiredIntrinsics },
            extrinsics: { ...this.extrinsics },
            characterInfo: { ...this.characterInfo },
            isSynced: this.isSynced
        };
    }

    /**
     * ^X (#attributes) コマンドなどのテキスト行から内因性耐性をパースして更新
     * @param {Array<string>} lines 
     */
    updateFromIntrinsicsLines(lines) {
        if (!Array.isArray(lines) || lines.length === 0) return;

        // 0. ^X 出力行からキャラクター情報（種族・職業・レベル等）を自動抽出して確定耐性を再計算
        let detectedChar = null;
        for (const line of lines) {
            if (typeof line !== 'string') continue;
            const parsed = parseAttributesLine(line);
            if (parsed) {
                detectedChar = { ...detectedChar, ...parsed };
                if (detectedChar.race && detectedChar.role) {
                    break;
                }
            }
        }
        if (detectedChar && (detectedChar.race || detectedChar.role || detectedChar.level)) {
            this.updateCharacter(detectedChar);
        }

        const newIntrinsics = this._createEmptyMap();

        for (const line of lines) {
            if (typeof line !== 'string') continue;
            const text = line.toLowerCase();

            // 1. 基本元素耐性
            if (text.includes('fire resist') || text.includes('fire-resist') || text.includes('火炎に対する耐性') || text.includes('火炎耐性')) {
                newIntrinsics.fire = true;
            }
            if (text.includes('cold resist') || text.includes('cold-resist') || text.includes('冷気に対する耐性') || text.includes('冷気耐性')) {
                newIntrinsics.cold = true;
            }
            if (text.includes('shock resist') || text.includes('shock-resist') || text.includes('電撃に対する耐性') || text.includes('電撃耐性')) {
                newIntrinsics.shock = true;
            }
            if (text.includes('disintegrat') || text.includes('分解に対する耐性') || text.includes('分解耐性')) {
                newIntrinsics.disint = true;
            }

            // 2. 生体・状態・即死耐性
            if (text.includes('sleep resist') || text.includes('sleep-resist') || text.includes('睡眠に対する耐性') || text.includes('睡眠耐性')) {
                newIntrinsics.sleep = true;
            }
            if (text.includes('poison resist') || text.includes('poison-resist') || text.includes('毒に対する耐性') || text.includes('毒耐性')) {
                newIntrinsics.poison = true;
            }
            if (text.includes('drain resist') || text.includes('level-drain') || text.includes('エナジードレイン') || text.includes('ドレイン耐性')) {
                newIntrinsics.drain = true;
            }
            if (text.includes('death resist') || text.includes('死の魔法') || text.includes('即死耐性')) {
                newIntrinsics.death = true;
            }
            if (text.includes('stoning resist') || text.includes('petrif') || text.includes('石化耐性') || text.includes('石化に対する耐性')) {
                newIntrinsics.stoning = true;
            }

            // 3. 精神・感覚耐性
            if (text.includes('confusion resist') || text.includes('混乱耐性') || text.includes('混乱に対する耐性')) {
                newIntrinsics.conf = true;
            }
            if (text.includes('hallucination resist') || text.includes('幻覚耐性') || text.includes('幻覚に対する耐性')) {
                newIntrinsics.hallu = true;
            }

            // 4. 特殊保護・能力
            if (text.includes('reflect') || text.includes('反射能力') || text.includes('反射')) {
                newIntrinsics.reflect = true;
            }
            if (text.includes('invisible') || text.includes('invisibility') || text.includes('姿が見えない') || text.includes('透明')) {
                newIntrinsics.invis = true;
            }
            if (text.includes('see invisible') || text.includes('不可視のものを視認') || text.includes('不可視視認') || text.includes('透明視')) {
                newIntrinsics.seeInvis = true;
            }
            if (text.includes('teleporting') || text.includes('teleportation') || text.includes('テレポート能力')) {
                newIntrinsics.teleport = true;
            }
            if (text.includes('teleport control') || text.includes('テレポート制御')) {
                newIntrinsics.teleportControl = true;
            }
            if (text.includes('regenerat') || text.includes('自己再生') || text.includes('再生能力')) {
                newIntrinsics.regen = true;
            }
            if (text.includes('warning') || text.includes('warned') || text.includes('危険察知') || text.includes('警告能力') || text.includes('警戒')) {
                newIntrinsics.warning = true;
            }

            // 5. 身体能力・行動・代謝属性
            if (text.includes('slow digest') || text.includes('slowly digest') || text.includes('腹が減りにくい') || text.includes('空腹遅延')) {
                newIntrinsics.slowDigest = true;
            }
            if (text.includes('free action') || text.includes('free of action') || text.includes('自由行動') || text.includes('麻痺しない')) {
                newIntrinsics.freeAction = true;
            }
            if (text.includes('stealth') || text.includes('隠密')) {
                newIntrinsics.stealth = true;
            }
            if (text.includes('levitat') || text.includes('浮遊能力') || text.includes('空中浮遊')) {
                newIntrinsics.levitation = true;
            }
            if (text.includes('fast') || text.includes('speed') || text.includes('高速行動') || text.includes('倍速')) {
                newIntrinsics.fast = true;
            }
            if (text.includes('infravision') || text.includes('暗視') || text.includes('赤外線暗視')) {
                newIntrinsics.infravision = true;
            }
            if (text.includes('searching') || text.includes('探索能力') || text.includes('自動探索')) {
                newIntrinsics.searching = true;
            }
        }

        for (const k of ATTRIBUTE_KEYS) {
            if (newIntrinsics[k]) {
                this.acquiredIntrinsics[k] = true;
            }
        }

        this._recalculateIntrinsics();
        this.isSynced = true;
    }

    /**
     * バッファが属性・耐性一覧のものであるか判定
     * @param {Array<Object>} sequenceBuffer 
     * @returns {boolean}
     */
    isAttributeBuffer(sequenceBuffer) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) return false;

        for (const item of sequenceBuffer) {
            if (!item) continue;
            const title = (item.title || item.prompt || '').toLowerCase();
            if (title.includes('attribute')) return true;

            const lines = item.lines ? [...item.lines] : (typeof item.text === 'string' ? item.text.split('\n') : []);
            if (item.menuItems || item.items) {
                const items = item.menuItems || item.items;
                items.forEach(mi => {
                    const str = mi.rawStr || mi.str || mi.text || (typeof mi === 'string' ? mi : '');
                    if (str) lines.push(str);
                });
            }

            if (lines.length > 0) {
                const combined = lines.join(' ').toLowerCase();
                if (combined.includes('you are ') || combined.includes('you were ') || combined.includes('you have ') || combined.includes('you can ') || combined.includes('attributes')) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * シーケンスバッファから属性・耐性テキストを抽出して更新
     * @param {Array<Object>} sequenceBuffer 
     * @param {boolean} [force=false]
     */
    updateFromSequenceBuffer(sequenceBuffer, force = false) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) return;
        if (!force && !this.isAttributeBuffer(sequenceBuffer)) return;

        const allLines = [];
        for (const item of sequenceBuffer) {
            if (!item) continue;
            if (item.lines) {
                allLines.push(...item.lines);
            } else if (typeof item.text === 'string') {
                allLines.push(...item.text.split('\n'));
            } else if (item.menuItems || item.items) {
                const items = item.menuItems || item.items;
                items.forEach(mi => {
                    const raw = mi.rawStr || mi.str || mi.text || (typeof mi === 'string' ? mi : '');
                    if (raw) allLines.push(raw);
                });
            }
        }

        if (allLines.length > 0) {
            this.updateFromIntrinsicsLines(allLines);
        }
    }

    /**
     * 所持品リスト（InventoryStateManager.items）から装備中のアイテムを走査し、
     * 装備による外因性耐性 (Extrinsics) を自動計算・更新
     * @param {Array<Object>} inventoryItems 
     */
    updateExtrinsicsFromInventory(inventoryItems) {
        if (!Array.isArray(inventoryItems)) {
            this.extrinsics = this._createEmptyMap();
            return;
        }

        const newExtrinsics = this._createEmptyMap();

        inventoryItems.forEach(item => {
            if (!item) return;

            // 装備中（身につけている・装備中・両手・指輪・アミュレット等）か判定
            const isEquipped = Boolean(
                item.isWorn || item.isWielded || item.isQuivered ||
                item.isAlternate || item.isSecondary ||
                item.isWornLeft || item.isWornRight || item.isAmulet ||
                item.isHelmet || item.isGloves || item.isBoots || item.isCloak || item.isArmor || item.isShield
            );

            if (!isEquipped) {
                // rawText の末尾に (being worn) や (on left hand) や (weapon in hand) がある場合も装備中とみなす
                const raw = (item.rawText || '').toLowerCase();
                const hasEquipTag = raw.includes('(being worn') || raw.includes('(embedded') ||
                                   raw.includes('(in hand') || raw.includes('(weapon in ') ||
                                   raw.includes('(on left ') || raw.includes('(on right ') ||
                                   raw.includes('(alternate') || raw.includes('(wielded');
                if (!hasEquipTag) return;
            }

            // 🎯 1. 構造化ナレッジ (Single Source of Truth: propConveyed) による確定判定
            const onum = typeof item.onum === 'number' ? item.onum : -1;
            const knowledge = item.knowledge || (onum >= 0 ? OBJECT_KNOWLEDGE_MAP.get(onum) : null);
            const prop = (knowledge && knowledge.propConveyed) || (knowledge && knowledge.stats && knowledge.stats.propConveyed) || null;

            if (prop) {
                switch (prop) {
                    case 'FIRE_RES': newExtrinsics.fire = true; break;
                    case 'COLD_RES': newExtrinsics.cold = true; break;
                    case 'SHOCK_RES': newExtrinsics.shock = true; break;
                    case 'DISINT_RES': newExtrinsics.disint = true; break;
                    case 'ACID_RES': newExtrinsics.acid = true; break;
                    case 'SLEEP_RES': newExtrinsics.sleep = true; break;
                    case 'POISON_RES': newExtrinsics.poison = true; break;
                    case 'DRAIN_RES': newExtrinsics.drain = true; break;
                    case 'STONE_RES': newExtrinsics.stoning = true; break;
                    case 'UNCHANGING': newExtrinsics.stoning = true; break;
                    case 'ANTIMAGIC': newExtrinsics.antimagic = true; break;
                    case 'CONFUSION': newExtrinsics.conf = true; break;
                    case 'HALLUC': newExtrinsics.hallu = true; break;
                    case 'REFLECTING': newExtrinsics.reflect = true; break;
                    case 'PROTECTION': newExtrinsics.protection = true; break;
                    case 'INVIS': newExtrinsics.invis = true; break;
                    case 'SEE_INVIS': newExtrinsics.seeInvis = true; break;
                    case 'TELEPORT': newExtrinsics.teleport = true; break;
                    case 'TELEPORT_CONTROL':
                    case 'TELEPORT_CNTRL': newExtrinsics.teleportControl = true; break;
                    case 'POLYMORPH': newExtrinsics.polymorph = true; break;
                    case 'POLYMORPH_CONTROL': newExtrinsics.polymorphControl = true; break;
                    case 'REGENERATION': newExtrinsics.regen = true; break;
                    case 'WARNING': newExtrinsics.warning = true; break;
                    case 'LIFESAVED': newExtrinsics.lifesaved = true; break;
                    case 'SLOW_DIGESTION': newExtrinsics.slowDigest = true; break;
                    case 'FREE_ACTION': newExtrinsics.freeAction = true; break;
                    case 'STEALTH': newExtrinsics.stealth = true; break;
                    case 'LEVITATION': newExtrinsics.levitation = true; break;
                    case 'FAST': newExtrinsics.fast = true; break;
                    case 'WWALKING': newExtrinsics.wwalking = true; break;
                    case 'JUMPING': newExtrinsics.jumping = true; break;
                    case 'MAGICAL_BREATHING': newExtrinsics.magicalBreathing = true; break;
                    case 'INFRAVISION': newExtrinsics.infravision = true; break;
                    case 'SEARCHING': newExtrinsics.searching = true; break;
                    case 'TELEPAT': newExtrinsics.telepat = true; break;
                    case 'CLAIRVOYANT': newExtrinsics.clairvoyant = true; break;
                    case 'DISPLACED': newExtrinsics.displaced = true; break;
                    case 'FIXED_ABIL': newExtrinsics.fixedAbil = true; break;
                }
            }

            // 🎯 2. テキストフォールバック（アーティファクト、未識別、特殊装備用）
            const rawText = (item.rawText || '').toLowerCase();
            const itemName = (item.name || '').toLowerCase();
            const combined = `${rawText} ${itemName}`;

            // --- 1. 基本元素耐性 ---
            if (combined.includes('fire resistance') || combined.includes('red dragon')) {
                newExtrinsics.fire = true;
            }
            if (combined.includes('cold resistance') || combined.includes('white dragon')) {
                newExtrinsics.cold = true;
            }
            if (combined.includes('shock resistance') || combined.includes('blue dragon')) {
                newExtrinsics.shock = true;
            }
            if (combined.includes('disintegration') || combined.includes('black dragon')) {
                newExtrinsics.disint = true;
            }

            // --- 2. 生体・状態・即死耐性 ---
            if (combined.includes('sleep resistance') || combined.includes('orange dragon')) {
                newExtrinsics.sleep = true;
            }
            if (combined.includes('poison resistance') || combined.includes('green dragon') || combined.includes('amulet versus poison')) {
                newExtrinsics.poison = true;
            }
            if (combined.includes('drain resistance') || combined.includes('drain')) {
                newExtrinsics.drain = true;
            }
            if (combined.includes('death resistance')) {
                newExtrinsics.death = true;
            }
            if (combined.includes('amulet of unchanging') || combined.includes('unchanging')) {
                newExtrinsics.stoning = true;
            }

            // --- 3. 精神・感覚耐性 ---
            if (combined.includes('confusion resistance')) {
                newExtrinsics.conf = true;
            }
            if (combined.includes('hallucination resistance')) {
                newExtrinsics.hallu = true;
            }

            // --- 4. 特殊保護・能力 ---
            if (combined.includes('reflection') || combined.includes('shield of reflection') || combined.includes('silver dragon')) {
                newExtrinsics.reflect = true;
            }
            if (combined.includes('cloak of protection') || combined.includes('ring of protection')) {
                newExtrinsics.protection = true;
            }
            if (combined.includes('cloak of magic resistance') || combined.includes('magic resistance') || combined.includes('gray dragon')) {
                newExtrinsics.antimagic = true;
            }
            if (combined.includes('invisibility') || combined.includes('cloak of invisibility') || combined.includes('ring of invisibility')) {
                newExtrinsics.invis = true;
            }
            if (combined.includes('see invisible') || combined.includes('ring of see invisible')) {
                newExtrinsics.seeInvis = true;
            }
            if (combined.includes('ring of teleportation') || combined.includes('teleportation')) {
                newExtrinsics.teleport = true;
            }
            if (combined.includes('teleport control') || combined.includes('ring of teleport control')) {
                newExtrinsics.teleportControl = true;
            }
            if (combined.includes('polymorph control') || combined.includes('ring of polymorph control')) {
                newExtrinsics.polymorphControl = true;
            }
            if (combined.includes('ring of polymorph')) {
                newExtrinsics.polymorph = true;
            }
            if (combined.includes('regeneration') || combined.includes('ring of regeneration')) {
                newExtrinsics.regen = true;
            }
            if (combined.includes('warning') || combined.includes('ring of warning') || combined.includes('helm of warning')) {
                newExtrinsics.warning = true;
            }
            if (combined.includes('amulet of life saving') || combined.includes('life saving')) {
                newExtrinsics.lifesaved = true;
            }

            // --- 5. 身体能力・行動・代謝属性 ---
            if (combined.includes('slow digestion') || combined.includes('ring of slow digestion')) {
                newExtrinsics.slowDigest = true;
            }
            if (combined.includes('free action') || combined.includes('ring of free action')) {
                newExtrinsics.freeAction = true;
            }
            if (combined.includes('stealth') || combined.includes('ring of stealth') || combined.includes('boots of elvenkind') || combined.includes('cloak of elvenkind')) {
                newExtrinsics.stealth = true;
            }
            if (combined.includes('levitation') || combined.includes('ring of levitation') || combined.includes('levitation boots')) {
                newExtrinsics.levitation = true;
            }
            if (combined.includes('speed boots') || combined.includes('increase speed') || combined.includes('boots of speed')) {
                newExtrinsics.fast = true;
            }
            if (combined.includes('water walking') || combined.includes('water walking boots')) {
                newExtrinsics.wwalking = true;
            }
            if (combined.includes('jumping') || combined.includes('jumping boots')) {
                newExtrinsics.jumping = true;
            }
            if (combined.includes('magical breathing') || combined.includes('amulet of magical breathing')) {
                newExtrinsics.magicalBreathing = true;
            }
            if (combined.includes('infravision') || combined.includes('ring of infravision')) {
                newExtrinsics.infravision = true;
            }
            if (combined.includes('searching') || combined.includes('ring of searching') || combined.includes('helm of brilliance')) {
                newExtrinsics.searching = true;
            }
            if (combined.includes('telepathy') || combined.includes('helm of telepathy') || combined.includes('amulet of ESP')) {
                newExtrinsics.telepat = true;
            }
            if (combined.includes('clairvoyance') || combined.includes('cornuthaum')) {
                newExtrinsics.clairvoyant = true;
            }
            if (combined.includes('cloak of displacement') || combined.includes('displacement')) {
                newExtrinsics.displaced = true;
            }
            if (combined.includes('ring of sustain ability')) {
                newExtrinsics.fixedAbil = true;
            }
        });

        this.extrinsics = newExtrinsics;
    }

    /**
     * メッセージテキストからの動的更新・検知
     * @param {string} text 
     * @returns {boolean} 更新があったかどうか
     */
    updateFromMessage(text) {
        if (!text || typeof text !== 'string') return false;

        const lower = text.toLowerCase();
        let changed = false;

        // 耐性獲得メッセージ
        if (lower.includes('feel a hot sensation') || lower.includes('feel very hot') || lower.includes('火に対する耐性')) {
            this.acquiredIntrinsics.fire = true;
            changed = true;
        }
        if (lower.includes('feel a cold chill') || lower.includes('冷気に対する耐性')) {
            this.acquiredIntrinsics.cold = true;
            changed = true;
        }
        if (lower.includes('feel a mild shock') || lower.includes('電撃に対する耐性')) {
            this.acquiredIntrinsics.shock = true;
            changed = true;
        }
        if (lower.includes('feel wide awake') || lower.includes('眠気')) {
            this.acquiredIntrinsics.sleep = true;
            changed = true;
        }
        if (lower.includes('feel healthy') || lower.includes('毒に対する耐性')) {
            this.acquiredIntrinsics.poison = true;
            changed = true;
        }
        if (lower.includes('feel very sneaky') || lower.includes('忍び')) {
            this.acquiredIntrinsics.stealth = true;
            changed = true;
        }
        if (lower.includes('feel perceptive') || lower.includes('探知')) {
            this.acquiredIntrinsics.searching = true;
            changed = true;
        }
        if (lower.includes('feel quick') || lower.includes('すばや')) {
            this.acquiredIntrinsics.fast = true;
            changed = true;
        }
        if (lower.includes('feel in control of yourself') || lower.includes('制御')) {
            this.acquiredIntrinsics.teleportControl = true;
            changed = true;
        }
        if (lower.includes('feel sensitive') || lower.includes('敏感')) {
            this.acquiredIntrinsics.warning = true;
            changed = true;
        }

        if (changed) {
            this._recalculateIntrinsics();
        }

        return changed;
    }
}
