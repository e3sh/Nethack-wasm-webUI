/**
 * ContextActionEngine.js
 * AreaStateManager が出力する AreaState を基に、
 * 現在の自キャラ周辺の文脈・状況に応じた推奨アクション（Recommended Actions）を生成するエンジン
 */

import { isShopkeeperMonster } from './glyphClassifier.js';

export class ContextActionEngine {
    /**
     * エリア状態 (AreaState) およびインベントリ状態・スキル熟練度を解析し、推奨可能なアクション一覧を優先度順で返却
     * @param {Object} areaState - AreaStateManager.getAreaState() の返却値
     * @param {Object} [inventoryState] - InventoryStateManager インスタンス
     * @param {Object} [skillStateManager] - SkillStateManager インスタンス
     * @returns {Array<Object>} 推奨アクションの配列 (priority 降順)
     */
    static generateActions(areaState, inventoryState = null, skillStateManager = null) {
        if (!areaState || !areaState.feet) return [];

        const actions = [];
        const tools = this.extractTools(inventoryState);

        // 1. 足元 (Stepping on) のアクション判定
        this.buildFeetActions(areaState.feet, tools, actions);

        // 2. 隣接モンスター (Adjacent Monsters) のアクション判定
        this.buildMonsterActions(areaState.adjacentMonsters, tools, actions);

        // 3. 隣接設置物・地形 (Adjacent Entities / Terrain) のアクション判定
        this.buildAdjacentEntityActions(areaState.adjacentEntities, tools, actions);

        // 4. 8方向レイキャストによる遠隔攻撃 (Ranged Combat: f / t) のアクション判定
        this.buildRangedActions(areaState, inventoryState, tools, actions, skillStateManager);

        // 5. スキル熟練度に基づくおすすめ装備提案 (Recommended Wield / Equipment)
        this.buildEquipmentRecommendations(inventoryState, skillStateManager, actions);

        // 優先度 (priority) 降順でソート
        return actions.sort((a, b) => b.priority - a.priority);
    }

    /**
     * 方向オブジェクト (dir) から抽象方向トークン ('DIR_N', 'DIR_NE' 等) を取得
     * @param {Object|string} dir 
     * @returns {string} 抽象方向トークン
     */
    static getAbstractDirKey(dir) {
        if (!dir) return 'DIR_SELF';
        if (typeof dir === 'string') {
            if (dir.startsWith('DIR_')) return dir;
            const codeMap = {
                'N': 'DIR_N', 'E': 'DIR_E', 'S': 'DIR_S', 'W': 'DIR_W',
                'NE': 'DIR_NE', 'NW': 'DIR_NW', 'SE': 'DIR_SE', 'SW': 'DIR_SW',
                'SELF': 'DIR_SELF',
                '8': 'DIR_N', '6': 'DIR_E', '2': 'DIR_S', '4': 'DIR_W',
                '9': 'DIR_NE', '7': 'DIR_NW', '3': 'DIR_SE', '1': 'DIR_SW', '5': 'DIR_SELF',
                'k': 'DIR_N', 'l': 'DIR_E', 'j': 'DIR_S', 'h': 'DIR_W',
                'u': 'DIR_NE', 'y': 'DIR_NW', 'n': 'DIR_SE', 'b': 'DIR_SW', '.': 'DIR_SELF'
            };
            return codeMap[dir] || `DIR_${dir}`;
        }
        const code = dir.code || '';
        const key = dir.key || '';
        const codeMap = {
            'N': 'DIR_N', 'E': 'DIR_E', 'S': 'DIR_S', 'W': 'DIR_W',
            'NE': 'DIR_NE', 'NW': 'DIR_NW', 'SE': 'DIR_SE', 'SW': 'DIR_SW',
            'SELF': 'DIR_SELF',
            '8': 'DIR_N', '6': 'DIR_E', '2': 'DIR_S', '4': 'DIR_W',
            '9': 'DIR_NE', '7': 'DIR_NW', '3': 'DIR_SE', '1': 'DIR_SW', '5': 'DIR_SELF',
            'k': 'DIR_N', 'l': 'DIR_E', 'j': 'DIR_S', 'h': 'DIR_W',
            'u': 'DIR_NE', 'y': 'DIR_NW', 'n': 'DIR_SE', 'b': 'DIR_SW', '.': 'DIR_SELF'
        };
        return codeMap[code] || codeMap[key] || (code ? `DIR_${code}` : 'DIR_SELF');
    }

    /**
     * 方向オブジェクト (dir) から方向メタデータ { dirCode, dirNameJa, dirSymbol } を取得
     * @param {Object|string} dir 
     * @returns {Object} { dirCode, dirNameJa, dirSymbol }
     */
    static getDirectionMeta(dir) {
        let code = '';
        if (typeof dir === 'string') {
            code = dir.replace(/^DIR_/, '');
        } else if (dir && dir.code) {
            code = dir.code;
        }

        const metaMap = {
            'N': { dirCode: 'N', dirNameJa: '北', dirSymbol: '↑' },
            'E': { dirCode: 'E', dirNameJa: '東', dirSymbol: '→' },
            'S': { dirCode: 'S', dirNameJa: '南', dirSymbol: '↓' },
            'W': { dirCode: 'W', dirNameJa: '西', dirSymbol: '←' },
            'NE': { dirCode: 'NE', dirNameJa: '北東', dirSymbol: '↗' },
            'NW': { dirCode: 'NW', dirNameJa: '北西', dirSymbol: '↖' },
            'SE': { dirCode: 'SE', dirNameJa: '南東', dirSymbol: '↘' },
            'SW': { dirCode: 'SW', dirNameJa: '南西', dirSymbol: '↙' },
            'SELF': { dirCode: 'SELF', dirNameJa: '足元', dirSymbol: '・' }
        };

        return metaMap[code] || { dirCode: code, dirNameJa: code, dirSymbol: '' };
    }


    /**
     * インベントリからキーアイテム・道具を抽出
     * @param {Object} inventoryState 
     * @returns {Object} 抽出ツールオブジェクト
     */
    static extractTools(inventoryState) {
        if (!inventoryState) {
            return { keyItem: null, pickAxe: null, axeItem: null, frostWand: null };
        }
        return {
            keyItem: inventoryState.getKeyOrLockPick(),
            pickAxe: typeof inventoryState.getDigTool === 'function' ? inventoryState.getDigTool() : inventoryState.getPickAxe(),
            axeItem: inventoryState.getAxe(),
            frostWand: inventoryState.getFrostWand()
        };
    }

    /**
     * 1. 足元 (Feet) のアクション判定・ビルド
     */
    static buildFeetActions(feet, tools, actions) {
        if (!feet) return;
        const { keyItem } = tools;

        // (1-A) 足元のアイテム・コンテナ・死体・像
        if (feet.middle) {
            const entityType = feet.middle.type;
            const isItemOrBody = (entityType === 'ITEM' || entityType === 'BODY' || entityType === 'STATUE');
            if (isItemOrBody) {
                // (a) アイテム拾い (全アイテム対象)
                actions.push({
                    id: 'ACTION_PICKUP',
                    category: 'INTERACT',
                    label: 'Pick up item',
                    labelJa: '拾う (Pick up)',
                    key: ',',
                    charStr: ',',
                    target: 'feet',
                    entity: feet.middle,
                    risk: null,
                    priority: 95,
                    description: 'Pick up items on the floor',
                    descriptionJa: '足元に落ちているアイテムをインベントリに入れます'
                });

                // (b) コンテナ漁り / 解錠
                if (feet.middle.isContainer) {
                    if (keyItem) {
                        actions.push({
                            id: 'ACTION_UNLOCK_CONTAINER_FEET',
                            category: 'INTERACT',
                            label: `Unlock container with ${keyItem.rawText || 'key'}`,
                            labelJa: `箱を解錠 (${keyItem.letter})`,
                            key: `a${keyItem.letter}.`,
                            keySequence: ['a', keyItem.letter, 'DIR_SELF'],
                            charStr: 'a',
                            target: 'feet',
                            entity: feet.middle,
                            risk: null,
                            priority: 92,
                            description: `Apply ${keyItem.rawText || 'key'} to unlock container on the floor`,
                            descriptionJa: `手持ちの ${keyItem.rawText || '鍵/ロックピック'} で足元の箱の鍵を解錠します`
                        });
                    }

                    actions.push({
                        id: 'ACTION_LOOT',
                        category: 'INTERACT',
                        label: 'Loot container / bag',
                        labelJa: '漁る/開ける (Loot)',
                        key: 'l',
                        keySequence: ['l'],
                        charStr: 'l',
                        extCmd: 'loot',
                        target: 'feet',
                        entity: feet.middle,
                        risk: null,
                        priority: 90,
                        description: 'Loot container, bag, or chest on the floor',
                        descriptionJa: '足元の箱や袋を開けて中身を確認します'
                    });

                    actions.push({
                        id: 'ACTION_UNTRAP_FEET',
                        category: 'INTERACT',
                        label: 'Untrap feet / container',
                        labelJa: '箱の罠解除 (Untrap)',
                        key: '#untrap',
                        keySequence: ['#', 'untrap', 'DIR_SELF'],
                        charStr: '#untrap',
                        extCmd: 'untrap',
                        directionKey: 'DIR_SELF',
                        target: 'feet',
                        entity: feet.middle,
                        risk: null,
                        priority: 80,
                        description: 'Disarm traps on container or floor',
                        descriptionJa: '足元や箱にかかった罠の解除を試みます'
                    });
                }

                // (c) アイテム落とし
                actions.push({
                    id: 'ACTION_DROP',
                    category: 'INTERACT',
                    label: 'Drop item',
                    labelJa: '落とす (Drop)',
                    key: 'd',
                    charStr: 'd',
                    target: 'feet',
                    risk: null,
                    priority: 40,
                    description: 'Drop an item from inventory to the floor',
                    descriptionJa: '手持ちのアイテムを足元に落とします'
                });
            }
        }

        // (1-B) 足元の地形属性判定 (cmapFlags)
        if (feet.bottom && feet.bottom.cmapFlags) {
            const flags = feet.bottom.cmapFlags;

            // 階段
            if (flags.isStairDown) {
                actions.push({
                    id: 'ACTION_STAIR_DOWN',
                    category: 'MOVEMENT',
                    label: 'Go down stairs',
                    labelJa: '階段を降りる (Go down)',
                    key: '>',
                    charStr: '>',
                    target: 'feet',
                    risk: null,
                    priority: 100,
                    description: 'Descend to the lower dungeon level',
                    descriptionJa: '下の階層へ移動します'
                });
            }
            if (flags.isStairUp) {
                actions.push({
                    id: 'ACTION_STAIR_UP',
                    category: 'MOVEMENT',
                    label: 'Go up stairs',
                    labelJa: '階段を上る (Go up)',
                    key: '<',
                    charStr: '<',
                    target: 'feet',
                    risk: null,
                    priority: 100,
                    description: 'Ascend to the upper dungeon level',
                    descriptionJa: '上の階層へ移動します'
                });
            }

            // 祭壇
            if (flags.isAltar) {
                actions.push({
                    id: 'ACTION_OFFER',
                    category: 'INTERACT',
                    label: 'Offer corpse on altar',
                    labelJa: '死体を捧げる (Offer)',
                    key: '#offer',
                    charStr: '#offer',
                    extCmd: 'offer',
                    target: 'feet',
                    risk: null,
                    priority: 85,
                    description: 'Sacrifice a fresh corpse on the altar for divine favor',
                    descriptionJa: '足元の祭壇で神に生贄（死体）を捧げます'
                });
                actions.push({
                    id: 'ACTION_BUC_DROP',
                    category: 'INTERACT',
                    label: 'Drop item to test BUC',
                    labelJa: 'BUC判別・落とす (Drop)',
                    key: 'd',
                    charStr: 'd',
                    target: 'feet',
                    risk: null,
                    priority: 70,
                    description: 'Drop items on the altar to check Blessed/Uncursed/Cursed status',
                    descriptionJa: '祭壇の上にアイテムを落として呪い・祝福を判別します'
                });
                actions.push({
                    id: 'ACTION_PRAY',
                    category: 'INTERACT',
                    label: 'Pray to god',
                    labelJa: '神に祈る (Pray)',
                    key: '#pray',
                    charStr: '#pray',
                    extCmd: 'pray',
                    target: 'feet',
                    risk: 'danger',
                    priority: 60,
                    description: 'Pray to your god (DANGER: Frequent praying risks divine wrath)',
                    descriptionJa: '神に祈りを捧げます（※連続で祈ると神の激怒により死亡する高リスク行動です）'
                });
            }

            // 泉
            if (flags.isFountain) {
                actions.push({
                    id: 'ACTION_QUAFF_FOUNTAIN',
                    category: 'INTERACT',
                    label: 'Quaff from fountain',
                    labelJa: '泉の水を飲む (Quaff)',
                    key: 'q',
                    charStr: 'q',
                    target: 'feet',
                    risk: 'warning',
                    priority: 75,
                    description: 'Drink water from the fountain (Warning: May trigger events or curses)',
                    descriptionJa: '泉の水を飲みます（ステータス変化・召喚・渇き解消等のイベントが発生します）'
                });
                actions.push({
                    id: 'ACTION_DIP_FOUNTAIN',
                    category: 'INTERACT',
                    label: 'Dip item in fountain',
                    labelJa: '泉に浸す (Dip)',
                    key: '#dip',
                    charStr: '#dip',
                    extCmd: 'dip',
                    target: 'feet',
                    risk: null,
                    priority: 70,
                    description: 'Dip items in the fountain (e.g. create holy water or Excalibur)',
                    descriptionJa: '手持ちのアイテム（ポーションや長剣など）を泉に浸します'
                });
                actions.push({
                    id: 'ACTION_UNTRAP_FOUNTAIN',
                    category: 'INTERACT',
                    label: 'Untrap fountain',
                    labelJa: '泉の罠解除 (Untrap)',
                    key: '#untrap',
                    charStr: '#untrap',
                    extCmd: 'untrap',
                    target: 'feet',
                    risk: null,
                    priority: 65,
                    description: 'Attempt to disarm traps on the fountain',
                    descriptionJa: '泉の毒針罠などの解除を試みます'
                });
                actions.push({
                    id: 'ACTION_KICK_FOUNTAIN',
                    category: 'INTERACT',
                    label: 'Kick fountain',
                    labelJa: '泉を蹴る (Kick)',
                    key: 'C-d',
                    keySequence: ['#', 'kick', 'DIR_SELF'],
                    charStr: 'C-d',
                    target: 'feet',
                    risk: 'danger',
                    priority: 20,
                    description: 'Kick the fountain (DANGER: May flood area or spawn water elemental)',
                    descriptionJa: '泉を蹴ります（※水が吹き出して道具が濡れたりエレメンタルが湧く危険行動です）'
                });
            }

            // シンク
            if (flags.isSink) {
                actions.push({
                    id: 'ACTION_SIT_SINK',
                    category: 'INTERACT',
                    label: 'Sit on sink (Identify ring)',
                    labelJa: '座る・指輪識別 (Sit)',
                    key: '#sit',
                    charStr: '#sit',
                    extCmd: 'sit',
                    target: 'feet',
                    risk: null,
                    priority: 75,
                    description: 'Sit on the sink (Drop a ring down the drain to identify it)',
                    descriptionJa: 'シンクの上に座り、指輪を排水口に落として識別を試みます'
                });
                actions.push({
                    id: 'ACTION_QUAFF_SINK',
                    category: 'INTERACT',
                    label: 'Drink from sink',
                    labelJa: 'シンクから飲む (Quaff)',
                    key: 'q',
                    charStr: 'q',
                    target: 'feet',
                    risk: 'warning',
                    priority: 70,
                    description: 'Drink from the sink',
                    descriptionJa: 'シンクから水を飲みます'
                });
                actions.push({
                    id: 'ACTION_DIP_SINK',
                    category: 'INTERACT',
                    label: 'Dip in sink',
                    labelJa: 'シンクに浸す (Dip)',
                    key: '#dip',
                    charStr: '#dip',
                    extCmd: 'dip',
                    target: 'feet',
                    risk: null,
                    priority: 65,
                    description: 'Dip items in sink to wash labels off potions',
                    descriptionJa: 'シンクでポーションを洗い、ただの水に変化させます'
                });
                actions.push({
                    id: 'ACTION_KICK_SINK',
                    category: 'INTERACT',
                    label: 'Kick sink',
                    labelJa: 'シンクを蹴る (Kick)',
                    key: 'C-d',
                    keySequence: ['#', 'kick', 'DIR_SELF'],
                    charStr: 'C-d',
                    target: 'feet',
                    risk: 'warning',
                    priority: 30,
                    description: 'Kick the sink (May dislodge rings or black puddings)',
                    descriptionJa: 'シンクを蹴って指輪やプディングを引っ張り出します'
                });
            }

            // 罠
            if (flags.isTrap) {
                actions.push({
                    id: 'ACTION_UNTRAP_TRAP',
                    category: 'INTERACT',
                    label: 'Untrap floor trap',
                    labelJa: '足元の罠解除 (Untrap)',
                    key: '#untrap',
                    charStr: '#untrap',
                    extCmd: 'untrap',
                    target: 'feet',
                    risk: null,
                    priority: 85,
                    description: 'Disarm or fill the trap under your feet',
                    descriptionJa: '足元の罠の解除や穴の埋め立てを試みます'
                });
                actions.push({
                    id: 'ACTION_SIT_TRAP',
                    category: 'INTERACT',
                    label: 'Sit in trap / pit',
                    labelJa: '罠・穴に座る (Sit)',
                    key: '#sit',
                    charStr: '#sit',
                    extCmd: 'sit',
                    target: 'feet',
                    risk: null,
                    priority: 30,
                    description: 'Sit in pit or trap to hide or secure yourself',
                    descriptionJa: '自ら罠や穴の中に座り身を隠します'
                });
            }

            // 玉座
            if (flags.isThrone) {
                actions.push({
                    id: 'ACTION_SIT_THRONE',
                    category: 'INTERACT',
                    label: 'Sit on throne',
                    labelJa: '玉座に座る (Sit)',
                    key: '#sit',
                    charStr: '#sit',
                    extCmd: 'sit',
                    target: 'feet',
                    risk: 'warning',
                    priority: 80,
                    description: 'Sit on the throne for special effects or wishes',
                    descriptionJa: '玉座に座り、願望成就やステータス変化などの特殊効果を試みます'
                });
            }

            // 床 / 廊下全般
            if (flags.isFloor || flags.isCorridor || flags.isEngraving) {
                actions.push({
                    id: 'ACTION_ENGRAVE',
                    category: 'INTERACT',
                    label: 'Engrave floor',
                    labelJa: '床に文字を刻む (Engrave)',
                    key: 'E',
                    charStr: 'E',
                    target: 'feet',
                    risk: null,
                    priority: 50,
                    description: 'Engrave word on the floor (e.g. Elbereth for warding)',
                    descriptionJa: '床に Elbereth 等の魔除けの文字や指輪の識別文字を刻みます'
                });
                actions.push({
                    id: 'ACTION_SIT_FLOOR',
                    category: 'INTERACT',
                    label: 'Sit on floor',
                    labelJa: '床に座る (Sit)',
                    key: '#sit',
                    charStr: '#sit',
                    extCmd: 'sit',
                    target: 'feet',
                    risk: null,
                    priority: 30,
                    description: 'Sit down on the floor',
                    descriptionJa: '床に座ります'
                });
                actions.push({
                    id: 'ACTION_SEARCH_FEET',
                    category: 'INTERACT',
                    label: 'Search around',
                    labelJa: '周囲を探す (Search)',
                    key: 's',
                    charStr: 's',
                    target: 'feet',
                    risk: null,
                    priority: 45,
                    description: 'Search surrounding tiles for hidden doors and traps',
                    descriptionJa: '周囲の隠し扉や隠し罠を探します'
                });
            }
        }
    }

    /**
     * 2. 隣接モンスター (Monsters / PET / NPC) のアクション判定・ビルド
     */
    static buildMonsterActions(adjacentMonsters, tools, actions) {
        if (!adjacentMonsters || adjacentMonsters.length === 0) return;

        adjacentMonsters.forEach(m => {
            const isPet = (m.entity && m.entity.type === 'PET');
            const dirKey = this.getAbstractDirKey(m.dir);
            const dirMeta = this.getDirectionMeta(m.dir);
            const { dirNameJa, dirSymbol } = dirMeta;

            if (isPet) {
                // ペット誤爆防止 (攻撃は絶対に生成しない)
                if (!actions.some(a => a.id === `ACTION_CHAT_${m.dir.code}`)) {
                    actions.push({
                        id: `ACTION_CHAT_${m.dir.code}`,
                        category: 'INTERACT',
                        label: `Chat with pet [${m.dir.code}]`,
                        labelJa: `ペットに話しかける [${dirNameJa}] (#chat)`,
                        key: `#chat${dirKey}`,
                        keySequence: ['#', 'chat', dirKey],
                        charStr: '#chat',
                        extCmd: 'chat',
                        directionKey: dirKey,
                        direction: m.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        entity: m.entity,
                        target: 'adjacent',
                        risk: null,
                        priority: 95,
                        description: `Talk to pet in ${dirNameJa}`,
                        descriptionJa: `${dirNameJa}のペットに話しかけます`
                    });
                }
            } else {
                const isShopkeeper = isShopkeeperMonster(m.entity);
                // モンスター/NPC (近接攻撃)
                if (!actions.some(a => a.id === `ACTION_ATTACK_${m.dir.code}`)) {
                    actions.push({
                        id: `ACTION_ATTACK_${m.dir.code}`,
                        category: 'COMBAT',
                        label: `Attack target [${m.dir.code}]`,
                        labelJa: `対象に攻撃 [${dirNameJa}]`,
                        key: dirKey,
                        keySequence: [dirKey],
                        charStr: dirKey,
                        directionKey: dirKey,
                        direction: m.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        entity: m.entity,
                        target: 'adjacent',
                        risk: 'warning',
                        priority: 80,
                        description: `Attack creature in ${dirNameJa}`,
                        descriptionJa: `${dirNameJa}の対象に攻撃を試みます`
                    });
                }
                // 話しかける (#chat)
                if (!actions.some(a => a.id === `ACTION_CHAT_NPC_${m.dir.code}`)) {
                    actions.push({
                        id: `ACTION_CHAT_NPC_${m.dir.code}`,
                        category: 'INTERACT',
                        label: `Talk / Chat [${m.dir.code}]`,
                        labelJa: `対象に話しかける [${dirNameJa}] (#chat)`,
                        key: `#chat${dirKey}`,
                        keySequence: ['#', 'chat', dirKey],
                        charStr: '#chat',
                        extCmd: 'chat',
                        directionKey: dirKey,
                        direction: m.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        entity: m.entity,
                        target: 'adjacent',
                        risk: null,
                        priority: isShopkeeper ? 90 : 30,
                        description: `Talk to NPC or shopkeeper in ${dirNameJa}`,
                        descriptionJa: `${dirNameJa}のNPCや店主に話しかけます`
                    });
                }
                // 店主に代金を支払う (#pay)
                if (isShopkeeper && !actions.some(a => a.id === `ACTION_PAY_${m.dir.code}`)) {
                    actions.push({
                        id: `ACTION_PAY_${m.dir.code}`,
                        category: 'INTERACT',
                        label: `Pay shopkeeper [${m.dir.code}]`,
                        labelJa: `店主に代金を支払う [${dirNameJa}] (#pay)`,
                        key: `#pay${dirKey}`,
                        keySequence: ['#', 'pay', dirKey],
                        charStr: '#pay',
                        extCmd: 'pay',
                        directionKey: dirKey,
                        direction: m.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        entity: m.entity,
                        target: 'adjacent',
                        risk: null,
                        priority: 95,
                        description: `Pay shopkeeper in ${dirNameJa}`,
                        descriptionJa: `${dirNameJa}の店主に商品の購入代金を支払います`
                    });
                }
            }

        });
    }


    /**
     * 3. 隣接設置物・地形 (Terrain / Doors / Walls / Trees) のアクション判定・ビルド
     */
    static buildAdjacentEntityActions(adjacentEntities, tools, actions) {
        if (!adjacentEntities || adjacentEntities.length === 0) return;

        const { keyItem, pickAxe, axeItem, frostWand } = tools;
        const dirToAbstractMap = {
            'N': 'DIR_N', 'E': 'DIR_E', 'S': 'DIR_S', 'W': 'DIR_W',
            'NE': 'DIR_NE', 'NW': 'DIR_NW', 'SE': 'DIR_SE', 'SW': 'DIR_SW',
            '8': 'DIR_N', '6': 'DIR_E', '2': 'DIR_S', '4': 'DIR_W',
            '9': 'DIR_NE', '7': 'DIR_NW', '3': 'DIR_SE', '1': 'DIR_SW',
            'k': 'DIR_N', 'l': 'DIR_E', 'j': 'DIR_S', 'h': 'DIR_W',
            'u': 'DIR_NE', 'y': 'DIR_NW', 'n': 'DIR_SE', 'b': 'DIR_SW'
        };

        adjacentEntities.forEach(item => {
            const b = item.cell.bottom;
            if (!b || !b.cmapFlags) return;
            const flags = b.cmapFlags;
            const dirCode = item.dir.code;
            const dirKey = this.getAbstractDirKey(item.dir);
            const dirMeta = this.getDirectionMeta(item.dir);
            const { dirNameJa, dirSymbol } = dirMeta;
            const dirName = item.dir.name || dirCode;


            // 閉じた扉 / 施錠された扉 (Closed Door / Locked Door)
            if (flags.isClosedDoor || flags.isLockedDoor) {
                if (!actions.some(a => a.id === `ACTION_OPEN_DOOR_${dirCode}`)) {
                    actions.push({
                        id: `ACTION_OPEN_DOOR_${dirCode}`,
                        category: 'INTERACT',
                        label: `Open door [${dirCode}]`,
                        labelJa: `扉を開ける [${dirNameJa}]`,
                        key: `o${dirKey}`,
                        keySequence: ['o', dirKey],
                        charStr: 'o',
                        directionKey: dirKey,
                        direction: item.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        target: 'adjacent',
                        risk: null,
                        priority: 90,
                        description: `Open closed door in ${dirNameJa}`,
                        descriptionJa: `${dirNameJa}の閉じたドアを開けます`
                    });
                }

                if (keyItem && !actions.some(a => a.id === `ACTION_UNLOCK_DOOR_${dirCode}`)) {
                    actions.push({
                        id: `ACTION_UNLOCK_DOOR_${dirCode}`,
                        category: 'INTERACT',
                        label: `Unlock door [${dirCode}] with ${keyItem.rawText || 'key'}`,
                        labelJa: `扉を解錠 [${dirNameJa}] (${keyItem.letter})`,
                        key: `a${keyItem.letter}${dirKey}`,
                        keySequence: ['a', keyItem.letter, dirKey],
                        charStr: 'a',
                        directionKey: dirKey,
                        direction: item.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        target: 'adjacent',
                        risk: null,
                        priority: 95,
                        description: `Apply ${keyItem.rawText || 'key'} to unlock door in ${dirNameJa}`,
                        descriptionJa: `${dirNameJa}の扉を ${keyItem.rawText || '鍵/ロックピック'} で解錠します`
                    });
                }



                if (!actions.some(a => a.id.startsWith('ACTION_KICK_DOOR'))) {
                    actions.push({
                        id: `ACTION_KICK_DOOR_${dirCode}`,
                        category: 'INTERACT',
                        label: `Kick door`,
                        labelJa: `扉を蹴破る (Kick)`,
                        key: `#kick${dirKey}`,
                        keySequence: ['#', 'kick', dirKey],
                        charStr: '#kick',
                        extCmd: 'kick',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: 'warning',
                        priority: 60,
                        description: `Kick door to break it down`,
                        descriptionJa: `扉を蹴破ります`
                    });
                }
                if (!actions.some(a => a.id.startsWith('ACTION_UNTRAP_DOOR'))) {
                    actions.push({
                        id: `ACTION_UNTRAP_DOOR_${dirCode}`,
                        category: 'INTERACT',
                        label: `Untrap door`,
                        labelJa: `扉の罠解除 (#untrap)`,
                        key: `#untrap${dirKey}`,
                        charStr: '#untrap',
                        extCmd: 'untrap',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 75,
                        description: `Disarm trap on door`,
                        descriptionJa: `扉にかかった罠を解除します`
                    });
                }
            }

            // 開いた扉 (Open Door)
            else if (flags.isOpenDoor) {
                if (!actions.some(a => a.id.startsWith('ACTION_CLOSE_DOOR'))) {
                    actions.push({
                        id: `ACTION_CLOSE_DOOR_${dirCode}`,
                        category: 'INTERACT',
                        label: `Close door`,
                        labelJa: `扉を閉める (Close)`,
                        key: `c${dirKey}`,
                        keySequence: ['c', dirKey],
                        charStr: 'c',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 70,
                        description: `Close open door`,
                        descriptionJa: `開いたドアを閉めます`
                    });
                }
            }

            // 壁 / 隠し扉 (Wall / Secret Door)
            else if (flags.isWall) {
                if (!actions.some(a => a.id === 'ACTION_SEARCH_WALL')) {
                    actions.push({
                        id: 'ACTION_SEARCH_WALL',
                        category: 'INTERACT',
                        label: 'Search secret door',
                        labelJa: '隠し扉・罠を探す (Search)',
                        key: 's',
                        charStr: 's',
                        target: 'adjacent',
                        risk: null,
                        priority: 50,
                        description: 'Search surrounding walls for secret doors',
                        descriptionJa: '周囲の壁に隠し扉がないか一括捜索します'
                    });
                }

                if (pickAxe && !actions.some(a => a.id === `ACTION_DIG_WALL_${dirCode}`)) {
                    const verb = pickAxe.verb || (pickAxe.isDigWand ? 'z' : 'a');
                    const itemLetter = pickAxe.letter || pickAxe.ch || '';
                    const isZap = (verb === 'z');
                    const labelActionName = isZap ? `Break/Dig wall [${dirCode}]` : `Dig wall [${dirCode}]`;
                    const labelJaName = isZap ? `壁を破壊・発動 [${dirNameJa}] (${itemLetter})` : `壁を掘削 [${dirNameJa}] (${itemLetter})`;
                    const descText = isZap ? `Zap ${pickAxe.rawText || 'wand'} to break wall in ${dirNameJa}` : `Dig wall in ${dirNameJa} with ${pickAxe.rawText || 'pick-axe'}`;
                    const descJaText = isZap ? `${dirNameJa}の壁を ${pickAxe.rawText || '採掘の杖'} で破壊・貫通します` : `${dirNameJa}の壁を ${pickAxe.rawText || 'ツルハシ'} で掘削・破壊します`;

                    const keySeq = itemLetter ? [verb, itemLetter, dirKey] : [verb, dirKey];

                    actions.push({
                        id: `ACTION_DIG_WALL_${dirCode}`,
                        category: 'INTERACT',
                        label: `${labelActionName} with ${pickAxe.rawText || 'tool'}`,
                        labelJa: labelJaName,
                        key: `${verb}${itemLetter}${dirKey}`,
                        keySequence: keySeq,
                        charStr: verb,
                        directionKey: dirKey,
                        direction: item.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        target: 'adjacent',
                        risk: null,
                        priority: 85,
                        description: descText,
                        descriptionJa: descJaText
                    });
                }

            }

            // 樹木 (Tree)
            else if (flags.isTree) {
                if (!actions.some(a => a.id.startsWith('ACTION_KICK_TREE'))) {
                    actions.push({
                        id: `ACTION_KICK_TREE_${dirCode}`,
                        category: 'INTERACT',
                        label: `Kick tree [${dirCode}]`,
                        labelJa: `樹木を蹴る [${dirNameJa}]`,
                        key: `C-d${dirKey}`,
                        keySequence: ['#', 'kick', dirKey],
                        charStr: '#kick',
                        extCmd: 'kick',
                        directionKey: dirKey,
                        direction: item.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        target: 'adjacent',
                        risk: null,
                        priority: 65,
                        description: `Kick tree to knock down fruit or leaves`,
                        descriptionJa: `${dirNameJa}の樹木を蹴って果物やユーカリの葉を落とします`
                    });
                }

                if (axeItem && !actions.some(a => a.id.startsWith('ACTION_CHOP_TREE'))) {
                    actions.push({
                        id: `ACTION_CHOP_TREE_${dirCode}`,
                        category: 'INTERACT',
                        label: `Chop tree [${dirCode}] with ${axeItem.rawText || 'axe'}`,
                        labelJa: `樹木を伐採 [${dirNameJa}] (${axeItem.letter})`,
                        key: `a${axeItem.letter}${dirKey}`,
                        keySequence: ['a', axeItem.letter, dirKey],
                        charStr: 'a',
                        directionKey: dirKey,
                        direction: item.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        target: 'adjacent',
                        risk: null,
                        priority: 75,
                        description: `Chop tree with ${axeItem.rawText || 'axe'}`,
                        descriptionJa: `${dirNameJa}の樹木を ${axeItem.rawText || '斧'} で切り倒します`
                    });
                }
            }

            // 水場・溶岩 (Water / Lava)
            else if (flags.isWater || flags.isLava) {
                if (frostWand && !actions.some(a => a.id.startsWith('ACTION_FREEZE_WATER'))) {
                    actions.push({
                        id: `ACTION_FREEZE_WATER_${dirCode}`,
                        category: 'INTERACT',
                        label: `Freeze water [${dirCode}] with ${frostWand.rawText || 'wand'}`,
                        labelJa: `水場を凍らせる [${dirNameJa}] (${frostWand.letter})`,
                        key: `a${frostWand.letter}${dirKey}`,
                        keySequence: ['a', frostWand.letter, dirKey],
                        charStr: 'a',
                        directionKey: dirKey,
                        direction: item.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        target: 'adjacent',
                        risk: null,
                        priority: 75,
                        description: `Use wand of frost to freeze water`,
                        descriptionJa: `${dirNameJa}の水場や溶岩を ${frostWand.rawText || '氷の杖'} で凍らせます`
                    });
                }
                actions.push({
                    id: `ACTION_THROW_WATER_${dirCode}`,
                    category: 'INTERACT',
                    label: `Throw item into pool [${dirCode}]`,
                    labelJa: `水/溶岩へ投げ込む [${dirNameJa}]`,
                    key: `t${dirKey}`,
                    charStr: 't',
                    directionKey: dirKey,
                    direction: item.dir,
                    isDirectional: true,
                    dirNameJa,
                    dirSymbol,
                    target: 'adjacent',
                    risk: null,
                    priority: 40,
                    description: `Throw item into water or lava`,
                    descriptionJa: `${dirNameJa}の水や溶岩の中にアイテムを投げ入れます`
                });
            }

            // 隣接マスの箱 (Adjacent Container)
            const isAdjContainer = (item.cell.middle && item.cell.middle.isContainer) || flags.isContainer;
            if (isAdjContainer && keyItem) {
                if (!actions.some(a => a.id === `ACTION_UNLOCK_CONTAINER_${dirCode}`)) {
                    actions.push({
                        id: `ACTION_UNLOCK_CONTAINER_${dirCode}`,
                        category: 'INTERACT',
                        label: `Unlock container [${dirCode}] with ${keyItem.rawText || 'key'}`,
                        labelJa: `箱を解錠 [${dirNameJa}] (${keyItem.letter})`,
                        key: `a${keyItem.letter}${dirKey}`,
                        keySequence: ['a', keyItem.letter, dirKey],
                        charStr: 'a',
                        directionKey: dirKey,
                        direction: item.dir,
                        isDirectional: true,
                        dirNameJa,
                        dirSymbol,
                        target: 'adjacent',
                        risk: null,
                        priority: 95,
                        description: `Apply ${keyItem.rawText || 'key'} to unlock container`,
                        descriptionJa: `${dirNameJa}の箱の鍵を ${keyItem.rawText || '鍵/ロックピック'} で解錠します`
                    });
                }
            }


            // 鉄格子 (Iron Bars)

            else if (flags.isIronBars) {
                actions.push({
                    id: `ACTION_MELT_BARS_${dirCode}`,
                    category: 'INTERACT',
                    label: `Melt / Break bars (${dirCode})`,
                    labelJa: `${dirName}の鉄格子を溶かす/破壊 (Apply)`,
                    key: `a${dirKey}`,
                    keySequence: ['a', dirKey],
                    charStr: 'a',
                    directionKey: dirKey,
                    direction: item.dir,
                    target: 'adjacent',
                    risk: null,
                    priority: 55,
                    description: `Apply acid or pick-axe to break iron bars in direction ${dirName}`,
                    descriptionJa: `${dirName}の鉄格子を酸のポーションで溶かすか壊します`
                });
            }

            // 隣接マスにある罠 (Trap)
            else if (flags.isTrap) {
                actions.push({
                    id: `ACTION_UNTRAP_ADJACENT_${dirCode}`,
                    category: 'INTERACT',
                    label: `Untrap (${dirCode})`,
                    labelJa: `${dirName}の罠を解除 (Untrap)`,
                    key: `#untrap${dirKey}`,
                    keySequence: ['#', 'untrap', dirKey],
                    charStr: '#untrap',
                    extCmd: 'untrap',
                    directionKey: dirKey,
                    direction: item.dir,
                    target: 'adjacent',
                    risk: null,
                    priority: 75,
                    description: `Disarm trap in direction ${dirName}`,
                    descriptionJa: `${dirName}にある罠の解除を試みます`
                });
            }
        });
    }

    /**
     * 4. 8方向レイキャストによる遠隔攻撃 (Ranged Combat: f / t) のアクション判定
     */
    static buildRangedActions(areaState, inventoryState, tools, actions, skillStateManager = null) {
        if (!areaState) return;

        const rangedTargets = this.raycastEightDirections(areaState);
        if (rangedTargets.length === 0) return;

        // インベントリから弾薬・装備状況の確認
        const items = (inventoryState && Array.isArray(inventoryState.items)) ? inventoryState.items : [];
        const quiveredItem = items.find(i => i.isQuivered);
        const ammoItems = items.filter(i => i.isAmmo && !i.isQuivered);

        // スキル熟練度に基づく投擲可能アイテムのソート (スキルが高い武器・弾薬を優先)
        if (ammoItems.length > 1 && skillStateManager) {
            ammoItems.sort((a, b) => {
                const skillA = this.matchWeaponToSkill(a);
                const skillB = this.matchWeaponToSkill(b);
                const rankA = skillStateManager.getSkillRank(skillA);
                const rankB = skillStateManager.getSkillRank(skillB);
                return (rankB.score || 0) - (rankA.score || 0);
            });
        }

        rangedTargets.forEach(target => {
            const { dir, targetKey, entity } = target;
            const dirCode = dir.code;
            const dirToken = `DIR_${dirCode}`;
            const dirMeta = this.getDirectionMeta(dir);
            const { dirNameJa, dirSymbol } = dirMeta;

            // (A) 矢筒にセットされている弾薬がある場合 -> 射撃 (f)
            if (quiveredItem) {
                let firePriority = 85;
                if (skillStateManager) {
                    const quiveredSkill = this.matchWeaponToSkill(quiveredItem);
                    const rank = skillStateManager.getSkillRank(quiveredSkill);
                    if (rank.score > 0) {
                        firePriority += Math.min(10, Math.floor(rank.score / 4));
                    }
                }

                actions.push({
                    id: `ACTION_FIRE_${dirCode}`,
                    category: 'COMBAT',
                    label: `Fire at target [${dirCode}]`,
                    labelJa: `標的に射撃 [${dirNameJa}] (f)`,
                    key: `f${targetKey}`,
                    keySequence: ['f', dirToken],
                    charStr: 'f',
                    directionKey: dirToken,
                    direction: dir,
                    isDirectional: true,
                    dirNameJa,
                    dirSymbol,
                    entity: entity,
                    target: 'ranged',
                    risk: 'warning',
                    priority: firePriority,
                    description: `Fire quivered ${quiveredItem.rawText || 'ammunition'} at creature in ${dirNameJa}`,
                    descriptionJa: `矢筒の ${quiveredItem.rawText || '弾薬'} を${dirNameJa}の標的に向けて射撃します`
                });
            }
            // (B) 矢筒未装填だが手元に投擲可能アイテムがある場合 -> 投擲 (t)
            else if (ammoItems.length > 0) {
                const ammo = ammoItems[0];
                let throwPriority = 78;
                if (skillStateManager) {
                    const ammoSkill = this.matchWeaponToSkill(ammo);
                    const rank = skillStateManager.getSkillRank(ammoSkill);
                    if (rank.score > 0) {
                        throwPriority += Math.min(8, Math.floor(rank.score / 5));
                    }
                }

                actions.push({
                    id: `ACTION_THROW_${dirCode}`,
                    category: 'COMBAT',
                    label: `Throw ${ammo.rawText || 'item'} at target [${dirCode}]`,
                    labelJa: `標的に投擲 [${dirNameJa}] (t:${ammo.letter})`,
                    key: `t${ammo.letter}${targetKey}`,
                    keySequence: ['t', ammo.letter, dirToken],
                    charStr: 't',
                    directionKey: dirToken,
                    direction: dir,
                    isDirectional: true,
                    dirNameJa,
                    dirSymbol,
                    entity: entity,
                    target: 'ranged',
                    risk: 'warning',
                    priority: throwPriority,
                    description: `Throw ${ammo.rawText || 'item'} at creature in ${dirNameJa}`,
                    descriptionJa: `手持ちの ${ammo.rawText || 'アイテム'} を${dirNameJa}の標的に投擲します`
                });
            }
        });
    }

    /**
     * 武器・アイテムから該当する NetHack スキル種別名をマッチング
     * @param {Object} item 
     * @returns {string} スキル種別名 (英語)
     */
    static matchWeaponToSkill(item) {
        if (!item) return 'bare hands';
        const text = ((item.name || '') + ' ' + (item.rawText || '')).toLowerCase();

        // 剣・刀類
        if (text.includes('long sword') || text.includes('長剣') || text.includes('katana') || text.includes('カタナ') || text.includes('刀') || text.includes('tsurugi')) return 'long sword';
        if (text.includes('two-handed sword') || text.includes('両手剣')) return 'two-handed sword';
        if (text.includes('broadsword') || text.includes('広刃')) return 'broadsword';
        if (text.includes('short sword') || text.includes('小剣') || (text.includes('短剣') && !text.includes('dagger'))) return 'short sword';
        if (text.includes('dagger') || text.includes('ダガー') || text.includes('athame') || text.includes('アサメ') || text.includes('短刀') || text.includes('knife') || text.includes('ナイフ')) return 'dagger';
        if (text.includes('scimitar') || text.includes('シミター') || text.includes('saber') || text.includes('サーベル')) return 'saber';

        // 弓・投擲・射撃 (crossbow を bow より先に判定)
        if (text.includes('crossbow') || text.includes('クロスボウ') || text.includes('ボルト') || text.includes('bolt')) return 'crossbow';
        if (text.includes('bow') || text.includes('弓') || text.includes('arrow') || text.includes('矢') || text.includes('yumi') || text.includes('ya')) return 'bow';
        if (text.includes('sling') || text.includes('スリング') || text.includes('flint') || text.includes('rock') || text.includes('石')) return 'sling';
        if (text.includes('dart') || text.includes('ダーツ')) return 'dart';
        if (text.includes('shuriken') || text.includes('手裏剣')) return 'shuriken';
        if (text.includes('boomerang') || text.includes('ブーメラン')) return 'boomerang';

        // 槍・ポールアーム
        if (text.includes('javelin') || text.includes('投げ槍') || text.includes('spear') || text.includes('槍')) return 'spear';
        if (text.includes('trident') || text.includes('三叉槍') || text.includes('トライデント')) return 'trident';
        if (text.includes('halberd') || text.includes('ハルバード') || text.includes('polearm') || text.includes('lance') || text.includes('glaive') || text.includes('bardiche') || text.includes('spetum')) return 'polearms';

        // 鈍器・斧
        if (text.includes('pick-axe') || text.includes('pick') || text.includes('ツルハシ')) return 'pick-axe';
        if (text.includes('axe') || text.includes('斧')) return 'axe';
        if (text.includes('mace') || text.includes('メイス')) return 'mace';
        if (text.includes('morning star') || text.includes('モーニングスター')) return 'morning star';
        if (text.includes('flail') || text.includes('フレイル')) return 'flail';
        if (text.includes('hammer') || text.includes('ハンマー') || text.includes('war hammer')) return 'hammer';
        if (text.includes('quarterstaff') || text.includes('六尺棒') || text.includes('staff') || text.includes('杖')) return 'quarterstaff';
        if (text.includes('club') || text.includes('こん棒') || text.includes('棍棒') || text.includes('aklys')) return 'club';

        // 鞭・特殊
        if (text.includes('whip') || text.includes('鞭') || text.includes('bullwhip') || text.includes('rubber hose')) return 'whip';
        if (text.includes('unicorn horn') || text.includes('ユニコーンの角')) return 'unicorn horn';

        return 'bare hands';
    }

    /**
     * 5. スキル熟練度に基づくおすすめ武器装備アクション (Recommended Wield / Equipment) の生成
     * @param {Object} inventoryState 
     * @param {Object} skillStateManager 
     * @param {Array<Object>} actions 
     */
    static buildEquipmentRecommendations(inventoryState, skillStateManager, actions) {
        if (!inventoryState || !Array.isArray(inventoryState.items) || inventoryState.items.length === 0) return;

        const items = inventoryState.items;
        // 武器アイテムの抽出 (isWeapon または名前から武器と判定されるもの)
        const weapons = items.filter(item => {
            if (!item || !item.letter) return false;
            if (item.isWeapon || item.category === 'WEAPON') return true;
            const text = (item.rawText || '').toLowerCase();
            return text.includes('sword') || text.includes('dagger') || text.includes('knife') ||
                   text.includes('axe') || text.includes('mace') || text.includes('spear') ||
                   text.includes('bow') || text.includes('crossbow') || text.includes('staff') ||
                   text.includes('club') || text.includes('saber') || text.includes('scimitar') ||
                   text.includes('blade') || text.includes('tsurugi') || text.includes('katana') ||
                   text.includes('flail') || text.includes('hammer') || text.includes('whip') ||
                   text.includes('刀') || text.includes('剣') || text.includes('槍') || text.includes('斧');
        });

        if (weapons.length === 0) return;

        // 現在装備中の武器
        const currentWielded = weapons.find(w => w.isWielded || (w.rawText && (w.rawText.includes('weapon in hand') || w.rawText.includes('wielded'))));

        // 各武器のスコア計算
        const scoredWeapons = weapons.map(weapon => {
            const skillName = this.matchWeaponToSkill(weapon);
            let skillScore = 0;
            let skillRank = { key: 'unskilled', label: '未熟', en: 'Unskilled' };
            if (skillStateManager && typeof skillStateManager.getSkillRank === 'function') {
                skillRank = skillStateManager.getSkillRank(skillName);
                skillScore = skillRank.score || 0;
            }

            // 武器の追加ボーナス (強化値 +1, +2 等、祝福 blessed 等)
            let bonus = 0;
            const raw = (weapon.rawText || '').toLowerCase();
            const plusMatch = raw.match(/\+(\d+)/);
            if (plusMatch) bonus += parseInt(plusMatch[1], 10) * 5;
            const minusMatch = raw.match(/\-(\d+)/);
            if (minusMatch) bonus -= parseInt(minusMatch[1], 10) * 5;
            if (raw.includes('blessed') || raw.includes('祝福')) bonus += 5;
            if (!raw.includes('uncursed') && (raw.includes('cursed') || raw.includes('呪われ'))) bonus -= 15;

            const totalScore = skillScore + bonus;
            return {
                weapon,
                skillName,
                skillRank,
                skillScore,
                totalScore,
                isCurrent: weapon === currentWielded
            };
        });

        // スコア降順ソート
        scoredWeapons.sort((a, b) => b.totalScore - a.totalScore);
        const best = scoredWeapons[0];
        if (!best) return;

        // 現在装備中の武器のスコア
        const currentScore = currentWielded ? (scoredWeapons.find(sw => sw.isCurrent)?.totalScore ?? 0) : -999;

        // 推奨条件:
        // 1. 現在武器を何も装備していない場合
        // 2. 現在の武器よりも最高スコアの武器の方が優れている場合 (スコア差が +10 以上など)
        if (!currentWielded || (!best.isCurrent && best.totalScore > currentScore)) {
            const wItem = best.weapon;
            const rankLabel = best.skillRank.label || best.skillRank.en || '未熟';
            const isBetterSwitch = Boolean(currentWielded);

            actions.push({
                id: `ACTION_WIELD_RECOMMENDED_${wItem.letter}`,
                category: 'EQUIPMENT',
                label: isBetterSwitch ? `Switch to skilled weapon [${wItem.name || wItem.rawText}]` : `Wield recommended weapon [${wItem.name || wItem.rawText}]`,
                labelJa: isBetterSwitch ? `熟練武器に持ち替え [${wItem.name || wItem.rawText}] (熟練度: ${rankLabel})` : `おすすめ武器を装備 [${wItem.name || wItem.rawText}] (熟練度: ${rankLabel})`,
                key: `w${wItem.letter}`,
                keySequence: ['w', wItem.letter],
                charStr: 'w',
                target: 'inventory',
                entity: wItem,
                risk: null,
                priority: isBetterSwitch ? 68 : 82,
                description: `Wield ${wItem.rawText || 'weapon'} (${best.skillName} skill: ${rankLabel})`,
                descriptionJa: `熟練している ${wItem.rawText || '武器'} (${best.skillName} スキル: ${rankLabel}) を装備します`
            });
        }
    }


    /**
     * 8方向のレイキャスト走査ルーチン
     * @param {Object} areaState 
     * @returns {Array<Object>} 視線が通過し敵が確認された8方向ターゲット情報
     */
    static raycastEightDirections(areaState) {
        const grid = areaState.grid;
        if (!grid || !Array.isArray(grid)) return [];

        const isNumpad = (areaState.keyMode === 'numpad');
        const playerX = areaState.playerLocation ? areaState.playerLocation.x : (areaState.center ? areaState.center.x : 0);
        const playerY = areaState.playerLocation ? areaState.playerLocation.y : (areaState.center ? areaState.center.y : 0);

        const directions = [
            { code: 'N', name: '北', dx: 0, dy: -1, viKey: 'k', numpadKey: '8' },
            { code: 'NE', name: '北東', dx: 1, dy: -1, viKey: 'u', numpadKey: '9' },
            { code: 'E', name: '東', dx: 1, dy: 0, viKey: 'l', numpadKey: '6' },
            { code: 'SE', name: '南東', dx: 1, dy: 1, viKey: 'n', numpadKey: '3' },
            { code: 'S', name: '南', dx: 0, dy: 1, viKey: 'j', numpadKey: '2' },
            { code: 'SW', name: '南西', dx: -1, dy: 1, viKey: 'b', numpadKey: '1' },
            { code: 'W', name: '西', dx: -1, dy: 0, viKey: 'h', numpadKey: '4' },
            { code: 'NW', name: '北西', dx: -1, dy: -1, viKey: 'y', numpadKey: '7' }
        ];

        const targets = [];
        const width = areaState.width || 80;
        const height = areaState.height || 21;
        const maxDist = 15;

        for (const dir of directions) {
            const targetKey = isNumpad ? dir.numpadKey : dir.viKey;

            for (let dist = 1; dist <= maxDist; dist++) {
                const tx = playerX + dir.dx * dist;
                const ty = playerY + dir.dy * dist;

                if (tx < 0 || tx >= width || ty < 0 || ty >= height) break;

                const cell = grid[ty] ? grid[ty][tx] : null;
                if (!cell) break;

                // 地形による遮断判定 (壁、閉じた扉、鉄格子)
                if (cell.bottom && cell.bottom.cmapFlags) {
                    const flags = cell.bottom.cmapFlags;
                    if (flags.isWall || flags.isClosedDoor || flags.isIronBars) {
                        break; // 視線遮断
                    }
                }

                // モンスター/ペット判定
                if (cell.top) {
                    const topType = cell.top.type;
                    if (topType === 'PET') {
                        break; // ペット誤爆防止のためレイ停止
                    } else if (topType === 'MONSTER') {
                        if (dist >= 2) {
                            // dist >= 2 の遠隔敵ターゲットを発見！
                            targets.push({
                                dir,
                                dist,
                                cell,
                                entity: cell.top,
                                targetKey
                            });
                        }
                        break; // 最前の敵に当たったらレイ停止
                    }
                }
            }
        }

        return targets;
    }
}



