/*
 * Mostly wizard commands. Sometimes used by players.
 *
 */

function wizard(r){
	    
	const d = r.define;
	const f = r.func;
	const t = r.types;
	const v = r.globalValiable;
	const ms = r.messages;

	const cw = d.DSP_MAIN_FG;
    const mw = d.DSP_MAIN_BG;
	const hw = d.DSP_WINDOW;

	//extern struct termios terminal;

	/*
	* whatis:
	*	What a certain object is
	*/
	this.whatis = function(what)
	//struct linked_list *what;
	{
		const get_item = r.item.pack_f.get_item;
		const OBJPTR = f.OBJPTR;
		const setoflg = r.setoflg; 
		const inv_name = r.item.things_f.inv_name;

		const s_know = r.item.s_know;	
		const p_know = r.item.p_know;	
		const r_know = r.item.r_know;	
		const ws_know = r.item.ws_know;

		let obj; //reg struct object *obj;
		let item;//reg struct linked_list *item;
		let wh;

		if (what == null) {				/* we need to ask */
			if ((item = get_item("identify", 0)) == null)
				return;
		}
		else							/* no need to ask */
			item = what;
		obj = OBJPTR(item);
		setoflg(obj, d.ISKNOW);
		wh = obj.o_which;
		switch (obj.o_type) {
			case d.SCROLL:
				s_know[wh] = true;
			break;
			case d.POTION:
				p_know[wh] = true;
			break;
			case d.STICK:
				ws_know[wh] = true;
			break;
			case d.RING:
				r_know[wh] = true;
		}
		if (what == null)
			r.UI.msg(inv_name(obj, false));
	}

	/*
	* create_obj:
	*	Create any object for wizard or scroll (almost)
	*/
	this.create_obj = function(fscr)
	//bool fscr;
	{
		let item; //reg struct linked_list *item;
		let obj; //reg struct object *obj;
		let wh, ch, otype;
		let newitem, newtype, msz, oname;
		let mf; //struct magic_info *mf;
		let nogood = true, inhw = false;

		/*
		if (fscr)
			msg(" ");
		else if (r.wizard) {
			msg("Create what?%s: ", starlist);
			ch = readchar();
			mpos = 0;
			if (ch == ESCAPE)
				return;
			else if (ch != '*')
				nogood = false;
		}
		if (nogood) {
			inhw = true;
			wclear(hw);
			wprintw(hw,"Item\tKey\n\n");
			for (otype = 0; otype < NUMTHINGS; otype++) {
				if (otype != TYP_AMULET || r.wizard) {
					mf = thnginfo[otype];
					wprintw(hw,"%s\t %c\n",things[otype].mi_name,mf.mf_show);
				}
			}
			if (r.wizard)
				waddstr(hw,"monster\t (A-z)");
			wprintw(hw,"\n\nWhat do you want to create? ");
			draw(hw);
			do {
				ch = readchar();
				if (ch == ESCAPE) {
					after = false;
					restscr(cw);
					return;
				}
				switch (ch) {
					case RING:		case STICK:	case POTION:
					case SCROLL:	case ARMOR:	case WEAPON:
					case FOOD:		case AMULET:
						nogood = false;
						break;
					default:
						if (isalpha(ch))
							nogood = false;
				}
			} while (nogood);
		}
		*/
		r.UI.wclear(hw);
		r.setScene(d.SCE_CREATE);
		r.nextScene = d.SCE_CREATE;
		
		r.UI.overlapview(true);
		r.UI.scene.create_obj()
	}

	this.create_obj_exec = function(fscr, ch, which)
	//bool fscr;
	{
		const isalpha =(ch)=>{ return /^[a-zA-Z]+$/.test(ch); };
		const makemons = r.UI.wizard.makemons;
		const getindex = r.player.misc.getindex;
		const new_thing = r.item.things_f.new_thing;
		const OBJPTR = f.OBJPTR;
		const init_ring = r.item.ring_f.init_ring;
		const whatis = r.UI.wizard.whatis;
		const add_pack = r.item.pack_f.add_pack;

		const thnginfo = v.thnginfo;
		const things = v.things;
		const armors = v.armors;

		let item; //reg struct linked_list *item;
		let obj; //reg struct object *obj;
		//let wh, ch, otype;
		let newitem, newtype, msz, oname;
		let mf; //struct magic_info *mf;
		let nogood = true, inhw = false;


		if (isalpha(ch)) {
			if (inhw)
				;//restscr(cw);
			makemons(ch);		/* make monster & be done with it */
			return;
		}

		otype = getindex(ch);
		if (otype == -1 || (otype == d.AMULET && r.wizard)) {
			if (inhw)
				;//restscr(cw);
			//pos = 0;
			r.UI.msg("You can't create that !!");
			return;
		}

		newitem = ch;
		mf = thnginfo[otype];
		oname = things[otype].mi_name;
		msz = mf.mf_max;
		nogood = true;
		if (msz == 1) {		/* if only one type of item */
			ch = 'a';
			nogood = false;
		}
		else if (!fscr && wizard) {
			if (!inhw) {
				r.UI.msg(`Which ${oname}${v.starlist}: `);
				//ch = readchar();
				//if (ch == ESCAPE)
				//	return;
				//if (ch != '*')
					nogood = false;
			}
		}
		if (nogood) {
			/*
			let wmi; //struct magic_item *wmi;
			let ii;

			mpos = 0;
			inhw = true;
			switch(newitem) {
				case POTION:	wmi = p_magic[0];
				break;
				case SCROLL:	wmi = s_magic[0];
				break;
				case RING:		wmi = r_magic[0];
				break;
				case STICK:		wmi = ws_magic[0];
				break;
				case WEAPON:	wmi = w_magic[0];
				break;
				default:		wmi = a_magic[0];
			}
			wclear(hw);
			for (ii = 0 ; ii < msz ; ii++) {
				mvwaddch(hw,ii % 13,ii > 12 ? COLS/2 : 0, ii + 'a');
				waddstr(hw,") ");
				waddstr(hw,wmi.mi_name);
				wmi++;
			}
			sprintf(prbuf,"Which %s? ", oname);
			mvwaddstr(hw,LINES - 1, 0, prbuf);
			draw(hw);
			do {
				ch = readchar();
				if (ch == ESCAPE) {
					restscr(cw);
					msg("");
					return;
				}
			} while (!isalpha(ch));
			*/
		}
		if (inhw)			/* restore screen if need be */
			;//restscr(cw);

		//newtype = tolower(ch) - 'a';
		newtype = which;
		if (newtype < 0 || newtype >= msz) {	/* if an illegal value */
			//mpos = 0;
			r.after = false;
			if (inhw)
				;//restscr(cw);
			r.UI.msg(`There is no such ${oname}`);
			return;
		}
		//mpos = 0;
		item = new_thing(false, newitem, newtype);
		obj = OBJPTR(item);
		wh = obj.o_type;
		if (wh == d.WEAPON || wh == d.ARMOR || wh == d.RING) {
			if (fscr)					/* users get +3 to -3 */
				ch = r.rnd(7) - 3;
			else {						/* wizard gets to choose */
				if (wh == d.RING)
					init_ring(obj, true);
				else
					ch = getbless();
			}
			if (wh == d.WEAPON)
				obj.o_hplus = obj.o_dplus = ch;
			else if (wh == d.ARMOR)
				obj.o_ac = armors[obj.o_which].a_class - ch;
			if (ch < 0)
				r.setoflg(obj, d.ISCURSED);
			else
				r.resoflg(obj, d.ISCURSED);
		}
		//mpos = 0;
		if (fscr)
			whatis(item);			/* identify for aquirement scroll */
		wh = add_pack(item, false);
		if (wh == false)			/* won't fit in pack */
			r.discard(item);
	}


	/*
	* getbless:
	*	Get a blessing for a wizards object
	*/
	function getbless()
	{
		let bless;

		r.UI.msg("Blessing: ");
		prbuf = '0';
		bless = 0; //get_str(prbuf, cw);
		if (bless == d.NORM)
			bless = Number(prbuf);
		else
			bless = 0;
		return bless;
	}

	/*
	* makemons:
	*	Make a monster
	*/
	this.makemons = function(what)
	//int what;
	{
		const look = r.player.misc.look;
		const step_ok = r.UI.io.step_ok;
		const winat = r.UI.winat;
		const new_monster = r.monster.new_monster;
		const midx = r.monster.midx;

		const hero = r.player.get_hero();

		let x, y, oktomake = false, appear = 1;
		let mp = {}; //struct coord mp;

		oktomake = false;
		for (x = hero.x - 1 ; x <= hero.x + 1 ; x++) {
			for (y = hero.y - 1 ; y <= hero.y + 1 ; y++) {
				if (x != hero.x || y != hero.y) {
					if (step_ok(winat(y, x)) && r.rnd(++appear) == 0) {
						mp.x = x;
						mp.y = y;
						oktomake = true;
						break;
					}
				}
			}
		}
		if (oktomake) {
			new_monster(midx(what), mp, false);
			look(false);
		}
		return oktomake;
	}

	/*
	* telport:
	*	Bamf the thing someplace else
	*/
	this.teleport = function(spot, th)
	//struct coord spot;
	//struct thing *th;
	{
		//console.log("telepo");

		const roomin = r.monster.chase.roomin;	
		const step_ok = r.UI.io.step_ok;
		const winat = r.UI.winat;
		const rnd_room = r.dungeon.new_level.rnd_room;
		const rnd_pos = r.dungeon.rooms_f.rnd_pos;
		const light = r.player.move.light;
		const pl_on = r.player.pl_on;
		const unhold = r.monster.unhold;

		const rooms = r.dungeon.rooms;
		const hero = r.player.get_hero();

		let  rm, y, x;
		let oldspot; //struct coord oldspot;
		let rp; //struct room *rp;
		let ishero;

		ishero = (th == r.player.get_player());
		oldspot = th.t_pos;
		y = th.t_pos.y;
		x = th.t_pos.x;
		r.UI.mvwaddch(cw, y, x, th.t_oldch); 
		if (!ishero)
			r.UI.mvwaddch(mw, y, x, ' ');
		rp = roomin(spot);
		if (spot.y < 0 || !step_ok(winat(spot.y, spot.x))) {
			rp = rooms[rnd_room()];
			th.t_pos = rnd_pos(rp);
		}
		else
			th.t_pos = spot;
		rm = rp;// - &rooms[0];
		th.t_room = rp;
		th.t_oldch = r.UI.mvwinch(cw, th.t_pos.y, th.t_pos.x);
		light(oldspot);
		th.t_nomove = 0;
		if (ishero) {
			light(hero);
			//r.UI.mvwaddch(cw, hero.y, hero.x, d.PLAYER);
			/*
			* turn off ISHELD in case teleportation was done
			* while fighting a Fungi or Bone Devil.
			*/
			if (pl_on(d.ISHELD))
				unhold('F');
			r.count = 0;
			r.running = false;
			//flushinp();			/* flush typeahead */
			r.nochange = false;

			//r.player.set_hero(hero);
		}
		else
			r.UI.mvwaddch(mw, th.t_pos.y, th.t_pos.x, th.t_type);
		return rm;
	}

	/*
	* passwd:
	*	See if user knows password
	*/
	function passwd()
	{
		let sp, c;
		let passok;
		//char buf[LINLEN], *xcrypt();

		msg(wizstr);
		mpos = 0;
		sp = buf;
		while ((c = getchar()) != '\n' && c != '\r' && c != ESCAPE)
		if (c == terminal.c_cc[VKILL])
			sp = buf;
		else if (c == terminal.c_cc[VERASE] && sp > buf)
			sp--;
		else
			sp++// = c;
		if (sp == buf)
			passok = false;
		else {
			sp = '\0';
			passok = (strcmp(PASSWD, xcrypt(buf, "mT")) == 0);
		}
		return passok;
	}
}