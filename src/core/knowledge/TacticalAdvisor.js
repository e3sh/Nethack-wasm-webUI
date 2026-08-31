/**
 * TacticalAdvisor.js
 * 
 * プレイヤーの状況認識、危険予知、装備適正、サバイバル判断を支援する戦術アドバイス生成エンジン。
 * 「即時1ターン実行」を担う ContextActionEngine とは明確に分離され、
 * ナレッジ層のメタデータ・フラグとゲーム状態を照合して「示唆・警告・レター提示」を行います。
 */

import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';
import { MONSTER_KNOWLEDGE_MAP } from './MONSTER_KNOWLEDGE_FULL.js';
import { ITEM_INTERACTION_RULES, evaluateInteractionRule } from './ITEM_INTERACTION_RULES.js';
import { isShopkeeperMonster } from './glyphClassifier.js';

export class TacticalAdvisor {

    /**
     * ゲーム状態を横断分析し、戦術アドバイス一覧を生成・スコア順にソートして返却する
     * @param {Object} context
     * @param {Object} [context.areaState]
     * @param {Object} [context.inventoryState]
     * @param {Object} [context.skillStateManager]
     * @param {Object} [context.statusAccessor]
     * @param {Object} [context.spellStateManager]
     * @param {Object} [options]
     * @param {string} [options.language='ja']
     * @param {number} [options.threshold=0]
     * @returns {Array<Object>} advices
     */
    static generateAdvices(context = {}, options = {}) {
        const {
            areaState = null,
            inventoryState = null,
            skillStateManager = null,
            statusAccessor = null,
            spellStateManager = null,
            attributeStateManager = null
        } = context;

        const language = options.language || 'ja';
        const threshold = options.threshold || 0;
        const advices = [];

        // 1. 致命的・モンスター脅威アドバイスの評価 (Threat & Monster Hazard)
        this.evaluateThreatAdvices(areaState, inventoryState, attributeStateManager, advices);

        // 2. 地形・環境ハザードアドバイスの評価 (Terrain Hazards: Water, Lava, Traps)
        this.evaluateTerrainHazardAdvices(areaState, inventoryState, attributeStateManager, advices);

        // 3. アイテム・手品袋爆発ハザードの評価 (Item Hazards: Bag of Holding explosion)
        this.evaluateItemHazardAdvices(inventoryState, advices);

        // 4. 装備適正・熟練武器アドバイスの評価 (Equipment & Weapon Suitability)
        this.evaluateEquipmentAdvices(inventoryState, skillStateManager, advices);

        // 5. 魔法詠唱・防具干渉アドバイスの評価 (Magic & Metallic Armor Penalty)
        this.evaluateMagicAdvices(inventoryState, spellStateManager, advices);

        // 6. サバイバル・ステータス危機アドバイスの評価 (Survival & Status Hazards)
        this.evaluateSurvivalAdvices(statusAccessor, inventoryState, advices);

        // 7. アイテム・相互作用アドバイスの評価 (Item Interaction & Testing Rules)
        this.evaluateItemInteractionAdvices(areaState, inventoryState, statusAccessor, advices);

        // スコア降順にソート
        advices.sort((a, b) => (b.score || 0) - (a.score || 0));


        // 閾値フィルター
        const filtered = advices.filter(adv => (adv.score || 0) >= threshold);

        // 言語に応じた message プロパティの正規化
        return filtered.map(adv => ({
            ...adv,
            message: language === 'ja' ? (adv.messageJa || adv.messageEn) : (adv.messageEn || adv.messageJa)
        }));
    }

    /**
     * 1. 脅威・危険モンスター・環境ハザード評価
     */
    /**
     * 1. 脅威・危険モンスター・環境ハザード評価 (SSOT & 確定耐性・所持品連動型)
     */
    static evaluateThreatAdvices(areaState, inventoryState, attributeStateManager, advices) {
        if (!areaState) return;

        const playerX = areaState.playerLocation ? areaState.playerLocation.x : (areaState.center ? areaState.center.x : 0);
        const playerY = areaState.playerLocation ? areaState.playerLocation.y : (areaState.center ? areaState.center.y : 0);
        const grid = areaState.grid;

        // 手袋を着用しているか判定 (SSOT: armorSlot === 'gloves' or category)
        const isWearingGloves = inventoryState ? (
            typeof inventoryState.isWearingCategory === 'function' 
                ? inventoryState.isWearingCategory('ARMOR_GLOVES') 
                : (inventoryState.items || []).some(i => i.isWorn && (
                    i.armorSlot === 'gloves' || i.knowledge?.armorSlot === 'gloves' || 
                    (i.name || i.rawText || '').toLowerCase().includes('gloves') || 
                    (i.name || i.rawText || '').toLowerCase().includes('gauntlets')
                ))
        ) : false;

        // 目隠し/タオルを着用しているか判定 (SSOT: onum 259: blindfold, 260: towel)
        const isBlindfolded = inventoryState ? (
            (inventoryState.items || []).some(i => i.isWorn && (
                i.onum === 259 || i.onum === 260 || i.knowledge?.onum === 259 || i.knowledge?.onum === 260 ||
                (i.name || i.rawText || '').toLowerCase().includes('blindfold') || 
                (i.name || i.rawText || '').toLowerCase().includes('towel')
            ))
        ) : false;

        // プレイヤーの有効耐性を取得 (AttributeStateManager: SSOT確定耐性)
        const effectiveResists = (attributeStateManager && typeof attributeStateManager.getEffectiveResistances === 'function')
            ? attributeStateManager.getEffectiveResistances()
            : {};

        // インベントリから対策アイテム（手袋、目隠し、銀製武器、解毒、遠距離武器等）を抽出 (SSOT連動)
        const gloveItems = inventoryState ? (inventoryState.items || []).filter(i => {
            if (i.isWorn) return false;
            const isGloveSlot = i.armorSlot === 'gloves' || i.knowledge?.armorSlot === 'gloves';
            const raw = (i.rawText || i.name || '').toLowerCase();
            return isGloveSlot || raw.includes('gloves') || raw.includes('gauntlets') || raw.includes('手袋') || raw.includes('小手');
        }) : [];

        const blindfoldItems = inventoryState ? (inventoryState.items || []).filter(i => {
            if (i.isWorn) return false;
            const isOnum = i.onum === 259 || i.onum === 260 || i.knowledge?.onum === 259 || i.knowledge?.onum === 260;
            const raw = (i.rawText || i.name || '').toLowerCase();
            return isOnum || raw.includes('blindfold') || raw.includes('towel');
        }) : [];

        const silverWeapons = inventoryState ? (inventoryState.items || []).filter(i => {
            const isSilverMat = i.material === 'silver' || i.knowledge?.material === 'silver';
            const raw = (i.rawText || i.name || '').toLowerCase();
            return isSilverMat || raw.includes('silver') || raw.includes('銀');
        }) : [];

        const cureSicknessItems = inventoryState ? (inventoryState.items || []).filter(i => {
            const eff = i.effects || i.knowledge?.effects || {};
            return Boolean(eff.cureSickness);
        }) : [];

        const rangedItems = inventoryState ? (inventoryState.items || []).filter(i => {
            return i.isLauncher || i.isAmmo || i.knowledge?.isLauncher || i.knowledge?.isAmmo || i.category === 'WAND';
        }) : [];

        // 脅威タイプ別の集約状態
        const threats = {
            petrify: { detected: false, maxWeight: 0, monName: '', monNameJa: '', threatDef: null },
            paralysis: { detected: false, maxWeight: 0, monName: '', monNameJa: '', threatDef: null },
            poison: { detected: false, maxWeight: 0, monName: '', monNameJa: '', threatDef: null },
            spore: { detected: false, maxWeight: 0, monName: '', monNameJa: '', threatDef: null },
            drain: { detected: false, maxWeight: 0, monName: '', monNameJa: '', threatDef: null },
            rust: { detected: false, maxWeight: 0, monName: '', monNameJa: '', threatDef: null },
            brain: { detected: false, maxWeight: 0, monName: '', monNameJa: '', threatDef: null },
            slime: { detected: false, maxWeight: 0, monName: '', monNameJa: '', threatDef: null },
            drown: { detected: false, maxWeight: 0, monName: '', monNameJa: '', threatDef: null },
            confusionGaze: { detected: false, maxWeight: 0, monName: '', monNameJa: '', threatDef: null },
            evilSlaying: { detected: false, maxWeight: 0, monName: '', monNameJa: '' }
        };

        const checkMonsterEntity = (mon, dist, weight = 1.0) => {
            if (!mon) return;
            const isExplicitHostile = mon.isHostile || mon.attitude === 'HOSTILE';
            if (mon.type === 'PET' || mon.isPet || mon.isTame || mon.isPeaceful || mon.attitude === 'PEACEFUL' || mon.flags?.isPet || mon.glyphInfo?.isPet) {
                return; // ペット・友好的NPCは脅威判定から除外
            }
            const monOffset = mon.monOffset !== undefined ? mon.monOffset : (mon.subType !== undefined ? mon.subType : (mon.glyphInfo?.monOffset));
            const monKnowledge = (monOffset !== undefined ? MONSTER_KNOWLEDGE_MAP.get(monOffset) : null) || {};
            const isSk = isShopkeeperMonster(mon) || monOffset === 271;
            if (!isExplicitHostile && (isSk || monKnowledge.defaultPeaceful)) {
                return; // 通常の店主・神官・平和的NPCは脅威判定から除外
            }
            const monName = mon.name || monKnowledge.name || 'unknown';
            const monNameJa = mon.nameJa || monKnowledge.nameJa || monName;
            const traits = monKnowledge.traits || {};
            const threat = monKnowledge.threat || null;
            const threatType = threat ? threat.type : null;
            const attacks = Array.isArray(monKnowledge.attacks) ? monKnowledge.attacks : [];

            // 1. 石化 (PETRIFICATION)
            if (threatType === 'PETRIFICATION' || traits.petrifiesOnTouch || monKnowledge.petrifiesOnTouch) {
                threats.petrify.detected = true;
                if (weight > threats.petrify.maxWeight) {
                    threats.petrify.maxWeight = weight;
                    threats.petrify.monName = monName;
                    threats.petrify.monNameJa = monNameJa;
                    threats.petrify.threatDef = threat;
                }
            }

            // 2. 視線麻痺 (GAZE_PARALYSIS)
            if (threatType === 'GAZE_PARALYSIS' || traits.paralysisGaze || monKnowledge.paralysisGaze) {
                if (dist <= 4 || weight < 1.0) {
                    threats.paralysis.detected = true;
                    if (weight > threats.paralysis.maxWeight) {
                        threats.paralysis.maxWeight = weight;
                        threats.paralysis.monName = monName;
                        threats.paralysis.monNameJa = monNameJa;
                        threats.paralysis.threatDef = threat;
                    }
                }
            }

            // 3. 毒 (POISON)
            if (threatType === 'POISON' || attacks.some(a => a.effect === 'poison')) {
                threats.poison.detected = true;
                if (weight > threats.poison.maxWeight) {
                    threats.poison.maxWeight = weight;
                    threats.poison.monName = monName;
                    threats.poison.monNameJa = monNameJa;
                    threats.poison.threatDef = threat;
                }
            }

            // 4. 近接自爆 (EXPLOSION)
            if (threatType === 'EXPLOSION' || traits.explodesOnMelee || monKnowledge.explodesOnMelee) {
                if (dist === 1 && weight === 1.0) {
                    threats.spore.detected = true;
                    if (weight > threats.spore.maxWeight) {
                        threats.spore.maxWeight = weight;
                        threats.spore.monName = monName;
                        threats.spore.monNameJa = monNameJa;
                        threats.spore.threatDef = threat;
                    }
                }
            }

            // 5. レベルドレイン (LEVEL_DRAIN)
            if (threatType === 'LEVEL_DRAIN' || traits.drainsLevel || attacks.some(a => a.effect === 'drain_level')) {
                threats.drain.detected = true;
                if (weight > threats.drain.maxWeight) {
                    threats.drain.maxWeight = weight;
                    threats.drain.monName = monName;
                    threats.drain.monNameJa = monNameJa;
                    threats.drain.threatDef = threat;
                }
            }

            // 6. 装備腐食・錆び (EQUIPMENT_DAMAGE)
            if ((threatType === 'EQUIPMENT_DAMAGE' && (threat.description?.includes('Rust') || traits.rustsEquipment)) || traits.rustsEquipment) {
                threats.rust.detected = true;
                if (weight > threats.rust.maxWeight) {
                    threats.rust.maxWeight = weight;
                    threats.rust.monName = monName;
                    threats.rust.monNameJa = monNameJa;
                    threats.rust.threatDef = threat;
                }
            }

            // 7. 知性吸い (BRAIN_EAT)
            if (threatType === 'BRAIN_EAT' || traits.eatsBrain) {
                threats.brain.detected = true;
                if (weight > threats.brain.maxWeight) {
                    threats.brain.maxWeight = weight;
                    threats.brain.monName = monName;
                    threats.brain.monNameJa = monNameJa;
                    threats.brain.threatDef = threat;
                }
            }

            // 8. スライム化 (SLIME)
            if (threatType === 'SLIME' || traits.causesSlime) {
                threats.slime.detected = true;
                if (weight > threats.slime.maxWeight) {
                    threats.slime.maxWeight = weight;
                    threats.slime.monName = monName;
                    threats.slime.monNameJa = monNameJa;
                    threats.slime.threatDef = threat;
                }
            }

            // 9. 水中引き込み・溺死 (DROWNING)
            if (threatType === 'DROWNING' || traits.drownsPlayer) {
                threats.drown.detected = true;
                if (weight > threats.drown.maxWeight) {
                    threats.drown.maxWeight = weight;
                    threats.drown.monName = monName;
                    threats.drown.monNameJa = monNameJa;
                    threats.drown.threatDef = threat;
                }
            }

            // 10. 視線混乱 (CONFUSION_GAZE)
            if (threatType === 'CONFUSION_GAZE' || traits.gazeConfusion) {
                if (dist <= 4 || weight < 1.0) {
                    threats.confusionGaze.detected = true;
                    if (weight > threats.confusionGaze.maxWeight) {
                        threats.confusionGaze.maxWeight = weight;
                        threats.confusionGaze.monName = monName;
                        threats.confusionGaze.monNameJa = monNameJa;
                        threats.confusionGaze.threatDef = threat;
                    }
                }
            }

            // 11. アンデッド・悪魔・銀弱点 (Evil Slaying)
            if (traits.isUndead || traits.isDemon || monKnowledge.isUndead || monKnowledge.isDemon || (Array.isArray(monKnowledge.weaknesses) && monKnowledge.weaknesses.includes('silver'))) {
                threats.evilSlaying.detected = true;
                if (weight > threats.evilSlaying.maxWeight) {
                    threats.evilSlaying.maxWeight = weight;
                    threats.evilSlaying.monName = monName;
                    threats.evilSlaying.monNameJa = monNameJa;
                }
            }
        };

        if (Array.isArray(grid)) {
            for (let y = 0; y < grid.length; y++) {
                if (!Array.isArray(grid[y])) continue;
                for (let x = 0; x < grid[y].length; x++) {
                    const cell = grid[y][x];
                    if (!cell) continue;

                    const mon = cell.monster || (cell.top && (cell.top.type === 'MONSTER' || cell.top.type === 'PET' || cell.top.monOffset !== undefined) ? cell.top : null);
                    if (!mon) continue;

                    const dist = Math.max(Math.abs(x - playerX), Math.abs(y - playerY));
                    checkMonsterEntity(mon, dist, 1.0);
                }
            }
        }

        // adjacentMonsters のチェック
        if (Array.isArray(areaState.adjacentMonsters)) {
            for (const adj of areaState.adjacentMonsters) {
                if (adj && adj.entity) {
                    checkMonsterEntity(adj.entity, 1, 1.0);
                }
            }
        }

        // trackedMonsters (認知メンタルマップ) のチェック
        if (Array.isArray(areaState.trackedMonsters)) {
            for (const tracked of areaState.trackedMonsters) {
                const dist = tracked.lastKnownPos ? Math.max(Math.abs(tracked.lastKnownPos.x - playerX), Math.abs(tracked.lastKnownPos.y - playerY)) : 5;
                const weight = tracked.weight !== undefined ? tracked.weight : (tracked.inLoS ? 1.0 : 0.8);
                checkMonsterEntity(tracked, dist, weight);
            }
        }

        // 1. 石化警告 (手袋未着用 & 石化耐性なし)
        if (threats.petrify.detected) {
            const petrifyMonName = threats.petrify.monName || 'cockatrice';
            const petrifyMonNameJa = threats.petrify.monNameJa || 'コカトリス';
            const hintLetters = gloveItems.map(i => i.letter).filter(Boolean);

            if (!isWearingGloves && !effectiveResists.stoning) {
                if (threats.petrify.maxWeight >= 1.0) {
                    advices.push({
                        id: 'ADVICE_THREAT_PETRIFICATION',
                        severity: 'CRITICAL',
                        topic: 'THREAT',
                        messageJa: `⚠️ 危険: ${petrifyMonNameJa}が接近！手袋未着用のため素手・直接接触で即死(石化)します。手袋着用または遠隔攻撃を推奨。`,
                        messageEn: `⚠️ DANGER: ${petrifyMonName} approaching! Touching without gloves causes instant petrification. Wear gloves or use ranged attacks.`,
                        hintLetters: hintLetters,
                        hintCommand: hintLetters.length > 0 ? 'W' : 'f',
                        score: 1000
                    });
                } else if (threats.petrify.maxWeight >= 0.8) {
                    advices.push({
                        id: 'ADVICE_THREAT_PETRIFICATION_UNSEEN',
                        severity: 'WARNING',
                        topic: 'THREAT',
                        messageJa: `⚠️ 警戒: 付近に${petrifyMonNameJa}が潜伏中！再接敵に備えて手袋の事前着用を強く推奨。`,
                        messageEn: `⚠️ CAUTION: ${petrifyMonName} lurking nearby! Wear gloves in advance before engaging.`,
                        hintLetters: hintLetters,
                        hintCommand: hintLetters.length > 0 ? 'W' : 'f',
                        score: 800
                    });
                } else if (threats.petrify.maxWeight >= 0.4) {
                    advices.push({
                        id: 'ADVICE_THREAT_PETRIFICATION_DECAY',
                        severity: 'INFO',
                        topic: 'THREAT',
                        messageJa: `⚠️ 周辺警戒: ${petrifyMonNameJa}の気配あり。手袋未着用の場合は事前着用を推奨。`,
                        messageEn: `⚠️ NOTICE: Trace of ${petrifyMonName} detected nearby. Consider wearing gloves.`,
                        hintLetters: hintLetters,
                        hintCommand: hintLetters.length > 0 ? 'W' : 'f',
                        score: 400
                    });
                }
            } else {
                advices.push({
                    id: 'ADVICE_THREAT_PETRIFICATION_SAFE',
                    severity: 'INFO',
                    topic: 'THREAT',
                    messageJa: `🛡️ 防護済み: ${petrifyMonNameJa}が接近中ですが、手袋着用/石化耐性により直接接触時の即死は防止されています。`,
                    messageEn: `🛡️ PROTECTED: ${petrifyMonName} nearby, but gloves/stoning resistance protect against instant petrification.`,
                    hintLetters: [],
                    score: 300
                });
            }
        }

        // 2. 視線麻痺警告 (浮遊目玉等)
        if (threats.paralysis.detected) {
            const eyeMonName = threats.paralysis.monName || 'Floating Eye';
            const eyeMonNameJa = threats.paralysis.monNameJa || '浮遊する目玉';
            const hintLetters = blindfoldItems.map(i => i.letter).filter(Boolean);

            if (!isBlindfolded && !effectiveResists.freeAction) {
                if (threats.paralysis.maxWeight >= 1.0) {
                    advices.push({
                        id: 'ADVICE_THREAT_FLOATING_EYE',
                        severity: 'WARNING',
                        topic: 'THREAT',
                        messageJa: '⚠️ 警告: 浮遊する目玉(Floating Eye)を直視・近接攻撃すると麻痺します。目隠し着用または飛び道具で攻撃してください。',
                        messageEn: '⚠️ WARNING: Attacking Floating Eye in melee causes severe paralysis. Wear a blindfold or attack from range.',
                        hintLetters: hintLetters.length > 0 ? hintLetters : rangedItems.map(i => i.letter).filter(Boolean),
                        hintCommand: hintLetters.length > 0 ? 'W' : 'f',
                        score: 700
                    });
                } else if (threats.paralysis.maxWeight >= 0.8) {
                    advices.push({
                        id: 'ADVICE_THREAT_FLOATING_EYE_UNSEEN',
                        severity: 'INFO',
                        topic: 'THREAT',
                        messageJa: '⚠️ 警戒: 付近に浮遊する目玉(Floating Eye)が潜伏中。目隠し着用または飛び道具の準備を推奨。',
                        messageEn: '⚠️ CAUTION: Floating Eye lurking nearby. Prepare blindfold or ranged attacks.',
                        hintLetters: hintLetters.length > 0 ? hintLetters : rangedItems.map(i => i.letter).filter(Boolean),
                        hintCommand: hintLetters.length > 0 ? 'W' : 'f',
                        score: 560
                    });
                }
            } else {
                const reasonJa = effectiveResists.freeAction ? '自由行動(Free Action)耐性' : '目隠し着用';
                const reasonEn = effectiveResists.freeAction ? 'Free Action' : 'Blindfold';
                advices.push({
                    id: 'ADVICE_THREAT_FLOATING_EYE_SAFE',
                    severity: 'INFO',
                    topic: 'THREAT',
                    messageJa: `🛡️ 麻痺無効: ${eyeMonNameJa}の麻痺視線は${reasonJa}により無効化されています。`,
                    messageEn: `🛡️ PARALYSIS IMMUNE: ${eyeMonName} gaze is negated by ${reasonEn}.`,
                    hintLetters: [],
                    score: 300
                });
            }
        }

        // 3. 毒警告 (キラービー・ソルジャーアント等)
        if (threats.poison.detected) {
            const poisonMonName = threats.poison.monName || 'killer bee';
            const poisonMonNameJa = threats.poison.monNameJa || 'キラービー';
            const threatDef = threats.poison.threatDef || {};
            const severity = threatDef.severity || 'WARNING';
            const basePriority = threatDef.basePriority || 70;

            if (!effectiveResists.poison) {
                const letters = [
                    ...cureSicknessItems.map(i => i.letter),
                    ...rangedItems.map(i => i.letter)
                ].filter(Boolean);

                advices.push({
                    id: 'ADVICE_THREAT_POISON',
                    severity: severity,
                    topic: 'THREAT',
                    messageJa: `⚠️ 毒警戒: ${poisonMonNameJa}が接近！毒耐性がないため致命的な毒ダメージを受けます。遠距離武器やエルベレスで迎撃してください。`,
                    messageEn: `⚠️ POISON HAZARD: ${poisonMonName} approaching! Lethal poison damage without poison resistance. Fight from range or use Elbereth.`,
                    hintLetters: letters.slice(0, 3),
                    hintCommand: cureSicknessItems.length > 0 ? (cureSicknessItems[0].knowledge?.actionVerb || 'a') : 'f',
                    score: basePriority * 10
                });
            } else {
                advices.push({
                    id: 'ADVICE_THREAT_POISON_SAFE',
                    severity: 'INFO',
                    topic: 'THREAT',
                    messageJa: `🛡️ 毒耐性あり: ${poisonMonNameJa}が接近中ですが、毒耐性があるため毒による即死・追加ダメージは無効化されます。`,
                    messageEn: `🛡️ POISON IMMUNE: ${poisonMonName} approaching, but poison resistance protects from lethal damage.`,
                    hintLetters: [],
                    score: 300
                });
            }
        }

        // 4. 近接自爆警告 (ガス胞子等)
        if (threats.spore.detected) {
            advices.push({
                id: 'ADVICE_THREAT_GAS_SPORE',
                severity: 'WARNING',
                topic: 'THREAT',
                messageJa: '⚠️ 警告: ガス胞子(Gas Spore)が隣接しています！近接攻撃すると大爆発します。後退するか飛び道具で撃破してください。',
                messageEn: '⚠️ WARNING: Gas Spore adjacent! Melee attack triggers massive explosion. Step back or shoot from range.',
                hintLetters: rangedItems.map(i => i.letter).filter(Boolean),
                hintCommand: 'f',
                score: 850
            });
        }

        // 5. レベルドレイン警告 (吸血鬼・レイス等)
        if (threats.drain.detected) {
            const drainMonName = threats.drain.monName || 'undead';
            const drainMonNameJa = threats.drain.monNameJa || '吸血鬼/レイス';

            if (!effectiveResists.drain) {
                advices.push({
                    id: 'ADVICE_THREAT_LEVEL_DRAIN',
                    severity: 'WARNING',
                    topic: 'THREAT',
                    messageJa: `🩸 ドレイン警戒: ${drainMonNameJa}が接近！ドレイン耐性がないため経験レベルが吸い取られます。遠隔やエルベレスで迎撃してください。`,
                    messageEn: `🩸 LEVEL DRAIN WARNING: ${drainMonName} nearby! Attacks drain experience level without drain resistance. Fight from range.`,
                    hintLetters: [],
                    hintCommand: 'f',
                    score: 820
                });
            } else {
                advices.push({
                    id: 'ADVICE_THREAT_LEVEL_DRAIN_SAFE',
                    severity: 'INFO',
                    topic: 'THREAT',
                    messageJa: `🛡️ ドレイン耐性あり: ${drainMonNameJa}が接近中ですが、ドレイン耐性により経験レベルの低下は防止されています。`,
                    messageEn: `🛡️ DRAIN RESISTANT: ${drainMonName} nearby, but drain resistance prevents level loss.`,
                    hintLetters: [],
                    score: 300
                });
            }
        }

        // 6. 装備腐食・錆び警告 (ラストモンスター等)
        if (threats.rust.detected) {
            const hasIronGear = inventoryState ? (inventoryState.items || []).some(i => {
                if (!i.isWorn) return false;
                const k = i.knowledge || (i.onum !== undefined ? OBJECT_KNOWLEDGE_MAP.get(i.onum) : null);
                if (k && (k.material === 'iron' || k.material === 'copper' || k.material === 'metal')) return true;
                const raw = (i.name || i.rawText || '').toLowerCase();
                return raw.includes('iron') || raw.includes('mail') || raw.includes('sword') || raw.includes('helmet');
            }) : false;

            if (hasIronGear) {
                const rustMonName = threats.rust.monName || 'rust monster';
                const rustMonNameJa = threats.rust.monNameJa || 'ラストモンスター';
                advices.push({
                    id: 'ADVICE_THREAT_RUST_MONSTER',
                    severity: 'WARNING',
                    topic: 'THREAT',
                    messageJa: `🛡️ 腐食警告: ${rustMonNameJa}が接近！鉄製装備が錆びて劣化・破壊されます。木製/銀製装備への持ち替えや素手・遠隔攻撃を推奨。`,
                    messageEn: `🛡️ RUST HAZARD: ${rustMonName} approaching! It rusts and destroys iron gear. Switch to wooden/silver weapons or fight from range.`,
                    hintLetters: [],
                    hintCommand: 'w',
                    score: 750
                });
            }
        }

        // 7. 知性吸い・脳食い警告 (マインドフレア等)
        if (threats.brain.detected) {
            advices.push({
                id: 'ADVICE_THREAT_MIND_FLAYER',
                severity: 'CRITICAL',
                topic: 'THREAT',
                messageJa: '🧠 脳食い危険: マインドフレア(Mind Flayer)接近！触手攻撃で知力を吸い尽くされると即死します。エルベレスや遠隔即死で処理してください。',
                messageEn: '🧠 BRAIN EATER DANGER: Mind Flayer nearby! Tentacle attacks permanently eat Int until instant death. Use Elbereth or ranged attacks.',
                hintLetters: rangedItems.map(i => i.letter).filter(Boolean),
                hintCommand: 'f',
                score: 950
            });
        }

        // 8. スライム化警告 (グリーンスライム)
        if (threats.slime.detected) {
            advices.push({
                id: 'ADVICE_THREAT_GREEN_SLIME',
                severity: 'CRITICAL',
                topic: 'THREAT',
                messageJa: '🧪 スライム化警告: グリーンスライム(Green Slime)接近！接触でスライム化即死します。火炎攻撃または遠隔で速やかに撃破してください。',
                messageEn: '🧪 SLIME THREAT: Green Slime nearby! Contact turns player into slime. Use fire attacks or ranged weapons.',
                hintLetters: rangedItems.map(i => i.letter).filter(Boolean),
                hintCommand: 'f',
                score: 920
            });
        }

        // 9. 水没・溺死警告 (クラーケン・ウナギ等)
        if (threats.drown.detected && !effectiveResists.levitation && !effectiveResists.wwalking) {
            advices.push({
                id: 'ADVICE_THREAT_DROWNING',
                severity: 'CRITICAL',
                topic: 'THREAT',
                messageJa: '🌊 溺死警告: 水生魔獣が潜伏！浮遊・水上歩行なしで水辺に近づくと引きずり込まれ即座に溺死します。',
                messageEn: '🌊 DROWNING HAZARD: Aquatic monster nearby! Approaching water without levitation/water-walking causes instant drowning.',
                hintLetters: [],
                score: 960
            });
        }

        // 10. 視線混乱警告 (アンバーハルク等)
        if (threats.confusionGaze.detected && !isBlindfolded && !effectiveResists.conf) {
            advices.push({
                id: 'ADVICE_THREAT_CONFUSION_GAZE',
                severity: 'WARNING',
                topic: 'THREAT',
                messageJa: '💫 混乱視線警告: アンバーハルク(Umber Hulk)の視線で混乱します。目隠し(Blindfold)やタオルを着用して視界を遮断してください。',
                messageEn: '💫 CONFUSION GAZE: Umber Hulk gaze causes severe confusion. Wear a blindfold/towel to block sight.',
                hintLetters: blindfoldItems.map(i => i.letter).filter(Boolean),
                hintCommand: 'W',
                score: 680
            });
        }

        // 11. 銀特効サジェスト
        if (threats.evilSlaying.detected && silverWeapons.length > 0) {
            const unwornSilver = silverWeapons.find(w => !w.isWielded);
            if (unwornSilver) {
                const score = Math.round(450 * (threats.evilSlaying.maxWeight || 1.0));
                const isLurking = threats.evilSlaying.maxWeight < 1.0;
                advices.push({
                    id: isLurking ? 'ADVICE_TACTICS_SILVER_SLAYING_UNSEEN' : 'ADVICE_TACTICS_SILVER_SLAYING',
                    severity: 'INFO',
                    topic: 'TACTICS',
                    messageJa: isLurking
                        ? `🗡️ 特効準備: 近傍に潜伏中の邪悪な敵に備え、銀製武器 [${unwornSilver.letter}] への持ち替えを推奨。`
                        : `🗡️ 特効武器: 邪悪な敵に対して銀製武器 [${unwornSilver.letter}] が特効ダメージ(+1d20)を与えます。`,
                    messageEn: isLurking
                        ? `🗡️ Silver Preparation: Prepare silver weapon [${unwornSilver.letter}] for evil enemies lurking nearby.`
                        : `🗡️ Silver Slaying: Silver weapon [${unwornSilver.letter}] deals bonus damage (+1d20) against demons & undead.`,
                    hintLetters: [unwornSilver.letter],
                    hintCommand: 'w',
                    score: score
                });
            }
        }

        // 12. 足元死体（Corpse）の石化・耐性獲得評価
        if (areaState.feet && areaState.feet.top) {
            const feetItem = areaState.feet.top;
            const raw = (feetItem.name || feetItem.rawText || '').toLowerCase();

            // コカトリス死体が足元にあるが手袋をしていない
            if ((raw.includes('cockatrice corpse') || raw.includes('chickatrice corpse') || raw.includes('コカトリスの死体')) && !isWearingGloves) {
                advices.push({
                    id: 'ADVICE_HAZARD_PETRIFY_CORPSE',
                    severity: 'CRITICAL',
                    topic: 'THREAT',
                    messageJa: '⚠️ 致命的危険: 足元にコカトリスの死体があります！手袋未着用で拾う/触ると即座に石化死します。手袋を着用してください。',
                    messageEn: '⚠️ LETHAL HAZARD: Cockatrice corpse at feet! Picking up without gloves causes instant petrification. Wear gloves first.',
                    hintLetters: [],
                    hintCommand: 'W',
                    score: 990
                });
            }

            // 経験値アップ死体 (レイスの死体)
            if (raw.includes('wraith corpse') || raw.includes('レイスの死体')) {
                advices.push({
                    id: 'ADVICE_TACTICS_EAT_WRAITH_CORPSE',
                    severity: 'TIP',
                    topic: 'SURVIVAL',
                    messageJa: '✨ レベルアップ: 足元のレイスの死体を食べる(\'e\')と経験レベルが1上昇します！腐る前に摂取してください。',
                    messageEn: '✨ LEVEL UP: Eating wraith corpse (\'e\') grants +1 level! Eat before it rots.',
                    hintLetters: [],
                    hintCommand: 'e',
                    score: 800
                });
            }
        }


        // 周辺認知モンスター要約サマリー (Perceived Threat Summary)
        const perceived = Array.isArray(areaState.perceivedMonsters) 
            ? areaState.perceivedMonsters 
            : (Array.isArray(areaState.trackedMonsters) ? areaState.trackedMonsters : []);

        if (perceived.length > 0) {
            // 種族別にグループ集計 (直視中のみ個体数をカウント、潜伏中は気配情報として集計)
            const grouped = new Map();
            for (const p of perceived) {
                const key = p.monOffset !== undefined ? `mon_${p.monOffset}` : (p.name || 'unknown');
                if (!grouped.has(key)) {
                    grouped.set(key, {
                        name: p.name,
                        nameJa: p.nameJa || p.name,
                        visibleCount: 0,
                        hasVisible: false,
                        hasUnseen: false,
                        minDist: Infinity,
                        minDistDir: null
                    });
                }
                const g = grouped.get(key);
                if (p.decayStatus === 'VISIBLE' || p.inLoS) {
                    g.hasVisible = true;
                    g.visibleCount += 1;
                } else {
                    g.hasUnseen = true;
                }

                if (p.distance !== undefined && p.distance < g.minDist) {
                    g.minDist = p.distance;
                    g.minDistDir = p.direction;
                }
            }

            const groupList = Array.from(grouped.values()).sort((a, b) => a.minDist - b.minDist);

            const summaryPartsJa = groupList.slice(0, 3).map(g => {
                const countStr = g.visibleCount > 1 ? ` x${g.visibleCount}` : '';
                const stateStr = g.hasVisible ? `視認中${countStr}` : '潜伏';
                const distStr = g.minDist !== Infinity ? ` ${g.minDist}マス${g.minDistDir?.name || ''}` : '';
                return `${g.nameJa} (${stateStr}${distStr})`;
            });

            const summaryPartsEn = groupList.slice(0, 3).map(g => {
                const countStr = g.visibleCount > 1 ? ` x${g.visibleCount}` : '';
                const stateStr = g.hasVisible ? `Visible${countStr}` : 'Lurking';
                const distStr = g.minDist !== Infinity ? ` ${g.minDist}m ${g.minDistDir?.code || ''}` : '';
                return `${g.name} (${stateStr}${distStr})`;
            });

            const countTextJa = groupList.length > 3 ? `他 ${groupList.length - 3} 種` : '';
            const countTextEn = groupList.length > 3 ? `+${groupList.length - 3} more` : '';

            advices.push({
                id: 'ADVICE_THREAT_PERCEIVED_RADAR',
                severity: 'INFO',
                topic: 'THREAT',
                messageJa: `🧭 周辺の気配: モンスターを認知中 [${summaryPartsJa.join(', ')}${countTextJa ? ' / ' + countTextJa : ''}]`,
                messageEn: `🧭 Perceived Radar: Monsters detected [${summaryPartsEn.join(', ')}${countTextEn ? ' / ' + countTextEn : ''}]`,
                hintLetters: [],
                score: 250
            });
        }
    }

    /**
     * 2. 地形・環境ハザードアドバイスの評価 (Water, Lava, Traps)
     */
    static evaluateTerrainHazardAdvices(areaState, inventoryState, attributeStateManager, advices) {
        if (!areaState) return;

        // プレイヤーの浮遊 (Levitation / Flying) / 水上歩行 (Water Walking) 状態の判定
        let isLevitating = false;
        let isWaterWalking = false;

        if (attributeStateManager && typeof attributeStateManager.getAttributes === 'function') {
            const attrs = attributeStateManager.getAttributes();
            const intrinsics = attrs.intrinsics || {};
            const extrinsics = attrs.extrinsics || {};
            if (intrinsics.levitation || extrinsics.levitation || intrinsics.flying || extrinsics.flying) {
                isLevitating = true;
            }
            if (intrinsics.waterWalking || extrinsics.waterWalking) {
                isWaterWalking = true;
            }
        }

        // インベントリから装備中の浮遊・水上歩行アイテムをチェック
        if (inventoryState && Array.isArray(inventoryState.items)) {
            for (const item of inventoryState.items) {
                if (!item.isWorn) continue;
                const raw = (item.rawText || item.name || '').toLowerCase();
                if (raw.includes('levitation') || raw.includes('浮遊')) isLevitating = true;
                if (raw.includes('water walking') || raw.includes('水上歩行')) isWaterWalking = true;
            }
        }

        let hasWaterAdjacent = false;
        let hasLavaAdjacent = false;
        let hasLethalTrap = false;

        const checkTerrainCell = (cell) => {
            if (!cell) return;
            const bottom = cell.bottom || cell;
            const cmapFlags = bottom.cmapFlags || {};
            const glyph = bottom.glyph !== undefined ? bottom.glyph : bottom.rawGlyph;

            if (cmapFlags.isWater || glyph === 4015 || glyph === 4025) {
                hasWaterAdjacent = true;
            }
            if (cmapFlags.isLava || glyph === 4017 || glyph === 4018) {
                hasLavaAdjacent = true;
            }
            if (cmapFlags.isTrap || (glyph >= 4026 && glyph <= 4048)) {
                hasLethalTrap = true;
            }
        };

        // 足元
        if (areaState.feet) {
            checkTerrainCell(areaState.feet);
        }

        // 隣接セル
        if (Array.isArray(areaState.adjacentEntities)) {
            for (const ent of areaState.adjacentEntities) {
                if (ent && ent.cell) checkTerrainCell(ent.cell);
            }
        }

        // 溶岩警告 (浮遊なし)
        if (hasLavaAdjacent && !isLevitating) {
            advices.push({
                id: 'ADVICE_HAZARD_LAVA',
                severity: 'CRITICAL',
                topic: 'THREAT',
                messageJa: '🌋 溶岩警告: 周辺に溶岩(Lava)があります！浮遊手段なしで侵入すると即死・全アイテムが焼失します。',
                messageEn: '🌋 LAVA HAZARD: Lava nearby! Stepping without levitation causes instant death & destroys all items.',
                hintLetters: [],
                score: 980
            });
        }

        // 水場警告 (浮遊・水上歩行なし)
        if (hasWaterAdjacent && !isLevitating && !isWaterWalking) {
            // 浮遊・水上歩行アイテムのサジェスト
            const waterGear = inventoryState ? (inventoryState.items || []).filter(i => {
                const raw = (i.rawText || i.name || '').toLowerCase();
                return (raw.includes('levitation') || raw.includes('water walking') || raw.includes('浮遊') || raw.includes('水上歩行')) && !i.isWorn;
            }) : [];
            const hintLetters = waterGear.map(i => i.letter).filter(Boolean);

            advices.push({
                id: 'ADVICE_HAZARD_WATER',
                severity: 'WARNING',
                topic: 'THREAT',
                messageJa: '🌊 水場警告: 周辺に水場(Pool/Water)があります。浮遊・水上歩行なしで侵入すると装備の錆びや巻物・薬の水没劣化・溺死リスクがあります。',
                messageEn: '🌊 WATER HAZARD: Water nearby! Entering without levitation/water-walking rusts armor, drowns or ruins potions/scrolls.',
                hintLetters: hintLetters,
                hintCommand: hintLetters.length > 0 ? 'P' : undefined,
                score: 650
            });
        }

        // 危険な罠警告
        if (hasLethalTrap) {
            advices.push({
                id: 'ADVICE_HAZARD_TRAP',
                severity: 'WARNING',
                topic: 'THREAT',
                messageJa: '⚠️ 罠検知: 周辺に露出した罠(Trap)があります。踏まないよう迂回するか慎重に解除してください。',
                messageEn: '⚠️ TRAP HAZARD: Revealed trap nearby. Avoid stepping on it or disarm carefully.',
                hintLetters: [],
                score: 550
            });
        }
    }

    /**
     * 3. アイテム・手品袋爆発ハザードの評価 (Bag of Holding Explosion)
     */
    static evaluateItemHazardAdvices(inventoryState, advices) {
        if (!inventoryState || !Array.isArray(inventoryState.items) || inventoryState.items.length === 0) return;

        const items = inventoryState.items;
        const bagOfHolding = items.find(i => {
            const raw = (i.rawText || i.name || '').toLowerCase();
            return i.onum === 216 || raw.includes('bag of holding') || raw.includes('手品袋') || raw.includes('大袋');
        });

        if (!bagOfHolding) return;

        // 爆発を誘発するアイテム (Bag of Tricks, 別の Bag of Holding, Wand of Cancellation)
        const hazardousItems = items.filter(i => {
            if (i === bagOfHolding) return false;
            const raw = (i.rawText || i.name || '').toLowerCase();
            const knowledge = OBJECT_KNOWLEDGE_MAP.get(i.onum) || {};
            if (knowledge.explodesInBOH) return true;
            if (i.onum === 216 || i.onum === 290) return true;
            return raw.includes('bag of tricks') || raw.includes('bag of holding') || 
                   raw.includes('wand of cancellation') || raw.includes('手品袋') || raw.includes('打ち消しの杖');
        });

        if (hazardousItems.length > 0) {
            const letters = hazardousItems.map(i => i.letter).filter(Boolean);
            advices.push({
                id: 'ADVICE_HAZARD_BAG_OF_HOLDING_EXPLOSION',
                severity: 'CRITICAL',
                topic: 'THREAT',
                messageJa: `💥 爆発危険: 手品袋 [${bagOfHolding.letter}] に魔法の袋 [${letters.join(',')}] や打ち消しの杖を入れると大爆発し全アイテムが消滅・即死します！`,
                messageEn: `💥 EXPLOSION HAZARD: Putting magical bag [${letters.join(',')}] into Bag of Holding [${bagOfHolding.letter}] causes catastrophic explosion & destroys all items!`,
                hintLetters: [bagOfHolding.letter, ...letters],
                score: 1050
            });
        }
    }

    /**
     * 4. 装備適正・熟練武器アドバイスの評価
     */
    static evaluateEquipmentAdvices(inventoryState, skillStateManager, advices) {
        if (!inventoryState || !Array.isArray(inventoryState.items) || inventoryState.items.length === 0) return;

        const items = inventoryState.items;

        // 武器アイテムの抽出（ランチャー/弓/クロスボウは近接持ち替え比較からは除外）
        const meleeWeapons = items.filter(item => {
            if (!item || !item.letter) return false;
            const raw = (item.rawText || item.name || '').toLowerCase();
            // 矢・ボルトなどの弾薬は除外
            if (item.isAmmo || raw.includes('arrow') || raw.includes('bolt') || raw.includes('dart') || raw.includes('shuriken')) return false;
            // 弓・クロスボウなどのランチャーは近接持ち替え比較からは除外
            if (item.isLauncher || raw.includes('crossbow') || raw.includes('bow') || raw.includes('sling')) return false;

            if (item.isWeapon || item.category === 'WEAPON') return true;
            return raw.includes('sword') || raw.includes('dagger') || raw.includes('knife') ||
                   raw.includes('axe') || raw.includes('mace') || raw.includes('spear') ||
                   raw.includes('club') || raw.includes('saber') || raw.includes('scimitar') ||
                   raw.includes('blade') || raw.includes('tsurugi') || raw.includes('katana') ||
                   raw.includes('flail') || raw.includes('hammer') || raw.includes('whip') ||
                   raw.includes('刀') || raw.includes('剣') || raw.includes('槍') || raw.includes('斧');
        });

        if (meleeWeapons.length === 0) return;

        // 現在装備中の武器 (左利き・右利き両対応)
        const currentWielded = meleeWeapons.find(w => w.isWielded || (w.rawText && /weapon in (hand|hands|left hand|right hand)|\(wielded\)|手に持っている/i.test(w.rawText)));

        // 盾着用判定
        const isWearingShield = (inventoryState.items || []).some(i => i.isWorn && (
            (i.armorSlot === 'shield' || (i.rawText || i.name || '').toLowerCase().includes('shield') || (i.rawText || i.name || '').toLowerCase().includes('盾'))
        ));

        // 各武器の多次元スコアリング計算
        const scoredWeapons = meleeWeapons.map(weapon => {
            const skillName = this.matchWeaponToSkill(weapon);
            let skillScore = 0;
            let skillRank = { key: 'unskilled', label: '未熟', en: 'Unskilled' };
            if (skillStateManager && typeof skillStateManager.getSkillRank === 'function') {
                skillRank = skillStateManager.getSkillRank(skillName);
                skillScore = skillRank.score || 0;
            }

            // ナレッジからの基礎攻撃力計算
            const baseDamage = this.calculateBaseDamage(weapon);

            // 強化値・祝福・呪い補正
            let enchantBonus = 0;
            const raw = (weapon.rawText || weapon.name || '').toLowerCase();
            const plusMatch = raw.match(/\+(\d+)/);
            if (plusMatch) enchantBonus += parseInt(plusMatch[1], 10) * 5;
            const minusMatch = raw.match(/\-(\d+)/);
            if (minusMatch) enchantBonus -= parseInt(minusMatch[1], 10) * 5;
            if (raw.includes('blessed') || raw.includes('祝福')) enchantBonus += 5;
            if (!raw.includes('uncursed') && (raw.includes('cursed') || raw.includes('呪われ'))) enchantBonus -= 20;

            // 両手武器ペナルティ (盾着用時)
            let penalty = 0;
            const isTwoHanded = raw.includes('two-handed') || raw.includes('tsurugi') || raw.includes('battle-axe');
            if (isTwoHanded && isWearingShield) {
                penalty += 15;
            }

            const totalScore = skillScore + baseDamage + enchantBonus - penalty;

            return {
                weapon,
                skillName,
                skillRank,
                skillScore,
                baseDamage,
                totalScore,
                isCurrent: weapon === currentWielded
            };
        });

        // スコア降順ソート
        scoredWeapons.sort((a, b) => b.totalScore - a.totalScore);
        const best = scoredWeapons[0];
        if (!best) return;

        const currentScore = currentWielded ? (scoredWeapons.find(sw => sw.isCurrent)?.totalScore ?? 0) : -999;

        // 現在装備中より明確に優れている場合 (スコア差 10 以上) または 未装備の場合
        if (!currentWielded || (!best.isCurrent && (best.totalScore - currentScore >= 10))) {
            const wItem = best.weapon;
            const rankLabel = best.skillRank.label || best.skillRank.en || '未熟';
            const rankLabelEn = best.skillRank.en || best.skillRank.label || 'Unskilled';
            const itemName = wItem.name || wItem.rawText || 'weapon';

            advices.push({
                id: 'ADVICE_EQUIP_SKILLED_WEAPON',
                severity: 'TIP',
                topic: 'EQUIPMENT',
                messageJa: `💡 熟練武器: [${wItem.letter}] ${itemName} (熟練度: ${rankLabel}) の方が高い戦闘効果を発揮します。`,
                messageEn: `💡 Skilled Weapon: [${wItem.letter}] ${itemName} (Skill: ${rankLabelEn}) is more effective.`,
                hintLetters: [wItem.letter],
                hintCommand: 'w',
                score: 300
            });
        }
    }

    /**
     * 3. 魔法詠唱・防具干渉アドバイスの評価
     */
    static evaluateMagicAdvices(inventoryState, spellStateManager, advices) {
        if (!spellStateManager || !inventoryState) return;

        // 習得魔法があるか判定
        let hasSpells = false;
        if (typeof spellStateManager.hasSpells === 'function') {
            hasSpells = spellStateManager.hasSpells();
        } else if (typeof spellStateManager.getSpells === 'function') {
            hasSpells = (spellStateManager.getSpells() || []).length > 0;
        } else if (typeof spellStateManager.getKnownSpells === 'function') {
            hasSpells = (spellStateManager.getKnownSpells() || []).length > 0;
        } else if (Array.isArray(spellStateManager.spells)) {
            hasSpells = spellStateManager.spells.length > 0;
        }

        if (!hasSpells) return;

        // 着用中の防具から金属製のものを抽出
        const wornArmors = (inventoryState.items || []).filter(item => {
            if (!item.isWorn) return false;
            const raw = (item.rawText || item.name || '').toLowerCase();
            const knowledge = OBJECT_KNOWLEDGE_MAP.get(item.onum) || {};
            
            if (knowledge.isMetallic !== undefined) return knowledge.isMetallic;

            // 非金属防具の除外
            if (raw.includes('robe') || raw.includes('leather') || raw.includes('cloth') || 
                raw.includes('dragon scale') || raw.includes('cloak') || raw.includes('ローブ') || 
                raw.includes('革') || raw.includes('布') || raw.includes('マント')) {
                return false;
            }

            // 一般的な金属防具キーワード
            return raw.includes('iron') || raw.includes('metal') || raw.includes('plate') || 
                   raw.includes('chain mail') || raw.includes('scale mail') || raw.includes('ring mail') || 
                   raw.includes('helmet') || raw.includes('shield') || raw.includes('鎧') || raw.includes('兜');
        });

        if (wornArmors.length > 0) {
            const letters = wornArmors.map(a => a.letter).filter(Boolean);
            advices.push({
                id: 'ADVICE_MAGIC_METALLIC_ARMOR',
                severity: 'WARNING',
                topic: 'MAGIC',
                messageJa: `⚠️ 魔法阻害: 金属製防具 [${letters.join(',')}] により魔法詠唱失敗率が上昇しています。ローブ等の非金属防具への着替えを推奨。`,
                messageEn: `⚠️ Spellcasting Penalty: Metallic armor [${letters.join(',')}] increases spell failure rate. Switch to non-metallic armor.`,
                hintLetters: letters,
                hintCommand: 'T',
                score: 500
            });
        }
    }

    /**
     * 4. サバイバル・ステータス危機アドバイスの評価
     */
    static evaluateSurvivalAdvices(statusAccessor, inventoryState, advices) {
        if (!statusAccessor) return;

        let hp = null;
        let maxHp = null;
        let hunger = '';

        if (typeof statusAccessor.getStatus === 'function') {
            const s = statusAccessor.getStatus();
            if (s.hp) {
                hp = s.hp.current;
                maxHp = s.hp.max;
            }
            hunger = s.hunger || '';
        } else {
            hp = typeof statusAccessor.getHp === 'function' ? statusAccessor.getHp() : null;
            maxHp = typeof statusAccessor.getMaxHp === 'function' ? statusAccessor.getMaxHp() : null;
            hunger = typeof statusAccessor.getHungerStatus === 'function' ? statusAccessor.getHungerStatus() : '';
        }

        // HP 危機域 (25% 以下)
        if (hp !== null && maxHp !== null && maxHp > 0) {
            const hpRatio = hp / maxHp;
            if (hpRatio <= 0.25) {
                // 回復薬・回復アイテムの検索 (SSOT: effects.healHp)
                const healPotions = inventoryState ? (inventoryState.items || []).filter(i => {
                    const eff = i.effects || i.knowledge?.effects || {};
                    if (eff.healHp) return true;
                    const raw = (i.rawText || i.name || '').toLowerCase();
                    return raw.includes('healing') || raw.includes('extra healing') || raw.includes('回復の薬');
                }) : [];
                const hintLetters = healPotions.map(i => i.letter).filter(Boolean);

                advices.push({
                    id: 'ADVICE_SURVIVAL_LOW_HP',
                    severity: 'CRITICAL',
                    topic: 'SURVIVAL',
                    messageJa: `🚨 瀕死警告: HPが残り${hp}/${maxHp} (${Math.round(hpRatio * 100)}%) です！回復薬や脱出手段を検討してください。`,
                    messageEn: `🚨 CRITICAL HP: Health is at ${hp}/${maxHp} (${Math.round(hpRatio * 100)}%)! Quaff healing potions or escape immediately.`,
                    hintLetters: hintLetters,
                    hintCommand: hintLetters.length > 0 ? 'q' : undefined,
                    score: 950
                });
            }
        }

        // 飢餓・衰弱
        const hungerLower = (hunger || '').toLowerCase();
        if (hungerLower.includes('fainting') || hungerLower.includes('weak') || hungerLower.includes('気絶') || hungerLower.includes('衰弱')) {
            const foodItems = inventoryState ? (inventoryState.items || []).filter(i => {
                if (i.category === 'FOOD') return true;
                const raw = (i.rawText || i.name || '').toLowerCase();
                return raw.includes('ration') || raw.includes('food') || raw.includes('bread') || raw.includes('食料') || raw.includes('パン');
            }) : [];
            const hintLetters = foodItems.map(i => i.letter).filter(Boolean);

            advices.push({
                id: 'ADVICE_SURVIVAL_STARVATION',
                severity: 'CRITICAL',
                topic: 'SURVIVAL',
                messageJa: `🍖 飢餓警告: 空腹度が「${hunger}」です！餓死する前に直ちに食料を摂取してください。`,
                messageEn: `🍖 STARVATION WARNING: Hunger state is "${hunger}"! Eat food immediately before fainting/starving.`,
                hintLetters: hintLetters,
                hintCommand: 'e',
                score: 900
            });
        }
    }

    /**
     * 武器名から対応スキル種別を同定する
     * @param {Object} weapon 
     * @returns {string} skillName
     */
    static matchWeaponToSkill(weapon) {
        if (!weapon) return 'bare hands';
        const knowledge = OBJECT_KNOWLEDGE_MAP.get(weapon.onum);
        if (knowledge && knowledge.skill && knowledge.skill !== 'none') {
            return knowledge.skill;
        }

        const text = (weapon.name || weapon.rawText || '').toLowerCase();
        if (text.includes('dagger') || text.includes('短剣') || text.includes('ダガー')) return 'dagger';
        if (text.includes('short sword') || text.includes('小剣')) return 'short sword';
        if (text.includes('broadsword') || text.includes('long sword') || text.includes('katana') || text.includes('tsurugi') || text.includes('長剣') || text.includes('刀')) return 'long sword';
        if (text.includes('two-handed sword') || text.includes('両手剣')) return 'two-handed sword';
        if (text.includes('scimitar') || text.includes('シミター')) return 'scimitar';
        if (text.includes('saber') || text.includes('サーベル')) return 'saber';
        if (text.includes('battle-axe') || text.includes('axe') || text.includes('斧')) return 'axe';
        if (text.includes('pick-axe') || text.includes('つるはし') || text.includes('ツルハシ')) return 'pick-axe';
        if (text.includes('mace') || text.includes('メイス')) return 'mace';
        if (text.includes('morning star') || text.includes('モーニングスター')) return 'morning star';
        if (text.includes('flail') || text.includes('フレイル')) return 'flail';
        if (text.includes('hammer') || text.includes('ハンマー') || text.includes('war hammer')) return 'hammer';
        if (text.includes('spear') || text.includes('槍')) return 'spear';
        if (text.includes('quarterstaff') || text.includes('六尺棒') || text.includes('staff') || text.includes('杖')) return 'quarterstaff';
        if (text.includes('club') || text.includes('こん棒') || text.includes('棍棒') || text.includes('aklys')) return 'club';
        if (text.includes('whip') || text.includes('鞭') || text.includes('bullwhip')) return 'whip';
        if (text.includes('unicorn horn') || text.includes('ユニコーンの角')) return 'unicorn horn';

        return 'bare hands';
    }

    /**
     * 武器のダイス基礎期待値ダメージを算出
     * @param {Object} weapon 
     * @returns {number}
     */
    static calculateBaseDamage(weapon) {
        const text = (weapon.name || weapon.rawText || '').toLowerCase();
        if (text.includes('two-handed') || text.includes('tsurugi')) return 6.5; // 1d10 / 1d12 avg
        if (text.includes('katana') || text.includes('broadsword')) return 5.5; // 1d10 avg
        if (text.includes('long sword') || text.includes('battle-axe')) return 4.5; // 1d8 avg
        if (text.includes('short sword') || text.includes('mace') || text.includes('spear')) return 3.5; // 1d6 avg
        if (text.includes('dagger') || text.includes('axe')) return 2.5; // 1d4 avg
        if (text.includes('knife')) return 2.0; // 1d3 avg
        return 2.0;
    }

    /**
     * 7. アイテム・相互作用アドバイスの評価 (Item Interaction & Testing Rules)
     * ITEM_INTERACTION_RULES 辞書をコンテキストと照合し、ADVISOR チャネルのアドバイスを生成
     */
    static evaluateItemInteractionAdvices(areaState, inventoryState, statusAccessor, advices) {
        if (!ITEM_INTERACTION_RULES || !Array.isArray(ITEM_INTERACTION_RULES)) return;

        const context = {
            areaState,
            inventoryState,
            statusAccessor
        };

        for (const rule of ITEM_INTERACTION_RULES) {
            // ADVISOR チャネルが出力対象に含まれていない場合はスキップ
            if (!rule.outputChannels || !rule.outputChannels.includes('ADVISOR') || !rule.advice) {
                continue;
            }

            const evalResult = evaluateInteractionRule(rule, context);
            if (evalResult && evalResult.rule) {
                const advDef = evalResult.rule.advice;
                const params = evalResult.params || {};

                // 動的パラメータの置換
                let messageJa = advDef.messageJa;
                let messageEn = advDef.messageEn;

                Object.entries(params).forEach(([k, v]) => {
                    messageJa = messageJa.replace(new RegExp(`\\$\\{${k}\\}`, 'g'), v);
                    messageEn = messageEn.replace(new RegExp(`\\$\\{${k}\\}`, 'g'), v);
                });

                // ヒントレターの解決
                const hintLetters = [];
                if (advDef.hintLetterParam && params[advDef.hintLetterParam]) {
                    hintLetters.push(params[advDef.hintLetterParam]);
                }

                advices.push({
                    id: `ADVICE_${evalResult.rule.id}`,
                    severity: advDef.severity || 'INFO',
                    topic: advDef.topic || 'TACTICS',
                    messageJa: messageJa,
                    messageEn: messageEn,
                    hintLetters: hintLetters,
                    hintCommand: advDef.hintCommand || undefined,
                    score: advDef.score || 400
                });
            }
        }
    }
}
