/**
 * MonsterSpecPresenter.js
 * 
 * 構造化モンスターナレッジ (MONSTER_KNOWLEDGE_FULL) から
 * フラグ・能力（traits, threat, attacks, corpse, resistances, weaknesses等）に基づき、
 * 最適化されたスペックバッジ一覧および図鑑用の要約タグ文字列を動的生成するプレゼンター。
 * 
 * 🧹 クリーン設計: 手書き自然言語アドバイスを排除し、純粋なメタデータから動的合成。
 */

const RESIST_LABELS_JA = {
    fire: '火炎耐性',
    cold: '冷気耐性',
    shock: '電撃耐性',
    sleep: '睡眠耐性',
    poison: '毒耐性',
    acid: '酸耐性',
    petrification: '石化耐性',
    stoning: '石化耐性',
    disintegration: '分解耐性',
    disint: '分解耐性',
    magic: '耐魔 (Magic Resistance)',
    antimagic: '耐魔 (Magic Resistance)',
    drain: 'ドレイン耐性',
    death: '即死無効',
    telepathy: 'テレパシー (ESP)',
    reflect: '光線反射',
    gain_level: 'レベルアップ (+1)'
};

const RESIST_LABELS_EN = {
    fire: 'Fire Resist',
    cold: 'Cold Resist',
    shock: 'Shock Resist',
    sleep: 'Sleep Resist',
    poison: 'Poison Resist',
    acid: 'Acid Resist',
    petrification: 'Stoning Resist',
    stoning: 'Stoning Resist',
    disintegration: 'Disintegration Resist',
    disint: 'Disintegration Resist',
    magic: 'Magic Resist',
    antimagic: 'Magic Resist',
    drain: 'Drain Resist',
    death: 'Death Immunity',
    telepathy: 'Telepathy (ESP)',
    reflect: 'Reflection',
    gain_level: 'Level Gain (+1)'
};

const WEAKNESS_LABELS_JA = {
    silver: '銀製武器',
    ranged: '遠隔攻撃/飛び道具',
    fire: '火炎',
    cold: '冷気',
    light: '光源/目眩まし',
    undead_slayer: 'アンデッド特効'
};

const WEAKNESS_LABELS_EN = {
    silver: 'Silver Weapon',
    ranged: 'Ranged Missiles',
    fire: 'Fire',
    cold: 'Cold',
    light: 'Light/Blind',
    undead_slayer: 'Undead Slayer'
};

/**
 * モンスター知識オブジェクトから適応型スペックバッジ配列を動的生成
 * @param {Object} knowledge - MONSTER_KNOWLEDGE_BASE のエントリまたはモンスターナレッジ
 * @param {Object} [options={}] - 表示オプション
 * @param {'ja'|'en'} [options.language='ja'] - 表示言語
 * @returns {Array<{ id: string, label: string, type: 'danger'|'warning'|'info'|'success', highlight?: boolean }>}
 */
export function getAdaptiveMonsterSpecs(knowledge, options = {}) {
    const specs = [];
    if (!knowledge) return specs;

    const language = options.language || knowledge.language || 'ja';
    const isEn = (language === 'en');

    const traits = knowledge.traits || {};
    const corpse = knowledge.corpse || {};
    const resistances = Array.isArray(knowledge.resistances) ? knowledge.resistances : [];
    const weaknesses = Array.isArray(knowledge.weaknesses) ? knowledge.weaknesses : [];
    const threat = knowledge.threat || null;

    // 1. 致命的・最優先の特殊攻撃能力 (Danger Traits)
    if (traits.petrifiesOnTouch || (threat && threat.effect === 'STONING')) {
        specs.push({
            id: 'trait_petrify',
            label: isEn ? 'Touch Petrification (Fatal)' : '接触石化 (即死危険)',
            type: 'danger',
            highlight: true
        });
    }

    if (traits.paralysisGaze || (threat && threat.effect === 'PARALYSIS')) {
        specs.push({
            id: 'trait_paralysis_gaze',
            label: isEn ? 'Paralyzing Gaze (Floating Eye)' : '麻痺視線 (近接・直視麻痺)',
            type: 'danger',
            highlight: true
        });
    }

    if (traits.gazeConfusion || (threat && threat.effect === 'CONFUSION')) {
        specs.push({
            id: 'trait_confuse_gaze',
            label: isEn ? 'Confusing Gaze' : '混乱視線 (要目隠し)',
            type: 'warning'
        });
    }

    if (traits.explodesOnMelee || (threat && threat.effect === 'PHYSICAL_BURST')) {
        specs.push({
            id: 'trait_explodes',
            label: isEn ? 'Explodes on Melee Contact' : '近接爆発 (自爆)',
            type: 'danger'
        });
    }

    if (traits.drainsLevel || (threat && threat.effect === 'LEVEL_DRAIN')) {
        specs.push({
            id: 'trait_level_drain',
            label: isEn ? 'Drains Experience Level' : 'レベルドレイン (経験値吸収)',
            type: 'danger'
        });
    }

    if (traits.eatsBrain || (threat && threat.effect === 'BRAIN_EAT')) {
        specs.push({
            id: 'trait_brain_eat',
            label: isEn ? 'Eats Brain (Mind Flayer)' : '知力吸い/脳食い (即死リスク)',
            type: 'danger',
            highlight: true
        });
    }

    if (traits.causesSlime || (threat && threat.effect === 'SLIME')) {
        specs.push({
            id: 'trait_slime',
            label: isEn ? 'Slime Transformation (Lethal)' : 'スライム化感染 (致死)',
            type: 'danger'
        });
    }

    if (traits.drownsPlayer || (threat && threat.effect === 'DROWNING')) {
        specs.push({
            id: 'trait_drown',
            label: isEn ? 'Drowns in Water' : '水場への引きずり込み (溺死)',
            type: 'danger'
        });
    }

    if (traits.rustsEquipment || (threat && threat.effect === 'RUST')) {
        specs.push({
            id: 'trait_rust',
            label: isEn ? 'Rusts Iron Gear' : '鉄製装備腐食 (サビ)',
            type: 'warning'
        });
    }

    if (traits.disenchantsEquipment || (threat && threat.effect === 'DISENCHANT')) {
        specs.push({
            id: 'trait_disenchant',
            label: isEn ? 'Disenchants Equipment (+N Drain)' : '装備魔法弱体化 (強化値ドレイン)',
            type: 'warning'
        });
    }

    if (traits.swallowsPlayer) {
        specs.push({
            id: 'trait_swallow',
            label: isEn ? 'Swallows Player Whole' : '丸呑み (胃袋脱出が必要)',
            type: 'warning'
        });
    }

    if (traits.causesLycanthropy) {
        specs.push({
            id: 'trait_lycanthropy',
            label: isEn ? 'Transmits Lycanthropy' : '人獣化感染 (要トリカブト)',
            type: 'warning'
        });
    }

    if (traits.stealsItems) {
        specs.push({
            id: 'trait_steal',
            label: isEn ? 'Steals Inventory Items' : 'アイテム盗み・逃走',
            type: 'info'
        });
    }

    if (traits.revives) {
        specs.push({
            id: 'trait_revive',
            label: isEn ? 'Self-Reviving (Eat/Burn corpse)' : '死後復活 (要死体処理)',
            type: 'warning'
        });
    }

    if (traits.castsSpells) {
        specs.push({
            id: 'trait_spellcaster',
            label: isEn ? 'Casts Magic Spells' : '魔法詠唱能力あり',
            type: 'info'
        });
    }

    // 2. 種族・特性分類 (Race & Entity Type)
    if (traits.isUndead) {
        specs.push({
            id: 'type_undead',
            label: isEn ? 'Undead (Silver Vulnerable)' : 'アンデッド (銀有効)',
            type: 'info'
        });
    }

    if (traits.isDemon) {
        specs.push({
            id: 'type_demon',
            label: isEn ? 'Demon (Silver Vulnerable)' : '悪魔 (銀有効)',
            type: 'danger'
        });
    }

    // 3. 弱点 (Weaknesses)
    if (weaknesses.length > 0) {
        const weakLabels = weaknesses.map(w => (isEn ? (WEAKNESS_LABELS_EN[w] || w) : (WEAKNESS_LABELS_JA[w] || w)));
        specs.push({
            id: 'weaknesses',
            label: isEn ? `Weakness: ${weakLabels.join(', ')}` : `有効な攻撃: ${weakLabels.join(', ')}`,
            type: 'success'
        });
    }

    // 4. 固有耐性 (Resistances)
    if (resistances.length > 0) {
        const resLabels = resistances.map(r => (isEn ? (RESIST_LABELS_EN[r] || r) : (RESIST_LABELS_JA[r] || r)));
        specs.push({
            id: 'resistances',
            label: isEn ? `Resist: ${resLabels.join(', ')}` : `耐性: ${resLabels.join(', ')}`,
            type: 'info'
        });
    }

    // 5. 死体情報 (Corpse Traits & Resistances)
    if (corpse.causesPetrification) {
        specs.push({
            id: 'corpse_hazard_petrify',
            label: isEn ? 'Corpse: Touch Petrifies (Wear Gloves)' : '死体: 接触石化 (手袋必須)',
            type: 'danger',
            highlight: true
        });
    }

    if (corpse.causesSlime) {
        specs.push({
            id: 'corpse_hazard_slime',
            label: isEn ? 'Corpse: Slime Hazard (Inedible)' : '死体: スライム化 (摂取不可)',
            type: 'danger'
        });
    }

    if (Array.isArray(corpse.grantsIntrinsics) && corpse.grantsIntrinsics.length > 0) {
        const grantLabels = corpse.grantsIntrinsics.map(r => (isEn ? (RESIST_LABELS_EN[r] || r) : (RESIST_LABELS_JA[r] || r)));
        specs.push({
            id: 'corpse_grants',
            label: isEn ? `Corpse Grants: ${grantLabels.join(', ')}` : `死体摂取特典: ${grantLabels.join(', ')} 獲得`,
            type: 'success'
        });
    }

    return specs;
}

/**
 * モンスター知識オブジェクトから図鑑・Look表示用の動的サマリー文字列配列（旧 tacticalAdvice 互換）を生成
 * @param {Object} knowledge 
 * @param {Object} [options={}] 
 * @returns {string[]} 表示用スペックサマリー文字列リスト
 */
export function getMonsterSpecSummaryStrings(knowledge, options = {}) {
    const specs = getAdaptiveMonsterSpecs(knowledge, options);
    if (!specs || specs.length === 0) {
        const isEn = (options.language === 'en');
        const stats = knowledge?.stats || {};
        const rawName = knowledge?.name || 'monster';
        return [
            isEn ? `Standard dungeon creature (${rawName}).` : `ダンジョンに生息する標準的な魔獣 (${rawName})。`,
            isEn ? `Hit Dice: ${stats.hd || 1}, AC: ${stats.ac || 10}. Standard combat tactics.` : `HD: ${stats.hd || 1}, AC: ${stats.ac || 10}。通常の戦術で対処してください。`
        ];
    }

    return specs.map(s => s.label);
}
