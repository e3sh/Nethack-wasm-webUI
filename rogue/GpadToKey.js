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

    const d = rogueDefines();

    function fCharToKeyArray(char) {
        if (!char) return null;
        const charCode = char.charCodeAt(0);
        for (const [key, codes] of Object.entries(d.KEYMAP)) {
            if (codes[0] === charCode) return [key];
            if (codes[1] === charCode) return [key, "ShiftLeft"];
            if (codes[2] === charCode) return [key, "ControlLeft"];
        }
        return null;
    }

    function applyContextOverlay(KA, context, choices) {
        let newKA = JSON.parse(JSON.stringify(KA));
        if (context === "YN") {
            if (choices && choices.length > 0) {
                const cArr = choices.split("");
                const buttons = ["A", "B", "X", "Y"];
                for (let i = 0; i < Math.min(cArr.length, buttons.length); i++) {
                    const char = cArr[i];
                    const key = fCharToKeyArray(char);
                    if (key) newKA[buttons[i]] = { label: char, key: key };
                }
            } else {
                newKA.A = { label: "SPC", key: ["Space"] };
            }
        } else if (context === "MENU") {
            newKA.A = { label: "Enter", key: ["Enter"] };
            newKA.B = { label: "ESC", key: ["Delete"] };
            newKA.X = { label: "Space", key: ["Space"] };
        } else if (context === "LIN") {
            newKA.X = { label: "Enter", key: ["Enter"] };
            newKA.B = { label: "ESC", key: ["Delete"] };
            newKA.A = { label: "Backsp", key: ["Backspace"] };
        }
        return newKA;
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
                START: { label: " # ", key: ["Digit3", "ShiftLeft"] },
                BACK: { label: "Save", key: ["KeyS", "ShiftLeft"] },
                A: { label: "Trav", key: ["Numpad5"] },
                B: { label: "ESC", key: ["Delete"] },
                X: { label: "Ent", key: ["Enter"] },
                Y: { label: " i ", key: ["KeyI"] },
                L3: { label: " : ", key: ["Quote"] },
                R3: { label: " s ", key: ["KeyS"] },
            },
            RT: { // Modifier: Battle / Equipment
                A: { label: "w)ld", key: ["KeyW"] },
                B: { label: "W)ear", key: ["KeyW", "ShiftLeft"] },
                X: { label: "T)off", key: ["KeyT", "ShiftLeft"] },
                Y: { label: "z)ap", key: ["KeyZ"] },
            },
            LT: { // Modifier: Consumables / Throw
                A: { label: "q)uf", key: ["KeyQ"] },
                B: { label: "r)ead", key: ["KeyR"] },
                X: { label: "e)at", key: ["KeyE"] },
                Y: { label: "t)hw", key: ["KeyT"] },
            },
            RB: { // Modifier: Move / Navigation
                A: { label: " . ", key: ["Period"] },
                B: { label: "<)Up", key: ["Comma", "ShiftLeft"] },
                X: { label: ">)Dn", key: ["Period", "ShiftLeft"] },
                Y: { label: ",)get", key: ["Comma"] },
            },
            LB: { // Modifier: Other
                A: { label: "Z)ap", key: ["KeyZ", "ShiftLeft"] },
                B: { label: "a)ply", key: ["KeyA"] },
                X: { label: "k)ik", key: ["KeyK"] },
                Y: { label: "Pray", key: ["Digit3", "ShiftLeft"] },
            },
            LB_LT: { // YN Choices Extension
                A: { label: " y ", key: ["KeyY"] },
                B: { label: " n ", key: ["KeyN"] },
                X: { label: " a ", key: ["KeyA"] },
                Y: { label: " q ", key: ["KeyQ"] },
                P4: { label: " l ", key: ["KeyL"] },
                P6: { label: " r ", key: ["KeyR"] },
            },
            RB_RT: { // Common Utilities
                A: { label: " a ", key: ["KeyA"] },
                B: { label: " d ", key: ["KeyD"] },
                X: { label: " @ ", key: ["BracketLeft"] },
                Y: { label: " / ", key: ["Slash"] },
                START: { label: " * ", key: ["Quote", "ShiftLeft"] },
                BACK: { label: " # ", key: ["Digit3", "ShiftLeft"] },
            },
            LB_RB: {}, //上側同時
            LT_RT: {}, //下側同時
            LB_RT: {}, //左上右下
            LT_RB: {}, //左下右上
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

        let mode = "NORMAL";
        label[LI_NAME.LB] = ""; label[LI_NAME.RB] = "";
        label[LI_NAME.LT] = ""; label[LI_NAME.RT] = "";

        if (gpd.btn_lb) { mode = "LB"; label[LI_NAME.LB] = "LB"; }
        if (gpd.btn_lt) { mode = "LT"; label[LI_NAME.LT] = "LT"; }
        if (gpd.btn_rb) { mode = "RB"; label[LI_NAME.RB] = "RB"; }
        if (gpd.btn_rt) { mode = "RT"; label[LI_NAME.RT] = "RT"; }

        //Combinations (overwrite single modes)
        if (gpd.btn_lb && gpd.btn_lt) { mode = "LB_LT"; label[LI_NAME.LB] = "LB_LT"; }
        if (gpd.btn_rb && gpd.btn_rt) { mode = "RB_RT"; label[LI_NAME.RB] = "RB_RT"; }
        if (gpd.btn_lb && gpd.btn_rb) { mode = "LB_RB"; label[LI_NAME.LB] = "LB"; label[LI_NAME.RB] = "RB"; }
        if (gpd.btn_lt && gpd.btn_rt) { mode = "LT_RT"; label[LI_NAME.LT] = "LT"; label[LI_NAME.RT] = "RT"; }
        if (gpd.btn_lb && gpd.btn_rt) { mode = "LB_RT"; label[LI_NAME.LB] = "LB"; label[LI_NAME.RT] = "RT"; }
        if (gpd.btn_lt && gpd.btn_rb) { mode = "LT_RB"; label[LI_NAME.LT] = "LT"; label[LI_NAME.RB] = "RB"; }

        let context = (g.rogue) ? g.rogue.inputContext : "NORMAL";
        let choices = (g.rogue) ? g.rogue.inputChoices : "";

        let KA = (KEYASSIGN[mode]) ? KEYASSIGN[mode] : KEYASSIGN["NORMAL"];

        if (mode === "NORMAL" && context !== "NORMAL") {
            KA = applyContextOverlay(KA, context, choices);
            label[LI_NAME.INDC] = context; // Indicator
        } else {
            label[LI_NAME.INDC] = "";//(context !== "NORMAL") ? `(${context})` : (KA.L3 ? KA.L3.label : "");
        }

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
                    input.push((KA.P2 != null) ? (KA.P2.key) : "");
            } else
                if (!gpd.upkey && !gpd.downkey) {
                    if (gpd.leftkey) input.push((KA.P4 != null) ? (KA.P4.key) : "");
                    if (gpd.rightkey) input.push((KA.P6 != null) ? (KA.P6.key) : "");
                }
        if (gpd.btn_x) input.push((KA.X != null) ? (KA.X.key) : "");
        if (gpd.btn_a) input.push((KA.A != null) ? (KA.A.key) : "");
        if (gpd.btn_b) input.push((KA.B != null) ? (KA.B.key) : "");
        if (gpd.btn_y) input.push((KA.Y != null) ? (KA.Y.key) : "");

        if (gpd.btn_start) input.push((KA.START != null) ? (KA.START.key) : "");
        if (gpd.btn_back) input.push((KA.BACK != null) ? (KA.BACK.key) : "");

        if (gpd.btn_r3) input.push((KA.R3 != null) ? (KA.R3.key) : "");
        if (gpd.btn_l3) input.push((KA.L3 != null) ? (KA.L3.key) : "");

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
        btn[LI_NAME.INDC] = (label[LI_NAME.INDC] != "") ? 1 : 0;

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
        INDC: 3,
    }

    const btn = [
        1, 0, 1, 1, 1, 0, 1, 0, 1,
        0, 1, 0, 0, 0, 1, 0, 0, 1,
        1, 1, 1, 0, 1, 1, 1, 0, 0,
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
                        device.fillRect(this.x + 2, this.y + 2, this.w - 4, this.h - 4);
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
