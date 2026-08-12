/**
 * ContextActionEngine.js
 * AreaStateManager が出力する AreaState を基に、
 * 現在の自キャラ周辺の文脈・状況に応じた推奨アクション（Recommended Actions）を生成するエンジン
 */

import { isShopkeeperMonster } from './glyphClassifier.js';

export class ContextActionEngine {
    /**
     * エリア状態 (AreaState) およびインベントリ状態を解析し、推奨可能なアクション一覧を優先度順で返却
     * @param {Object} areaState - AreaStateManager.getAreaState() の返却値
     * @param {Object} [inventoryState] - InventoryStateManager インスタンス
     * @returns {Array<Object>} 推奨アクションの配列 (priority 降順)
     */
    static generateActions(areaState, inventoryState = null) {
        if (!areaState || !areaState.feet) return [];

        const actions = [];
        const feet = areaState.feet;

        // インベントリツールの事前抽出
        const keyItem = inventoryState ? inventoryState.getKeyOrLockPick() : null;
        const pickAxe = inventoryState ? inventoryState.getPickAxe() : null;
        const axeItem = inventoryState ? inventoryState.getAxe() : null;
        const frostWand = inventoryState ? inventoryState.getFrostWand() : null;

        // =========================================================================
        // 1. 足元 (Stepping on) のアクション判定
        // =========================================================================

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

                // (b) コンテナ漁り / 解錠 (箱・袋・コンテナが足元にある場合のみ推奨)
                if (feet.middle.isContainer) {
                    // 鍵/ロックピック所持時は箱の解錠アクションを生成
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
                        key: '#loot',
                        charStr: '#loot',
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
                        charStr: '#untrap',
                        extCmd: 'untrap',
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

            // 階段 (Stairs / Ladders)
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

            // 祭壇 (Altar)
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

            // 泉 (Fountain)
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
                    charStr: 'C-d',
                    target: 'feet',
                    risk: 'danger',
                    priority: 20,
                    description: 'Kick the fountain (DANGER: May flood area or spawn water elemental)',
                    descriptionJa: '泉を蹴ります（※水が吹き出して道具が濡れたりエレメンタルが湧く危険行動です）'
                });
            }

            // シンク (Sink)
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
                    charStr: 'C-d',
                    target: 'feet',
                    risk: 'warning',
                    priority: 30,
                    description: 'Kick the sink (May dislodge rings or black puddings)',
                    descriptionJa: 'シンクを蹴って指輪やプディングを引っ張り出します'
                });
            }

            // 罠 (Traps)
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

            // 玉座 (Throne)
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

            // 床 / 廊下全般 (Floor / Corridor)
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

        // =========================================================================
        // 2. 隣接マス (Adjacent) のアクション判定
        // =========================================================================

        // (2-A) 隣接モンスターへの判定 (ペット誤爆防止・NPC安全性確認)
        if (areaState.adjacentMonsters && areaState.adjacentMonsters.length > 0) {
            areaState.adjacentMonsters.forEach(m => {
                const isPet = (m.entity && m.entity.type === 'PET');

                if (isPet) {
                    // ペットの場合は攻撃アクションを絶対生成せず、話しかける / 移動のみ
                    if (!actions.some(a => a.id.startsWith('ACTION_CHAT'))) {
                        actions.push({
                            id: `ACTION_CHAT_${m.dir.code}`,
                            category: 'INTERACT',
                            label: `Chat with pet`,
                            labelJa: `ペットに話しかける (#chat)`,
                            key: `#chat${m.dir.key}`,
                            charStr: '#chat',
                            extCmd: 'chat',
                            directionKey: m.dir.key,
                            direction: m.dir,
                            entity: m.entity,
                            target: 'adjacent',
                            risk: null,
                            priority: 95,
                            description: `Talk to pet`,
                            descriptionJa: `ペットに話しかけます（方向はD-Pad等で選択）`
                        });
                    }
                } else {
                    const isShopkeeper = isShopkeeperMonster(m.entity);
                    // モンスター/NPC (近接攻撃)
                    if (!actions.some(a => a.id.startsWith('ACTION_ATTACK'))) {
                        actions.push({
                            id: `ACTION_ATTACK_${m.dir.code}`,
                            category: 'COMBAT',
                            label: `Attack target`,
                            labelJa: `対象に近接攻撃`,
                            key: m.dir.key,
                            charStr: m.dir.key,
                            directionKey: m.dir.key,
                            direction: m.dir,
                            entity: m.entity,
                            target: 'adjacent',
                            risk: 'warning',
                            priority: 80,
                            description: `Attack creature in direction`,
                            descriptionJa: `近接対象に攻撃を試みます`
                        });
                    }
                    // 話しかける (#chat)
                    if (!actions.some(a => a.id.startsWith('ACTION_CHAT_NPC'))) {
                        actions.push({
                            id: `ACTION_CHAT_NPC_${m.dir.code}`,
                            category: 'INTERACT',
                            label: `Talk / Chat`,
                            labelJa: `対象に話しかける (#chat)`,
                            key: `#chat${m.dir.key}`,
                            charStr: '#chat',
                            extCmd: 'chat',
                            directionKey: m.dir.key,
                            direction: m.dir,
                            entity: m.entity,
                            target: 'adjacent',
                            risk: null,
                            priority: isShopkeeper ? 90 : 30,
                            description: `Talk to NPC or shopkeeper`,
                            descriptionJa: `NPCや店主に話しかけます`
                        });
                    }
                    // 店主に代金を支払う (#pay) - 店主 (Shopkeeper) のみ生成
                    if (isShopkeeper && !actions.some(a => a.id.startsWith('ACTION_PAY'))) {
                        actions.push({
                            id: `ACTION_PAY_${m.dir.code}`,
                            category: 'INTERACT',
                            label: `Pay shopkeeper`,
                            labelJa: `店主に代金を支払う (#pay)`,
                            key: `#pay${m.dir.key}`,
                            charStr: '#pay',
                            extCmd: 'pay',
                            directionKey: m.dir.key,
                            direction: m.dir,
                            entity: m.entity,
                            target: 'adjacent',
                            risk: null,
                            priority: 95,
                            description: `Pay shopkeeper for unpaid items`,
                            descriptionJa: `店主に商品の購入代金を支払います`
                        });
                    }
                }
            });
        }

        // (2-B) 隣接する設置物・地形 (ドア、壁、木、水、溶岩、鉄格子等)
        if (areaState.adjacentEntities) {
            const dirToAbstractMap = {
                'N': 'DIR_N', 'E': 'DIR_E', 'S': 'DIR_S', 'W': 'DIR_W',
                'NE': 'DIR_NE', 'NW': 'DIR_NW', 'SE': 'DIR_SE', 'SW': 'DIR_SW',
                '8': 'DIR_N', '6': 'DIR_E', '2': 'DIR_S', '4': 'DIR_W',
                '9': 'DIR_NE', '7': 'DIR_NW', '3': 'DIR_SE', '1': 'DIR_SW',
                'k': 'DIR_N', 'l': 'DIR_E', 'j': 'DIR_S', 'h': 'DIR_W',
                'u': 'DIR_NE', 'y': 'DIR_NW', 'n': 'DIR_SE', 'b': 'DIR_SW'
            };

            areaState.adjacentEntities.forEach(item => {
                const b = item.cell.bottom;
                if (!b || !b.cmapFlags) return;
                const flags = b.cmapFlags;
                const dirCode = item.dir.code;
                const dirKey = dirToAbstractMap[item.dir.code] || dirToAbstractMap[item.dir.key] || item.dir.key;

                // 閉じた扉 (Closed Door)
                if (flags.isClosedDoor) {
                    if (!actions.some(a => a.id.startsWith('ACTION_OPEN_DOOR'))) {
                        actions.push({
                            id: `ACTION_OPEN_DOOR_${dirCode}`,
                            category: 'INTERACT',
                            label: `Open door`,
                            labelJa: `扉を開ける (Open)`,
                            key: `o${dirKey}`,
                            keySequence: ['o', dirKey],
                            charStr: 'o',
                            directionKey: dirKey,
                            direction: item.dir,
                            target: 'adjacent',
                            risk: null,
                            priority: 90,
                            description: `Open closed door`,
                            descriptionJa: `閉じたドアを開けます`
                        });
                    }

                    // 鍵/ピック所持時のみ「解錠」アクションを生成（ノイズ除去）
                    if (keyItem && !actions.some(a => a.id.startsWith('ACTION_UNLOCK_DOOR'))) {
                        actions.push({
                            id: `ACTION_UNLOCK_DOOR_${dirCode}`,
                            category: 'INTERACT',
                            label: `Unlock door with ${keyItem.rawText || 'key'}`,
                            labelJa: `扉を解錠 (${keyItem.letter})`,
                            key: `a${keyItem.letter}${dirKey}`,
                            keySequence: ['a', keyItem.letter, dirKey],
                            charStr: 'a',
                            directionKey: dirKey,
                            direction: item.dir,
                            target: 'adjacent',
                            risk: null,
                            priority: 95,
                            description: `Apply ${keyItem.rawText || 'key'} to unlock door`,
                            descriptionJa: `扉を ${keyItem.rawText || '鍵/ロックピック'} で解錠します`
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

                    // ツルハシ所持時のみ「掘削」アクションを生成（ノイズ除去）
                    if (pickAxe && !actions.some(a => a.id.startsWith('ACTION_DIG_WALL'))) {
                        actions.push({
                            id: `ACTION_DIG_WALL_${dirCode}`,
                            category: 'INTERACT',
                            label: `Dig wall with ${pickAxe.rawText || 'pick-axe'}`,
                            labelJa: `壁を掘削 (${pickAxe.letter})`,
                            key: `a${pickAxe.letter}${dirKey}`,
                            keySequence: ['a', pickAxe.letter, dirKey],
                            charStr: 'a',
                            directionKey: dirKey,
                            direction: item.dir,
                            target: 'adjacent',
                            risk: null,
                            priority: 85,
                            description: `Dig or mine wall with ${pickAxe.rawText || 'pick-axe'}`,
                            descriptionJa: `壁を ${pickAxe.rawText || 'ツルハシ'} で掘削・破壊します`
                        });
                    }
                }

                // 樹木 (Tree)
                else if (flags.isTree) {
                    if (!actions.some(a => a.id.startsWith('ACTION_KICK_TREE'))) {
                        actions.push({
                            id: `ACTION_KICK_TREE_${dirCode}`,
                            category: 'INTERACT',
                            label: `Kick tree`,
                            labelJa: `樹木を蹴る (Kick)`,
                            key: `C-d${dirKey}`,
                            charStr: 'C-d',
                            directionKey: dirKey,
                            direction: item.dir,
                            target: 'adjacent',
                            risk: null,
                            priority: 65,
                            description: `Kick tree to knock down fruit or leaves`,
                            descriptionJa: `樹木を蹴って果物やユーカリの葉を落とします`
                        });
                    }

                    // 斧所持時のみ「伐採」アクションを生成
                    if (axeItem && !actions.some(a => a.id.startsWith('ACTION_CHOP_TREE'))) {
                        actions.push({
                            id: `ACTION_CHOP_TREE_${dirCode}`,
                            category: 'INTERACT',
                            label: `Chop tree with ${axeItem.rawText || 'axe'}`,
                            labelJa: `樹木を伐採 (${axeItem.letter})`,
                            key: `a${axeItem.letter}${dirKey}`,
                            keySequence: ['a', axeItem.letter, dirKey],
                            charStr: 'a',
                            directionKey: dirKey,
                            direction: item.dir,
                            target: 'adjacent',
                            risk: null,
                            priority: 75,
                            description: `Chop tree with ${axeItem.rawText || 'axe'}`,
                            descriptionJa: `樹木を ${axeItem.rawText || '斧'} で切り倒します`
                        });
                    }
                }

                // 水場・溶岩 (Water / Lava)
                else if (flags.isWater || flags.isLava) {
                    if (frostWand && !actions.some(a => a.id.startsWith('ACTION_FREEZE_WATER'))) {
                        actions.push({
                            id: `ACTION_FREEZE_WATER_${dirCode}`,
                            category: 'INTERACT',
                            label: `Freeze water with ${frostWand.rawText || 'wand'}`,
                            labelJa: `水場を凍らせる (${frostWand.letter})`,
                            key: `a${frostWand.letter}${dirKey}`,
                            keySequence: ['a', frostWand.letter, dirKey],
                            charStr: 'a',
                            directionKey: dirKey,
                            direction: item.dir,
                            target: 'adjacent',
                            risk: null,
                            priority: 75,
                            description: `Use wand of frost to freeze water`,
                            descriptionJa: `水場や溶岩を ${frostWand.rawText || '氷の杖'} で凍らせます`
                        });
                    }
                    actions.push({
                        id: `ACTION_THROW_WATER_${dirCode}`,
                        category: 'INTERACT',
                        label: `Throw item into pool`,
                        labelJa: `水/溶岩へ投げ込む (Throw)`,
                        key: `t${dirKey}`,
                        charStr: 't',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 40,
                        description: `Throw item into water or lava`,
                        descriptionJa: `水や溶岩の中にアイテムを投げ入れます`
                    });
                }

                // 鉄格子 (Iron Bars)
                else if (flags.isIronBars) {
                    actions.push({
                        id: `ACTION_MELT_BARS_${dirCode}`,
                        category: 'INTERACT',
                        label: `Melt / Break bars (${dirCode})`,
                        labelJa: `${dirName}の鉄格子を溶かす/破壊 (Apply)`,
                        key: `a${dirKey}`,
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
                        charStr: '#untrap',
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

        // 優先度 (priority) 降順でソート
        actions.sort((a, b) => b.priority - a.priority);

        return actions;
    }
}

