/**
 * AttributeStateManager.js
 * 
 * 全25種類の属性耐性・固有能力 (Intrinsics & Extrinsics) を管理・キャッシュし、
 * 内因性（^X コマンドからのパースやメッセージ検知）と外因性（装備品からの耐性付与）を統合して
 * 実効耐性 (Effective Resistances) を提供するマネージャー。
 */

export const ATTRIBUTE_KEYS = [
    // 1. 基本元素耐性 (4種)
    'fire',
    'cold',
    'shock',
    'disint',

    // 2. 生体・状態・即死耐性 (5種)
    'sleep',
    'poison',
    'drain',
    'death',
    'stoning',

    // 3. 精神・感覚耐性 (2種)
    'conf',
    'hallu',

    // 4. 特殊保護・能力 (7種)
    'reflect',
    'invis',
    'seeInvis',
    'teleport',
    'teleportControl',
    'regen',
    'warning',

    // 5. 身体能力・行動・代謝属性 (7種)
    'slowDigest',
    'freeAction',
    'stealth',
    'levitation',
    'fast',
    'infravision',
    'searching'
];

export const ATTRIBUTE_DEFINITIONS = [
    { key: 'fire', label: '🔥火炎', en: 'Fire Resistance' },
    { key: 'cold', label: '❄️冷気', en: 'Cold Resistance' },
    { key: 'shock', label: '⚡電撃', en: 'Shock Resistance' },
    { key: 'disint', label: '💥分解', en: 'Disintegration Resistance' },
    { key: 'sleep', label: '💤睡眠', en: 'Sleep Resistance' },
    { key: 'poison', label: '🧪毒', en: 'Poison Resistance' },
    { key: 'drain', label: '🩸ドレイン', en: 'Drain Resistance' },
    { key: 'death', label: '💀即死', en: 'Death Resistance' },
    { key: 'stoning', label: '🗿石化', en: 'Stoning Resistance' },
    { key: 'conf', label: '💫混乱', en: 'Confusion Resistance' },
    { key: 'hallu', label: '🌀幻覚', en: 'Hallucination Resistance' },
    { key: 'reflect', label: '🛡️反射', en: 'Reflection' },
    { key: 'invis', label: '👻透明', en: 'Invisibility' },
    { key: 'seeInvis', label: '👁️可視', en: 'See Invisible' },
    { key: 'teleport', label: '🔮テレポ', en: 'Teleportation' },
    { key: 'teleportControl', label: '🎯テレポ制御', en: 'Teleport Control' },
    { key: 'regen', label: '💖再生', en: 'Regeneration' },
    { key: 'warning', label: '⚠️警戒', en: 'Warning' },
    { key: 'slowDigest', label: '🍖腹減りにくい', en: 'Slow Digestion' },
    { key: 'freeAction', label: '🤸自由行動', en: 'Free Action' },
    { key: 'stealth', label: '👟隠密', en: 'Stealth' },
    { key: 'levitation', label: '🪶浮遊', en: 'Levitation' },
    { key: 'fast', label: '⚡倍速', en: 'Fast / Speed' },
    { key: 'infravision', label: '🌙暗視', en: 'Infravision' },
    { key: 'searching', label: '🔍探索', en: 'Searching' }
];

export class AttributeStateManager {
    constructor(options = {}) {
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
     * キャッシュのリセット
     */
    reset() {
        this.intrinsics = this._createEmptyMap();
        this.extrinsics = this._createEmptyMap();
        this.isSynced = false;
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
     * 属性・耐性の統合オブジェクトを取得
     * @returns {Object}
     */
    getAttributes() {
        return {
            effectiveResistances: this.getEffectiveResistances(),
            intrinsics: { ...this.intrinsics },
            extrinsics: { ...this.extrinsics },
            isSynced: this.isSynced
        };
    }

    /**
     * ^X (#attributes) コマンドなどのテキスト行から内因性耐性をパースして更新
     * @param {Array<string>} lines 
     */
    updateFromIntrinsicsLines(lines) {
        if (!Array.isArray(lines) || lines.length === 0) return;

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

        this.intrinsics = newIntrinsics;
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
            if (title.includes('attribute') || title.includes('耐性') || title.includes('属性') || title.includes('能力')) return true;

            const lines = item.lines || (typeof item.text === 'string' ? item.text.split('\n') : []);
            if (lines.length > 0) {
                const combined = lines.join(' ').toLowerCase();
                if (combined.includes('you are ') || combined.includes('you have ') || combined.includes('you can ') ||
                    combined.includes('耐性がある') || combined.includes('能力がある') || combined.includes('attributes')) {
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
                    const str = mi.rawStr || mi.str || mi.text || (typeof mi === 'string' ? mi : '');
                    if (str) allLines.push(str);
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
            if (combined.includes('regeneration') || combined.includes('ring of regeneration')) {
                newExtrinsics.regen = true;
            }
            if (combined.includes('warning') || combined.includes('ring of warning') || combined.includes('helm of warning')) {
                newExtrinsics.warning = true;
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
            if (combined.includes('infravision') || combined.includes('ring of infravision')) {
                newExtrinsics.infravision = true;
            }
            if (combined.includes('searching') || combined.includes('ring of searching') || combined.includes('helm of brilliance')) {
                newExtrinsics.searching = true;
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
            this.intrinsics.fire = true;
            changed = true;
        }
        if (lower.includes('feel a cold chill') || lower.includes('冷気に対する耐性')) {
            this.intrinsics.cold = true;
            changed = true;
        }
        if (lower.includes('feel a mild shock') || lower.includes('電撃に対する耐性')) {
            this.intrinsics.shock = true;
            changed = true;
        }
        if (lower.includes('feel wide awake') || lower.includes('眠気')) {
            this.intrinsics.sleep = true;
            changed = true;
        }
        if (lower.includes('feel healthy') || lower.includes('毒に対する耐性')) {
            this.intrinsics.poison = true;
            changed = true;
        }
        if (lower.includes('feel very sneaky') || lower.includes('忍び')) {
            this.intrinsics.stealth = true;
            changed = true;
        }
        if (lower.includes('feel perceptive') || lower.includes('探知')) {
            this.intrinsics.searching = true;
            changed = true;
        }
        if (lower.includes('feel quick') || lower.includes('すばや')) {
            this.intrinsics.fast = true;
            changed = true;
        }
        if (lower.includes('feel in control of yourself') || lower.includes('制御')) {
            this.intrinsics.teleportControl = true;
            changed = true;
        }
        if (lower.includes('feel sensitive') || lower.includes('敏感')) {
            this.intrinsics.warning = true;
            changed = true;
        }

        return changed;
    }
}
