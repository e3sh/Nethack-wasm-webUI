/**
 * AutoTravelService
 * マップセルへのクリック移動 (Click-to-Move / Auto-Travel)、隣接方向トークン導出、
 * モンスター安全保護判定を担当する。
 */
export class AutoTravelService {
    /**
     * @param {import('../GKLPlugin.js').GKLPlugin} plugin
     */
    constructor(plugin) {
        this.plugin = plugin;
    }

    /**
     * 指定されたマップセル (x, y) への安全な自動移動 (Click-to-Move / Auto-Travel) を実行する
     * @param {{x: number, y: number}} targetPos - 目的地座標
     * @param {Object} [options={}] - { avoidMonsters: true }
     * @returns {Promise<boolean>} 移動シーケンス実行の成功の有無
     */
    async travelTo(targetPos, options = {}) {
        const p = this.plugin;
        if (!targetPos || typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number' || !p.core) {
            return false;
        }

        const gx = targetPos.x;
        const gy = targetPos.y;
        if (gx < 0 || gx >= 80 || gy < 0 || gy >= 24) return false;

        const asm = p.areaStateManager;
        const px = (asm && typeof asm.playerX === 'number') ? asm.playerX : 0;
        const py = (asm && typeof asm.playerY === 'number') ? asm.playerY : 0;

        const dx = gx - px;
        const dy = gy - py;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));

        const travelOptions = {
            isSilentSync: true,
            suppressPrompts: true,
            ...options
        };

        // 👤 自キャラマスをクリックした場合は 待機（'.'）を実行
        if (dist === 0) {
            return p.executeSequence(['.'], travelOptions);
        }

        // 1. セル情報・ナレッジ情報の確認
        const cardData = await p.inspectCellOnDemand({ x: gx, y: gy }, { isHover: true });

        // 2. モンスター安全保護 (avoidMonsters が true の場合はモンスターマスへの移動を防止)
        const avoidMonsters = options.avoidMonsters !== undefined ? options.avoidMonsters : true;
        const isMonster = cardData && (cardData.dangerLevel || cardData.category === 'MONSTER' || cardData.dispositionStatus);
        if (avoidMonsters && isMonster) {
            return false;
        }

        // 3. 通行可能性・アイテム判定
        const areaState = asm ? asm.getAreaState() : null;
        const grid = areaState ? areaState.grid : null;
        const cell = (grid && grid[gy]) ? grid[gy][gx] : null;

        const isItemOrCorpse = cardData && (
            cardData.category === 'WEAPON' || cardData.category === 'ARMOR' ||
            cardData.category === 'RING' || cardData.category === 'AMULET' ||
            cardData.category === 'CONTAINER' || cardData.category === 'TOOL' ||
            cardData.category === 'FOOD' || cardData.category === 'POTION' ||
            cardData.category === 'SCROLL' || cardData.category === 'SPELLBOOK' ||
            cardData.category === 'WAND' || cardData.category === 'COIN' ||
            cardData.category === 'GEM' || cardData.category === 'GOLD' ||
            cardData.category === 'FOOD' || cardData.category === 'CORPSE' ||
            cardData.category === 'BODY' || cardData.category === 'ITEM' ||
            cardData.category === 'OTHER' || (cell && cell.middle)
        );

        const isWallOrVoid = cell && cell.bottom && (
            cell.bottom.isWall || cell.bottom.rawGlyph >= 9622
        );

        if (isWallOrVoid && !isItemOrCorpse) return false;

        // 方向トークンマップ
        const dirTokenMap = {
            '-1,-1': 'DIR_NW', '0,-1': 'DIR_N', '1,-1': 'DIR_NE',
            '-1,0':  'DIR_W',                   '1,0':  'DIR_E',
            '-1,1':  'DIR_SW', '0,1':  'DIR_S', '1,1':  'DIR_SE'
        };

        // 4. 移動実行
        if (dist === 1) {
            // 隣接8マス移動
            const token = dirTokenMap[`${dx},${dy}`];
            if (token) {
                return p.executeSequence([token], travelOptions);
            }
        } else if (dist > 1) {
            // 遠隔 Auto-Travel シーケンス一括投入
            // '_': トラベル開始 ➔ '@': 自キャラ位置へリセット ➔ DIR_*: 相対移動 ➔ '.': 確定
            const seqTokens = ['_', '@'];
            let curX = px;
            let curY = py;
            while (curX !== gx || curY !== gy) {
                const stepX = Math.sign(gx - curX);
                const stepY = Math.sign(gy - curY);

                const token = dirTokenMap[`${stepX},${stepY}`];
                if (token) {
                    seqTokens.push(token);
                    curX += stepX;
                    curY += stepY;
                } else {
                    break;
                }
            }
            seqTokens.push('.');

            return p.executeSequence(seqTokens, travelOptions);
        }

        return false;
    }
}
