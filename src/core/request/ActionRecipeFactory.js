/**
 * ActionRecipeFactory.js
 * 
 * 高優先度動的アクション（杖振る、投擲、射撃、食事、祈り、刻み、ドロップ、ツール使用）を
 * InteractiveRequestController のモードB（スクリプト・レシピ型）で安全に実行するための
 * 対話レシピファクトリ。
 * 
 * 【解決する問題】
 * - 固定キー列におけるプロンプト有無のズレによるキー消費ズレ
 * - NUMkey モード時の空振りによる数字キー（カウントプレフィックス）誤爆
 * - [yn] 確認プロンプトの有無による 'y'（移動）暴発
 */

export class ActionRecipeFactory {
    /**
     * 杖を振る (Zap Wand) レシピ
     * - 投射・ビーム系杖で SIGNAL_DIRECTION が出た場合のみ方向を送信
     * - 充填切れや無方向杖で方向が出ない場合は通常ターン復帰を待機
     * - 未知の種別名付けプロンプト等は安全に ESC
     * 
     * @param {string} wandLetter - 杖のインベントリ文字
     * @param {string} [direction=null] - 抽象方向トークン (例: 'DIR_E', 'DIR_NW') またはキー文字
     * @param {Object} [options={}]
     * @returns {Object} レシピオブジェクト
     */
    static createZapWandRecipe(wandLetter, direction = null, options = {}) {
        return {
            id: 'RECIPE_ZAP_WAND',
            start: ['z', wandLetter],
            handlers: [
                {
                    match: { signalId: 'SIGNAL_DIRECTION' },
                    action: (ctx) => {
                        if (direction) return direction;
                        return '\x1b'; // 方向未指定時は安全にキャンセル
                    }
                },
                {
                    match: { signalId: 'SIGNAL_TEXT_INPUT' },
                    action: '\x1b'
                }
            ],
            until: { type: 'turn_ready' },
            timeoutMs: options.timeoutMs || 3000,
            defaultAction: '\x1b'
        };
    }

    /**
     * アイテム投擲 (Throw Item) レシピ
     * - 複数スタック時の数量プロンプト (SIGNAL_COUNT_PROMPT) に対応
     * - 方向プロンプト (SIGNAL_DIRECTION) が出た場合のみ方向を送信
     * - 呪われていて手から離れない場合、方向が暴発せず通常ターンへ安全復帰
     * 
     * @param {string} itemLetter - 投擲アイテムのインベントリ文字
     * @param {string} direction - 投擲方向 (例: 'DIR_E', 'DIR_N')
     * @param {number|'all'} [count=1] - 投擲数量
     * @param {Object} [options={}]
     * @returns {Object} レシピオブジェクト
     */
    static createThrowItemRecipe(itemLetter, direction, count = 1, options = {}) {
        return {
            id: 'RECIPE_THROW_ITEM',
            start: ['t', itemLetter],
            handlers: [
                {
                    match: { signalId: 'SIGNAL_COUNT_PROMPT' },
                    action: count === 'all' ? 'a\r' : `${count}\r`
                },
                {
                    match: { signalId: 'SIGNAL_DIRECTION' },
                    action: direction
                }
            ],
            until: { type: 'turn_ready' },
            timeoutMs: options.timeoutMs || 3000,
            defaultAction: '\x1b'
        };
    }

    /**
     * 矢筒からの遠隔射撃 (Fire Ammo from Quiver) レシピ
     * - 矢筒が空の場合、C コアは方向プロンプトを出さずに通常ターンに戻るため、
     *   SIGNAL_DIRECTION が届いた時のみ方向を投入（NUMkeyでの数字誤爆を完全根絶）
     * 
     * @param {string} direction - 射撃方向 (例: 'DIR_E', 'DIR_S')
     * @param {Object} [options={}]
     * @returns {Object} レシピオブジェクト
     */
    static createFireAmmoRecipe(direction, options = {}) {
        return {
            id: 'RECIPE_FIRE_AMMO',
            start: ['f'],
            handlers: [
                {
                    match: { signalId: 'SIGNAL_DIRECTION' },
                    action: direction
                }
            ],
            until: { type: 'turn_ready' },
            timeoutMs: options.timeoutMs || 3000,
            defaultAction: '\x1b'
        };
    }

    /**
     * 食料を食べる (Eat Food / Corpse / Tin) レシピ
     * - 死体・古い食料の確認プロンプト (SIGNAL_CONFIRM_YN) を吸収
     * - 缶詰開封確認 ➔ ツール選択 ➔ 開封後摂食確認 のマルチステップ対話に対応
     * - 満腹時の安全中断
     * 
     * @param {string} foodLetter - 食料のインベントリ文字
     * @param {Object} [options={}]
     * @param {boolean} [options.forceEat=false] - 腐敗・警告時に強制的に食べるか
     * @param {string} [options.tinOpenerLetter=null] - 缶切りツールの文字
     * @returns {Object} レシピオブジェクト
     */
    static createEatFoodRecipe(foodLetter, options = {}) {
        return {
            id: 'RECIPE_EAT_FOOD',
            start: ['e', foodLetter],
            handlers: [
                {
                    match: { signalId: 'SIGNAL_CONFIRM_YN' },
                    action: (ctx) => {
                        // 満腹で中断するかどうか
                        if (/stop eating/i.test(ctx.payload?.rawPrompt || '')) {
                            return 'y';
                        }
                        // 缶詰を開けるか
                        if (/open a tin/i.test(ctx.payload?.rawPrompt || '')) {
                            return 'y';
                        }
                        // 開封後に食べるか
                        if (/eat it\?/i.test(ctx.payload?.rawPrompt || '')) {
                            return 'y';
                        }
                        // 死体・腐敗警告時
                        return options.forceEat ? 'y' : 'n';
                    }
                },
                {
                    match: { signalId: 'SIGNAL_TOOL_SELECT' },
                    action: options.tinOpenerLetter || '\x1b'
                }
            ],
            until: { type: 'turn_ready' },
            timeoutMs: options.timeoutMs || 4000,
            defaultAction: '\x1b'
        };
    }

    /**
     * 神に祈る (Pray) レシピ
     * - 祈願確認プロンプト (SIGNAL_CONFIRM_YN) が出た場合のみ 'y' または 'n' を投入
     * - 出ない場合に通常ターンへ 'y' が漏れる事故を防止
     * 
     * @param {Object} [options={}]
     * @param {boolean} [options.confirm=true] - 祈願確認に同意するか
     * @returns {Object} レシピオブジェクト
     */
    static createPrayRecipe(options = {}) {
        const confirm = options.confirm !== false;
        return {
            id: 'RECIPE_PRAY',
            start: ['#', 'pray'],
            handlers: [
                {
                    match: { signalId: 'SIGNAL_CONFIRM_YN' },
                    action: confirm ? 'y' : 'n'
                }
            ],
            until: { type: 'turn_ready' },
            timeoutMs: options.timeoutMs || 4000,
            defaultAction: 'n'
        };
    }

    /**
     * 床への緊急エルベレス刻み (Engrave Elbereth) レシピ
     * - 既存文字の上書き確認 (SIGNAL_CONFIRM_YN) ➔ 筆記具選択 (SIGNAL_TOOL_SELECT) ➔ 文字列入力 (SIGNAL_TEXT_INPUT) を安全完走
     * 
     * @param {string} [writeTool='-'] - 筆記具 ('-' は素手/指)
     * @param {Object} [options={}]
     * @returns {Object} レシピオブジェクト
     */
    static createEngraveElberethRecipe(writeTool = '-', options = {}) {
        return {
            id: 'RECIPE_ENGRAVE_ELBERETH',
            start: ['E'],
            handlers: [
                {
                    match: { signalId: 'SIGNAL_CONFIRM_YN' },
                    action: 'y' // 上書き同意
                },
                {
                    match: { signalId: 'SIGNAL_TOOL_SELECT' },
                    action: writeTool
                },
                {
                    match: { signalId: 'SIGNAL_TEXT_INPUT' },
                    action: 'Elbereth\r'
                }
            ],
            until: { type: 'turn_ready' },
            timeoutMs: options.timeoutMs || 4000,
            defaultAction: '\x1b'
        };
    }

    /**
     * アイテムを落とす (Drop Item) レシピ
     * - 複数スタック時の数量要求 (SIGNAL_COUNT_PROMPT) のみ数量応答
     * - 1個のみで即時ドロップされた場合も安全に完了
     * 
     * @param {string} itemLetter - アイテム文字
     * @param {number|'all'} [count='all'] - 落とす数量
     * @param {Object} [options={}]
     * @returns {Object} レシピオブジェクト
     */
    static createDropItemRecipe(itemLetter, count = 'all', options = {}) {
        return {
            id: 'RECIPE_DROP_ITEM',
            start: ['d', itemLetter],
            handlers: [
                {
                    match: { signalId: 'SIGNAL_COUNT_PROMPT' },
                    action: count === 'all' ? 'a\r' : `${count}\r`
                }
            ],
            until: { type: 'turn_ready' },
            timeoutMs: options.timeoutMs || 3000,
            defaultAction: '\x1b'
        };
    }

    /**
     * ツール使用 (Apply Tool) レシピ
     * - 鍵、ロックピック、ユニコーンの角、つるはし等に対応
     * - 方向プロンプト、アイテム選択プロンプト、確認プロンプトを柔軟にハンドリング
     * 
     * @param {string} toolLetter - ツール文字
     * @param {string} [direction=null] - 方向
     * @param {Object} [options={}]
     * @returns {Object} レシピオブジェクト
     */
    static createApplyToolRecipe(toolLetter, direction = null, options = {}) {
        return {
            id: 'RECIPE_APPLY_TOOL',
            start: ['a', toolLetter],
            handlers: [
                {
                    match: { signalId: 'SIGNAL_DIRECTION' },
                    action: (ctx) => direction || '\x1b'
                },
                {
                    match: { signalId: 'SIGNAL_ITEM_SELECT' },
                    action: (ctx) => options.targetItemLetter || '\x1b'
                },
                {
                    match: { signalId: 'SIGNAL_CONFIRM_YN' },
                    action: (ctx) => options.confirm ? 'y' : 'n'
                }
            ],
            until: { type: 'turn_ready' },
            timeoutMs: options.timeoutMs || 3000,
            defaultAction: '\x1b'
        };
    }
}

export default ActionRecipeFactory;
