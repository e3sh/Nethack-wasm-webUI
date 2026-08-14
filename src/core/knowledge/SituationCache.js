/**
 * SituationCache.js
 * Game Knowledge Layer (GKL) の統合状況キャッシュ・高級アクセサ
 *
 * StatusAccessor (ステータス/状態異常/空腹等)、InventoryStateManager (所持品/ツール等)、
 * AreaStateManager (周辺マップ/グリフ/位置情報) を統一ファサードとして一括束ね、
 * UI クライアント（常時表示ボタン、独自ステータス UI 等）や AI Agent に
 * 「現在のゲーム統合状況 (Situation)」をワンストップで提供する。
 */

export class SituationCache {
    /**
     * @param {Object} [statusAccessor=null] - StatusAccessor インスタンス
     * @param {Object} [inventoryStateManager=null] - InventoryStateManager インスタンス
     * @param {Object} [areaStateManager=null] - AreaStateManager インスタンス
     * @param {Object} [actionEngineClass=null] - ContextActionEngine クラス
     */
    constructor(statusAccessor = null, inventoryStateManager = null, areaStateManager = null, actionEngineClass = null) {
        this.statusAccessor = statusAccessor;
        this.inventoryStateManager = inventoryStateManager;
        this.areaStateManager = areaStateManager;
        this.actionEngineClass = actionEngineClass;
    }

    /**
     * コンポーネントのアタッチ
     */
    attach({ statusAccessor, inventoryStateManager, areaStateManager, actionEngineClass }) {
        if (statusAccessor) this.statusAccessor = statusAccessor;
        if (inventoryStateManager) this.inventoryStateManager = inventoryStateManager;
        if (areaStateManager) this.areaStateManager = areaStateManager;
        if (actionEngineClass) this.actionEngineClass = actionEngineClass;
    }

    /**
     * 現在のゲーム統合状況 (Situation) を一括取得
     * @returns {Object} { status, inventory, area, tools, actions }
     */
    getSituation() {
        const status = this.statusAccessor && typeof this.statusAccessor.getStatus === 'function' ?
            this.statusAccessor.getStatus() : {};

        const inventoryState = this.inventoryStateManager;
        const inventoryItems = inventoryState ? inventoryState.items || [] : [];
        const isInventorySynced = inventoryState ? Boolean(inventoryState.isSynced) : false;

        const areaState = this.areaStateManager && typeof this.areaStateManager.getAreaState === 'function' ?
            this.areaStateManager.getAreaState() : {};

        // ツール抽出
        const tools = {
            pickAxe: inventoryState && typeof inventoryState.getPickAxe === 'function' ? inventoryState.getPickAxe() : null,
            key: inventoryState && typeof inventoryState.getKeyOrLockPick === 'function' ? inventoryState.getKeyOrLockPick() : null,
            axe: inventoryState && typeof inventoryState.getAxe === 'function' ? inventoryState.getAxe() : null,
            frostWand: inventoryState && typeof inventoryState.getFrostWand === 'function' ? inventoryState.getFrostWand() : null
        };

        // 装備状態マップの抽出 (二刀流/武器/矢筒/防具)
        const equipment = inventoryState && typeof inventoryState.getEquipmentMap === 'function' ?
            inventoryState.getEquipmentMap() : { weapon: null, offhand: null, isTwoWeapon: false, quiver: null, wornList: [], equippedList: [] };

        // 推奨アクションの自動計算 (ContextActionEngine が設定されている場合)
        let actions = [];
        if (this.actionEngineClass && typeof this.actionEngineClass.generateActions === 'function') {
            actions = this.actionEngineClass.generateActions(areaState, inventoryState);
        }

        return {
            status,
            inventory: {
                items: inventoryItems,
                isSynced: isInventorySynced
            },
            equipment,
            area: areaState,
            tools,
            actions
        };
    }
}

