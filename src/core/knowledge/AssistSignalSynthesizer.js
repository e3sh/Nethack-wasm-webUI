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

        // 道具・手段の抽出ヘルパー
        const isPotionItem = (i) => {
            if (!i) return false;
            const cat = i.category || i.itemCategory || i.onumCategory || (i.knowledge && i.knowledge.category);
            if (cat === 'POTION') return true;
            if (cat && cat !== 'OTHER' && cat !== 'POTION') return false;
            const name = (i.name || i.rawText || '').toLowerCase();
            const hasPotionWord = name.includes('potion') || name.includes('薬') || name.includes('ポーション');
            const hasOtherWord = name.includes('spellbook') || name.includes('scroll') || name.includes('wand') ||
                                 name.includes('魔法書') || name.includes('魔導書') || name.includes('巻物') || name.includes('杖') || name.includes('本');
            return hasPotionWord && !hasOtherWord;
        };

        const isScrollItem = (i) => {
            if (!i) return false;
            const cat = i.category || i.itemCategory || i.onumCategory || (i.knowledge && i.knowledge.category);
            if (cat === 'SCROLL') return true;
            if (cat && cat !== 'OTHER' && cat !== 'SCROLL') return false;
            const name = (i.name || i.rawText || '').toLowerCase();
            const hasScrollWord = name.includes('scroll') || name.includes('巻物');
            const hasOtherWord = name.includes('spellbook') || name.includes('potion') || name.includes('wand') ||
                                 name.includes('魔法書') || name.includes('魔導書') || name.includes('薬') || name.includes('杖');
            return hasScrollWord && !hasOtherWord;
        };

        const healingPotion = inventoryItems.find(i => {
            if (!isPotionItem(i)) return false;
            const name = (i.name || i.rawText || '').toLowerCase();
            return name.includes('healing') || name.includes('回復') || name.includes('強壮');
        });

        const extraHealingPotion = inventoryItems.find(i => {
            if (!isPotionItem(i)) return false;
            const name = (i.name || i.rawText || '').toLowerCase();
            return name.includes('extra healing') || name.includes('full healing') || name.includes('超回復') || name.includes('完全回復');
        });

        const unicornHorn = inventoryItems.find(i => {
            const name = (i.name || i.rawText || '').toLowerCase();
            return name.includes('unicorn horn') || name.includes('ユニコーンの角');
        });

        const fireSource = inventoryItems.find(i => {
            const name = (i.name || i.rawText || '').toLowerCase();
            return (name.includes('fire') && (name.includes('wand') || name.includes('scroll') || name.includes('potion'))) ||
                   name.includes('火の杖') || name.includes('火炎の巻物');
        });

        const lizardCorpse = inventoryItems.find(i => {
            const name = (i.name || i.rawText || '').toLowerCase();
            return (name.includes('lizard') && (name.includes('corpse') || name.includes('dead'))) ||
                   name.includes('トカゲの死体') || name.includes('トカゲの死骸');
        });

        const uncurseScroll = inventoryItems.find(i => {
            if (!isScrollItem(i)) return false;
            const name = (i.name || i.rawText || '').toLowerCase();
            return name.includes('remove curse') || name.includes('解呪');
        });

        // 4大安全ガードを満たす治癒魔法の検索
        const safeHealingSpell = spells.find(s => {
            const name = (s.name || '').toLowerCase();
            if (name.includes('healing') || name.includes('cure')) {
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
                candidateSignals.push({
                    id: 'SIGNAL_PETRIFY_CURE',
                    priority: 100,
                    category: 'SURVIVAL',
                    stance: 'CURE',
                    icon: '🦎',
                    shortMessageJa: '石化中: 直ちにトカゲの死体を摂取！',
                    shortMessageEn: 'Petrifying: Eat lizard corpse immediately!',
                    detailWhyJa: '石化が完了すると即死します。トカゲの死体を食べることで進行を解除できます。',
                    detailWhyEn: 'Petrification is fatal upon completion. Eating a lizard corpse cures it.',
                    wikiTopic: 'Petrification',
                    actionKeySequence: ['e', invlet],
                    actionLabelJa: `トカゲの死体を食べる (e -> ${invlet})`,
                    actionLabelEn: `Eat lizard corpse (e -> ${invlet})`
                });
            } else if (canPray) {
                slotBadges['Petrifying'] = {
                    type: 'danger',
                    icon: '🙏',
                    labelJa: '祈願',
                    labelEn: 'Pray',
                    highlightBorder: true
                };
                candidateSignals.push({
                    id: 'SIGNAL_PETRIFY_PRAY',
                    priority: 100,
                    category: 'SURVIVAL',
                    stance: 'PRAY',
                    icon: '🙏',
                    shortMessageJa: '石化中: 直ちに神に祈る！',
                    shortMessageEn: 'Petrifying: Pray to your deity immediately!',
                    detailWhyJa: '特効薬がないため、神に祈って石化を解除してもらいます。',
                    detailWhyEn: 'Without remedies, pray to deity to cure petrification.',
                    wikiTopic: 'Pray',
                    actionKeySequence: ['#pray\n', 'y'],
                    actionLabelJa: '神に祈る (#pray)',
                    actionLabelEn: 'Pray to god (#pray)'
                });
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
                candidateSignals.push({
                    id: 'SIGNAL_SLIMING_FIRE',
                    priority: 98,
                    category: 'SURVIVAL',
                    stance: 'CURE',
                    icon: '🔥',
                    shortMessageJa: 'スライム化: 自分に火を放ち治療！',
                    shortMessageEn: 'Sliming: Apply fire to self to cure!',
                    detailWhyJa: '緑色スライムに変身する前に、火の杖や巻物で自分を焼いて治療します。',
                    detailWhyEn: 'Burn yourself with fire to stop turning into a green slime.',
                    wikiTopic: 'Sliming',
                    actionKeySequence: ['z', invlet, '.'],
                    actionLabelJa: `火の杖を自分に振る (z -> ${invlet} -> .)`,
                    actionLabelEn: `Zap fire wand at self (z -> ${invlet} -> .)`
                });
            } else if (canPray) {
                slotBadges['Slimed'] = {
                    type: 'danger',
                    icon: '🙏',
                    labelJa: '祈願',
                    labelEn: 'Pray',
                    highlightBorder: true
                };
                candidateSignals.push({
                    id: 'SIGNAL_SLIMING_PRAY',
                    priority: 98,
                    category: 'SURVIVAL',
                    stance: 'PRAY',
                    icon: '🙏',
                    shortMessageJa: 'スライム化: 神に祈って救済を乞う',
                    shortMessageEn: 'Sliming: Pray to your deity for salvation',
                    detailWhyJa: '火炎手段がないため、祈願によってスライム化の解除を試みます。',
                    detailWhyEn: 'Without fire, pray to your god to dispel sliming.',
                    wikiTopic: 'Pray',
                    actionKeySequence: ['#pray\n', 'y'],
                    actionLabelJa: '神に祈る (#pray)',
                    actionLabelEn: 'Pray to god (#pray)'
                });
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
                candidateSignals.push({
                    id: 'SIGNAL_SICK_HORN',
                    priority: 88,
                    category: 'STATUS_REMEDY',
                    stance: 'CURE',
                    icon: '🤢',
                    shortMessageJa: '病気中: ユニコーンの角で治癒',
                    shortMessageEn: 'Sick: Apply unicorn horn to cure',
                    detailWhyJa: '病気・食中毒は放置すると死に至ります。角を使って治療してください。',
                    detailWhyEn: 'Sickness is fatal if untreated. Apply unicorn horn.',
                    wikiTopic: 'Sickness',
                    actionKeySequence: ['a', invlet],
                    actionLabelJa: `ユニコーンの角を使う (a -> ${invlet})`,
                    actionLabelEn: `Apply unicorn horn (a -> ${invlet})`
                });
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
                candidateSignals.push({
                    id: 'SIGNAL_SICK_POTION',
                    priority: 88,
                    category: 'STATUS_REMEDY',
                    stance: 'CURE',
                    icon: '🤢',
                    shortMessageJa: '病気中: 強力回復薬で治癒',
                    shortMessageEn: 'Sick: Quaff extra healing to cure',
                    detailWhyJa: '病気は放置すると死に至ります。強力な回復薬を服用して治療します。',
                    detailWhyEn: 'Sickness is fatal. Drink extra healing potion to cure.',
                    wikiTopic: 'Sickness',
                    actionKeySequence: ['q', invlet],
                    actionLabelJa: `回復薬を飲む (q -> ${invlet})`,
                    actionLabelEn: `Quaff potion (q -> ${invlet})`
                });
            } else if (canPray) {
                candidateSignals.push({
                    id: 'SIGNAL_SICK_PRAY',
                    priority: 88,
                    category: 'STATUS_REMEDY',
                    stance: 'PRAY',
                    icon: '🙏',
                    shortMessageJa: '病気中: 神に祈って治療を乞う',
                    shortMessageEn: 'Sick: Pray to deity for healing',
                    detailWhyJa: '治療手段がないため、祈願で病気の治癒を乞います。',
                    detailWhyEn: 'Without remedies, pray to god to cure illness.',
                    wikiTopic: 'Pray',
                    actionKeySequence: ['#pray\n', 'y'],
                    actionLabelJa: '神に祈る (#pray)',
                    actionLabelEn: 'Pray to god (#pray)'
                });
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
                candidateSignals.push({
                    id: 'SIGNAL_HP_CRITICAL_HEAL',
                    priority: 85,
                    category: 'SURVIVAL',
                    stance: 'CURE',
                    icon: '🚨',
                    shortMessageJa: '瀕死(HP低): 直ちに回復薬で治癒',
                    shortMessageEn: 'Critical HP: Quaff healing potion immediately',
                    detailWhyJa: 'HPが30%未満の致命的状況です。即座に回復を行ってください。',
                    detailWhyEn: 'HP is critically below 30%. Heal immediately.',
                    wikiTopic: 'Hit_points',
                    actionKeySequence: ['q', invlet],
                    actionLabelJa: `回復薬を飲む (q -> ${invlet})`,
                    actionLabelEn: `Quaff healing potion (q -> ${invlet})`
                });
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
                candidateSignals.push({
                    id: 'SIGNAL_HP_CRITICAL_SPELL',
                    priority: 85,
                    category: 'SURVIVAL',
                    stance: 'CURE',
                    icon: '🚨',
                    shortMessageJa: '瀕死(HP低): 治癒魔法で回復',
                    shortMessageEn: 'Critical HP: Cast healing spell',
                    detailWhyJa: '安全に詠唱可能な治癒魔法でHPを回復します。',
                    detailWhyEn: 'Cast safe healing spell to restore HP.',
                    wikiTopic: 'Spellbook_of_healing',
                    actionKeySequence: ['Z', key, '.'],
                    actionLabelJa: `治癒魔法を唱える (Z -> ${key} -> .)`,
                    actionLabelEn: `Cast healing spell (Z -> ${key} -> .)`
                });
            } else if (canPray) {
                slotBadges['hp'] = {
                    type: 'danger',
                    icon: '🙏',
                    labelJa: '祈願',
                    labelEn: 'Pray',
                    highlightBorder: true
                };
                candidateSignals.push({
                    id: 'SIGNAL_HP_CRITICAL_PRAY',
                    priority: 85,
                    category: 'SURVIVAL',
                    stance: 'PRAY',
                    icon: '🙏',
                    shortMessageJa: '瀕死(HP低): 神に祈って全快を乞う',
                    shortMessageEn: 'Critical HP: Pray to deity for full heal',
                    detailWhyJa: '回復アイテムがないため、祈願によって神の恩恵（全回復）を乞います。',
                    detailWhyEn: 'Without healing items, pray for divine full recovery.',
                    wikiTopic: 'Pray',
                    actionKeySequence: ['#pray\n', 'y'],
                    actionLabelJa: '神に祈る (#pray)',
                    actionLabelEn: 'Pray to god (#pray)'
                });
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
                candidateSignals.push({
                    id: 'SIGNAL_HP_LOW_HEAL',
                    priority: 65,
                    category: 'SURVIVAL',
                    stance: 'CURE',
                    icon: '💖',
                    shortMessageJa: 'HP低下: 回復薬(q)の服用または退避',
                    shortMessageEn: 'Low HP: Quaff healing potion (q) or retreat',
                    detailWhyJa: 'HPが半分を切っています。安全を確保して回復してください。',
                    detailWhyEn: 'HP is below 50%. Quaff potion or retreat to safety.',
                    wikiTopic: 'Hit_points',
                    actionKeySequence: ['q', invlet],
                    actionLabelJa: `回復薬を飲む (q -> ${invlet})`,
                    actionLabelEn: `Quaff potion (q -> ${invlet})`
                });
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
                candidateSignals.push({
                    id: 'SIGNAL_CONF_HORN',
                    priority: 75,
                    category: 'STATUS_REMEDY',
                    stance: 'CURE',
                    icon: '✨',
                    shortMessageJa: '混乱中: ユニコーンの角で治療',
                    shortMessageEn: 'Confused: Apply unicorn horn to cure',
                    detailWhyJa: 'ユニコーンの角を使って即時に混乱を解除します。',
                    detailWhyEn: 'Apply unicorn horn to immediately cure confusion.',
                    wikiTopic: 'Confusion',
                    actionKeySequence: ['a', invlet],
                    actionLabelJa: `角を使う (a -> ${invlet})`,
                    actionLabelEn: `Apply horn (a -> ${invlet})`
                });
            } else {
                slotBadges['Conf'] = {
                    type: 'warning',
                    icon: '🛡️',
                    labelJa: '待機',
                    labelEn: 'Wait'
                };
                candidateSignals.push({
                    id: 'SIGNAL_CONF_WAIT',
                    priority: 75,
                    category: 'STATUS_REMEDY',
                    stance: 'WAIT_SAFE',
                    icon: '🛡️',
                    shortMessageJa: '混乱中: 移動せず足踏み(.)推奨',
                    shortMessageEn: 'Confused: Wait in place (.) recommended',
                    detailWhyJa: '混乱中に移動するとランダムな方向へ進み、罠や溶岩に突っ込む危険があります。治まるまで足踏み待機してください。',
                    detailWhyEn: 'Moving while confused causes random steps into traps/lava. Wait in place until it passes.',
                    wikiTopic: 'Confusion',
                    actionKeySequence: ['.'],
                    actionLabelJa: '足踏み待機 (.)',
                    actionLabelEn: 'Wait in place (.)',
                    isSafe: true
                });
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
                candidateSignals.push({
                    id: 'SIGNAL_BLIND_HORN',
                    priority: 70,
                    category: 'STATUS_REMEDY',
                    stance: 'CURE',
                    icon: '✨',
                    shortMessageJa: '盲目中: 角で治療',
                    shortMessageEn: 'Blind: Apply horn to cure',
                    detailWhyJa: 'ユニコーンの角を使って盲目を治療します。',
                    detailWhyEn: 'Apply unicorn horn to restore eyesight.',
                    wikiTopic: 'Blindness',
                    actionKeySequence: ['a', invlet],
                    actionLabelJa: `角を使う (a -> ${invlet})`,
                    actionLabelEn: `Apply horn (a -> ${invlet})`
                });
            } else {
                slotBadges['Blind'] = {
                    type: 'warning',
                    icon: '🛡️',
                    labelJa: '待機',
                    labelEn: 'Wait'
                };
                candidateSignals.push({
                    id: 'SIGNAL_BLIND_WAIT',
                    priority: 70,
                    category: 'STATUS_REMEDY',
                    stance: 'WAIT_SAFE',
                    icon: '🛡️',
                    shortMessageJa: '盲目中: 壁際で安全確保・待機',
                    shortMessageEn: 'Blind: Stay near wall and search/wait',
                    detailWhyJa: '視界が失われています。不用意に歩き回らず、捜索待機(s)で自然回復を待ちます。',
                    detailWhyEn: 'Eyesight lost. Wait/search (s) safely rather than wandering blindly.',
                    wikiTopic: 'Blindness',
                    actionKeySequence: ['s'],
                    actionLabelJa: '捜索待機 (s)',
                    actionLabelEn: 'Search & Wait (s)',
                    isSafe: true
                });
            }
        }

        // --- G. スタン (Stunned / Stun) ---
        if (hasCondition('stun') || hasCondition('stunned')) {
            candidateSignals.push({
                id: 'SIGNAL_STUN_WAIT',
                priority: 60,
                category: 'STATUS_REMEDY',
                stance: 'WAIT_SAFE',
                icon: '⏳',
                shortMessageJa: 'スタン中: 攻撃を控えその場で待機',
                shortMessageEn: 'Stunned: Hold attacks and wait in place',
                detailWhyJa: 'スタン中は命中率が激減し行動が乱れます。足踏み待機で回復を待ちます。',
                detailWhyEn: 'Stun reduces hit accuracy drastically. Wait in place until recovered.',
                wikiTopic: 'Stunned',
                actionKeySequence: ['.'],
                actionLabelJa: '足踏み待機 (.)',
                actionLabelEn: 'Wait in place (.)',
                isSafe: true
            });
        }

        // --- H. 幻覚 (Hallu / Hallucination) ---
        if (hasCondition('hallu') || hasCondition('hallucinating')) {
            candidateSignals.push({
                id: 'SIGNAL_HALLU_CAUTION',
                priority: 55,
                category: 'STATUS_REMEDY',
                stance: 'CAUTION',
                icon: '🔍',
                shortMessageJa: '幻覚中: 見た目に惑わされず待機',
                shortMessageEn: 'Hallucinating: Do not trust appearances',
                detailWhyJa: 'モンスターやアイテムの表示が偽装されています。危険な敵の誤認に注意してください。',
                detailWhyEn: 'Monsters and items are disguised randomly. Be cautious of true identities.',
                wikiTopic: 'Hallucination',
                actionKeySequence: ['.'],
                actionLabelJa: '足踏み待機 (.)',
                actionLabelEn: 'Wait in place (.)',
                isSafe: true
            });
        }

        // --- I. 呪縛 (Cursed items) ---
        if (hasCondition('cursed') || (inventoryItems.some(i => i.isWorn && (i.bflag === 2 || (i.name || '').includes('cursed'))))) {
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
                candidateSignals.push({
                    id: 'SIGNAL_CURSED_SCROLL',
                    priority: 50,
                    category: 'STATUS_REMEDY',
                    stance: 'CURE',
                    icon: '📜',
                    shortMessageJa: '呪縛: 解呪の巻物(r)で装備解除可能',
                    shortMessageEn: 'Cursed: Read remove curse (r) to unequip',
                    detailWhyJa: '呪われた装備を外すには解呪の巻物(r)または解呪魔法が必要です。',
                    detailWhyEn: 'Read remove curse scroll (r) to unequip cursed items.',
                    wikiTopic: 'Curse',
                    actionKeySequence: ['r', invlet],
                    actionLabelJa: `解呪の巻物を読む (r -> ${invlet})`,
                    actionLabelEn: `Read remove curse scroll (r -> ${invlet})`
                });
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

        // 浮遊する目玉 (floating eye / monOffset 57)
        const hasFloatingEye = perceivedMonsters.some(m => {
            const name = (m.name || m.nameJa || '').toLowerCase();
            return name.includes('floating eye') || name.includes('浮遊する目玉') || m.monOffset === 57;
        }) || adjacentMonsters.some(m => {
            const name = (m.entity && (m.entity.name || m.entity.nameJa || '')) || '';
            return name.toLowerCase().includes('floating eye') || name.includes('浮遊する目玉') || (m.entity && m.entity.monOffset === 57);
        });

        if (hasFloatingEye) {
            // 目隠し/タオル所持判定
            const blindfold = inventoryItems.find(i => {
                const name = (i.name || i.rawText || '').toLowerCase();
                return (name.includes('blindfold') || name.includes('towel') || name.includes('目隠し') || name.includes('タオル')) && !i.isWorn;
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
                candidateSignals.push({
                    id: 'SIGNAL_FLOATING_EYE_BLINDFOLD',
                    priority: 76,
                    category: 'TACTICAL_COMBAT',
                    stance: 'EQUIP',
                    icon: '🙈',
                    shortMessageJa: '浮遊する目玉: 目隠し着用で安全接近',
                    shortMessageEn: 'Floating Eye: Wear blindfold to approach safely',
                    detailWhyJa: '目隠しやタオルを着用して盲目状態になると、目玉の麻痺凝視を受けずに近接攻撃できます。',
                    detailWhyEn: 'Wearing a blindfold prevents paralysis gaze, allowing safe melee attacks.',
                    wikiTopic: 'Floating_eye',
                    actionKeySequence: ['P', invlet],
                    actionLabelJa: `目隠しを着用する (P -> ${invlet})`,
                    actionLabelEn: `Wear blindfold (P -> ${invlet})`
                });
            } else {
                candidateSignals.push({
                    id: 'SIGNAL_FLOATING_EYE_RANGED',
                    priority: 78,
                    category: 'TACTICAL_COMBAT',
                    stance: 'RANGED',
                    icon: '⚠️',
                    shortMessageJa: '浮遊する目玉: 近接禁止！遠隔攻撃推奨',
                    shortMessageEn: 'Floating Eye: Do NOT melee! Use ranged attacks',
                    detailWhyJa: '素手や通常武器で直接攻撃すると、麻痺して一方的にタコ殴りにされ死に至ります。投擲や魔法で倒してください。',
                    detailWhyEn: 'Melee attack causes long paralysis and death. Use ranged projectiles or spells.',
                    wikiTopic: 'Floating_eye',
                    actionKeySequence: ['f'],
                    actionLabelJa: '矢筒から発射 (f)',
                    actionLabelEn: 'Fire from quiver (f)'
                });
            }
        }

        // 銀弱点モンスター (悪魔・人狼等) ＆ 手持ち銀製武器
        const hasSilverVulnerableMon = perceivedMonsters.some(m => {
            const name = (m.name || '').toLowerCase();
            return name.includes('were') || name.includes('vampire') || name.includes('demon') || name.includes('devil') || name.includes('shade');
        });

        if (hasSilverVulnerableMon) {
            const silverWeapon = inventoryItems.find(i => {
                const name = (i.name || i.rawText || '').toLowerCase();
                return (name.includes('silver') || name.includes('銀')) && !i.isWorn && (i.isWeapon || i.category === 'WEAPON');
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
                candidateSignals.push({
                    id: 'SIGNAL_SILVER_WEAPON_EQUIP',
                    priority: 68,
                    category: 'TACTICAL_COMBAT',
                    stance: 'EQUIP',
                    icon: '⚔️',
                    shortMessageJa: '銀弱点敵: 銀の武器への持替推奨',
                    shortMessageEn: 'Silver Vulnerable: Wield silver weapon',
                    detailWhyJa: '悪魔や人狼系モンスターには銀製武器による特効追加ダメージ(1d20)が有効です。',
                    detailWhyEn: 'Silver weapons deal massive bonus damage (1d20) against demons and lycanthropes.',
                    wikiTopic: 'Silver',
                    actionKeySequence: ['w', invlet],
                    actionLabelJa: `銀の武器を装備 (w -> ${invlet})`,
                    actionLabelEn: `Wield silver weapon (w -> ${invlet})`
                });
            }
        }

        // 反射持ちモンスター (銀竜等)
        const hasReflectingMon = perceivedMonsters.some(m => {
            const name = (m.name || '').toLowerCase();
            return name.includes('silver dragon') || name.includes('銀竜');
        });

        if (hasReflectingMon) {
            candidateSignals.push({
                id: 'SIGNAL_MONSTER_REFLECTING',
                priority: 72,
                category: 'TACTICAL_COMBAT',
                stance: 'CAUTION',
                icon: '🛡️',
                shortMessageJa: '反射敵: ビーム跳ね返り自爆に注意',
                shortMessageEn: 'Reflecting Monster: Beware beam rebound!',
                detailWhyJa: '銀竜などの反射持ち敵に直線光線（火・冷気・死の杖等）を撃つと、跳ね返って自分が直撃を受けます。',
                detailWhyEn: 'Beams bounce off silver dragons and can kill you. Use physical attacks instead.',
                wikiTopic: 'Reflection',
                actionKeySequence: ['f'],
                actionLabelJa: '物理投擲攻撃 (f)',
                actionLabelEn: 'Ranged physical attack (f)'
            });
        }
    }

    /**
     * 3. 魔法詠唱・防具干渉・リソース Stance 評価
     */
    static evaluateMagicAndResourceStance(status, inventoryItems, spells, candidateSignals, slotBadges) {
        if (!spells || spells.length === 0) return;

        // 金属鎧の着用判定
        const hasMetallicArmor = inventoryItems.some(i => {
            if (!i.isWorn) return false;
            const name = (i.name || i.rawText || '').toLowerCase();
            return name.includes('iron') || name.includes('metal') || name.includes('plate mail') ||
                   name.includes('chain mail') || name.includes('banded mail') || name.includes('splint mail') ||
                   name.includes('helmet') || name.includes('gauntlets of power') || name.includes('iron shoes');
        });

        // 攻撃の杖所持判定
        const attackWand = inventoryItems.find(i => {
            const name = (i.name || i.rawText || '').toLowerCase();
            return (name.includes('wand of') || name.includes('杖')) &&
                   (name.includes('striking') || name.includes('magic missile') || name.includes('fire') || name.includes('cold') || name.includes('lightning') || name.includes('打撃') || name.includes('電撃'));
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
            candidateSignals.push({
                id: 'SIGNAL_ARMOR_MAGIC_PENALTY',
                priority: 45,
                category: 'EQUIPMENT_MAGIC',
                stance: 'CAUTION',
                icon: '🪄',
                shortMessageJa: '防具干渉: 魔法失敗率高（杖を推奨）',
                shortMessageEn: 'Armor Penalty: High spell failure (use wands)',
                detailWhyJa: '金属製の鎧や兜を装備していると魔法失敗率が跳ね上がります。金属防具を脱ぐか、同じ効果の杖を使用してください。',
                detailWhyEn: 'Metallic armor causes massive spellcasting penalty. Remove metal gear or use wands.',
                wikiTopic: 'Spell_casting_penalty',
                actionKeySequence: attackWand ? ['z', attackWand.invlet || 'a'] : ['z'],
                actionLabelJa: attackWand ? `攻撃の杖を振る (z -> ${attackWand.invlet || 'a'})` : '杖を振る (z)',
                actionLabelEn: attackWand ? `Zap wand (z -> ${attackWand.invlet || 'a'})` : 'Zap wand (z)'
            });
        }
    }

    /**
     * 4. フロア案内＆ランドマーク連動 Stance 評価
     */
    static evaluateLandmarkStance(landmarks, inventoryItems, status, areaState, candidateSignals, slotBadges) {
        if (!landmarks) return;

        // 1. 未識別指輪 ＋ 流し台 (Sink ID)
        const isRingItem = (i) => {
            if (!i) return false;
            const cat = i.category || i.itemCategory || i.onumCategory || (i.knowledge && i.knowledge.category);
            if (cat === 'RING' || i.oclass === 8) return true;
            if (cat && cat !== 'OTHER' && cat !== 'RING') return false;
            const name = (i.name || i.rawText || '').toLowerCase();
            if (name.includes('ring mail') || name.includes('ringmail') || name.includes('鎧') || name.includes('防具')) return false;
            return name.includes('指輪') || /\bring\b/i.test(name);
        };

        const hasUnidentifiedRing = inventoryItems.some(i => {
            const isUnidentified = (!i.identified && !i.isFullyIdentified && !(i.identification && (i.identification.level === 'TYPE_IDENTIFIED' || i.identification.level === 'FULLY_IDENTIFIED')));
            return isRingItem(i) && isUnidentified;
        });

        const hasSinkOnFloor = (landmarks.sinks && landmarks.sinks.length > 0) ||
            (landmarks.all && landmarks.all.some(l => l.type === 'SINK'));

        if (hasUnidentifiedRing && hasSinkOnFloor) {
            candidateSignals.push({
                id: 'SIGNAL_LANDMARK_SINK_RING',
                priority: 35,
                category: 'UTILITY',
                stance: 'CAUTION',
                icon: '🚰',
                shortMessageJa: '未識別指輪あり: この階の流し台に落とすと識別可能 (#drop ➔ d)',
                shortMessageEn: 'Unidentified ring: Drop down sink to identify (#drop -> d)',
                detailWhyJa: '流し台(Sink)の上で指輪を落とすと、特有のエフェクトメッセージが発生して指輪の種類を識別できます。',
                detailWhyEn: 'Dropping a ring down a sink generates unique feedback that identifies the ring.',
                wikiTopic: 'Sink',
                actionKeySequence: ['d'],
                actionLabelJa: 'アイテムを落とす (d)',
                actionLabelEn: 'Drop item (d)'
            });
        }

        // 2. 重い死体 ＋ 自属性祭壇 (Corpse Sacrifice)
        const playerAlign = (status && status.align ? String(status.align).toLowerCase() : 'neutral');
        const hasCorpse = inventoryItems.some(i => {
            const name = (i.name || i.rawText || '').toLowerCase();
            return name.includes('corpse') || name.includes('死体') || name.includes('死骸');
        });

        const matchingAltar = (landmarks.altars || []).find(a => {
            const align = (a.details && a.details.alignment) || 'neutral';
            return align === playerAlign || align === 'unaligned';
        });

        if (hasCorpse && matchingAltar) {
            candidateSignals.push({
                id: 'SIGNAL_LANDMARK_ALTAR_SACRIFICE',
                priority: 32,
                category: 'UTILITY',
                stance: 'CAUTION',
                icon: '⛪',
                shortMessageJa: '捧げ物可能: この階の祭壇に死体を捧げて神の恩恵を獲得 (#offer)',
                shortMessageEn: 'Sacrifice available: Offer corpse at altar (#offer)',
                detailWhyJa: '属性の一致する祭壇で新鮮な死体を捧げると、神の好感度上昇やアーティファクト下賜の恩恵が得られます。',
                detailWhyEn: 'Sacrificing fresh corpses at an aligned altar grants divine favor and gifts.',
                wikiTopic: 'Altar',
                actionKeySequence: ['#offer\n'],
                actionLabelJa: '捧げ物をする (#offer)',
                actionLabelEn: 'Offer sacrifice (#offer)'
            });
        }

        // 3. 瀕死・危険 ＋ 階段退避 (Stair Escape)
        const hp = status && status.hp ? status.hp : { percent: 1.0, current: 10, max: 10 };
        const hasStairUp = (landmarks.stairsUp && landmarks.stairsUp.length > 0) ||
            (landmarks.all && landmarks.all.some(l => l.type === 'STAIR_UP'));

        if (hp && hp.max > 0 && hp.current > 0 && hp.percent < 0.3 && hasStairUp) {
            candidateSignals.push({
                id: 'SIGNAL_LANDMARK_STAIR_ESCAPE',
                priority: 82,
                category: 'SURVIVAL',
                stance: 'WAIT_SAFE',
                icon: '🪜',
                shortMessageJa: '退避推奨: 上り階段へ移動して体制を立て直す',
                shortMessageEn: 'Retreat recommended: Move to stairs up to recover',
                detailWhyJa: '瀕死かつ回復手段がない場合、上の階層へ退避して安全な場所で足踏み回復を図るのが有効です。',
                detailWhyEn: 'Retreating upstairs allows safe resting in previously cleared rooms.',
                wikiTopic: 'Stairs',
                actionKeySequence: ['<'],
                actionLabelJa: '階段を上る (<)',
                actionLabelEn: 'Go up stairs (<)'
            });
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
}
