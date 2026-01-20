/**
 * tileMapping
 * NetHack 3.7 Glyph ID to Tile Index Mapping Table
 * 
 * @param {object} offsets (optional) C-side constants (NUMMONS, GLYPH_*_OFF)
 * @description
 * win/share/tilemap.c の init_tilemap() ロジックを完全に再現し、
 * NetHack 3.7.0 のグリフIDをタイルインデックスに変換します。
 */
function tileMapping(offsets) {
    const m = {};
    // UIManager: Updating tile mapping with offsets Object
    offsets = {
        NUMMONS: 383,
        NUM_OBJECTS: 478,
        MAX_GLYPH: 9618,

        GLYPH_MON_OFF: 0,
        GLYPH_MON_FEM_OFF: 383, //NUMMONS,
        GLYPH_PET_OFF: 766, //NUMMONS * 2,
        GLYPH_PET_FEM_OFF: 1149, //NUMMONS * 3,
        GLYPH_INVIS_OFF: 1532, //NUMMONS * 4,
        GLYPH_DETECT_OFF: 1916, //NUMMONS * 4 + 1,
        GLYPH_DETECT_FEM_OFF: 1533, //NUMMONS * 5 + 1,
        GLYPH_BODY_OFF: 2299, //NUMMONS * 6 + 1,
        GLYPH_RIDDEN_OFF: 3448, //NUMMONS * 7 + 1,
        GLYPH_RIDDEN_FEM_OFF: 3065, //NUMMONS * 8 + 1,
        GLYPH_OBJ_OFF: 3448, //NUMMONS * 9 + 1,
        GLYPH_CMAP_OFF: 3926, //NUMMONS * 9 + 1 + NUM_OBJECTS,
    };

    // --- NetHack 3.7.0 Constants ---
    const NUMMONS = (offsets && offsets.NUMMONS) ? offsets.NUMMONS : 394;
    const NUM_OBJECTS = (offsets && offsets.NUM_OBJECTS) ? offsets.NUM_OBJECTS : 374;
    const CORPSE = 15; // Index of corpse in objects array

    // --- Default Offsets (if not provided by C-side) ---
    if (!offsets) {
        offsets = {
            GLYPH_MON_OFF: 0,
            GLYPH_MON_FEM_OFF: NUMMONS,
            GLYPH_PET_OFF: NUMMONS * 2,
            GLYPH_PET_FEM_OFF: NUMMONS * 3,
            GLYPH_INVIS_OFF: NUMMONS * 4,
            GLYPH_DETECT_OFF: NUMMONS * 4 + 1,
            GLYPH_DETECT_FEM_OFF: NUMMONS * 5 + 1,
            GLYPH_BODY_OFF: NUMMONS * 6 + 1,
            GLYPH_RIDDEN_OFF: NUMMONS * 7 + 1,
            GLYPH_RIDDEN_FEM_OFF: NUMMONS * 8 + 1,
            GLYPH_OBJ_OFF: NUMMONS * 9 + 1,
            GLYPH_CMAP_OFF: NUMMONS * 9 + 1 + NUM_OBJECTS,
        };
    }

    // --- Conditionals (from tilemap.c) ---
    // Predecessors that trigger tile skips
    const mon_conds = [
        26,
        180,
        227,
        313,
        313,
        368,
        368,
        368,
        368,
        368,
        382,
    ];
    const mon_conds_double = [
        218,
    ];

    const obj_conds = [
        66,  // matock
        68,  
        77,
    ];
    const obj_conds_del = [
        0, //0-16 GenericItem (After SetUp)
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        70,
        70,
        70,
        70,
        97,
        207,
        207,
        390,
    ];

    let tilenum = 0;

    // --- Calculate corpsetile and swallowbase (replicate tilemap.c logic) ---
    let corpsetile = NUMMONS * 2 + 1 + CORPSE;
    let swallowbase = NUMMONS * 2 + 1 + NUM_OBJECTS + 1 + 11 + 29 + 5 + 32 + 32 + 11;
    // Wait, the above is a simplification. Let's do it precisely based on conditionals.

    // Adjust corpsetile and swallowbase for monster conditionals
    for (let i = 0; i < NUMMONS; i++) {
        mon_conds.forEach(pred => {
            if (pred === i) {
                corpsetile += 1;
            }
        });
    }
    // Adjust for object conditionals that come before CORPSE
    obj_conds.forEach(pred => {
        if (pred < CORPSE) corpsetile++;
    });

    // --- 1. Monsters ---
    for (let i = 0; i < NUMMONS; i++) {
        // Male tile
        m[offsets.GLYPH_MON_OFF + i] = tilenum;
        m[offsets.GLYPH_PET_OFF + i] = tilenum;
        m[offsets.GLYPH_DETECT_OFF + i] = tilenum;
        m[offsets.GLYPH_RIDDEN_OFF + i] = tilenum;
        m[offsets.GLYPH_BODY_OFF + i] = corpsetile;

        //tilenum++;

        // Female tile
        m[offsets.GLYPH_MON_FEM_OFF + i] = tilenum;
        m[offsets.GLYPH_PET_FEM_OFF + i] = tilenum;
        m[offsets.GLYPH_DETECT_FEM_OFF + i] = tilenum;
        m[offsets.GLYPH_RIDDEN_FEM_OFF + i] = tilenum;

        // Statue male 7223/ f7606
        m[offsets.GLYPH_MON_OFF + i + 7223] = tilenum + 1082;
        m[offsets.GLYPH_MON_FEM_OFF + i +7223] = tilenum + 1082;

        // piletop_status item 8007,  mons body8467/ m8850 f9233
        m[offsets.GLYPH_MON_OFF + i + 8467] = tilenum;
        m[offsets.GLYPH_MON_OFF + i + 8850] = tilenum + 1082;
        m[offsets.GLYPH_MON_FEM_OFF + i +8850] = tilenum + 1082;

        m[4090 + i*8     ] = 929; //G_swallow_
        m[4090 + i*8 + 1 ] = 930;
        m[4090 + i*8 + 2 ] = 931;
        m[4090 + i*8 + 3 ] = 932;
        m[4090 + i*8 + 4 ] = 933;
        m[4090 + i*8 + 5 ] = 934;
        m[4090 + i*8 + 6 ] = 935;
        m[4090 + i*8 + 7 ] = 936;

        tilenum++;

        // Handle monster conditionals (skip male/female tiles for conditional monsters)
        mon_conds.forEach(pred => {
            if (pred === i) {
                tilenum += 1;
            }
        });
        mon_conds_double.forEach(pred => {
            if (pred === i) {
                tilenum -=1;
            }
        });
    }

    // Invisible monster
    m[offsets.GLYPH_INVIS_OFF] = tilenum;
    tilenum++;

    // --- 2. Objects ---
    for (let i = 0; i < NUM_OBJECTS; i++) {
        m[offsets.GLYPH_OBJ_OFF + i] = tilenum;
        m[offsets.GLYPH_OBJ_OFF + i + (7989-offsets.GLYPH_OBJ_OFF)] = tilenum;

        // Handle object conditionals_delete
        obj_conds_del.forEach(pred => {
            if (pred === i) {
                tilenum--;
            }
        });
        // Handle object conditionals
        obj_conds.forEach(pred => {
            if (pred === i) {
                tilenum++;
            }
        });
        tilenum++;
    }
    m[3519] = 444; //G_dwarvish_mattock
    m[3523] = 450; //G_morning_star
    m[3521] = 452; //G_mace
    m[3522] = 452; //G_silver_mace

    const widx = (7989-offsets.GLYPH_OBJ_OFF)   
    m[3519 + widx] = 444; //G_dwarvish_mattock
    m[3523 + widx] = 450; //G_morning_star
    m[3521 + widx] = 452; //G_mace
    m[3522 + widx] = 452; //G_silver_mace

    // --- 3. Other (CMAP, Zaps, etc.) ---
    // CMAP starts after objects
    let cmap_off = offsets.GLYPH_CMAP_OFF;

    // Stone
    //(3926) G_stone_substrate
    m[cmap_off + 0] = tilenum++; // S_stone

    const wallset = ( index, tile )=>{
        for (let i = 0; i <= 10; i++) {
            m[index + i] = tile + i;
        }
    }

    wallset(3927,  851); //normalDungeon wall
    wallset(3938, 1038 ); //mines wall
    wallset(3949, 1049 ); //gehennom wall
    wallset(3960, 1060 ); //knox wall
    wallset(3971, 1071 ); //sokoban wall

    m[3982] = 862;  //Doorway
    m[3983] = 865;  //G_vodoor
    m[3984] = 866;  //G_hodoor
    m[3985] = 865;  //G_vcdoor
    m[3986] = 866;  //G_hcdoor

    m[3987] = 867;  //G_bars

    //after custum tile 

    m[3988] = 868; //G_tree

    m[3989] = 863;   // G_room
    m[3990] = 869;   // G_darkroom
    m[3991] = 872;   // G_engroom

    m[3992] = 871;   // G_corr
    m[3993] = 863;   // G_litcorr
    m[3994] = 872;   // G_engrcorr

    m[3995] = 873;   // G_upstair
    m[3996] = 874;   // G_dnstair
    m[3997] = 873;   // G_upladder
    m[3998] = 874;   // G_dnladder
    m[3999] = 875;   // G_brupstair
    m[4000] = 876;   // G_brdnstair
    m[4001] = 875;   // G_brupladder
    m[4002] = 876;   // G_brdnladder

    m[4003] = 877;   // G_unaligned_altar
    m[4004] = 877;   // G_chaotic_altar
    m[4005] = 877;   // G_neutral_altar
    m[4006] = 877;   // G_lawful_altar
    m[4007] = 877;   // G_altar_other

    m[4008] = 878;   // G_grave
    m[4009] = 879;   // G_throne
    m[4010] = 880;   // G_sink
    m[4011] = 881;   // G_fountain
    m[4012] = 882;   // G_pool
    m[4013] = 883;   // G_ice
    m[4014] = 884;   // G_lava
    m[4015] = 884;   // G_lavawall

    m[4016] = 885;   // G_vodbridge
    m[4017] = 886;   // G_hodbridge
    m[4018] = 888;   // G_vcdbridge
    m[4019] = 887;   // G_hcdbridge

    m[4020] = 889;   // G_air
    m[4021] = 890;   // G_cloud
    m[4022] = 891;   // G_water
    m[4023] = 892;   // G_arrow_trap
    m[4024] = 893;   // G_dart_trap
    m[4025] = 894;   // G_falling_rock_trap
    m[4026] = 895;   // G_squeaky_board
    m[4027] = 896;   // G_bear_trap
    m[4028] = 897;   // G_land_mine
    m[4029] = 898;   // G_rolling_boulder_trap
    m[4030] = 899;   // G_sleeping_gas_trap
    m[4031] = 900;   // G_rust_trap
    m[4032] = 901;   // G_fire_trap

    m[4033] = 902;   // G_pit
    m[4034] = 903;   // G_spiked_pit
    m[4035] = 904;   // G_hole
    m[4036] = 905;   // G_trap_door
    m[4037] = 906;   // G_teleportation_trap
    m[4038] = 907;   // G_level_teleporter
    m[4039] = 908;   // G_magic_portal
    m[4040] = 909;   // G_web
    m[4041] = 910;   // G_statue_trap
    m[4042] = 911;   // G_magic_trap
    m[4043] = 912;   // G_anti_magic_trap
    m[4044] = 913;   // G_polymorph_trap
    m[4045] = 914;   // G_vibrating_square
    m[4046] = 865;   // G_trapped_door
    m[4047] = 585;   // G_trapped_chest
    m[4048] = 915;   // G_missile_zap_vbeam
    m[4049] = 916;   // G_missile_zap_hbeam
    m[4050] = 917;   // G_missile_zap_lslant
    m[4051] = 918;   // G_missile_zap_rslant
    m[4052] = 982;   // G_fire_zap_vbeam
    m[4053] = 983;   // G_fire_zap_hbeam
    m[4054] = 984;   // G_fire_zap_lslant
    m[4055] = 985;   // G_fire_zap_rslant
    m[4056] = 964;   // G_frost_zap_vbeam
    m[4057] = 965;   // G_frost_zap_hbeam
    m[4058] = 966;   // G_frost_zap_lslant
    m[4059] = 967;   // G_frost_zap_rslant
    m[4060] = 920;   // G_sleep_zap_vbeam
    m[4061] = 920;   // G_sleep_zap_hbeam
    m[4062] = 920;   // G_sleep_zap_lslant
    m[4063] = 920;   // G_sleep_zap_rslant
    m[4064] = 919;   // G_death_zap_vbeam
    m[4065] = 919;   // G_death_zap_hbeam
    m[4066] = 919;   // G_death_zap_lslant
    m[4067] = 919;   // G_death_zap_rslant
    m[4068] = 925;   // G_lightning_zap_vbeam
    m[4069] = 925;   // G_lightning_zap_hbeam
    m[4070] = 925;   // G_lightning_zap_lslant
    m[4071] = 925;   // G_lightning_zap_rslant
    m[4072] = 927;   // G_poison_gas_zap_vbeam
    m[4073] = 927;   // G_poison_gas_zap_hbeam
    m[4074] = 927;   // G_poison_gas_zap_lslant
    m[4075] = 927;   // G_poison_gas_zap_rslant
    m[4076] = 923;   // G_acid_zap_vbeam
    m[4077] = 923;   // G_acid_zap_hbeam
    m[4078] = 923;   // G_acid_zap_lslant
    m[4079] = 923;   // G_acid_zap_rslant
    m[4080] = 924;   // G_digbeam
    m[4081] = 925;   // G_flashbeam
    m[4082] = 922;   // G_boomleft
    m[4083] = 921;   // G_boomright
    m[4084] = 923;   // G_ss1
    m[4085] = 924;   // G_ss2
    m[4086] = 925;   // G_ss3
    m[4087] = 926;   // G_ss4
    m[4088] = 927;   // G_poisoncloud
    m[4089] = 928;   // G_goodpos

    tilenum = 937;
    for (let i=0; i<8; i++){
        for (let j=0; j<8; j++){
        m[7154 + i*8 + j ] = tilenum++;
        }
    }
    tilenum = 1032;
    for (let i=0; i<6; i++){
        m[7217 + i ] = tilenum++;
    }
    m[9616] = 1032; // G_unexplored
    m[9617] = 1032; // G_nothing

    return m;
}

