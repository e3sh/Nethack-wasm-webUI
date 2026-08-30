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
    }

    const category = knowledge?.category || overrides.category || 'OTHER';

    return {
        invlet,
        letter: invlet,
        onum,
        name,
        category,
        knowledge: knowledge ? { ...knowledge } : null,
        rawText: `${invlet} - an uncursed ${name}`,
        isIdentified: true,
        count: 1,
        ...overrides
    };
}
