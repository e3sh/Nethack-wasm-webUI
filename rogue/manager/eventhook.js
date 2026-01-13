//nethack wasm shim eventhook
function eventhook(type, ...args) {
    console.log("NH Event:", type, args);
    switch (type) {
        case "shim_init_nhwindows":
            return 0;
        case "shim_putstr":
            this.UI.nhPutStr(args[0], args[1], args[2]);
            break;
        case "shim_curs":
            this.UI.nhCurs(args[0], args[1], args[2]);
            break;
        case "shim_clear_nhwindow":
            this.UI.nhClear(args[0]);
            break;
        case "shim_print_glyph":
            {
                const helpers = window.nethackGlobal.helpers;
                const gInfo = helpers.parseGlyphInfo(args[3]);
                const bkInfo = helpers.parseGlyphInfo(args[4]);
                this.UI.nhPrintGlyph(args[0], args[1], args[2], gInfo, bkInfo);
            }
            break;
        case "shim_nhgetch":
            return new Promise(resolve => {
                this.pendingInputResolve = resolve;
            });
        case "shim_askname":
            console.log("shim_askname called. Setting plname manually...");
            try {
                // Wasm の get_plname 関数を呼び出してポインタを取得
                const plnamePtr = Module._get_plname();
                if (plnamePtr) {
                    Module.stringToUTF8("player", plnamePtr, 32);
                    console.log("Directly wrote 'player' to plname at:", plnamePtr);
                } else {
                    console.warn("Could not get plname pointer from _get_plname().");
                }
            } catch (e) {
                console.error("plname setup error:", e);
            }
            return 0;
        case "shim_player_selection_or_tty":
            console.log("shim_player_selection_or_tty called. Returning true.");
            return true; // Use boolean true instead of number 1
        case "shim_wait_synch":
        case "shim_mark_synch":
            return 0;
        case "shim_yn_function":
            r.UI.msg(`${args[0]}`);
            return new Promise(resolve => {
                this.pendingInputResolve = resolve;
            });
        case "shim_exit_nhwindows":
            this.playing = false;
            if (typeof FS !== 'undefined' && typeof IDBFS !== 'undefined') {
                console.log("Saving game to IndexedDB...");
                FS.syncfs(false, (err) => {
                    if (err) console.error("IDBFS Sync Error (Save):", err);
                    else console.log("IDBFS Synced to IndexedDB (Save Complete)");
                });
            }
            return 0;
        default:
            return 0;
    }
};

function fook(type, args) {
    console.log("NH Event:", type, args);
    switch (type) {
        //VDECLCB(shim_init_nhwindows,(int *argcp, char **argv), "vpp", P2V argcp, P2V argv)
        case "shim_init_nhwindows":
            return 0;
        //DECLCB(boolean, shim_player_selection_or_tty,(void), "b")
        case "shim_player_selection_or_tty":
            console.log("shim_player_selection_or_tty called. Returning true.");
            return true;
        //VDECLCB(shim_askname,(void), "v")
        case "shim_askname":
            console.log("shim_askname called. Setting plname manually...");
            try {
                // Wasm の get_plname 関数を呼び出してポインタを取得
                const plnamePtr = Module._get_plname();
                if (plnamePtr) {
                    Module.stringToUTF8("player", plnamePtr, 32);
                    console.log("Directly wrote 'player' to plname at:", plnamePtr);
                } else {
                    console.warn("Could not get plname pointer from _get_plname().");
                }
            } catch (e) {
                console.error("plname setup error:", e);
            }
            return 0;
        //VDECLCB(shim_get_nh_event,(void), "v")
        case "shim_get_nh_event":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_exit_nhwindows,(const char *str), "vs", P2V str)
        case "shim_exit_nhwindows":
            this.playing = false;
            if (typeof FS !== 'undefined' && typeof IDBFS !== 'undefined') {
                console.log("Saving game to IndexedDB...");
                FS.syncfs(false, (err) => {
                    if (err) console.error("IDBFS Sync Error (Save):", err);
                    else console.log("IDBFS Synced to IndexedDB (Save Complete)");
                });
            }
            return 0;
        //VDECLCB(shim_suspend_nhwindows,(const char *str), "vs", P2V str)
        case "shim_suspend_nhwindows":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_resume_nhwindows,(void), "v")
        case "shim_resume_nhwindows":
            console.log("Not implemented");
            return 0;
        //DECLCB(winid, shim_create_nhwindow, (int type), "ii", A2P type)
        case "shim_create_nhwindow":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_clear_nhwindow,(winid window), "vi", A2P window)
        case "shim_clear_nhwindow":
            this.UI.nhClear(args[0]);
            break;
        //VDECLCB(shim_display_nhwindow,(winid window, boolean blocking), "vib", A2P window, A2P blocking)
        case "shim_display_nhwindow":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_destroy_nhwindow,(winid window), "vi", A2P window)
        case "shim_destroy_nhwindow":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_curs,(winid a, int x, int y), "viii", A2P a, A2P x, A2P y)
        case "shim_curs":
            this.UI.nhCurs(args[0], args[1], args[2]);
            break;
        //VDECLCB(shim_putstr,(winid w, int attr, const char *str), "viis", A2P w, A2P attr, P2V str)
        case "shim_putstr":
            this.UI.nhPutStr(args[0], args[1], args[2]);
            break;
        //VDECLCB(shim_display_file,(const char *name, boolean complain), "vsb", P2V name, A2P complain)
        case "shim_display_file":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_start_menu,(winid window, unsigned long mbehavior), "vii", A2P window, A2P mbehavior)
        case "shim_start_menu":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_add_menu,
        //    (winid window, const glyph_info *glyphinfo, const ANY_P *identifier, char ch, char gch, int attr, int clr, const char *str, unsigned int itemflags),
        //    "vipi00iisi",
        //    A2P window, P2V glyphinfo, P2V identifier, A2P ch, A2P gch, A2P attr, A2P clr, P2V str, A2P itemflags)
        case "shim_add_menu":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_end_menu,(winid window, const char *prompt), "vis", A2P window, P2V prompt)
        case "shim_end_menu":
            console.log("Not implemented");
            return 0;
        /* XXX: shim_select_menu menu_list is an output */
        //DECLCB(int, shim_select_menu,(winid window, int how, MENU_ITEM_P **menu_list), "iiip", A2P window, A2P how, P2V menu_list)
        case "shim_select_menu":
            console.log("Not implemented");
            return 0;
        //DECLCB(char, shim_message_menu,(char let, int how, const char *mesg), "ciis", A2P let, A2P how, P2V mesg)
        case "shim_message_menu":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_mark_synch,(void), "v")
        case "shim_mark_synch":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_wait_synch,(void), "v")
        case "shim_wait_synch":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_cliparound,(int x, int y), "vii", A2P x, A2P y)
        case "shim_cliparound":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_update_positionbar,(char *posbar), "vs", P2V posbar)
        case "shim_update_positionbar":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_print_glyph,(winid w, coordxy x, coordxy y, const glyph_info *glyphinfo, const glyph_info *bkglyphinfo), "vi11pp", A2P w, A2P x, A2P y, P2V glyphinfo, P2V bkglyphinfo)
        case "shim_print_glyph":
            {
                const helpers = window.nethackGlobal.helpers;
                const gInfo = helpers.parseGlyphInfo(args[3]);
                const bkInfo = helpers.parseGlyphInfo(args[4]);
                this.UI.nhPrintGlyph(args[0], args[1], args[2], gInfo, bkInfo);
            }
            break;
        //VDECLCB(shim_raw_print,(const char *str), "vs", P2V str)
        case "shim_raw_print":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_raw_print_bold,(const char *str), "vs", P2V str)
        case "shim_raw_print_bold":
            console.log("Not implemented");
            return 0;
        //DECLCB(int, shim_nhgetch,(void), "i")
        case "shim_nhgetch":
            return new Promise(resolve => {
                this.pendingInputResolve = resolve;
            });
        //DECLCB(int, shim_nh_poskey,(coordxy *x, coordxy *y, int *mod), "ippp", P2V x, P2V y, P2V mod)
        case "shim_nh_poskey":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_nhbell,(void), "v")
        case "shim_nhbell":
            console.log("Not implemented");
            return 0;
        //DECLCB(int, shim_doprev_message,(void),"iv")
        case "shim_doprev_message":
            console.log("Not implemented");
            return 0;
        //DECLCB(char, shim_yn_function,(const char *query, const char *resp, char def), "css0", P2V query, P2V resp, A2P def)
        case "shim_yn_function":
            this.UI.msg(`${args[0]}`);
            return new Promise(resolve => {
                this.pendingInputResolve = resolve;
            });
        //VDECLCB(shim_getlin,(const char *query, char *bufp), "vsp", P2V query, P2V bufp)
        case "shim_getlin":
            console.log("Not implemented");
            return 0;
        //DECLCB(int,shim_get_ext_cmd,(void),"iv")
        case "shim_get_ext_cmd":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_number_pad,(int state), "vi", A2P state)
        case "shim_number_pad":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_delay_output,(void), "v")
        case "shim_delay_output":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_change_color,(int color, long rgb, int reverse), "viii", A2P color, A2P rgb, A2P reverse)
        case "shim_change_color":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_change_background,(int white_or_black), "vi", A2P white_or_black)
        case "shim_change_background":
            console.log("Not implemented");
            return 0;
        //DECLCB(short, set_shim_font_name,(winid window_type, char *font_name),"2is", A2P window_type, P2V font_name)
        case "set_shim_font_name":
            console.log("Not implemented");
            return 0;
        //DECLCB(char *,shim_get_color_string,(void),"sv")
        case "shim_get_color_string":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_preference_update, (const char *pref), "vp", P2V pref)
        case "shim_preference_update":
            console.log("Not implemented");
            return 0;
        //DECLCB(char *,shim_getmsghistory, (boolean init), "sb", A2P init)
        case "shim_getmsghistory":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_putmsghistory, (const char *msg, boolean restoring_msghist), "vsb", P2V msg, A2P restoring_msghist)
        case "shim_putmsghistory":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_status_init, (void), "v")
        case "shim_status_init":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_status_enablefield,
        //    (int fieldidx, const char *nm, const char *fmt, boolean enable),
        //    "vippb",
        //    A2P fieldidx, P2V nm, P2V fmt, A2P enable)
        case "shim_status_enablefield":
            console.log("Not implemented");
            return 0;
        /* XXX: the second argument to shim_status_update is sometimes an integer and sometimes a pointer */
        //VDECLCB(shim_status_update,
        //    (int fldidx, genericptr_t ptr, int chg, int percent, int color, unsigned long *colormasks),
        //    "vipiiip",
        //    A2P fldidx, P2V ptr, A2P chg, A2P percent, A2P color, P2V colormasks)
        case "shim_status_update":
            console.log("Not implemented");
            return 0;
        //VDECLCB(shim_player_selection, (void), "v")
        case "shim_player_selection":
            console.log("Not implemented");
            return 0;

        //VDECLCB(shim_update_inventory,(int a1 UNUSED), "vi", A2P a1)
        case "shim_update_inventory":
            console.log("Not implemented");
            return 0;

        //DECLCB(win_request_info *, shim_ctrl_nhwindow,
        //    (winid window, int request, win_request_info *wri),
        //    "viip",
        //    A2P window, A2P request, P2V wri)
        case "shim_ctrl_nhwindow":
            console.log("Not implemented");
            return 0;


        case "genl_putmixed":
        // case "set_shim_font_name":
        // case "shim_get_color_string":
        case "genl_outrip":
        case "genl_status_finish":
        case "genl_status_enablefield":
        case "genl_status_update":
        case "genl_can_suspend_yes":
            console.log("Not implemented");
            return 0;
        default:
            console.log("Unknown event:", type);
            return 0;
    }
}
