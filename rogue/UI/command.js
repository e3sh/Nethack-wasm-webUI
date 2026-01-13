/*
 * Read and execute the user commands
 */
function command(r){

	const d = r.define;
	const f = r.func;
	const t = r.types;
	const v = r.globalValiable;
	const ms = r.messages;

	const cw = d.DSP_MAIN_FG;

	let lastscore = -1;

	let scrmode = false;

	//running, count, take, after, door_stop  gamemanager, waswizard

	/*
	* command:
	*	Process the user commands
	*/
	this.main = function()
	{
		const do_daemons = r.daemon.do_daemons;
		const do_fuses = r.daemon.do_fuses;
		const look = r.player.misc.look;
		const pl_on = r.player.pl_on;
		const pl_off = r.player.pl_off;
		const pick_up = r.item.pack_f.pick_up;
		const waste_time = r.player.misc.waste_time;
		const price_it = r.dungeon.trader.price_it;
		const teleport = r.UI.wizard.teleport;
		
		const player = r.player.get_player();
		const hero = r.player.get_hero();

		let ch;
		let ntimes = 1;		/* Number of player moves */
		let countch, direction, newcount = false;

		r.UI.setCameraPos({x:hero.x, y:hero.y});
		if (r.levtype == d.POSTLEV){
			r.UI.setCameraEnable(false);
			scrmode = true;
		} else {
			if (scrmode) {r.UI.setCameraEnable(true); scrmode = false;}	
		}

		if (r.nextScene != d.SCE_MAIN){
			r.setScene(r.nextScene);
			if (r.nextScene == d.SCE_GETITEM || r.nextScene == d.SCE_CREATE) 
				r.UI.overlapview(true);
			r.nextScene = d.SCE_MAIN;
			return;
		}

		r.haste = ((pl_on(d.ISHASTE) !=0) ? true: false);
		//if (pl_on(d.ISHASTE)) r.haste = true;
		//	ntimes++;
		/*
		* Let the daemons start up
		*/
		let sh = r.UI.check_hastestep(); //console.log("haste mode" + sh)
		if (!sh ||(sh && r.haste)){ //console.log("haste step" + sh + r.haste);
		//while (ntimes-- > 0) {
			do_daemons(d.BEFORE);
			look(true);
			if (!r.running)
				r.door_stop = false;
			lastscore = r.player.purse;

			r.UI.wmove(cw, hero.y, hero.x);
			//r.UI.setDsp(d.DSP_MAIN);
			//r.UI.move(hero.y, hero.x);

			//if (!(running || count))
			//	draw(cw);			/* Draw screen */
			r.take = 0;
			r.after = true;
			/*
			* Read command or continue run
			*/
			if (r.wizard)
				r.waswizard = true;

			if (player.t_nocmd <= 0) {
				player.t_nocmd = 0;
				if (r.running)
					ch = r.runch;
				else if (r.count)
					ch = countch;
				else {
					ch = r.UI.readchar();
					//if (mpos != 0 && !running) /* Erase message if its there */
					//	msg("");
				}
			}
			else
				ch = '.';

			if (player.t_nocmd > 0) { 
				if (--player.t_nocmd <= 0)
					r.UI.msg(ms.CMD_MAIN);	
			}else{
				cmd_decode(ch);
			}
			/* If he ran into something to take, let the
			* hero pick it up if not in a trading post.
			*/
			if (r.take != 0){
				if (r.levtype != d.POSTLEV){
					//console.log(`Pup ${r.take}`);
					pick_up(r.take);
				}
				else
					price_it();

			}
			if (!r.running)
				r.door_stop = false;
		}

		/*
		* Kick off the rest if the daemons and fuses
		*/
		if (r.after) {
			let  j;

			look(false);
			do_daemons(d.AFTER);
			do_fuses();
			if (pl_on(d.ISSLOW))
				waste_time();
			for (j = d.LEFT; j <= d.RIGHT; j++) {
				let cur_ring = r.player.get_cur_ring();

				if (cur_ring[j] != null) {
					if (cur_ring[j].o_which == d.R_SEARCH)
						search();
					else if (cur_ring[j].o_which == d.R_TELEPORT)
						if (r.rnd(100) < 5)
							teleport(r.rndspot, player);
				}
			}
			r.UI.setCameraPos({x:hero.x, y:hero.y});
		}

		entityStatus();
	}

	function entityStatus(){

		const player = r.player.get_player();
		const hero = r.player.get_hero();
		const on = f.on;
		const pl_on = r.player.pl_on;

		const tgt_chk =(mon)=>{return (mon.t_dest.x == hero.x && mon.t_dest.y == hero.y);};
		
		let etxt = [];
		let res = r.entityState();
		for (let i in res){
			etxt.push(res[i]);
		}
		etxt.push("");
		etxt.push(`food_left:${r.player.food_left}    `);
		etxt.push(`player x:${hero.x} y:${hero.y} ${r.wizard?"w":""}   `);
		//etxt.push(`stairs x:${r.dungeon.stairs.x} y:${r.dungeon.stairs.y}    `);
		etxt.push("");
		let wml = wlo = pak = 0;
		r.UI.resetMonsHp();
		for (let w = r.dungeon.mlist; w != null ; w = w.l_next) {
			wml++; 
			let fs = `.....${Number(w.l_data.t_flags).toString(8)}`;
			let fst = fs.substring(fs.length-6,fs.length);
			let en = w.l_data;
			let enst = w.l_data.t_stats; 
			etxt.push(
				`${en.t_type}:${fst}:x:${en.t_pos.x} y:${en.t_pos.y} hp:${enst.s_hpt}/${enst.s_maxhp} ${tgt_chk(en)?"*":""}`);

				//if (on(en, d.ISRUN))
				if (tgt_chk(en)) 
					r.UI.setMonsHp(en.t_pos, enst.s_hpt, enst.s_maxhp);	
			}
		for (let w = r.dungeon.lvl_obj; w != null ; w = w.l_next) {wlo++;}// etxt.push(" " + w.l_data.o_type);}
		for (let w = r.player.get_pack(); w != null ; w = w.l_next) {pak++;}
		etxt.push("");
		etxt.push(`mlist:${wml} lvl_obj:${wlo} pack:${pak}`);

		let dlst = r.daemon.get_dlist();
		const dtime = (flg)=>{
			for (let i in dlst){
				if (dlst[i].d_flag == flg)
					return dlst[i].d_time;
			}
			return " ";
		};


		let fs = `.....${Number(player.t_flags).toString(8)}`;
		etxt.push(`${fs.substring(fs.length-6,fs.length)}:player.t-flags`);
		etxt.push(`-----1:ISBLIND :${(pl_on(d.ISBLIND)	?"o":"-")} ${dtime(d.ISBLIND)} `);
		etxt.push(`-----4:ISRUN   :${(on(player,d.ISRUN)	?"o":"-")} `);
		etxt.push(`----1-:ISINVINC:${(on(player,d.ISINVINC)	?"o":"-")} ${dtime(d.ISINVINC)} `);
		etxt.push(`---4--:ISHELD  :${(on(player,d.ISHELD)	?"o":"-")} `);
		etxt.push(`--1---:ISHUH   :${(on(player,d.ISHUH)	?"o":"-")} ${dtime(d.ISHUH)} `);
		etxt.push(`--2---:ISREGEN :${(on(player,d.ISREGEN)	?"o":"-")} ${dtime(d.ISREGEN)} `);
		etxt.push(`--4---:CANHUH  :${(on(player,d.CANHUH)	?"o":"-")} `);
		etxt.push(`-1----:CANSEE  :${(on(player,d.CANSEE)	?"o":"-")} ${dtime(d.CANSEE)} `);
		etxt.push(`-4----:ISSLOW  :${(on(player,d.ISSLOW)	?"o":"-")} ${dtime(d.ISSLOW)} `);
		etxt.push(`1-----:ISHASTE :${(on(player,d.ISHASTE)	?"o":"-")} ${dtime(d.ISHASTE)} `);
		etxt.push(`2-----:ISETHER :${(on(player,d.ISETHER)	?"o":"-")} ${dtime(d.ISETHER)} `);

		const ent_title = ()=>{
			let st = "";
			for (let w = r.dungeon.mlist; w != null ; w = w.l_next)
				st += w.l_data.t_type;
			return st;
		}
		const ent_flags = (flg)=>{
			let st = "";
			for (let w = r.dungeon.mlist; w != null ; w = w.l_next)
				st += on(w.l_data, flg)?"o":"-";
			return st;
		}
		etxt.push("");
		etxt.push(`entity.t-flags:${ent_title()}`);
		etxt.push(`-----1:ISSTUCK:${ent_flags(d.ISSTUCK	)}`);
		etxt.push(`-----2:ISPARA :${ent_flags(d.ISPARA	)}`);
		etxt.push(`-----4:ISRUN  :${ent_flags(d.ISRUN	)}`);
		etxt.push(`----2-:ISINVIS:${ent_flags(d.ISINVIS	)}`);
		etxt.push(`----4-:ISMEAN :${ent_flags(d.ISMEAN	)}`);
		etxt.push(`---1--:ISGREED:${ent_flags(d.ISGREED	)}`);
		etxt.push(`---2--:ISWOUND:${ent_flags(d.ISWOUND	)}`);
		etxt.push(`---4--:ISHELD :${ent_flags(d.ISHELD	)}`);
		etxt.push(`--1---:ISHUH  :${ent_flags(d.ISHUH	)}`);
		etxt.push(`--2---:ISREGEN:${ent_flags(d.ISREGEN	)}`);
		etxt.push(`-1----:WASHIT :${ent_flags(d.WASHIT	)}`);
		etxt.push(`-2----:ISCANC :${ent_flags(d.ISCANC	)}`);
		etxt.push(`-4----:ISSLOW :${ent_flags(d.ISSLOW	)}`);
		etxt.push(`1-----:ISHASTE:${ent_flags(d.ISHASTE	)}`);

		r.UI.wclear(d.DSP_ENTITY);
		for (let i in etxt){
			r.UI.mvwaddstr(d.DSP_ENTITY, i, 0, etxt[i]);
		}
	}

	/*
	* cmd_decode
	*
	*/
	function cmd_decode(ch){

		const CTRL = f.CTRL;
		const do_move = r.player.move.do_move;
		const do_run = r.player.move.do_run;
		const winat = r.UI.winat;
		const msg = r.UI.msg;
		const inventory = r.item.pack_f.inventory;
		const drop = r.item.things_f.drop;
		const buy_it = r.dungeon.trader.buy_it;
		const sell_it = r.dungeon.trader.sell_it;
		const market = r.dungeon.trader.market;
		const create_obj = r.UI.wizard.create_obj;
		const decode_cmd = r.item.decode_cmd;
		const decode_drop = r.item.decode_drop;
		const get_dir = r.player.misc.get_dir;
		const quaff = r.item.potion_f.quaff;
		const read_scroll = r.item.scroll_f.read_scroll;
		const eat = r.player.misc.eat;
		const ring_off = r.item.ring_f.ring_off;
		const ring_on = r.item.ring_f.ring_on;
		const take_off = r.item.armor_f.take_off;
		const wear = r.item.armor_f.wear;
		const wield = r.item.weapon_f.wield;
		const do_zap = r.item.stick_f.do_zap;
		const missile = r.item.weapon_f.missile;
		const dip_it = r.player.move.dip_it;

		const illegal = (text)=>{return `${v.illegal} ${text}`};
		const unctrl =(text)=>{return text;}

		const hero = r.player.get_hero();

		let countch, newcount = false;
		/*
		* check for prefixes
		*/
		let ki = r.UI.readchar();

		if (ki.includes("Numpad4")) ch = 'h';
		if (ki.includes("Numpad2")) ch = 'j';
		if (ki.includes("Numpad8")) ch = 'k';
		if (ki.includes("Numpad6")) ch = 'l';
		if (ki.includes("Numpad7")) ch = 'y';
		if (ki.includes("Numpad9")) ch = 'u';
		if (ki.includes("Numpad1")) ch = 'b';
		if (ki.includes("Numpad3")) ch = 'n';

		if (ki.includes("Numpad5")){
			//if (typeof(ch) == "string")
			//ch = ch.toUpperCase();
			if (winat(hero.y, hero.x) == d.STAIRS)
					ch = r.amulet?"<":">"; //u_level/d_level	
			else 
			if (r.levtype != d.POSTLEV || !market()){
				if (winat(hero.y, hero.x) != d.STAIRS)
					ch = "s"; //search
			}else{
				ch = "#"; //buy_it
			}
		}
		//r.daemon.rollwand();

		if (ki.includes("NumpadSubtract")||ki.includes("NumpadAdd")||
			ki.includes("ArrowUp")||ki.includes("ArrowDown")||
			ki.includes("KeyI")
		){
			ch = "i"; //inventry
		}

		if (ki.includes("Numpad0")
		){
			ch = decode_cmd(false);

			//ch = "e"; //eat/
		}

		if (ki.includes("KeyD")
		){
			ch = decode_drop(false);

			//if (r.levtype != d.POSTLEV){
			//	ch = "d"; //drop
			//}else{
			//	ch = "%"; //sell_it
			//}
		}

		if (ki.includes("KeyW") && ki.includes("Space")) {

			r.wizard = !r.wizard;
			r.UI.setEffect(r.wizard?"ON":"OFF"
				,{x:hero.x,y:hero.y},{x:hero.x,y:hero.y-1},120);

			ch = 's';
		}

		if (r.wizard){
			if (ki.includes("KeyC")) ch = 'C';
		}

		if (ki.includes("KeyH")){
			window.open('roguedoc_jp.txt', '_blank');
		}

		//if (ki.includes("KeyS")) {

		//	r.qs.save();
		//}


		//r.UI.msg(`${ki.length} ${ch}`);
		
		if (false){
		//if (isdigit(ch)) {
			r.count = 0;
			newcount = true;
			while (isdigit(ch)) {
				r.count = r.count * 10 + (ch - '0');
				ch = readchar();
			}
			countch = ch;
			/*
			* turn off count for commands which don't make sense
			* to repeat
			*/
			switch (ch) {
				case 'h': case 'j': case 'k': case 'l':
				case 'y': case 'u': case 'b': case 'n':
				case 'H': case 'J': case 'K': case 'L':
				case 'Y': case 'U': case 'B': case 'N':
				case 'q': case 'r': case 's': case 'f':
				case 't': case 'C': case 'I': case '.':
				case 'z': case 'p':
					break;
				default:
					r.count = 0;
			}
		}
		/*
		switch (ch) {
		case 'f':
		case 'g':
			if (pl_off(d.ISBLIND)) {
				r.door_stop = true;
				r.firstmove = true;
			}
			if (r.count && !newcount)
				ch = direction;
			else
				ch = readchar();
			switch (ch) {
				case 'h': case 'j': case 'k': case 'l':
				case 'y': case 'u': case 'b': case 'n':
					ch = toupper(ch);
			}
			direction = ch;
		}
		*/
		newcount = false;
		/*
		* execute a command
		*/
		let use = false;

		if (r.count && !r.running)
			r.count--;
		switch (ch) {
			case '!' : shell(); r.after = false;
				break;
			case 'h' : do_move(0, -1);
				break;
			case 'j' : do_move(1, 0);
				break;
			case 'k' : do_move(-1, 0);
				break;
			case 'l' : do_move(0, 1);
				break;
			case 'y' : do_move(-1, -1);
				break;
			case 'u' : do_move(-1, 1);
				break;
			case 'b' : do_move(1, -1);
				break;
			case 'n' : do_move(1, 1);
				break;
			case 'H' : do_run('h');
				break;
			case 'J' : do_run('j');
				break;
			case 'K' : do_run('k');
				break;
			case 'L' : do_run('l');
				break;
			case 'Y' : do_run('y');
				break;
			case 'U' : do_run('u');
				break;
			case 'B' : do_run('b');
				break;
			case 'N' : do_run('n');
				break;
			case 't':
				if (!get_dir())
					r.after = false;
				else
					use = missile(r.delta.y, r.delta.x);
				break;
			case 'Q' : r.after = false; quit(-1);
				break;
			case 'i' : r.after = false; inventory(r.player.get_pack(), 0);
				break;
			case 'I' : r.after = false; picky_inven();
				break;
			case 'd' : use = drop(null);
				break;
			case 'q' : use = quaff();
				break;
			case 'r' : use = read_scroll();
				break;
			case 'e' : use = eat();
				break;
			case 'w' : use = wield();
				break;
			case 'W' : use = wear();
				break;
			case 'T' : use = take_off();
				break;
			case 'P' : use = ring_on();
				break;
			case 'R' : use = ring_off();
				break;
			case 'O' : option();
				break;
			case 'c' : call();
				break;
			case '>' : r.after = false; d_level();
				break;
			case '<' : r.after = false; u_level();
				break;
			case '?' : r.after = false; help();
				break;
			case '/' : r.after = false; identify(0);
				break;
			case 's' : search();
				break;
			case 'z' : use = do_zap(false);
				break;
			case 'p':
				if (get_dir())
					use = do_zap(true);
				else
					r.after = false;
				break;
			case 'v': msg("Super Rogue version %s.",release);
				break;
			case 'D': use = dip_it();
				break;
			case CTRL('L') : r.after = false; restscr(cw);
				break;
			case CTRL('R') : r.after = false; msg(huh);
				break;
			case 'a': r.after = false; dispmax();
				break;
			case '@' : if (author())
				msg("Hero @ %d,%d : Stairs @ %d,%d",hero.y,hero.x,stairs.y,stairs.x);
				break;
			case 'S' : 
				r.after = false;
				if (save_game()) {
					wclear(cw);
					draw(cw);
					endwin();
					byebye(0);
				}
				break;
			case '.' : ;				/* Rest command */
				break;
			case ' ' : r.after = false;	/* do nothing */
				break;
			case '=' :
				if (author()) {
					activity();
					r.after = false;
				}
				break;
			case CTRL('P') :
				r.after = false;
				if (r.wizard) {
					r.wizard = false;
					msg("Not wizard any more");
				}
				else {
					r.wizard = passwd();
					if (r.wizard) {
						msg("Welcome back, Bob!!!!!");
						r.waswizard = true;
					}
					else
						msg("Sorry");
				}
				break;
			case d.ESCAPE :	/* Escape */
				door_stop = false;
				r.count = 0;
				r.after = false;
				break;
			case '#':
				if (r.levtype == d.POSTLEV)		/* buy something */
					buy_it();
				r.after = false;
				break;
			case '$':
				if (r.levtype == d.POSTLEV)		/* price something */
					price_it();
				r.after = false;
				break;
			case '%':
				if (r.levtype == d.POSTLEV)		/* sell something */
					sell_it();
				r.after = false;
				break;
			default :
				r.after = false;
				if (r.wizard) switch (ch) {
				case CTRL('A') : ;
					break;
				case 'C'     :	create_obj(false);
					break;
				case CTRL('I') :	inventory(lvl_obj, 1);
					break;
				case CTRL('W') :	whatis(null);
					break;
				case CTRL('D') :	level++; new_level(NORMLEV);
					break;
				case CTRL('U') :	if (level > 1) level--; new_level(NORMLEV);
					break;
				case CTRL('F') :	displevl();
					break;
				case CTRL('X') :	dispmons();
					break;
				case CTRL('T') :	teleport(r.rndspot, player);
					break;
				case CTRL('E') :	msg("food left: %d", food_left);
					break;
				case CTRL('O') :	add_pass();
					break;
				case 'M' : {
					let tlev, whichlev;
					prbuf[0] = '\0';
					msg("Which level? ");
					if (get_str(prbuf,cw) == NORM) {
						whichlev = NORMLEV;
						tlev = atoi(prbuf);
						if (tlev < 1)
							level = 1;
						if (tlev >= 200) {
							tlev -= 199;
							whichlev = MAZELEV;
						}
						else if (tlev >= 100) {
							tlev -= 99;
							whichlev = POSTLEV;
						}
						level = tlev;
						new_level(whichlev);
					}
				}
				break;
				case CTRL('N') : {
					let item;//struct linked_list *item;

					item = get_item("charge", STICK);
					if (item != null) {
						(OBJPTR(item)).o_charges = 10000;
						msg("");
					}
				}
				break;
				case CTRL('H') : {
					let i;
					let item;//struct linked_list *item;
					let obj;//struct object *obj;

					him.s_exp = e_levels[him.s_lvl + 7] + 1;
					check_level();
					/*
					* Give the rogue a very good sword
					*/
					item = new_thing(false, WEAPON, TWOSWORD);
					obj = OBJPTR(item);
					obj.o_hplus = 3;
					obj.o_dplus = 3;
					obj.o_flags = ISKNOW;
					i = add_pack(item, true);
					if (i)
						cur_weapon = obj;
					else
						discard(item);
					/*
					* And his suit of armor
					*/
					item = new_thing(false, ARMOR, PLATEARMOR);
					obj = OBJPTR(item);
					obj.o_ac = -8;
					obj.o_flags = ISKNOW;
					i = add_pack(item, true);
					if (i)
						cur_armor = obj;
					else
						discard(item);
					r.nochange = false;
				}
				break;
				default:
					r.UI.comment(illegal(unctrl(ch)));
					r.count = 0;
			}
			else {
				r.UI.comment(illegal(unctrl(ch)));
				r.count = 0;
			}
		}
		/*
		* turn off flags if no longer needed
		*/
		if (r.running)
			r.door_stop = false;
	}

	/*
	* quit:
	*	Have player make certain, then exit.
	*/
	//void
	function quit(a)
	{
		let ch, good;
		/*
		* Reset the signal in case we got here via an interrupt
		*/
		if (signal(SIGINT, quit) != quit)
			mpos = 0;
		msg("Really quit? [y/n/s]");
	/*	ch = tolower(readchar());*/
		ch = readchar();
		if (ch == 'y') {
			clear();
			move(LINES-1, 0);
			refresh();
			score(purse, CHICKEN, 0);
			byebye(0);
		}
		else if (ch == 's') {
			good = save_game();
			if (good) {
				wclear(cw);
				draw(cw);
				endwin();
				byebye(0);
			}
		}
		else {
			signal(SIGINT, quit);
			wmove(cw, 0, 0);
			wclrtoeol(cw);
			draw(cw);
			mpos = 0;
			r.count = 0;
			r.nochange = false;
		}
	}

	/*
	* search:
	*	Player gropes about him to find hidden things.
	*/

	function search()
	{
		const getpwis = r.player.pstats.getpwis;
		const pl_on = r.player.pl_on;
		const winat = r.UI.winat;
		const isatrap = r.player.move.isatrap;
		const trap_at = r.player.move.trap_at;
		const herowis =()=>{ return getpwis(him);};
		const tr_name = r.player.misc.tr_name;

		const hero  = r.player.get_hero();
		const him = r.player.get_him();

		let x, y;
		let ch;

		/*
		* Look all around the hero, if there is something hidden there,
		* give him a chance to find it.  If its found, display it.
		*/
		if (pl_on(d.ISBLIND))
			return;
		for (x = hero.x - 1; x <= hero.x + 1; x++) {
			for (y = hero.y - 1; y <= hero.y + 1; y++) {
				ch = winat(y, x);
				if (isatrap(ch)) {		/* see if its a trap */
					let tp;//reg struct trap *tp;

					if ((tp = trap_at(y, x)) == null)
						break;
					if (tp.tr_flags & d.ISFOUND)
						break;		/* no message if its seen */
					if (r.UI.mvwinch(cw, y, x) == ch)
						break;
					if (r.rnd(100) > (him.s_lvl * 9 + herowis() * 5))
						break;
					tp.tr_flags |= d.ISFOUND;
					r.UI.mvwaddch(cw, y, x, tp.tr_type);
					r.count = 0;
					r.running = false;
					r.UI.msg(tr_name(tp.tr_type));
				}
				else if(ch == d.SECRETDOOR) {
					if (r.rnd(100) < (him.s_lvl * 4 + herowis() * 5)) {
						r.UI.mvaddch(y, x, d.DOOR);
						r.count = 0;
						r.UI.setEffect("door",{x:x,y:y},{x:x,y:y-1},120);
					}
				}
			}
		}
	}

	/*
	* help:
	*	Give single character help, or the whole mess if he wants it
	*/
	function help()
	{
		let helpstr = [];//extern struct h_list helpstr[];
		let strp; //reg struct h_list *strp;
		let helpch;
		let cnt;

		strp = helpstr[0];
		msg("Character you want help for (* for all): ");
		helpch = readchar();
		mpos = 0;
		/*
		* If its not a *, print the right help string
		* or an error if he typed a funny character.
		*/
		if (helpch != '*') {
			wmove(cw, 0, 0);
			while (strp.h_ch) {
				if (strp.h_ch == helpch) {
					msg("%s%s", unctrl(strp.h_ch), strp.h_desc);
					break;
				}
				strp++;
			}
			if (strp.h_ch != helpch)
				msg("Unknown character '%s'", unctrl(helpch));
			return;
		}
		/*
		* Here we print help for everything.
		* Then wait before we return to command mode
		*/
		wclear(hw);
		cnt = 0;
		while (strp.h_ch) {
			mvwaddstr(hw, cnt % 23, cnt > 22 ? 40 : 0, unctrl(strp.h_ch));
			waddstr(hw, strp.h_desc);
			cnt++;
			strp++;
		}
		wmove(hw, LINES-1, 0);
		wprintw(hw,spacemsg);
		draw(hw);
		wait_for(hw,' ');
		wclear(hw);
		draw(hw);
		wmove(cw, 0, 0);
		wclrtoeol(cw);
		touchwin(cw);
		r.nochange = false;
	}


	/*
	* identify:
	*	Tell the player what a certain thing is.
	*/
	//char *
	this.identify = function(what)
	//int what;
	{
		const isalpha =(ch)=>{ return /^[a-zA-Z]+$/.test(ch); };
		const midx = r.monster.midx;

		const monsters = v.monsters;

		let ch, str;

		//if (what == 0) {
			//msg("What do you want identified? ");
			//ch = readchar();
			//mpos = 0;
			//if (ch == d.ESCAPE) {
			//	msg("");
			//	return null;
			//}
		//}
		//else
			ch = what;
		if (isalpha(ch))
			str = monsters[midx(ch)].m_name;
		else {
			switch(ch) {
				case '|':
				case '-':	str = "the wall of a room";
					break;
				case d.GOLD:	str = "gold";
					break;
				case d.STAIRS:	str = "passage leading up/down";
					break;
				case d.DOOR:	str = "door";
					break;
				case d.FLOOR:	str = "room floor";
					break;
				case d.PLAYER:	str = "you";
					break;
				case d.PASSAGE:	str = "passage";
					break;
				case d.POST:	str = "trading post";
					break;
				case d.MAZETRAP:	str = "maze trap";
					break;
				case d.TRAPDOOR:	str = "trapdoor";
					break;
				case d.ARROWTRAP:	str = "arrow trap";
					break;
				case d.SLEEPTRAP:	str = "sleeping gas trap";
					break;
				case d.BEARTRAP:	str = "bear trap";
					break;
				case d.TELTRAP:	str = "teleport trap";
					break;
				case d.DARTTRAP:	str = "dart trap";
					break;
				case d.POOL:	str = "magic pool";
					break;
				case d.POTION:	str = "potion";
					break;
				case d.SCROLL:	str = "scroll";
					break;
				case d.FOOD:	str = "food";
					break;
				case d.WEAPON:	str = "weapon";
					break;
				case ' ' :	str = "solid rock";
					break;
				case d.ARMOR:	str = "armor";
					break;
				case d.AMULET:	str = "The Amulet of Yendor";
					break;
				case d.RING:	str = "ring";
					break;
				case d.STICK:	str = "wand or staff";
					break;
				default:
					if (what == 0)
						str = "unknown character";
					else
						str = "a magical ghost";
			}
		}
		if (what == 0)
			r.UI.msg(`'${ch}': ${str}`);
		return str;
	}

	/*
	* d_level:
	*	He wants to go down a level
	*/
	function d_level()
	{
		const winat = r.UI.winat;
		const pl_on = r.player.pl_on;
		const msg = r.UI.msg

		const hero = r.player.get_hero();

		if (winat(hero.y, hero.x) != d.STAIRS)
			msg(ms.D_LEVEL1);
		else {
			if (pl_on(d.ISHELD)) {
				msg(ms.UD_LEVEL1);
				return;
			}
			r.dungeon.level++;
			r.dungeon.new_level.create(d.NORMLEV);

			r.qs.save();
		}
	}

	/*
	* u_level:
	*	He wants to go up a level
	*/
	function u_level()
	{
		const winat = r.UI.winat;
		const msg = r.UI.msg
		const new_level = r.dungeon.new_level.create;
		const pl_on = r.player.pl_on;
		const total_winner = r.player.rips.total_winner;
	
		const hero = r.player.get_hero();

		if (winat(hero.y, hero.x) == d.STAIRS)  {
			if (pl_on(d.ISHELD)) {
				msg(ms.UD_LEVEL1);
				return;
			}
			else {				/* player not held here */
				if (r.amulet) {
					r.dungeon.level--;
					if (r.dungeon.level == 0){
						total_winner();
						return;
					}
					new_level(d.NORMLEV);
					msg(ms.U_LEVEL1);

					r.qs.save();
					return;
				}
			}
		}
		msg(ms.U_LEVEL2);
	}

	/*
	* Let him escape for a while
	*/
	function shell()
	{
		let pid;
		let sh;
		let ret_status;

		/*
		* Set the terminal back to original mode
		*/
		sh = getenv("SHELL");
		wclear(hw);
		wmove(hw, LINES-1, 0);
		draw(hw);
		endwin();
		in_shell = true;
		fflush(stdout);

		printf("\n%s", retstr);
		fflush(stdout);
		noecho();
		crmode();
		in_shell = false;
		wait_for(cw, '\n');
		restscr(cw);
	}

	/*
	* call:
	*	Allow a user to call a potion, scroll, or ring something
	*/
	function call()
	{
		let obj;//reg struct object *obj;
		let item;//reg struct linked_list *item;
		let guess, elsewise;
		let wh;

		if ((item = get_item("call", 0)) == null)
			return;
		obj = OBJPTR(item);
		wh = obj.o_which;
		switch (obj.o_type) {
		case RING:
			guess = r_guess;
			elsewise = (r_guess[wh] != null ? r_guess[wh] : r_stones[wh]);
		break;case POTION:
			guess = p_guess;
			elsewise = (p_guess[wh] != null ? p_guess[wh] : p_colors[wh]);
		break;case SCROLL:
			guess = s_guess;
			elsewise = (s_guess[wh] != null ? s_guess[wh] : s_names[wh]);
		break;case STICK:
			guess = ws_guess;
			elsewise =(ws_guess[wh] != null ?
				ws_guess[wh] : ws_stuff[wh].ws_made);
		break;default:
			msg("You can't call %ss anything",obj.o_typname);
			return;
		}
		msg("Was called \"%s\"", elsewise);
		msg(callit);
		if (guess[wh] != null)
			free(guess[wh]);
		strcpy(prbuf, elsewise);
		if (get_str(prbuf, cw) == NORM) {
			guess[wh] = new(strlen(prbuf) + 1);
			strcpy(guess[wh], prbuf);
		}
	}
}