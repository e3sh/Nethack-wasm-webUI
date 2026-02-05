class inputGridPad {

    constructor(element, g) {
        this.g = g;
        this._onUpdate = null; // 更新通知用コールバック
        const target = document.getElementById(element);
        //const log = {};
        let viewf;

        const ResoX = 960;//target.clientWidth; console.log(ResoX);
        const ResoY = 600;//target.clientHeight;  console.log(ResoY);

        const DW = 12; // 10 -> 12 横分割数を増やしてボタンを小型化
        const DH = 9;  // 7 -> 9  縦分割数を増やしてボタンを小型化

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

            // 1. 要素内の相対座標 (スクロール考慮)
            const relativeX = pageX - (rect.left + window.scrollX);
            const relativeY = pageY - (rect.top + window.scrollY);

            // 2. 内部解像度 (960x600) と表示サイズの比率を計算
            // CSS で object-fit: contain を使っているため、実際の描画領域を考慮
            const gameAspect = ResoX / ResoY;
            const viewAspect = rect.width / rect.height;

            let actualWidth, actualHeight, offsetX, offsetY;
            if (viewAspect > gameAspect) {
                // 左右に黒枠
                actualHeight = rect.height;
                actualWidth = rect.height * gameAspect;
                offsetX = (rect.width - actualWidth) / 2;
                offsetY = 0;
            } else {
                // 上下に黒枠
                actualWidth = rect.width;
                actualHeight = rect.width / gameAspect;
                offsetX = 0;
                offsetY = (rect.height - actualHeight) / 2;
            }

            // 3. ゲーム内座標への補正
            const xInGame = (relativeX - offsetX) * (ResoX / actualWidth);
            const yInGame = (relativeY - offsetY) * (ResoY / actualHeight);

            // 4. 範囲チェック
            if (xInGame < 0 || xInGame >= ResoX || yInGame < 0 || yInGame >= ResoY) {
                return -1;
            }

            return Math.floor(xInGame / CW) + Math.floor(yInGame / CH) * DW;
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
                    this.setPanelPage(grid[pos].action);
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

        for (let i = 0; i < DW * DH; i++) {
            grid[i] = { label: null, action: "", on: false }
        };

        const set_grid = (loc, lbl, act) => {
            if (grid[loc]) {
                grid[loc].label = lbl;
                grid[loc].action = act;
            }
        };

        const PNAME = {
            // 左側ブロック (3列 x 4行 = 12)
            L1: 0, L2: 1, L3: 2,
            L4: DW, L5: DW + 1, L6: DW + 2,
            L7: DW * 2, L8: DW * 2 + 1, L9: DW * 2 + 2,
            LA: DW * 3, LB: DW * 3 + 1, LC: DW * 3 + 2,
            // 右側ブロック (3列 x 4行 = 12)
            R1: DW - 3, R2: DW - 2, R3: DW - 1,
            R4: DW * 2 - 3, R5: DW * 2 - 2, R6: DW * 2 - 1,
            R7: DW * 3 - 3, R8: DW * 3 - 2, R9: DW * 3 - 1,
            RA: DW * 4 - 3, RB: DW * 4 - 2, RC: DW * 4 - 1,
        }

        let tpadConfig = null;
        const savedConfig = localStorage.getItem("nh.tpadAssign");
        if (Boolean(savedConfig)) {
            const parsed = JSON.parse(savedConfig);
            // グリッドサイズが異なる場合は古い設定を無視（リセット）
            if (Array.isArray(parsed.Center) || parsed.ver !== `${DW}x${DH}`) {
                console.log("Grid size changed or old format. Resetting layout.");
                localStorage.removeItem("nh.tpadAssign");
            } else {
                tpadConfig = parsed;
            }
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

        this.setPanelPage = (ppn) => {
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
                        set_grid(PNAME.RA, ",", ["Comma"]);
                        set_grid(PNAME.RB, "l", ["KeyL"]);
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
                        set_grid(PNAME.R8, "@", ["BracketLeft"]);
                        break;
                    case YNPage:
                        set_grid(PNAME.L2, "8", ["Numpad8"]);
                        set_grid(PNAME.L4, "l", ["KeyL"]);
                        set_grid(PNAME.L6, "r", ["KeyR"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "y", ["KeyY"]);
                        set_grid(PNAME.R3, "a", ["KeyA"]);
                        set_grid(PNAME.R6, "q", ["KeyQ"]);
                        set_grid(PNAME.R9, "n", ["KeyN"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        break;
                    case MENUPage:
                        set_grid(PNAME.L2, "8", ["Numpad8"]);
                        set_grid(PNAME.L4, "4", ["Numpad4"]);
                        set_grid(PNAME.L6, "6", ["Numpad6"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "Space", ["Space"]);
                        set_grid(PNAME.LB, "Enter", ["Enter"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        set_grid(PNAME.R1, "*", ["Quote", "ShiftLeft"]);
                        set_grid(PNAME.R2, "/", ["Slash"]);
                        set_grid(PNAME.R3, "a", ["KeyA"]);
                        set_grid(PNAME.R4, "d", ["KeyY"]);
                        set_grid(PNAME.R5, "q", ["KeyN"]);
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
                if (isFullscreenAvailable() && !getFullscreenElement()) {
                    // 左下隅付近に配置 (DH-1行目の0列目)
                    set_grid(DW * (DH - 1), "FULL", "FULLSCREEN");
                }
            }
            // 保存用データにバージョン（サイズ）を含める
            if (!tpadConfig) {
                // 初回のみデフォルトを保存することを検討してもよいが、
                // ここでは保存時に ver: "12x9" を付与することを前提とする。
            }
            this.currentPage = ppn;
            if (this._onUpdate) this._onUpdate(grid);
        }

        // フルスクリーン状態の変化を監視してUIを更新する
        document.addEventListener('fullscreenchange', () => {
            this.setPanelPage(this.currentPage);
        });

        let lastContext = "NORMAL";
        let lastPlaying = true;
        this.updateContext = function (context) {
            const currentPlaying = (this.g && this.g.rogue) ? this.g.rogue.playing : true;
            if (context === lastContext && currentPlaying === lastPlaying) return;
            lastContext = context;
            lastPlaying = currentPlaying;

            // 状態（Contextまたはplaying）が変わったらパネルを更新
            this.setPanelPage(this.currentPage);

            if (context === "NORMAL") {
                this.setPanelPage(CenterPage);
            } else if (context === "YN") {
                this.setPanelPage(YNPage);
            } else if (context === "MENU") {
                this.setPanelPage(MENUPage);
            } else if (context === "LIN") {
                this.setPanelPage(LINPage);
            }
        }

        this.setPanelPage(CenterPage); //FirstPage set 

        if (!Boolean(tpadConfig)) {
            //    localStorage.setItem("nh.tpadAssign", JSON.stringify(grid));
        }

        this.check = function () {
            // ゲームオーバー(playing=false)の状態変化を常に監視してUIを更新
            this.updateContext(lastContext);

            lastResult = entryResult;
            entryResult = -1;
            return this.check_last();
        };

        this.check_last = function () {

            return (lastResult >= 0) ? grid[lastResult].action : null;
        };

        this.getGridData = function () {
            return {
                grid: grid,
                dw: DW,
                dh: DH,
                currentPage: this.currentPage
            };
        };

        this.setOnUpdate = function (callback) {
            this._onUpdate = callback;
            callback(grid); // 初回呼び出し
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