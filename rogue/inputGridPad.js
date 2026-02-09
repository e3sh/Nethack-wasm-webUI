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

        const closewait = 2500;
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
                if (typeof (grid[pos].action) == "number" || PageMap[grid[pos].action]) {
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
            // 右側ブロック (3列 x 7行 = 21)
            R1: DW - 3, R2: DW - 2, R3: DW - 1,
            R4: DW * 2 - 3, R5: DW * 2 - 2, R6: DW * 2 - 1,
            R7: DW * 3 - 3, R8: DW * 3 - 2, R9: DW * 3 - 1,
            RA: DW * 4 - 3, RB: DW * 4 - 2, RC: DW * 4 - 1,
            RD: DW * 5 - 3, RE: DW * 5 - 2, RF: DW * 5 - 1,
            RG: DW * 6 - 3, RH: DW * 6 - 2, RI: DW * 6 - 1,
            RJ: DW * 7 - 3, RK: DW * 7 - 2, RL: DW * 7 - 1,
            // 中央ブロック (6列 x 7行 = 42)
            C1: 3, C2: 4, C3: 5, C4: 6, C5: 7, C6: 8,
            C7: DW + 3, C8: DW + 4, C9: DW + 5, C10: DW + 6, C11: DW + 7, C12: DW + 8,
            C13: DW * 2 + 3, C14: DW * 2 + 4, C15: DW * 2 + 5, C16: DW * 2 + 6, C17: DW * 2 + 7, C18: DW * 2 + 8,
            C19: DW * 3 + 3, C20: DW * 3 + 4, C21: DW * 3 + 5, C22: DW * 3 + 6, C23: DW * 3 + 7, C24: DW * 3 + 8,
            C25: DW * 4 + 3, C26: DW * 4 + 4, C27: DW * 4 + 5, C28: DW * 4 + 6, C29: DW * 4 + 7, C30: DW * 4 + 8,
            C31: DW * 5 + 3, C32: DW * 5 + 4, C33: DW * 5 + 5, C34: DW * 5 + 6, C35: DW * 5 + 7, C36: DW * 5 + 8,
            C37: DW * 6 + 3, C38: DW * 6 + 4, C39: DW * 6 + 5, C40: DW * 6 + 6, C41: DW * 6 + 7, C42: DW * 6 + 8,
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
                        set_grid(PNAME.L5, "Trav", ["Numpad5"]);
                        set_grid(PNAME.L6, "6", ["Numpad6"]);
                        set_grid(PNAME.L7, "1", ["Numpad1"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "3", ["Numpad3"]);
                        set_grid(PNAME.LA, "[-N-]", CenterPage);
                        set_grid(PNAME.LB, "Enter", ["Enter"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        set_grid(PNAME.R1, "P)on", ["KeyP", "ShiftLeft"]);
                        set_grid(PNAME.R2, "R)mov", ["KeyR", "ShiftLeft"]);
                        set_grid(PNAME.R3, "a)ply", ["KeyA"]);
                        set_grid(PNAME.R4, "k)ik", ["KeyK"]);
                        set_grid(PNAME.R5, "o)pn", ["KeyO"]);
                        set_grid(PNAME.R6, "c)ls", ["KeyC"]);
                        set_grid(PNAME.R7, "# pray", ["Digit3", "ShiftLeft"]);
                        set_grid(PNAME.R8, "Z)ap", ["KeyZ", "ShiftLeft"]);
                        set_grid(PNAME.R9, "f)ire", ["KeyF"]);
                        set_grid(PNAME.RA, "l)ook", ["KeyL"]);
                        set_grid(PNAME.RB, "v)rs", ["KeyV", "ShiftLeft"]);
                        set_grid(PNAME.RC, "[-R-]", RightPage);
                        set_grid(PNAME.RJ, "[-N-]", CenterPage);
                        set_grid(PNAME.RK, "[-R-]", RightPage);
                        set_grid(PNAME.RL, "ENTER", ["Enter"]);
                        break;
                    case RightPage:
                        set_grid(PNAME.L1, "7", ["Numpad7"]);
                        set_grid(PNAME.L2, "8", ["Numpad8"]);
                        set_grid(PNAME.L3, "9", ["Numpad9"]);
                        set_grid(PNAME.L4, "4", ["Numpad4"]);
                        set_grid(PNAME.L5, "Trav", ["Numpad5"]);
                        set_grid(PNAME.L6, "6", ["Numpad6"]);
                        set_grid(PNAME.L7, "1", ["Numpad1"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "3", ["Numpad3"]);
                        set_grid(PNAME.LA, "[-L-]", LeftPage);
                        set_grid(PNAME.LB, "Enter", ["Enter"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        set_grid(PNAME.R1, "y es", ["KeyY"]);
                        set_grid(PNAME.R2, "n o", ["KeyN"]);
                        set_grid(PNAME.R3, "a ll", ["KeyA"]);
                        set_grid(PNAME.R4, "q uit", ["KeyQ"]);
                        set_grid(PNAME.R5, "S)ave", ["KeyS", "ShiftLeft"]);
                        set_grid(PNAME.R6, "Enter", ["Enter"]);
                        set_grid(PNAME.R7, "Space", ["Space"]);
                        set_grid(PNAME.R8, "Bksp", ["Backspace"]);
                        set_grid(PNAME.R9, "Tab", ["Tab"]);
                        set_grid(PNAME.RA, "# ext", ["Digit3", "ShiftLeft"]);
                        set_grid(PNAME.RB, "ESC", ["Delete"]);
                        set_grid(PNAME.RC, "[-N-]", CenterPage);
                        set_grid(PNAME.RJ, "[-L-]", LeftPage);
                        set_grid(PNAME.RK, "[-N-]", CenterPage);
                        set_grid(PNAME.RL, "ENTER", ["Enter"]);
                        break;
                    case YNPage:
                        // 方向キーを左側に維持
                        set_grid(PNAME.L1, "7", ["Numpad7"]);
                        set_grid(PNAME.L2, "8", ["Numpad8"]);
                        set_grid(PNAME.L3, "9", ["Numpad9"]);
                        set_grid(PNAME.L4, "4", ["Numpad4"]);
                        set_grid(PNAME.L5, "5", ["Numpad5"]);
                        set_grid(PNAME.L6, "6", ["Numpad6"]);
                        set_grid(PNAME.L7, "1", ["Numpad1"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "3", ["Numpad3"]);
                        set_grid(PNAME.LA, "[-L-]", LeftPage);
                        set_grid(PNAME.LB, "[-N-]", CenterPage);
                        set_grid(PNAME.LC, "[-R-]", RightPage);

                        // コンテキストボタンを右側に配置 (R1-RI)
                        set_grid(PNAME.R1, "y", ["KeyY"]);
                        set_grid(PNAME.R2, "n", ["KeyN"]);
                        set_grid(PNAME.R3, "a", ["KeyA"]);
                        set_grid(PNAME.R4, "q", ["KeyQ"]);
                        set_grid(PNAME.R5, "l", ["KeyL"]);
                        set_grid(PNAME.R6, "r", ["KeyR"]);
                        set_grid(PNAME.R7, "*", ["Quote", "ShiftLeft"]);
                        set_grid(PNAME.R8, "/", ["Slash"]);
                        set_grid(PNAME.RI, "ESC", ["Delete"]);

                        // ナビゲーション
                        set_grid(PNAME.RJ, "[-L-]", LeftPage);
                        set_grid(PNAME.RK, "[-N-]", CenterPage);
                        set_grid(PNAME.RL, "[-R-]", RightPage);
                        break;
                    case MENUPage:
                        // 方向キーを左側に維持
                        set_grid(PNAME.L1, "7", ["Numpad7"]);
                        set_grid(PNAME.L2, "8", ["Numpad8"]);
                        set_grid(PNAME.L3, "9", ["Numpad9"]);
                        set_grid(PNAME.L4, "4", ["Numpad4"]);
                        set_grid(PNAME.L5, "5", ["Numpad5"]);
                        set_grid(PNAME.L6, "6", ["Numpad6"]);
                        set_grid(PNAME.L7, "1", ["Numpad1"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "3", ["Numpad3"]);
                        set_grid(PNAME.LA, "[-L-]", LeftPage);
                        set_grid(PNAME.LB, "[-N-]", CenterPage);
                        set_grid(PNAME.LC, "[-R-]", RightPage);

                        // コンテキストボタンを右側に配置
                        set_grid(PNAME.R1, "Space", ["Space"]);
                        set_grid(PNAME.R2, "Enter", ["Enter"]);
                        set_grid(PNAME.R3, "ESC", ["Delete"]);
                        set_grid(PNAME.R4, "a", ["KeyA"]);
                        set_grid(PNAME.R5, "d", ["KeyD"]);
                        set_grid(PNAME.R6, "q", ["KeyQ"]);
                        set_grid(PNAME.R7, "*", ["Quote", "ShiftLeft"]);
                        set_grid(PNAME.R8, "/", ["Slash"]);

                        set_grid(PNAME.RJ, "[-L-]", LeftPage);
                        set_grid(PNAME.RK, "[-N-]", CenterPage);
                        set_grid(PNAME.RL, "[-R-]", RightPage);
                        break;
                    case LINPage:
                        // 方向キー
                        set_grid(PNAME.L1, "7", ["Numpad7"]);
                        set_grid(PNAME.L2, "8", ["Numpad8"]);
                        set_grid(PNAME.L3, "9", ["Numpad9"]);
                        set_grid(PNAME.L4, "4", ["Numpad4"]);
                        set_grid(PNAME.L5, "5", ["Numpad5"]);
                        set_grid(PNAME.L6, "6", ["Numpad6"]);
                        set_grid(PNAME.L7, "1", ["Numpad1"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "3", ["Numpad3"]);

                        set_grid(PNAME.R1, "Bksp", ["Backspace"]);
                        set_grid(PNAME.R2, "Enter", ["Enter"]);
                        set_grid(PNAME.R3, "ESC", ["Delete"]);

                        set_grid(PNAME.RJ, "[-L-]", LeftPage);
                        set_grid(PNAME.RK, "[-N-]", CenterPage);
                        set_grid(PNAME.RL, "[-R-]", RightPage);
                        break;
                    case CenterPage:
                    default:
                        // 移動・基本 (左側)
                        set_grid(PNAME.L1, "7", ["Numpad7"]);
                        set_grid(PNAME.L2, "8", ["Numpad8"]);
                        set_grid(PNAME.L3, "9", ["Numpad9"]);
                        set_grid(PNAME.L4, "4", ["Numpad4"]);
                        set_grid(PNAME.L5, "Trav", ["Numpad5"]);
                        set_grid(PNAME.L6, "6", ["Numpad6"]);
                        set_grid(PNAME.L7, "1", ["Numpad1"]);
                        set_grid(PNAME.L8, "2", ["Numpad2"]);
                        set_grid(PNAME.L9, "3", ["Numpad3"]);
                        set_grid(PNAME.LA, "[-L-]", LeftPage);
                        set_grid(PNAME.LB, "Ent", ["Enter"]);
                        set_grid(PNAME.LC, "ESC", ["Delete"]);
                        // 右側：7段構成
                        // 1段目: 消耗品
                        set_grid(PNAME.R1, "q)uf", ["KeyQ"]);
                        set_grid(PNAME.R2, "r)ed", ["KeyR"]);
                        set_grid(PNAME.R3, "e)at", ["KeyE"]);
                        // 2段目: 武具
                        set_grid(PNAME.R4, "w)ld", ["KeyW"]);
                        set_grid(PNAME.R5, "W)ear", ["KeyW", "ShiftLeft"]);
                        set_grid(PNAME.R6, "T)off", ["KeyT", "ShiftLeft"]);
                        // 3段目: サバイバル/アクション1
                        set_grid(PNAME.R7, "k)ik", ["KeyK"]);
                        set_grid(PNAME.R8, "a)ply", ["KeyA"]);
                        set_grid(PNAME.R9, "z)ap", ["KeyZ"]);
                        // 4段目: 一般アクション2
                        set_grid(PNAME.RA, ". wait", ["Period"]);
                        set_grid(PNAME.RB, "i)nv", ["KeyI"]);
                        set_grid(PNAME.RC, "s)rh", ["KeyS"]);
                        // 5段目: 環境操作
                        set_grid(PNAME.RD, ">)Dn", ["Period", "ShiftLeft"]);
                        set_grid(PNAME.RE, "<)Up", ["Comma", "ShiftLeft"]);
                        set_grid(PNAME.RF, ",)get", ["Comma"]);
                        // 6段目: 補助操作
                        set_grid(PNAME.RG, "o)pn", ["KeyO"]);
                        set_grid(PNAME.RH, "c)ls", ["KeyC"]);
                        set_grid(PNAME.RI, "# ext", ["Digit3", "ShiftLeft"]);
                        // 7段目: 制御
                        set_grid(PNAME.RJ, "[-L-]", LeftPage);
                        set_grid(PNAME.RK, "[-R-]", RightPage);
                        set_grid(PNAME.RL, "ENTER", ["Enter"]);
                        // コンテキストがアクティブなら復帰ボタンを表示
                        if (this.currentContext && this.currentContext !== "NORMAL") {
                            // 右側の目立つ位置（RI: # ext の場所）に配置
                            set_grid(PNAME.RI, "[CONTEXT]", this.currentContext);
                            // もし CenterPage 以外（Left/Right）ならもっと目立つ位置にも
                            if (ppn !== CenterPage) {
                                set_grid(PNAME.RC, "[CONTEXT]", this.currentContext);
                            }
                        }
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

        this.currentContext = "NORMAL";
        let lastContext = "NORMAL";
        let lastPlaying = true;
        this.updateContext = function (context) {
            const currentPlaying = (this.g && this.g.rogue) ? this.g.rogue.playing : true;
            if (context === lastContext && currentPlaying === lastPlaying) return;
            lastContext = context;
            lastPlaying = currentPlaying;
            this.currentContext = context;

            if (context === "NORMAL") {
                this.setPanelPage(CenterPage);
            } else if (context === "YN") {
                this.setPanelPage(YNPage);
            } else if (context === "MENU") {
                this.setPanelPage(MENUPage);
            } else if (context === "LIN") {
                this.setPanelPage(LINPage);
            } else {
                // 状態（Contextまたはplaying）が変わったらパネルを更新
                this.setPanelPage(this.currentPage);
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
                        dev.strokeStyle = "white"; //"black";
                        dev.lineWidth = 1;
                        dev.rect(this.x+2, this.y+2, this.w-4, this.h-4);
                        dev.stroke();
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