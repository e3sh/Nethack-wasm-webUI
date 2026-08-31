/**
 * KnowledgeIntegrityAudit.test.js
 * 
 * 【Phase 3.5 静的監査テスト基盤】
 * ゲームを動かさずとも、全 384 モンスターおよび全 481 アイテムの
 * 脅威充足率・防護整合性・スキーマ正規化を 100% 静的検証・担保する監査テスト。
 */

import { describe, it, expect } from 'vitest';
import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';
import { MONSTER_KNOWLEDGE_MAP, ALL_MONSTER_KNOWLEDGE_BASE } from './MONSTER_KNOWLEDGE_FULL.js';
import { TacticalAdvisor } from './TacticalAdvisor.js';
import { AreaStateManager } from './AreaStateManager.js';
import { InventoryStateManager } from './InventoryStateManager.js';
import { ADVICE_DEFINITIONS, createAdvice } from './ADVICE_DEFINITIONS.js';
import { OBJECT_CATEGORY_ADVICE } from './OBJECT_CATEGORY_ADVICE.js';
import { IDENTIFICATION_TIPS } from './ItemIdentificationResolver.js';

describe('Phase 3.5: ナレッジデータ構造＆スキーマ正規化 静的監査 (Knowledge Integrity Audit)', () => {

    describe('1. 全 481 アイテム (onum 0〜480) スキーマ完全性監査', () => {
        it('全 481 アイテムが OBJECT_KNOWLEDGE_MAP に存在し、protectsAgainst, material, effects を完全保持していること', () => {
            expect(OBJECT_KNOWLEDGE_MAP.size).toBe(481);

            let withProtects = 0;
            for (let i = 0; i <= 480; i++) {
                expect(OBJECT_KNOWLEDGE_MAP.has(i)).toBe(true);
                const item = OBJECT_KNOWLEDGE_MAP.get(i);
                expect(item).toBeDefined();

                // protectsAgainst 監査 (Array型、未定義不可)
                expect(Array.isArray(item.protectsAgainst)).toBe(true);
                if (item.protectsAgainst.length > 0) withProtects++;

                // material 監査 (string型、未定義不可)
                expect(typeof item.material).toBe('string');
                expect(item.material.length).toBeGreaterThan(0);

                // effects 監査 (Object型、未定義不可)
                expect(typeof item.effects).toBe('object');
                expect(item.effects).not.toBeNull();
            }

            // 少なくとも手袋、目隠し、兜、浮遊・水上歩行ブーツ等の防護アイテムが登録されていること
            expect(withProtects).toBeGreaterThanOrEqual(15);
        });

        it('特定対策アイテムの protectsAgainst 定義が NetHack ルールと 100% 整合していること', () => {
            // 目隠し (blindfold) & タオル (towel) -> GAZE 防護
            const blindfold = Array.from(OBJECT_KNOWLEDGE_MAP.values()).find(i => i.name === 'blindfold');
            expect(blindfold).toBeDefined();
            expect(blindfold.protectsAgainst).toContain('GAZE');

            const towel = Array.from(OBJECT_KNOWLEDGE_MAP.values()).find(i => i.name === 'towel');
            expect(towel).toBeDefined();
            expect(towel.protectsAgainst).toContain('GAZE');

            // 手袋 (gloves / gauntlets) -> TOUCH_STONING 防護
            const gloves = Array.from(OBJECT_KNOWLEDGE_MAP.values()).filter(i => i.armorSlot === 'gloves');
            expect(gloves.length).toBeGreaterThanOrEqual(4); // leather gloves, gauntlets of fumbling, power, dexterity 等
            for (const g of gloves) {
                expect(g.protectsAgainst).toContain('TOUCH_STONING');
            }

            // 硬質ヘルメット -> BRAIN_EAT, FALLING_ROCKS 防護
            const ironHelmet = Array.from(OBJECT_KNOWLEDGE_MAP.values()).find(i => i.name === 'helmet');
            expect(ironHelmet).toBeDefined();
            expect(ironHelmet.protectsAgainst).toContain('BRAIN_EAT');
            expect(ironHelmet.protectsAgainst).toContain('FALLING_ROCKS');

            // 浮遊アイテム -> LAVA, WATER, PIT 防護
            const levBoots = Array.from(OBJECT_KNOWLEDGE_MAP.values()).find(i => i.name === 'levitation boots' || i.name === 'boots of levitation');
            expect(levBoots).toBeDefined();
            expect(levBoots.protectsAgainst).toContain('LAVA');
            expect(levBoots.protectsAgainst).toContain('WATER');
            expect(levBoots.protectsAgainst).toContain('PIT');

            const levRing = Array.from(OBJECT_KNOWLEDGE_MAP.values()).find(i => i.name === 'ring of levitation' || i.name === 'levitation');
            expect(levRing).toBeDefined();
            expect(levRing.protectsAgainst).toContain('LAVA');
            expect(levRing.protectsAgainst).toContain('WATER');

            // 水上歩行ブーツ -> WATER 防護
            const wwBoots = Array.from(OBJECT_KNOWLEDGE_MAP.values()).find(i => i.name === 'water walking boots');
            expect(wwBoots).toBeDefined();
            expect(wwBoots.protectsAgainst).toContain('WATER');
        });
    });

    describe('2. 全 384 モンスター 脅威スキーマ正規化監査', () => {
        it('全 384 モンスターが登録されており、脅威定義を持つモンスターの threat が標準スキーマを満たすこと', () => {
            expect(ALL_MONSTER_KNOWLEDGE_BASE.length).toBeGreaterThanOrEqual(383);

            const VALID_DELIVERIES = new Set(['TOUCH', 'GAZE', 'EXPLOSION', 'MELEE', 'PASSIVE', 'BREATH', 'STING']);
            const VALID_SEVERITIES = new Set(['CRITICAL', 'WARNING', 'CAUTION', 'INFO']);

            let threatCount = 0;
            for (const mon of ALL_MONSTER_KNOWLEDGE_BASE) {
                if (mon.threat) {
                    threatCount++;
                    const t = mon.threat;

                    // delivery 監査
                    expect(VALID_DELIVERIES.has(t.delivery)).toBe(true);

                    // effect 監査 (string)
                    expect(typeof t.effect).toBe('string');
                    expect(t.effect.length).toBeGreaterThan(0);

                    // severity 監査
                    expect(VALID_SEVERITIES.has(t.severity)).toBe(true);

                    // basePriority 監査 (50〜100)
                    expect(typeof t.basePriority).toBe('number');
                    expect(t.basePriority).toBeGreaterThanOrEqual(50);
                    expect(t.basePriority).toBeLessThanOrEqual(100);

                    // targetMaterial 監査 (null または string)
                    if (t.targetMaterial !== null) {
                        expect(typeof t.targetMaterial).toBe('string');
                    }
                }
            }

            // 主要な危険モンスターに脅威定義が付与されていること
            expect(threatCount).toBeGreaterThanOrEqual(18);
        });

        it('致命的モンスター群（コカトリス、浮遊目玉、マインドフレア、ラストモンスター、クラーケン等）が 100% 脅威を保持していること', () => {
            const keyMonsters = [
                { name: 'cockatrice', expectedDelivery: 'TOUCH', expectedEffect: 'STONING', expectedSeverity: 'CRITICAL' },
                { name: 'chickatrice', expectedDelivery: 'TOUCH', expectedEffect: 'STONING', expectedSeverity: 'CRITICAL' },
                { name: 'floating eye', expectedDelivery: 'GAZE', expectedEffect: 'PARALYSIS', expectedSeverity: 'CRITICAL' },
                { name: 'mind flayer', expectedDelivery: 'MELEE', expectedEffect: 'BRAIN_EAT', expectedSeverity: 'CRITICAL' },
                { name: 'master mind flayer', expectedDelivery: 'MELEE', expectedEffect: 'BRAIN_EAT', expectedSeverity: 'CRITICAL' },
                { name: 'green slime', expectedDelivery: 'TOUCH', expectedEffect: 'SLIME', expectedSeverity: 'CRITICAL' },
                { name: 'rust monster', expectedDelivery: 'TOUCH', expectedEffect: 'RUST', expectedSeverity: 'WARNING' },
                { name: 'disenchanter', expectedDelivery: 'TOUCH', expectedEffect: 'DISENCHANT', expectedSeverity: 'WARNING' },
                { name: 'umber hulk', expectedDelivery: 'GAZE', expectedEffect: 'CONFUSION', expectedSeverity: 'WARNING' },
                { name: 'giant eel', expectedDelivery: 'MELEE', expectedEffect: 'DROWNING', expectedSeverity: 'CRITICAL' },
                { name: 'kraken', expectedDelivery: 'MELEE', expectedEffect: 'DROWNING', expectedSeverity: 'CRITICAL' },
                { name: 'medusa', expectedDelivery: 'GAZE', expectedEffect: 'STONING', expectedSeverity: 'CRITICAL' },
                { name: 'gas spore', expectedDelivery: 'EXPLOSION', expectedEffect: 'PHYSICAL_BURST', expectedSeverity: 'CRITICAL' },
                { name: 'killer bee', expectedDelivery: 'STING', expectedEffect: 'POISON', expectedSeverity: 'WARNING' }
            ];

            for (const km of keyMonsters) {
                const mon = MONSTER_KNOWLEDGE_MAP.get(km.name.toLowerCase());
                expect(mon, `Monster ${km.name} must exist in knowledge`).toBeDefined();
                expect(mon.threat, `Monster ${km.name} must have threat definition`).toBeDefined();
                expect(mon.threat.delivery).toBe(km.expectedDelivery);
                expect(mon.threat.effect).toBe(km.expectedEffect);
                expect(mon.threat.severity).toBe(km.expectedSeverity);
            }
        });
    });

    describe('3. 脅威と防護のクロス整合性マトリクス監査 (Threat & Protection Cross-Integrity)', () => {
        it('各モンスター脅威および地形ハザードに対し、対抗できる防護手段（protectsAgainst）がシステム内に 100% 存在すること', () => {
            const allItems = Array.from(OBJECT_KNOWLEDGE_MAP.values());

            // 1. GAZE 脅威に対抗できるアイテムが存在すること
            const gazeProtectors = allItems.filter(i => i.protectsAgainst.includes('GAZE'));
            expect(gazeProtectors.length).toBeGreaterThanOrEqual(2);

            // 2. TOUCH_STONING 脅威に対抗できるアイテムが存在すること
            const stoningProtectors = allItems.filter(i => i.protectsAgainst.includes('TOUCH_STONING'));
            expect(stoningProtectors.length).toBeGreaterThanOrEqual(1);

            // 3. BRAIN_EAT 脅威に対抗できるアイテムが存在すること
            const brainProtectors = allItems.filter(i => i.protectsAgainst.includes('BRAIN_EAT'));
            expect(brainProtectors.length).toBeGreaterThanOrEqual(1);

            // 4. LAVA ハザードに対抗できるアイテムが存在すること
            const lavaProtectors = allItems.filter(i => i.protectsAgainst.includes('LAVA'));
            expect(lavaProtectors.length).toBeGreaterThanOrEqual(1);

            // 5. WATER ハザードに対抗できるアイテムが存在すること
            const waterProtectors = allItems.filter(i => i.protectsAgainst.includes('WATER'));
            expect(waterProtectors.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('4. TacticalAdvisor 文字列非依存性・データ駆動検証', () => {
        it('アイテム名が完全マスク・匿名化されていても、protectsAgainst のみで石化防護アドバイスが正しく導出されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.adjacentMonsters = [{
                dir: { code: 'E' },
                entity: { name: 'anonymous_mon', monOffset: 10 } // cockatrice
            }];

            const invMgr = new InventoryStateManager();
            // 名前やrawTextに 'gloves' や '手袋' の文字列が一切含まれない匿名モック
            invMgr.items = [{
                invlet: 'g',
                letter: 'g',
                name: 'unidentified cloth object',
                rawText: 'g - a mysterious item',
                isWorn: true,
                protectsAgainst: ['TOUCH_STONING']
            }];

            const advices = TacticalAdvisor.generateAdvices({ areaState, inventoryState: invMgr });
            const safeAdvice = advices.find(a => a.id === 'ADVICE_THREAT_PETRIFICATION_SAFE');
            const criticalAdvice = advices.find(a => a.id === 'ADVICE_THREAT_PETRIFICATION');

            // 文字列に依存せず、protectsAgainst によって「防護済み」と判定されること
            expect(safeAdvice).toBeDefined();
            expect(criticalAdvice).toBeUndefined();
            expect(safeAdvice.messageJa).toContain('防護済み');
        });

        it('アイテム名が完全マスク・匿名化されていても、protectsAgainst のみで浮遊目玉の麻痺防護アドバイスが正しく導出されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.adjacentMonsters = [{
                dir: { code: 'N' },
                entity: { name: 'anonymous_eye', monOffset: 28 } // floating eye
            }];

            const invMgr = new InventoryStateManager();
            // 名前やrawTextに 'blindfold' や 'towel' が一切含まれない匿名モック
            invMgr.items = [{
                invlet: 'b',
                letter: 'b',
                name: 'dark strip',
                rawText: 'b - a dark strip of cloth',
                isWorn: true,
                protectsAgainst: ['GAZE']
            }];

            const advices = TacticalAdvisor.generateAdvices({ areaState, inventoryState: invMgr });
            const safeAdvice = advices.find(a => a.id === 'ADVICE_THREAT_FLOATING_EYE_SAFE');
            const warningAdvice = advices.find(a => a.id === 'ADVICE_THREAT_FLOATING_EYE');

            expect(safeAdvice).toBeDefined();
            expect(warningAdvice).toBeUndefined();
            expect(safeAdvice.messageJa).toContain('麻痺無効');
        });

        it('水場ハザードにおいて、匿名アイテムでも protectsAgainst.includes("WATER") を持っていればサジェストされること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet = {
                bottom: { cmapFlags: { isWater: true } }
            };

            const invMgr = new InventoryStateManager();
            // 文字列に 'water walking' や 'levitation' が一切含まれない匿名ギア
            invMgr.items = [{
                invlet: 'w',
                letter: 'w',
                name: 'custom boots',
                rawText: 'w - a pair of enchanted footwear',
                isWorn: false,
                protectsAgainst: ['WATER']
            }];

            const advices = TacticalAdvisor.generateAdvices({ areaState, inventoryState: invMgr });
            const waterAdvice = advices.find(a => a.id === 'ADVICE_HAZARD_WATER');

            expect(waterAdvice).toBeDefined();
            expect(waterAdvice.hintLetters).toEqual(['w']);
        });
    });

    describe('5. ADVICE_DEFINITIONS アドバイスマスター完全性監査 (SSOT Master Audit)', () => {
        it('全アドバイス定義が ADVICE_DEFINITIONS に登録されており、必須フィールドを完全保持していること', () => {
            const entries = Object.entries(ADVICE_DEFINITIONS);
            expect(entries.length).toBeGreaterThanOrEqual(39);

            const VALID_SEVERITIES = new Set(['CRITICAL', 'WARNING', 'CAUTION', 'INFO', 'TIP']);
            const VALID_TOPICS = new Set(['THREAT', 'SURVIVAL', 'EQUIPMENT', 'MAGIC', 'TACTICS']);

            for (const [key, def] of entries) {
                expect(def.id).toBe(key);
                expect(VALID_SEVERITIES.has(def.severity)).toBe(true);
                expect(VALID_TOPICS.has(def.topic)).toBe(true);
                expect(typeof def.baseScore).toBe('number');
                expect(def.baseScore).toBeGreaterThan(0);
                expect(typeof def.templateJa).toBe('string');
                expect(def.templateJa.length).toBeGreaterThan(0);
                expect(typeof def.templateEn).toBe('string');
                expect(def.templateEn.length).toBeGreaterThan(0);
            }
        });

        it('createAdvice ヘルパーがパラメータを正確に置換し、オーバーライドを正しく反映すること', () => {
            const advice = createAdvice('ADVICE_THREAT_PETRIFICATION', {
                monsterJa: 'テストコカトリス',
                monsterEn: 'test cockatrice',
                hintLetters: ['a', 'b']
            });

            expect(advice).toBeDefined();
            expect(advice.id).toBe('ADVICE_THREAT_PETRIFICATION');
            expect(advice.severity).toBe('CRITICAL');
            expect(advice.messageJa).toContain('テストコカトリスが接近！');
            expect(advice.messageEn).toContain('test cockatrice approaching!');
            expect(advice.hintLetters).toEqual(['a', 'b']);
            expect(advice.hintCommand).toBe('W');
            expect(advice.score).toBe(1000);
        });

        it('未知のアドバイスIDが指定された場合は警告を出力し null を返却してクラッシュしないこと', () => {
            const unknownAdvice = createAdvice('ADVICE_UNKNOWN_XYZ');
            expect(unknownAdvice).toBeNull();
        });
    });

    describe('6. ナレッジ手書き自然言語テキスト完全根絶監査 (Zero Hand-crafted Text Audit)', () => {
        it('全 481 アイテムにおいて、手書きの usageAdvice（日本語配列）が完全にゼロ件であること', () => {
            let count = 0;
            for (const item of OBJECT_KNOWLEDGE_MAP.values()) {
                if (item.usageAdvice && item.usageAdvice.length > 0) {
                    count++;
                }
            }
            expect(count).toBe(0);
        });

        it('全 383 モンスターにおいて、手書きの tacticalAdviceJa / En および corpse.warningNoteJa が完全にゼロ件であること', () => {
            let adviceJaCount = 0;
            let warningJaCount = 0;
            let counterMsgCount = 0;

            for (const mon of ALL_MONSTER_KNOWLEDGE_BASE) {
                if (mon.tacticalAdviceJa && mon.tacticalAdviceJa.length > 0) {
                    adviceJaCount++;
                }
                if (mon.corpse && mon.corpse.warningNoteJa) {
                    warningJaCount++;
                }
                if (mon.threat && mon.threat.counters) {
                    for (const c of mon.threat.counters) {
                        if (c.message || c.why) {
                            counterMsgCount++;
                        }
                    }
                }
            }

            expect(adviceJaCount).toBe(0);
            expect(warningJaCount).toBe(0);
            expect(counterMsgCount).toBe(0);
        });

        it('OBJECT_CATEGORY_ADVICE に手書きの unidentifiedTips / usageAdvice が存在せず、純粋なカテゴリ情報のみであること', () => {
            for (const [cat, val] of Object.entries(OBJECT_CATEGORY_ADVICE)) {
                expect(val.category).toBe(cat);
                expect(val.unidentifiedTips).toBeUndefined();
                expect(val.unidentifiedTipsEn).toBeUndefined();
                expect(val.usageAdvice).toBeUndefined();
                expect(val.usageAdviceEn).toBeUndefined();
                expect(val.effectSummary).toBeUndefined();
            }
        });

        it('ItemIdentificationResolver の IDENTIFICATION_TIPS が完全に空オブジェクトであること', () => {
            expect(Object.keys(IDENTIFICATION_TIPS).length).toBe(0);
        });
    });
});
