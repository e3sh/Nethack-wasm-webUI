/**
 * ActionSignalResolver.js
 * Game Knowledge Layer (GKL) - 実施シグナル (Action / Intent Signal) 導出エンジン
 *
 * 【アーキテクチャ上の責務】
 * 1. 実施シグナル (ActionSignal) の導出:
 *    - InteractionContext (フォーカス対象・戦闘警戒度・直前アクション) および
 *      能力評価 (所持品・道具・魔法) を統合し、受動的推奨アクション (recommendedActions) と
 *      能動的ワンタップ実行レシピ (actionRecipe) を生成。
 * 2. モーダル内外の境界調停:
 *    - プロンプト停止時のダイアログ・HUD 用推奨と、IRC (InteractiveRequestController) 用
 *      シーケンスレシピの両面インターフェースを提供。
 * 3. フォーカスなし時の所持品逆引き推測 (仕様 3.4):
 *    - 対象なしでいきなり 'a'(apply), 'z'(zap) 等を押した際、戦闘・非戦闘状態に応じた
 *      最適アイテムスロットをサジェスト。
 * 4. 多言語対応 (ja / en):
 *    - シグナル ID やメソッド定数は純粋 ASCII、表示用ラベルと警告メッセージをローカライズ。
 *
 * ※ブラウザネイティブ ESM 互換のため、import には必ず .js 拡張子を使用すること。
 */

export class ActionSignalResolver {
    /**
     * @param {Object} [gkl=null] - GKLPlugin インスタンス
     * @param {Object} [options={}] - オプション設定
     */
    constructor(gkl = null, options = {}) {
        this.gkl = gkl;
        this.language = options.language || 'ja';
    }

    /**
     * 表示言語の設定 ('ja' | 'en')
     * @param {'ja'|'en'} lang
     */
    setLanguage(lang = 'ja') {
        const isJa = (lang === 'ja' || lang === 'jp' || lang === true);
        this.language = isJa ? 'ja' : 'en';
    }

    /**
     * 状況・対話コンテキストから実施シグナル (ActionSignal) を導出
     * @param {Object} interactionContext - InteractionContext インスタンスまたはその getState() 結果
     * @param {Object} [options={}]
     * @returns {Object|null} ActionSignal
     */
    resolve(interactionContext, options = {}) {
        if (!interactionContext) return null;

        const ctx = typeof interactionContext.getState === 'function' ?
            interactionContext.getState() : interactionContext;

        const lang = options.language || this.language || 'ja';
        const isJa = (lang === 'ja' || lang === 'jp');

        const primaryFocus = ctx.focus || null;

        // 1. フォーカス対象が存在する場合のシグナル導出
        if (primaryFocus) {
            // A. コンテナ（箱）との対峙
            if (primaryFocus.type === 'CONTAINER') {
                return this._resolveContainerAction(primaryFocus, ctx, isJa);
            }

            // B. 扉との対峙
            if (primaryFocus.type === 'DOOR') {
                return this._resolveDoorAction(primaryFocus, ctx, isJa);
            }
        }

        // 2. フォーカス対象がない状態での直接実行プロンプト逆引き推測 (仕様 3.4)
        if (ctx.immediate && ctx.immediate.active) {
            return this._resolveInventoryReverseInference(ctx, isJa);
        }

        return null;
    }

    /**
     * コンテナ（箱）に対するアクションシグナルの導出
     * @private
     */
    _resolveContainerAction(target, ctx, isJa) {
        const caps = ctx.capabilities || (this.gkl && typeof this.gkl.interactionContext?.assessCapabilities === 'function' ?
            this.gkl.interactionContext.assessCapabilities() : { hasKey: false, hasForceTool: false });

        const isLocked = Boolean(target.isLocked);
        const isAtFeet = !target.direction || target.direction === '.' || target.direction === 'DIR_SELF';
        const targetDirKey = isAtFeet ? '.' : (target.direction || '.');

        const recommendedActions = [];
        let actionRecipe = null;
        const warnings = [];

        if (isLocked) {
            if (caps.hasKey && caps.keyItem) {
                const keySlot = caps.keyItem.invlet || caps.keyItem.letter || caps.keyItem.char || 'b';
                recommendedActions.push({
                    label: isJa ? '鍵で解錠する' : 'Unlock with key',
                    actionKey: 'a',
                    toolSlot: keySlot,
                    method: 'USE_KEY',
                    confidence: 1.0
                });

                actionRecipe = {
                    recipeId: 'UNLOCK_CONTAINER_WITH_KEY',
                    initialSequence: ['a', keySlot, targetDirKey],
                    handlers: [
                        { match: { prompt: /direction/i }, respond: targetDirKey },
                        { match: { prompt: /What do you want to use/i }, respond: keySlot }
                    ]
                };
            } else if (caps.hasForceTool && caps.forceToolItem) {
                const toolSlot = caps.forceToolItem.invlet || caps.forceToolItem.letter || 'b';
                recommendedActions.push({
                    label: isJa ? '無理やりこじ開ける' : 'Force open',
                    actionKey: 'a',
                    toolSlot: toolSlot,
                    method: 'FORCE',
                    confidence: 0.6
                });
                recommendedActions.push({
                    label: isJa ? '立ち去る' : 'Leave it',
                    actionKey: '\x1b',
                    method: 'CANCEL',
                    confidence: 0.8
                });
                warnings.push(isJa ?
                    '鍵がかかっています。無理にこじ開けると中身が破損する恐れがあります。' :
                    'Container is locked. Forcing it may destroy items inside.'
                );
            } else {
                recommendedActions.push({
                    label: isJa ? '立ち去る' : 'Leave it',
                    actionKey: '\x1b',
                    method: 'CANCEL',
                    confidence: 0.9
                });
                warnings.push(isJa ?
                    '鍵がかかっています。解錠具がありません。無理に蹴ると壊れる恐れがあります。' :
                    'Container is locked and you have no tools. Kicking may destroy it.'
                );
            }
        } else {
            // 解錠済み・未施錠の箱
            recommendedActions.push({
                label: isJa ? '中身を確認する / 漁る' : 'Loot / Open',
                actionKey: isAtFeet ? ':' : '#loot',
                method: 'LOOT',
                confidence: 1.0
            });
        }

        return {
            signalId: 'ACT_CONTAINER_INTERACTION',
            target: {
                type: 'CONTAINER',
                name: target.name || 'box',
                isLocked: isLocked
            },
            recommendedActions,
            actionRecipe,
            warnings
        };
    }

    /**
     * 扉に対するアクションシグナルの導出
     * @private
     */
    _resolveDoorAction(target, ctx, isJa) {
        const caps = ctx.capabilities || (this.gkl && typeof this.gkl.interactionContext?.assessCapabilities === 'function' ?
            this.gkl.interactionContext.assessCapabilities() : { hasKey: false, hasForceTool: false });

        const isLocked = Boolean(target.isLocked);
        const targetDirKey = target.direction || '.';

        const recommendedActions = [];
        let actionRecipe = null;
        const warnings = [];

        if (isLocked) {
            if (caps.hasKey && caps.keyItem) {
                const keySlot = caps.keyItem.invlet || caps.keyItem.letter || 'b';
                recommendedActions.push({
                    label: isJa ? '合鍵で解錠する' : 'Unlock door with key',
                    actionKey: 'a',
                    toolSlot: keySlot,
                    method: 'USE_KEY',
                    confidence: 1.0
                });

                actionRecipe = {
                    recipeId: 'UNLOCK_DOOR_WITH_KEY',
                    initialSequence: ['a', keySlot, targetDirKey],
                    handlers: [
                        { match: { prompt: /direction/i }, respond: targetDirKey }
                    ]
                };
            } else {
                recommendedActions.push({
                    label: isJa ? '蹴破る' : 'Kick door down',
                    actionKey: '\x04', // Ctrl-D または kick
                    method: 'KICK',
                    confidence: 0.7
                });
                warnings.push(isJa ?
                    '扉に鍵がかかっています。蹴破ると警報が鳴ったり脚を痛める恐れがあります。' :
                    'Door is locked. Kicking it may trigger alarms or injure your leg.'
                );
            }
        } else {
            recommendedActions.push({
                label: isJa ? '扉を開ける' : 'Open door',
                actionKey: 'o',
                method: 'OPEN',
                confidence: 1.0
            });
        }

        return {
            signalId: 'ACT_DOOR_INTERACTION',
            target: {
                type: 'DOOR',
                name: target.name || 'door',
                isLocked: isLocked
            },
            recommendedActions,
            actionRecipe,
            warnings
        };
    }

    /**
     * フォーカスなしプロンプト時の所持品逆引き推測 (仕様 3.4)
     * @private
     */
    _resolveInventoryReverseInference(ctx, isJa) {
        const promptText = (ctx.immediate && ctx.immediate.prompt) || '';
        const inCombat = ctx.combat && ctx.combat.inCombat;

        const inv = this.gkl ? this.gkl.inventoryStateManager : null;
        const items = inv && Array.isArray(inv.items) ? inv.items : [];

        // 1. "What do you want to use? [*]" (apply コマンド 'a')
        if (/What do you want to use/i.test(promptText) || ctx.immediate.type === 'APPLY') {
            const recommendedActions = [];

            if (inCombat) {
                // 戦闘中: 攻撃・防衛・回復アイテム優先
                const emergencyItems = items.filter(it => {
                    const name = (it.name || it.rawText || '').toLowerCase();
                    return name.includes('wand') || name.includes('potion') || name.includes('horn');
                });
                for (const it of emergencyItems.slice(0, 3)) {
                    const slot = it.invlet || it.letter || '';
                    recommendedActions.push({
                        label: isJa ? `使用: ${it.name || it.rawText}` : `Use: ${it.name || it.rawText}`,
                        actionKey: slot,
                        toolSlot: slot,
                        method: 'USE_ITEM',
                        confidence: 0.85
                    });
                }
            } else {
                // 非戦闘中: 鍵、ツルハシ、探索用具優先
                const utilityItems = items.filter(it => {
                    const name = (it.name || it.rawText || '').toLowerCase();
                    return name.includes('key') || name.includes('pick') || name.includes('lamp') || name.includes('stethoscope');
                });
                for (const it of utilityItems.slice(0, 3)) {
                    const slot = it.invlet || it.letter || '';
                    recommendedActions.push({
                        label: isJa ? `使用: ${it.name || it.rawText}` : `Use: ${it.name || it.rawText}`,
                        actionKey: slot,
                        toolSlot: slot,
                        method: 'USE_ITEM',
                        confidence: 0.9
                    });
                }
            }

            if (recommendedActions.length > 0) {
                return {
                    signalId: 'ACT_INVENTORY_INFERENCE',
                    target: { type: 'PROMPT_APPLY', name: 'inventory' },
                    recommendedActions,
                    warnings: []
                };
            }
        }

        return null;
    }
}
