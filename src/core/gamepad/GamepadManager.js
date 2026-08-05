/**
 * GamepadManager.js - WebUICore ゲームパッド管理モジュール (GpadToKey.js 完全移植版)
 *
 * HTML5 Gamepad API のポーリング、LB/RB/LT/RT 修飾子コンビネーション判定、
 * YN/MENU/LIN コンテキスト別ボタンアサイン自動オーバーレイ (applyContextOverlay)、
 * および localStorage (nh.gpadAssign) 設定との完全同期を提供する。
 */

export class GamepadManager {
    constructor(options = {}) {
        this.threshold = options.threshold || 0.5;

        this.MOVE = {
            UP_L: ["Numpad7"],
            UP_C: ["Numpad8"],
            UP_R: ["Numpad9"],
            LEFT: ["Numpad4"],
            RIGHT: ["Numpad6"],
            DOWN_L: ["Numpad1"],
            DOWN_C: ["Numpad2"],
            DOWN_R: ["Numpad3"],
        };

        this.initKeyAssign(options.keyAssign);
    }

    /**
     * ゲームパッド割り当ての初期化 (localStorage -> 渡された設定 -> rogueDefines.GPAD_DEFAULT)
     */
    initKeyAssign(customAssign) {
        let buf = null;
        if (typeof localStorage !== 'undefined') {
            try {
                const saved = localStorage.getItem("nh.gpadAssign");
                if (saved) buf = JSON.parse(saved);
            } catch (e) { }
        }

        const fallback = (typeof window !== 'undefined' && window.rogueDefines) ? window.rogueDefines().GPAD_DEFAULT : {};
        this.keyAssign = buf || customAssign || fallback;

        if (!buf && typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem("nh.gpadAssign", JSON.stringify(this.keyAssign));
            } catch (e) { }
        }
    }

    /**
     * 文字からキーマップ配列へ逆引き変換
     */
    fCharToKeyArray(char) {
        if (!char || typeof window === 'undefined' || !window.rogueDefines) return null;
        const charCode = char.charCodeAt(0);
        const d = window.rogueDefines();
        if (!d || !d.KEYMAP) return null;

        for (const [key, codes] of Object.entries(d.KEYMAP)) {
            if (codes[0] === charCode) return [key];
            if (codes[1] === charCode) return [key, "ShiftLeft"];
            if (codes[2] === charCode) return [key, "ControlLeft"];
        }
        return null;
    }

    /**
     * コンテキスト (YN, MENU, LIN) に応じた動的ボタン割り当てオーバーレイ (applyContextOverlay)
     */
    applyContextOverlay(KA, context, choices) {
        if (!KA) return {};
        const newKA = JSON.parse(JSON.stringify(KA));

        if (context === "YN") {
            if (choices && choices.length > 0) {
                const cArr = choices.split("");
                const buttons = ["A", "B", "X", "Y"];
                for (let i = 0; i < Math.min(cArr.length, buttons.length); i++) {
                    const char = cArr[i];
                    const key = this.fCharToKeyArray(char);
                    if (key) newKA[buttons[i]] = { label: char, key: key };
                }
            } else {
                newKA.A = { label: "SPC", key: ["Space"] };
            }
        } else if (context === "MENU") {
            newKA.A = { label: "Enter", key: ["Enter"] };
            newKA.B = { label: "ESC", key: ["Escape"] };
            newKA.X = { label: "Space", key: ["Space"] };
        } else if (context === "LIN" || context === "TEXT" || context === "ASKNAME") {
            newKA.X = { label: "Enter", key: ["Enter"] };
            newKA.B = { label: "ESC", key: ["Escape"] };
            newKA.A = { label: "Backsp", key: ["Backspace"] };
        }
        return newKA;
    }

    /**
     * HTML5 Gamepad API から現在の入力状態を取得
     */
    getGamepadState() {
        if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i].connected) {
                return gamepads[i];
            }
        }
        return null;
    }

    /**
     * ポーリングによるキー入力判定
     * @param {string} [context='NORMAL'] 
     * @param {string} [choices=''] 
     * @returns {Array<string>} 押下キー配列
     */
    pollInput(context = 'NORMAL', choices = '') {
        const gp = this.getGamepadState();
        if (!gp) return [];

        const input = [];
        const ls_x = gp.axes[0] || 0;
        const ls_y = gp.axes[1] || 0;

        const upkey = ls_y < -this.threshold || (gp.buttons[12] && gp.buttons[12].pressed);
        const downkey = ls_y > this.threshold || (gp.buttons[13] && gp.buttons[13].pressed);
        const leftkey = ls_x < -this.threshold || (gp.buttons[14] && gp.buttons[14].pressed);
        const rightkey = ls_x > this.threshold || (gp.buttons[15] && gp.buttons[15].pressed);

        const btn_a = gp.buttons[0] && gp.buttons[0].pressed;
        const btn_b = gp.buttons[1] && gp.buttons[1].pressed;
        const btn_x = gp.buttons[2] && gp.buttons[2].pressed;
        const btn_y = gp.buttons[3] && gp.buttons[3].pressed;

        const btn_lb = gp.buttons[4] && gp.buttons[4].pressed;
        const btn_rb = gp.buttons[5] && gp.buttons[5].pressed;
        const btn_lt = gp.buttons[6] && gp.buttons[6].pressed;
        const btn_rt = gp.buttons[7] && gp.buttons[7].pressed;

        const btn_back = gp.buttons[8] && gp.buttons[8].pressed;
        const btn_start = gp.buttons[9] && gp.buttons[9].pressed;
        const btn_l3 = gp.buttons[10] && gp.buttons[10].pressed;
        const btn_r3 = gp.buttons[11] && gp.buttons[11].pressed;

        // 修飾子モード決定
        let mode = "NORMAL";
        if (btn_lb) mode = "LB";
        if (btn_lt) mode = "LT";
        if (btn_rb) mode = "RB";
        if (btn_rt) mode = "RT";

        // コンビネーションオーバーライド
        if (btn_lb && btn_lt) mode = "LB_LT";
        if (btn_rb && btn_rt) mode = "RB_RT";
        if (btn_lb && btn_rb) mode = "LB_RB";
        if (btn_lt && btn_rt) mode = "LT_RT";
        if (btn_lb && btn_rt) mode = "LB_RT";
        if (btn_lt && btn_rb) mode = "LT_RB";

        let KA = this.keyAssign[mode] || this.keyAssign["NORMAL"] || {};

        if (mode === "NORMAL" && context !== "NORMAL") {
            KA = this.applyContextOverlay(KA, context, choices);
        }

        // アナログ/DPad 移動キー判定
        if (upkey) {
            if (leftkey) input.push(KA.P7 ? KA.P7.key : this.MOVE.UP_L);
            else if (rightkey) input.push(KA.P9 ? KA.P9.key : this.MOVE.UP_R);
            else input.push(KA.P8 ? KA.P8.key : this.MOVE.UP_C);
        } else if (downkey) {
            if (leftkey) input.push(KA.P1 ? KA.P1.key : this.MOVE.DOWN_L);
            else if (rightkey) input.push(KA.P3 ? KA.P3.key : this.MOVE.DOWN_R);
            else input.push(KA.P2 ? KA.P2.key : this.MOVE.DOWN_C);
        } else {
            if (leftkey) input.push(KA.P4 ? KA.P4.key : this.MOVE.LEFT);
            if (rightkey) input.push(KA.P6 ? KA.P6.key : this.MOVE.RIGHT);
        }

        // ボタン判定
        if (btn_a && KA.A && KA.A.key) input.push(KA.A.key);
        if (btn_b && KA.B && KA.B.key) input.push(KA.B.key);
        if (btn_x && KA.X && KA.X.key) input.push(KA.X.key);
        if (btn_y && KA.Y && KA.Y.key) input.push(KA.Y.key);

        if (btn_start && KA.START && KA.START.key) input.push(KA.START.key);
        if (btn_back && KA.BACK && KA.BACK.key) input.push(KA.BACK.key);

        if (btn_l3 && KA.L3 && KA.L3.key) input.push(KA.L3.key);
        if (btn_r3 && KA.R3 && KA.R3.key) input.push(KA.R3.key);

        return input.flat().filter(Boolean);
    }

    /**
     * UI ガイド表示用のオーバーレイデータ取得
     */
    getButtonOverlay(context = 'NORMAL', choices = '') {
        const KA = this.applyContextOverlay(this.keyAssign["NORMAL"] || {}, context, choices);
        return {
            A: KA.A ? KA.A.label : "A",
            B: KA.B ? KA.B.label : "B",
            X: KA.X ? KA.X.label : "X",
            Y: KA.Y ? KA.Y.label : "Y",
            context: context
        };
    }
}
