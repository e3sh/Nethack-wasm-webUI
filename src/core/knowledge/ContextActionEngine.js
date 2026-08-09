/**
 * ContextActionEngine.js
 * AreaStateManager が出力する AreaState を基に、
 * 現在の自キャラ周辺の文脈・状況に応じた推奨アクション（Recommended Actions）を生成するエンジン
 */

export class ContextActionEngine {
    /**
     * エリア状態 (AreaState) を解析し、推奨可能なアクション一覧を返却
     * @param {Object} areaState - AreaStateManager.getAreaState() の返却値
     * @returns {Array<Object>} 推奨アクションの配列
     */
    static generateActions(areaState) {
        if (!areaState || !areaState.feet) return [];

        const actions = [];
        const feet = areaState.feet;

        // 1. 足元のアクション判定
        if (feet.middle) {
            actions.push({
                id: 'ACTION_PICKUP',
                category: 'INTERACT',
                label: '足元のアイテムを拾う',
                key: ',',
                charStr: ',',
                target: 'feet',
                entity: feet.middle,
                description: '足元に落ちているアイテムをインベントリに入れます'
            });
        }

        // 足元の地形属性判定 (階段など)
        if (feet.bottom && feet.bottom.cmapFlags) {
            const flags = feet.bottom.cmapFlags;
            if (flags.isStairDown) {
                actions.push({
                    id: 'ACTION_STAIR_DOWN',
                    category: 'MOVEMENT',
                    label: '階段を降りる',
                    key: '>',
                    charStr: '>',
                    target: 'feet',
                    description: '下の階層へ移動します'
                });
            } else if (flags.isStairUp) {
                actions.push({
                    id: 'ACTION_STAIR_UP',
                    category: 'MOVEMENT',
                    label: '階段を上る',
                    key: '<',
                    charStr: '<',
                    target: 'feet',
                    description: '上の階層へ移動します'
                });
            }
        }

        // 2. 隣接モンスターへの攻撃判定
        if (areaState.adjacentMonsters && areaState.adjacentMonsters.length > 0) {
            areaState.adjacentMonsters.forEach(m => {
                actions.push({
                    id: `ACTION_ATTACK_${m.dir.code}`,
                    category: 'COMBAT',
                    label: `${m.dir.name}の敵を攻撃`,
                    key: m.dir.key,
                    charStr: m.dir.key,
                    direction: m.dir,
                    entity: m.entity,
                    description: `${m.dir.name} (${m.dir.code}) にいる敵に攻撃します`
                });
            });
        }

        // 3. 隣接する設置物・地形 (ドアなど) へのインタラクト
        if (areaState.adjacentEntities) {
            areaState.adjacentEntities.forEach(item => {
                const b = item.cell.bottom;
                if (b && b.cmapFlags) {
                    const flags = b.cmapFlags;
                    // 閉じた扉 ➔ 「開ける」アクション (o + 方向)
                    if (flags.isClosedDoor) {
                        actions.push({
                            id: `ACTION_OPEN_DOOR_${item.dir.code}`,
                            category: 'INTERACT',
                            label: `${item.dir.name}の扉を開ける`,
                            key: `o${item.dir.key}`,
                            charStr: 'o',
                            directionKey: item.dir.key,
                            direction: item.dir,
                            description: `${item.dir.name}にあるドアを開けます`
                        });
                    }
                    // 開いた扉 ➔ 「閉じる」アクション (c + 方向)
                    else if (flags.isOpenDoor) {
                        actions.push({
                            id: `ACTION_CLOSE_DOOR_${item.dir.code}`,
                            category: 'INTERACT',
                            label: `${item.dir.name}の扉を閉める`,
                            key: `c${item.dir.key}`,
                            charStr: 'c',
                            directionKey: item.dir.key,
                            direction: item.dir,
                            description: `${item.dir.name}にあるドアを閉めます`
                        });
                    }
                }
            });
        }

        return actions;
    }
}
