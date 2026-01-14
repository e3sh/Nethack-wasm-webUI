function rogueDefines(r) {

    /*
     * Maximum number of different things
     */
    const d = {
        NCOLORS: 32,
        NSYLS: 159,
        NSTONES: 35,
        NWOOD: 24,
        NMETAL: 15,

        MAXDAEMONS: 20,

        TYPETRAPS: 9,	/* max types of traps */
        MAXROOMS: 9,	/* max rooms per level */
        MAXTHINGS: 9,	/* max things on each level */
        MAXOBJ: 9,	/* max goodies on each level */
        MAXPACK: 23,	/* max things this hero can carry */
        MAXTRAPS: 10,	/* max traps per level */
        MAXMONS: 52,	/* max available monsters */
        MONRANGE: 20,	/* max # of monsters avail each level */
        AMLEVEL: 35,	/* earliest level that amulet can appear */
        MAXPURCH: 4,	/* max purchases in trading post */
        MINABIL: 3,	/* minimum for any ability */
        MAXSTR: 24,	/* maximum strength */
        MAXOTHER: 18,	/* maximum wis, dex, con */
        NORMAC: 10,	/* normal hero armor class (no armor) */
        MONWIS: 10,	/* monsters standard wisdom */

        NORMLEV: 0,	/* normal level */
        POSTLEV: 1,	/* trading post level */
        MAZELEV: 2,	/* maze level */

        NORMFOOD: 0,	/* normal food's group no. */
        FRUITFOOD: 1,	/* fruit's group no. */
        NEWGROUP: 2,	/* start of group no. other than food */

        NUMTHINGS: 8,	/* types of goodies for hero */
        TYP_POTION: 0,
        TYP_SCROLL: 1,
        TYP_FOOD: 2,
        TYP_WEAPON: 3,
        TYP_ARMOR: 4,
        TYP_RING: 5,
        TYP_STICK: 6,
        TYP_AMULET: 7,

        V_PACK: 3600,	/* max volume in pack */
        V_POTION: 50,	/* volume of potion */
        V_SCROLL: 80,	/* volume of scroll */
        V_FOOD: 35,	/* volume of food */
        V_WEAPON: 0,	/* volume of weapon (depends on wep) */
        V_ARMOR: 0,	/* volume of armor (depends on armor) */
        V_RING: 20,	/* volume of ring */
        V_STICK: 0,	/* volume of stick (depends on staff/wand) */
        V_AMULET: 30,	/* volume of amulet */

        V_WS_STAFF: 200,		/* volume of a staff */
        V_WS_WAND: 110,		/* volume of a wand */
        W_WS_STAFF: 100,		/* weight of a staff */
        W_WS_WAND: 60,	/* weight of a wand */

        FROMRING: 2,
        DONTCARE: -1,
        ANYTHING: -1,//,-1	/* DONTCARE, DONTCARE */

        K_ARROW: 240,		/* killed by an arrow */
        K_DART: 241,		/* killed by a dart */
        K_BOLT: 242,		/* killed by a bolt */
        K_POOL: 243,		/* killed by drowning */
        K_ROD: 244,		/* killed by an exploding rod */
        K_SCROLL: 245,		/* killed by a burning scroll */
        K_STONE: 246,		/* killed by materializing in rock */
        K_STARVE: 247,		/* killed by starvation */
        /*
        * return values for get functions
        */

        NORM: 0,		/* normal exit */
        QUIT: 1,		/* quit option setting */
        MINUS: 2,		/* back up one option */

        /*
        * Return values for games end
        */
        KILLED: 0,		/* hero was killed */
        CHICKEN: 1,		/* hero chickened out (quit) */
        WINNER: 2,		/* hero was a total winner */

        /*
        * return values for chase routines
        */
        CHASE: 0,		/* continue chasing hero */
        FIGHT: 1,		/* fight the hero */
        GONER: 2,		/* chaser fell into a trap */

        /*
        * Things that appear on the screens
        */
        PASSAGE: '#',
        DOOR: '+',
        FLOOR: '.',
        PLAYER: '@',
        POST: '^',
        MAZETRAP: '\\',
        TRAPDOOR: '>',
        ARROWTRAP: '{',
        SLEEPTRAP: '$',
        BEARTRAP: '}',
        TELTRAP: '~',
        DARTTRAP: '`',
        POOL: '"',
        SECRETDOOR: '&',
        STAIRS: '%',
        GOLD: '*',
        POTION: '!',
        SCROLL: '?',
        MAGIC: '$',
        FOOD: ':',
        WEAPON: ')',
        ARMOR: ']',
        AMULET: ',',
        RING: '=',
        STICK: '/',
        CALLABLE: -1,

        /*
        *	stuff to do with encumberence 
        */
        NORMENCB: 1500,	/* normal encumberence */
        SOMTHERE: 5,	/* something is in the way for dropping */
        CANTDROP: 6,	/* cant drop it cause its cursed */
        F_OKAY: 0,	/* have plenty of food in stomach */
        F_HUNGRY: 1,	/* player is hungry */
        F_WEAK: 2,	/* weak from lack of food */
        F_FAINT: 3,	/* fainting from lack of food */


        /*
        * Various constants
        */
        PASSWD: "mTuZ7WUV9RWkQ",
        BEARTIME: 3,
        SLEEPTIME: 5,
        HEALTIME: 30,
        HOLDTIME: 2,
        STPOS: 0,
        WANDERTIME: 70,
        BEFORE: 1,
        AFTER: 2,
        HUHDURATION: 20,
        SEEDURATION: 850,
        HUNGERTIME: 1300,
        WEAKTIME: 150,
        HUNGTIME: 300,		/* 2 * WEAKTIME */
        STOMACHSIZE: 2000,
        ESCAPE: 27,
        LEFT: 0,
        RIGHT: 1,
        BOLT_LENGTH: 6,

        STR: 1,
        DEX: 2,
        CON: 3,
        WIS: 4,

        /*
        * Save against things
        */
        VS_POISON: parseInt("00"),
        VS_PARALYZATION: parseInt("00"),
        VS_DEATH: parseInt("00"),
        VS_PETRIFICATION: parseInt("01"),
        VS_BREATH: parseInt("02"),
        VS_MAGIC: parseInt("03"),


        /*
        * Various flag bits
        */
        ISSTUCK: parseInt("0000001", 8),	/* monster can't run (violet fungi) */
        ISDARK: parseInt("0000001", 8),			/* room is dark */
        ISCURSED: parseInt("000001", 8),		/* object is cursed */
        ISBLIND: parseInt("0000001", 8),		/* hero is blind */
        ISPARA: parseInt("0000002", 8),		/* monster is paralyzed */
        ISGONE: parseInt("0000002", 8),		/* room is gone */
        ISKNOW: parseInt("0000002", 8),		/* object is known */
        ISRUN: parseInt("0000004", 8),		/* Hero & monsters are running */
        ISTREAS: parseInt("0000004", 8),		/* room is a treasure room */
        ISPOST: parseInt("0000004", 8),		/* object is in a trading post */
        ISFOUND: parseInt("0000010", 8),		/* trap is found */
        ISINVINC: parseInt("000010", 8),		/* player is invincible */
        ISINVIS: parseInt("0000020", 8),		/* monster is invisible */
        ISPROT: parseInt("0000020", 8),		/* object is protected somehow */
        ISMEAN: parseInt("0000040", 8),		/* monster is mean */
        ISBLESS: parseInt("0000040", 8),		/* object is blessed */
        ISGREED: parseInt("0000100", 8),		/* monster is greedy */
        ISWOUND: parseInt("0000200", 8),		/* monster is wounded */
        ISHELD: parseInt("0000400", 8),		/* hero is held fast */
        ISHUH: parseInt("0001000", 8),		/* hero | monster is confused */
        ISREGEN: parseInt("0002000", 8),		/* monster is regenerative */
        CANHUH: parseInt("0004000", 8),		/* hero can confuse monsters */
        CANSEE: parseInt("0010000", 8),		/* hero can see invisible monsters */
        WASHIT: parseInt("0010000", 8),		/* hero has hit monster at least once */
        ISMISL: parseInt("0020000", 8),		/* object is normally thrown in attacks */
        ISCANC: parseInt("0020000", 8),		/* monsters special attacks are canceled */
        ISMANY: parseInt("0040000", 8),		/* objects are found in a group (> 1) */
        ISSLOW: parseInt("0040000", 8),		/* hero | monster is slow */
        ISHASTE: parseInt("0100000", 8),		/* hero | monster is fast */
        ISETHER: parseInt("0200000", 8),		/* hero is thin as air */
        NONE: 100,		/* equal to 'd' (used for weaps) */


        /*
        * Potion types
        */
        P_CONFUSE: 0,	/* confusion */
        P_PARALYZE: 1,	/* paralysis */
        P_POISON: 2,	/* poison */
        P_STRENGTH: 3,	/* gain strength */
        P_SEEINVIS: 4,	/* see invisible */
        P_HEALING: 5,	/* healing */
        P_MFIND: 6,	/* monster detection */
        P_TFIND: 7,	/* magic detection */
        P_RAISE: 8,	/* raise level */
        P_XHEAL: 9,	/* extra healing */
        P_HASTE: 10,	/* haste self */
        P_RESTORE: 11,	/* restore strength */
        P_BLIND: 12,	/* blindness */
        P_NOP: 13,	/* thirst quenching */
        P_DEX: 14,	/* increase dexterity */
        P_ETH: 15,	/* etherealness */
        P_SMART: 16,	/* wisdom */
        P_REGEN: 17,	/* regeneration */
        P_SUPHERO: 18,	/* super ability */
        P_DECREP: 19,	/* decrepedness */
        P_INVINC: 20,	/* invicibility */
        MAXPOTIONS: 21,	/* types of potions */


        /*
        * Scroll types
        */
        S_CONFUSE: 0,		/* monster confusion */
        S_MAP: 1,		/* magic mapping */
        S_LIGHT: 2,		/* light */
        S_HOLD: 3,		/* hold monster */
        S_SLEEP: 4,		/* sleep */
        S_ARMOR: 5,		/* enchant armor */
        S_IDENT: 6,		/* identify */
        S_SCARE: 7,		/* scare monster */
        S_GFIND: 8,		/* gold detection */
        S_TELEP: 9,		/* teleportation */
        S_ENCH: 10,	/* enchant weapon */
        S_CREATE: 11,	/* create monster */
        S_REMOVE: 12,	/* remove curse */
        S_AGGR: 13,	/* aggravate monster */
        S_NOP: 14,	/* blank paper */
        S_GENOCIDE: 15,	/* genocide */
        S_KNOWALL: 16,	/* item knowledge */
        S_PROTECT: 17,	/* item protection */
        S_DCURSE: 18,	/* demons curse */
        S_DLEVEL: 19,	/* transport */
        S_ALLENCH: 20,	/* enchantment */
        S_BLESS: 21,	/* gods blessing */
        S_MAKEIT: 22,	/* aquirement */
        S_BAN: 23,	/* banishment */
        S_CWAND: 24,	/* charge wands */
        S_LOCTRAP: 25,	/* locate traps */
        MAXSCROLLS: 26,	/* types of scrolls */


        /*
        * Weapon types
        */
        MACE: 0,	/* mace */
        SWORD: 1,	/* long sword */
        BOW: 2,	/* short bow */
        ARROW: 3,	/* arrow */
        DAGGER: 4,	/* dagger */
        ROCK: 5,	/* rocks */
        TWOSWORD: 6,	/* two-handed sword */
        SLING: 7,	/* sling */
        DART: 8,	/* darts */
        CROSSBOW: 9,	/* crossbow */
        BOLT: 10,	/* crossbow bolt */
        SPEAR: 11,	/* spear */
        TRIDENT: 12,	/* trident */
        SPETUM: 13,	/* spetum */
        BARDICHE: 14,		/* bardiche */
        PIKE: 15,	/* pike */
        BASWORD: 16,	/* bastard sword */
        HALBERD: 17,	/* halberd */
        MAXWEAPONS: 18,	/* types of weapons */


        /*
        * Armor types
        */
        LEATHER: 0,	/* leather */
        RINGMAIL: 1,	/* ring */
        STUDDED: 2,	/* studded leather */
        SCALE: 3,	/* scale */
        PADDED: 4,	/* padded */
        CHAIN: 5,	/* chain */
        SPLINT: 6,	/* splint */
        BANDED: 7,	/* banded */
        PLATEMAIL: 8,	/* plate mail */
        PLATEARMOR: 9,	/* plate armor */
        MAXARMORS: 10,	/* types of armor */


        /*
        * Ring types
        */
        R_PROTECT: 0,	/* protection */
        R_ADDSTR: 1,	/* add strength */
        R_SUSTSTR: 2,	/* sustain strength */
        R_SEARCH: 3,	/* searching */
        R_SEEINVIS: 4,	/* see invisible */
        R_CONST: 5,	/* constitution */
        R_AGGR: 6,	/* aggravate monster */
        R_ADDHIT: 7,	/* agility */
        R_ADDDAM: 8,	/* increase damage */
        R_REGEN: 9,	/* regeneration */
        R_DIGEST: 10,	/* slow digestion */
        R_TELEPORT: 11,	/* teleportation */
        R_STEALTH: 12,	/* stealth */
        R_SPEED: 13,	/* speed */
        R_FTRAPS: 14,	/* find traps */
        R_DELUS: 15,	/* delusion */
        R_SUSAB: 16,	/* sustain ability */
        R_BLIND: 17,	/* blindness */
        R_SLOW: 18,	/* lethargy */
        R_GIANT: 19,	/* ogre strength */
        R_SAPEM: 20,	/* enfeeblement */
        R_HEAVY: 21,	/* burden */
        R_LIGHT: 22,	/* illumination */
        R_BREATH: 23,	/* fire protection */
        R_KNOW: 24,	/* wisdom */
        R_DEX: 25,	/* dexterity */
        MAXRINGS: 26,	/* types of rings */

        /*
        * Rod/Wand/Staff types
        */
        WS_LIGHT: 0,	/* light */
        WS_HIT: 1,	/* striking */
        WS_ELECT: 2,	/* lightning */
        WS_FIRE: 3,	/* fire */
        WS_COLD: 4,	/* cold */
        WS_POLYM: 5,	/* polymorph */
        WS_MISSILE: 6,	/* magic missile */
        WS_HASTE_M: 7,	/* haste monster */
        WS_SLOW_M: 8,	/* slow monster */
        WS_DRAIN: 9,	/* drain life */
        WS_NOP: 10,	/* nothing */
        WS_TELAWAY: 11,	/* teleport away */
        WS_TELTO: 12,	/* teleport to */
        WS_CANCEL: 13,	/* cancellation */
        WS_SAPLIFE: 14,	/* sap life */
        WS_CURE: 15,	/* curing */
        WS_PYRO: 16,	/* pyromania */
        WS_ANNIH: 17,	/* annihilate monster */
        WS_PARZ: 18,	/* paralyze monster */
        WS_HUNGER: 19,	/* food absorption */
        WS_MREG: 20,	/* regenerate monster */
        WS_MINVIS: 21,	/* hide monster */
        WS_ANTIM: 22,	/* anti-matter */
        WS_MOREMON: 23,	/* clone monster */
        WS_CONFMON: 24,	/* confuse monster */
        WS_MDEG: 25,	/* degenerate monster */
        MAXSTICKS: 26,	/* max types of sticks */

        MAXAMULETS: 1,		/* types of amulets */
        MAXFOODS: 1,		/* types of food */

        LINLEN: 80,		/* length of buffers */

        //EXTLKL	extern struct linked_list,
        //EXTTHG	extern struct thing,
        //EXTOBJ	extern struct object,
        //EXTSTAT extern struct stats,
        //EXTCORD	extern struct coord,
        //EXTMON	extern struct monster,
        //EXTARM	extern struct init_armor,
        //EXTWEP	extern struct init_weps,
        //EXTMAG	extern struct magic_item,
        //EXTROOM	extern struct room,
        //EXTTRAP	extern struct trap,
        //EXTINT	extern int,
        //EXTBOOL	extern bool,
        //EXTCHAR	extern char,

        //textFlameNumbers
        DSP_MAIN: 0,
        DSP_STATUS: 1,
        DSP_MESSAGE: 2,
        DSP_WINDOW: 3,
        DSP_MODE: 4,
        DSP_COMMENT: 5,

        COLS: 80,
        LINES: 24,

        //scene
        SCE_MAIN: 0,
        SCE_KEYWAIT: 1,
        SCE_INVENT: 2,
        SCE_GETITEM: 3,
        SCE_CREATE: 4,
        SCE_RESULT: 5,

        //colorchip
        COLORCHIP: {
            "Amber": 1,
            "Khaki": 1,
            "Aquamarine": 2,
            "Black": 3,
            "Blue": 4,
            "Brown": 5,
            "Clear": 6,
            "Crimson": 7,
            "Cyan": 8,
            "Ecru": 9,
            "Gold": 10,
            "Green": 11,
            "Grey": 12,
            "Magenta": 13,
            "Orange": 14,
            "Saffron": 14,
            "Pink": 15,
            "Plaid": 16,
            "Purple": 17,
            "Red": 18,
            "Silver": 19,
            "Tan": 20,
            "Beige": 20,
            "Tangerine": 21,
            "Topaz": 22,
            "Turquoise": 23,
            "Vermilion": 24,
            "Scarlet": 24,
            "Violet": 25,
            "White": 26,
            "Yellow": 27,
            "Indigo": 28,
            "Lavender": 29,
        },

        //nh parameters

        STAT_FLD: [
            "TITLE", //0
            "STR",  //1 
            "DEX",  //2
            "CON",  //3
            "INT",  //4
            "WIS",  //5
            "CHA",  //6
            "ALIGN",   //7
            "SCORE",   //8
            "CAP", //9
            "GOLD", //10
            "ENE", //11
            "ENEMAX", //12
            "XP", //13
            "AC", //14
            "HITDICE", //15
            "TIME", //16
            "HUNGER", //17
            "HP", //18
            "HPMAX", //19
            "DLEVEL", //20
            "EXP", //21
            "CONDITION", //22
            "VERS", //23
        ],

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

        //Keymap　キーボードの記号配列JIS
        KEYMAP: {
            'ArrowUp': 'k'.charCodeAt(0),
            'ArrowDown': 'j'.charCodeAt(0),
            'ArrowLeft': 'h'.charCodeAt(0),
            'ArrowRight': 'l'.charCodeAt(0),
            'Enter': 13,
            'Escape': 27,
            'Space': 32,
            'KeyA': "a".charCodeAt(0),
            'KeyB': "b".charCodeAt(0),
            'KeyC': "c".charCodeAt(0),
            'KeyD': "d".charCodeAt(0),  //Ctrl+D Kick
            'KeyE': "e".charCodeAt(0),
            'KeyF': "f".charCodeAt(0),
            'KeyG': "g".charCodeAt(0),
            'KeyH': "h".charCodeAt(0),
            'KeyI': "i".charCodeAt(0),
            'KeyJ': "j".charCodeAt(0),
            'KeyK': "k".charCodeAt(0),
            'KeyL': "l".charCodeAt(0),
            'KeyM': "m".charCodeAt(0),
            'KeyN': "n".charCodeAt(0),
            'KeyO': "o".charCodeAt(0),
            'KeyP': "p".charCodeAt(0),
            'KeyQ': "q".charCodeAt(0),
            'KeyR': "r".charCodeAt(0),
            'KeyS': "s".charCodeAt(0),
            'KeyT': "t".charCodeAt(0),
            'KeyU': "u".charCodeAt(0),
            'KeyV': "v".charCodeAt(0),
            'KeyW': "w".charCodeAt(0),
            'KeyX': "x".charCodeAt(0),
            'KeyY': "y".charCodeAt(0),
            'KeyZ': "z".charCodeAt(0),
            'Digit0': "0".charCodeAt(0),
            'Digit1': "1".charCodeAt(0),
            'Digit2': "2".charCodeAt(0),
            'Digit3': "3".charCodeAt(0),
            'Digit4': "4".charCodeAt(0),
            'Digit5': "5".charCodeAt(0),
            'Digit6': "6".charCodeAt(0),
            'Digit7': "7".charCodeAt(0),
            'Digit8': "8".charCodeAt(0),
            'Digit9': "9".charCodeAt(0),
            'Numpad0': "y".charCodeAt(0),// yes response
            'Numpad1': "b".charCodeAt(0),
            'Numpad2': "j".charCodeAt(0),
            'Numpad3': "n".charCodeAt(0),
            'Numpad4': "h".charCodeAt(0),
            'Numpad5': "s".charCodeAt(0), //search
            'Numpad6': "l".charCodeAt(0),
            'Numpad7': "y".charCodeAt(0),
            'Numpad8': "k".charCodeAt(0),
            'Numpad9': "u".charCodeAt(0),
            'NumpadEnter': 13, //Enter
            'NumpadPeriod': ".".charCodeAt(0),
            'NumpadAdd': ">".charCodeAt(0), //u-level
            'NumpadSubtract': "<".charCodeAt(0), //d-level
            'NumpadDevide': "/".charCodeAt(0),
            'NumpadMultiply': "*".charCodeAt(0),
            'Period': ".".charCodeAt(0),
            'Comma': ",".charCodeAt(0),
            'Minus': "=".charCodeAt(0),
            'NumpadSubtract': "-".charCodeAt(0),
            'BracketLeft': "@".charCodeAt(0), //get off/on switch
            'BracketRight': "[".charCodeAt(0),
            'Quote': "*".charCodeAt(0),//:
            'Slash': "?".charCodeAt(0), //?
            'Semicolon': ";".charCodeAt(0),
            'IntlRo': "\\".charCodeAt(0),
            'Backslash': "]".charCodeAt(0),
            'Equal': "=".charCodeAt(0),
        }
    };
    return d;
}