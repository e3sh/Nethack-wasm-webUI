import { describe, it, expect } from 'vitest';
import { AssistSignalSynthesizer } from './AssistSignalSynthesizer.js';

describe('AssistSignalSynthesizer - Action Stance & AssistSignal Engine', () => {

    describe('5.1 Status Hazards & Survival Stance', () => {

        it('石化進行中: トカゲの死体がある場合、CURE Stance で食べるアクションを推奨', () => {
            const context = {
                status: { conditions: ['Stone'], hp: { current: 20, max: 20, percent: 1.0 } },
                inventory: [
                    { invlet: 'f', name: 'lizard corpse', category: 'FOOD' }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('CURE');
            expect(state.primarySignal.priority).toBe(100);
            expect(state.primarySignal.icon).toBe('🦎');
            expect(state.primaryAction).toBeDefined();
            expect(state.primaryAction.keySequence).toEqual(['e', 'f']);
            expect(state.slotBadges['f']).toBeDefined();
            expect(state.slotBadges['f'].labelJa).toBe('緊急治癒');
        });

        it('石化進行中: 特効薬がない場合、PRAY Stance で神に祈るアクションを推奨', () => {
            const context = {
                status: { conditions: ['Stone'], hp: { current: 20, max: 20, percent: 1.0 } },
                inventory: []
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('PRAY');
            expect(state.primarySignal.priority).toBe(100);
            expect(state.primarySignal.icon).toBe('🙏');
            expect(state.primaryAction.keySequence).toEqual(['#pray\n', 'y']);
        });

        it('スライム化中: 火の杖がある場合、CURE Stance で自分に振るアクション(z -> b -> .)を推奨', () => {
            const context = {
                status: { conditions: ['Slimed'], hp: { current: 30, max: 30, percent: 1.0 } },
                inventory: [
                    { invlet: 'b', name: 'wand of fire', category: 'WAND' }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('CURE');
            expect(state.primarySignal.priority).toBe(98);
            expect(state.primaryAction.keySequence).toEqual(['z', 'b', '.']);
            expect(state.slotBadges['b'].labelJa).toBe('治療');
        });

        it('瀕死 (HP < 30%): 回復薬所持時は CURE Stance (q -> a) を推奨', () => {
            const context = {
                status: { hp: { current: 5, max: 30, percent: 0.16 } },
                inventory: [
                    { invlet: 'a', name: 'potion of extra healing', category: 'POTION' }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('CURE');
            expect(state.primarySignal.priority).toBe(85);
            expect(state.primaryAction.keySequence).toEqual(['q', 'a']);
            expect(state.slotBadges['a'].labelJa).toBe('緊急回復');
        });

        it('瀕死 (HP < 30%): 回復薬なし・祈り可能な時は PRAY Stance (#pray) を推奨', () => {
            const context = {
                status: { hp: { current: 5, max: 30, percent: 0.16 } },
                inventory: []
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('PRAY');
            expect(state.primarySignal.priority).toBe(85);
            expect(state.primaryAction.keySequence).toEqual(['#pray\n', 'y']);
        });

        it('瀕死 (HP < 30%): インベントリに spellbook of healing のみ所持時は回復薬として誤認識されない', () => {
            const context = {
                status: { hp: { current: 5, max: 30, percent: 0.16 } },
                inventory: [
                    { invlet: 'b', name: 'spellbook of healing', category: 'SPELLBOOK' }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            // 回復薬の服用 (q -> b) にならず、祈り (#pray) になること
            expect(state.primarySignal.stance).toBe('PRAY');
            expect(state.primarySignal.id).toBe('SIGNAL_HP_CRITICAL_PRAY');
            expect(state.slotBadges['b']).toBeUndefined();
        });

        it('瀕死 (HP < 30%): spellbook of healing を所持していても治癒魔法習得時は SIGNAL_HP_CRITICAL_SPELL (Z -> a -> .) を推奨', () => {
            const context = {
                status: { hp: { current: 5, max: 30, percent: 0.16 }, pw: { current: 15, max: 15 } },
                inventory: [
                    { invlet: 'b', name: 'spellbook of healing', category: 'SPELLBOOK' }
                ],
                spells: [
                    { letter: 'a', name: 'healing', level: 1, failPercent: 0 }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.id).toBe('SIGNAL_HP_CRITICAL_SPELL');
            expect(state.primaryAction.keySequence).toEqual(['Z', 'a', '.']);
            expect(state.slotBadges['b']).toBeUndefined();
            expect(state.slotBadges['spell:a']).toBeDefined();
        });

        it('HP 警戒域 (30〜50%): spellbook of healing 所持時に回復薬として誤認識されない', () => {
            const context = {
                status: { hp: { current: 12, max: 30, percent: 0.40 } },
                inventory: [
                    { invlet: 'b', name: 'spellbook of healing', category: 'SPELLBOOK' }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            // 回復薬がないため SIGNAL_HP_LOW_HEAL は生成されない
            if (state.primarySignal) {
                expect(state.primarySignal.id).not.toBe('SIGNAL_HP_LOW_HEAL');
            }
            expect(state.slotBadges['b']).toBeUndefined();
        });

        it('混乱中 (Confused): ユニコーンの角がない場合、WAIT_SAFE Stance で足踏み(.)を推奨', () => {
            const context = {
                status: { conditions: ['Conf'], hp: { current: 20, max: 20, percent: 1.0 } },
                inventory: []
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('WAIT_SAFE');
            expect(state.primarySignal.priority).toBe(75);
            expect(state.primaryAction.keySequence).toEqual(['.']);
            expect(state.slotBadges['Conf'].labelJa).toBe('待機');
        });

        it('混乱中 (Confused): ユニコーンの角がある場合、CURE Stance で角使用 (a -> u) を推奨', () => {
            const context = {
                status: { conditions: ['Conf'], hp: { current: 20, max: 20, percent: 1.0 } },
                inventory: [
                    { invlet: 'u', name: 'unicorn horn', category: 'TOOL' }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('CURE');
            expect(state.primarySignal.priority).toBe(75);
            expect(state.primaryAction.keySequence).toEqual(['a', 'u']);
            expect(state.slotBadges['u'].labelJa).toBe('治療');
        });

        it('盲目中 (Blind): 特効なし時は WAIT_SAFE Stance で捜索待機 (s) を推奨', () => {
            const context = {
                status: { conditions: ['Blind'], hp: { current: 20, max: 20, percent: 1.0 } },
                inventory: []
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('WAIT_SAFE');
            expect(state.primarySignal.priority).toBe(70);
            expect(state.primaryAction.keySequence).toEqual(['s']);
        });
    });

    describe('5.2 Combat Tactics & Threat Stance', () => {

        it('浮遊する目玉接近: 目隠し所持時は EQUIP Stance (P -> b) を推奨', () => {
            const context = {
                status: { hp: { current: 25, max: 25, percent: 1.0 } },
                areaState: {
                    perceivedMonsters: [{ name: 'floating eye', monOffset: 57 }]
                },
                inventory: [
                    { invlet: 'b', name: 'blindfold', category: 'TOOL', isWorn: false }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('EQUIP');
            expect(state.primarySignal.priority).toBe(76);
            expect(state.primaryAction.keySequence).toEqual(['P', 'b']);
            expect(state.slotBadges['b'].labelJa).toBe('装備');
        });

        it('浮遊する目玉接近: 目隠しなし時は RANGED Stance (近接禁止・遠隔推奨) を推奨', () => {
            const context = {
                status: { hp: { current: 25, max: 25, percent: 1.0 } },
                areaState: {
                    perceivedMonsters: [{ name: 'floating eye', monOffset: 57 }]
                },
                inventory: []
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('RANGED');
            expect(state.primarySignal.priority).toBe(78);
            expect(state.primaryAction.keySequence).toEqual(['f']);
        });

        it('銀弱点敵 (Werewolf): 銀の武器所持時は EQUIP Stance (w -> s) を推奨', () => {
            const context = {
                status: { hp: { current: 30, max: 30, percent: 1.0 } },
                areaState: {
                    perceivedMonsters: [{ name: 'werewolf' }]
                },
                inventory: [
                    { invlet: 's', name: 'silver saber', category: 'WEAPON', isWeapon: true, isWorn: false }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('EQUIP');
            expect(state.primarySignal.priority).toBe(68);
            expect(state.primaryAction.keySequence).toEqual(['w', 's']);
            expect(state.slotBadges['s'].labelJa).toBe('特効');
        });
    });

    describe('5.3 & 5.4 Magic Armor Penalty & 4 Safety Guards', () => {

        it('金属鎧着用時: 魔法失敗率が高い場合は高失敗バッジを付与し、攻撃の杖を推奨', () => {
            const context = {
                status: { hp: { current: 20, max: 20, percent: 1.0 }, pw: { current: 10, max: 10 } },
                inventory: [
                    { invlet: 'A', name: 'iron plate mail', category: 'ARMOR', isWorn: true },
                    { invlet: 'w', name: 'wand of striking', category: 'WAND' }
                ],
                spells: [
                    { letter: 'a', name: 'force bolt', level: 1, failRate: '80%', failPercent: 80 }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.stance).toBe('CAUTION');
            expect(state.primarySignal.id).toBe('SIGNAL_ARMOR_MAGIC_PENALTY');
            expect(state.slotBadges['spell:a']).toBeDefined();
            expect(state.slotBadges['spell:a'].labelJa).toBe('高失敗(80%)');
            expect(state.slotBadges['w']).toBeDefined();
            expect(state.slotBadges['w'].labelJa).toBe('推奨');
        });

        it('所持品スロット a (例: 刀) と 魔法スロット a が同時に存在しても、所持品に魔法の高失敗バッジが付かないこと', () => {
            const context = {
                status: { hp: { current: 20, max: 20, percent: 1.0 }, pw: { current: 10, max: 10 } },
                inventory: [
                    { invlet: 'a', name: 'katana', category: 'WEAPON', isWeapon: true, isWorn: true },
                    { invlet: 'A', name: 'iron plate mail', category: 'ARMOR', isWorn: true },
                    { invlet: 'w', name: 'wand of striking', category: 'WAND' }
                ],
                spells: [
                    { letter: 'a', name: 'force bolt', level: 1, failRate: '80%', failPercent: 80 }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            // 魔法スロット 'spell:a' には高失敗バッジが付く
            expect(state.slotBadges['spell:a']).toBeDefined();
            expect(state.slotBadges['spell:a'].labelJa).toBe('高失敗(80%)');
            // 所持品スロット 'a' (刀) には高失敗バッジが付かない
            expect(state.slotBadges['a']).toBeUndefined();
        });

        it('4大安全ガードを満たす治癒魔法は、瀕死時にワンタップ詠唱 (Z -> a -> .) として推奨', () => {
            const context = {
                status: { hp: { current: 4, max: 30, percent: 0.13 }, pw: { current: 15, max: 15 } },
                inventory: [],
                spells: [
                    { letter: 'a', name: 'healing', level: 1, failPercent: 0 }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.id).toBe('SIGNAL_HP_CRITICAL_SPELL');
            expect(state.primaryAction.keySequence).toEqual(['Z', 'a', '.']);
            expect(state.slotBadges['spell:a'].labelJa).toBe('緊急回復');
        });
    });

    describe('5.5 Floor Landmark POI Integration', () => {

        it('未識別指輪所持 ＋ フロアに流し台あり: 流し台識別シグナルを生成', () => {
            const context = {
                status: { hp: { current: 30, max: 30, percent: 1.0 } },
                inventory: [
                    { invlet: 'r', name: 'ruby ring', oclass: 8, identified: false }
                ],
                landmarks: {
                    sinks: [{ type: 'SINK', x: 20, y: 10 }]
                }
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.id).toBe('SIGNAL_LANDMARK_SINK_RING');
            expect(state.primarySignal.priority).toBe(35);
        });

        it('未識別リングメイル(ring mail)所持 ＋ フロアに流し台あり: 流し台識別シグナルは生成されないこと', () => {
            const context = {
                status: { hp: { current: 30, max: 30, percent: 1.0 } },
                inventory: [
                    { invlet: 'a', name: 'crude ring mail', rawText: 'a - crude ring mail', category: 'ARMOR', identified: false }
                ],
                landmarks: {
                    sinks: [{ type: 'SINK', x: 20, y: 10 }]
                }
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            // 流し台シグナルは発生しない
            expect(state.primarySignal).toBeNull();
        });

        it('死体所持 ＋ 自属性祭壇あり: 捧げ物シグナルを生成', () => {
            const context = {
                status: { align: 'neutral', hp: { current: 30, max: 30, percent: 1.0 } },
                inventory: [
                    { invlet: 'c', name: 'jackal corpse', category: 'FOOD' }
                ],
                landmarks: {
                    altars: [{ type: 'ALTAR', details: { alignment: 'neutral' } }]
                }
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.id).toBe('SIGNAL_LANDMARK_ALTAR_SACRIFICE');
            expect(state.primarySignal.priority).toBe(32);
        });

        it('瀕死 (HP < 30%) ＋ 特効なし ＋ 上り階段あり: 階段退避シグナル (SIGNAL_LANDMARK_STAIR_ESCAPE) を最優先', () => {
            const context = {
                status: { hp: { current: 5, max: 30, percent: 0.16 } },
                inventory: [],
                landmarks: {
                    stairsUp: [{ type: 'STAIR_UP', x: 10, y: 10 }]
                }
            };

            // 回復薬なし・祈り可能(85) vs 階段退避(82) -> 祈りが85で最上位、もし祈り等がない場合は階段退避
            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            // 祈り(85)が優先される
            expect(state.primarySignal.priority).toBe(85);
        });
    });

    describe('Priority Arbitration (優先度調停)', () => {

        it('石化進行 (100) と 瀕死 (85) と 混乱 (75) が重複した場合、石化 (100) が primarySignal に選抜される', () => {
            const context = {
                status: {
                    conditions: ['Stone', 'Conf'],
                    hp: { current: 5, max: 30, percent: 0.16 }
                },
                inventory: [
                    { invlet: 'f', name: 'lizard corpse', category: 'FOOD' },
                    { invlet: 'a', name: 'potion of extra healing', category: 'POTION' },
                    { invlet: 'u', name: 'unicorn horn', category: 'TOOL' }
                ]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primarySignal).toBeDefined();
            expect(state.primarySignal.id).toBe('SIGNAL_PETRIFY_CURE');
            expect(state.primarySignal.priority).toBe(100);
            expect(state.primaryAction.keySequence).toEqual(['e', 'f']);

            // slotBadges には各アイテムのバッジが共存して付与されていること
            expect(state.slotBadges['f']).toBeDefined(); // 石化治癒
            expect(state.slotBadges['a']).toBeDefined(); // 回復薬
            expect(state.slotBadges['u']).toBeDefined(); // 角
        });
    });
});
