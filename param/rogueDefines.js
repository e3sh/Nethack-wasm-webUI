function rogueDefines(r) {

    /*
     * Maximum number of different things
     */
    const d = {

        //textFlameNumbers
        DSP_MAIN: 0,
        DSP_MAIN_FG: 1,
        DSP_STATUS: 2,
        DSP_MESSAGE: 3,
        DSP_WINDOW: 4,
        DSP_MODE: 5,
        DSP_COMMENT: 6,
        LINES: 24,
        COLS: 80,

        //nh parameters

        STAT_FLD: {
            "TITLE": 0, //0
            "STR": 1,  //1 
            "DEX": 2,  //2
            "CON": 3,  //3
            "INT": 4,  //4
            "WIS": 5,  //5
            "CHA": 6,  //6
            "ALIGN": 7,   //7
            "SCORE": 8,   //8
            "CAP": 9, //9
            "GOLD": 10, //10
            "ENE": 11, //11
            "ENEMAX": 12, //12
            "XP": 13, //13
            "AC": 14, //14
            "HITDICE": 15, //15
            "TIME": 16, //16
            "HUNGER": 17, //17
            "HP": 18, //18
            "HPMAX": 19, //19
            "DLEVEL": 20, //20
            "EXP": 21, //21
            "CONDITION": 22, //22
            "VERS": 23, //23
        },

        //condition bits
        CONDITION: {
            "BAREH": parseInt("0x00000001", 16), // Bare handed (no weapon)
            "BLIND": parseInt("0x00000002", 16), // Blind
            "BUSY": parseInt("0x00000004", 16), // Busy (doing something)
            "CONF": parseInt("0x00000008", 16), // Confused
            "DEAF": parseInt("0x00000010", 16), // Deaf
            "ELF_IRON": parseInt("0x00000020", 16), // Elf iron equipped
            "FLY": parseInt("0x00000040", 16), // Flying
            "FOODPOIS": parseInt("0x00000080", 16), // Food poisoning
            "GLOWHANDS": parseInt("0x00000100", 16), // Glowing hands
            "GRAB": parseInt("0x00000200", 16), // Grabbing something
            "HALLU": parseInt("0x00000400", 16), // Hallucinating
            "HELD": parseInt("0x00000800", 16), // Held
            "ICY": parseInt("0x00001000", 16), // Icy
            "INLAVA": parseInt("0x00002000", 16), // In lava
            "LEV": parseInt("0x00004000", 16), // Levitating
            "PARLYZ": parseInt("0x00008000", 16), // Paralyzed
            "RIDE": parseInt("0x00010000", 16), // Riding
            "SLEEPING": parseInt("0x00020000", 16), // Sleeping
            "SLIME": parseInt("0x00040000", 16), // Slime
            "SLIPPERY": parseInt("0x00080000", 16), // Slippery
            "STONE": parseInt("0x00100000", 16), // Stoned
            "STRNGL": parseInt("0x00200000", 16), // Strangled
            "STUN": parseInt("0x00400000", 16), // Stunned
            "SUBMERGED": parseInt("0x00800000", 16), // Submerged
            "TERMILL": parseInt("0x01000000", 16), // Termill
            "TETHERED": parseInt("0x02000000", 16), // Tethered
            "TRAPPED": parseInt("0x04000000", 16), // Trapped
            "UNCONSC": parseInt("0x08000000", 16), // Unconscious
            "WOUNDEDL": parseInt("0x10000000", 16), // Wounded leg
            "HOLDING": parseInt("0x20000000", 16), // Holding something
        },

        //Keymap　キーボードの記号配列JIS106/109Keyboard [normal, shift, ctrl]
        KEYMAP: {
            'ArrowUp': ['k'.charCodeAt(0), 'K'.charCodeAt(0), null],
            'ArrowDown': ['j'.charCodeAt(0), 'J'.charCodeAt(0), null],
            'ArrowLeft': ['h'.charCodeAt(0), 'H'.charCodeAt(0), null],
            'ArrowRight': ['l'.charCodeAt(0), 'L'.charCodeAt(0), null],
            'Enter': [13, 13, 13],
            'Escape': [27, 27, 27],
            'Space': [32, 32, 32],
            'KeyA': ["a".charCodeAt(0), "A".charCodeAt(0), 1],
            'KeyB': ["b".charCodeAt(0), "B".charCodeAt(0), 2],
            'KeyC': ["c".charCodeAt(0), "C".charCodeAt(0), 3],
            'KeyD': ["d".charCodeAt(0), "D".charCodeAt(0), 4],  //Ctrl+D Kick
            'KeyE': ["e".charCodeAt(0), "E".charCodeAt(0), 5],
            'KeyF': ["f".charCodeAt(0), "F".charCodeAt(0), 6],
            'KeyG': ["g".charCodeAt(0), "G".charCodeAt(0), 7],
            'KeyH': ["h".charCodeAt(0), "H".charCodeAt(0), 8],
            'KeyI': ["i".charCodeAt(0), "I".charCodeAt(0), 9],
            'KeyJ': ["j".charCodeAt(0), "J".charCodeAt(0), 10],
            'KeyK': ["k".charCodeAt(0), "K".charCodeAt(0), 11],
            'KeyL': ["l".charCodeAt(0), "L".charCodeAt(0), 12],
            'KeyM': ["m".charCodeAt(0), "M".charCodeAt(0), 13],
            'KeyN': ["n".charCodeAt(0), "N".charCodeAt(0), 14],
            'KeyO': ["o".charCodeAt(0), "O".charCodeAt(0), 15],
            'KeyP': ["p".charCodeAt(0), "P".charCodeAt(0), 16],
            'KeyQ': ["q".charCodeAt(0), "Q".charCodeAt(0), 17],
            'KeyR': ["r".charCodeAt(0), "R".charCodeAt(0), 18],
            'KeyS': ["s".charCodeAt(0), "S".charCodeAt(0), 19],
            'KeyT': ["t".charCodeAt(0), "T".charCodeAt(0), 20],
            'KeyU': ["u".charCodeAt(0), "U".charCodeAt(0), 21],
            'KeyV': ["v".charCodeAt(0), "V".charCodeAt(0), 22],
            'KeyW': ["w".charCodeAt(0), "W".charCodeAt(0), 23],
            'KeyX': ["x".charCodeAt(0), "X".charCodeAt(0), 24],
            'KeyY': ["y".charCodeAt(0), "Y".charCodeAt(0), 25],
            'KeyZ': ["z".charCodeAt(0), "Z".charCodeAt(0), 26],
            'Digit0': ["0".charCodeAt(0), "0".charCodeAt(0), null],
            'Digit1': ["1".charCodeAt(0), "!".charCodeAt(0), null],
            'Digit2': ["2".charCodeAt(0), '"'.charCodeAt(0), null],
            'Digit3': ["3".charCodeAt(0), "#".charCodeAt(0), null],
            'Digit4': ["4".charCodeAt(0), "$".charCodeAt(0), null],
            'Digit5': ["5".charCodeAt(0), "%".charCodeAt(0), null],
            'Digit6': ["6".charCodeAt(0), "&".charCodeAt(0), null],
            'Digit7': ["7".charCodeAt(0), "'".charCodeAt(0), null],
            'Digit8': ["8".charCodeAt(0), "(".charCodeAt(0), null],
            'Digit9': ["9".charCodeAt(0), ")".charCodeAt(0), null],
            'Numpad0': ["y".charCodeAt(0), "y".charCodeAt(0), null], // yes response
            'Numpad1': ["b".charCodeAt(0), "b".charCodeAt(0), null],
            'Numpad2': ["j".charCodeAt(0), "j".charCodeAt(0), null],
            'Numpad3': ["n".charCodeAt(0), "n".charCodeAt(0), null],
            'Numpad4': ["h".charCodeAt(0), "h".charCodeAt(0), null],
            'Numpad5': ["s".charCodeAt(0), "s".charCodeAt(0), null], //search
            'Numpad6': ["l".charCodeAt(0), "l".charCodeAt(0), null],
            'Numpad7': ["y".charCodeAt(0), "y".charCodeAt(0), null],
            'Numpad8': ["k".charCodeAt(0), "k".charCodeAt(0), null],
            'Numpad9': ["u".charCodeAt(0), "u".charCodeAt(0), null],
            'NumpadEnter': [13, 13, 13], //Enter
            'NumpadPeriod': [".".charCodeAt(0), ".".charCodeAt(0), null],
            'NumpadAdd': ["+".charCodeAt(0), "+".charCodeAt(0), null],
            'NumpadSubtract': ["-".charCodeAt(0), "-".charCodeAt(0), null],
            'NumpadDevide': ["/".charCodeAt(0), "/".charCodeAt(0), null],
            'NumpadMultiply': ["*".charCodeAt(0), "*".charCodeAt(0), null],
            'Period': [".".charCodeAt(0), ">".charCodeAt(0), null],
            'Comma': [",".charCodeAt(0), "<".charCodeAt(0), null],
            'Minus': ["-".charCodeAt(0), "=".charCodeAt(0), null],
            'BracketLeft': ["@".charCodeAt(0), "`".charCodeAt(0), null], //get off/on switch
            'BracketRight': ["[".charCodeAt(0), "{".charCodeAt(0), null],
            'Quote': [":".charCodeAt(0), "*".charCodeAt(0), null],
            'Slash': ["/".charCodeAt(0), "?".charCodeAt(0), null],
            'Semicolon': [";".charCodeAt(0), "+".charCodeAt(0), null],
            'IntlRo': ["\\".charCodeAt(0), "_".charCodeAt(0), null],
            'Backslash': ["]".charCodeAt(0), "}".charCodeAt(0), null],
            'Equal': ["^".charCodeAt(0), "~".charCodeAt(0), null],
            'IntlYen': ["\\".charCodeAt(0), "|".charCodeAt(0), null],
        },
    };
    return d;
}