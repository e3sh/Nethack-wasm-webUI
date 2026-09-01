import { describe, it, expect } from 'vitest';
import { 
    CHEMISTRY_INTERACTIONS, 
    getInteractionsByTerrain, 
    getInteractionsByItem 
} from './CHEMISTRY_KNOWLEDGE_BASE.js';
import { TERRAIN_KNOWLEDGE_MAP } from './TERRAIN_KNOWLEDGE_BASE.js';

describe('GKL SSOT Phase 5 - アイテム・環境ケミストリー構造化ナレッジ (Chemistry Knowledge SSOT)', () => {

    describe('1. マスターデータ完全性 ＆ スキーマ検証 (Schema Integrity)', () => {
        it('全ケミストリールールが一意なID、有効なカテゴリ、トリガー、エフェクトを保持していること', () => {
            const ids = new Set();
            for (const chem of CHEMISTRY_INTERACTIONS) {
                expect(chem.id).toBeDefined();
                expect(ids.has(chem.id), `Duplicate chemistry ID: ${chem.id}`).toBe(false);
                ids.add(chem.id);

                expect(['TERRAIN_ITEM', 'ITEM_ITEM', 'HAZARD']).toContain(chem.category);
                expect(chem.trigger).toBeDefined();
                expect(chem.effect).toBeDefined();
                expect(chem.effect.type).toBeDefined();
                expect(chem.messages).toBeDefined();
                expect(chem.messages.adviceEn).toBeDefined();
                expect(chem.messages.adviceJa).toBeDefined();
            }
        });

        it('アクションを伴うルールは keySequence, verb, risk が正しく定義されていること', () => {
            for (const chem of CHEMISTRY_INTERACTIONS) {
                if (chem.action) {
                    expect(chem.action.verb).toBeDefined();
                    expect(Array.isArray(chem.action.keySequence)).toBe(true);
                    expect(chem.action.keySequence.length).toBeGreaterThan(0);
                    expect(chem.action.labelEn).toBeDefined();
                    expect(chem.action.labelJa).toBeDefined();
                }
            }
        });
    });

    describe('2. 地形 × アイテム相互作用 (Terrain Interactions)', () => {
        it('流し台 (sink) での指輪落とし識別が d ドロップ・CRITICALリスクで定義されていること', () => {
            const sinkRules = getInteractionsByTerrain('sink');
            expect(sinkRules.length).toBeGreaterThanOrEqual(1);

            const ringRule = sinkRules.find(r => r.id === 'CHEMISTRY_SINK_DROP_RING');
            expect(ringRule).toBeDefined();
            expect(ringRule.action.verb).toBe('d');
            expect(ringRule.action.keySequence).toEqual(['d', '${ringLetter}']);
            expect(ringRule.action.risk).toBe('CRITICAL');
            expect(ringRule.action.consumesItem).toBe(true);
            expect(ringRule.effect.consumesItem).toBe(true);
            expect(ringRule.messages.adviceJa).toContain('消滅');
        });

        it('TERRAIN_KNOWLEDGE_MAP の sink が正しく更新され、ケミストリーと連携していること', () => {
            const sink = TERRAIN_KNOWLEDGE_MAP.sink;
            expect(sink).toBeDefined();
            expect(sink.defaultVerb).toBe('q');
            expect(sink.actionLabel).toContain('Drink from sink');
            expect(sink.interactions).toContain('CHEMISTRY_SINK_DROP_RING');
        });

        it('神壇 (altar) での BUC 判定および生贄ルールが正しく取得できること', () => {
            const altarRules = getInteractionsByTerrain('altar');
            expect(altarRules.length).toBeGreaterThanOrEqual(2);

            const bucRule = altarRules.find(r => r.id === 'CHEMISTRY_ALTAR_BUC_DROP');
            expect(bucRule).toBeDefined();
            expect(bucRule.action.verb).toBe('d');
            expect(bucRule.effect.type).toBe('BUC_IDENTIFY');

            const sacrificeRule = altarRules.find(r => r.id === 'CHEMISTRY_ALTAR_OFFER_CORPSE');
            expect(sacrificeRule).toBeDefined();
            expect(sacrificeRule.action.verb).toBe('#offer');
            expect(sacrificeRule.effect.type).toBe('DIVINE_FAVOR');
        });

        it('泉 (fountain) でのポーション水化および長剣浸しルールが正しく取得できること', () => {
            const fountainRules = getInteractionsByTerrain('fountain');
            expect(fountainRules.length).toBeGreaterThanOrEqual(2);

            const waterRule = fountainRules.find(r => r.id === 'CHEMISTRY_FOUNTAIN_DIP_POTION');
            expect(waterRule).toBeDefined();
            expect(waterRule.action.verb).toBe('#dip');
            expect(waterRule.effect.type).toBe('CREATE_WATER');

            const excalRule = fountainRules.find(r => r.id === 'CHEMISTRY_FOUNTAIN_DIP_LONG_SWORD');
            expect(excalRule).toBeDefined();
            expect(excalRule.action.verb).toBe('#dip');
            expect(excalRule.effect.type).toBe('EXCALIBUR_CHANCE');
        });
    });

    describe('3. アイテム × アイテム相互作用 ＆ ハザード (Item Interactions & Hazards)', () => {
        it('ユニコーンの角 (unicorn horn) の薬中和ルールが正しく取得できること', () => {
            const hornRules = getInteractionsByItem('unicorn horn');
            expect(hornRules.length).toBeGreaterThanOrEqual(1);

            const dipRule = hornRules.find(r => r.id === 'CHEMISTRY_UNICORN_HORN_DIP_POTION');
            expect(dipRule).toBeDefined();
            expect(dipRule.action.verb).toBe('#dip');
            expect(dipRule.effect.type).toBe('NEUTRALIZE_POISON');
        });

        it('恐怖の巻物 (scroll of scare monster) の床置き結界ルールがCRITICAL警告付きで定義されていること', () => {
            const scareRules = getInteractionsByItem('scroll of scare monster');
            expect(scareRules.length).toBeGreaterThanOrEqual(1);

            const wardRule = scareRules.find(r => r.id === 'CHEMISTRY_SCARE_MONSTER_FLOOR_WARD');
            expect(wardRule).toBeDefined();
            expect(wardRule.action.verb).toBe('d');
            expect(wardRule.action.risk).toBe('CRITICAL');
            expect(wardRule.effect.type).toBe('WARDING');
        });

        it('手品袋 (bag of holding) の大爆発ハザードが LETHAL リスクで定義されていること', () => {
            const bagRules = getInteractionsByItem('bag of holding');
            expect(bagRules.length).toBeGreaterThanOrEqual(1);

            const boomRule = bagRules.find(r => r.id === 'CHEMISTRY_BAG_OF_HOLDING_EXPLOSION');
            expect(boomRule).toBeDefined();
            expect(boomRule.effect.risk).toBe('LETHAL');
            expect(boomRule.effect.type).toBe('MAGICAL_EXPLOSION');
            expect(boomRule.messages.adviceJa).toContain('大爆発');
        });

        it('試金石 (touchstone) の宝石鑑定ルールが取得できること', () => {
            const stoneRules = getInteractionsByItem('touchstone');
            expect(stoneRules.length).toBeGreaterThanOrEqual(1);

            const gemRule = stoneRules.find(r => r.id === 'CHEMISTRY_TOUCHSTONE_GEM_TEST');
            expect(gemRule).toBeDefined();
            expect(gemRule.action.verb).toBe('a');
            expect(gemRule.effect.type).toBe('IDENTIFY_GEM');
        });
    });
});
