function scene(r){

	const d = r.define;
	const f = r.func;
	const t = r.types;
	const v = r.globalValiable;
	const ms = r.messages;

    const cw = d.DSP_MAIN_FG;
    const mw = d.DSP_MAIN_BG;
    const hw = d.DSP_WINDOW;

    let select_cur = 0;
    this.setcur = (num)=>{ select_cur = num;}
    this.getcur = ()=>{ return select_cur;  }

    let purpose;
    let type;
    this.set_gi_param =(pur, t )=>{
        purpose = pur;
        type = t;
    }

    //scene key_wait
    this.keywait = function(){

        let ki = r.UI.readchar();

        if (r.rstime + 500 < r.getGametime()){
            if (!r.rsmsg_f){
                r.UI.msg(" ");
                r.UI.msg("Push Return to NewGame");
                r.rsmsg_f = true;
            }
            if (ki.includes("Enter") ||
                ki.includes("NumpadEnter")){

                r.UI.overlapview(false);    
                r.item.reset_mi_probs();
                r.main();
                r.setScene(d.SCE_MAIN);
            }
        }
    }

    //scene_inventry
    this.inventry = function(){

        const curItem =(cur)=>{
            packcount = 0;
            for (pk = pack; pk != null; pk = f.next(pk)){
                if (packcount == cur) return pk.l_data; 
                packcount++;
            }
            return null
        }

        const pack = r.player.get_pack();
        let cur = r.UI.scene.getcur();

        let pk, packcount = 0;

        r.UI.setDsp(hw);
        for (pk = pack; pk != null; pk = f.next(pk)){
			r.UI.mvaddch(packcount ,2, " ");
            packcount++;
        }

    	let ki = r.UI.readchar();   

		if (ki.includes("Enter")    || ki.includes("NumpadEnter")||
            ki.includes("Numpad4")  || ki.includes("Numpad6")   ||
			ki.includes("ArrowLeft")|| ki.includes("ArrowRight")||
            ki.includes("KeyI")     || ki.includes("Numpad5") 
        ){
            //selectReturn
            r.player.set_select(curItem(cur));
            r.UI.io.status();
            r.UI.overlapview(false);
            r.setScene(d.SCE_MAIN);
        }
		if (ki.includes("Numpad8")||ki.includes("Numpad2")||
            ki.includes("NumpadSubtract")||ki.includes("NumpadAdd")||
			ki.includes("ArrowUp")||ki.includes("ArrowDown")
        ){
            cur += 
                (ki.includes("NumpadSubtract") || ki.includes("ArrowUp") || ki.includes("Numpad8"))
                ?-1:+1;
            
            if (cur < 0)  cur = packcount-1;
            if (cur >= packcount)  cur = 0;
            r.UI.scene.setcur(cur);
        }
		if (ki.includes("Numpad0")){
           // console.log("UseItem");
            r.player.set_select(curItem(cur));
            r.item.decode_cmd(true);

            r.UI.overlapview(false);
            r.setScene(d.SCE_MAIN);
        }
        if (ki.includes("KeyD")){
            //console.log("Drop/ThrowItem");
            //r.player.set_select(curItem(cur));
            //r.item.decode_drop(true);
            //r.player.set_select(null);
            r.UI.overlapview(false);
            r.setScene(d.SCE_MAIN);
        }
        r.UI.mvaddch(cur ,2, ">");
    }

    //scene get_item
    this.get_item = ()=>{
        const identify = r.item.scroll_f.identify;
        const protect = r.item.scroll_f.protect;
        const enchant = r.item.scroll_f.enchant;
        const drop = r.item.things_f.drop;

        const curItem =(cur)=>{
            packcount = 0;
            for (pk = pack; pk != null; pk = f.next(pk)){
                pob = f.OBJPTR(pk);
                if (type == 0 || type == pob.o_type) {
                    if (packcount == cur) return pk; 
                    packcount++;
                }
            }
            return null
        }

        const pack = r.player.get_pack();
        let cur = r.UI.scene.getcur();

        let pk, pob, packcount = 0;

        r.UI.setDsp(hw);
        for (pk = pack; pk != null; pk = f.next(pk)){
            pob = f.OBJPTR(pk);
            if (type == 0 || type == pob.o_type) {
    			r.UI.mvaddch(packcount ,2, " ");
                packcount++;
            }
        }
        r.UI.mvaddch(cur ,2, " ");

    	let ki = r.UI.readchar();   

        //select
		if (ki.includes("Enter")    || ki.includes("NumpadEnter")||
            ki.includes("Numpad0")  || ki.includes("KeyD")
        ){
            //console.log(purpose);
            //selectReturn
            //r.player.set_dest(curItem(cur));
            if (purpose == "protect"){
                protect(curItem(cur));
            }else if (purpose == "enchant"){
                enchant(curItem(cur));
            }else if (purpose == "identify"){
                identify(curItem(cur)); 
            }else if (purpose == "drop"){
                drop(curItem(cur)); 
            }
            r.UI.io.status();
            r.UI.overlapview(false);
            r.setScene(d.SCE_MAIN);
        }
       
        //escape
		if (ki.includes("Numpad4")  || ki.includes("Numpad6")   ||
			ki.includes("ArrowLeft")|| ki.includes("ArrowRight")||
            ki.includes("Numpad5")  || ki.includes("KeyI")
        ){
            //r.UI.msg("get_item select cansel.")
            //r.UI.io.status();
            //r.UI.overlapview(false);
            //r.setScene(d.SCE_MAIN);
        }
        //movecursur
		if (ki.includes("Numpad8")||ki.includes("Numpad2")||
            ki.includes("NumpadSubtract")||ki.includes("NumpadAdd")||
			ki.includes("ArrowUp")||ki.includes("ArrowDown")
        ){
            cur += 
                (ki.includes("NumpadSubtract") || ki.includes("ArrowUp") || ki.includes("Numpad8"))
                ?-1:+1;
            
            if (cur < 0)  cur = packcount-1;
            if (cur >= packcount)  cur = 0;
            r.UI.scene.setcur(cur);
        }
        r.UI.mvaddch(cur ,2, ">");
    }

    //create_obj
    let co_line = 0;
    let co_col = 0;

    let sel_t = 0;
    let sel_w = 0;

    let resch = "-";
    let reswhich = 0;

    //const 
	const itemsdb =[
		{i_name:"weapon",       i_type:d.WEAPON,    i_which:v.w_magic },
		{i_name:"armor" ,       i_type:d.ARMOR ,    i_which:v.a_magic },
		{i_name:"scroll",       i_type:d.SCROLL,    i_which:v.s_magic },
		{i_name:"potion",       i_type:d.POTION,    i_which:v.p_magic },
		{i_name:"wand and staff", i_type:d.STICK,   i_which:v.ws_magic },
		{i_name:"ring"  ,       i_type:d.RING  ,    i_which:v.r_magic }, //mi_name
        {i_name:"food",         i_type:d.FOOD,      i_which:[{mi_name:"Some Food"}]},
        {i_name:"amulet",       i_type:d.AMULET,    i_which:[{mi_name:"Amulet of Yender"}]},
        {i_name:"monster"  ,    i_type:d.CALLABLE,  i_which:v.monsters }, //m_name, m_show
	]

    this.create_obj = ()=>{

        cobj_scene();

        let ki = r.UI.readchar();   

        //select
		if (ki.includes("Enter")    || ki.includes("NumpadEnter")||
            ki.includes("Numpad0")  || ki.includes("KeyD")
        ){
            //exec
            if (co_line == 2){
                r.UI.wizard.create_obj_exec(true, resch, reswhich);

                r.UI.io.status();
                r.UI.overlapview(false);
                r.setScene(d.SCE_MAIN);
            }
            //quit
            if (co_line == 3){
                r.UI.msg("create_object select cansel.")
                r.UI.io.status();
                r.UI.overlapview(false);
                r.setScene(d.SCE_MAIN);
            }
        }

        //escape
		if (ki.includes("Numpad4")  || ki.includes("Numpad6")   ||
			ki.includes("ArrowLeft")|| ki.includes("ArrowRight")
        ){
            co_col += 
                (ki.includes("ArrowLeft") || ki.includes("Numpad4"))
                ?-1:+1;
        }
        //movecursur
		if (ki.includes("Numpad8")||ki.includes("Numpad2")||
            ki.includes("NumpadSubtract")||ki.includes("NumpadAdd")||
			ki.includes("ArrowUp")||ki.includes("ArrowDown")
        ){
            co_line += 
                (ki.includes("NumpadSubtract") || ki.includes("ArrowUp") || ki.includes("Numpad8"))
                ?-1:+1;
        }

        if (co_line == 0){
            let maxnum = itemsdb.length - (r.wizard?1:3);
            if (co_col < 0) co_col = 0;
            if (co_col > maxnum) co_col = maxnum;
            sel_t = co_col;
        }
        if (co_line == 1){
            if (co_col < 0) co_col = 0;
            if (co_col > itemsdb[sel_t].i_which.length-1) co_col = itemsdb[sel_t].i_which.length-1;
            sel_w = co_col;
        }
        if (co_line < 0) co_line = 3;
        if (co_line > 3) co_line = 0;

        if (sel_t > itemsdb.length-1) sel_t = itemsdb.length-1;
        if (itemsdb[sel_t].i_which.length > 1){
            if (sel_w > itemsdb[sel_t].i_which.length-2) sel_w = itemsdb[sel_t].i_which.length-2;
        }else{
            sel_w = 0;
        }

        cobj_scene();
    }

    function cobj_scene(){

        const type = itemsdb[sel_t];
        const db = itemsdb[sel_t].i_which;

        let wshow = " ";
        let which = "?";    
        if (type.i_type == d.CALLABLE){
            wshow = " " +db[sel_w].m_show;
            which = db[sel_w].m_name;

            resch = db[sel_w].m_show;
            reswhich = 0;

        } else {
            which = db[sel_w].mi_name;

            resch = type.i_type;
            reswhich = sel_w;
        }

        let menu = [];
        menu.push(`Create Object ) ${resch} ${reswhich}`);
        menu.push("");
        menu.push(` type : ${type.i_type} ${type.i_name}`);
        menu.push(` which:${wshow} ${which}` );
        menu.push(" [execute]");
        menu.push(" [quit]");
        menu.push("");
        menu.push("SELECT ON [Enter][0][D]");

        r.UI.wclear(hw);
        r.UI.setDsp(hw);

        for (let i in menu){
            r.UI.mvaddch(i ,0, menu[i]);
        }

        r.UI.mvaddch(2+ co_line ,0, ">");
    }
    
    let col = 0, curw = 0;
	this.title = function(){

  		title_menu();

        let ki = r.UI.readchar();
        if (ki.includes("ArrowDown")||ki.includes("ArrowUp")){
			col +=((ki.includes("ArrowDown"))?1:-1);
		}
        if (ki.includes("ArrowRight")||ki.includes("ArrowLeft")){
			curw +=((ki.includes("ArrowRight"))?1:-1);
		}
        if (ki.includes("Numpad2")||ki.includes("Numpad8")){
			col +=((ki.includes("Numpad2"))?1:-1);
		}

        title_menu();

		if (r.UI.wait_for("Enter")||r.UI.wait_for("NumpadEnter")){
			let io = g.task.read("io");
			io.overlapview = null;
            if (col == 3){
                r.beginproc(true);
            }
            r.setScene(d.SCE_MAIN);
		}
 	}

	function title_menu(){

		switch(col)
		{
			case 2:
				// initPlayer
				break;
			case 3:
				// load Web Storage
				break;
			default:
				break;
		}

		if (col < 2) col = 2; else if (col >3) col = 3;

		const menu = [
			"Rogue: Exploring the Dungeons of Doom",
			"",
			`NEW GAME`,
			`CONTINUE (AUTOSAVE) `,
			"",
			"Push ENTER to START",
		]

		let io = g.task.read("io");
		io.overlapview = true;

		r.UI.clear(6);
		for (let i in menu){
			r.UI.submvprintw(i, 0, `${(col == i && (col >=2 && col <=3))?">":" "} ${menu[i]}`, true);
		}
	}

    this.result = function(){

        let ki = r.UI.readchar();

        if (r.rstime + 500 < r.getGametime()){
            if (!r.rsmsg_f){
                r.UI.msg(" ");
                r.UI.msg("Push Return to Result");
                r.rsmsg_f = true;
            }
            if (ki.includes("Enter") ||
                ki.includes("NumpadEnter")){

                r.UI.overlapview(true);    
                r.setScene(d.SCE_KEYWAIT);
                		
        	    r.rsmsg_f = false;
	            r.rstime = r.getGametime();

            }
        }
    }
}