/**
 * LoreEntityCrossReference.js - エンティティと伝承（噂・神託）の相互参照・逆引きエンジン
 *
 * 【設計思想】
 * 1. 噂（RUMORS）や神託（ORACLES）に付与された relatedEntities から、
 *    モンスター（monOffset / id / name）やアイテム（onum / id / name）をキーにした
 *    O(1)〜O(k) の逆引きインデックスを構築・提供する。
 * 2. <nh-knowledge-card> や CodexModal、各種ツールから統一的に利用可能。
 */

import { RUMORS, ORACLES } from './data/LoreMasterData.js';

// 逆引きキャッシュ
let entityLoreIndex = null;

/**
 * 逆引きインデックスの構築（遅延初期化）
 * @private
 */
function buildEntityLoreIndex() {
  if (entityLoreIndex) return entityLoreIndex;

  const onumMap = new Map();       // onum (number) -> Array<LoreItem>
  const monOffsetMap = new Map();  // monOffset (number) -> Array<LoreItem>
  const nameMap = new Map();       // normalized string -> Array<LoreItem>
  const idMap = new Map();         // normalized id -> Array<LoreItem>

  const allLore = [...RUMORS, ...ORACLES];

  for (const lore of allLore) {
    if (!Array.isArray(lore.relatedEntities) || lore.relatedEntities.length === 0) {
      continue;
    }

    for (const ent of lore.relatedEntities) {
      // 1. onum (アイテム)
      if (ent.onum !== undefined && typeof ent.onum === 'number') {
        if (!onumMap.has(ent.onum)) onumMap.set(ent.onum, []);
        onumMap.get(ent.onum).push(lore);
      }

      // 2. monOffset (モンスター)
      if (ent.monOffset !== undefined && typeof ent.monOffset === 'number') {
        if (!monOffsetMap.has(ent.monOffset)) monOffsetMap.set(ent.monOffset, []);
        monOffsetMap.get(ent.monOffset).push(lore);
      }

      // 3. ID
      if (ent.id) {
        const normId = String(ent.id).trim().toLowerCase();
        if (!idMap.has(normId)) idMap.set(normId, []);
        idMap.get(normId).push(lore);
      }

      // 4. 名称（英名・和名）
      if (ent.name) {
        const normName = String(ent.name).trim().toLowerCase();
        if (!nameMap.has(normName)) nameMap.set(normName, []);
        nameMap.get(normName).push(lore);
      }
      if (ent.nameJa) {
        const normNameJa = String(ent.nameJa).trim();
        if (!nameMap.has(normNameJa)) nameMap.set(normNameJa, []);
        nameMap.get(normNameJa).push(lore);
      }
    }
  }

  entityLoreIndex = { onumMap, monOffsetMap, nameMap, idMap };
  return entityLoreIndex;
}

/**
 * 指定エンティティに関連する伝承（噂・神託）を検索
 * @param {Object|string|number} target - 検索対象
 * @param {Object} [options={}]
 * @param {boolean} [options.includeOracles=true] - 神託を含めるか
 * @param {boolean} [options.includeRumors=true] - 噂を含めるか
 * @returns {Array<Object>} マッチした伝承エントリの配列（重複排除）
 */
export function findLoreForEntity(target, options = {}) {
  if (!target) return [];

  const { includeOracles = true, includeRumors = true } = options;
  const index = buildEntityLoreIndex();
  const matchedSet = new Set();
  const results = [];

  const addLore = (lore) => {
    if (!lore || matchedSet.has(lore.id)) return;
    if (lore.category === 'RUMOR' && !includeRumors) return;
    if (lore.category === 'ORACLE' && !includeOracles) return;
    matchedSet.add(lore.id);
    results.push(lore);
  };

  // 文字列の場合
  if (typeof target === 'string') {
    const q = target.trim().toLowerCase();
    // IDマッチ
    if (index.idMap.has(q)) {
      for (const item of index.idMap.get(q)) addLore(item);
    }
    // 名前マッチ
    if (index.nameMap.has(q)) {
      for (const item of index.nameMap.get(q)) addLore(item);
    }
    if (index.nameMap.has(target.trim())) {
      for (const item of index.nameMap.get(target.trim())) addLore(item);
    }
    return results;
  }

  // 数値（onum または monOffset とみなす）
  if (typeof target === 'number') {
    if (index.onumMap.has(target)) {
      for (const item of index.onumMap.get(target)) addLore(item);
    }
    if (index.monOffsetMap.has(target)) {
      for (const item of index.monOffsetMap.get(target)) addLore(item);
    }
    return results;
  }

  // オブジェクトの場合
  if (typeof target === 'object') {
    // 1. onum (アイテム)
    const onum = target.onum ?? target.knowledge?.onum ?? target.identification?.onum;
    if (onum !== undefined && typeof onum === 'number' && index.onumMap.has(onum)) {
      for (const item of index.onumMap.get(onum)) addLore(item);
    }

    // 2. monOffset (モンスター)
    const monOffset = target.monOffset ?? target.knowledge?.monOffset ?? target.stats?.monOffset;
    if (monOffset !== undefined && typeof monOffset === 'number' && index.monOffsetMap.has(monOffset)) {
      for (const item of index.monOffsetMap.get(monOffset)) addLore(item);
    }

    // 3. ID 検索
    const idCandidates = [
      target.id,
      target.knowledge?.id,
      target.monId,
      target.itemId
    ].filter(Boolean);

    for (const id of idCandidates) {
      const q = String(id).trim().toLowerCase();
      if (index.idMap.has(q)) {
        for (const item of index.idMap.get(q)) addLore(item);
      }
    }

    // 4. 名前（英名・和名）検索
    const nameCandidates = [
      target.name,
      target.nameEn,
      target.nameJa,
      target.trueName,
      target.oc_name,
      target.english,
      target.japanese,
      target.japaneseName,
      target.rawName,
      target.knowledge?.name,
      target.knowledge?.nameEn,
      target.knowledge?.nameJa
    ].filter(Boolean);

    for (const name of nameCandidates) {
      const norm = String(name).trim().toLowerCase();
      if (index.nameMap.has(norm)) {
        for (const item of index.nameMap.get(norm)) addLore(item);
      }
      if (index.nameMap.has(String(name).trim())) {
        for (const item of index.nameMap.get(String(name).trim())) addLore(item);
      }
    }
  }

  return results;
}
