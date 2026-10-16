/* src/driver/shim/shim_bridge.c
 * GKL 専用 統合ディスパッチャーブリッジ (再ビルドゼロ・完全版)
 * 公式NetHack 5.0 完全非侵襲・独立エクステンション
 * 
 * 本ファイルは WebUI リポジトリ (Nethack-wasm-webUI) にてバージョン管理される原本です。
 * scripts/build_wasm_50.ps1 の実行時に NetHack ソースツリーの win/shim/shim_bridge.c へ
 * 自動同期され、Wasm コアにリンクされます。
 */
#include "hack.h"

/* コマンドID定義 (GKLとCで共有するEnum) */
enum ShimBridgeCmd {
    /* 1. 地形・マップ・部屋系 (0x10〜0x1F) */
    SHIM_CMD_GET_CELL_INFO      = 0x10, /* a1=x, a2=y -> typ(8) | flags(8) | lit(1) | roomno(8) */
    SHIM_CMD_DUMP_LEVEL_TERRAIN = 0x11, /* buf=先頭ポインタ, len=80*21 -> 全フロアtyp一括コピー */
    SHIM_CMD_GET_TRAP_AT        = 0x12, /* a1=x, a2=y -> ttyp(8) | tseen(1) | once(1) (不在時 0) */
    SHIM_CMD_GET_ENGRAVING_AT   = 0x13, /* a1=x, a2=y, buf=char*, len=max -> 文字列コピー (返値: type) */
    SHIM_CMD_GET_ROOM_TYPE      = 0x14, /* a1=roomno -> rtype (SHOP, TEMPLE, ZOO, VAULT等) */
    SHIM_CMD_DUMP_LEVEL_GLYPHS  = 0x15, /* buf=int[80*21], len=80*21*sizeof(int) -> 全フロアglyph一括コピー */
    SHIM_CMD_GET_CELL_GLYPH     = 0x16, /* a1=x, a2=y -> back_to_glyph(x, y) (リアルタイム純粋地形グリフ) */

    /* 2. マップ上のエンティティ系 (0x20〜0x2F) */
    SHIM_CMD_GET_OBJECT_AT      = 0x20, /* a1=x, a2=y -> 先頭 struct obj* */
    SHIM_CMD_GET_MONSTER_AT     = 0x21, /* a1=x, a2=y -> struct monst* */
    SHIM_CMD_GET_MONSTER_INFO   = 0x22, /* a1=x, a2=y -> mpeaceful(1) | mtame(1) | mhp(12) | mhpmax(12) */
    SHIM_CMD_GET_MONSTER_STATE  = 0x23, /* a1=x, a2=y -> msleeping(1) | mflee(1) | mcanmove(1) | isshk(1) | ispriest(1) */

    /* 3. プレイヤー状態系 (0x30〜0x3F) */
    SHIM_CMD_GET_PLAYER_SUMMARY = 0x30, /* buf=long[8] -> [dnum, dlevel, ublesscnt, ugangr, uluck, ualign_record, uhunger, moves] */
    SHIM_CMD_GET_PLAYER_PTR     = 0x31, /* -> &u */
    SHIM_CMD_GET_PLAYER_PROPS   = 0x32, /* buf=long[LAST_PROP+1] -> uprops (耐性・能力配列一括コピー) */
    SHIM_CMD_GET_PLAYER_PROFILE = 0x33, /* buf=long[16]+strings(192B) -> [roleIdx, raceIdx, female, align, urole.mnum, urace.mnum, ulevel, initgend, align_record, 0...] + strings: role, race, plname */

    /* 4. インベントリ・装備・アイテム系 (0x40〜0x4F) */
    SHIM_CMD_GET_INVENT_PTR     = 0x40, /* -> gi.invent (所持品リンクリスト先頭) */
    SHIM_CMD_GET_EQUIPMENT_PTRS = 0x41, /* buf=long[14] -> [uwep, uswapwep, uquiver, uarm, uarmc, uarmh, uarms, uarmg, uarmf, uarmu, uamul, uleft, uright, ublindf] */
    SHIM_CMD_DUMP_OBJECT_INFO   = 0x42, /* a1=obj*, buf=long[8] -> [otyp, owt, quan, spe, oclass, invlet, flags, weight] */
    SHIM_CMD_DUMP_ALL_INVENT    = 0x43, /* buf=long[max*12], len=max_bytes -> 全所持品の一括ダンプ (返値: 件数) */

    /* 5. 呪文・スキル系 (0x50〜0x5F) */
    SHIM_CMD_DUMP_SPELL_BOOK    = 0x50, /* buf=int[(MAXSPELL+1)*3] -> [sp_id, sp_lev, sp_know] の3つ組配列 */
    SHIM_CMD_DUMP_SKILLS        = 0x51, /* buf=int[P_NUM_SKILLS*2] -> [skill, max_skill] 配列 (返値: weapon_slots) */

    /* 6. 発見・鑑定図鑑系 (0x60〜0x6F) */
    SHIM_CMD_DUMP_DISCOVERIES   = 0x60, /* buf=unsigned char[NUM_OBJECTS+1] -> oc_name_known 配列一括コピー */
    SHIM_CMD_GET_OBJECT_UNAME   = 0x61, /* a1=otyp, buf=char*, len=max -> oc_uname (仮名) コピー */
    SHIM_CMD_DUMP_DESCR_INDEXES = 0x62, /* buf=int[NUM_OBJECTS+1] -> oc_descr_idx 配列一括コピー */

    /* 7. 究極の保険：シンボル基底ポインタ直接取得 (0x70〜) */
    SHIM_CMD_GET_SYMBOL_PTR     = 0x70, /* a1=sym_id -> 各種主要構造体の基底アドレス */
};

/* シンボルID (0x70用) */
enum ShimSymbolId {
    SHIM_SYM_U         = 1, /* &u */
    SHIM_SYM_INVENT    = 2, /* &gi.invent */
    SHIM_SYM_LEVEL     = 3, /* &svl.level */
    SHIM_SYM_ROOMS     = 4, /* &svr.rooms */
    SHIM_SYM_OBJECTS   = 5, /* objects 配列 */
    SHIM_SYM_SPL_BOOK  = 6, /* &svs.spl_book */
    SHIM_SYM_MOVES     = 7, /* &svm.moves */
};

/* 唯一のエクスポート窓口関数 */
long shim_bridge_call(int cmd, long arg1, long arg2, void *buf, int len) {
    switch (cmd) {
        /* 1. 地形・マップ */
        case SHIM_CMD_GET_CELL_INFO: {
            int x = (int) arg1, y = (int) arg2;
            if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) return -1;
            return (long) (
                ((unsigned char) levl[x][y].typ) |
                (((unsigned char) levl[x][y].flags) << 8) |
                (((unsigned char) levl[x][y].lit) << 16) |
                (((unsigned char) levl[x][y].roomno) << 17)
            );
        }
        case SHIM_CMD_DUMP_LEVEL_TERRAIN: {
            if (!buf || len < (COLNO * ROWNO)) return -1;
            unsigned char *out = (unsigned char*) buf;
            for (int y = 0; y < ROWNO; y++) {
                for (int x = 0; x < COLNO; x++) {
                    out[y * COLNO + x] = (unsigned char) ((levl[x][y].typ & 0x7F) | (levl[x][y].lit ? 0x80 : 0));
                }
            }
            return 0;
        }
        case SHIM_CMD_DUMP_LEVEL_GLYPHS: {
            if (!buf || len < (int)(COLNO * ROWNO * sizeof(int))) return -1;
            int *out = (int*) buf;
            for (int y = 0; y < ROWNO; y++) {
                for (int x = 0; x < COLNO; x++) {
                    out[y * COLNO + x] = back_to_glyph(x, y);
                }
            }
            return 0;
        }
        case SHIM_CMD_GET_CELL_GLYPH: {
            int x = (int) arg1, y = (int) arg2;
            if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) return -1;
            return (long) back_to_glyph(x, y);
        }
        case SHIM_CMD_GET_TRAP_AT: {
            int x = (int) arg1, y = (int) arg2;
            if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) return 0;
            struct trap *t = t_at(x, y);
            if (!t) return 0;
            return (long) (
                ((unsigned char) t->ttyp) |
                ((t->tseen ? 1 : 0) << 8) |
                ((t->once ? 1 : 0) << 9)
            );
        }
        case SHIM_CMD_GET_ENGRAVING_AT: {
            int x = (int) arg1, y = (int) arg2;
            if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) return 0;
            struct engr *ep = engr_at(x, y);
            if (!ep) return 0;
            if (buf && len > 0 && ep->engr_txt[actual_text]) {
                strncpy((char*) buf, ep->engr_txt[actual_text], len - 1);
                ((char*) buf)[len - 1] = '\0';
            }
            return (long) ep->engr_type;
        }
        case SHIM_CMD_GET_ROOM_TYPE: {
            int roomno = (int) arg1;
            int idx = roomno - ROOMOFFSET;
            if (idx < 0 || idx >= MAXNROFROOMS) return OROOM;
            return (long) svr.rooms[idx].rtype;
        }

        /* 2. モンスター */
        case SHIM_CMD_GET_OBJECT_AT: {
            int x = (int) arg1, y = (int) arg2;
            if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) return 0;
            return (long) svl.level.objects[x][y];
        }
        case SHIM_CMD_GET_MONSTER_AT: {
            int x = (int) arg1, y = (int) arg2;
            if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) return 0;
            return (long) svl.level.monsters[x][y];
        }
        case SHIM_CMD_GET_MONSTER_INFO: {
            int x = (int) arg1, y = (int) arg2;
            if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) return -1;
            struct monst *m = svl.level.monsters[x][y];
            if (!m) return 0;
            int hp = m->mhp > 0 ? (m->mhp & 0xFFF) : 0;
            int hpmax = m->mhpmax > 0 ? (m->mhpmax & 0xFFF) : 0;
            return (long) (
                (m->mpeaceful ? 1 : 0) |
                ((m->mtame ? 1 : 0) << 1) |
                (hp << 8) |
                (hpmax << 20)
            );
        }
        case SHIM_CMD_GET_MONSTER_STATE: {
            int x = (int) arg1, y = (int) arg2;
            if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) return -1;
            struct monst *m = svl.level.monsters[x][y];
            if (!m) return 0;
            return (long) (
                (m->msleeping ? 1 : 0) |
                ((m->mflee ? 1 : 0) << 1) |
                ((m->mcanmove ? 0 : 1) << 2) | /* 1=麻痺/硬直 */
                ((m->mconf ? 1 : 0) << 3) |
                ((m->mstun ? 1 : 0) << 4) |
                ((m->isshk ? 1 : 0) << 5) |
                ((m->ispriest ? 1 : 0) << 6) |
                ((m->cham ? 1 : 0) << 7)
            );
        }

        /* 3. プレイヤー状態 */
        case SHIM_CMD_GET_PLAYER_SUMMARY: {
            if (!buf || len < (sizeof(long) * 8)) return -1;
            long *out = (long*) buf;
            out[0] = (long) u.uz.dnum;
            out[1] = (long) u.uz.dlevel;
            out[2] = (long) u.ublesscnt;
            out[3] = (long) u.ugangr;          /* 神の怒り */
            out[4] = (long) u.uluck;
            out[5] = (long) u.ualign.record;   /* 信仰値 */
            out[6] = (long) u.uhunger;         /* 空腹値 */
            out[7] = (long) svm.moves;         /* 総ターン数 */
            return 0;
        }
        case SHIM_CMD_GET_PLAYER_PTR: {
            return (long) &u;
        }
        case SHIM_CMD_GET_PLAYER_PROPS: {
            if (!buf || len < (sizeof(long) * (LAST_PROP + 1))) return -1;
            long *out = (long*) buf;
            for (int i = 0; i <= LAST_PROP; i++) {
                out[i] = (long) (u.uprops[i].intrinsic | (u.uprops[i].extrinsic << 16));
            }
            return 0;
        }
        case SHIM_CMD_GET_PLAYER_PROFILE: {
            if (!buf || len < (sizeof(long) * 16)) return -1;
            long *out = (long*) buf;
            int r_idx = flags.initrole;
            int rc_idx = flags.initrace;
            int is_fem = flags.female ? 1 : 0;

            out[0] = (long) r_idx;
            out[1] = (long) rc_idx;
            out[2] = (long) is_fem;
            out[3] = (long) u.ualign.type;
            out[4] = (long) gu.urole.mnum;
            out[5] = (long) gu.urace.mnum;
            out[6] = (long) u.ulevel;
            out[7] = (long) flags.initgend;
            out[8] = (long) u.ualign.record;
            for (int i = 9; i < 16; i++) {
                out[i] = 0;
            }

            if (len >= 256) {
                char *str_buf = (char*) buf;
                char *role_name_buf = str_buf + 64;   /* offset 64: role name */
                char *race_name_buf = str_buf + 128;  /* offset 128: race name */
                char *plname_buf    = str_buf + 192;  /* offset 192: player name */

                memset(role_name_buf, 0, 64);
                memset(race_name_buf, 0, 64);
                memset(plname_buf, 0, 64);

                /* ロール英語名 */
                if (r_idx >= 0 && r_idx < NUM_ROLES) {
                    const char *rname = (is_fem && roles[r_idx].name.f) ? roles[r_idx].name.f : roles[r_idx].name.m;
                    if (rname) {
                        strncpy(role_name_buf, rname, 63);
                    }
                }

                /* 種族英語名 */
                if (rc_idx >= 0 && rc_idx < NUM_RACES) {
                    const char *rcname = races[rc_idx].noun;
                    if (rcname) {
                        strncpy(race_name_buf, rcname, 63);
                    }
                }

                /* プレイヤー名 */
                if (svp.plname[0]) {
                    strncpy(plname_buf, svp.plname, 63);
                }
            }
            return 0;
        }

        /* 4. インベントリ・装備 */
        case SHIM_CMD_GET_INVENT_PTR: {
            return (long) gi.invent;
        }
        case SHIM_CMD_GET_EQUIPMENT_PTRS: {
            if (!buf || len < (sizeof(long) * 14)) return -1;
            long *out = (long*) buf;
            out[0]  = (long) uwep;
            out[1]  = (long) uswapwep;
            out[2]  = (long) uquiver;
            out[3]  = (long) uarm;
            out[4]  = (long) uarmc;
            out[5]  = (long) uarmh;
            out[6]  = (long) uarms;
            out[7]  = (long) uarmg;
            out[8]  = (long) uarmf;
            out[9]  = (long) uarmu;
            out[10] = (long) uamul;
            out[11] = (long) uleft;
            out[12] = (long) uright;
            out[13] = (long) ublindf;
            return 0;
        }
        case SHIM_CMD_DUMP_OBJECT_INFO: {
            struct obj *o = (struct obj*) arg1;
            if (!o || !buf || len < (sizeof(long) * 8)) return -1;
            long *out = (long*) buf;
            out[0] = (long) o->otyp;
            out[1] = (long) o->owt;
            out[2] = (long) o->quan;
            out[3] = (long) o->spe;
            out[4] = (long) o->oclass;
            out[5] = (long) o->invlet;
            out[6] = (long) (
                (o->blessed ? 1 : 0) |
                ((o->cursed ? 1 : 0) << 1) |
                ((o->bknown ? 1 : 0) << 2) |
                ((o->dknown ? 1 : 0) << 3) |
                ((o->rknown ? 1 : 0) << 4) |
                ((o->oeroded & 3) << 5) |
                ((o->oeroded2 & 3) << 7) |
                ((o->known ? 1 : 0) << 9)
            );
            out[7] = (long) ((o->quan >= 1) ? weight(o) : o->owt); /* 鞄の軽減・4倍補正込み真の重量 (quan < 1 時の impossible 回避) */
            if (len >= (sizeof(long) * 9)) {
                out[8] = (long) o->corpsenm;
            }
            return 0;
        }
        case SHIM_CMD_DUMP_ALL_INVENT: {
            if (!buf || len < (sizeof(long) * 12)) return 0;
            int max_items = len / (sizeof(long) * 12);
            int count = 0;
            long *out = (long*) buf;
            struct obj *o = gi.invent;
            while (o && count < max_items) {
                int base = count * 12;
                out[base + 0] = (long) o->otyp;
                out[base + 1] = (long) o->owt;
                out[base + 2] = (long) o->quan;
                out[base + 3] = (long) o->spe;
                out[base + 4] = (long) o->oclass;
                out[base + 5] = (long) o->invlet;
                out[base + 6] = (long) (
                    (o->blessed ? 1 : 0) |
                    ((o->cursed ? 1 : 0) << 1) |
                    ((o->bknown ? 1 : 0) << 2) |
                    ((o->dknown ? 1 : 0) << 3) |
                    ((o->rknown ? 1 : 0) << 4) |
                    ((o->oeroded & 3) << 5) |
                    ((o->oeroded2 & 3) << 7) |
                    ((o->known ? 1 : 0) << 9)
                );
                out[base + 7] = (long) ((o->quan >= 1) ? weight(o) : o->owt); /* 鞄の軽減・4倍補正込み真の重量 (quan < 1 時の impossible 回避) */
                out[base + 8] = (long) o;         /* 構造体ポインタ (装備スロット照合用) */
                out[base + 9] = (long) o->o_id;   /* NetHack 固有ID */
                out[base + 10] = (long) o->cobj;  /* コンテナ内包ポインタ */
                out[base + 11] = (long) o->corpsenm;
                count++;
                o = o->nobj;
            }
            return (long) count;
        }

        /* 5. 呪文・スキル */
        case SHIM_CMD_DUMP_SPELL_BOOK: {
            if (!buf || len < (sizeof(int) * (MAXSPELL + 1) * 3)) return -1;
            memset(buf, 0, len);
            int *out = (int*) buf;
            int count = 0;
            for (int i = 0; i < MAXSPELL && svs.spl_book[i].sp_id != NO_SPELL; i++) {
                out[count * 3 + 0] = (int) svs.spl_book[i].sp_id;
                out[count * 3 + 1] = (int) svs.spl_book[i].sp_lev;
                out[count * 3 + 2] = (int) svs.spl_book[i].sp_know;
                count++;
            }
            return (long) count;
        }
        case SHIM_CMD_DUMP_SKILLS: {
            if (!buf || len < (sizeof(int) * P_NUM_SKILLS * 2)) return -1;
            int *out = (int*) buf;
            for (int i = 0; i < P_NUM_SKILLS; i++) {
                out[i * 2 + 0] = (int) u.weapon_skills[i].skill;
                out[i * 2 + 1] = (int) u.weapon_skills[i].max_skill;
            }
            return (long) u.weapon_slots; /* 返値: 向上可能残りスロット数 */
        }

        /* 6. 発見図鑑 */
        case SHIM_CMD_DUMP_DISCOVERIES: {
            if (!buf || len < (NUM_OBJECTS + 1)) return -1;
            unsigned char *out = (unsigned char*) buf;
            for (int i = 0; i <= NUM_OBJECTS; i++) {
                out[i] = (unsigned char) objects[i].oc_name_known;
            }
            return 0;
        }
        case SHIM_CMD_GET_OBJECT_UNAME: {
            int otyp = (int) arg1;
            if (otyp < 0 || otyp > NUM_OBJECTS) return -1;
            if (!objects[otyp].oc_uname) return 0;
            if (buf && len > 0) {
                strncpy((char*) buf, objects[otyp].oc_uname, len - 1);
                ((char*) buf)[len - 1] = '\0';
            }
            return 1;
        }
        case SHIM_CMD_DUMP_DESCR_INDEXES: {
            if (!buf || len < (int)((NUM_OBJECTS + 1) * sizeof(int))) return -1;
            int *out = (int*) buf;
            for (int i = 0; i <= NUM_OBJECTS; i++) {
                out[i] = (int) objects[i].oc_descr_idx;
            }
            return (long) NUM_OBJECTS;
        }

        /* 7. 究極の保険：シンボル基底ポインタ */
        case SHIM_CMD_GET_SYMBOL_PTR: {
            switch ((int) arg1) {
                case SHIM_SYM_U:        return (long) &u;
                case SHIM_SYM_INVENT:   return (long) &gi.invent;
                case SHIM_SYM_LEVEL:    return (long) &svl.level;
                case SHIM_SYM_ROOMS:    return (long) &svr.rooms;
                case SHIM_SYM_OBJECTS:  return (long) objects;
                case SHIM_SYM_SPL_BOOK: return (long) &svs.spl_book;
                case SHIM_SYM_MOVES:    return (long) &svm.moves;
                default: return 0;
            }
        }

        default:
            return -1;
    }
}
