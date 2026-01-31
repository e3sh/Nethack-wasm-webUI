// internal function 
function GpadToKey(g) {

    //Analog L
    const MOVE = {
        UP_L: ["Numpad7"],
        UP_C: ["Numpad8"],
        UP_R: ["Numpad9"],
        LEFT: ["Numpad4"],
        RIGHT: ["Numpad6"],
        DOWN_L: ["Numpad1"],
        DOWN_C: ["Numpad2"],
        DOWN_R: ["Numpad3"],
    }

    let buf;
    if (Boolean(localStorage.getItem("nh.gpadAssign"))) {
        buf = JSON.parse(localStorage.getItem("nh.gpadAssign"));
    }
    // Default Mapping Setting: 
    const KEYASSIGN = Boolean(buf) ? buf :
        {
            NORMAL: {
                P1: { label: " 1", key: ["Numpad1"] },
                P2: { label: " 2", key: ["Numpad2"] },
                P3: { label: " 3", key: ["Numpad3"] },
                P4: { label: " 4", key: ["Numpad4"] },
                P6: { label: " 6", key: ["Numpad6"] },
                P7: { label: " 7", key: ["Numpad7"] },
                P8: { label: " 8", key: ["Numpad8"] },
                P9: { label: " 9", key: ["Numpad9"] },
                START: { label: " ^x", key: ["KeyX", "Space"] },
                BACK: null,
                A: { label: " m-", key: ["Numpad5"] },
                B: { label: "ESC", key: ["Delete"] },
                X: { label: "Enter", key: ["Enter"] },
                Y: { label: "i)vtry", key: ["KeyI"] },
                L3: null,
                R3: null,
            },
            LB: {
                P1: null,
                P2: { label: ">:Dn", key: ["Period", "ShiftLeft"] },
                P3: null,
                P4: { label: "Backsp", key: ["Backspace"] },
                P6: null,
                P7: null,
                P8: { label: "<:Up", key: ["Comma", "ShiftLeft"] },
                P9: null,
                START: { label: " ^x", key: ["KeyX", "Space"] },
                BACK: null,
                A: { label: ",)Get", key: ["Comma"] },
                B: { label: "q)uaf", key: ["KeyQ"] },
                X: { label: "k)ick", key: ["KeyK"] },
                Y: { label: "e)at", key: ["KeyE"] },
                L3: null,
                R3: null,
            },
            LT: {
                P1: null,
                P2: null,
                P3: null,
                P4: { label: " a", key: ["KeyA"] },
                P6: { label: " /", key: ["Slash"] },
                P7: null,
                P8: { label: "t)hrow", key: ["KeyT"] },
                P9: null,
                START: { label: " ^x", key: ["KeyX", "Space"] },
                BACK: null,
                A: { label: "l)ook", key: ["KeyL"] },
                B: { label: "f)ire", key: ["KeyF"] },
                X: { label: "z)ip", key: ["KeyZ"] },
                Y: { label: "d)rop", key: ["KeyD"] },
                L3: null,
                R3: null,
            },
            RB: {
                P1: null,
                P2: { label: "w)ield", key: ["KeyW"] },
                P3: null,
                P4: { label: "W)ear", key: ["KeyW" ,"ShiftLeft"] },
                P6: { label: "T)off", key: ["KeyT" ,"ShiftLeft"] },
                P7: null,
                P8: null,
                P9: null,
                START: { label: " ^x", key: ["KeyX", "Space"] },
                BACK: null,
                A: { label: " q", key: ["KeyQ"] },
                B: { label: " n", key: ["KeyN"] },
                X: { label: " y", key: ["KeyY"] },
                Y: { label: " *", key: ["Quote", "ShiftLeft"] },
                L3: null,
                R3: null,
            },
            RT: {
                P1: null,
                P2: { label: " 2", key: ["Numpad2"] },
                P3: null,
                P4: { label: " 4", key: ["Numpad4"] },
                P6: { label: " 5", key: ["Numpad6"] },
                P7: null,
                P8: { label: " 8", key: ["Numpad8"] },
                P9: null,
                START: { label: " ^x", key: ["KeyX", "Space"] },
                BACK: null,
                A: { label: " m-", key: ["Numpad5"] },
                B: { label: "ESC", key: ["Delete"] },
                X: { label: "Enter", key: ["Enter"] },
                Y: { label: "S)ave", key: ["KeyS", "ShiftLeft"] },
                L3: null,
                R3: null,
            },
            RB_RT: null, //左同時2個押し
            LB_LT: null, //右同時　 
            LB_RB: null, //上列同時2個押し
            LT_RT: null, //下列同時　
            LB_RT: null, //左上右下同時
            LT_RB: null, //右上左下同時
        }
    if (!Boolean(buf)) {
        localStorage.setItem("nh.gpadAssign", JSON.stringify(KEYASSIGN));
    }

    const threshold = 0.5;

    this.check = function (input) {
        let gpd = g.gamepad;
        this.ready = gpd.check();

        const upkey = (gpd.ls_y < -threshold) ? true : false;
        const downkey = (gpd.ls_y > threshold) ? true : false;
        const leftkey = (gpd.ls_x < -threshold) ? true : false;
        const rightkey = (gpd.ls_x > threshold) ? true : false;

        if (upkey) {
            if (leftkey || rightkey) {
                input.push((leftkey) ? MOVE.UP_L : MOVE.UP_R);
            } else
                input.push(MOVE.UP_C);
        } else
            if (downkey) {
                if (leftkey || rightkey) {
                    input.push((leftkey) ? MOVE.DOWN_L : MOVE.DOWN_R);
                } else
                    input.push(MOVE.DOWN_C);
            } else
                if (!upkey && !downkey) {
                    if (leftkey) input.push(MOVE.LEFT);
                    if (rightkey) input.push(MOVE.RIGHT);
                }

        //

        let mode = "NORMAL"; label[LI_NAME.LB] = ""; label[LI_NAME.RB] = "";
        if (gpd.btn_rb) { mode = "RB"; label[LI_NAME.RB] = "RB"; }
        if (gpd.btn_rt) { mode = "RT"; label[LI_NAME.RT] = "RT"; }
        if (gpd.btn_lb) { mode = "LB"; label[LI_NAME.LB] = "LB"; }
        if (gpd.btn_lt) { mode = "LT"; label[LI_NAME.LT] = "LT"; }
        if (gpd.btn_rb && gpd.btn_rt) { mode = "RB_RT"; label[LI_NAME.RB] = "RB_RT"; }
        if (gpd.btn_lb && gpd.btn_lt) { mode = "LB_LT"; label[LI_NAME.LB] = "LB_LT"; }
        if (gpd.btn_rb && gpd.btn_lb) { mode = "RB_LB"; label[LI_NAME.RB] = "RB"; label[LI_NAME.LB] = "LB"; }
        if (gpd.btn_rt && gpd.btn_lt) { mode = "RT_LT"; label[LI_NAME.RT] = "RT"; label[LI_NAME.LT] = "LT"; }

        let KA = KEYASSIGN[mode];
        if (!Boolean(KA)) KA = KEYASSIGN["NORMAL"];

        label[LI_NAME.DL] = Boolean(KA.P1) ? KA.P1.label : "";
        label[LI_NAME.DOWN] = Boolean(KA.P2) ? KA.P2.label : "";
        label[LI_NAME.DR] = Boolean(KA.P3) ? KA.P3.label : "";
        label[LI_NAME.LEFT] = Boolean(KA.P4) ? KA.P4.label : "";
        label[LI_NAME.RIGHT] = Boolean(KA.P6) ? KA.P6.label : "";
        label[LI_NAME.UL] = Boolean(KA.P7) ? KA.P7.label : "";
        label[LI_NAME.UP] = Boolean(KA.P8) ? KA.P8.label : "";
        label[LI_NAME.UR] = Boolean(KA.P9) ? KA.P9.label : "";
        label[LI_NAME.START] = Boolean(KA.START) ? KA.START.label : "";
        label[LI_NAME.BACK] = Boolean(KA.BACK) ? KA.BACK.label : "";
        label[LI_NAME.A] = Boolean(KA.A) ? KA.A.label : "";
        label[LI_NAME.B] = Boolean(KA.B) ? KA.B.label : "";
        label[LI_NAME.X] = Boolean(KA.X) ? KA.X.label : "";
        label[LI_NAME.Y] = Boolean(KA.Y) ? KA.Y.label : "";
        label[LI_NAME.L3] = Boolean(KA.L3) ? KA.L3.label : "";
        label[LI_NAME.R3] = Boolean(KA.R3) ? KA.R3.label : "";

        if (gpd.upkey) {
            if (gpd.leftkey || gpd.rightkey) {
                input.push((gpd.leftkey) ? (KA.P7 != null) ? (KA.P7.key) : "" : (KA.P9 != null) ? KA.P9.key : "");
            } else
                input.push((KA.P8 != null) ? (KA.P8.key) : "");
        } else
            if (gpd.downkey) {
                if (gpd.leftkey || gpd.rightkey) {
                    input.push((gpd.leftkey) ? (KA.P1 != null) ? (KA.P1.key) : "" : (KA.P3 != null) ? KA.P3.key : "");
                } else
                    input.push(KA.P2.key);
            } else
                if (!gpd.upkey && !gpd.downkey) {
                    if (gpd.leftkey) input.push(KA.P4.key);
                    if (gpd.rightkey) input.push(KA.P6.key);
                }
        if (gpd.btn_x) input.push(KA.X.key);
        if (gpd.btn_a) input.push(KA.A.key);
        if (gpd.btn_b) input.push(KA.B.key);
        if (gpd.btn_y) input.push(KA.Y.key);

        if (gpd.btn_start) input.push(KA.START.key);
        //if (gpd.btn_back) input.push(KEYASSIGN.END) ;

        //if (gpd.btn_rb) input.push(KEYASSIGN.DOWN);
        //if (gpd.btn_rt || gpd.btn_lb) input.push(KEYASSIGN.UP);

        //if (gpd.btn_lb) input.push(KEYASSIGN.HOME);

        btn[LI_NAME.UP] = (gpd.upkey) ? 1 : 0;
        btn[LI_NAME.DOWN] = (gpd.downkey) ? 1 : 0;
        btn[LI_NAME.LEFT] = (gpd.leftkey) ? 1 : 0;
        btn[LI_NAME.RIGHT] = (gpd.rightkey) ? 1 : 0;
        btn[LI_NAME.A] = (gpd.btn_a) ? 1 : 0;
        btn[LI_NAME.B] = (gpd.btn_b) ? 1 : 0;
        btn[LI_NAME.X] = (gpd.btn_x) ? 1 : 0;
        btn[LI_NAME.Y] = (gpd.btn_y) ? 1 : 0;
        btn[LI_NAME.START] = (gpd.btn_start) ? 1 : 0;
        btn[LI_NAME.BACK] = (gpd.btn_back) ? 1 : 0;
        btn[LI_NAME.RB] = (gpd.btn_rb) ? 1 : 0;
        btn[LI_NAME.RT] += (gpd.btn_rt) ? 1 : 0;
        btn[LI_NAME.R3] = (gpd.btn_r3) ? 1 : 0;
        btn[LI_NAME.LB] = (gpd.btn_lb) ? 1 : 0;
        btn[LI_NAME.LT] += (gpd.btn_lt) ? 1 : 0;
        btn[LI_NAME.L3] = (gpd.btn_l3) ? 1 : 0;

        return input;
    }

    //LampNameIndex
    const LI_NAME = {
        UP: 10,
        DOWN: 28,
        LEFT: 18,
        RIGHT: 20,
        A: 32,
        B: 24,
        X: 22,
        Y: 14,
        START: 4,
        BACK: 2,
        RB: 6,
        RT: 6,
        R3: 23,
        LB: 0,
        LT: 0,
        L3: 19,
        UL: 9,
        UR: 11,
        DL: 27,
        DR: 29,
    }

    const btn = [
        1, 0, 1, 0, 1, 0, 1, 0, 1,
        0, 1, 0, 0, 0, 1, 0, 0, 1,
        1, 0, 1, 0, 1, 0, 1, 0, 0,
        0, 1, 0, 0, 0, 1, 0, 0, 0,
    ];
    const label = [];
    for (let i = 0; i < 36; i++) { label[i] = ""; }// i.toString()}
    label[LI_NAME.RT] = "RB/RT";
    label[LI_NAME.LT] = "LB/LT";

    //XHB type
    this.draw = function (x, y) {

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 8; j++) {

                const fw = {
                    x: x + j * 40, y: y + i * 16, w: 40, h: 16, onoff: btn[j + i * 9], lbl: (label[j + i * 9] != ""),
                }
                fw.draw = function (device) {

                    device.beginPath();
                    //device.fillStyle = "black"; //clear 
                    //device.fillRect(this.x, this.y, this.w, this.h);

                    if (this.onoff) {
                        device.fillStyle = "blue"; //effect 
                        device.fillRect(this.x + 1, this.y + 1, this.w - 1, this.h - 1);
                    }
                    if (this.lbl) {
                        device.strokeStyle = "white";
                        device.lineWidth = 1;
                        device.rect(this.x, this.y, this.w, this.h);
                        device.stroke();
                    }
                }

                g.screen[0].putFunc(fw);
                //console.log(`${j + i * 9}- ${label[j + i * 9]}`);
                g.font["small"].putchr(label[j + i * 9], j * 40 + x + 4, i * 16 + y + 4);
                //g.screen[0].print(label[j + i * 9], j * 40 + x + 8, i * 16 + y + 10);
            }
        }
    }
}
//0: up down left right
//LB 7 8 9   Y  RB
//   4-+-6  X+B
//LT 1 2 3   A  RT
