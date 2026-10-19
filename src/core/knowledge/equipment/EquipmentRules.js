/**
 * EquipmentRules.js
 * 
 * 装備ペーパードール・依存関係解析に必要な装備スロット、防具レイヤー規則、
 * 装身具・武器のブロッカー規則、所要ターン計算、スロット適合リゾルバーの純粋定数およびヘルパー関数。
 */

// 装備部位スロットID一覧
export const EQUIP_SLOTS = {
    HELM: 'helm',
    CLOAK: 'cloak',
    SUIT: 'suit',
    SHIRT: 'shirt',
    GLOVES: 'gloves',
    BOOTS: 'boots',
    SHIELD: 'shield',
    MAIN_HAND: 'main_hand',
    OFF_HAND: 'off_hand',
    LEFT_RING: 'left_ring',
    RIGHT_RING: 'right_ring',
    AMULET: 'amulet',
    BLINDFOLD: 'blindfold',
    QUIVER: 'quiver',
};

// 防具3層レイヤールール（layer値が大きいほど外側）
// 脱ぐときは外側（layer降順）、着るときは内側（layer昇順）
export const ARMOR_LAYERS = {
    cloak: { slot: 'cloak', layer: 3, blockers: [] },
    suit:  { slot: 'suit',  layer: 2, blockers: ['cloak'] },
    shirt: { slot: 'shirt', layer: 1, blockers: ['cloak', 'suit'] },
};

// 装身具ルール
export const ACCESSORY_RULES = {
    left_ring:  { slot: 'left_ring',  blockers: ['gloves'] },
    right_ring: { slot: 'right_ring', blockers: ['gloves'] },
    amulet:     { slot: 'amulet',     blockers: [] },
    blindfold:  { slot: 'blindfold',  blockers: [] },
};

/**
 * アイテムの着脱所要ターン数（概算）を算出
 * @param {'wear'|'take_off'|'wield'|'unwield'|'put_on'|'remove'} action
 * @param {Object} item
 * @returns {number} 所要ターン数（最小1）
 */
export function estimateActionTurns(action, item) {
    if (!item) return 1;

    const raw = (item.rawText || item.name || '').toLowerCase();
    const slot = item.armorSlot || (item.knowledge && item.knowledge.armorSlot);
    const weight = item.weight || (item.knowledge && item.knowledge.weight) || (item.knowledge?.stats?.weight) || 0;

    // 鎧（Suit）の着脱ターン計算（NetHack C-Core do_wear.c 準拠）
    if (slot === 'suit' || (!slot && (raw.includes('mail') || raw.includes('armor') || raw.includes('suit')))) {
        // 重装プレートメイル等 (重量 > 250、または plate / crystal / bronze)
        if (weight >= 300 || /plate|crystal|bronze plate/.test(raw)) {
            return 5;
        }
        // 中装 (splint, banded, chain, scale, ring mail等、重量 150〜299)
        if (weight >= 150 || /splint|banded|chain|scale|ring mail/.test(raw)) {
            return 3;
        }
        // 軽装 (leather, studded leather, mithril coat, Hawaiian shirt 等)
        return 1;
    }

    // 外套、シャツ、兜、手袋、靴、盾、指輪、首飾り、武器持ち替え等は基本的に1ターン
    return 1;
}

/**
 * アイテムが装備可能なスロット一覧を判定して返却（純粋関数）
 * @param {Object} item - インベントリアイテムまたはナレッジオブジェクト
 * @returns {Array<string>} 適合スロット配列（空配列または 'helm', 'cloak', 'main_hand' など）
 */
export function resolveEligibleSlots(item) {
    if (!item) return [];

    const raw = (item.rawText || item.name || '').toLowerCase();
    const knowledge = item.knowledge || {};
    const stats = knowledge.stats || {};
    const cat = item.category || knowledge.category || '';
    const armorSlot = item.armorSlot || knowledge.armorSlot || stats.armorSlot;

    // 0. equipSlot の明示的指定がある場合の優先判定
    if (item.equipSlot === 'amulet') return ['amulet'];
    if (item.equipSlot === 'ring_left' || item.equipSlot === 'ring_right') return ['left_ring', 'right_ring'];
    if (item.equipSlot === 'blindfold') return ['blindfold'];
    if (item.equipSlot && ['cloak', 'suit', 'shirt', 'helm', 'gloves', 'shield', 'boots'].includes(item.equipSlot)) {
        return [item.equipSlot];
    }

    // 1. 防具（ARMOR）
    if (cat === 'ARMOR' || armorSlot) {
        switch (armorSlot) {
            case 'cloak': return ['cloak'];
            case 'suit':  return ['suit'];
            case 'shirt': return ['shirt'];
            case 'helm':  return ['helm'];
            case 'gloves': return ['gloves'];
            case 'shield': return ['shield'];
            case 'boots': return ['boots'];
        }

        // armorSlot 未設定時のフォールバック推定
        if (/cloak|mantle|cape|robe/.test(raw)) return ['cloak'];
        if (/suit|mail|armor|jacket|shirt/.test(raw)) {
            if (/shirt/.test(raw)) return ['shirt'];
            return ['suit'];
        }
        if (/helmet|helm|hat|cap/.test(raw)) return ['helm'];
        if (/gloves|gauntlets|mittens/.test(raw)) return ['gloves'];
        if (/shield/.test(raw)) return ['shield'];
        if (/boots|shoes/.test(raw)) return ['boots'];
    }

    // 非装備カテゴリ（魔法書、巻物、薬、杖、食料、金貨）は主手（wield）以外不可
    if (cat === 'SPELLBOOK' || cat === 'SCROLL' || cat === 'POTION' || cat === 'WAND' || cat === 'FOOD' || cat === 'COIN') {
        return ['main_hand'];
    }

    // 2. 装身具 (RING, AMULET)
    // ※ NetHack において首に装備できるものは AMULET のみ、かつ AMULET は首にしか装備できない (1対1)
    if (cat === 'AMULET' || item.equipSlot === 'amulet' || /amulet/i.test(raw)) {
        return ['amulet'];
    }
    if (cat === 'RING' || item.equipSlot === 'ring_left' || item.equipSlot === 'ring_right' || /\brings?\b/i.test(raw)) {
        return ['left_ring', 'right_ring'];
    }

    // 3. 目隠し・タオル
    if (/blindfold|towel/.test(raw) || item.isBlindfoldOrTowel) {
        return ['blindfold'];
    }

    // 4. 矢・投擲物 (Quiver適合)
    if (item.isAmmo || item.isThrowable || cat === 'AMMO' || /arrow|bolt|dart|shuriken|rock/.test(raw)) {
        return ['quiver', 'main_hand'];
    }

    // 5. その他すべてのアイテム（武器、道具、死体、巻物、ワンド等）
    // NetHack ではほぼすべてのアイテムを主手に持つ (wield) ことが可能
    return ['main_hand'];
}

/**
 * アイテムが両手武器（Two-handed）かどうか判定
 * @param {Object} item
 * @returns {boolean}
 */
export function isTwoHandedWeapon(item) {
    if (!item) return false;
    if (item.isTwoHanded !== undefined) return Boolean(item.isTwoHanded);
    if (item.knowledge?.isTwoHanded !== undefined) return Boolean(item.knowledge.isTwoHanded);
    if (item.knowledge?.stats?.isTwoHanded !== undefined) return Boolean(item.knowledge.stats.isTwoHanded);

    const raw = (item.rawText || item.name || '').toLowerCase();
    return /two-handed|tsurugi|mattock|halberd|glaive|spetum|poleaxe|polearm|great|bow|crossbow/.test(raw);
}

/**
 * アイテムがコカトリス（またはチカトリス）の死体かどうか判定
 * @param {Object} item
 * @returns {boolean}
 */
export function isCockatriceCorpse(item) {
    if (!item) return false;
    const raw = (item.rawText || item.name || '').toLowerCase();
    const isCorpse = raw.includes('corpse') || item.isCorpse;
    if (!isCorpse) return false;
    return /cockatrice|chickatrice/.test(raw);
}

/**
 * 二刀流 (Two-Weapon Combat) に適性がある職業リスト (NetHack 5.0 C-Core 準拠)
 */
export const TWO_WEAPON_ELIGIBLE_ROLES = Object.freeze([
    'samurai', 'barbarian', 'rogue', 'ranger', 'knight'
]);

/**
 * 二刀流 (Two-Weapon Combat) が明示的に不可・制限されている職業リスト
 */
export const TWO_WEAPON_INELIGIBLE_ROLES = Object.freeze([
    'valkyrie', 'wizard', 'monk', 'tourist', 'archeologist', 'priest', 'healer', 'caveman'
]);

/**
 * プレイヤーが二刀流 (Two-Weapon Combat) を行える適性があるか判定 (GKL SSOT)
 * @param {Object} situation - GKL Situation オブジェクト
 * @param {Object} [core] - WebUICore (フォールバック)
 * @returns {boolean}
 */
export function isTwoWeaponEligible(situation, core = null) {
    // 0. SituationCache / SkillStateManager による事前判定があれば最優先
    if (situation?.skills?.canTwoWeapon !== undefined) {
        return Boolean(situation.skills.canTwoWeapon);
    }

    // 1. スキル情報から判定
    const skills = situation?.skills?.items || situation?.skills || situation?.attributes?.skills || core?.skills || [];
    if (Array.isArray(skills) && skills.length > 0) {
        const twoWeaponSkill = skills.find(s => {
            const name = (s.name || s.nameRaw || '').toLowerCase();
            return name.includes('two-weapon') || name.includes('two weapon');
        });
        if (twoWeaponSkill) {
            const rankKey = twoWeaponSkill.rank?.key || twoWeaponSkill.rankKey || '';
            return rankKey !== 'restricted' && !twoWeaponSkill.isRestricted;
        }
    }

    // 2. 職業情報から判定
    const charInfo = situation?.attributes?.characterInfo || core?.characterInfo || {};
    const charSummary = situation?.attributes?.characterSummary || {};
    const role = (charInfo.role || charSummary.role || situation?.status?.role || core?.status?.role || situation?.player?.role || '').toLowerCase();

    if (role && TWO_WEAPON_ELIGIBLE_ROLES.some(r => role.includes(r))) {
        return true;
    }

    // 3. 既に二刀流中のアイテムが存在する場合
    if (situation?.equipment?.isTwoWeapon) return true;
    const invItems = situation?.inventory?.items || core?.inventory?.items || [];
    if (invItems.some(i => i.isOffhand)) return true;

    // 4. 明示的な非適性職の場合は false
    if (role && TWO_WEAPON_INELIGIBLE_ROLES.some(r => role.includes(r))) {
        return false;
    }

    // 職業・スキルともに情報未確定の場合は操作可能（デフォルト true）
    return true;
}

/**
 * アイテムが装備換装アドバイスの対象（武器・防具・装身具・目隠し等）として妥当か判定
 * 巻物、薬、魔法書、食料、ワンド、金貨などの非装備品・消耗品を除外する
 * @param {Object} item
 * @returns {boolean}
 */
export function isEquippableForAdvice(item) {
    if (!item) return false;

    // コカトリス死体は安全警告（ADVICE_EQUIP_COCKATRICE_DANGER）の対象として許可
    if (isCockatriceCorpse(item)) return true;

    const raw = (item.rawText || item.name || '').toLowerCase();
    const cat = item.category || item.knowledge?.category || '';

    // 明示的に非装備・消耗品カテゴリであるものは除外
    if (
        cat === 'SCROLL' || cat === 'POTION' || cat === 'SPELLBOOK' ||
        cat === 'FOOD' || cat === 'WAND' || cat === 'COIN' || cat === 'GOLD' ||
        cat === 'GEM' || cat === 'ROCK' || cat === 'BALL' || cat === 'CHAIN'
    ) {
        return false;
    }

    // アイテム名 / rawText に基づく除外（未識別名やラベル含む）
    if (/\b(?:scroll|potion|spellbook|wand)\b/i.test(raw)) {
        return false;
    }

    // 1. equipSlot または armorSlot の指定があれば装備品
    if (item.armorSlot || item.knowledge?.armorSlot || item.equipSlot) {
        return true;
    }

    // 2. 武器・防具・装身具カテゴリ
    if (cat === 'WEAPON' || cat === 'ARMOR' || cat === 'RING' || cat === 'AMULET') {
        return true;
    }

    // 3. 目隠し・タオル
    if (/blindfold|towel/.test(raw) || item.isBlindfoldOrTowel) {
        return true;
    }

    // 4. 矢・投擲物（Ammo）
    if (item.isAmmo || cat === 'AMMO' || /arrow|bolt|dart|shuriken/.test(raw)) {
        return true;
    }

    // 5. 一般的な武器・防具・装身具のキーワード判定
    if (
        /sword|dagger|knife|axe|mace|spear|club|saber|scimitar|blade|tsurugi|katana|flail|hammer|whip|bow|crossbow|sling|lance|halberd|glaive|poleaxe|polearm|mattock|dart|javelin|boomerang|trident|partisan|spetum|ranseur|bill-guisarme|voulge|fauchard|guisarme|bardiche|bec-de-corbin|lucern|yari|naginata|morning star|war hammer|quarterstaff|broadsword|short sword|long sword|silver saber|two-handed sword|elven dagger|orcish dagger|athame|crysknife|scalpel/.test(raw)
    ) {
        return true;
    }

    if (
        /shield|cloak|suit|mail|armor|jacket|shirt|helmet|helm|hat|cap|gloves|gauntlets|mittens|boots|shoes|ring|amulet/.test(raw)
    ) {
        return true;
    }

    // 日本語名プロパティ（nameJa, customNameJa）が存在する場合のフォールバック
    const jaName = item.nameJa || item.customNameJa || '';
    if (jaName && /剣|短剣|刀|斧|槍|弓|クロスボウ|棍棒|鞭|槌|盾|鎧|兜|帽子|手袋|靴|外套|クローク|指輪|首飾り|アミュレット|目隠し|タオル/.test(jaName)) {
        return true;
    }

    return false;
}

export const EquipmentRules = {
    EQUIP_SLOTS,
    ARMOR_LAYERS,
    ACCESSORY_RULES,
    TWO_WEAPON_ELIGIBLE_ROLES,
    TWO_WEAPON_INELIGIBLE_ROLES,
    estimateActionTurns,
    resolveEligibleSlots,
    isTwoHandedWeapon,
    isCockatriceCorpse,
    isTwoWeaponEligible,
    isEquippableForAdvice
};

export default EquipmentRules;

