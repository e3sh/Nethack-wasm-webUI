/**
 * ContextActionEngine.js
 * AreaStateManager が出力する AreaState を基に、
 * 現在の自キャラ周辺の文脈・状況に応じた推奨アクション（Recommended Actions）を生成するエンジン
 */

export class ContextActionEngine {
    /**
     * エリア状態 (AreaState) を解析し、推奨可能なアクション一覧を優先度順で返却
     * @param {Object} areaState - AreaStateManager.getAreaState() の返却値
     * @returns {Array<Object>} 推奨アクションの配列 (priority 降順)
     */
    static generateActions(areaState) {
        if (!areaState || !areaState.feet) return [];

        const actions = [];
        const feet = areaState.feet;

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
                    actions.push({
                        id: 'ACTION_LOOT',
                        category: 'INTERACT',
                        label: 'Loot container / bag',
                        labelJa: '漁る/開ける (Loot)',
                        key: '#loot',
                        charStr: '#loot',
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

        // (2-A) 隣接モンスターへの攻撃判定
        if (areaState.adjacentMonsters && areaState.adjacentMonsters.length > 0) {
            areaState.adjacentMonsters.forEach(m => {
                const dirNameEn = m.dir.code || m.dir.name;
                actions.push({
                    id: `ACTION_ATTACK_${m.dir.code}`,
                    category: 'COMBAT',
                    label: `Attack enemy (${dirNameEn})`,
                    labelJa: `${m.dir.name}の敵を攻撃`,
                    key: m.dir.key,
                    charStr: m.dir.key,
                    directionKey: m.dir.key,
                    direction: m.dir,
                    entity: m.entity,
                    target: 'adjacent',
                    risk: null,
                    priority: 100,
                    description: `Attack enemy monster in direction ${m.dir.name} (${m.dir.code})`,
                    descriptionJa: `${m.dir.name} (${m.dir.code}) にいる敵に攻撃します`
                });
            });
        }

        // (2-B) 隣接する設置物・地形 (ドア、壁、木、水、溶岩、鉄格子等)
        if (areaState.adjacentEntities) {
            areaState.adjacentEntities.forEach(item => {
                const b = item.cell.bottom;
                if (!b || !b.cmapFlags) return;
                const flags = b.cmapFlags;
                const dirCode = item.dir.code;
                const dirName = item.dir.name;
                const dirKey = item.dir.key;

                // 閉じた扉 (Closed Door)
                if (flags.isClosedDoor) {
                    actions.push({
                        id: `ACTION_OPEN_DOOR_${dirCode}`,
                        category: 'INTERACT',
                        label: `Open door (${dirCode})`,
                        labelJa: `${dirName}の扉を開ける (Open)`,
                        key: `o${dirKey}`,
                        charStr: 'o',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 90,
                        description: `Open closed door in direction ${dirName}`,
                        descriptionJa: `${dirName}にある閉じたドアを開けます`
                    });
                    actions.push({
                        id: `ACTION_UNLOCK_DOOR_${dirCode}`,
                        category: 'INTERACT',
                        label: `Unlock door (${dirCode})`,
                        labelJa: `${dirName}の扉を解錠 (Apply)`,
                        key: `a${dirKey}`,
                        charStr: 'a',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 85,
                        description: `Apply key or pick to unlock door in direction ${dirName}`,
                        descriptionJa: `${dirName}にある扉を合鍵やクレジットカードで解錠します`
                    });
                    actions.push({
                        id: `ACTION_KICK_DOOR_${dirCode}`,
                        category: 'INTERACT',
                        label: `Kick door (${dirCode})`,
                        labelJa: `${dirName}の扉を蹴破る (Kick)`,
                        key: `C-d${dirKey}`,
                        charStr: 'C-d',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: 'warning',
                        priority: 60,
                        description: `Kick door to break it down in direction ${dirName}`,
                        descriptionJa: `${dirName}にある扉を蹴破ります`
                    });
                    actions.push({
                        id: `ACTION_UNTRAP_DOOR_${dirCode}`,
                        category: 'INTERACT',
                        label: `Untrap door (${dirCode})`,
                        labelJa: `${dirName}の扉の罠解除 (Untrap)`,
                        key: `#untrap${dirKey}`,
                        charStr: '#untrap',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 75,
                        description: `Disarm trap on door in direction ${dirName}`,
                        descriptionJa: `${dirName}の扉にかかった罠を解除します`
                    });
                }

                // 開いた扉 (Open Door)
                else if (flags.isOpenDoor) {
                    actions.push({
                        id: `ACTION_CLOSE_DOOR_${dirCode}`,
                        category: 'INTERACT',
                        label: `Close door (${dirCode})`,
                        labelJa: `${dirName}の扉を閉める (Close)`,
                        key: `c${dirKey}`,
                        charStr: 'c',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 70,
                        description: `Close open door in direction ${dirName}`,
                        descriptionJa: `${dirName}にある開いたドアを閉めます`
                    });
                }

                // 壁 / 隠し扉 (Wall / Secret Door) - s コマンドは全方位一括探査のため directionKey は不要
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
                    actions.push({
                        id: `ACTION_DIG_WALL_${dirCode}`,
                        category: 'INTERACT',
                        label: `Dig wall (${dirCode})`,
                        labelJa: `${dirName}の壁を掘削 (Apply pick)`,
                        key: `a${dirKey}`,
                        charStr: 'a',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 45,
                        description: `Dig or mine wall with pick-axe in direction ${dirName}`,
                        descriptionJa: `${dirName}の壁をツルハシ等で掘削・破壊します`
                    });
                }

                // 樹木 (Tree)
                else if (flags.isTree) {
                    actions.push({
                        id: `ACTION_KICK_TREE_${dirCode}`,
                        category: 'INTERACT',
                        label: `Kick tree (${dirCode})`,
                        labelJa: `${dirName}の木を蹴る (Kick)`,
                        key: `C-d${dirKey}`,
                        charStr: 'C-d',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 65,
                        description: `Kick tree in direction ${dirName} to knock down fruit or leaves`,
                        descriptionJa: `${dirName}の木を蹴って果物やユーカリの葉を落とします`
                    });
                    actions.push({
                        id: `ACTION_CHOP_TREE_${dirCode}`,
                        category: 'INTERACT',
                        label: `Chop tree (${dirCode})`,
                        labelJa: `${dirName}の木を伐採 (Apply axe)`,
                        key: `a${dirKey}`,
                        charStr: 'a',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 55,
                        description: `Chop tree in direction ${dirName} with axe or pick-axe`,
                        descriptionJa: `${dirName}の木を斧やツルハシで切り倒します`
                    });
                }

                // 水場・溶岩 (Water / Lava)
                else if (flags.isWater || flags.isLava) {
                    actions.push({
                        id: `ACTION_FREEZE_WATER_${dirCode}`,
                        category: 'INTERACT',
                        label: `Freeze / Bridge water (${dirCode})`,
                        labelJa: `${dirName}の水場/溶岩に対処 (Apply wand)`,
                        key: `a${dirKey}`,
                        charStr: 'a',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 60,
                        description: `Use wand of frost to freeze water or build bridge in direction ${dirName}`,
                        descriptionJa: `${dirName}の水場や溶岩を凍らせたり橋を架けます`
                    });
                    actions.push({
                        id: `ACTION_THROW_WATER_${dirCode}`,
                        category: 'INTERACT',
                        label: `Throw item into pool (${dirCode})`,
                        labelJa: `${dirName}へ投げ込む (Throw)`,
                        key: `t${dirKey}`,
                        charStr: 't',
                        directionKey: dirKey,
                        direction: item.dir,
                        target: 'adjacent',
                        risk: null,
                        priority: 40,
                        description: `Throw item into water or lava in direction ${dirName}`,
                        descriptionJa: `${dirName}の水や溶岩の中にアイテムを投げ入れます`
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

