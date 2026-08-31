/**
 * OBJECT_CATEGORY_ADVICE.js
 * NetHack アイテムカテゴリ推定ユーティリティおよびカテゴリ基本構造体
 * 
 * 🧹 クリーン設計: 手書き長文Tips・アドバイスは全廃。純粋なカテゴリメタデータのみを定義。
 */

export const OBJECT_CATEGORY_ADVICE = {
    POTION: { category: 'POTION' },
    SCROLL: { category: 'SCROLL' },
    WAND: { category: 'WAND' },
    RING: { category: 'RING' },
    AMULET: { category: 'AMULET' },
    WEAPON: { category: 'WEAPON' },
    ARMOR: { category: 'ARMOR' },
    FOOD: { category: 'FOOD' },
    CONTAINER: { category: 'CONTAINER' },
    TOOL: { category: 'TOOL' },
    SPELLBOOK: { category: 'SPELLBOOK' },
    GEM: { category: 'GEM' }
};

export function inferObjectCategory(itemName) {
    if (!itemName) return OBJECT_CATEGORY_ADVICE.TOOL;
    const lower = itemName.toLowerCase();

    if (lower.includes('potion') || lower.includes('vial') || lower.includes('flask') || lower.includes('smoky') || lower.includes('cloudy') || lower.includes('clear') || lower.includes('murky') || lower.includes('fizzy') || lower.includes('bubbly') || lower.includes('viscous') || lower.includes('milky')) {
        return OBJECT_CATEGORY_ADVICE.POTION;
    }
    if (lower.includes('scroll') || lower.includes('paper') || lower.includes('parchment') || lower.includes('labeled') || lower.includes('stamped') || lower.includes('vellum')) {
        return OBJECT_CATEGORY_ADVICE.SCROLL;
    }
    if (lower.includes('wand') || lower.includes('staff') || lower.includes('rod') || lower.includes('balsa') || lower.includes('marble wand') || lower.includes('ebony') || lower.includes('oak') || lower.includes('pine') || lower.includes('copper wand') || lower.includes('iron wand') || lower.includes('brass wand') || lower.includes('silver wand') || lower.includes('glass wand') || lower.includes('short wand') || lower.includes('long wand') || lower.includes('runed wand') || lower.includes('curved wand')) {
        return OBJECT_CATEGORY_ADVICE.WAND;
    }
    if (lower.includes('ring') || lower.includes('band') || lower.includes('ruby') || lower.includes('sapphire') || lower.includes('emerald ring') || lower.includes('pearl ring') || lower.includes('diamond ring') || lower.includes('topaz') || lower.includes('opal') || lower.includes('granite') || lower.includes('wire ring') || lower.includes('engagement') || lower.includes('shiny ring') || lower.includes('wooden ring') || lower.includes('iron ring') || lower.includes('brass ring') || lower.includes('silver ring') || lower.includes('gold ring')) {
        return OBJECT_CATEGORY_ADVICE.RING;
    }
    if (lower.includes('amulet') || lower.includes('pendant') || lower.includes('talisman') || lower.includes('necklace') || lower.includes('medallion')) {
        return OBJECT_CATEGORY_ADVICE.AMULET;
    }
    if (lower.includes('sword') || lower.includes('dagger') || lower.includes('spear') || lower.includes('arrow') || lower.includes('bow') || lower.includes('axe') || lower.includes('mace') || lower.includes('dart') || lower.includes('javelin') || lower.includes('flail') || lower.includes('scimitar') || lower.includes('halberd') || lower.includes('trident') || lower.includes('lance') || lower.includes('crossbow') || lower.includes('sling') || lower.includes('club') || lower.includes('staff') || lower.includes('hammer')) {
        return OBJECT_CATEGORY_ADVICE.WEAPON;
    }
    if (lower.includes('armor') || lower.includes('mail') || lower.includes('helmet') || lower.includes('shield') || lower.includes('cloak') || lower.includes('boots') || lower.includes('gloves') || lower.includes('gauntlets') || lower.includes('helm') || lower.includes('cap') || lower.includes('suit') || lower.includes('dragon scale') || lower.includes('shirt') || lower.includes('robe')) {
        return OBJECT_CATEGORY_ADVICE.ARMOR;
    }
    if (lower.includes('food') || lower.includes('ration') || lower.includes('apple') || lower.includes('pear') || lower.includes('candy') || lower.includes('lembas') || lower.includes('cram') || lower.includes('meat') || lower.includes('tripe') || lower.includes('orange') || lower.includes('banana') || lower.includes('cookie') || lower.includes('pancake') || lower.includes('melon')) {
        return OBJECT_CATEGORY_ADVICE.FOOD;
    }
    if (lower.includes('box') || lower.includes('chest') || lower.includes('bag') || lower.includes('sack') || lower.includes('coffer') || lower.includes('large box') || lower.includes('trunk')) {
        return OBJECT_CATEGORY_ADVICE.CONTAINER;
    }
    if (lower.includes('spellbook') || lower.includes('book') || lower.includes('tome') || lower.includes('grimoire') || lower.includes('papyrus')) {
        return OBJECT_CATEGORY_ADVICE.SPELLBOOK;
    }
    if (lower.includes('gem') || lower.includes('glass') || lower.includes('stone') || lower.includes('agate') || lower.includes('fluorite') || lower.includes('turquoise') || lower.includes('aquamarine') || lower.includes('garnet') || lower.includes('amethyst') || lower.includes('citrine') || lower.includes('obsidian') || lower.includes('amber') || lower.includes('jade')) {
        return OBJECT_CATEGORY_ADVICE.GEM;
    }

    return OBJECT_CATEGORY_ADVICE.TOOL;
}
