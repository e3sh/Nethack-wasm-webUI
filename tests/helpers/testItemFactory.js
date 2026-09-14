/**
 * testItemFactory.js
 * ナレッジ連動型テストファクトリ (Test Fixture & Factory Helper)
 *
 * 単体テスト・シナリオテストにおいて完全なナレッジ構造体を持つ
 * アイテムオブジェクトを簡潔に生成する。
 */

import { OBJECT_KNOWLEDGE_MAP } from '../../src/core/knowledge/OBJECT_KNOWLEDGE_FULL.js';
import { ITEM_KNOWLEDGE_BASE } from '../../src/core/knowledge/ITEM_KNOWLEDGE_BASE.js';

/**
 * テスト用アイテムオブジェクトを生成
 * @param {string|number} nameOrOnum - アイテム名 (英語) または onum 番号
 * @param {string} [invlet='a'] - インベントリレター
 * @param {Object} [overrides={}] - プロパティのオーバーライド
 * @returns {Object} 完全なナレッジプロパティを持つアイテムオブジェクト
 */
export function createTestItem(nameOrOnum, invlet = 'a', overrides = {}) {
    let onum = -1;
    let name = typeof nameOrOnum === 'string' ? nameOrOnum : 'unknown';
    let knowledge = null;

    if (typeof nameOrOnum === 'number') {
        onum = nameOrOnum;
        knowledge = OBJECT_KNOWLEDGE_MAP.get(onum) || null;
        if (knowledge && knowledge.name) {
            name = knowledge.name;
        }
    } else if (typeof nameOrOnum === 'string') {
        const query = nameOrOnum.toLowerCase();
        // 1. OBJECT_KNOWLEDGE_MAP から検索
        for (const [o, entry] of OBJECT_KNOWLEDGE_MAP.entries()) {
            if (entry && (entry.name?.toLowerCase() === query || entry.id?.toLowerCase() === query)) {
                onum = o;
                knowledge = entry;
                name = entry.name;
                break;
            }
        }

        // 2. なければ ITEM_KNOWLEDGE_BASE から検索
        if (!knowledge) {
            const kbEntry = ITEM_KNOWLEDGE_BASE.find(k =>
                k.name?.toLowerCase() === query || k.id?.toLowerCase() === query
            );
            if (kbEntry) {
                onum = kbEntry.onum ?? -1;
                knowledge = kbEntry;
                name = kbEntry.name;
            }
        }

        // 3. マテリアルプレフィックス（iron, silver, wooden, leather等）を除去して再検索
        if (!knowledge) {
            const prefixes = ['iron ', 'silver ', 'wooden ', 'leather ', 'crystal '];
            for (const p of prefixes) {
                if (query.startsWith(p)) {
                    const stripped = query.substring(p.length);
                    for (const [o, entry] of OBJECT_KNOWLEDGE_MAP.entries()) {
                        if (entry && entry.name?.toLowerCase() === stripped) {
                            onum = o;
                            const mat = p.trim();
                            knowledge = { ...entry, material: mat };
                            if (mat === 'iron') knowledge.isMetallic = true;
                            if (mat === 'silver') { knowledge.isSilver = true; knowledge.isMetallic = true; }
                            name = entry.name;
                            break;
                        }
                    }
                    if (knowledge) break;
                }
            }
        }

        // 4. corpse (死体) 特殊判定: "xxx corpse" は corpse (onum: 269) のナレッジを参照
        if (!knowledge && query.endsWith('corpse')) {
            const isLizard = query.includes('lizard');
            const targetOnum = 269;
            const corpseEntry = OBJECT_KNOWLEDGE_MAP.get(targetOnum);
            if (corpseEntry) {
                onum = targetOnum;
                knowledge = {
                    ...corpseEntry,
                    name: nameOrOnum,
                    isCorpse: true,
                    effects: {
                        ...(corpseEntry.effects || {}),
                        ...(isLizard ? { curePetrification: true } : {})
                    }
                };
                name = nameOrOnum;
            }
        }
    }

    let category = knowledge?.category || overrides.category;
    if (!category) {
        const lowerName = name.toLowerCase();
        if (lowerName.endsWith('corpse')) category = 'FOOD';
        else if (overrides.oclass === 8 || (lowerName.endsWith('ring') && !lowerName.includes('mail'))) category = 'RING';
        else category = 'OTHER';
    }

    // カテゴリ連動ヘルパーフラグの導出
    const categoryFlags = {};
    if (category === 'WAND' || name.includes('wand')) categoryFlags.isWand = true;
    if (category === 'WEAPON') categoryFlags.isWeapon = true;
    if (category === 'ARMOR') categoryFlags.isArmor = true;
    if (category === 'RING') categoryFlags.isRing = true;
    if (category === 'POTION' || name.includes('potion')) categoryFlags.isPotion = true;
    if (category === 'SCROLL' || name.includes('scroll')) categoryFlags.isScroll = true;
    if (category === 'FOOD' || name.endsWith('corpse')) {
        categoryFlags.isFood = true;
        if (name.endsWith('corpse')) categoryFlags.isCorpse = true;
    }
    if (category === 'TOOL') categoryFlags.isTool = true;

    return {
        invlet,
        letter: invlet,
        onum,
        name,
        category,
        armorSlot: overrides.armorSlot || knowledge?.armorSlot || null,
        propConveyed: overrides.propConveyed || knowledge?.propConveyed || null,
        material: overrides.material || knowledge?.material || 'none',
        protectsAgainst: overrides.protectsAgainst || knowledge?.protectsAgainst || [],
        effects: overrides.effects || (knowledge?.effects ? { ...knowledge.effects } : {}),
        isSilver: overrides.isSilver !== undefined ? overrides.isSilver : (knowledge?.isSilver || knowledge?.material === 'silver' || false),
        isMetallic: overrides.isMetallic !== undefined ? overrides.isMetallic : (knowledge?.isMetallic || false),
        knowledge: knowledge ? { ...knowledge } : null,
        rawText: `${invlet} - an uncursed ${name}`,
        isIdentified: true,
        count: 1,
        ...categoryFlags,
        ...overrides
    };
}
