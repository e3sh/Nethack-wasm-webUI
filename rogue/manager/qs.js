/*
 * Special wizard command mode
 */
function quick_storage(r){

	const d = r.define;
	const f = r.func;
	const t = r.types;
	const v = r.globalValiable;


    this.save = function(){

        const OBJPTR = f.OBJPTR;
		const next = f.next;

        const s_know = r.item.s_know;	
        const p_know = r.item.p_know;	
        const r_know = r.item.r_know;	
        const ws_know = r.item.ws_know;

        let obj, pc;

        let sl = [];
		for (pc = r.player.get_pack(); pc != null; pc = next(pc)) {
			obj = OBJPTR(pc);
            sl.push({data: obj, equip: r.player.equipcheck(obj)})
		}
        let jsontext = JSON.stringify(sl);
        
        let json2 = JSON.stringify(r.player.get_player(), (key, value)=>{
            //custum
            const rejectKeys = ["t_pack", "t_room"];
            if (rejectKeys.includes(key)) return null; 
            return value;
        });
        
        let savedata = {
            level: r.dungeon.level,
            scr: s_know,
            pot: p_know,
            ws: ws_know,
            ring: r_know,
            food_left: r.player.food_left,
	        hung_st: r.player.hungry_state,
            purse: r.player.purse,
            maxstats: r.player.get_max_stats()
        }

        let svd = JSON.stringify(savedata);

        let dd = JSON.stringify(r.daemon.get_dlist());
        //console.log(dd);
 
        //console.log(jsontext);
        //console.log(json2);
        //console.log(svd);

        localStorage.setItem("rogue9.save", true);
        localStorage.setItem("rogue9.inventry", jsontext);
        localStorage.setItem("rogue9.player", json2);
        localStorage.setItem("rogue9.params", svd);
        localStorage.setItem("rogue9.daemons", dd);

        r.UI.comment("quick_save");
    }

    this.reset = function(){
        if (r.wizard) return;

        localStorage.removeItem("rogue9.save");
        localStorage.removeItem("rogue9.inventry");
        localStorage.removeItem("rogue9.player");
        localStorage.removeItem("rogue9.params");
        localStorage.removeItem("rogue9.daemons");

        r.UI.comment("quick_remove");
    }

    this.check = function(){
        return (Boolean(localStorage.getItem("rogue9.save")));
    }

    this.load = function(){

        const add_pack = r.item.pack_f.add_pack;
        const newgrp = r.item.things_f.newgrp;
        const resetgroup = r.item.things_f.resetgroup;
        const get_worth = r.dungeon.trader.get_worth;

        let inv;
        let pobj;
        let param;
        let daem;

        if (Boolean(localStorage.getItem("rogue9.save"))){
            //localStorage.removeItem("rogue.Save");
            if (Boolean(localStorage.getItem("rogue9.inventry"))) {
                inv = JSON.parse(localStorage.getItem("rogue9.inventry"));
                r.UI.comment("inv_load comp");

            }
            if (Boolean(localStorage.getItem("rogue9.player"))) {
                pobj = JSON.parse(localStorage.getItem("rogue9.player"));
                r.UI.comment("player_load comp");

            }
            if (Boolean(localStorage.getItem("rogue9.params"))) {
                param = JSON.parse(localStorage.getItem("rogue9.params"));
                r.UI.comment("param_load comp");
            }
                if (Boolean(localStorage.getItem("rogue9.daemons"))) {
                daem = JSON.parse(localStorage.getItem("rogue9.daemons"));
                r.UI.comment("daemon_load comp");
            }
            
            r.item.s_know = param.scr;	
            r.item.p_know = param.pot;	
            r.item.r_know = param.ring;	
            r.item.ws_know = param.ws;

            r.dungeon.level = param.level;
            r.player.food_left = param.food_left;
            r.player.hungry_state = param.hung_st;

            r.player.purse = param.purse;

            r.player.set_player(pobj);
            r.player.set_max_stats(param.maxstats);

            resetgroup();

            let before = {type: null, which: null, worth: null, group: null};

            for (let i in inv){

                let obj = inv[i].data;
                let eq = inv[i].equip;

                let worth = get_worth(obj); 

                if (obj.o_type != d.FOOD) {
                    if (before.type == obj.o_type && before.which == obj.o_which && before.worth == worth){
                        obj.o_group = before.group;
                    } else {
                        before.group = newgrp();
                        obj.o_group = before.group; 
                    }
                }
                before.type = obj.o_type;
                before.which = obj.o_which;
                before.worth = worth;

                let pl = r.new_item(obj);

                if (eq){
                    switch(obj.o_type){
                        case d.WEAPON:
                            r.player.set_cur_weapon(obj);
                        break;
                        case d.ARMOR:
                            r.player.set_cur_armor(obj);
                        break;
                        case d.RING:
                            let cur_ring = r.player.get_cur_ring();
                            if (cur_ring[d.LEFT] == null){
                                cur_ring[d.LEFT] = obj;
                            } else {
                                cur_ring[d.RIGHT] = obj;
                            }
                            r.player.set_cur_ring(cur_ring);
                        break;
                    }
                }
                add_pack(pl, true);
            }

            const chk_daemon = (label)=>{
                for (let fn in daem){
                    if (daem[fn].d_func == label){ 
                        return daem[fn].d_time;
                    }
                }
                return 0;
            }

            if (r.player.pl_on(d.ISHUH)) {
                r.daemon.fuse(r.daemon.unconfuse, true, chk_daemon("unconfuse"));
            }
            if (r.player.pl_on(d.CANSEE)) {
                r.daemon.fuse(r.daemon.unsee, true, chk_daemon("unsee"));
            }
            if (r.player.pl_on(d.ISBLIND)) {
                r.daemon.fuse(r.daemon.sight, true, chk_daemon("sight"));
            }
            if (r.player.pl_on(d.ISHASTE)) {
                r.daemon.fuse(r.daemon.nohaste, true, chk_daemon("nohaste"));
            }
            if (r.player.pl_on(d.ISETHER)) {
                r.daemon.fuse(r.daemon.noteth, true, chk_daemon("noteth"));
            }
            if (r.player.pl_on(d.ISSLOW)) {
                r.daemon.fuse(r.daemon.notslow, true, chk_daemon("notslow"));
            }
            if (r.player.pl_on(d.ISINVINC)) {
                r.daemon.fuse(r.daemon.notinvinc, true, chk_daemon("notinvinc"));
            }
            if (r.player.pl_on(d.ISREGEN)) {
                r.daemon.fuse(r.daemon.notregen, true, chk_daemon("notregen"));
            }
            //console.log(r.daemon.get_dlist());

            r.UI.comment("quick_load");
        }else{
            r.UI.comment("quick_load(nodata)");
        }
    }
}