/**
 * InspectionService
 * マップセル調査 (inspectCellOnDemand)、自キャラのリアルタイムステータスカード生成、
 * オンデマンド Look 連携、およびフォーカスカメラ・ズームビュー用のタイル配列導出を担当する。
 */
export class InspectionService {
    /**
     * @param {import('../GKLPlugin.js').GKLPlugin} plugin
     */
    constructor(plugin) {
        this.plugin = plugin;
    }

    /**
     * 指定されたマップセル (x, y) に対し、自キャラ判別、Look不要判定、オンデマンドLook実行、および動的状態キャッシュ適用を
     * 全自動でカプセル処理した統一構造化ナレッジデータを返す
     * @param {{x: number, y: number}} targetPos
     * @param {Object} [options={}]
     * @returns {Promise<Object|null>} 構造化ナレッジカードデータ
     */
    async inspectCellOnDemand(targetPos, options = {}) {
        if (!targetPos || typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
            return null;
        }

        const p = this.plugin;
        const asm = p.areaStateManager;
        const playerX = (asm && typeof asm.playerX === 'number') ? asm.playerX : 0;
        const playerY = (asm && typeof asm.playerY === 'number') ? asm.playerY : 0;

        // 👤 1. プレイヤー自身 (px === tx && py === ty) の場合: リアルタイム最新ステータスを含む構造化カードを即座に生成
        if (targetPos.x === playerX && targetPos.y === playerY) {
            const st = p.statusAccessor ? p.statusAccessor.getStatus() : {};
            const invManager = p.inventoryStateManager;
            const invItems = invManager ? (typeof invManager.getItems === 'function' ? invManager.getItems() : (invManager.items || [])) : [];
            const hpCur = (typeof st.hp === 'object' && st.hp !== null) ? (st.hp.current ?? st.hp.val ?? 0) : (st.hp ?? 0);
            const hpMax = (typeof st.hp === 'object' && st.hp !== null) ? (st.hp.max ?? st.hpmax ?? 0) : (st.hpmax ?? st.maxhp ?? 0);
            const hpStr = `${hpCur}/${hpMax}`;

            const pwCur = (typeof st.pw === 'object' && st.pw !== null) ? (st.pw.current ?? st.pw.val ?? 0) : (st.pw ?? 0);
            const pwMax = (typeof st.pw === 'object' && st.pw !== null) ? (st.pw.max ?? st.pwmax ?? 0) : (st.pwmax ?? st.maxpw ?? 0);
            const pwStr = `${pwCur}/${pwMax}`;

            const goldVal = (typeof st.gold === 'object' && st.gold !== null) ? (st.gold.amount ?? st.gold.current ?? st.gold.val ?? st.gold.gold ?? 0) : (st.gold ?? 0);

            const selfCell = asm?.grid?.[playerY]?.[playerX];
            const selfIsPile = Boolean(selfCell?.middle?.isPile || selfCell?.middle?.glyphInfo?.isPile);

            const playerKnowledge = {
                name: st.name ? `${st.name} (${st.role || 'Hero'})` : '自分 (Player)',
                category: 'PLAYER',
                isPlayer: true,
                ...(selfIsPile ? { isPile: true } : {}),
                dangerLevel: 'NONE',
                dispositionStatus: 'PLAYER',
                stats: {
                    hd: `Lv.${st.level || 1}`,
                    ac: st.ac !== undefined ? `AC ${st.ac}` : 'AC 10',
                    speed: 'Self',
                    mr: 0,
                    hp: hpStr,
                    pw: pwStr,
                    gold: `${goldVal}zm`,
                    dlvl: `Dlvl:${st.dlvl || 1}`
                },
                statusConditions: st.conditions || [],
                inventoryCount: invItems.length,
                effectSummary: `操作中のプレイヤー自身です。HP: ${hpStr}, AC: ${st.ac ?? 10}, 所持金: ${goldVal}zm.`
            };
            return playerKnowledge;
        }

        // 🎯 2. プレイヤー以外のマス: AreaStateManager の 3レイヤーセルを参照
        const cell = asm?.grid?.[targetPos.y]?.[targetPos.x];
        const hasMonster = cell?.top && (cell.top.type === 'MONSTER' || cell.top.type === 'PET');

        // モンスターが存在せず、地形やアイテムのみの場合: ホバー・クリック問わず即座にナレッジを返却
        if (!hasMonster) {
            if (cell?.middle && !cell.middle.directObject && p.wasmDirectBindingService && typeof p.wasmDirectBindingService.fetchObjectsAt === 'function') {
                try {
                    const floorObjs = await p.wasmDirectBindingService.fetchObjectsAt(targetPos.x, targetPos.y);
                    if (Array.isArray(floorObjs) && floorObjs.length > 0) {
                        cell.middle.directObject = floorObjs[0];
                        cell.middle.floorObjects = floorObjs;
                        cell.middle.isPile = floorObjs.length > 1 || Boolean(cell.middle.isPile);
                        cell.middle.extraPileCount = Math.max(0, floorObjs.length - 1);
                        asm?.markDirty?.(targetPos.x, targetPos.y);
                    }
                } catch (e) {
                    // 非同期取得失敗時はフォールバック継続
                }
            }

            const targetEntity = cell?.middle || cell?.bottom;
            if (!targetEntity) return null;
            const isPile = Boolean(targetEntity.isPile || targetEntity.glyphInfo?.isPile);
            const knowledge = p.structuredKnowledge.getKnowledge(targetEntity, {
                language: p.language,
                sagesWisdomMode: p.sagesWisdomMode,
                isPile,
                extraPileCount: targetEntity.extraPileCount ?? 0,
                directObject: targetEntity.directObject,
                floorObjects: targetEntity.floorObjects
            });
            if (!knowledge) return null;
            return {
                ...knowledge,
                ...(isPile || knowledge.isPile ? { isPile: true } : {}),
                ...(targetEntity.extraPileCount !== undefined ? { extraPileCount: targetEntity.extraPileCount } : {}),
                ...(targetEntity.floorObjects ? { floorObjects: targetEntity.floorObjects } : {}),
                ...(targetEntity.directObject ? { directObject: targetEntity.directObject } : {}),
                isClickConfirmed: !options.isHover
            };
        }

        // 🐉 モンスターが存在する場合:
        // 1. C コア Direct Binding (WasmDirectBindingService) から確定状態を直接照会
        const dbs = p.directBindingService || p.areaStateManager?.directBindingService;
        let directMon = null;
        if (dbs && typeof dbs.getFullMonsterAt === 'function' && (typeof dbs.isAvailable !== 'function' || dbs.isAvailable())) {
            directMon = dbs.getFullMonsterAt(targetPos.x, targetPos.y);
        }

        let dynamicState = cell.top.dynamicState || null;

        if (directMon) {
            // 🎯 Direct Binding で確定真値が取れた場合: オンデマンド Look (;) は完全にスキップ！
            dynamicState = {
                ...(cell.top.dynamicState || {}),
                hp: directMon.hp,
                hpmax: directMon.hpmax,
                isPeaceful: directMon.peaceful,
                isTamed: directMon.tame,
                isHostile: !directMon.peaceful && !directMon.tame,
                sleeping: directMon.sleeping,
                fleeing: directMon.fleeing,
                paralyzed: directMon.paralyzed,
                confused: directMon.confused,
                stunned: directMon.stunned,
                isShopkeeper: directMon.isShopkeeper,
                isPriest: directMon.isPriest,
                hasResult: true,
                fromDirectBinding: true
            };
            cell.top.directState = directMon;
            cell.top.dynamicState = dynamicState;
            cell.top.isTame = directMon.tame;
            cell.top.isPeaceful = directMon.peaceful;
            if (directMon.tame) {
                cell.top.type = 'PET';
            }
        } else if ((!dynamicState || !dynamicState.hasResult || !options.isHover) && p.lookService) {
            // 2. Direct Binding が利用できないフォールバック時のみ、オンデマンド Look (;) を実行
            const freshState = await p.lookService.executeLook({ x: playerX, y: playerY }, targetPos);
            if (freshState && freshState.hasResult) {
                const isKnownTame = Boolean(cell.top.isTame || cell.top.directState?.tame || cell.top.dynamicState?.isTamed);
                const isKnownPeaceful = Boolean(cell.top.isPeaceful || cell.top.directState?.peaceful || cell.top.dynamicState?.isPeaceful);
                dynamicState = {
                    ...freshState,
                    ...(cell.top.dynamicState || {}),
                    isPeaceful: isKnownPeaceful || freshState.isPeaceful,
                    isTamed: isKnownTame || freshState.isTamed,
                    isHostile: (isKnownTame || isKnownPeaceful) ? false : freshState.isHostile
                };
                cell.top.dynamicState = dynamicState;
            } else if (!dynamicState) {
                dynamicState = freshState;
            }
        }

        const identifier = (typeof cell.top.glyph === 'number') ? cell.top.glyph : (cell.top.monOffset ?? cell.top);
        const isPet = Boolean(
            cell.top.type === 'PET' ||
            cell.top.isPet ||
            cell.top.isTame ||
            cell.top.directState?.tame ||
            cell.top.dynamicState?.isTamed ||
            dynamicState?.isTamed
        );
        const data = p.structuredKnowledge.getMonsterKnowledge(identifier, {
            dynamicState,
            isPet,
            language: p.language
        });

        return {
            ...data,
            isClickConfirmed: !!dynamicState
        };
    }

    /**
     * フォーカスカメラ・ズームビュー用の整形済みタイル一覧を取得
     * @param {number} [radiusX=10] - 横方向半径 (例: 10 => 21マス)
     * @param {number} [radiusY=4] - 縦方向半径 (例: 4 => 9マス)
     * @param {Object} [options={}] - オプション
     * @returns {Array<Object>} 整形済みタイル配列
     */
    getFocusCameraTiles(radiusX = 10, radiusY = 4, options = {}) {
        const p = this.plugin;
        if (!p.areaStateManager || typeof p.areaStateManager.getFocusCameraTiles !== 'function') {
            return [];
        }
        const glyphGridBuffer = (p.core && p.core.driver && typeof p.core.driver.getGlyphBuffer === 'function')
            ? p.core.driver.getGlyphBuffer()
            : null;

        return p.areaStateManager.getFocusCameraTiles(radiusX, radiusY, {
            glyphGridBuffer,
            structuredKnowledge: p.structuredKnowledge,
            language: p.language,
            isDead: p._isPlayerDead,
            ...options
        });
    }
}
