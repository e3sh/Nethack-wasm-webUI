import { describe, it, expect } from 'vitest';
import { TacticalAdvisor } from './TacticalAdvisor.js';
import { SkillStateManager } from './SkillStateManager.js';
import { InventoryStateManager } from './InventoryStateManager.js';
import { SpellStateManager } from './SpellStateManager.js';
import { StatusAccessor } from '../StatusAccessor.js';
import { AreaStateManager } from './AreaStateManager.js';
import { AttributeStateManager } from './AttributeStateManager.js';
import { createTestItem } from '../../../test/helpers/testItemFactory.js';

describe('TacticalAdvisor - 戦術・危険・装備アドバイザーテスト', () => {

    describe('1. 熟練武器 & 装備適正アドバイス (Equipment Suitability)', () => {
        it('武器未装備時、スキル熟練度（Expert / Skilled）が高い武器がヒントとして提案されること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('short sword', 'a'),
                createTestItem('long sword', 'b', { rawText: 'b - a +1 long sword' }),
                createTestItem('dagger', 'c')
            ];

            const skillMgr = new SkillStateManager();
            skillMgr.updateFromLines([
                'short sword [Unskilled]',
                'long sword [Skilled]', // 25 + 4.5 + 5 = 34.5
                'dagger [Expert]'       // 40 + 2.5 = 42.5
            ]);

            const advices = TacticalAdvisor.generateAdvices({
                inventoryState: invMgr,
                skillStateManager: skillMgr
            });

            const weaponAdvice = advices.find(a => a.id === 'ADVICE_EQUIP_SKILLED_WEAPON');
            expect(weaponAdvice).toBeDefined();
            expect(weaponAdvice.severity).toBe('TIP');
            expect(weaponAdvice.topic).toBe('EQUIPMENT');
            expect(weaponAdvice.hintLetters).toEqual(['c']);
            expect(weaponAdvice.hintCommand).toBe('w');
            expect(weaponAdvice.messageJa).toContain('dagger');
            expect(weaponAdvice.messageJa).toContain('達人');
        });

        it('低スキル武器装備中、高スキル武器（達人）を所持している場合に持ち替えアドバイスが出ること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('short sword', 'a', { rawText: 'a - an uncursed short sword (weapon in hand)', isWielded: true }),
                createTestItem('long sword', 'b', { rawText: 'b - a +2 long sword', isWielded: false })
            ];

            const skillMgr = new SkillStateManager();
            skillMgr.updateFromLines([
                'short sword [Unskilled]', // 0 + 3.5 = 3.5
                'long sword [Expert]'      // 40 + 4.5 + 10 = 54.5
            ]);

            const advices = TacticalAdvisor.generateAdvices({
                inventoryState: invMgr,
                skillStateManager: skillMgr
            });

            const weaponAdvice = advices.find(a => a.id === 'ADVICE_EQUIP_SKILLED_WEAPON');
            expect(weaponAdvice).toBeDefined();
            expect(weaponAdvice.hintLetters).toEqual(['b']);
            expect(weaponAdvice.messageJa).toContain('long sword');
            expect(weaponAdvice.messageJa).toContain('達人');
        });

        it('ランチャー（弓・クロスボウ）は近接武器の比較対象から除外されること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('dagger', 'a', { rawText: 'a - an uncursed dagger (weapon in hand)', isWielded: true }),
                createTestItem('crossbow', 'b', { isLauncher: true })
            ];

            const skillMgr = new SkillStateManager();
            skillMgr.updateFromLines([
                'dagger [Basic]',
                'crossbow [Expert]'
            ]);

            const advices = TacticalAdvisor.generateAdvices({
                inventoryState: invMgr,
                skillStateManager: skillMgr
            });

            // クロスボウを近接武器の持ち替えとして提案しない
            const weaponAdvice = advices.find(a => a.id === 'ADVICE_EQUIP_SKILLED_WEAPON');
            expect(weaponAdvice).toBeUndefined();
        });

        it('options.language = "en" の場合、英語メッセージが返ること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('dagger', 'a')
            ];
            const skillMgr = new SkillStateManager();
            skillMgr.updateFromLines(['dagger [Expert]']);

            const advices = TacticalAdvisor.generateAdvices({
                inventoryState: invMgr,
                skillStateManager: skillMgr
            }, { language: 'en' });

            const weaponAdvice = advices.find(a => a.id === 'ADVICE_EQUIP_SKILLED_WEAPON');
            expect(weaponAdvice).toBeDefined();
            expect(weaponAdvice.message).toContain('Skilled Weapon');
            expect(weaponAdvice.message).toContain('Expert');
        });
    });

    describe('2. 魔法阻害警告 (Magic & Metallic Armor Penalty)', () => {
        it('魔法習得時、金属製防具を装備していると魔法失敗率上昇の警告が出ること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('iron helmet', 'a', { rawText: 'a - an uncursed iron helmet (being worn)', isWorn: true, armorSlot: 'helmet' }),
                createTestItem('leather armor', 'b', { rawText: 'b - a +1 leather armor (being worn)', isWorn: true, armorSlot: 'suit' })
            ];

            const spellMgr = new SpellStateManager();
            spellMgr.spells = [
                { letter: 'a', name: 'force bolt', level: 1, category: 'attack', failRate: '0%' }
            ];
            spellMgr.isSynced = true;

            const advices = TacticalAdvisor.generateAdvices({
                inventoryState: invMgr,
                spellStateManager: spellMgr
            });

            const magicAdvice = advices.find(a => a.id === 'ADVICE_MAGIC_METALLIC_ARMOR');
            expect(magicAdvice).toBeDefined();
            expect(magicAdvice.severity).toBe('WARNING');
            expect(magicAdvice.topic).toBe('MAGIC');
            expect(magicAdvice.hintLetters).toEqual(['a']);
            expect(magicAdvice.messageJa).toContain('金属製防具');
        });

        it('魔法を習得していない場合は金属防具の警告が出ないこと', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('iron helmet', 'a', { rawText: 'a - an uncursed iron helmet (being worn)', isWorn: true })
            ];

            const spellMgr = new SpellStateManager(); // 魔法なし

            const advices = TacticalAdvisor.generateAdvices({
                inventoryState: invMgr,
                spellStateManager: spellMgr
            });

            const magicAdvice = advices.find(a => a.id === 'ADVICE_MAGIC_METALLIC_ARMOR');
            expect(magicAdvice).toBeUndefined();
        });
    });

    describe('3. モンスター脅威 & 危険予知 (Threat & Hazard)', () => {
        it('コカトリスが接近時、手袋未着用ならCRITICAL警告が出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(10, 9, 10); // cockatrice glyph (monOffset: 10)

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('leather gloves', 'g', { isWorn: false })
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 10),
                inventoryState: invMgr
            });

            const petrifyAdvice = advices.find(a => a.id === 'ADVICE_THREAT_PETRIFICATION');
            expect(petrifyAdvice).toBeDefined();
            expect(petrifyAdvice.severity).toBe('CRITICAL');
            expect(petrifyAdvice.hintLetters).toEqual(['g']);
            expect(petrifyAdvice.hintCommand).toBe('W');
            expect(petrifyAdvice.messageJa).toContain('石化');
        });

        it('コカトリス接近時でも手袋を着用していれば石化警告は出ないこと', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(10, 9, 10); // cockatrice (monOffset: 10)

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('leather gloves', 'g', { rawText: 'g - a pair of leather gloves (being worn)', isWorn: true, armorSlot: 'gloves' })
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 10),
                inventoryState: invMgr
            });

            const petrifyAdvice = advices.find(a => a.id === 'ADVICE_THREAT_PETRIFICATION');
            expect(petrifyAdvice).toBeUndefined();
        });

        it('パイロリスク (monOffset: 11) 接近時、素手（手袋未着用）であっても石化警告（ノイズ）は出ないこと', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(10, 9, 11); // pyrolisk (monOffset: 11)

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('leather gloves', 'g', { isWorn: false })
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 10),
                inventoryState: invMgr
            });

            const petrifyAdvice = advices.find(a => a.id === 'ADVICE_THREAT_PETRIFICATION');
            expect(petrifyAdvice).toBeUndefined();
        });

        it('浮遊する目玉(Floating Eye)が視界内にいる場合、麻痺警告が出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(11, 10, 28); // floating eye glyph (monOffset: 28)

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 10)
            });

            const eyeAdvice = advices.find(a => a.id === 'ADVICE_THREAT_FLOATING_EYE');
            expect(eyeAdvice).toBeDefined();
            expect(eyeAdvice.severity).toBe('WARNING');
            expect(eyeAdvice.messageJa).toContain('麻痺');
        });

        it('アンデッド遭遇時、未装備の銀武器を所持していれば銀特効サジェストが出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(11, 10, 226); // vampire / undead glyph (monOffset: 226)

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('dagger', 'a', { rawText: 'a - a dagger (weapon in hand)', isWielded: true }),
                createTestItem('silver saber', 's', { isWielded: false })
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 10),
                inventoryState: invMgr
            });

            const silverAdvice = advices.find(a => a.id === 'ADVICE_TACTICS_SILVER_SLAYING');
            expect(silverAdvice).toBeDefined();
            expect(silverAdvice.hintLetters).toEqual(['s']);
            expect(silverAdvice.messageJa).toContain('特効');
        });
    });

    describe('4. サバイバル・生命維持 (Survival)', () => {
        it('HPが25%以下の場合、瀕死警告と回復アイテムのレターが提示されること', () => {
            const statusAccessor = new StatusAccessor();
            statusAccessor.setAllFields({ 18: 5, 19: 30 }); // 18=HP, 19=MAXHP (16.6%)

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('potion of extra healing', 'p')
            ];

            const advices = TacticalAdvisor.generateAdvices({
                statusAccessor,
                inventoryState: invMgr
            });

            const hpAdvice = advices.find(a => a.id === 'ADVICE_SURVIVAL_LOW_HP');
            expect(hpAdvice).toBeDefined();
            expect(hpAdvice.severity).toBe('CRITICAL');
            expect(hpAdvice.hintLetters).toEqual(['p']);
            expect(hpAdvice.hintCommand).toBe('q');
            expect(hpAdvice.messageJa).toContain('瀕死');
        });

        it('空腹度が「Weak」の場合、飢餓警告と食料アイテムのレターが提示されること', () => {
            const statusAccessor = new StatusAccessor();
            statusAccessor.setAllFields({ 17: 'Weak' }); // 17=HUNGER

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('food ration', 'f')
            ];

            const advices = TacticalAdvisor.generateAdvices({
                statusAccessor,
                inventoryState: invMgr
            });

            const hungerAdvice = advices.find(a => a.id === 'ADVICE_SURVIVAL_STARVATION');
            expect(hungerAdvice).toBeDefined();
            expect(hungerAdvice.severity).toBe('CRITICAL');
            expect(hungerAdvice.hintLetters).toEqual(['f']);
            expect(hungerAdvice.hintCommand).toBe('e');
            expect(hungerAdvice.messageJa).toContain('飢餓');
        });
    });

    describe('5. 環境・地形ハザード & アイテム爆発 (Terrain Hazards & Bag of Holding Explosion)', () => {
        it('浮遊なしで溶岩が隣接している場合、溶岩即死警告が出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(10, 9, 4017); // lava glyph (CMAP)

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 1)
            });

            const lavaAdvice = advices.find(a => a.id === 'ADVICE_HAZARD_LAVA');
            expect(lavaAdvice).toBeDefined();
            expect(lavaAdvice.severity).toBe('CRITICAL');
            expect(lavaAdvice.messageJa).toContain('溶岩');
        });

        it('浮遊・水上歩行なしで水場が隣接している場合、水没警告と浮遊靴等のレターが出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(10, 9, 4015); // water/pool glyph (CMAP)

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('water walking boots', 'w', { isWorn: false })
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 1),
                inventoryState: invMgr
            });

            const waterAdvice = advices.find(a => a.id === 'ADVICE_HAZARD_WATER');
            expect(waterAdvice).toBeDefined();
            expect(waterAdvice.severity).toBe('WARNING');
            expect(waterAdvice.hintLetters).toEqual(['w']);
            expect(waterAdvice.messageJa).toContain('水場');
        });

        it('手品袋と魔法の袋(Bag of Tricks)を同時に所持している場合、爆発危険警告が出ること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('bag of holding', 'b'),
                createTestItem('bag of tricks', 't')
            ];

            const advices = TacticalAdvisor.generateAdvices({
                inventoryState: invMgr
            });

            const explodeAdvice = advices.find(a => a.id === 'ADVICE_HAZARD_BAG_OF_HOLDING_EXPLOSION');
            expect(explodeAdvice).toBeDefined();
            expect(explodeAdvice.severity).toBe('CRITICAL');
            expect(explodeAdvice.hintLetters).toContain('b');
            expect(explodeAdvice.hintLetters).toContain('t');
            expect(explodeAdvice.messageJa).toContain('爆発');
        });
    });

    describe('6. 認知メンタルマップ ＆ 潜伏モンスター戦術アドバイス (Mental Map & Unseen Threats)', () => {
        it('視界外に消えたコカトリス（Weight 0.8 / NEARBY_UNSEEN）に対し、手袋事前着用の潜伏警戒アドバイスが出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);

            // コカトリスを追跡マップに登録 (Weight: 0.8)
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.trackedMonsters = [
                {
                    name: 'cockatrice',
                    nameJa: 'コカトリス',
                    monOffset: 10,
                    weight: 0.8,
                    decayStatus: 'NEARBY_UNSEEN',
                    inLoS: false,
                    lastKnownPos: { x: 15, y: 10 }
                }
            ];

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('leather gloves', 'g', { isWorn: false })
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState,
                inventoryState: invMgr
            });

            const petrifyAdvice = advices.find(a => a.id === 'ADVICE_THREAT_PETRIFICATION_UNSEEN');
            expect(petrifyAdvice).toBeDefined();
            expect(petrifyAdvice.severity).toBe('WARNING');
            expect(petrifyAdvice.score).toBe(800);
            expect(petrifyAdvice.hintLetters).toEqual(['g']);
            expect(petrifyAdvice.hintCommand).toBe('W');
            expect(petrifyAdvice.messageJa).toContain('コカトリスが潜伏中');
            expect(petrifyAdvice.messageJa).toContain('手袋の事前着用');
        });

        it('視界外に消えた邪悪な敵（Weight 0.8）に対し、銀製武器への事前持ち替えアドバイスが出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);

            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.trackedMonsters = [
                {
                    name: 'vampire',
                    nameJa: '吸血鬼',
                    monOffset: 226,
                    weight: 0.8,
                    decayStatus: 'NEARBY_UNSEEN',
                    inLoS: false,
                    lastKnownPos: { x: 14, y: 10 }
                }
            ];

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('silver dagger', 'a', { isWielded: false })
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState,
                inventoryState: invMgr
            });

            const silverAdvice = advices.find(a => a.id === 'ADVICE_TACTICS_SILVER_SLAYING_UNSEEN');
            expect(silverAdvice).toBeDefined();
            expect(silverAdvice.score).toBe(360); // 450 * 0.8 = 360
            expect(silverAdvice.hintLetters).toEqual(['a']);
            expect(silverAdvice.hintCommand).toBe('w');
            expect(silverAdvice.messageJa).toContain('銀製武器 [a] への持ち替えを推奨');
        });

        it('同種モンスターが複数体いる場合、気配サマリーで種族ごとにグループ化（x3 等）して提示されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);

            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.perceivedMonsters = [
                {
                    name: 'jackal',
                    nameJa: 'ジャッカル',
                    monOffset: 3,
                    weight: 1.0,
                    decayStatus: 'VISIBLE',
                    distance: 3,
                    direction: { code: 'E', name: '東' }
                },
                {
                    name: 'jackal',
                    nameJa: 'ジャッカル',
                    monOffset: 3,
                    weight: 1.0,
                    decayStatus: 'VISIBLE',
                    distance: 4,
                    direction: { code: 'E', name: '東' }
                },
                {
                    name: 'jackal',
                    nameJa: 'ジャッカル',
                    monOffset: 3,
                    weight: 0.8,
                    decayStatus: 'NEARBY_UNSEEN',
                    distance: 5,
                    direction: { code: 'NE', name: '北東' }
                }
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState
            });

            const radarAdvice = advices.find(a => a.id === 'ADVICE_THREAT_PERCEIVED_RADAR');
            expect(radarAdvice).toBeDefined();
            expect(radarAdvice.messageJa).toContain('ジャッカル (視認中 x2');
        });

        it('マインドフレア接近時、知性吸い即死警告（ADVICE_THREAT_MIND_FLAYER）が生成されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.adjacentMonsters = [{
                dir: { code: 'N' },
                entity: { name: 'mind flayer', monOffset: 48 }
            }];

            const advices = TacticalAdvisor.generateAdvices({ areaState });
            const advice = advices.find(a => a.id === 'ADVICE_THREAT_MIND_FLAYER');
            expect(advice).toBeDefined();
            expect(advice.severity).toBe('CRITICAL');
            expect(advice.score).toBe(950);
            expect(advice.messageJa).toContain('マインドフレア');
        });

        it('グリーンスライム接近時、スライム化即死警告（ADVICE_THREAT_GREEN_SLIME）が生成されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.adjacentMonsters = [{
                dir: { code: 'E' },
                entity: { name: 'green slime', monOffset: 208 }
            }];

            const advices = TacticalAdvisor.generateAdvices({ areaState });
            const advice = advices.find(a => a.id === 'ADVICE_THREAT_GREEN_SLIME');
            expect(advice).toBeDefined();
            expect(advice.severity).toBe('CRITICAL');
            expect(advice.score).toBe(920);
        });

        it('ラストモンスター接近時、鉄製装備着用中に腐食警告（ADVICE_THREAT_RUST_MONSTER）が出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.adjacentMonsters = [{
                dir: { code: 'W' },
                entity: { name: 'rust monster', monOffset: 212 }
            }];

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('iron chain mail', 'a', { rawText: 'a - an iron chain mail (being worn)', isWorn: true })
            ];

            const advices = TacticalAdvisor.generateAdvices({ areaState, inventoryState: invMgr });
            const advice = advices.find(a => a.id === 'ADVICE_THREAT_RUST_MONSTER');
            expect(advice).toBeDefined();
            expect(advice.severity).toBe('WARNING');
            expect(advice.score).toBe(750);
        });

        it('足元にコカトリスの死体があり手袋未着用時、死体石化警告（ADVICE_HAZARD_PETRIFY_CORPSE）が出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet = {
                top: { name: 'cockatrice corpse' }
            };

            const invMgr = new InventoryStateManager();
            invMgr.items = []; // 手袋未着用

            const advices = TacticalAdvisor.generateAdvices({ areaState, inventoryState: invMgr });
            const advice = advices.find(a => a.id === 'ADVICE_HAZARD_PETRIFY_CORPSE');
            expect(advice).toBeDefined();
            expect(advice.severity).toBe('CRITICAL');
            expect(advice.score).toBe(990);
        });

        it('足元にレイスの死体がある場合、レベルアップ推奨（ADVICE_TACTICS_EAT_WRAITH_CORPSE）が出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet = {
                top: { name: 'wraith corpse' }
            };

            const advices = TacticalAdvisor.generateAdvices({ areaState });
            const advice = advices.find(a => a.id === 'ADVICE_TACTICS_EAT_WRAITH_CORPSE');
            expect(advice).toBeDefined();
            expect(advice.score).toBe(800);
            expect(advice.hintCommand).toBe('e');
        });
    });

    describe('8. SSOT ＆ 確定耐性モデル連動テスト (Phase 3 Integration)', () => {
        it('キラービー遭遇時、毒耐性がない場合は警告(ADVICE_THREAT_POISON)が出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(11, 10, 1); // killer bee (monOffset: 1)

            const attrMgr = new AttributeStateManager();
            // 人間・考古学者はLv1で毒耐性なし
            attrMgr.updateCharacter({ race: 'human', role: 'archeologist', level: 1 });

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 5),
                attributeStateManager: attrMgr
            });

            const poisonAdvice = advices.find(a => a.id === 'ADVICE_THREAT_POISON');
            expect(poisonAdvice).toBeDefined();
            expect(poisonAdvice.severity).toBe('WARNING');
            expect(poisonAdvice.messageJa).toContain('毒警戒');
        });

        it('キラービー遭遇時、AttributeStateManager で毒耐性を保持している場合は安全アドバイス(ADVICE_THREAT_POISON_SAFE)が出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(11, 10, 1); // killer bee (monOffset: 1)

            const attrMgr = new AttributeStateManager();
            // オークは種族生来で毒耐性100%保持
            attrMgr.updateCharacter({ race: 'orc', role: 'barbarian', level: 1 });
            expect(attrMgr.getEffectiveResistances().poison).toBe(true);

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 5),
                attributeStateManager: attrMgr
            });

            const safeAdvice = advices.find(a => a.id === 'ADVICE_THREAT_POISON_SAFE');
            expect(safeAdvice).toBeDefined();
            expect(safeAdvice.severity).toBe('INFO');
            expect(safeAdvice.messageJa).toContain('毒耐性あり');

            // 警告は抑制されていること
            const poisonAdvice = advices.find(a => a.id === 'ADVICE_THREAT_POISON');
            expect(poisonAdvice).toBeUndefined();
        });

        it('ソルジャーアント遭遇時、毒耐性なしならCRITICAL警告、毒耐性ありならSAFEアドバイスになること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(11, 10, 2); // soldier ant (monOffset: 2)

            const attrMgrNoPoison = new AttributeStateManager();
            attrMgrNoPoison.updateCharacter({ race: 'human', role: 'valkyrie', level: 1 });

            const advicesNoResist = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 5),
                attributeStateManager: attrMgrNoPoison
            });
            const critAdvice = advicesNoResist.find(a => a.id === 'ADVICE_THREAT_POISON');
            expect(critAdvice).toBeDefined();
            expect(critAdvice.severity).toBe('CRITICAL');

            // 毒耐性獲得後
            const attrMgrWithPoison = new AttributeStateManager();
            attrMgrWithPoison.updateFromIntrinsicsLines(['You are poison resistant.']);
            const advicesWithResist = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 5),
                attributeStateManager: attrMgrWithPoison
            });
            expect(advicesWithResist.find(a => a.id === 'ADVICE_THREAT_POISON')).toBeUndefined();
            expect(advicesWithResist.find(a => a.id === 'ADVICE_THREAT_POISON_SAFE')).toBeDefined();
        });

        it('浮遊目玉遭遇時、自由行動(freeAction)耐性がある場合は安全アドバイスが出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(11, 10, 28); // floating eye (monOffset: 28)

            const attrMgr = new AttributeStateManager();
            attrMgr.updateFromIntrinsicsLines(['You are free of action.']);

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 5),
                attributeStateManager: attrMgr
            });

            const safeAdvice = advices.find(a => a.id === 'ADVICE_THREAT_FLOATING_EYE_SAFE');
            expect(safeAdvice).toBeDefined();
            expect(safeAdvice.messageJa).toContain('麻痺無効');
            expect(safeAdvice.messageJa).toContain('自由行動');
            expect(advices.find(a => a.id === 'ADVICE_THREAT_FLOATING_EYE')).toBeUndefined();
        });

        it('浮遊目玉遭遇時、目隠し着用中の場合は安全アドバイスが出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(11, 10, 28); // floating eye (monOffset: 28)

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('blindfold', 'b', { isWorn: true })
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 5),
                inventoryState: invMgr
            });

            const safeAdvice = advices.find(a => a.id === 'ADVICE_THREAT_FLOATING_EYE_SAFE');
            expect(safeAdvice).toBeDefined();
            expect(safeAdvice.messageJa).toContain('目隠し着用');
            expect(advices.find(a => a.id === 'ADVICE_THREAT_FLOATING_EYE')).toBeUndefined();
        });

        it('吸血鬼遭遇時、ドレイン耐性(drain)がある場合は安全アドバイスが出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(11, 10, 226); // vampire (monOffset: 226)

            const attrMgr = new AttributeStateManager();
            attrMgr.updateFromIntrinsicsLines(['You are level-drain resistant.']);

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 5),
                attributeStateManager: attrMgr
            });

            const safeAdvice = advices.find(a => a.id === 'ADVICE_THREAT_LEVEL_DRAIN_SAFE');
            expect(safeAdvice).toBeDefined();
            expect(safeAdvice.messageJa).toContain('ドレイン耐性あり');
            expect(advices.find(a => a.id === 'ADVICE_THREAT_LEVEL_DRAIN')).toBeUndefined();
        });

        it('毒モンスター遭遇時、インベントリ内の解毒アイテム（unicorn horn, effects.cureSickness）が hintLetters に提示されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(11, 10, 1); // killer bee (monOffset: 1)

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('unicorn horn', 'u')
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 5),
                inventoryState: invMgr
            });

            const poisonAdvice = advices.find(a => a.id === 'ADVICE_THREAT_POISON');
            expect(poisonAdvice).toBeDefined();
            expect(poisonAdvice.hintLetters).toContain('u');
            expect(poisonAdvice.hintCommand).toBe('a');
        });

        it('コカトリス遭遇時、手袋着用中であれば石化即死警告が抑制され安全(ADVICE_THREAT_PETRIFICATION_SAFE)が出ること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(11, 10, 10); // cockatrice (monOffset: 10)

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('leather gloves', 'g', { isWorn: true, armorSlot: 'gloves' })
            ];

            const advices = TacticalAdvisor.generateAdvices({
                areaState: areaMgr.getAreaState(10, 10, 5),
                inventoryState: invMgr
            });

            expect(advices.find(a => a.id === 'ADVICE_THREAT_PETRIFICATION')).toBeUndefined();
            const safeAdvice = advices.find(a => a.id === 'ADVICE_THREAT_PETRIFICATION_SAFE');
            expect(safeAdvice).toBeDefined();
            expect(safeAdvice.messageJa).toContain('防護済み');
        });
    });
});


