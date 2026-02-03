class inputGridPad {

    constructor(element ,g) {

        const target = document.getElementById(element);
        //const log = {};
        let viewf;

        const ResoX = 960;//target.clientWidth; console.log(ResoX);
        const ResoY = 600;//target.clientHeight;  console.log(ResoY);

        const DW = 10; //横分割数
        const DH = 7; //縦分割数

        const CW = ResoX/DW;
        const CH = ResoY/DH;

        let pos = -1;
        let entryResult = -1;
        let lastResult;
        let grid = [];

        const closewait = 500;
        let entrytime = 0; 

        const PosToGridId = (x, y)=>{
            return Math.floor(x/CW)+Math.floor(y/CH)*DW
        }
        const resetLamp = ()=>{
            for (let i in grid) grid[i].on = false;
        }

        // タッチ開始
        target.addEventListener('touchstart', (e) => {
            const p = e.touches[0];
            viewf = true;
            entryResult = -1;
            pos = PosToGridId(p.pageX, p.pageY);//console.log(pos);
            resetLamp(); grid[pos].on = true;
            e.preventDefault(); // スクロール等のブラウザ動作を停止
        }, false);

        // タッチ移動中
        target.addEventListener('touchmove', (e) => {
            const p = e.touches[0];
            viewf = true;
            pos = PosToGridId(p.pageX, p.pageY);//console.log(pos);
            resetLamp(); grid[pos].on = true;
            e.preventDefault();
        }, false);

        // タッチ終了
        target.addEventListener('touchend', (e) => {
            const p = e.touches[0];
            for (let i in grid){
                grid[i].on = false;
            }
            //内部処理用のパネルかチェック
            if (typeof(grid[pos].action) == "number"){ 
                setPanelPage(grid[pos].action); 
                pos = -1;
            }
            entryResult = pos;
            viewf = false;
            entrytime = Date.now();
        }, false);

        for (let i = 0; i <100; i++){
            grid[i] = {label: i, action: "", on:false }
        };

        for (let i = 0; i <DH; i++){
            for (let j = 0; j <DW; j++){
                if (j>2 && j<7 || i>3)
                    grid[i*DW+j] = {label: null, action: "", on:false }
            }
        };
        const set_grid =(loc, lbl, act)=>{
            grid[loc].label = lbl;
            grid[loc].action = act;
        };

        const PNAME = {
            L1:0,
            L2:1,
            L3:2,
            L4:10,
            L5:11,
            L6:12,
            L7:20,
            L8:21,
            L9:22,
            LA:30,
            LB:31,
            LC:32,
            R1:7,
            R2:8,
            R3:9,
            R4:17,
            R5:18,
            R6:19,
            R7:27,
            R8:28,
            R9:29,
            RA:37,
            RB:38,
            RC:39,
        }

        let buf;
        if (Boolean(localStorage.getItem("nh.tpadAssign"))) {
            buf = JSON.parse(localStorage.getItem("nh.tpadAssign"));
        }

        const CenterPage = 1;
        const LeftPage = 2;
        const RightPage = 3;

        const setPanelPage =(ppn)=>{
            switch (ppn){
                case LeftPage:
                    //LeftPage
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
                    //RightPage
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
                    set_grid(PNAME.R8, null, "");
                    set_grid(PNAME.R9, null, "");
                    set_grid(PNAME.RA, null, "");
                    set_grid(PNAME.RB, null, "");
                    set_grid(PNAME.RC, null, "");
                    break;
                case CenterPage:
                default:
                    //CenterPage
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
                    set_grid(PNAME.RB, "< up ", ["Comma" ,"ShiftLeft"]);
                    set_grid(PNAME.RC, "[-R-]", RightPage);
                break;
            }
        }
        setPanelPage(CenterPage);//FirstPage set 

        if (!Boolean(buf)) {
        //    localStorage.setItem("nh.tpadAssign", JSON.stringify(grid));
        }

        this.check = function () {
            lastResult = entryResult;
            entryResult = -1;
            return this.check_last();
        };

        this.check_last = function () {

            return (lastResult >=0)?grid[lastResult].action:null;
        };

        this.draw = function (context) {
            //closewait(ms)　経過後にパネル消去
            if (!viewf && entrytime + closewait*2 < Date.now()) return;

            //fadeout(closewait)
            let bc = "#202020FF";
            if (!viewf){
                let n =  Date.now() - entrytime;
                if (n > closewait){               
                    n -= closewait;     
                    let st  = Math.floor(0xFF - (0xDF*n/closewait)).toString(16);
                    bc = "#202020" + st;
                }
            }

            for (let i in grid){
                let r = grid[i];
                if (r.label !== null){
                    let cl = {x:i%DW*CW, y:Math.floor(i/DW)*CH, w:CW, h:CH, on: r.on, label:r.label, btncolor:bc }
                    cl.draw = function (dev) {
                            dev.beginPath();
                            //dev.strokeStyle = "white"; //"black";
                            //dev.lineWidth = 1;
                            //dev.rect(this.x+2, this.y+2, this.w-4, this.h-4);
                            //dev.stroke();
                            dev.fillStyle = this.btncolor;//"#303030"; //"black";
                            dev.fillRect(this.x+2, this.y+2, this.w-4, this.h-4);
                            if (this.on) {
                                dev.beginPath();
                                dev.fillStyle = "orange"; //"black";
                                dev.fillRect(this.x+2, this.y+2, this.w-4, this.h-4);
                            }
                        }
                    context.putFunc(cl);
                    g.font["std"].putchr(r.label, i%DW*CW+8, Math.floor(i/DW)*CH+20);
                }
            }
        }
    }
}