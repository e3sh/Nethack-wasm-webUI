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
    if (slot === 'suit' || (!slot && (raw.includes('mail') || raw.includes('armor') || raw.includes('suit') || raw.includes('鎧')))) {
        // 重装プレートメイル等 (重量 > 250、または plate / crystal / bronze)
        if (weight >= 300 || /plate|crystal|bronze plate|プレート/.test(raw)) {
            return 5;
        }
        // 中装 (splint, banded, chain, scale, ring mail等、重量 150〜299)
        if (weight >= 150 || /splint|banded|chain|scale|ring mail|鎖帷子/.test(raw)) {
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
    const cat = item.category || item.itemCategory || knowledge.category || item.onumCategory || '';
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
        if (/cloak|mantle|cape|robe|外套|マント|ローブ/.test(raw)) return ['cloak'];
        if (/suit|mail|armor|jacket|shirt|鎧|甲冑|胴着|着物/.test(raw)) {
            if (/shirt|シャツ/.test(raw)) return ['shirt'];
            return ['suit'];
        }
        if (/helmet|helm|hat|cap|兜|帽子/.test(raw)) return ['helm'];
        if (/gloves|gauntlets|mittens|手袋|籠手/.test(raw)) return ['gloves'];
        if (/shield|盾/.test(raw)) return ['shield'];
        if (/boots|shoes|靴|ブーツ/.test(raw)) return ['boots'];
    }

    // 2. 装身具 (RING, AMULET)
    // ※ NetHack において首に装備できるものは AMULET のみ、かつ AMULET は首にしか装備できない (1対1)
    if (cat === 'AMULET' || item.itemCategory === 'AMULET' || item.equipSlot === 'amulet' ||
        /amulet|魔よけ|魔除け|お守り|アミュレット|護符|首飾り/i.test(raw)) {
        return ['amulet'];
    }
    if (cat === 'RING' || /ring|指輪/.test(raw)) {
        return ['left_ring', 'right_ring'];
    }

    // 3. 目隠し・タオル
    if (/blindfold|towel|目隠し|タオル/.test(raw) || item.isBlindfoldOrTowel) {
        return ['blindfold'];
    }

    // 4. 矢・投擲物 (Quiver適合)
    if (item.isAmmo || item.isThrowable || cat === 'AMMO' || /arrow|bolt|dart|shuriken|rock|矢|ボルト|ダーツ|手裏剣/.test(raw)) {
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
    return /two-handed|tsurugi|mattock|halberd|glaive|spetum|poleaxe|polearm|great|bow|crossbow|両手|ツルギ|マトック|長柄/.test(raw);
}

/**
 * アイテムがコカトリス（またはチカトリス）の死体かどうか判定
 * @param {Object} item
 * @returns {boolean}
 */
export function isCockatriceCorpse(item) {
    if (!item) return false;
    const raw = (item.rawText || item.name || '').toLowerCase();
    const isCorpse = raw.includes('corpse') || raw.includes('死体') || item.isCorpse;
    if (!isCorpse) return false;
    return /cockatrice|chickatrice|コカトリス|チカトリス/.test(raw);
}
