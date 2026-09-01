/**
 * AssistSignalSynthesizer.js
 * 
 * GKL 行動指針 (Action Stance) ＆ アシストシグナル (AssistSignal) 統合合成エンジン。
 * 
 * JRPGメンタルモデル（即時特効薬思考）と NetHack 仕様（特効薬希少、安全待機・祈り・反射・失敗率）の
 * 乖離を解消し、画面圧迫・ボタン乱立を防ぎながらプレイヤーの生存率を最大化する。
 * 
 * 【3層情報圧縮モデル】
 * - Level 1: Nano Badge (各所持品・魔法・ステータススロットへのバッジ・枠線)
 * - Level 2: 1-Line Signal (HUD最上部最優先シグナル)
 * - Level 3: Action & Why (ワンタップ実行キーストローク ＆ 理由・Wiki解説)
 */

import { MONSTER_KNOWLEDGE_MAP } from './MONSTER_KNOWLEDGE_FULL.js';
import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';
import { CHEMISTRY_INTERACTIONS } from './CHEMISTRY_KNOWLEDGE_BASE.js';
import { createAssistSignal, ASSIST_SIGNAL_DEFINITIONS } from './ASSIST_SIGNAL_DEFINITIONS.js';

export class AssistSignalSynthesizer {

    /**
     * ゲーム状態を統合解析し、3層情報圧縮モデルに従った AssistState を生成
     * @param {Object} context
     * @param {Object} [context.statusAccessor] - StatusAccessor インスタンスまたは status オブジェクト
     * @param {Object} [context.inventoryStateManager] - InventoryStateManager または items 配列
     * @param {Object} [context.spellStateManager] - SpellStateManager または spells 配列
     * @param {Object} [context.areaStateManager] - AreaStateManager または areaState
     * @param {Object} [context.tacticalAdvices] - TacticalAdvisor が生成した advices 配列
     * @param {Object} [options]
     * @param {'ja'|'en'} [options.language='ja']
     * @param {number} [options.turn]
     * @returns {Object} AssistState
     */
    static synthesize(context = {}, options = {}) {
        const language = options.language || 'ja';
        const isEn = (language === 'en');

        // 状態の正規化取得
        const status = this._extractStatus(context);
        const inventoryItems = this._extractInventoryItems(context);
        const spells = this._extractSpells(context);
        const areaState = this._extractAreaState(context);
        const landmarks = this._extractLandmarks(context, areaState);
        const turn = typeof options.turn === 'number' ? options.turn : (status.turns || 0);

        // ゲーム本編未開始（キャラクター作成・プロンプト入力中等でHP/ステータス未初期化）のガード
        const isGameActive = status && (status.turns > 0 || (status.hp && status.hp.max > 0));
        if (!isGameActive) {
            return {
                turn: 0,
                primarySignal: null,
                slotBadges: {},
                primaryAction: null
            };
        }

        const candidateSignals = [];
        const slotBadges = {};

        // 1. サバイバル＆状態異常 Stance 評価 (瀕死, 石化, スライム, 混乱, 盲目, スタン, 幻覚, 病気, 呪縛)
        this.evaluateSurvivalStance(status, inventoryItems, spells, context, candidateSignals, slotBadges);

        // 2. モンスター脅威＆戦闘 Stance 評価 (浮遊する目玉, 銀弱点, 反射等)
        this.evaluateCombatThreatStance(areaState, inventoryItems, spells, context, candidateSignals, slotBadges);

        // 3. 魔法詠唱・防具干渉・リソース Stance 評価 (金属鎧ペナルティ, MP枯渇, 4大安全ガード)
        this.evaluateMagicAndResourceStance(status, inventoryItems, spells, candidateSignals, slotBadges);

        // 4. フロア案内＆ランドマーク連動 Stance 評価 (指輪+流し台, 死体+祭壇, 階段退避)
        this.evaluateLandmarkStance(landmarks, inventoryItems, status, areaState, candidateSignals, slotBadges);

        // スコア降順にソートして最優先の1件（Level 2 Primary Signal）を選抜
        candidateSignals.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        const primarySignal = candidateSignals.length > 0 ? candidateSignals[0] : null;

        // Level 3 ワンタップアクションの構築
        const primaryAction = primarySignal ? this.buildPrimaryAction(primarySignal, inventoryItems, spells, status) : null;

        return {
            turn,
            primarySignal,
            slotBadges,
            primaryAction
        };
    }

    /**
     * 1. サバイバル＆状態異常 Stance 評価
     */
    static evaluateSurvivalStance(status, inventoryItems, spells, context, candidateSignals, slotBadges) {
        if (!status) return;

        const hp = status.hp || { current: 10, max: 10, percent: 1.0 };
        const conditions = Array.isArray(status.conditions) ? status.conditions : [];
        const condLower = conditions.map(c => String(c).toLowerCase());

        const hasCondition = (name) => {
            const lower = name.toLowerCase();
            return condLower.some(c => c.includes(lower)) || Boolean(status[lower]);
        };

        // 道具・手段の抽出ヘルパー (SSOT カテゴリ判定: 文字列判定を全廃)
        const isPotionItem = (i) => {
            if (!i) return false;
            const k = this._resolveObjectKnowledge(i);
            const cat = i.category || k?.category;
            return cat === 'POTION' || i.isPotion === true;
        };

        const isScrollItem = (i) => {
            if (!i) return false;
            const k = this._resolveObjectKnowledge(i);
            const cat = i.category || k?.category;
            return cat === 'SCROLL' || i.isScroll === true;
        };

        const healingPotion = inventoryItems.find(i => {
            if (!isPotionItem(i)) return false;
            const k = this._resolveObjectKnowledge(i);
            const eff = { ...(k?.effects || {}), ...(i.effects || {}) };
            const power = eff.healPower || '';
            return eff.healHp && power !== 'MED' && power !== 'FULL' && !eff.cureSickness;
        });

        const extraHealingPotion = inventoryItems.find(i => {
            if (!isPotionItem(i)) return false;
            const k = this._resolveObjectKnowledge(i);
            const eff = { ...(k?.effects || {}), ...(i.effects || {}) };
            const power = eff.healPower || '';
            return eff.healHp && (power === 'MED' || power === 'FULL' || eff.cureSickness);
        });

        const unicornHorn = inventoryItems.find(i => {
            const k = this._resolveObjectKnowledge(i);
            const eff = { ...(k?.effects || {}), ...(i.effects || {}) };
            const cat = i.category || k?.category;
            return eff.cureSickness && cat === 'TOOL';
        });

        const fireSource = inventoryItems.find(i => {
            const k = this._resolveObjectKnowledge(i);
            const eff = { ...(k?.effects || {}), ...(i.effects || {}) };
            return Boolean(eff.createsFire);
        });

        const lizardCorpse = inventoryItems.find(i => {
            const k = this._resolveObjectKnowledge(i);
            const eff = { ...(k?.effects || {}), ...(i.effects || {}) };
            return Boolean(eff.curePetrification);
        });

        const uncurseScroll = inventoryItems.find(i => {
            if (!isScrollItem(i)) return false;
            const k = this._resolveObjectKnowledge(i);
            const eff = { ...(k?.effects || {}), ...(i.effects || {}) };
            return Boolean(eff.removeCurse);
        });

        // 4大安全ガードを満たす治癒魔法の検索 (SSOT: skill, category, effects, または名前)
        const safeHealingSpell = spells.find(s => {
            const isHealing = s.skill === 'healing' || s.category === 'HEALING' || s.effects?.healHp ||
                (s.name || '').toLowerCase().includes('healing') || (s.name || '').toLowerCase().includes('cure');
            if (isHealing) {
                return this.evaluateSpellSafeGuards(s, status, inventoryItems).isSafe;
            }
            return false;
        });

        // 祈りが安全に可能か（ターン経過・属性等、基本は利用可能と仮定）
        const canPray = true;

        // --- A. 石化進行 (Petrifying / Stone) ---
        if (hasCondition('stone') || hasCondition('petrifying')) {
            if (lizardCorpse) {
                const invlet = lizardCorpse.invlet || lizardCorpse.letter || 'a';
                slotBadges[invlet] = {
                    type: 'danger',
                    icon: '🦎',
                    labelJa: '緊急治癒',
                    labelEn: 'Urgent Cure',
                    highlightBorder: true,
                    suggestedVerb: 'eat'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_PETRIFY_CURE', { invlet }));
            } else if (canPray) {
                slotBadges['Petrifying'] = {
                    type: 'danger',
                    icon: '🙏',
                    labelJa: '祈願',
                    labelEn: 'Pray',
                    highlightBorder: true
                };
                candidateSignals.push(createAssistSignal('SIGNAL_PETRIFY_PRAY'));
            }
        }

        // --- B. スライム化 (Sliming / Slimed) ---
        if (hasCondition('slimed') || hasCondition('sliming')) {
            if (fireSource) {
                const invlet = fireSource.invlet || fireSource.letter || 'a';
                slotBadges[invlet] = {
                    type: 'danger',
                    icon: '🔥',
                    labelJa: '治療',
                    labelEn: 'Cure',
                    highlightBorder: true,
                    suggestedVerb: 'zap'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_SLIMING_FIRE', { invlet }));
            } else if (canPray) {
                slotBadges['Slimed'] = {
                    type: 'danger',
                    icon: '🙏',
                    labelJa: '祈願',
                    labelEn: 'Pray',
                    highlightBorder: true
                };
                candidateSignals.push(createAssistSignal('SIGNAL_SLIMING_PRAY'));
            }
        }

        // --- C. 病気・食中毒 (Sick / Ill / FoodPois) ---
        if (hasCondition('ill') || hasCondition('sick') || hasCondition('foodpois')) {
            if (unicornHorn) {
                const invlet = unicornHorn.invlet || unicornHorn.letter || 'a';
                slotBadges[invlet] = {
                    type: 'danger',
                    icon: '🦄',
                    labelJa: '治癒',
                    labelEn: 'Cure',
                    highlightBorder: true,
                    suggestedVerb: 'apply'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_SICK_HORN', { invlet }));
            } else if (extraHealingPotion || healingPotion) {
                const pot = extraHealingPotion || healingPotion;
                const invlet = pot.invlet || pot.letter || 'a';
                slotBadges[invlet] = {
                    type: 'danger',
                    icon: '💊',
                    labelJa: '治癒',
                    labelEn: 'Cure',
                    highlightBorder: true,
                    suggestedVerb: 'quaff'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_SICK_POTION', { invlet }));
            } else if (canPray) {
                candidateSignals.push(createAssistSignal('SIGNAL_SICK_PRAY'));
            }
        }

        // --- D. HP 致命域 (瀕死: HP < 30%) ---
        if (hp.percent > 0 && hp.percent < 0.3) {
            if (healingPotion || extraHealingPotion) {
                const pot = extraHealingPotion || healingPotion;
                const invlet = pot.invlet || pot.letter || 'a';
                slotBadges[invlet] = {
                    type: 'danger',
                    icon: '💊',
                    labelJa: '緊急回復',
                    labelEn: 'Urgent Heal',
                    highlightBorder: true,
                    suggestedVerb: 'quaff'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_HP_CRITICAL_HEAL', { invlet }));
            } else if (safeHealingSpell) {
                const key = safeHealingSpell.letter || safeHealingSpell.spellKey || 'a';
                slotBadges[`spell:${key}`] = {
                    type: 'success',
                    icon: '✨',
                    labelJa: '緊急回復',
                    labelEn: 'Urgent Heal',
                    highlightBorder: true,
                    suggestedVerb: 'cast'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_HP_CRITICAL_SPELL', { spellKey: key }));
            } else if (canPray) {
                slotBadges['hp'] = {
                    type: 'danger',
                    icon: '🙏',
                    labelJa: '祈願',
                    labelEn: 'Pray',
                    highlightBorder: true
                };
                candidateSignals.push(createAssistSignal('SIGNAL_HP_CRITICAL_PRAY'));
            }
        } else if (hp.percent >= 0.3 && hp.percent <= 0.5) {
            // HP 警戒域 (30〜50%)
            if (healingPotion || extraHealingPotion) {
                const pot = extraHealingPotion || healingPotion;
                const invlet = pot.invlet || pot.letter || 'a';
                slotBadges[invlet] = {
                    type: 'warning',
                    icon: '💊',
                    labelJa: '回復',
                    labelEn: 'Heal',
                    highlightBorder: false,
                    suggestedVerb: 'quaff'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_HP_LOW_HEAL', { invlet }));
            }
        }

        // --- E. 混乱 (Confused / Conf) ---
        if (hasCondition('conf') || hasCondition('confused')) {
            if (unicornHorn) {
                const invlet = unicornHorn.invlet || unicornHorn.letter || 'a';
                slotBadges[invlet] = {
                    type: 'info',
                    icon: '🦄',
                    labelJa: '治療',
                    labelEn: 'Cure',
                    highlightBorder: true,
                    suggestedVerb: 'apply'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_CONF_HORN', { invlet }));
            } else {
                slotBadges['Conf'] = {
                    type: 'warning',
                    icon: '🛡️',
                    labelJa: '待機',
                    labelEn: 'Wait'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_CONF_WAIT'));
            }
        }

        // --- F. 盲目 (Blind) ---
        if (hasCondition('blind')) {
            if (unicornHorn) {
                const invlet = unicornHorn.invlet || unicornHorn.letter || 'a';
                slotBadges[invlet] = {
                    type: 'info',
                    icon: '🦄',
                    labelJa: '治療',
                    labelEn: 'Cure',
                    highlightBorder: true,
                    suggestedVerb: 'apply'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_BLIND_HORN', { invlet }));
            } else {
                slotBadges['Blind'] = {
                    type: 'warning',
                    icon: '🛡️',
                    labelJa: '待機',
                    labelEn: 'Wait'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_BLIND_WAIT'));
            }
        }

        // --- G. スタン (Stunned / Stun) ---
        if (hasCondition('stun') || hasCondition('stunned')) {
            candidateSignals.push(createAssistSignal('SIGNAL_STUN_WAIT'));
        }

        // --- H. 幻覚 (Hallu / Hallucination) ---
        if (hasCondition('hallu') || hasCondition('hallucinating')) {
            candidateSignals.push(createAssistSignal('SIGNAL_HALLU_CAUTION'));
        }

        // --- I. 呪縛 (Cursed items - SSOT: bflag, isCursed, buc) ---
        if (hasCondition('cursed') || (inventoryItems.some(i => i.isWorn && (i.bflag === 2 || i.isCursed || i.buc === 'CURSED')))) {
            if (uncurseScroll) {
                const invlet = uncurseScroll.invlet || uncurseScroll.letter || 'a';
                slotBadges[invlet] = {
                    type: 'info',
                    icon: '📜',
                    labelJa: '解呪',
                    labelEn: 'Uncurse',
                    highlightBorder: true,
                    suggestedVerb: 'read'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_CURSED_SCROLL', { invlet }));
            }
        }
    }

    /**
     * 2. モンスター脅威＆戦闘 Stance 評価
     */
    static evaluateCombatThreatStance(areaState, inventoryItems, spells, context, candidateSignals, slotBadges) {
        if (!areaState) return;

        const perceivedMonsters = Array.isArray(areaState.perceivedMonsters) ? areaState.perceivedMonsters : [];
        const adjacentMonsters = Array.isArray(areaState.adjacentMonsters) ? areaState.adjacentMonsters : [];
        const allMonsters = [...perceivedMonsters, ...adjacentMonsters.map(m => m.entity || m)];

        // 浮遊する目玉・視線麻痺敵 (SSOT: threat.type === 'GAZE_PARALYSIS' or paralysisGaze)
        const hasFloatingEye = allMonsters.some(m => {
            const k = this._resolveMonsterKnowledge(m);
            return (k?.threat?.type === 'GAZE_PARALYSIS' || k?.threat?.effect === 'PARALYSIS' || k?.traits?.paralysisGaze);
        });

        if (hasFloatingEye) {
            // 目隠し/タオル所持判定 (SSOT: protectsAgainst.includes('GAZE'))
            const blindfold = inventoryItems.find(i => {
                if (i.isWorn) return false;
                const k = this._resolveObjectKnowledge(i);
                const protects = i.protectsAgainst || k?.protectsAgainst || [];
                return protects.includes('GAZE');
            });

            if (blindfold) {
                const invlet = blindfold.invlet || blindfold.letter || 'a';
                slotBadges[invlet] = {
                    type: 'info',
                    icon: '🙈',
                    labelJa: '装備',
                    labelEn: 'Equip',
                    highlightBorder: true,
                    suggestedVerb: 'wear'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_FLOATING_EYE_BLINDFOLD', { invlet }));
            } else {
                candidateSignals.push(createAssistSignal('SIGNAL_FLOATING_EYE_RANGED'));
            }
        }

        // 銀弱点モンスター (SSOT: vulnerabilities.includes('SILVER') or weaknesses.includes('silver'))
        const hasSilverVulnerableMon = allMonsters.some(m => {
            const k = this._resolveMonsterKnowledge(m);
            return (k?.vulnerabilities?.includes('SILVER') || k?.weaknesses?.includes('silver'));
        });

        if (hasSilverVulnerableMon) {
            // 銀製武器所持判定 (SSOT: isSilver or material === 'silver', WEAPON)
            const silverWeapon = inventoryItems.find(i => {
                if (i.isWorn) return false;
                const k = this._resolveObjectKnowledge(i);
                const isSilver = i.isSilver || k?.isSilver || i.material === 'silver' || k?.material === 'silver';
                const isWeapon = i.isWeapon || i.category === 'WEAPON' || k?.category === 'WEAPON';
                return isSilver && isWeapon;
            });

            if (silverWeapon) {
                const invlet = silverWeapon.invlet || silverWeapon.letter || 'a';
                slotBadges[invlet] = {
                    type: 'success',
                    icon: '✨',
                    labelJa: '特効',
                    labelEn: 'Silver',
                    highlightBorder: true,
                    suggestedVerb: 'wield'
                };
                candidateSignals.push(createAssistSignal('SIGNAL_SILVER_WEAPON_EQUIP', { invlet }));
            }
        }

        // 反射持ちモンスター (SSOT: threat.type === 'REFLECT' or threat.effect === 'REFLECT')
        const hasReflectingMon = allMonsters.some(m => {
            const k = this._resolveMonsterKnowledge(m);
            return (k?.threat?.type === 'REFLECT' || k?.threat?.effect === 'REFLECT' || k?.corpse?.grantsIntrinsics?.includes('reflect'));
        });

        if (hasReflectingMon) {
            candidateSignals.push(createAssistSignal('SIGNAL_MONSTER_REFLECTING'));
        }
    }

    /**
     * 3. 魔法詠唱・防具干渉・リソース Stance 評価
     */
    static evaluateMagicAndResourceStance(status, inventoryItems, spells, candidateSignals, slotBadges) {
        if (!spells || spells.length === 0) return;

        // 金属鎧の着用判定 (SSOT: isMetallic or material in ['iron', 'metal', 'copper', 'silver'])
        const hasMetallicArmor = inventoryItems.some(i => {
            if (!i.isWorn) return false;
            const k = this._resolveObjectKnowledge(i);
            const isMetallic = i.isMetallic || k?.isMetallic;
            const mat = (i.material || k?.material || '').toLowerCase();
            return isMetallic || ['iron', 'metal', 'copper', 'silver'].includes(mat);
        });

        // 攻撃の杖所持判定 (SSOT: isWand, isOffensive)
        const attackWand = inventoryItems.find(i => {
            const k = this._resolveObjectKnowledge(i);
            const isWand = i.isWand || i.category === 'WAND' || k?.category === 'WAND';
            if (!isWand) return false;
            const eff = { ...(k?.effects || {}), ...(i.effects || {}) };
            return Boolean(eff.isOffensive);
        });

        // 全魔法スロットの4大安全ガード検証
        let highFailCount = 0;
        spells.forEach(spell => {
            const guard = this.evaluateSpellSafeGuards(spell, status, inventoryItems);
            const key = spell.letter || spell.spellKey || spell.name;

            if (!guard.isSafe) {
                if (guard.reason === 'HIGH_FAIL_RATE') {
                    highFailCount++;
                    slotBadges[`spell:${key}`] = {
                        type: 'danger',
                        icon: '⚠️',
                        labelJa: `高失敗(${guard.failPercent}%)`,
                        labelEn: `Fail (${guard.failPercent}%)`,
                        highlightBorder: false
                    };
                }
            }
        });

        if (hasMetallicArmor && highFailCount > 0) {
            if (attackWand) {
                const invlet = attackWand.invlet || attackWand.letter || 'a';
                slotBadges[invlet] = {
                    type: 'success',
                    icon: '🪄',
                    labelJa: '推奨',
                    labelEn: 'Recommended',
                    highlightBorder: true,
                    suggestedVerb: 'zap'
                };
            }
            candidateSignals.push(createAssistSignal('SIGNAL_ARMOR_MAGIC_PENALTY', {
                actionKeySequence: attackWand ? ['z', attackWand.invlet || 'a'] : ['z'],
                actionLabelJa: attackWand ? `攻撃の杖を振る (z -> ${attackWand.invlet || 'a'})` : '杖を振る (z)',
                actionLabelEn: attackWand ? `Zap wand (z -> ${attackWand.invlet || 'a'})` : 'Zap wand (z)'
            }));
        }
    }

    /**
     * 4. フロア案内＆ランドマーク連動 Stance 評価
     */
    static evaluateLandmarkStance(landmarks, inventoryItems, status, areaState, candidateSignals, slotBadges) {
        if (!landmarks) return;

        // 1. 未識別指輪 ＋ 流し台 (Sink ID)
        const sinkInteraction = CHEMISTRY_INTERACTIONS.find(c => c.id === 'CHEMISTRY_SINK_DROP_RING');

        const isRingItem = (i) => {
            if (!i) return false;
            const k = this._resolveObjectKnowledge(i);
            const cat = i.category || i.itemCategory || i.onumCategory || k?.category;
            return cat === 'RING' || i.isRing === true;
        };

        const hasUnidentifiedRing = inventoryItems.some(i => {
            const isUnidentified = (!i.identified && !i.isFullyIdentified && !(i.identification && (i.identification.level === 'TYPE_IDENTIFIED' || i.identification.level === 'FULLY_IDENTIFIED')));
            return isRingItem(i) && isUnidentified;
        });

        const hasSinkOnFloor = (landmarks.sinks && landmarks.sinks.length > 0) ||
            (landmarks.all && landmarks.all.some(l => l.type === 'SINK'));

        if (hasUnidentifiedRing && hasSinkOnFloor) {
            candidateSignals.push(createAssistSignal('SIGNAL_LANDMARK_SINK_RING', {
                detailWhyJa: sinkInteraction?.effect?.noteJa,
                detailWhyEn: sinkInteraction?.effect?.noteEn,
                actionLabelJa: sinkInteraction?.action?.labelJa,
                actionLabelEn: sinkInteraction?.action?.labelEn
            }));
        }

        // 2. 重い死体 ＋ 自属性祭壇 (Corpse Sacrifice)
        const altarInteraction = CHEMISTRY_INTERACTIONS.find(c => c.id === 'CHEMISTRY_ALTAR_OFFER_CORPSE');

        const playerAlign = (status && status.align ? String(status.align).toLowerCase() : 'neutral');
        const hasCorpse = inventoryItems.some(i => {
            const k = this._resolveObjectKnowledge(i);
            const cat = i.category || k?.category;
            return (cat === 'FOOD' || i.isFood) && (k?.isCorpse || i.isCorpse || i.corpseOf || k?.corpseOf);
        });

        const matchingAltar = (landmarks.altars || []).find(a => {
            const align = (a.details && a.details.alignment) || 'neutral';
            return align === playerAlign || align === 'unaligned';
        });

        if (hasCorpse && matchingAltar) {
            candidateSignals.push(createAssistSignal('SIGNAL_LANDMARK_ALTAR_SACRIFICE', {
                detailWhyJa: altarInteraction?.effect?.noteJa,
                detailWhyEn: altarInteraction?.effect?.noteEn,
                actionKeySequence: altarInteraction?.action?.keySequence,
                actionLabelJa: altarInteraction?.action?.labelJa,
                actionLabelEn: altarInteraction?.action?.labelEn
            }));
        }

        // 3. 瀕死・危険 ＋ 階段退避 (Stair Escape)
        const hp = status && status.hp ? status.hp : { percent: 1.0, current: 10, max: 10 };
        const hasStairUp = (landmarks.stairsUp && landmarks.stairsUp.length > 0) ||
            (landmarks.all && landmarks.all.some(l => l.type === 'STAIR_UP'));

        if (hp && hp.max > 0 && hp.current > 0 && hp.percent < 0.3 && hasStairUp) {
            candidateSignals.push(createAssistSignal('SIGNAL_LANDMARK_STAIR_ESCAPE'));
        }
    }

    /**
     * 取得魔法の「4大安全ガード」検証
     * @param {Object} spell 
     * @param {Object} status 
     * @param {Array<Object>} inventoryItems 
     * @returns {{ isSafe: boolean, failPercent: number, reason?: string }}
     */
    static evaluateSpellSafeGuards(spell, status, inventoryItems = []) {
        if (!spell) return { isSafe: false, failPercent: 100, reason: 'NOT_FOUND' };

        // 1. 失敗率ガード (≦ 25%)
        let failPercent = 0;
        if (typeof spell.failPercent === 'number') {
            failPercent = spell.failPercent;
        } else if (spell.failRate) {
            const parsed = parseInt(String(spell.failRate).replace('%', ''), 10);
            failPercent = isNaN(parsed) ? 0 : parsed;
        }

        if (failPercent > 25) {
            return { isSafe: false, failPercent, reason: 'HIGH_FAIL_RATE' };
        }

        // 2. 霊力 (Pw) ガード (現在 Pw ≧ 必要コスト)
        const curPw = status && status.pw ? status.pw.current : 10;
        const requiredPw = (spell.level || 1) * 5;
        if (curPw < requiredPw) {
            return { isSafe: false, failPercent, reason: 'LOW_PW' };
        }

        // 3. 空腹度ガード (Weak/Fainting 時は詠唱不可/危険)
        const hunger = status && status.hunger ? String(status.hunger).toLowerCase() : '';
        if (hunger.includes('faint') || hunger.includes('starv') || hunger.includes('weak')) {
            return { isSafe: false, failPercent, reason: 'HUNGER_PENALTY' };
        }

        return { isSafe: true, failPercent };
    }

    /**
     * Level 3 ワンタップアクションの構築
     */
    static buildPrimaryAction(primarySignal, inventoryItems, spells, status) {
        if (!primarySignal) return null;

        if (primarySignal.actionKeySequence) {
            return {
                id: `ACTION_${primarySignal.id}`,
                labelJa: primarySignal.actionLabelJa || primarySignal.shortMessageJa,
                labelEn: primarySignal.actionLabelEn || primarySignal.shortMessageEn,
                keySequence: primarySignal.actionKeySequence,
                isSafe: Boolean(primarySignal.isSafe)
            };
        }

        return null;
    }

    // --- 内部ヘルパー ---

    static _extractStatus(context) {
        if (context.statusAccessor) {
            return typeof context.statusAccessor.getStatus === 'function'
                ? context.statusAccessor.getStatus()
                : context.statusAccessor;
        }
        return context.status || {};
    }

    static _extractInventoryItems(context) {
        if (context.inventoryStateManager) {
            return Array.isArray(context.inventoryStateManager.items)
                ? context.inventoryStateManager.items
                : (Array.isArray(context.inventoryStateManager) ? context.inventoryStateManager : []);
        }
        return Array.isArray(context.inventory) ? context.inventory : (context.inventory && context.inventory.items ? context.inventory.items : []);
    }

    static _extractSpells(context) {
        if (context.spellStateManager) {
            return typeof context.spellStateManager.getSpells === 'function'
                ? context.spellStateManager.getSpells()
                : (Array.isArray(context.spellStateManager.spells) ? context.spellStateManager.spells : []);
        }
        return Array.isArray(context.spells) ? context.spells : (context.spells && context.spells.items ? context.spells.items : []);
    }

    static _extractAreaState(context) {
        if (context.areaStateManager) {
            return typeof context.areaStateManager.getAreaState === 'function'
                ? context.areaStateManager.getAreaState()
                : context.areaStateManager;
        }
        return context.area || context.areaState || {};
    }

    static _extractLandmarks(context, areaState) {
        if (context.areaStateManager && typeof context.areaStateManager.getFloorLandmarks === 'function') {
            return context.areaStateManager.getFloorLandmarks();
        }
        if (areaState && areaState.landmarks) {
            return areaState.landmarks;
        }
        return context.landmarks || null;
    }

    static _resolveMonsterKnowledge(mon) {
        if (!mon) return null;
        const m = mon.entity || mon;
        if (m.knowledge) return m.knowledge;
        const name = (m.name || m.rawName || '').toLowerCase();
        if (name && MONSTER_KNOWLEDGE_MAP.has(name)) {
            return MONSTER_KNOWLEDGE_MAP.get(name);
        }
        const offset = m.monOffset !== undefined ? m.monOffset : (m.subType !== undefined ? m.subType : m.glyphInfo?.monOffset);
        if (offset !== undefined && MONSTER_KNOWLEDGE_MAP.has(offset)) {
            return MONSTER_KNOWLEDGE_MAP.get(offset);
        }
        return null;
    }

    static _resolveObjectKnowledge(item) {
        if (!item) return null;
        if (item.knowledge) return item.knowledge;
        if (typeof item.onum === 'number' && item.onum >= 0 && OBJECT_KNOWLEDGE_MAP.has(item.onum)) {
            return OBJECT_KNOWLEDGE_MAP.get(item.onum);
        }
        const name = (item.name || item.rawText || '').toLowerCase();
        if (name) {
            for (const entry of OBJECT_KNOWLEDGE_MAP.values()) {
                if (entry && (entry.name?.toLowerCase() === name || entry.id?.toLowerCase() === name)) {
                    return entry;
                }
            }
            if (name.endsWith('corpse')) {
                const isLizard = name.includes('lizard');
                const genericCorpse = Array.from(OBJECT_KNOWLEDGE_MAP.values()).find(e => e.standardName === 'corpse' || e.name === 'corpse') || {};
                const lizardEntry = isLizard ? Array.from(OBJECT_KNOWLEDGE_MAP.values()).find(e => e.standardName === 'lizard corpse' || e.name === 'lizard corpse') : null;
                const baseEntry = lizardEntry || genericCorpse;
                return {
                    ...baseEntry,
                    category: 'FOOD',
                    isCorpse: true,
                    effects: {
                        ...(baseEntry.effects || {}),
                        ...(isLizard ? { curePetrification: true } : {})
                    }
                };
            }
        }
        return null;
    }
}
