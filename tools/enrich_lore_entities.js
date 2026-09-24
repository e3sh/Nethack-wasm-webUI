/**
 * enrich_lore_entities.js
 * 
 * LoreMasterData.js の Rumors および Oracles に
 * Structured Knowledge のモンスター・アイテム・アーティファクトの関連参照 (relatedEntities) を付与する
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ALL_MONSTER_KNOWLEDGE_BASE } from '../src/core/knowledge/data/MONSTER_KNOWLEDGE_FULL.js';
import { OBJECT_KNOWLEDGE_MAP } from '../src/core/knowledge/data/OBJECT_KNOWLEDGE_FULL.js';
import { RUMORS, ORACLES, ENGRAVINGS, LORE_MASTER } from '../src/core/lore/data/LoreMasterData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.resolve(WORKSPACE_ROOT, 'src/core/lore/data/LoreMasterData.js');

// 1. エンティティインデックスの構築
const monsterList = [];
const monsterMapByEn = new Map();

for (const mon of ALL_MONSTER_KNOWLEDGE_BASE) {
    if (!mon.name) continue;
    const cleanEn = mon.name.replace(/\{.*?\}/g, '').trim().toLowerCase();
    const entry = {
        type: 'MONSTER',
        id: mon.id || `mon_${mon.monOffset}`,
        monOffset: mon.monOffset,
        name: mon.name,
        cleanEn: cleanEn,
        nameJa: mon.nameJa || '',
        symbol: mon.symbol || '',
        dangerLevel: mon.dangerLevel || 'MEDIUM'
    };
    monsterList.push(entry);
    monsterMapByEn.set(cleanEn, entry);
    // エイリアス登録
    if (Array.isArray(mon.aliases)) {
        for (const a of mon.aliases) {
            if (a) monsterMapByEn.set(a.toLowerCase(), entry);
        }
    }
}

const itemList = [];
const itemMapByEn = new Map();

for (const [onum, obj] of OBJECT_KNOWLEDGE_MAP.entries()) {
    if (!obj.name) continue;
    const cleanEn = obj.name.replace(/\{.*?\}/g, '').trim().toLowerCase();
    const entry = {
        type: 'ITEM',
        id: obj.id || `obj_${onum}`,
        onum: onum,
        name: obj.name,
        cleanEn: cleanEn,
        nameJa: obj.nameJa || '',
        category: obj.category || 'TOOL',
        symbol: obj.symbol || '?',
        cost: obj.cost || 0
    };
    itemList.push(entry);
    itemMapByEn.set(cleanEn, entry);
    if (obj.baseName) {
        itemMapByEn.set(obj.baseName.toLowerCase(), entry);
    }
}

// 2. オーバーライド定義の読み込み (tools/lore_entity_overrides.json)
const OVERRIDES_PATH = path.resolve(__dirname, 'lore_entity_overrides.json');
let OVERRIDES = { rumors: {}, oracles: {} };

if (fs.existsSync(OVERRIDES_PATH)) {
    try {
        const rawJson = fs.readFileSync(OVERRIDES_PATH, 'utf-8');
        OVERRIDES = JSON.parse(rawJson);
        console.log(`Loaded overrides from ${OVERRIDES_PATH}`);
    } catch (err) {
        console.warn(`Warning: Failed to load ${OVERRIDES_PATH}:`, err.message);
    }
}

const monsterMapById = new Map();
for (const entry of monsterList) {
    if (entry.id) monsterMapById.set(entry.id, entry);
}

const itemMapById = new Map();
for (const entry of itemList) {
    if (entry.id) itemMapById.set(entry.id, entry);
}

function resolveEntity(entry) {
    if (!entry) return null;
    const type = entry.type;
    const cleanEn = (entry.cleanEn || entry.name || '').trim().toLowerCase();
    const id = entry.id;

    if (type === 'MONSTER') {
        const mon = (id && monsterMapById.get(id)) || monsterMapByEn.get(cleanEn);
        if (mon) {
            return {
                type: 'MONSTER',
                id: mon.id,
                monOffset: mon.monOffset,
                name: mon.name,
                nameJa: mon.nameJa,
                symbol: mon.symbol,
                dangerLevel: mon.dangerLevel
            };
        }
    } else if (type === 'ITEM') {
        const item = (id && itemMapById.get(id)) || itemMapByEn.get(cleanEn);
        if (item) {
            return {
                type: 'ITEM',
                id: item.id,
                onum: item.onum,
                name: item.name,
                nameJa: item.nameJa,
                category: item.category,
                symbol: item.symbol
            };
        }
    }
    return null;
}

// 誤検出を避けるストップワード（短すぎる語、日常語）
const STOPWORDS_EN = new Set([
    "a", "an", "the", "in", "to", "or", "and", "of", "it", "is", "be", "can", "will", "may",
    "well", "long", "short", "large", "small", "water", "stone", "gold", "iron", "wood",
    "silver", "food", "egg", "tin", "dog", "cat", "worm", "boots", "shoes", "gloves",
    "ring", "wand", "scroll", "potion", "spellbook", "amulet", "cloak", "helmet", "armor",
    "shield", "sword", "dagger", "knife", "bow", "arrow", "gem", "rock", "tool", "food ration"
]);

function isGenericItem(name) {
    return name.startsWith("generic ") || name === "strange object";
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 3. マッチング関数 (自然言語・キーワードによる自動同定)
function matchEntities(textEn, textJa) {
    const matched = new Map();

    // A. モンスター自動マッチング (長い名前順)
    const sortedMonsters = [...monsterList].sort((a, b) => b.cleanEn.length - a.cleanEn.length);
    for (const mon of sortedMonsters) {
        if (STOPWORDS_EN.has(mon.cleanEn)) continue;
        if (mon.cleanEn.length < 3) continue;

        let isMatch = false;

        // 英語テキストマッチ (境界チェック & 複数形)
        const regex = new RegExp(`\\b${escapeRegExp(mon.cleanEn)}(s|es)?\\b`, 'i');
        if (regex.test(textEn)) {
            isMatch = true;
        }

        // 日本語テキストマッチ (カタカナ境界または漢字境界チェック)
        if (!isMatch && textJa && mon.nameJa) {
            const nj = mon.nameJa;
            if (/[\u30A1-\u30FA]/.test(nj)) {
                // カタカナを含む場合: 前後にカタカナ・長音記号がないこと
                const katakanaRegex = new RegExp(`(?<![\u30A1-\u30FA\u30FC])${escapeRegExp(nj)}(?![\u30A1-\u30FA\u30FC])`);
                if (katakanaRegex.test(textJa)) {
                    isMatch = true;
                }
            } else if (nj.length >= 2) {
                // 漢字等の場合: 前後に同種漢字がないこと
                const kanjiRegex = new RegExp(`(?<![\u4E00-\u9FFF])${escapeRegExp(nj)}(?![\u4E00-\u9FFF])`);
                if (kanjiRegex.test(textJa)) {
                    // 2文字漢字は英語側でも何らかの関連があるか、または固有名詞か
                    isMatch = true;
                }
            }
        }

        if (isMatch) {
            // 包含関係チェック
            let subsumed = false;
            for (const existing of matched.values()) {
                if (existing.type === 'MONSTER' && existing.name.toLowerCase().includes(mon.cleanEn) && existing.id !== mon.id) {
                    subsumed = true;
                    break;
                }
            }
            if (!subsumed) {
                matched.set(`MONSTER_${mon.id}`, {
                    type: 'MONSTER',
                    id: mon.id,
                    monOffset: mon.monOffset,
                    name: mon.name,
                    nameJa: mon.nameJa,
                    symbol: mon.symbol,
                    dangerLevel: mon.dangerLevel
                });
            }
        }
    }

    // C. アイテム自動マッチング (長い名前順)
    const sortedItems = [...itemList].sort((a, b) => b.cleanEn.length - a.cleanEn.length);
    for (const item of sortedItems) {
        if (isGenericItem(item.cleanEn)) continue;
        if (STOPWORDS_EN.has(item.cleanEn)) continue;
        if (item.cleanEn.length < 3) continue;

        let isMatch = false;

        const regex = new RegExp(`\\b${escapeRegExp(item.cleanEn)}(s|es)?\\b`, 'i');
        if (regex.test(textEn)) {
            isMatch = true;
        }

        if (!isMatch && textJa && item.nameJa) {
            const nj = item.nameJa;
            if (/[\u30A1-\u30FA]/.test(nj)) {
                const katakanaRegex = new RegExp(`(?<![\u30A1-\u30FA\u30FC])${escapeRegExp(nj)}(?![\u30A1-\u30FA\u30FC])`);
                if (katakanaRegex.test(textJa)) {
                    isMatch = true;
                }
            } else if (nj.length >= 2) {
                const kanjiRegex = new RegExp(`(?<![\u4E00-\u9FFF])${escapeRegExp(nj)}(?![\u4E00-\u9FFF])`);
                if (kanjiRegex.test(textJa)) {
                    isMatch = true;
                }
            }
        }

        if (isMatch) {
            let subsumed = false;
            for (const existing of matched.values()) {
                if (existing.type === 'ITEM' && existing.name.toLowerCase().includes(item.cleanEn) && existing.id !== item.id) {
                    subsumed = true;
                    break;
                }
            }
            if (!subsumed) {
                matched.set(`ITEM_${item.id}`, {
                    type: 'ITEM',
                    id: item.id,
                    onum: item.onum,
                    name: item.name,
                    nameJa: item.nameJa,
                    category: item.category,
                    symbol: item.symbol
                });
            }
        }
    }

    return Array.from(matched.values());
}

// 4. オーバーライド（手動追加・除外）の適用
function applyOverrides(entryId, baseEntities, isOracle) {
    const targetMap = isOracle ? OVERRIDES.oracles : OVERRIDES.rumors;
    const over = targetMap?.[entryId];
    if (!over) return baseEntities;

    let result = [...baseEntities];

    // 除外 (remove)
    if (Array.isArray(over.remove) && over.remove.length > 0) {
        const removeKeys = new Set(over.remove.map(r => String(r).toLowerCase().trim()));
        result = result.filter(e => {
            const idMatch = e.id && removeKeys.has(e.id.toLowerCase());
            const nameMatch = e.name && removeKeys.has(e.name.toLowerCase());
            const nameJaMatch = e.nameJa && removeKeys.has(e.nameJa.toLowerCase());
            return !idMatch && !nameMatch && !nameJaMatch;
        });
    }

    // 追加 (add)
    if (Array.isArray(over.add) && over.add.length > 0) {
        for (const addDef of over.add) {
            const resolved = resolveEntity(addDef);
            if (resolved) {
                const alreadyExists = result.some(e => e.id === resolved.id);
                if (!alreadyExists) {
                    result.push(resolved);
                }
            }
        }
    }

    return result;
}

// 5. 全噂話および神託の処理
console.log("Processing Rumors and Oracles...");

let rumorsLinkedCount = 0;
const enrichedRumors = RUMORS.map(r => {
    const baseEntities = matchEntities(r.text, r.translatedText);
    const related = applyOverrides(r.id, baseEntities, false);
    if (related.length > 0) rumorsLinkedCount++;
    return {
        ...r,
        relatedEntities: related
    };
});

let oraclesLinkedCount = 0;
const enrichedOracles = ORACLES.map(o => {
    const baseEntities = matchEntities(o.text, o.translatedText);
    const related = applyOverrides(o.id, baseEntities, true);
    if (related.length > 0) oraclesLinkedCount++;
    return {
        ...o,
        relatedEntities: related
    };
});

console.log(`Rumors linked: ${rumorsLinkedCount} / ${RUMORS.length} (${(rumorsLinkedCount / RUMORS.length * 100).toFixed(1)}%)`);
console.log(`Oracles linked: ${oraclesLinkedCount} / ${ORACLES.length} (${(oraclesLinkedCount / ORACLES.length * 100).toFixed(1)}%)`);

// サンプル出力
console.log("\n--- Sample Enriched Rumors (First 8) ---");
const samples = enrichedRumors.filter(r => r.relatedEntities.length > 0).slice(0, 8);
for (const s of samples) {
    console.log(`[${s.id}] ${s.text}`);
    if (s.translatedText) console.log(`  JP: ${s.translatedText}`);
    console.log(`  Related: ${JSON.stringify(s.relatedEntities.map(e => `${e.type}:${e.name}(${e.nameJa})`))}`);
}

// 5. LoreMasterData.js の生成・保存
const updatedMaster = {
    metadata: {
        ...LORE_MASTER.metadata,
        generatedAt: new Date().toISOString().split('T')[0],
        enrichedWithEntities: true,
        rumorsLinkedCount,
        oraclesLinkedCount
    },
    rumors: enrichedRumors,
    oracles: enrichedOracles,
    engravings: ENGRAVINGS
};

const jsContent = `/**
 * LoreMasterData.js - Layer 4: LORE & Collection SSOT Master Data
 *
 * Automatically generated and enriched by tools/enrich_lore_entities.js
 * Total Rumors: ${enrichedRumors.length} (Linked: ${rumorsLinkedCount})
 * Total Oracles: ${enrichedOracles.length} (Linked: ${oraclesLinkedCount})
 * Total Engravings: ${ENGRAVINGS.length}
 */

export const RUMORS = ${JSON.stringify(enrichedRumors, null, 2)};

export const ORACLES = ${JSON.stringify(enrichedOracles, null, 2)};

export const ENGRAVINGS = ${JSON.stringify(ENGRAVINGS, null, 2)};

export const LORE_MASTER = ${JSON.stringify(updatedMaster, null, 2)};

export default LORE_MASTER;
`;

fs.writeFileSync(OUTPUT_PATH, jsContent, 'utf-8');
console.log(`\nSuccessfully updated ${OUTPUT_PATH} (${fs.statSync(OUTPUT_PATH).size.toLocaleString()} bytes)!`);
