import { describe, it, expect } from 'vitest';
import { PostMortemKnowledgeResolver } from '../../../src/core/knowledge/services/PostMortemKnowledgeResolver.js';

describe('PostMortemKnowledgeResolver - 事後ナレッジ連携＆死因解析エンジン', () => {

    describe('1. 基本死因・ライフサイクル構文のテスト', () => {
        it('1.1 昇天 (Ascended) を正しく検知し、祝賀メッセージを返却すること', () => {
            const result = PostMortemKnowledgeResolver.resolve('ascended to demigod-hood');
            expect(result.category).toBe('ASCENDED');
            expect(result.isVictory).toBe(true);
            expect(result.translatedDeath).toContain('昇天した');
            expect(result.translatedDeathJa).toContain('昇天した');
        });

        it('1.2 飢餓死 (Starvation) を検知し、ADVICE_SURVIVAL_STARVATION をバインドすること', () => {
            const result = PostMortemKnowledgeResolver.resolve('died of starvation');
            expect(result.category).toBe('STARVATION');
            expect(result.isVictory).toBe(false);
            expect(result.translatedDeath).toBe('飢えにより力尽きた');
            expect(result.advice).toBeDefined();
            expect(result.advice.id).toBe('ADVICE_SURVIVAL_STARVATION');
            expect(result.countermeasureJa).toContain('神に祈る');
        });

        it('1.3 石化死 (Petrification) を検知し、ADVICE_THREAT_PETRIFICATION をバインドすること', () => {
            const result = PostMortemKnowledgeResolver.resolve('petrified by touching a chickatrice corpse');
            expect(result.category).toBe('PETRIFICATION');
            expect(result.translatedDeath).toContain('石化した');
            expect(result.advice).toBeDefined();
            expect(result.advice.id).toBe('ADVICE_THREAT_PETRIFICATION');
            expect(result.countermeasureJa).toContain('トカゲの死骸');
        });

        it('1.4 モンスターによる殺害 (Killed by cockatrice) を検知し、日本語モンスター名と対策を解決すること', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a cockatrice');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeath).toBe('コカトリスに倒された');
            expect(result.entity.nameEn).toBe('cockatrice');
            expect(result.entity.nameJa).toBe('コカトリス');
            expect(result.advice.id).toBe('ADVICE_THREAT_PETRIFICATION');
            expect(result.countermeasureJa).toContain('手袋');
            expect(result.loreLink.target).toBe('adventure_log.html');
        });

        it('1.5 浮遊目玉との戦闘での死亡を検知し、ADVICE_THREAT_FLOATING_EYE をバインドすること', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a floating eye while frozen');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeath).toContain('目');
            expect(result.advice.id).toBe('ADVICE_THREAT_FLOATING_EYE');
            expect(result.countermeasureJa).toContain('目隠し');
        });

        it('1.6 窒息死 (Choked on food) を検知し、アイテム名と対策を解決すること', () => {
            const result = PostMortemKnowledgeResolver.resolve('choked on a meatball');
            expect(result.category).toBe('CHOKING');
            expect(result.translatedDeath).toContain('窒息死した');
            expect(result.countermeasureJa).toContain('満腹状態');
        });

        it('1.7 溺死 (Drowning) を検知し、水没対策を解決すること', () => {
            const result = PostMortemKnowledgeResolver.resolve('drowned in a pool of water');
            expect(result.category).toBe('DROWNING');
            expect(result.translatedDeath).toContain('溺死した');
            expect(result.countermeasureJa).toContain('浮遊の指輪');
        });

        it('1.8 冒険放棄 (Quit) を検知すること', () => {
            const result = PostMortemKnowledgeResolver.resolve('quit');
            expect(result.category).toBe('QUIT');
            expect(result.translatedDeath).toBe('冒険を途中で断念した');
        });

        it('1.9 resolve() の戻り値に translatedDeathJa が含まれ translatedDeath と同値であること (キー互換性保証)', () => {
            const patterns = [
                'ascended to demigod-hood',
                'quit',
                'escaped the dungeon',
                'died of starvation',
                'petrified by touching a chickatrice corpse',
                'choked on a meatball',
                'drowned in a pool of water',
                'killed by a goblin',
                'crushed by a falling boulder'
            ];
            for (const pattern of patterns) {
                const report = PostMortemKnowledgeResolver.resolve(pattern);
                expect(report.translatedDeathJa).toBeDefined();
                expect(report.translatedDeathJa).toBe(report.translatedDeath);
            }
        });
    });

    describe('2. 設計書 §7 TDD コーパスベンチマーク (16ケース)', () => {
        it('Case 1: killed by a newt, while fainted from lack of food (飢餓気絶優先)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a newt, while fainted from lack of food');
            expect(result.category).toBe('STARVATION');
            expect(result.translatedDeathJa).toContain('飢餓で気絶中に');
            expect(result.translatedDeathJa).toContain('倒された');
            expect(result.advice.id).toBe('ADVICE_SURVIVAL_STARVATION');
            expect(result.rootCause).toBeDefined();
            expect(result.rootCause.isHelpless).toBe(true);
        });

        it('Case 2: killed by a goblin while frozen by a floating eye (麻痺視線優先)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a goblin while frozen by a floating eye');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toContain('浮遊する目玉に麻痺させられている間に');
            expect(result.translatedDeathJa).toContain('ゴブリンに倒された');
            expect(result.advice.id).toBe('ADVICE_THREAT_FLOATING_EYE');
        });

        it('Case 3: killed by an elf while sleeping (睡眠中)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by an elf while sleeping');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toContain('眠っている間に');
            expect(result.translatedDeathJa).toContain('エルフに倒された');
            expect(result.countermeasureJa).toContain('睡眠');
        });

        it('Case 4: poisoned by a rotted rothe corpse (死骸食中毒・モンスター戦闘死除外)', () => {
            const result = PostMortemKnowledgeResolver.resolve('poisoned by a rotted rothe corpse');
            expect(result.category).toBe('FOOD_POISONING');
            expect(result.translatedDeathJa).toContain('腐った');
            expect(result.translatedDeathJa).toContain('ロゼ');
            expect(result.translatedDeathJa).toContain('死骸');
            expect(result.advice.id).toBe('ADVICE_SURVIVAL_FOOD_POISONING');
            expect(result.entity.type).toBe('corpse');
        });

        it('Case 5: killed by an explosion (環境爆発・英名露出防止)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by an explosion');
            expect(result.category).toBe('EXPLOSION');
            expect(result.translatedDeathJa).toBe('爆発に巻き込まれて爆死した');
            expect(result.advice.id).toBe('ADVICE_HAZARD_EXPLOSION');
        });

        it('Case 6: killed by an exploding large box (箱トラップ・アイテム辞書連動)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by an exploding large box');
            expect(result.category).toBe('TRAP_CONTAINER');
            expect(result.translatedDeathJa).toBe('大きな箱の爆発（罠）に巻き込まれて死亡した');
            expect(result.advice.id).toBe('ADVICE_HAZARD_EXPLODING_CONTAINER');
        });

        it('Case 7: poisoned by a poisoned dart (罠毒矢)', () => {
            const result = PostMortemKnowledgeResolver.resolve('poisoned by a poisoned dart');
            expect(result.category).toBe('TRAP');
            expect(result.translatedDeathJa).toBe('毒矢の罠に当たって毒死した');
            expect(result.advice.id).toBe('ADVICE_HAZARD_TRAP');
        });

        it('Case 8: blasted by a bolt of lightning bounced off a wall (反射自爆光線)', () => {
            const result = PostMortemKnowledgeResolver.resolve('blasted by a bolt of lightning bounced off a wall');
            expect(result.category).toBe('BOUNCED_RAY');
            expect(result.translatedDeathJa).toBe('壁で跳ね返った稲妻に打たれて自滅した');
            expect(result.advice.id).toBe('ADVICE_SURVIVAL_BOUNCED_RAY');
        });

        it('Case 9: killed by exploding a wand of striking (杖過充填暴発)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by exploding a wand of striking');
            expect(result.category).toBe('ITEM_MISHAP');
            expect(result.translatedDeathJa).toBe('打撃の杖の過充填暴発で死亡した');
            expect(result.countermeasureJa).toContain('充填');
        });

        it('Case 10: petrified by touching a chickatrice corpse without gloves (手袋未着用素手死体接触)', () => {
            const result = PostMortemKnowledgeResolver.resolve('petrified by touching a chickatrice corpse without gloves');
            expect(result.category).toBe('PETRIFICATION');
            expect(result.translatedDeathJa).toBe('素手でヒナコカトリスの死骸に触れて石化した');
            expect(result.advice.id).toBe('ADVICE_HAZARD_PETRIFY_CORPSE');
        });

        it('Case 11: crushed to death by a collapsing drawbridge (跳ね橋即死)', () => {
            const result = PostMortemKnowledgeResolver.resolve('crushed to death by a collapsing drawbridge');
            expect(result.category).toBe('HAZARD_ENVIRONMENT');
            expect(result.translatedDeathJa).toBe('跳ね橋に押し潰されて死亡した');
            expect(result.advice.id).toBe('ADVICE_HAZARD_DRAWBRIDGE');
        });

        it('Case 12: dissolved in molten lava (溶岩即死)', () => {
            const result = PostMortemKnowledgeResolver.resolve('dissolved in molten lava');
            expect(result.category).toBe('HAZARD_ENVIRONMENT');
            expect(result.translatedDeathJa).toBe('溶岩に落ちて焼け死んだ');
            expect(result.advice.id).toBe('ADVICE_HAZARD_LAVA');
        });

        it('Case 13: killed by an invisible master mind flayer called Bob (修飾子・別名クレンジング)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by an invisible master mind flayer called Bob');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toContain('姿の見えない');
            expect(result.translatedDeathJa).toContain('マスターマインドフレア');
            expect(result.translatedDeathJa).toContain('倒された');
            expect(result.advice.id).toBe('ADVICE_THREAT_MIND_FLAYER');
        });

        it('Case 14: killed by Mr. Morgan, the shopkeeper (店主識別)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by Mr. Morgan, the shopkeeper');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('店主モーガンに倒された');
            expect(result.advice.id).toBe('ADVICE_THREAT_PEACEFUL_SHOPKEEPER');
        });

        it('Case 15: turned to slime by a green slime (スライム化即死)', () => {
            const result = PostMortemKnowledgeResolver.resolve('turned to slime by a green slime');
            expect(result.category).toBe('TURNED_SLIME');
            expect(result.translatedDeathJa).toBe('グリーンスライムによりスライム化して死亡した');
            expect(result.advice.id).toBe('ADVICE_THREAT_SLIME');
        });

        it('Case 16: killed by the wrath of Anhur (神罰)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by the wrath of Anhur');
            expect(result.category).toBe('DIVINE_WRATH');
            expect(result.translatedDeathJa).toBe('アンフールの神罰により死亡した');
            expect(result.advice.id).toBe('ADVICE_SURVIVAL_DIVINE_WRATH');
        });
    });

    describe('3. 腐敗死体・食中毒の網羅的バリエーション (5ケース)', () => {
        it('3.1 poisoned by a tainted kobold corpse (コボルドの腐敗死体)', () => {
            const result = PostMortemKnowledgeResolver.resolve('poisoned by a tainted kobold corpse');
            expect(result.category).toBe('FOOD_POISONING');
            expect(result.translatedDeathJa).toContain('腐った');
            expect(result.translatedDeathJa).toContain('コボルド');
            expect(result.advice.id).toBe('ADVICE_SURVIVAL_FOOD_POISONING');
        });

        it('3.2 poisoned by eating a kobold corpse (死体摂取による毒死)', () => {
            const result = PostMortemKnowledgeResolver.resolve('poisoned by eating a kobold corpse');
            expect(result.category).toBe('FOOD_POISONING');
            expect(result.translatedDeathJa).toContain('コボルド');
            expect(result.translatedDeathJa).toContain('毒死した');
            expect(result.advice.id).toBe('ADVICE_SURVIVAL_FOOD_POISONING');
        });

        it('3.3 poisoned by eating a poisonous corpse (有毒死骸摂取)', () => {
            const result = PostMortemKnowledgeResolver.resolve('poisoned by eating a poisonous corpse');
            expect(result.category).toBe('FOOD_POISONING');
            expect(result.translatedDeathJa).toContain('死骸');
            expect(result.translatedDeathJa).toContain('毒死');
        });

        it('3.4 died of eating a rotted corpse (腐食死)', () => {
            const result = PostMortemKnowledgeResolver.resolve('died of eating a rotted corpse');
            expect(result.category).toBe('FOOD_POISONING');
            expect(result.translatedDeathJa).toContain('腐敗した死体の毒');
        });

        it('3.5 poisoned by a rotted rat corpse (ネズミ腐敗死骸)', () => {
            const result = PostMortemKnowledgeResolver.resolve('poisoned by a rotted rat corpse');
            expect(result.category).toBe('FOOD_POISONING');
            expect(result.translatedDeathJa).toContain('腐った');
        });
    });

    describe('4. 自爆・球体モンスター・環境爆発の網羅的テスト (6ケース)', () => {
        it('4.1 caught in an explosion', () => {
            const result = PostMortemKnowledgeResolver.resolve('caught in an explosion');
            expect(result.category).toBe('EXPLOSION');
            expect(result.translatedDeathJa).toBe('爆発に巻き込まれて爆死した');
        });

        it('4.2 blasted by an explosion', () => {
            const result = PostMortemKnowledgeResolver.resolve('blasted by an explosion');
            expect(result.category).toBe('EXPLOSION');
            expect(result.translatedDeathJa).toBe('爆発に巻き込まれて爆死した');
        });

        it('4.3 killed by a gas spore\'s explosion (ガス胞子自爆)', () => {
            const result = PostMortemKnowledgeResolver.resolve("killed by a gas spore's explosion");
            expect(result.category).toBe('EXPLOSION');
            expect(result.translatedDeathJa).toBe('ガス胞子の爆発に巻き込まれて爆死した');
            expect(result.advice.id).toBe('ADVICE_THREAT_GAS_SPORE');
        });

        it('4.4 killed by a flaming sphere\'s explosion (炎の球体)', () => {
            const result = PostMortemKnowledgeResolver.resolve("killed by a flaming sphere's explosion");
            expect(result.category).toBe('EXPLOSION');
            expect(result.translatedDeathJa).toBe('炎の球体の爆発に巻き込まれて爆死した');
        });

        it('4.5 killed by a freezing sphere\'s explosion (氷の球体)', () => {
            const result = PostMortemKnowledgeResolver.resolve("killed by a freezing sphere's explosion");
            expect(result.category).toBe('EXPLOSION');
            expect(result.translatedDeathJa).toBe('氷の球体の爆発に巻き込まれて爆死した');
        });

        it('4.6 killed by a shocking sphere\'s explosion (電撃の球体)', () => {
            const result = PostMortemKnowledgeResolver.resolve("killed by a shocking sphere's explosion");
            expect(result.category).toBe('EXPLOSION');
            expect(result.translatedDeathJa).toBe('電撃の球体の爆発に巻き込まれて爆死した');
        });
    });

    describe('5. アイテム暴発・罠・事故死テスト (6ケース)', () => {
        it('5.1 killed by an exploding chest (宝箱トラップ)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by an exploding chest');
            expect(result.category).toBe('TRAP_CONTAINER');
            expect(result.translatedDeathJa).toBe('宝箱の爆発（罠）に巻き込まれて死亡した');
            expect(result.advice.id).toBe('ADVICE_HAZARD_EXPLODING_CONTAINER');
        });

        it('5.2 killed by a wand of striking exploding in a bag of holding (手品袋誘爆)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a wand of striking exploding in a bag of holding');
            expect(result.category).toBe('ITEM_MISHAP');
            expect(result.translatedDeathJa).toBe('手品袋の中で打撃の杖が爆発して死亡した');
            expect(result.advice.id).toBe('ADVICE_HAZARD_BAG_OF_HOLDING_EXPLOSION');
        });

        it('5.3 killed by an exploding wand (杖爆発)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by an exploding wand');
            expect(result.category).toBe('ITEM_MISHAP');
            expect(result.translatedDeathJa).toBe('爆発したwandによって死亡した');
        });

        it('5.4 fell into a pit of iron spikes (トゲの落とし穴)', () => {
            const result = PostMortemKnowledgeResolver.resolve('fell into a pit of iron spikes');
            expect(result.category).toBe('TRAP');
            expect(result.translatedDeathJa).toBe('鉄のトゲの落とし穴に落ちて死亡した');
            expect(result.advice.id).toBe('ADVICE_HAZARD_TRAP');
        });

        it('5.5 fell into a pit (落とし穴)', () => {
            const result = PostMortemKnowledgeResolver.resolve('fell into a pit');
            expect(result.category).toBe('TRAP');
            expect(result.translatedDeathJa).toBe('落とし穴に落ちて死亡した');
        });

        it('5.6 burned by molten lava (溶岩焼け死)', () => {
            const result = PostMortemKnowledgeResolver.resolve('burned by molten lava');
            expect(result.category).toBe('HAZARD_ENVIRONMENT');
            expect(result.translatedDeathJa).toBe('溶岩に落ちて焼け死んだ');
            expect(result.advice.id).toBe('ADVICE_HAZARD_LAVA');
        });
    });

    describe('6. 自滅・禁忌・神罰テスト (4ケース)', () => {
        it('6.1 zapped himself with a wand of death (自らの杖誤射)', () => {
            const result = PostMortemKnowledgeResolver.resolve('zapped himself with a wand of death');
            expect(result.category).toBe('ITEM_MISHAP');
            expect(result.translatedDeathJa).toBe('自らの死の杖の誤射で命を落とした');
        });

        it('6.2 zapped herself with a wand of striking (女性キャラ杖誤射)', () => {
            const result = PostMortemKnowledgeResolver.resolve('zapped herself with a wand of striking');
            expect(result.category).toBe('ITEM_MISHAP');
            expect(result.translatedDeathJa).toBe('自らの打撃の杖の誤射で命を落とした');
        });

        it('6.3 killed by kicking a wall (壁キック事故死)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by kicking a wall');
            expect(result.category).toBe('MISHAP');
            expect(result.translatedDeathJa).toBe('壁を蹴った反動で死亡した');
        });

        it('6.4 killed by genocidal confusion (混乱絶滅の巻物)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by genocidal confusion');
            expect(result.category).toBe('MISHAP');
            expect(result.translatedDeathJa).toBe('絶滅の巻物の混乱により自滅した');
        });
    });

    describe('7. 三騎士および特殊モンスターテスト (5ケース)', () => {
        it('7.1 killed by Death (死の騎士)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by Death');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('デスに倒された');
            expect(result.advice.id).toBe('ADVICE_THREAT_RIDER');
        });

        it('7.2 killed by Pestilence (疫病の騎士)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by Pestilence');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('ペスティレンスに倒された');
            expect(result.advice.id).toBe('ADVICE_THREAT_RIDER');
        });

        it('7.3 killed by Famine (飢饉の騎士)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by Famine');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('フェミンに倒された');
            expect(result.advice.id).toBe('ADVICE_THREAT_RIDER');
        });

        it('7.4 turned to stone by Medusa (メデューサ石化)', () => {
            const result = PostMortemKnowledgeResolver.resolve('turned to stone by Medusa');
            expect(result.category).toBe('PETRIFICATION');
            expect(result.translatedDeathJa).toBe('メデューサの視線により石化した');
            expect(result.advice.id).toBe('ADVICE_THREAT_PETRIFICATION');
        });

        it('7.5 killed by a priest of Moloch (モロクの僧侶)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a priest of Moloch');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('モロクの僧侶に倒された');
        });
    });

    describe('8. 付帯状況 (RCA: Root Cause Arbitration) の網羅的テスト (6ケース)', () => {
        it('8.1 killed by a newt while frozen by a monster\'s gaze (視線凍結優先)', () => {
            const result = PostMortemKnowledgeResolver.resolve("killed by a newt while frozen by a monster's gaze");
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('モンスターの視線で凍りついている間にイモリに倒された');
            expect(result.advice.id).toBe('ADVICE_THREAT_FLOATING_EYE');
            expect(result.rootCause.isHelpless).toBe(true);
        });

        it('8.2 killed by a sewer rat while paralyzed (麻痺優先)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a sewer rat while paralyzed');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('麻痺している間にドブネズミに倒された');
            expect(result.advice.id).toBe('ADVICE_THREAT_FLOATING_EYE');
        });

        it('8.3 killed by a jackal while sleeping (睡眠優先)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a jackal while sleeping');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('眠っている間にジャッカルに倒された');
        });

        it('8.4 killed by a fox while praying (祈祷中)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a fox while praying');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('神に祈りを捧げている間に狐に倒された');
        });

        it('8.5 killed by a goblin while taking off clothes (着脱中)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a goblin while taking off clothes');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('装備を着脱している間にゴブリンに倒された');
        });

        it('8.6 killed by a giant ant while helpless (無力化中)', () => {
            const result = PostMortemKnowledgeResolver.resolve('killed by a giant ant while helpless');
            expect(result.category).toBe('THREAT_MONSTER');
            expect(result.translatedDeathJa).toBe('身動きが取れない間に巨大蟻に倒された');
        });
    });

    describe('9. 生還・脱出・窒息・首絞めテスト (4ケース)', () => {
        it('9.1 escaped the dungeon with the Amulet (魔除け持ち生還)', () => {
            const result = PostMortemKnowledgeResolver.resolve('escaped the dungeon with the Amulet');
            expect(result.category).toBe('ESCAPED');
            expect(result.isVictory).toBe(true);
            expect(result.translatedDeathJa).toContain('魔除けを手にダンジョンから生還した');
        });

        it('9.2 escaped the dungeon (魔除けなし脱出)', () => {
            const result = PostMortemKnowledgeResolver.resolve('escaped the dungeon');
            expect(result.category).toBe('ESCAPED');
            expect(result.isVictory).toBe(false);
            expect(result.translatedDeathJa).toContain('ダンジョンから脱出・生還した');
        });

        it('9.3 strangled by an amulet of strangulation (首絞め魔除け)', () => {
            const result = PostMortemKnowledgeResolver.resolve('strangled by an amulet of strangulation');
            expect(result.category).toBe('STRANGULATION');
            expect(result.translatedDeathJa).toBe('首絞めの魔除けにより絞殺された');
            expect(result.advice.id).toBe('ADVICE_SURVIVAL_CHOKING');
        });

        it('9.4 drowned in a moat (堀での溺死)', () => {
            const result = PostMortemKnowledgeResolver.resolve('drowned in a moat');
            expect(result.category).toBe('DROWNING');
            expect(result.translatedDeathJa).toBe('堀に沈んで溺死した');
        });
    });

    describe('10. translateDeathReason 静的メソッドの包括テスト', () => {
        it('代表的な死因英文が正しく日本語文字列として返ること', () => {
            expect(PostMortemKnowledgeResolver.translateDeathReason('ascended to demigod-hood'))
                .toBe('世界の主として昇天した！');
            expect(PostMortemKnowledgeResolver.translateDeathReason('quit'))
                .toBe('冒険を途中で断念した');
            expect(PostMortemKnowledgeResolver.translateDeathReason('died of starvation'))
                .toBe('飢えにより力尽きた');
            expect(PostMortemKnowledgeResolver.translateDeathReason('killed by a cockatrice'))
                .toBe('コカトリスに倒された');
            expect(PostMortemKnowledgeResolver.translateDeathReason('choked on a meatball'))
                .toContain('窒息死した');
            expect(PostMortemKnowledgeResolver.translateDeathReason('drowned in a pool of water'))
                .toBe('水底に沈んで溺死した');
            expect(PostMortemKnowledgeResolver.translateDeathReason('poisoned by a rotted rothe corpse'))
                .toContain('腐ったロゼの死骸の毒で命を落とした');
        });

        it('エッジケース: null, undefined, 空文字を与えても例外を投げずに空文字を返却すること', () => {
            expect(PostMortemKnowledgeResolver.translateDeathReason(null)).toBe('');
            expect(PostMortemKnowledgeResolver.translateDeathReason(undefined)).toBe('');
            expect(PostMortemKnowledgeResolver.translateDeathReason('')).toBe('');
            expect(PostMortemKnowledgeResolver.translateDeathReason('   ')).toBe('');
            expect(PostMortemKnowledgeResolver.translateDeathReason(12345)).toBe('');
        });

        it('未知の死因英文が与えられた場合、例外を投げずに原文死因にフォールバックすること', () => {
            const unknownDeath = 'fell into a cosmic rift';
            const result = PostMortemKnowledgeResolver.translateDeathReason(unknownDeath);
            expect(result).toBe(unknownDeath);
        });
    });
});
