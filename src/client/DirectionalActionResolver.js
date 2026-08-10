/**
 * DirectionalActionResolver.js
 * 
 * 入力された方向キー（N, E, S, W または h,j,k,l,y,u,b,n）に対し、
 * 周辺エリア状態 (AreaState) とインベントリ状態 (InventoryState) を照合し、
 * ・通常移動が可能か (isWalkable)
 * ・単押し時の最優先スマートアクション (primaryAction)
 * ・長押し/メニュー用の全利用可能アクション (availableActions)
 * を解決するリゾルバークラス。
 */

import { ContextActionEngine } from '../core/knowledge/ContextActionEngine.js';

export class DirectionalActionResolver {
    /**
     * 方向キー入力を解析・解決
     * @param {string} dirCode - 方向コード ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW' または 'k', 'u', 'l', 'n', 'j', 'b', 'h', 'y')
     * @param {Object} areaState - AreaStateManager.getAreaState()
     * @param {Object} [inventoryState] - InventoryStateManager インスタンス
     * @returns {Object} 解決結果 { dirCode, dirKey, isWalkable, primaryAction, availableActions }
     */
    static resolveDirection(dirCode, areaState, inventoryState = null) {
        if (!areaState || !areaState.feet) {
            return { isWalkable: true, primaryAction: null, availableActions: [] };
        }

        // 方向コードの正規化
        const dirInfo = this.normalizeDirection(dirCode);
        if (!dirInfo) {
            return { isWalkable: true, primaryAction: null, availableActions: [] };
        }

        // 周辺の全推奨アクションを生成
        const allActions = ContextActionEngine.generateActions(areaState, inventoryState);

        // 指定方向に関連するアクションのみをフィルタリング
        const availableActions = allActions.filter(act => {
            if (act.directionKey === dirInfo.key) return true;
            if (act.direction && act.direction.code === dirInfo.code) return true;
            return false;
        });

        // 対象セルの通行可能性（床・開いたドア・階段等は移動可能、壁・閉じたドア・水・敵等は移動不可）
        const targetCell = this.findTargetCell(dirInfo.code, areaState);
        const isWalkable = this.checkWalkable(targetCell);

        // 最優先アクション（シングルタップ/単押し用）の選定
        let primaryAction = null;
        if (!isWalkable && availableActions.length > 0) {
            // 移動不可かつ利用可能アクションが存在する場合、最高優先度のものをプライマリアクションとする
            primaryAction = availableActions[0];
        }

        return {
            dirCode: dirInfo.code,
            dirKey: dirInfo.key,
            dirName: dirInfo.name,
            targetCell,
            isWalkable,
            primaryAction,
            availableActions
        };
    }

    /**
     * 方向コードの正規化 (viキー / 抽象コード -> 統一オブジェクト)
     */
    static normalizeDirection(dirInput) {
        const keyMap = {
            'k': { code: 'N', key: 'k', name: '北' },
            'u': { code: 'NE', key: 'u', name: '北東' },
            'l': { code: 'E', key: 'l', name: '東' },
            'n': { code: 'SE', key: 'n', name: '南東' },
            'j': { code: 'S', key: 'j', name: '南' },
            'b': { code: 'SW', key: 'b', name: '南西' },
            'h': { code: 'W', key: 'h', name: '西' },
            'y': { code: 'NW', key: 'y', name: '北西' },

            'N': { code: 'N', key: 'k', name: '北' },
            'NE': { code: 'NE', key: 'u', name: '北東' },
            'E': { code: 'E', key: 'l', name: '東' },
            'SE': { code: 'SE', key: 'n', name: '南東' },
            'S': { code: 'S', key: 'j', name: '南' },
            'SW': { code: 'SW', key: 'b', name: '南西' },
            'W': { code: 'W', key: 'h', name: '西' },
            'NW': { code: 'NW', key: 'y', name: '北西' }
        };
        return keyMap[dirInput] || null;
    }

    /**
     * 指定方向のセルを取得
     */
    static findTargetCell(dirCode, areaState) {
        if (!areaState.adjacentEntities) return null;
        const found = areaState.adjacentEntities.find(e => e.dir && e.dir.code === dirCode);
        return found ? found.cell : null;
    }

    /**
     * セルの移動可能性（Walkable）判定
     */
    static checkWalkable(cell) {
        if (!cell) return true;

        // モンスター/ペットが存在する場合
        if (cell.top && (cell.top.type === 'MONSTER' || cell.top.type === 'PET')) {
            return false;
        }

        // 地形判定
        if (cell.bottom && cell.bottom.cmapFlags) {
            const flags = cell.bottom.cmapFlags;
            if (flags.isWall || flags.isClosedDoor || flags.isTree || flags.isIronBars || flags.isWater || flags.isLava) {
                return false;
            }
        }
        return true;
    }
}
