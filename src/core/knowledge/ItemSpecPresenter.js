/**
 * ItemSpecPresenter.js
 * 
 * 構造化アイテムナレッジ (OBJECT_KNOWLEDGE_FULL) から
 * カテゴリ別（WEAPON, ARMOR, RING, AMULET, WAND, SPELLBOOK, SCROLL, FOOD, TOOL, GEM等）に
 * 最適化されたスペックバッジ一覧およびスキル適性バッジ（+マーク）を動的生成するプレゼンター。
 * 
 * 🧹 クリーン設計: 0, '0', null, 'none', undefined, false の無効値は完全自動除外。
 */

/**
 * アイテムナレッジおよびプレイヤースキル状態から適応型スペックバッジ配列を生成
 * @param {Object} knowledge - OBJECT_KNOWLEDGE_MAP のエントリまたはアイテムナレッジ
 * @param {Object} [options={}] - オプション
 * @param {Object} [options.skillStateManager] - SkillStateManager インスタンス
 * @param {boolean} [options.includeCommonPhysics=true] - 材質・重量の共通物理属性を含めるか
 * @returns {Array<{ id: string, label: string, labelJa: string, value: string, type: string, highlight?: boolean, skillBadge?: { id?: string, label?: string, isProficient?: boolean, isEnhanceable?: boolean, rankKey?: string, rankLabel?: string, [key: string]: any } | null, [key: string]: any }>}
 */
export function getAdaptiveItemSpecs(knowledge, options = {}) {
    const specs = [];
    if (!knowledge) return specs;

    const {
        skillStateManager = null,
        includeCommonPhysics = true
    } = options;

    const cat = knowledge.category || 'OTHER';
    const stats = knowledge.stats || {};

    // 1. ⚔️ 武器 (WEAPON)
    if (cat === 'WEAPON') {
        const sdam = knowledge.sdam || stats.sdam;
        const ldam = knowledge.ldam || stats.ldam;
        if (sdam && sdam !== '0') {
            specs.push({
                id: 'damage',
                label: 'Damage (S/L)',
                labelJa: '攻撃力 (小/大)',
                value: `${sdam} / ${ldam || sdam}`,
                type: 'weapon',
                highlight: true
            });
        }

        const hands = (knowledge.hands !== undefined) ? knowledge.hands : stats.hands;
        if (hands === 2) {
            specs.push({
                id: 'hands',
                label: 'Hands',
                labelJa: '持ち手',
                value: '両手持ち (2H)',
                type: 'warning',
                highlight: true
            });
        }

        const skill = knowledge.skill || stats.skill;
        if (skill && skill !== 'none') {
            const skillBadge = getSkillProficiencyBadge(knowledge, skillStateManager);
            specs.push({
                id: 'skill',
                label: 'Skill',
                labelJa: '武器スキル',
                value: skill,
                type: 'skill',
                skillBadge: skillBadge,
                highlight: !!skillBadge
            });
        }

        const hitBonus = (knowledge.hitBonus !== undefined) ? knowledge.hitBonus : stats.hitBonus;
        if (hitBonus && hitBonus > 0) {
            specs.push({
                id: 'hitBonus',
                label: 'Hit Bonus',
                labelJa: '命中補正',
                value: `+${hitBonus}`,
                type: 'weapon'
            });
        }
    }

    // 2. 🛡️ 防具 (ARMOR)
    else if (cat === 'ARMOR') {
        const ac = (knowledge.ac !== undefined && knowledge.ac !== null) ? knowledge.ac : stats.ac;
        const acBonus = (knowledge.acBonus !== undefined) ? knowledge.acBonus : (stats.acBonus !== undefined ? stats.acBonus : (ac !== undefined && ac !== null ? 10 - ac : 0));
        if (ac !== undefined && ac !== null) {
            specs.push({
                id: 'ac',
                label: 'Defense (AC)',
                labelJa: '防御力 (AC)',
                value: `+${acBonus} (AC ${ac})`,
                ac: ac,
                acBonus: acBonus,
                type: 'armor',
                highlight: true
            });
        }

        const mc = (knowledge.mc !== undefined && knowledge.mc !== null) ? knowledge.mc : stats.mc;
        if (mc > 0) {
            specs.push({
                id: 'mc',
                label: 'Magic Cancel',
                labelJa: '魔法防御 (MC)',
                value: `MC ${mc}`,
                type: 'armor',
                highlight: true
            });
        }

        const slot = knowledge.armorSlot || stats.armorSlot;
        if (slot) {
            const slotMapJa = {
                suit: '鎧 (Suit)',
                shield: '盾 (Shield)',
                helm: '兜 (Helm)',
                gloves: '小手 (Gloves)',
                boots: '靴 (Boots)',
                cloak: '外套 (Cloak)',
                shirt: 'シャツ (Shirt)'
            };
            specs.push({
                id: 'armorSlot',
                label: 'Slot',
                labelJa: '装着部位',
                value: slotMapJa[slot] || slot,
                type: 'armor'
            });
        }
    }

    // 3. 💍 装飾品 (RING / AMULET)
    else if (cat === 'RING' || cat === 'AMULET') {
        const cost = (knowledge.cost !== undefined) ? knowledge.cost : stats.cost;
        if (cost > 0) {
            specs.push({
                id: 'cost',
                label: 'Base Price',
                labelJa: '基本価格',
                value: `$${cost}`,
                type: 'accessory'
            });
        }
    }

    // 4. 🪄 杖 (WAND)
    else if (cat === 'WAND') {
        const zapType = knowledge.zapType || stats.zapType;
        if (zapType) {
            const zapTypeMapJa = {
                ray: '反射光線 (Ray)',
                beam: '直進ビーム (Beam)',
                nodir: '無指向 (NoDir)'
            };
            specs.push({
                id: 'zapType',
                label: 'Zap Type',
                labelJa: '射線種別',
                value: zapTypeMapJa[zapType.toLowerCase()] || zapType.toUpperCase(),
                type: 'wand',
                highlight: true
            });
        }
        if (knowledge.isCharged) {
            specs.push({
                id: 'charged',
                label: 'Charges',
                labelJa: '充填',
                value: 'チャージ式',
                type: 'wand'
            });
        }
    }

    // 5. 📖 魔法書 / 巻物 (SPELLBOOK / SCROLL)
    else if (cat === 'SPELLBOOK' || cat === 'SCROLL') {
        const spellLevel = knowledge.spellLevel || stats.spellLevel;
        if (spellLevel) {
            specs.push({
                id: 'spellLevel',
                label: 'Spell Level',
                labelJa: 'スペルレベル',
                value: `Lv.${spellLevel}`,
                type: 'spell',
                highlight: true
            });
        }

        const spellSkill = knowledge.spellSkill || stats.spellSkill;
        if (spellSkill && spellSkill !== 'none') {
            const skillBadge = getSkillProficiencyBadge({ skill: spellSkill }, skillStateManager);
            specs.push({
                id: 'spellSkill',
                label: 'School',
                labelJa: '魔法系統',
                value: spellSkill,
                type: 'spell',
                skillBadge: skillBadge,
                highlight: !!skillBadge
            });
        }

        const delay = (knowledge.delay !== undefined) ? knowledge.delay : stats.delay;
        if (delay > 0) {
            specs.push({
                id: 'delay',
                label: 'Reading Delay',
                labelJa: '読解ターン',
                value: `${delay} turns`,
                type: 'spell'
            });
        }
    }

    // 6. 🍖 食料 (FOOD)
    else if (cat === 'FOOD') {
        const nutrition = (knowledge.nutrition !== undefined) ? knowledge.nutrition : stats.nutrition;
        if (nutrition > 0) {
            specs.push({
                id: 'nutrition',
                label: 'Nutrition',
                labelJa: '栄養価',
                value: `${nutrition} nutr`,
                type: 'food',
                highlight: true
            });
        }

        const delay = (knowledge.delay !== undefined) ? knowledge.delay : stats.delay;
        if (delay > 0) {
            specs.push({
                id: 'delay',
                label: 'Eat Time',
                labelJa: '食事所要時間',
                value: `${delay} turns`,
                type: 'food'
            });
        }
    }

    // 7. 🎒 道具 (TOOL)
    else if (cat === 'TOOL') {
        if (knowledge.isKey) {
            specs.push({ id: 'featureKey', label: 'Key', labelJa: '機能', value: '解錠可能 (Key)', type: 'tool', highlight: true });
        }
        if (knowledge.isPickAxe) {
            specs.push({ id: 'featureDig', label: 'Dig', labelJa: '機能', value: '壁掘削 (Dig)', type: 'tool', highlight: true });
        }
        if (knowledge.isCanOpener) {
            specs.push({ id: 'featureCan', label: 'Tin', labelJa: '機能', value: '缶切り (Can Opener)', type: 'tool', highlight: true });
        }
        if (knowledge.isTouchstone) {
            specs.push({ id: 'featureTouch', label: 'Identify', labelJa: '機能', value: '宝石鑑定 (Touchstone)', type: 'tool', highlight: true });
        }
        if (knowledge.isContainer || knowledge.isBox || knowledge.isBag) {
            specs.push({ id: 'featureContainer', label: 'Container', labelJa: '種別', value: '収納容器 (Container)', type: 'tool', highlight: true });
        }
    }

    // 8. 💎 宝石 / 鉱石 (GEM / ROCK)
    else if (cat === 'GEM' || cat === 'ROCK') {
        const cost = (knowledge.cost !== undefined) ? knowledge.cost : stats.cost;
        if (cost > 0) {
            specs.push({
                id: 'cost',
                label: 'Price',
                labelJa: '価値/価格',
                value: `$${cost}`,
                type: 'gem',
                highlight: true
            });
        }
    }

    // ⚡ 付与耐性・固有能力 (全カテゴリ共通: 防具・指輪・魔よけ・ポーション等)
    const propConveyed = knowledge.propConveyed || stats.propConveyed;
    if (propConveyed) {
        const propMapJa = {
            FIRE_RES: '火炎耐性 (Fire)',
            COLD_RES: '冷気耐性 (Cold)',
            SHOCK_RES: '電撃耐性 (Shock)',
            DISINT_RES: '分解耐性 (Disint)',
            SLEEP_RES: '睡眠耐性 (Sleep)',
            POISON_RES: '毒耐性 (Poison)',
            DRAIN_RES: 'ドレイン耐性 (Drain)',
            STONE_RES: '石化耐性 (Stone)',
            UNCHANGING: '不変/変身防止 (Unchanging)',
            REFLECTING: '反射 (Reflection)',
            INVIS: '透明化 (Invis)',
            SEE_INVIS: '不可視視認 (See Invis)',
            TELEPORT: 'テレポート (Teleport)',
            TELEPORT_CNTRL: 'テレポート制御 (Tele Control)',
            REGENERATION: '自己再生 (Regen)',
            WARNING: '危険察知 (Warning)',
            SLOW_DIGESTION: '空腹遅延 (Slow Digest)',
            FREE_ACTION: '麻痺無効/自由行動 (Free Action)',
            STEALTH: '隠密 (Stealth)',
            LEVITATION: '浮遊 (Levitation)',
            FAST: '倍速/加速 (Speed)',
            INFRAVISION: '赤外線暗視 (Infravision)',
            SEARCHING: '自動探索 (Searching)',
            CLAIRVOYANT: '透視 (Clairvoyance)',
            ANTIMAGIC: '魔法耐性 (Magic Resist)'
        };
        specs.push({
            id: 'propConveyed',
            label: 'Conveys',
            labelJa: '付与能力',
            value: propMapJa[propConveyed] || propConveyed,
            type: 'magic',
            highlight: true
        });
    }

    // 🧱 共通物理属性 (材質・重量)
    if (includeCommonPhysics) {
        const material = (knowledge.material && knowledge.material !== 'none') ? knowledge.material : (stats.material && stats.material !== 'none' ? stats.material : null);
        if (material) {
            specs.push({
                id: 'material',
                label: 'Material',
                labelJa: '材質',
                value: material,
                type: 'physics'
            });
        }

        const weight = (knowledge.weight !== undefined && knowledge.weight > 0) ? knowledge.weight : (stats.weight && stats.weight > 0 ? stats.weight : null);
        if (weight !== null && weight !== undefined) {
            specs.push({
                id: 'weight',
                label: 'Weight',
                labelJa: '重量',
                value: `${weight} wt`,
                type: 'physics'
            });
        }
    }

    return specs;
}

/**
 * プレイヤーのスキル熟練度（SkillStateManager）とアイテムの適合バッジ（+マーク）を判定
 * @param {Object} knowledge - アイテムナレッジ
 * @param {Object} skillStateManager - SkillStateManager インスタンス
 * @returns {{ label: string, labelJa: string, rankKey: string, score: number, isProficient: true } | null}
 */
export function getSkillProficiencyBadge(knowledge, skillStateManager) {
    if (!knowledge || !skillStateManager) return null;

    const skillName = knowledge.skill || (knowledge.stats && knowledge.stats.skill) || null;
    if (!skillName || skillName === 'none') return null;

    if (typeof skillStateManager.getSkillRank !== 'function') return null;

    const rank = skillStateManager.getSkillRank(skillName);
    if (!rank || !rank.key) return null;

    // Basic (入門) 以上の習得済みスキルをプラス対象とする
    if (rank.key === 'basic' || rank.key === 'skilled' || rank.key === 'expert' || rank.key === 'master' || rank.key === 'grandmaster') {
        return {
            label: `+ ${rank.en || rank.label}`,
            labelJa: `+ ${rank.label}`,
            rankKey: rank.key,
            score: rank.score || 10,
            isProficient: true
        };
    }

    return null;
}
