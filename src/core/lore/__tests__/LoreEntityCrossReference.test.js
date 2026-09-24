/**
 * LoreEntityCrossReference.test.js
 * 
 * Phase 1: Rumors / Oracles と Structured Knowledge (Monster & Item) の
 * クロスリファレンス（相互紐付け）整合性テスト
 */

import { describe, it, expect } from 'vitest';
import { RUMORS, ORACLES, LORE_MASTER } from '../data/LoreMasterData.js';

describe('Lore & Structured Knowledge Cross-Reference (Phase 1)', () => {
    it('LORE_MASTER メタデータにエンティティ付与フラグと集計が存在すること', () => {
        expect(LORE_MASTER.metadata).toBeDefined();
        expect(LORE_MASTER.metadata.enrichedWithEntities).toBe(true);
        expect(LORE_MASTER.metadata.rumorsLinkedCount).toBeGreaterThan(300);
        expect(LORE_MASTER.metadata.oraclesLinkedCount).toBeGreaterThan(15);
    });

    it('すべてのRumorsとOraclesが relatedEntities 配列フィールドを保持していること', () => {
        for (const r of RUMORS) {
            expect(Array.isArray(r.relatedEntities)).toBe(true);
        }
        for (const o of ORACLES) {
            expect(Array.isArray(o.relatedEntities)).toBe(true);
        }
    });

    it('すべての relatedEntities 要素が有効なスキーマ（type, id, name）を持つこと', () => {
        const allItems = [...RUMORS, ...ORACLES];
        let totalLinkedEntities = 0;

        for (const item of allItems) {
            for (const ent of item.relatedEntities) {
                totalLinkedEntities++;
                expect(['MONSTER', 'ITEM', 'ARTIFACT']).toContain(ent.type);
                expect(typeof ent.id).toBe('string');
                expect(ent.id.length).toBeGreaterThan(0);
                expect(typeof ent.name).toBe('string');
                expect(ent.name.length).toBeGreaterThan(0);
            }
        }

        expect(totalLinkedEntities).toBeGreaterThanOrEqual(400);
    });

    describe('代表的ゲームルール・噂話のクロスリファレンス検証', () => {
        it('rumor_tru_1: 目隠し (blindfold) が正しく紐づいていること', () => {
            const r = RUMORS.find(x => x.id === 'rumor_tru_1');
            expect(r).toBeDefined();
            expect(r.relatedEntities.some(e => e.type === 'ITEM' && e.name.toLowerCase().includes('blindfold'))).toBe(true);
        });

        it('rumor_tru_4: クリスタルプレートメイル (crystal plate mail) が正しく紐づき、誤爆がないこと', () => {
            const r = RUMORS.find(x => x.id === 'rumor_tru_4');
            expect(r).toBeDefined();
            expect(r.relatedEntities.some(e => e.type === 'ITEM' && e.name.toLowerCase().includes('crystal plate mail'))).toBe(true);
            // リスなどの誤爆がないこと
            expect(r.relatedEntities.some(e => e.nameJa === 'リス')).toBe(false);
        });

        it('rumor_tru_6: 刀 (katana) と ワーム (long worm) が正しく紐づいていること', () => {
            const r = RUMORS.find(x => x.id === 'rumor_tru_6');
            expect(r).toBeDefined();
            expect(r.relatedEntities.some(e => e.type === 'ITEM' && e.name.toLowerCase().includes('katana'))).toBe(true);
            expect(r.relatedEntities.some(e => e.type === 'MONSTER' && e.name.toLowerCase().includes('worm'))).toBe(true);
        });

        it('rumor_tru_184: メデューサ (medusa) と 鏡 (mirror) が正しく紐づいていること', () => {
            const r = RUMORS.find(x => x.id === 'rumor_tru_184');
            expect(r).toBeDefined();
            expect(r.relatedEntities.some(e => e.type === 'MONSTER' && e.name.toLowerCase().includes('medusa'))).toBe(true);
            expect(r.relatedEntities.some(e => e.type === 'ITEM' && e.name.toLowerCase().includes('mirror'))).toBe(true);
        });
    });

    describe('デルフィの神託（Oracles）のクロスリファレンス検証', () => {
        it('oracle_9: メデューサ、目隠し、鏡が正しく紐づいていること', () => {
            const o = ORACLES.find(x => x.id === 'oracle_9');
            expect(o).toBeDefined();
            expect(o.relatedEntities.some(e => e.type === 'MONSTER' && e.name.toLowerCase().includes('medusa'))).toBe(true);
            expect(o.relatedEntities.some(e => e.type === 'ITEM' && e.name.toLowerCase().includes('blindfold'))).toBe(true);
            expect(o.relatedEntities.some(e => e.type === 'ITEM' && e.name.toLowerCase().includes('mirror'))).toBe(true);
        });

        it('oracle_16: イェンダーの魔除け (amulet of yendor) が正しく紐づいていること', () => {
            const o = ORACLES.find(x => x.id === 'oracle_16');
            expect(o).toBeDefined();
            expect(o.relatedEntities.some(e => e.type === 'ITEM' && e.name.toLowerCase().includes('amulet of yendor'))).toBe(true);
        });

        it('oracle_17: 3大儀式アイテム（銀のベル、祈りの燭台、モロクの書）が正しく紐づいていること', () => {
            const o = ORACLES.find(x => x.id === 'oracle_17');
            expect(o).toBeDefined();
            expect(o.relatedEntities.some(e => e.name.toLowerCase().includes('bell of opening'))).toBe(true);
            expect(o.relatedEntities.some(e => e.name.toLowerCase().includes('candelabrum of invocation'))).toBe(true);
            expect(o.relatedEntities.some(e => e.name.toLowerCase().includes('book of the dead'))).toBe(true);
        });
    });

    describe('手動キュレーション＆オーバーライド（tools/lore_entity_overrides.json）の反映検証', () => {
        it('rumor_tru_3: 除外リストにより "food ration" が除外され、"cream pie" のみが紐づいていること', () => {
            const r = RUMORS.find(x => x.id === 'rumor_tru_3');
            expect(r).toBeDefined();
            expect(r.relatedEntities.some(e => e.name.toLowerCase() === 'food ration')).toBe(false);
            expect(r.relatedEntities.some(e => e.name.toLowerCase().includes('cream pie'))).toBe(true);
        });

        it('rumor_tru_77: 追加リストにより vampire と silver dagger が正しく反映されていること', () => {
            const r = RUMORS.find(x => x.id === 'rumor_tru_77');
            expect(r).toBeDefined();
            expect(r.relatedEntities.some(e => e.type === 'MONSTER' && e.name.toLowerCase().includes('vampire'))).toBe(true);
            expect(r.relatedEntities.some(e => e.type === 'ITEM' && e.name.toLowerCase().includes('silver dagger'))).toBe(true);
        });
    });
});
