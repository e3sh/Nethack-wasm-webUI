/**
 * @class inputKeyboard2
 * @description YouTube停止対策・パッシブ化＆長押しスキップを導入した軽量版 inputKeyboard
 * coremin.js の inputKeyboard と100%完全な互換性を持ちます。
 */
class inputKeyboard2 {
    constructor(codeModeFlag = true) {
        let keyCodes = [], eventCodes = [];
        let isCodeMode = codeModeFlag;

        const resetKeys = () => {
            this.upkey = false; this.downkey = false;
            this.leftkey = false; this.rightkey = false;
            this.shift = false; this.ctrl = false; this.alt = false; this.space = false;
            this.qkey = false; this.wkey = false; this.ekey = false;
            this.akey = false; this.skey = false; this.dkey = false;
            this.zkey = false; this.xkey = false; this.ckey = false;
        };

        resetKeys();

        // ウィンドウフォーカス外れ時に全クリア
        window.addEventListener("blur", () => {
            keyCodes = [];
            eventCodes = [];
        }, { passive: true });

        // パッシブ＋repeatスキップ付きのキーダウンリスナー
        window.addEventListener("keydown", (e) => {
            if (e.repeat) return; // ★長押し連打時は処理を即座にスキップして超軽量化
            keyCodes[e.keyCode] = true;
            eventCodes[e.code] = true;
        }, { passive: true });

        // キーアップリスナー
        window.addEventListener("keyup", (e) => {
            keyCodes[e.keyCode] = false;
            eventCodes[e.code] = false;
        }, { passive: true });

        // 元クラスと完全に同じインターフェース
        this.check = function () {
            resetKeys();
            const n = isCodeMode ? eventCodes : keyCodes;
            for (let k in n) {
                switch (k) {
                    case "16": case "ShiftLeft": case "ShiftRight": this.shift = n[k]; break;
                    case "17": case "ControlLeft": case "ControlRight": this.ctrl = n[k]; break;
                    case "18": case "AltLeft": case "AltRight": this.alt = n[k]; break;
                    case "32": case "Space": this.space = n[k]; break;
                    case "38": case "ArrowUp": this.upkey = n[k]; break;
                    case "40": case "ArrowDown": this.downkey = n[k]; break;
                    case "37": case "ArrowLeft": this.leftkey = n[k]; break;
                    case "39": case "ArrowRight": this.rightkey = n[k]; break;
                    case "65": case "KeyA": this.akey = n[k]; break;
                    case "67": case "KeyC": this.ckey = n[k]; break;
                    case "68": case "KeyD": this.dkey = n[k]; break;
                    case "69": case "KeyE": this.ekey = n[k]; break;
                    case "81": case "KeyQ": this.qkey = n[k]; break;
                    case "83": case "KeyS": this.skey = n[k]; break;
                    case "87": case "KeyW": this.wkey = n[k]; break;
                    case "88": case "KeyX": this.xkey = n[k]; break;
                    case "90": case "KeyZ": this.zkey = n[k]; break;
                }
            }
            return n;
        };

        this.state = function () {
            return isCodeMode ? eventCodes : keyCodes;
        };

        this.inquiryKey = function (k) {
            const st = this.state();
            return Boolean(st[k]) && st[k];
        };

        this.codeMode = function (flag = true) {
            isCodeMode = flag;
        };
    }
}
