/**
 * GamepadManager.js - WebUICore ゲームパッド管理モジュール (GpadToKey.js 完全移植＆セマンティック拡張版)
 *
 * HTML5 Gamepad API のポーリング、LB/RB/LT/RT 修飾子判定、
 * 十字キー（D-Pad）専用移動、アナログスティックによる8方向ラジアルパレット認識、
 * YN/MENU/LIN コンテキスト別ボタンアサイン動的オーバーレイ (applyContextOverlay)、
 * および localStorage (nh.gpadAssign) 設定との完全同期を提供する。
 */

import { GPAD_DEFAULT, GPAD_SEMANTIC_DEFAULT, RADIAL_PALETTE_DEFAULT, KEYMAP } from './defaultDefines.js';
import { RadialInputRecognizer } from './RadialInputRecognizer.js';

export class GamepadManager {
    /**
     * @param {Object} [options={}]
     * @param {number} [options.threshold=0.5] - スティック移動判定の閾値
     * @param {boolean} [options.dpadOnlyMove=false] - 十字キーのみを移動に使用するか
     * @param {boolean} [options.useRadialPalette=true] - アナログスティックによるラジアルパレットを有効化するか
     * @param {'right'|'left'} [options.radialStickIndex='right'] - ラジアルパレットに使用するスティック ('right'=axes[2,3], 'left'=axes[0,1])
     * @param {Object} [options.radialPalette] - 8方向ラジアルパレット定義
     * @param {Object} [options.radialOptions] - RadialInputRecognizer オプション
     * @param {boolean} [options.useSemantic=false] - デフォルトで GPAD_SEMANTIC_DEFAULT を使用するか
     * @param {number} [options.repeatDelay=220] - キーリピート開始ディレイ (ms)
     * @param {number} [options.repeatInterval=90] - キーリピート周期 (ms)
     * @param {Object} [options.keyAssign] - カスタムボタン割り当て
     */
    constructor(options = {}) {
        this.threshold = options.threshold || 0.5;
        this.dpadOnlyMove = !!options.dpadOnlyMove;
        this.useRadialPalette = options.useRadialPalette !== false;
        this.radialStickIndex = options.radialStickIndex || 'right';
        this.radialPalette = options.radialPalette || RADIAL_PALETTE_DEFAULT;
        this.useSemantic = !!options.useSemantic;

        this.repeatDelay = options.repeatDelay ?? 220;
        this.repeatInterval = options.repeatInterval ?? 90;

        // キーリピート状態管理用 Map (keyId -> { firstPressedTime, lastTriggeredTime })
        this._buttonRepeatState = new Map();

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

        // ラジアル入力認識器の初期化
        this.radialRecognizer = new RadialInputRecognizer(options.radialOptions || {});

        this.initKeyAssign(options.keyAssign);
    }

    /**
     * ゲームパッド割り当ての初期化 (localStorage -> 渡された設定 -> デフォルト)
     */
    initKeyAssign(customAssign) {
        let buf = null;
        const storageKey = this.useSemantic ? "nh.gpadSemanticAssign" : "nh.gpadAssign";
        if (typeof localStorage !== 'undefined') {
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved) buf = JSON.parse(saved);
            } catch (e) { }
        }

        const fallback = this.useSemantic ? GPAD_SEMANTIC_DEFAULT : GPAD_DEFAULT;
        this.keyAssign = buf || customAssign || fallback;

        if (!buf && typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(storageKey, JSON.stringify(this.keyAssign));
            } catch (e) { }
        }
    }

    /**
     * 文字からキーマップ配列へ逆引き変換
     */
    fCharToKeyArray(char) {
        if (!char) return null;
        const charCode = char.charCodeAt(0);

        for (const [key, codes] of Object.entries(KEYMAP)) {
            if (codes[0] === charCode) return [key];
            if (codes[1] === charCode) return [key, "ShiftLeft"];
            if (codes[2] === charCode) return [key, "ControlLeft"];
        }
        return null;
    }

    /**
     * ラジアルパレットの動的更新
     * @param {Object} newPalette 
     */
    setRadialPalette(newPalette) {
        if (!newPalette || typeof newPalette !== 'object') return;
        this.radialPalette = Object.assign({}, newPalette);
    }

    /**
     * コンテキスト (MODAL_INVENTORY, DIRECTION, YN, MENU, LIN) に応じた動的ボタン割り当てオーバーレイ (applyContextOverlay)
     */
    applyContextOverlay(KA, context, choices) {
        if (!KA) return {};
        const newKA = JSON.parse(JSON.stringify(KA));

        // セマンティック定義に該当コンテキストがある場合、それをオーバーレイ
        if (this.useSemantic && this.keyAssign && this.keyAssign[context]) {
            Object.assign(newKA, JSON.parse(JSON.stringify(this.keyAssign[context])));
            return newKA;
        }

        if (context === "MODAL_INVENTORY" || context === "DIALOG_SAFE") {
            newKA.A = { label: "決定", signal: "SIGNAL:INVENTORY_SELECT" };
            newKA.B = { label: "閉じる", signal: "SIGNAL:INVENTORY_CLOSE" };
            newKA.X = { label: "操作", signal: "SIGNAL:INVENTORY_MENU" };
            newKA.Y = { label: "閉じる", signal: "SIGNAL:INVENTORY_CLOSE" };
            newKA.LB = { label: "前タブ", signal: "SIGNAL:INVENTORY_TAB_PREV" };
            newKA.RB = { label: "次タブ", signal: "SIGNAL:INVENTORY_TAB_NEXT" };
            newKA.UP = { label: "前へ", signal: "SIGNAL:INVENTORY_PREV" };
            newKA.DOWN = { label: "次へ", signal: "SIGNAL:INVENTORY_NEXT" };
            newKA.LEFT = { label: "前頁", signal: "SIGNAL:INVENTORY_PAGE_PREV" };
            newKA.RIGHT = { label: "次頁", signal: "SIGNAL:INVENTORY_PAGE_NEXT" };
        } else if (context === "DIALOG") {
            newKA.A = { label: "決定", signal: "SIGNAL:DIALOG_SUBMIT" };
            newKA.B = { label: "閉じる", signal: "SIGNAL:DIALOG_CANCEL" };
            newKA.X = { label: "決定", signal: "SIGNAL:DIALOG_SUBMIT" };
            newKA.Y = { label: "閉じる", signal: "SIGNAL:DIALOG_CANCEL" };
            newKA.UP = { label: "上へ", signal: "SIGNAL:DIALOG_PREV" };
            newKA.DOWN = { label: "下へ", signal: "SIGNAL:DIALOG_NEXT" };
            newKA.LEFT = { label: "左へ", signal: "SIGNAL:DIALOG_LEFT" };
            newKA.RIGHT = { label: "右へ", signal: "SIGNAL:DIALOG_RIGHT" };
        } else if (context === "DIRECTION") {
            newKA.A = { label: "決定", action: "ACTION:DIRECTION_CONFIRM" };
            newKA.B = { label: "取消", key: ["Escape"] };
            newKA.X = { label: "取消", key: ["Escape"] };
            newKA.Y = { label: "取消", key: ["Escape"] };
        } else if (context === "YN") {
            if (this.useSemantic) {
                newKA.A = { label: "はい (Y)", key: ["KeyY"] };
                newKA.B = { label: "いいえ (N)", key: ["KeyN"] };
                newKA.X = { label: "決定", key: ["Enter"] };
                newKA.Y = { label: "取消", key: ["Escape"] };
            } else if (choices && choices.length > 0) {
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
            newKA.A = { label: "決定", signal: "SIGNAL:DIALOG_SUBMIT", key: ["Enter"] };
            newKA.B = { label: "閉じる", signal: "SIGNAL:DIALOG_CANCEL", key: ["Escape"] };
            newKA.X = { label: "選択切替", signal: "SIGNAL:DIALOG_TOGGLE", key: ["Space"] };
            newKA.Y = { label: "閉じる", signal: "SIGNAL:DIALOG_CANCEL", key: ["Escape"] };
            newKA.UP = { label: "上へ", signal: "SIGNAL:DIALOG_PREV" };
            newKA.DOWN = { label: "下へ", signal: "SIGNAL:DIALOG_NEXT" };
            newKA.LEFT = { label: "左へ", signal: "SIGNAL:DIALOG_LEFT" };
            newKA.RIGHT = { label: "右へ", signal: "SIGNAL:DIALOG_RIGHT" };
        } else if (context === "LIN" || context === "TEXT" || context === "ASKNAME") {
            newKA.A = { label: "決定", signal: "SIGNAL:DIALOG_SUBMIT", key: ["Enter"] };
            newKA.B = { label: "閉じる", signal: "SIGNAL:DIALOG_CANCEL", key: ["Escape"] };
            newKA.X = { label: "決定", signal: "SIGNAL:DIALOG_SUBMIT", key: ["Enter"] };
            newKA.Y = { label: "削除", key: ["Backspace"] };
            newKA.UP = { label: "上へ", signal: "SIGNAL:DIALOG_PREV" };
            newKA.DOWN = { label: "下へ", signal: "SIGNAL:DIALOG_NEXT" };
            newKA.LEFT = { label: "左へ", signal: "SIGNAL:DIALOG_LEFT" };
            newKA.RIGHT = { label: "右へ", signal: "SIGNAL:DIALOG_RIGHT" };
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
     * ボタンの押しっぱなしリピート制御判定
     * @private
     */
    _checkRepeat(btnId, isPressed, now) {
        if (!isPressed) {
            this._buttonRepeatState.delete(btnId);
            return false;
        }

        const state = this._buttonRepeatState.get(btnId);
        if (!state) {
            // 初回押下
            this._buttonRepeatState.set(btnId, { firstPressedTime: now, lastTriggeredTime: now });
            return true;
        }

        const holdTime = now - state.firstPressedTime;
        if (holdTime < this.repeatDelay) {
            return false;
        }

        const sinceLast = now - state.lastTriggeredTime;
        if (sinceLast >= this.repeatInterval) {
            state.lastTriggeredTime = now;
            return true;
        }

        return false;
    }

    /**
     * ポーリングによるキー入力判定（旧仕様互換: 物理キー配列を返却）
     * @param {string} [context='NORMAL'] 
     * @param {string} [choices=''] 
     * @param {number} [now=Date.now()]
     * @returns {Array<string>} 押下キー配列
     */
    pollInput(context = 'NORMAL', choices = '', now = Date.now()) {
        const result = this.pollSemanticInput(context, choices, now);
        return result.keys;
    }

    /**
     * セマンティック・ポーリング判定
     * 物理キー配列に加え、セマンティックアクションやUIシグナル、ラジアルパレットイベントを包括的に返却
     * 
     * @param {string} [context='NORMAL']
     * @param {string} [choices='']
     * @param {number} [now=Date.now()]
     * @returns {{
     *   keys: Array<string>,
     *   actions: Array<string>,
     *   signals: Array<string>,
     *   modifiers: { lb: boolean, rb: boolean, lt: boolean, rt: boolean },
     *   radial: Object
     * }}
     */
    pollSemanticInput(context = 'NORMAL', choices = '', now = Date.now()) {
        const gp = this.getGamepadState();
        const emptyResult = {
            keys: [],
            actions: [],
            signals: [],
            modifiers: { lb: false, rb: false, lt: false, rt: false },
            radial: { state: 'IDLE', currentSector: null, radius: 0, angleDeg: 0, flickTriggered: null, selectedItem: null }
        };

        if (!gp) return emptyResult;

        const keys = [];
        const actions = [];
        const signals = [];

        // スティック軸取得
        const ls_x = gp.axes[0] || 0;
        const ls_y = gp.axes[1] || 0;
        const rs_x = gp.axes[2] || 0;
        const rs_y = gp.axes[3] || 0;

        // D-Pad（十字キー）ボタン判定 (Standard layout: 12=Up, 13=Down, 14=Left, 15=Right)
        const dpad_up = !!(gp.buttons[12] && gp.buttons[12].pressed);
        const dpad_down = !!(gp.buttons[13] && gp.buttons[13].pressed);
        const dpad_left = !!(gp.buttons[14] && gp.buttons[14].pressed);
        const dpad_right = !!(gp.buttons[15] && gp.buttons[15].pressed);

        // 移動入力の取得 (dpadOnlyMove が true の場合は十字キーのみ判定)
        const upkey = this.dpadOnlyMove ? dpad_up : (ls_y < -this.threshold || dpad_up);
        const downkey = this.dpadOnlyMove ? dpad_down : (ls_y > this.threshold || dpad_down);
        const leftkey = this.dpadOnlyMove ? dpad_left : (ls_x < -this.threshold || dpad_left);
        const rightkey = this.dpadOnlyMove ? dpad_right : (ls_x > this.threshold || dpad_right);

        // ボタン判定
        const btn_a = !!(gp.buttons[0] && gp.buttons[0].pressed);
        const btn_b = !!(gp.buttons[1] && gp.buttons[1].pressed);
        const btn_x = !!(gp.buttons[2] && gp.buttons[2].pressed);
        const btn_y = !!(gp.buttons[3] && gp.buttons[3].pressed);

        const btn_lb = !!(gp.buttons[4] && gp.buttons[4].pressed);
        const btn_rb = !!(gp.buttons[5] && gp.buttons[5].pressed);
        const btn_lt = !!(gp.buttons[6] && gp.buttons[6].pressed);
        const btn_rt = !!(gp.buttons[7] && gp.buttons[7].pressed);

        const btn_back = !!(gp.buttons[8] && gp.buttons[8].pressed);
        const btn_start = !!(gp.buttons[9] && gp.buttons[9].pressed);
        const btn_l3 = !!(gp.buttons[10] && gp.buttons[10].pressed);
        const btn_r3 = !!(gp.buttons[11] && gp.buttons[11].pressed);

        const modifiers = { lb: btn_lb, rb: btn_rb, lt: btn_lt, rt: btn_rt };

        // ラジアル入力の処理
        let radialResult = emptyResult.radial;
        if (this.useRadialPalette) {
            const rx = this.radialStickIndex === 'left' ? ls_x : rs_x;
            const ry = this.radialStickIndex === 'left' ? ls_y : rs_y;
            const rUpdate = this.radialRecognizer.update(rx, ry, now);

            let selectedItem = null;
            if (rUpdate.currentSector && this.radialPalette[rUpdate.currentSector]) {
                selectedItem = this.radialPalette[rUpdate.currentSector];
            }

            radialResult = {
                state: rUpdate.state,
                currentSector: rUpdate.currentSector,
                radius: rUpdate.radius,
                angleDeg: rUpdate.angleDeg,
                flickTriggered: rUpdate.flickTriggered,
                selectedItem
            };

            // フリック決定が発生した場合、コマンドをディスパッチ
            if (rUpdate.flickTriggered && rUpdate.flickTriggered.sector) {
                const item = this.radialPalette[rUpdate.flickTriggered.sector];
                if (item) {
                    if (item.action) actions.push(item.action);
                    if (item.signal) signals.push(item.signal);
                    if (item.key) keys.push(...item.key);
                }
            }
        }

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

        const isInventoryContext = (context === "MODAL_INVENTORY" || context === "DIALOG_SAFE");
        const isDialogContext = (context === "DIALOG" || context === "MENU" || context === "LIN" || context === "TEXT" || context === "ASKNAME" || context === "PROMPT");

        // インベントリコンテキスト時の十字キー・LB/RBシグナル変換 & 移動完全遮断 (Fail-Safe)
        if (isInventoryContext) {
            if (this._checkRepeat('INV_UP', upkey, now)) {
                signals.push("SIGNAL:INVENTORY_PREV");
            }
            if (this._checkRepeat('INV_DOWN', downkey, now)) {
                signals.push("SIGNAL:INVENTORY_NEXT");
            }
            if (this._checkRepeat('INV_LEFT', leftkey, now)) {
                signals.push("SIGNAL:INVENTORY_PAGE_PREV");
            }
            if (this._checkRepeat('INV_RIGHT', rightkey, now)) {
                signals.push("SIGNAL:INVENTORY_PAGE_NEXT");
            }
            if (this._checkRepeat('INV_LB', btn_lb, now)) {
                signals.push("SIGNAL:INVENTORY_TAB_PREV");
            }
            if (this._checkRepeat('INV_RB', btn_rb, now)) {
                signals.push("SIGNAL:INVENTORY_TAB_NEXT");
            }

            // 移動キーのリピート状態をクリア
            for (const k of this._buttonRepeatState.keys()) {
                if (k.startsWith('MOVE_')) this._buttonRepeatState.delete(k);
            }
        } else if (isDialogContext) {
            // ダイアログ・メニュー表示時の十字キーシグナル変換 & 移動完全遮断 (Fail-Safe)
            if (this._checkRepeat('DLG_UP', upkey, now)) {
                signals.push("SIGNAL:DIALOG_PREV");
            }
            if (this._checkRepeat('DLG_DOWN', downkey, now)) {
                signals.push("SIGNAL:DIALOG_NEXT");
            }
            if (this._checkRepeat('DLG_LEFT', leftkey, now)) {
                signals.push("SIGNAL:DIALOG_LEFT");
            }
            if (this._checkRepeat('DLG_RIGHT', rightkey, now)) {
                signals.push("SIGNAL:DIALOG_RIGHT");
            }

            // 移動キーのリピート状態をクリア
            for (const k of this._buttonRepeatState.keys()) {
                if (k.startsWith('MOVE_')) this._buttonRepeatState.delete(k);
            }
        } else {
            // 通常時または方向指定時の移動キー判定 (LB斜め制限 & RBダッシュ対応)
            let moveKey = null;
            let dirCode = null;
            const isDiagonal = (upkey || downkey) && (leftkey || rightkey);

            // LBが押されている時は斜め移動のみ受け付け（上下左右単独は無効化）
            const allowMove = !btn_lb || isDiagonal;

            if (allowMove) {
                if (upkey) {
                    if (leftkey) { moveKey = KA.P7 ? KA.P7.key : this.MOVE.UP_L; dirCode = 'NW'; }
                    else if (rightkey) { moveKey = KA.P9 ? KA.P9.key : this.MOVE.UP_R; dirCode = 'NE'; }
                    else { moveKey = KA.P8 ? KA.P8.key : this.MOVE.UP_C; dirCode = 'N'; }
                } else if (downkey) {
                    if (leftkey) { moveKey = KA.P1 ? KA.P1.key : this.MOVE.DOWN_L; dirCode = 'SW'; }
                    else if (rightkey) { moveKey = KA.P3 ? KA.P3.key : this.MOVE.DOWN_R; dirCode = 'SE'; }
                    else { moveKey = KA.P2 ? KA.P2.key : this.MOVE.DOWN_C; dirCode = 'S'; }
                } else {
                    if (leftkey) { moveKey = KA.P4 ? KA.P4.key : this.MOVE.LEFT; dirCode = 'W'; }
                    if (rightkey) { moveKey = KA.P6 ? KA.P6.key : this.MOVE.RIGHT; dirCode = 'E'; }
                }
            }

            if (moveKey) {
                const moveKeyId = Array.isArray(moveKey) ? moveKey.join('+') : String(moveKey);
                if (this._checkRepeat('MOVE_' + moveKeyId, true, now)) {
                    // RB押下時はダッシュ走行 (セマンティックアクション + Gプレフィックス)
                    if (btn_rb && dirCode) {
                        actions.push(`ACTION:DASH_${dirCode}`);
                        keys.push("KeyG", "ShiftLeft");
                        if (Array.isArray(moveKey)) keys.push(...moveKey);
                        else keys.push(moveKey);
                    } else {
                        if (Array.isArray(moveKey)) keys.push(...moveKey);
                        else keys.push(moveKey);
                    }
                }
            } else {
                // 移動キーが入力されていない場合はリピート状態をクリア
                for (const k of this._buttonRepeatState.keys()) {
                    if (k.startsWith('MOVE_')) this._buttonRepeatState.delete(k);
                }
            }
        }

        // ボタンごとのディスパッチ処理ヘルパー
        const dispatchButton = (btnId, isPressed, btnDef) => {
            if (!btnDef) {
                this._checkRepeat(btnId, false, now);
                return;
            }
            if (this._checkRepeat(btnId, isPressed, now)) {
                if (btnDef.action) actions.push(btnDef.action);
                if (btnDef.signal) signals.push(btnDef.signal);
                if (btnDef.key) {
                    if (Array.isArray(btnDef.key)) keys.push(...btnDef.key);
                    else keys.push(btnDef.key);
                }
            }
        };

        // 主要アクションボタン
        dispatchButton('BTN_A', btn_a, KA.A);
        dispatchButton('BTN_B', btn_b, KA.B);
        dispatchButton('BTN_X', btn_x, KA.X);
        dispatchButton('BTN_Y', btn_y, KA.Y);

        dispatchButton('BTN_START', btn_start, KA.START);
        dispatchButton('BTN_BACK', btn_back, KA.BACK);
        dispatchButton('BTN_L3', btn_l3, KA.L3);
        dispatchButton('BTN_R3', btn_r3, KA.R3);

        return {
            keys: keys.filter(Boolean),
            actions,
            signals,
            modifiers,
            radial: radialResult
        };
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
