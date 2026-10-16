/**
 * ItemSpecPresenter.js
 * 
 * 構造化アイテムナレッジ (OBJECT_KNOWLEDGE_FULL) から
 * カテゴリ別（WEAPON, ARMOR, RING, AMULET, WAND, SPELLBOOK, SCROLL, FOOD, TOOL, GEM等）に
 * 最適化されたスペックバッジ一覧およびスキル適性バッジ（+マーク）を動的生成するプレゼンター。
 * 
 * 🧹 クリーン設計: 0, '0', null, 'none', undefined, false の無効値は完全自動除外。
 */

import { EquipmentDependencyAnalyzer } from "../equipment/EquipmentDependencyAnalyzer.js";
import { MONSTER_KNOWLEDGE_MAP } from "../data/MONSTER_KNOWLEDGE_FULL.js";

/**
 * アイテムナレッジおよびプレイヤースキル状態から適応型スペックバッジ配列を生成
 * @param {Object} knowledge - OBJECT_KNOWLEDGE_MAP のエントリまたはアイテムナレッジ
 * @param {Object} [options={}] - オプション
 * @param {Object} [options.skillStateManager] - SkillStateManager インスタンス
 * @param {boolean} [options.includeCommonPhysics=true] - 材質・重量の共通物理属性を含めるか
 * @param {'ja'|'en'} [options.language='ja'] - 表示言語
 * @param {Object} [options.dependencyReport] - EquipmentDependencyReport
 * @param {Array<Object>|Object} [options.inventory] - インベントリ情報
 * @param {Object} [options.item] - 対象アイテム
 * @returns {Array<{ id: string, label: string, value: string, type: string, highlight?: boolean, skillBadge?: { id?: string, label?: string, isProficient?: boolean, isEnhanceable?: boolean, rankKey?: string, rankLabel?: string, [key: string]: any } | null, [key: string]: any }>}
 */
export function getAdaptiveItemSpecs(knowledge, options = {}) {
    const specs = [];
    if (!knowledge) return specs;

    const {
        skillStateManager = null,
        includeCommonPhysics = true,
        language = (knowledge && knowledge.language) || 'ja'
    } = options;

    const isEn = (language === 'en');
    const cat = knowledge.category || 'OTHER';
    const stats = knowledge.stats || {};
    const identification = options.identification || knowledge.identification || null;
    const isWisdomRevealed = Boolean(options.isWisdomRevealed || knowledge.isWisdomRevealed || options.sagesWisdomMode);
    const directObj = options.directObject || options.item?.directObject || knowledge.directObject || null;
    const item = options.item || null;
    const flags = directObj?.flags || item?.flags || knowledge.flags || {};

    const isUnidentified = Boolean(
        !isWisdomRevealed && (
            knowledge.isUnidentified ||
            (identification && identification.isUnidentified)
        )
    );

    const quan = (directObj && typeof directObj.quan === 'number')
        ? directObj.quan
        : ((item && typeof item.quan === 'number') ? item.quan : knowledge.quan);

    const spe = (directObj && typeof directObj.spe === 'number')
        ? directObj.spe
        : ((item && typeof item.spe === 'number') ? item.spe : knowledge.spe);

    const corpsenm = (directObj && typeof directObj.corpsenm === 'number')
        ? directObj.corpsenm
        : ((item && typeof item.corpsenm === 'number') ? item.corpsenm : knowledge.corpsenm);

    const extraPileCount = (typeof options.extraPileCount === 'number')
        ? options.extraPileCount
        : ((typeof directObj?.extraPileCount === 'number')
            ? directObj.extraPileCount
            : ((typeof knowledge.extraPileCount === 'number')
                ? knowledge.extraPileCount
                : ((typeof item?.extraPileCount === 'number') ? item.extraPileCount : 0)));

    const isPile = Boolean(options.isPile || directObj?.isPile || knowledge.isPile || item?.isPile || extraPileCount > 0);

    let bucRaw = (directObj && directObj.bucStatus)
        || (item && item.bucStatus)
        || (directObj && directObj.blessed ? 'BLESSED' : (directObj && directObj.cursed ? 'CURSED' : null))
        || (item && item.blessed ? 'BLESSED' : (item && item.cursed ? 'CURSED' : null))
        || knowledge.bucStatus
        || (identification && identification.bucStatus);

    if (isWisdomRevealed && (!bucRaw || bucRaw === 'UNKNOWN') && flags) {
        if (flags.blessed) bucRaw = 'BLESSED';
        else if (flags.cursed) bucRaw = 'CURSED';
        else bucRaw = 'UNCURSED';
    }

    // 🕵️ 未識別アイテム (UNIDENTIFIED) かつ非Peek時の適応型バッジ＆マスク表示
    if (isUnidentified) {
        specs.push({
            id: 'identification_status',
            label: isEn ? 'Status' : '識別状態',
            value: isEn ? 'Unidentified' : '未識別 (Unidentified)',
            type: 'warning',
            highlight: true
        });

        const appearance = knowledge.appearanceName || (identification && identification.appearanceName);
        if (appearance) {
            specs.push({
                id: 'appearance',
                label: isEn ? 'Appearance' : '外見',
                value: appearance,
                type: 'info'
            });
        }

        const called = knowledge.calledName || (identification && identification.calledName);
        if (called) {
            specs.push({
                id: 'calledName',
                label: isEn ? 'Called' : '仮名',
                value: called,
                type: 'info',
                highlight: true
            });
        }

        if (bucRaw && bucRaw !== 'UNKNOWN' && (flags.bknown || !directObj)) {
            const bucJaMap = { BLESSED: '祝福 (Blessed)', UNCURSED: '通常 (Uncursed)', CURSED: '呪い (Cursed)' };
            const bucEnMap = { BLESSED: 'Blessed', UNCURSED: 'Uncursed', CURSED: 'Cursed' };
            specs.push({
                id: 'bucStatus',
                label: 'BUC',
                value: isEn ? (bucEnMap[bucRaw] || bucRaw) : (bucJaMap[bucRaw] || bucRaw),
                type: bucRaw === 'CURSED' ? 'warning' : 'magic',
                highlight: true
            });
        }

        if (typeof quan === 'number' && quan > 1) {
            specs.push({
                id: 'quantity',
                label: isEn ? 'Quantity' : '個数',
                value: isEn ? `${quan}x` : `${quan}個`,
                type: 'info',
                quan: quan
            });
        }

        if (isPile) {
            specs.push({
                id: 'pile_count',
                label: isEn ? 'Pile' : '山積み',
                value: extraPileCount > 0
                    ? (isEn ? `+${extraPileCount} beneath` : `下に +${extraPileCount} 個`)
                    : (isEn ? '+ beneath' : '下に複数アイテム'),
                type: 'info',
                highlight: true,
                extraPileCount
            });
        }

        if (typeof corpsenm === 'number' && corpsenm >= 0) {
            const mon = MONSTER_KNOWLEDGE_MAP.get(corpsenm);
            const monName = isEn
                ? (mon?.name || `Monster #${corpsenm}`)
                : (mon?.nameJa || mon?.name || `モンスター #${corpsenm}`);
            specs.push({
                id: 'corpse_monster',
                label: isEn ? 'Creature' : '対象生物',
                value: monName,
                type: 'monster',
                corpsenm: corpsenm,
                highlight: true
            });
        }

        // 未識別カテゴリ別マスク表示
        if (cat === 'WEAPON') {
            specs.push({
                id: 'damage',
                label: isEn ? 'Damage (S/L)' : '攻撃力 (小/大)',
                value: isEn ? '? / ? (Unidentified)' : '? / ? (未鑑定)',
                type: 'weapon'
            });
        } else if (cat === 'ARMOR') {
            specs.push({
                id: 'ac',
                label: isEn ? 'Defense (AC)' : '防御力 (AC)',
                value: isEn ? '+? (Unidentified)' : '+? (未鑑定)',
                type: 'armor'
            });
        } else if (cat === 'WAND') {
            specs.push({
                id: 'charges',
                label: isEn ? 'Charges' : '残チャージ',
                value: '(? charges)',
                type: 'magic'
            });
        }

        // 鑑定ヒント
        const tips = knowledge.unidentifiedTips || (identification && identification.identificationTips) || [];
        if (Array.isArray(tips) && tips.length > 0) {
            specs.push({
                id: 'idTip',
                label: isEn ? 'Test Tip' : '鑑定ヒント',
                value: tips[0],
                type: 'info'
            });
        }

        return specs;
    }

    // 🌟 識別済みまたは Peek Wisdom 開示時の個体スペック (BUC, 数量, 対象モンスター, 強化値, 箱, 劣化, 山積み)
    const isUnidItem = Boolean(
        knowledge.isUnidentified ||
        (identification && identification.isUnidentified) ||
        (directObj && directObj.flags && directObj.flags.dknown === false)
    );

    // 🧙 賢者の知恵（Peek Wisdom）透視時: 正式名（真名）およびゲーム内外見をスペック最上段に明示開示
    if (isWisdomRevealed && isUnidItem) {
        const trueName = (!isEn && (knowledge.wisdomTrueNameJa || knowledge.nameJa))
            ? (knowledge.wisdomTrueNameJa || knowledge.nameJa)
            : (knowledge.wisdomTrueName || knowledge.nameEn || knowledge.name);
        if (trueName) {
            specs.push({
                id: 'wisdom_true_name',
                label: isEn ? 'True Name' : '正式名 (真名)',
                value: trueName,
                type: 'magic',
                highlight: true
            });
        }
        const appearance = knowledge.appearanceName || (identification && identification.appearanceName);
        if (appearance) {
            specs.push({
                id: 'appearance',
                label: isEn ? 'Appearance' : '外見',
                value: appearance,
                type: 'info'
            });
        }
    }

    const canShowBuc = Boolean(isWisdomRevealed || flags.bknown || (directObj && directObj.bucStatus) || !directObj || !directObj.flags);
    if (bucRaw && bucRaw !== 'UNKNOWN' && canShowBuc) {
        const bucJaMap = { BLESSED: '祝福 (Blessed)', UNCURSED: '通常 (Uncursed)', CURSED: '呪い (Cursed)' };
        const bucEnMap = { BLESSED: 'Blessed', UNCURSED: 'Uncursed', CURSED: 'Cursed' };
        specs.push({
            id: 'bucStatus',
            label: 'BUC',
            value: isEn ? (bucEnMap[bucRaw] || bucRaw) : (bucJaMap[bucRaw] || bucRaw),
            type: bucRaw === 'CURSED' ? 'warning' : (bucRaw === 'BLESSED' ? 'magic' : 'info'),
            highlight: bucRaw !== 'UNCURSED' || isWisdomRevealed
        });
    }

    if (typeof quan === 'number' && quan > 1) {
        specs.push({
            id: 'quantity',
            label: isEn ? 'Quantity' : '個数',
            value: isEn ? `${quan}x` : `${quan}個`,
            type: 'info',
            quan: quan
        });
    }

    if (isPile) {
        specs.push({
            id: 'pile_count',
            label: isEn ? 'Pile' : '山積み',
            value: extraPileCount > 0
                ? (isEn ? `+${extraPileCount} beneath` : `下に +${extraPileCount} 個`)
                : (isEn ? '+ beneath' : '下に複数アイテム'),
            type: 'info',
            highlight: true,
            extraPileCount
        });
    }

    if (typeof corpsenm === 'number' && corpsenm >= 0) {
        const mon = MONSTER_KNOWLEDGE_MAP.get(corpsenm);
        const monName = isEn
            ? (mon?.name || `Monster #${corpsenm}`)
            : (mon?.nameJa || mon?.name || `モンスター #${corpsenm}`);
        specs.push({
            id: 'corpse_monster',
            label: isEn ? 'Creature' : '対象生物',
            value: monName,
            type: 'monster',
            corpsenm: corpsenm,
            highlight: true
        });
    }

    // 強化値 (spe): 既知または Peek 時に開示
    const canShowSpe = Boolean(isWisdomRevealed || flags.known || (directObj && typeof directObj.spe === 'number' && !directObj.flags) || !directObj || !directObj.flags);
    if (canShowSpe && typeof spe === 'number' && (cat === 'WEAPON' || cat === 'ARMOR' || cat === 'RING')) {
        const sign = spe > 0 ? `+${spe}` : `${spe}`;
        specs.push({
            id: 'enchantment',
            label: isEn ? 'Enchantment' : '強化値',
            value: sign,
            spe: spe,
            type: spe > 0 ? 'magic' : (spe < 0 ? 'warning' : 'weapon'),
            highlight: spe !== 0 || isWisdomRevealed
        });
    }

    // 杖のチャージ数: 既知または Peek 時に開示
    if (canShowSpe && cat === 'WAND' && typeof spe === 'number') {
        specs.push({
            id: 'charges',
            label: isEn ? 'Charges' : '残チャージ',
            value: isEn ? `${spe} charges` : `${spe}回`,
            type: 'magic',
            highlight: true
        });
    }

    // 劣化・コーティング状態 (oeroded, oeroded2, oerodeproof, greased)
    if (flags) {
        if (flags.oeroded > 0 || flags.oeroded2 > 0) {
            const erodeVal = Math.max(flags.oeroded || 0, flags.oeroded2 || 0);
            const erodeJa = erodeVal >= 3 ? 'ひどく損傷 (Very damaged)' : (erodeVal === 2 ? '損傷 (Damaged)' : '軽微な損傷 (Rusty/Burnt)');
            const erodeEn = erodeVal >= 3 ? 'Very damaged' : (erodeVal === 2 ? 'Damaged' : 'Rusty / Burnt');
            specs.push({
                id: 'erosion',
                label: isEn ? 'Erosion' : '劣化状態',
                value: isEn ? erodeEn : erodeJa,
                type: 'warning',
                highlight: true
            });
        }
        if (flags.oerodeproof) {
            specs.push({
                id: 'erodeproof',
                label: isEn ? 'Proofing' : '耐食加工',
                value: isEn ? 'Corrodeproof' : '耐腐食・耐火',
                type: 'magic',
                highlight: true
            });
        }
        if (flags.greased) {
            specs.push({
                id: 'greased',
                label: isEn ? 'Grease' : '塗布',
                value: isEn ? 'Greased' : 'グリース塗布',
                type: 'info',
                highlight: true
            });
        }
        if (flags.unpaid) {
            specs.push({
                id: 'unpaid',
                label: isEn ? 'Shop' : '店舗',
                value: isEn ? 'Unpaid' : '未払い品 (Unpaid)',
                type: 'warning',
                highlight: true
            });
        }
    }

    // コンテナ（箱・鞄）専用スペック
    const isContainer = cat === 'CONTAINER' || cat === 'BOX' || knowledge.isContainer ||
        (cat === 'TOOL' && (
            (knowledge.nameEn && /box|chest|bag|sack/i.test(knowledge.nameEn)) ||
            (knowledge.name && /box|chest|bag|sack/i.test(knowledge.name)) ||
            flags.olocked !== undefined || flags.lknown !== undefined || flags.tknown !== undefined
        ));

    if (isContainer) {
        const canShowLock = Boolean(isWisdomRevealed || flags.lknown);
        if (canShowLock) {
            let lockVal = isEn ? 'Unlocked' : '解錠 (Unlocked)';
            let lockType = 'info';
            if (flags.obroken) {
                lockVal = isEn ? 'Broken' : '錠前破損 (Broken)';
                lockType = 'warning';
            } else if (flags.olocked) {
                lockVal = isEn ? 'Locked' : '施錠 (Locked)';
                lockType = 'warning';
            }
            specs.push({
                id: 'container_lock',
                label: isEn ? 'Lock' : '施錠状態',
                value: lockVal,
                type: lockType,
                highlight: Boolean(flags.olocked || flags.obroken || isWisdomRevealed)
            });
        }

        const canShowTrap = Boolean(isWisdomRevealed || flags.tknown);
        if (canShowTrap) {
            specs.push({
                id: 'container_trap',
                label: isEn ? 'Trap' : '罠状態',
                value: flags.otrapped ? (isEn ? 'Trapped' : '罠あり (Trapped)') : (isEn ? 'Untrapped' : '罠なし (Untrapped)'),
                type: flags.otrapped ? 'warning' : 'info',
                highlight: Boolean(flags.otrapped || isWisdomRevealed)
            });
        }

        const canShowContents = Boolean(isWisdomRevealed || flags.cknown);
        if (canShowContents) {
            const hasItems = Boolean((directObj?.cobjPtr && directObj.cobjPtr > 0) || (directObj?.contents && directObj.contents.length > 0));
            specs.push({
                id: 'container_contents',
                label: isEn ? 'Contents' : '中身',
                value: hasItems ? (isEn ? 'Contains items' : '中身あり') : (isEn ? 'Empty' : '空'),
                type: 'info',
                highlight: isWisdomRevealed
            });
        }
    }

    // 1. ⚔️ 武器 (WEAPON)
    if (cat === 'WEAPON') {
        const sdam = knowledge.sdam || stats.sdam;
        const ldam = knowledge.ldam || stats.ldam;
        if (sdam && sdam !== '0') {
            specs.push({
                id: 'damage',
                label: isEn ? 'Damage (S/L)' : '攻撃力 (小/大)',
                value: `${sdam} / ${ldam || sdam}`,
                type: 'weapon',
                highlight: true
            });
        }

        const hands = (knowledge.hands !== undefined) ? knowledge.hands : stats.hands;
        if (hands === 2) {
            specs.push({
                id: 'hands',
                label: isEn ? 'Hands' : '持ち手',
                value: isEn ? 'Two-handed (2H)' : '両手持ち (2H)',
                type: 'warning',
                highlight: true
            });
        }

        const skill = knowledge.skill || stats.skill;
        if (skill && skill !== 'none') {
            const skillBadge = getSkillProficiencyBadge(knowledge, skillStateManager, language);
            specs.push({
                id: 'skill',
                label: isEn ? 'Skill' : '武器スキル',
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
                label: isEn ? 'Hit Bonus' : '命中補正',
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
                label: isEn ? 'Defense (AC)' : '防御力 (AC)',
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
                label: isEn ? 'Magic Cancel' : '魔法防御 (MC)',
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
            const slotMapEn = {
                suit: 'Suit',
                shield: 'Shield',
                helm: 'Helm',
                gloves: 'Gloves',
                boots: 'Boots',
                cloak: 'Cloak',
                shirt: 'Shirt'
            };
            specs.push({
                id: 'armorSlot',
                label: isEn ? 'Slot' : '装着部位',
                value: isEn ? (slotMapEn[slot] || slot) : (slotMapJa[slot] || slot),
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
                label: isEn ? 'Base Price' : '基本価格',
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
            const zapTypeMapEn = {
                ray: 'Ray',
                beam: 'Beam',
                nodir: 'NoDir'
            };
            specs.push({
                id: 'zapType',
                label: isEn ? 'Zap Type' : '射線種別',
                value: isEn ? (zapTypeMapEn[zapType.toLowerCase()] || zapType.toUpperCase()) : (zapTypeMapJa[zapType.toLowerCase()] || zapType.toUpperCase()),
                type: 'wand',
                highlight: true
            });
        }
        if (knowledge.isCharged) {
            specs.push({
                id: 'charged',
                label: isEn ? 'Charges' : '充填',
                value: isEn ? 'Rechargeable' : 'チャージ式',
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
                label: isEn ? 'Spell Level' : 'スペルレベル',
                value: `Lv.${spellLevel}`,
                type: 'spell',
                highlight: true
            });
        }

        const spellSkill = knowledge.spellSkill || stats.spellSkill;
        if (spellSkill && spellSkill !== 'none') {
            const skillBadge = getSkillProficiencyBadge({ skill: spellSkill }, skillStateManager, language);
            specs.push({
                id: 'spellSkill',
                label: isEn ? 'School' : '魔法系統',
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
                label: isEn ? 'Reading Delay' : '読解ターン',
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
                label: isEn ? 'Nutrition' : '栄養価',
                value: `${nutrition} nutr`,
                type: 'food',
                highlight: true
            });
        }

        const delay = (knowledge.delay !== undefined) ? knowledge.delay : stats.delay;
        if (delay > 0) {
            specs.push({
                id: 'delay',
                label: isEn ? 'Eat Time' : '食事所要時間',
                value: `${delay} turns`,
                type: 'food'
            });
        }
    }

    // 7. 🎒 道具 (TOOL)
    else if (cat === 'TOOL') {
        if (knowledge.isKey) {
            specs.push({ id: 'featureKey', label: isEn ? 'Key' : '機能', value: isEn ? 'Unlock (Key)' : '解錠可能 (Key)', type: 'tool', highlight: true });
        }
        if (knowledge.isPickAxe) {
            specs.push({ id: 'featureDig', label: isEn ? 'Dig' : '機能', value: isEn ? 'Dig Walls (Dig)' : '壁掘削 (Dig)', type: 'tool', highlight: true });
        }
        if (knowledge.isCanOpener) {
            specs.push({ id: 'featureCan', label: isEn ? 'Tin' : '機能', value: isEn ? 'Can Opener' : '缶切り (Can Opener)', type: 'tool', highlight: true });
        }
        if (knowledge.isTouchstone) {
            specs.push({ id: 'featureTouch', label: isEn ? 'Identify' : '機能', value: isEn ? 'Identify Gem (Touchstone)' : '宝石鑑定 (Touchstone)', type: 'tool', highlight: true });
        }
        if (knowledge.isContainer || knowledge.isBox || knowledge.isBag) {
            specs.push({ id: 'featureContainer', label: isEn ? 'Container' : '種別', value: isEn ? 'Container' : '収納容器 (Container)', type: 'tool', highlight: true });
        }
    }

    // 8. 💎 宝石 / 鉱石 (GEM / ROCK)
    else if (cat === 'GEM' || cat === 'ROCK') {
        const cost = (knowledge.cost !== undefined) ? knowledge.cost : stats.cost;
        if (cost > 0) {
            specs.push({
                id: 'cost',
                label: isEn ? 'Price' : '価値/価格',
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
        const propMapEn = {
            FIRE_RES: 'Fire Resistance',
            COLD_RES: 'Cold Resistance',
            SHOCK_RES: 'Shock Resistance',
            DISINT_RES: 'Disintegration Res',
            SLEEP_RES: 'Sleep Resistance',
            POISON_RES: 'Poison Resistance',
            DRAIN_RES: 'Drain Resistance',
            STONE_RES: 'Stone Resistance',
            UNCHANGING: 'Unchanging',
            REFLECTING: 'Reflection',
            INVIS: 'Invisibility',
            SEE_INVIS: 'See Invisible',
            TELEPORT: 'Teleportation',
            TELEPORT_CNTRL: 'Teleport Control',
            REGENERATION: 'Regeneration',
            WARNING: 'Warning',
            SLOW_DIGESTION: 'Slow Digestion',
            FREE_ACTION: 'Free Action',
            STEALTH: 'Stealth',
            LEVITATION: 'Levitation',
            FAST: 'Speed',
            INFRAVISION: 'Infravision',
            SEARCHING: 'Searching',
            CLAIRVOYANT: 'Clairvoyance',
            ANTIMAGIC: 'Magic Resistance'
        };
        specs.push({
            id: 'propConveyed',
            label: isEn ? 'Conveys' : '付与能力',
            value: isEn ? (propMapEn[propConveyed] || propConveyed) : (propMapJa[propConveyed] || propConveyed),
            type: 'magic',
            highlight: true
        });
    }

    // 🧱 共通物理属性 (材質・重量)
    if (includeCommonPhysics) {
        const materialRaw = (knowledge.material && knowledge.material !== 'none') ? knowledge.material : (stats.material && stats.material !== 'none' ? stats.material : null);
        if (materialRaw) {
            const materialMapJa = {
                'iron': '鉄 (Iron)',
                '鉄': '鉄 (Iron)',
                'wood': '木 (Wood)',
                '木': '木 (Wood)',
                'silver': '銀 (Silver)',
                '銀': '銀 (Silver)',
                'metal': '金属 (Metal)',
                '金属': '金属 (Metal)',
                'leather': '革 (Leather)',
                '革': '革 (Leather)',
                'cloth': '布 (Cloth)',
                '布': '布 (Cloth)',
                'dragon scale': '竜鱗 (Dragon scale)',
                'dragon_hide': '竜鱗 (Dragon scale)',
                '竜鱗': '竜鱗 (Dragon scale)',
                'mithril': 'ミスリル (Mithril)',
                'ミスリル': 'ミスリル (Mithril)',
                'copper': '銅 (Copper)',
                '銅': '銅 (Copper)',
                'gold': '金 (Gold)',
                '金': '金 (Gold)',
                'platinum': '白金 (Platinum)',
                '白金': '白金 (Platinum)',
                'glass': 'ガラス (Glass)',
                'ガラス': 'ガラス (Glass)',
                'gemstone': '宝石 (Gemstone)',
                '宝石': '宝石 (Gemstone)',
                'mineral': '鉱石 (Mineral)',
                '鉱石': '鉱石 (Mineral)',
                'bamboo': '竹 (Bamboo)',
                '竹': '竹 (Bamboo)',
                'bone': '骨 (Bone)',
                '骨': '骨 (Bone)',
                'paper': '紙 (Paper)',
                '紙': '紙 (Paper)',
                'wax': '蝋 (Wax)',
                '蝋': '蝋 (Wax)',
                'vegetable': '植物性 (Vegetable)',
                '植物性': '植物性 (Vegetable)',
                'veggy': '植物性 (Vegetable)',
                'flesh': '肉 (Flesh)',
                '肉': '肉 (Flesh)',
                'plastic': 'プラスチック (Plastic)',
                'プラスチック': 'プラスチック (Plastic)',
                'crystal': '水晶 (Crystal)',
                '水晶': '水晶 (Crystal)',
                'organ': '器官 (Organ)',
                '器官': '器官 (Organ)',
                'liquid': '液体 (Liquid)',
                '液体': '液体 (Liquid)'
            };
            const materialMapEn = {
                'iron': 'Iron',
                '鉄': 'Iron',
                'wood': 'Wood',
                '木': 'Wood',
                'silver': 'Silver',
                '銀': 'Silver',
                'metal': 'Metal',
                '金属': 'Metal',
                'leather': 'Leather',
                '革': 'Leather',
                'cloth': 'Cloth',
                '布': 'Cloth',
                'dragon scale': 'Dragon scale',
                'dragon_hide': 'Dragon scale',
                '竜鱗': 'Dragon scale',
                'mithril': 'Mithril',
                'ミスリル': 'Mithril',
                'copper': 'Copper',
                '銅': 'Copper',
                'gold': 'Gold',
                '金': 'Gold',
                'platinum': 'Platinum',
                '白金': 'Platinum',
                'glass': 'Glass',
                'ガラス': 'Glass',
                'gemstone': 'Gemstone',
                '宝石': 'Gemstone',
                'mineral': 'Mineral',
                '鉱石': 'Mineral',
                'bamboo': 'Bamboo',
                '竹': 'Bamboo',
                'bone': 'Bone',
                '骨': 'Bone',
                'paper': 'Paper',
                '紙': 'Paper',
                'wax': 'Wax',
                '蝋': 'Wax',
                'vegetable': 'Vegetable',
                '植物性': 'Vegetable',
                'veggy': 'Vegetable',
                'flesh': 'Flesh',
                '肉': 'Flesh',
                'plastic': 'Plastic',
                'プラスチック': 'Plastic',
                'crystal': 'Crystal',
                '水晶': 'Crystal',
                'organ': 'Organ',
                '器官': 'Organ',
                'liquid': 'Liquid',
                '液体': 'Liquid'
            };

            const key = String(materialRaw).toLowerCase().trim();
            const formattedMaterial = isEn ? (materialMapEn[key] || materialRaw) : (materialMapJa[key] || materialRaw);

            specs.push({
                id: 'material',
                label: isEn ? 'Material' : '材質',
                value: formattedMaterial,
                type: 'physics'
            });
        }

        const weight = (knowledge.weight !== undefined && knowledge.weight > 0) ? knowledge.weight : (stats.weight && stats.weight > 0 ? stats.weight : null);
        if (weight !== null && weight !== undefined) {
            specs.push({
                id: 'weight',
                label: isEn ? 'Weight' : '重量',
                value: `${weight} wt`,
                type: 'physics'
            });
        }
    }

    // 🛡️ 装備換装診断スペック（所要ターン、ブロッカー、換装不可警告）の適応統合
    let depReport = options.dependencyReport || null;
    if (!depReport && (options.inventory || options.inventoryState) && (options.item || knowledge)) {
        const inv = options.inventory || options.inventoryState;
        const target = options.item || knowledge;
        // 未装備アイテムの場合のみ診断
        if (target && !target.isWorn && !target.isWielded && !target.isOffhand && !target.isQuivered) {
            depReport = EquipmentDependencyAnalyzer.analyzeDependency(inv, target);
        }
    }

    if (depReport) {
        const depSpecs = getEquipmentDependencySpecs(depReport, { language });
        specs.push(...depSpecs);
    }

    return specs;
}

/**
 * EquipmentDependencyReport から適応型スペックバッジ配列を生成
 * @param {Object} report - EquipmentDependencyReport
 * @param {Object} [options={}]
 * @param {'ja'|'en'} [options.language='ja']
 * @returns {Array<Object>}
 */
export function getEquipmentDependencySpecs(report, options = {}) {
    const specs = [];
    if (!report) return specs;

    const language = options.language || 'ja';
    const isEn = (language === 'en');

    // 1. 換装不可ブロック理由
    if (!report.canExecute && report.risks?.blockingReason) {
        specs.push({
            id: 'equip_blocked',
            label: isEn ? 'Equip Blocked' : '換装不可',
            value: report.risks.blockingReason,
            type: 'warning',
            highlight: true
        });
        return specs;
    }

    // 2. 換装ブロッカー（脱ぐ必要のあるアイテム）
    if (Array.isArray(report.blockers) && report.blockers.length > 0) {
        const blockerNames = report.blockers.map(b => b.name || b.rawText || b.slot).join(', ');
        specs.push({
            id: 'equip_blockers',
            label: isEn ? 'Blockers' : '脱衣ブロッカー',
            value: blockerNames,
            type: 'warning',
            highlight: report.risks?.hasCursedBlocker
        });
    }

    // 3. 所要ターン数（複数ターンの場合）
    const totalTurns = report.risks?.totalEstimatedTurns || 1;
    if (totalTurns > 1) {
        specs.push({
            id: 'equip_turns',
            label: isEn ? 'Equip Turns' : '換装所要ターン',
            value: isEn ? `~${totalTurns} turns` : `約 ${totalTurns} ターン`,
            type: totalTurns >= 5 ? 'warning' : 'info',
            highlight: totalTurns >= 5
        });
    }

    // 4. 着直しアイテム（巻き戻しスタック）
    if (Array.isArray(report.itemsToRewear) && report.itemsToRewear.length > 0) {
        const rewearNames = report.itemsToRewear.map(r => r.name || r.rawText || r.slot).join(', ');
        specs.push({
            id: 'equip_rewear',
            label: isEn ? 'Rewear' : '着直し予定',
            value: rewearNames,
            type: 'info'
        });
    }

    return specs;
}

/**
 * プレイヤーのスキル熟練度（SkillStateManager）とアイテムの適合バッジ（+マーク）を判定
 * @param {Object} knowledge - アイテムナレッジ
 * @param {Object} skillStateManager - SkillStateManager インスタンス
 * @param {'ja'|'en'|Object} [options='ja'] - 表示言語またはオプションオブジェクト
 * @returns {{ label: string, rankKey: string, score: number, isProficient: true } | null}
 */
export function getSkillProficiencyBadge(knowledge, skillStateManager, options = 'ja') {
    if (!knowledge || !skillStateManager) return null;

    const skillName = knowledge.skill || (knowledge.stats && knowledge.stats.skill) || null;
    if (!skillName || skillName === 'none') return null;

    if (typeof skillStateManager.getSkillRank !== 'function') return null;

    const rank = skillStateManager.getSkillRank(skillName);
    if (!rank || !rank.key) return null;

    const lang = typeof options === 'string' ? options : (options && options.language) || (knowledge && knowledge.language) || 'ja';
    const isEn = (lang === 'en');

    // Basic (入門) 以上の習得済みスキルをプラス対象とする
    if (rank.key === 'basic' || rank.key === 'skilled' || rank.key === 'expert' || rank.key === 'master' || rank.key === 'grandmaster') {
        return {
            label: isEn ? `+ ${rank.en || rank.label}` : `+ ${rank.label}`,
            rankKey: rank.key,
            score: rank.score || 10,
            isProficient: true
        };
    }

    return null;
}
