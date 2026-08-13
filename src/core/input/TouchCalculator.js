/**
 * TouchCalculator.js - WebUICore タッチ/仮想Pad管理モジュール (inputGridPad.js 完全移植版)
 *
 * 960x600 基準解像度 ＆ 12x9 (DWxDH) グリッド構造、
 * object-fit: contain 時の左右/上下黒枠オフセット補正、
 * および コンテキストページ (Center, Left, Right, YN, MENU, LIN) 管理を提供する。
 */

import { TOUCH_DEFAULT } from './defaultDefines.js';

export class TouchCalculator {
    constructor(options = {}) {
        this.ResoX = options.resoX || 960;
        this.ResoY = options.resoY || 600;
        this.DW = options.dw || 12;
        this.DH = options.dh || 9;

        this.CW = this.ResoX / this.DW;
        this.CH = this.ResoY / this.DH;

        this.currentPage = "Center";
        this.currentContext = "NORMAL";

        this.initTouchConfig(options.touchConfig);
    }

    /**
     * タッチ設定の初期化 (localStorage -> 渡された設定 -> TOUCH_DEFAULT)
     */
    initTouchConfig(customConfig) {
        let saved = null;
        if (typeof localStorage !== 'undefined') {
            try {
                const data = localStorage.getItem("nh.tpadAssign");
                if (data) {
                    const parsed = JSON.parse(data);
                    if (parsed && parsed.ver === `${this.DW}x${this.DH}`) {
                        saved = parsed;
                    }
                }
            } catch (e) { }
        }

        const fallback = TOUCH_DEFAULT;
        this.config = saved || customConfig || fallback;

        if (!saved && typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem("nh.tpadAssign", JSON.stringify(this.config));
            } catch (e) { }
        }
    }

    /**
     * pageX, pageY タッチ座標から 960x600 内のグリッド ID (0 ~ DW*DH-1) を正確に計算 (アスペクト比黒枠補正対応)
     */
    pointToGridId(pageX, pageY, targetRect, scrollX = 0, scrollY = 0) {
        if (!targetRect) return -1;

        const relativeX = pageX - (targetRect.left + scrollX);
        const relativeY = pageY - (targetRect.top + scrollY);

        const gameAspect = this.ResoX / this.ResoY;
        const viewAspect = targetRect.width / targetRect.height;

        let actualWidth, actualHeight, offsetX, offsetY;
        if (viewAspect > gameAspect) {
            // 左右に黒枠
            actualHeight = targetRect.height;
            actualWidth = targetRect.height * gameAspect;
            offsetX = (targetRect.width - actualWidth) / 2;
            offsetY = 0;
        } else {
            // 上下に黒枠
            actualWidth = targetRect.width;
            actualHeight = targetRect.width / gameAspect;
            offsetX = 0;
            offsetY = (targetRect.height - actualHeight) / 2;
        }

        const xInGame = (relativeX - offsetX) * (this.ResoX / actualWidth);
        const yInGame = (relativeY - offsetY) * (this.ResoY / actualHeight);

        if (xInGame < 0 || xInGame >= this.ResoX || yInGame < 0 || yInGame >= this.ResoY) {
            return -1;
        }

        return Math.floor(xInGame / this.CW) + Math.floor(yInGame / this.CH) * this.DW;
    }

    /**
     * コンテキスト更新
     */
    setContext(context) {
        this.currentContext = context || "NORMAL";
        if (context === "NORMAL") this.currentPage = "Center";
        else if (context === "YN") this.currentPage = "YN";
        else if (context === "MENU") this.currentPage = "MENU";
        else if (context === "LIN" || context === "TEXT" || context === "ASKNAME") this.currentPage = "LIN";
    }

    /**
     * グリッド ID からキー操作名/アサインを取得
     * @param {number} gridId 
     * @returns {string|Array<string>|null}
     */
    gridIdToKey(gridId) {
        if (gridId < 0 || gridId >= this.DW * this.DH) return null;

        const pageConfig = this.config[this.currentPage] || this.config["Center"];
        if (pageConfig && pageConfig[gridId]) {
            const action = pageConfig[gridId].action;
            if (action) return action;
        }

        // デフォルトフォールバック (8方向移動グリッド)
        const row = Math.floor(gridId / this.DW);
        const col = gridId % this.DW;

        // 右下テンキーエリア等のデフォルト動作
        if (row >= 6 && col >= 9) {
            const numPadMap = {
                "6,9": "Numpad7", "6,10": "Numpad8", "6,11": "Numpad9",
                "7,9": "Numpad4", "7,10": "Numpad5", "7,11": "Numpad6",
                "8,9": "Numpad1", "8,10": "Numpad2", "8,11": "Numpad3",
            };
            const keyStr = `${row},${col}`;
            if (numPadMap[keyStr]) return numPadMap[keyStr];
        }

        return null;
    }
}
