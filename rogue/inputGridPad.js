class inputGridPad {

    constructor(element, g) {

        const target = document.getElementById(element);
        //const log = {};
        let viewf;

        const ResoX = 960;//target.clientWidth; console.log(ResoX);
        const ResoY = 600;//target.clientHeight;  console.log(ResoY);

        const DW = 10; //横分割数
        const DH = 7; //縦分割数

        const CW = ResoX / DW;
        const CH = ResoY / DH;

        // --- 汎用フルスクリーン関数の定義 ---
        const isFullscreenAvailable = () => {
            return !!(document.fullscreenEnabled ||
                document.webkitFullscreenEnabled ||
                document.mozFullScreenEnabled ||
                document.msFullscreenEnabled);
        };

        const getFullscreenElement = () => {
            return document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement;
        };

        const requestFullscreen = (el) => {
            const requestMethod = el.requestFullscreen ||
                el.webkitRequestFullscreen ||
                el.mozRequestFullScreen ||
                el.msRequestFullscreen;
            if (requestMethod) {
                return requestMethod.call(el);
            }
            return Promise.reject(new Error("Fullscreen API not supported"));
        };
        // ----------------------------------

        let pos = -1;
        let entryResult = -1;
        let lastResult;
        let grid = [];

        const closewait = 500;
        let entrytime = 0;

        const PosToGridId = (pageX, pageY) => {
            const rect = target.getBoundingClientRect();

            // 1. 要素内の相対座標
            const relativeX = pageX - rect.left - window.scrollX;
            const relativeY = pageY - rect.top - window.scrollY;

            // 2. Safe Area (padding) の取得
            const style = window.getComputedStyle(target);
            const pL = parseFloat(style.paddingLeft) || 0;
            const pT = parseFloat(style.paddingTop) || 0;
            const pR = parseFloat(style.paddingRight) || 0;
            const pB = parseFloat(style.paddingBottom) || 0;

            // 3. コンテンツ利用可能領域 (paddingを除いた内側のサイズ)
            const availableW = rect.width - pL - pR;
            const availableH = rect.height - pT - pB;

            if (availableW <= 0 || availableH <= 0) return -1;

            // 4. アスペクト比の比較 (内部 960x600 = 1.6)
            const gameAspect = ResoX / ResoY;
            const contentAspect = availableW / availableH;

            let actualW, actualH, offsetX, offsetY;

            if (contentAspect > gameAspect) {
                // コンテンツ領域がゲームより横長 -> 左右に黒枠ができる
                actualH = availableH;
                actualW = availableH * gameAspect;
                offsetX = pL + (availableW - actualW) / 2;
                offsetY = pT;
            } else {
                // コンテンツ領域がゲームより縦長 -> 上下に黒枠ができる
                actualW = availableW;
                actualH = availableW / gameAspect;
                offsetX = pL;
                offsetY = pT + (availableH - actualH) / 2;
            }

            // 5. 実際の表示領域（actualW x actualH）との相対座標へ変換
            const xInGame = relativeX - offsetX;
            const yInGame = relativeY - offsetY;

            // 6. 内部解像度 (960x600) へのスケーリング
            const scaledX = xInGame * (ResoX / actualW);
            const scaledY = yInGame * (ResoY / actualH);

            // 7. 境界チェック
            if (scaledX < 0 || scaledX >= ResoX || scaledY < 0 || scaledY >= ResoY) return -1;

            return Math.floor(scaledX / CW) + Math.floor(scaledY / CH) * DW
        }
        const resetLamp = () => {
            for (let i in grid) grid[i].on = false;
        }

        const handleStart = (x, y) => {
            viewf = true;
            entryResult = -1;
            pos = PosToGridId(x, y);
            if (pos >= 0) {
                resetLamp();
                grid[pos].on = true;
            }
        };

        const handleMove = (x, y) => {
            if (!viewf) return;
            pos = PosToGridId(x, y);
            resetLamp();
            if (pos >= 0) {
                grid[pos].on = true;
            }
        };

        const handleEnd = () => {
            for (let i in grid) {
                grid[i].on = false;
            }
            if (pos >= 0) {
                //内部処理用のパネルかチェック
                if (typeof (grid[pos].action) == "number") {
                    setPanelPage(grid[pos].action);
                    pos = -1;
                } else if (grid[pos].action === "FULLSCREEN") {
                    // Fullscreen APIはユーザー操作のイベントハンドラ内で直接呼ぶ必要がある
                    if (!getFullscreenElement()) {
                        requestFullscreen(target).catch(err => {
                            console.warn(`Fullscreen request failed: ${err.message}`);
                        });
                    }
                    // ゲーム側に入力として送らないように消費する
                    pos = -1;
                }
            }
            entryResult = pos;
            viewf = false;
            entrytime = Date.now();
        };

        // タッチ開始
        target.addEventListener('touchstart', (e) => {
            const p = e.touches[0];
            handleStart(p.pageX, p.pageY);
            e.preventDefault(); // スクロール等のブラウザ動作を停止
        }, false);

        // タッチ移動中
        target.addEventListener('touchmove', (e) => {
            const p = e.touches[0];
            handleMove(p.pageX, p.pageY);
            e.preventDefault();
        }, false);

        // タッチ終了
        target.addEventListener('touchend', (e) => {
            handleEnd();
            e.preventDefault();
        }, false);

        // マウスイベント (PCシミュレーション・デバッグ用)
        target.addEventListener('mousedown', (e) => {
            handleStart(e.pageX, e.pageY);
        }, false);

        target.addEventListener('mousemove', (e) => {
            handleMove(e.pageX, e.pageY);
        }, false);

        target.addEventListener('mouseup', (e) => {
            handleEnd();
        }, false);

        for (let i = 0; i < 100; i++) {
            grid[i] = { label: i, action: "", on: false }
        };

        for (let i = 0; i < DH; i++) {
            for (let j = 0; j < DW; j++) {
                if (j > 2 && j < 7 || i > 3)
                    grid[i * DW + j] = { label: null, action: "", on: false }
            }
        };

        const set_grid = (loc, lbl, act) => {
            grid[loc].label = lbl;
            grid[loc].action = act;
        };

        const PNAME = {
            L1: 0,
            L2: 1,
            L3: 2,
            L4: 10,
            L5: 11,
            L6: 12,
            L7: 20,
            L8: 21,
            L9: 22,
            LA: 30,
            LB: 31,
            LC: 32,
            R1: 7,
            R2: 8,
            R3: 9,
            R4: 17,
            R5: 18,
            R6: 19,
            R7: 27,
            R8: 28,
            R9: 29,
            RA: 37,
            RB: 38,
            RC: 39,
        }

        let tpadConfig = null;
        if (Boolean(localStorage.getItem("nh.tpadAssign"))) {
            tpadConfig = JSON.parse(localStorage.getItem("nh.tpadAssign"));
        }

        const CenterPage = 1;
        const LeftPage = 2;
        const RightPage = 3;
        const YNPage = "YN";
        const MENUPage = "MENU";
        const LINPage = "LIN";

        const PageMap = {
            1: "Center",
            2: "Left",
            3: "Right",
            "YN": "YN",
            "MENU": "MENU",
            "LIN": "LIN"
        };

        const setPanelPage = (ppn) => {
            const pageName = PageMap[ppn] || "Center";

            // Clear current grid labels and actions
            for (let i in grid) {
                if (!grid[i].on) { // Don't clear 'on' state
                    grid[i].label = null;
                    grid[i].action = "";
                }
            }

            // Load from config if available
            if (tpadConfig && tpadConfig[pageName]) {
                const config = tpadConfig[pageName];
                for (let idx in config) {
                    set_grid(idx, config[idx].label, config[idx].action);
                }
            } else {
                // Default hardcoded fallbacks
                switch (ppn) {
                    case LeftPage:
                        set_grid(PNAME.L1, "7", ["Numpad7"]);
                        set_grid(PNAME.L2, "8", ["Numpad8"]);
                        set_grid(PNAME.L3, "9", ["Numpad9"]);
                        set_grid(PNAME.L4, "4", ["Numpad4"]);
                        set_grid(PNAME.L5, "-m", ["Numpad5"]);
                        set_grid(PNAME.L6, "6", ["Numpad6"]);
                        set_grid(PNAME.L7, "1", ["Numpad1"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "3", ["Numpad3"]);
                        set_grid(PNAME.LA, null, "");
                        set_grid(PNAME.LB, "Enter", ["Enter"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        set_grid(PNAME.R1, "a", ["KeyA"]);
                        set_grid(PNAME.R2, "d", ["KeyD"]);
                        set_grid(PNAME.R3, "e", ["KeyE"]);
                        set_grid(PNAME.R4, "P", ["KeyP", "ShiftLeft"]);
                        set_grid(PNAME.R5, "R", ["KeyR", "ShiftLeft"]);
                        set_grid(PNAME.R6, "w", ["KeyW"]);
                        set_grid(PNAME.R7, "W", ["KeyW", "ShiftLeft"]);
                        set_grid(PNAME.R8, "T", ["KeyT", "ShiftLeft"]);
                        set_grid(PNAME.R9, "Z", ["KeyZ", "ShiftLeft"]);
                        set_grid(PNAME.RA, "p", ["KeyP"]);
                        set_grid(PNAME.RB, "v", ["KeyV"]);
                        set_grid(PNAME.RC, "[-N-]", CenterPage);
                        break;
                    case RightPage:
                        set_grid(PNAME.L1, "7", ["Numpad7"]);
                        set_grid(PNAME.L2, "8", ["Numpad8"]);
                        set_grid(PNAME.L3, "9", ["Numpad9"]);
                        set_grid(PNAME.L4, "4", ["Numpad4"]);
                        set_grid(PNAME.L5, "-m", ["Numpad5"]);
                        set_grid(PNAME.L6, "6", ["Numpad6"]);
                        set_grid(PNAME.L7, "1", ["Numpad1"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "3", ["Numpad3"]);
                        set_grid(PNAME.LA, "[-N-]", CenterPage);
                        set_grid(PNAME.LB, "Enter", ["Enter"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        set_grid(PNAME.R1, "#", ["Digit3", "ShiftLeft"]);
                        set_grid(PNAME.R2, ";", ["Semicolon"]);
                        set_grid(PNAME.R3, "a", ["KeyA"]);
                        set_grid(PNAME.R4, "y", ["KeyY"]);
                        set_grid(PNAME.R5, "n", ["KeyN"]);
                        set_grid(PNAME.R6, "q", ["KeyQ"]);
                        set_grid(PNAME.R7, "l", ["KeyL"]);
                        break;
                    case YNPage:
                        set_grid(PNAME.L9, "y", ["KeyY"]);
                        set_grid(PNAME.R9, "n", ["KeyN"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        break;
                    case MENUPage:
                        set_grid(PNAME.L9, "Space", ["Space"]);
                        set_grid(PNAME.LB, "Enter", ["Enter"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        break;
                    case LINPage:
                        set_grid(PNAME.LA, "Backsp", ["Backspace"]);
                        set_grid(PNAME.LB, "Enter", ["Enter"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        break;
                    case CenterPage:
                    default:
                        set_grid(PNAME.L1, "7", ["Numpad7"]);
                        set_grid(PNAME.L2, "8", ["Numpad8"]);
                        set_grid(PNAME.L3, "9", ["Numpad9"]);
                        set_grid(PNAME.L4, "4", ["Numpad4"]);
                        set_grid(PNAME.L5, "-m", ["Numpad5"]);
                        set_grid(PNAME.L6, "6", ["Numpad6"]);
                        set_grid(PNAME.L7, "1", ["Numpad1"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "3", ["Numpad3"]);
                        set_grid(PNAME.LA, "[-L-]", LeftPage);
                        set_grid(PNAME.LB, "Enter", ["Enter"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        set_grid(PNAME.R1, "q uaff", ["KeyQ"]);
                        set_grid(PNAME.R2, "i nventry", ["KeyI"]);
                        set_grid(PNAME.R3, "z ap", ["KeyZ"]);
                        set_grid(PNAME.R4, "S ave", ["KeyS", "ShiftLeft"]);
                        set_grid(PNAME.R5, "^x status", ["KeyX", "Space"]);
                        set_grid(PNAME.R6, "k ick", ["KeyK"]);
                        set_grid(PNAME.R7, "r ead", ["KeyR"]);
                        set_grid(PNAME.R8, "T akeoff", ["KeyT", "ShiftLeft"]);
                        set_grid(PNAME.R9, "W ear", ["KeyW", "ShiftLeft"]);
                        set_grid(PNAME.RA, "> down", ["Period", "ShiftLeft"]);
                        set_grid(PNAME.RB, "< up ", ["Comma", "ShiftLeft"]);
                        set_grid(PNAME.RC, "[-R-]", RightPage);
                        break;
                }
                // 全ページ共通で左側にフルスクリーンボタンを配置 (iPhone等の幅狭環境対策)
                // 既にフルスクリーンの場合、またはAPIが利用できない環境（iPhone等）では表示しない
                if (isFullscreenAvailable() && !getFullscreenElement()) {
                    set_grid(40, "FULL", "FULLSCREEN");
                }
            }
            this.currentPage = ppn;
        }

        // フルスクリーン状態の変化を監視してUIを更新する
        document.addEventListener('fullscreenchange', () => {
            setPanelPage(this.currentPage);
        });

        let lastContext = "NORMAL";
        this.updateContext = function (context) {
            if (context === lastContext) return;
            lastContext = context;

            if (context === "NORMAL") {
                setPanelPage(CenterPage);
            } else if (context === "YN") {
                setPanelPage(YNPage);
            } else if (context === "MENU") {
                setPanelPage(MENUPage);
            } else if (context === "LIN") {
                setPanelPage(LINPage);
            }
        }

        setPanelPage(CenterPage); //FirstPage set 

        if (!Boolean(tpadConfig)) {
            //    localStorage.setItem("nh.tpadAssign", JSON.stringify(grid));
        }

        this.check = function () {
            lastResult = entryResult;
            entryResult = -1;
            return this.check_last();
        };

        this.check_last = function () {

            return (lastResult >= 0) ? grid[lastResult].action : null;
        };

        this.draw = function (context) {
            //closewait(ms)　経過後にパネル消去
            if (!viewf && entrytime + closewait * 2 < Date.now()) return;

            //fadeout(closewait)
            let bc = "#202020FF";
            if (!viewf) {
                let n = Date.now() - entrytime;
                if (n > closewait) {
                    n -= closewait;
                    let st = Math.floor(0xFF - (0xDF * n / closewait)).toString(16);
                    bc = "#202020" + st;
                }
            }

            for (let i in grid) {
                let r = grid[i];
                if (r.label !== null) {
                    let cl = { x: i % DW * CW, y: Math.floor(i / DW) * CH, w: CW, h: CH, on: r.on, label: r.label, btncolor: bc }
                    cl.draw = function (dev) {
                        dev.beginPath();
                        //dev.strokeStyle = "white"; //"black";
                        //dev.lineWidth = 1;
                        //dev.rect(this.x+2, this.y+2, this.w-4, this.h-4);
                        //dev.stroke();
                        dev.fillStyle = this.btncolor;//"#303030"; //"black";
                        dev.fillRect(this.x + 2, this.y + 2, this.w - 4, this.h - 4);
                        if (this.on) {
                            dev.beginPath();
                            dev.fillStyle = "orange"; //"black";
                            dev.fillRect(this.x + 2, this.y + 2, this.w - 4, this.h - 4);
                        }
                    }
                    context.putFunc(cl);
                    g.font["std"].putchr(r.label, i % DW * CW + 8, Math.floor(i / DW) * CH + 20);
                }
            }
        }
    }
}