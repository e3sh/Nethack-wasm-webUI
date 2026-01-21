/*
 * Various input/output functions
 */
function io(r){

	const d = r.define;
	const f = r.func;
	const t = r.types;
	const v = r.globalValiable;
	const ms = r.messages;

	/*
	* status:
	*	Display the important stats line.  Keep the cursor where it was.
	*/
	this.status = function(fromfuse)
	//int fromfuse;
	{
		//status
		const updpack = r.player.encumb.updpack;

		const player = r.player.get_player();
		const max_stats = r.player.get_max_stats();
		const him =  r.player.get_him();
		const cur_armor = r.player.get_cur_armor();

		let totwght, carwght; //reg int totwght, carwght;
		let stef, stre, stmx; //reg struct real *stef, *stre, *stmx;
		let pb;
		let oy, ox, ch;
		let buf;
		//const hwidth =()=>{ "%2d(%2d)" };

		/*
		* If nothing has changed since the last time, then done
		*/
		if (r.nochange)
			return;
		nochange = true;
		updpack();					/* get all weight info */
		stef = player.t_stats.s_ef;
		stre = player.t_stats.s_re;
		stmx = max_stats.s_re;
		totwght = Math.floor(him.s_carry / 10);
		carwght = Math.floor(him.s_pack / 10);

		r.UI.setDsp(d.DSP_STATUS);
		r.UI.clear();
		r.UI.mvaddstr(1, 0,
			`Str: ${stef.a_str}(${(stre.a_str < stmx.a_str)?"*":""}${stre.a_str})` //%2d(%c%2d)", stef.a_str, ch, stre.a_str);
		);
		r.UI.mvaddstr(1, 13,
			`Dex: ${stef.a_dex}(${(stre.a_dex < stmx.a_dex)?"*":""}${stre.a_dex})` //%2d(%c%2d)", stef.a_dex, ch, stre.a_dex);
		);
		r.UI.mvaddstr(1, 26,
			`Wis: ${stef.a_wis}(${(stre.a_wis < stmx.a_wis)?"*":""}${stre.a_wis})`//%2d(%c%2d)", stef.a_wis, ch, stre.a_wis);
		);
		r.UI.mvaddstr(1, 39,
			`Con: ${stef.a_con}(${(stre.a_con < stmx.a_con)?"*":""}${stre.a_con})`//%2d(%c%2d)", stef.a_con, ch, stre.a_con);
		);
		r.UI.mvaddstr(1, 52,
			`Carry: ${carwght}(${totwght}) ${hungstr[r.player.hungry_state]}`//%3d(%3d)", carwght, totwght);
		);
		
		r.UI.mvaddstr(0, 0,`Level: ${r.dungeon.level}  `);
		r.UI.mvaddstr(0, 13,`Gold: ${r.player.purse} `);
		r.UI.mvaddstr(0, 26,`Hp: ${him.s_hpt}(${him.s_maxhp})`);//",level, purse);

		r.UI.mvaddstr(0, 39,`Ac: ${cur_armor == null ? him.s_arm :cur_armor.o_ac}`);
		r.UI.mvaddstr(0, 52,`Exp: ${him.s_lvl}/${Math.floor(him.s_exp)}`);

		carwght = Math.floor((r.packvol * 100) / d.V_PACK);
		r.UI.mvaddstr(0, 67,`Vol: ${carwght}%`);//%3d%%", carwght);

		r.UI.mvaddstr(1, 75, r.UI.get_deltaText(r.delta.x, r.delta.y));
		r.UI.setDsp(d.DSP_MAIN);

		equipstatus();
	}

	/*
	* equipstatus:
	*	Display the hero's equip items
	*/
	function equipstatus(){

		const inv_name = r.item.things_f.inv_name;

		const cur_weapon = r.player.get_cur_weapon();
		const cur_armor  = r.player.get_cur_armor();
		const cur_ring   = r.player.get_cur_ring();
		const select = r.player.get_select();
		//const dest = r.player.get_dest();

		const wname = (cur_weapon != null)? inv_name(cur_weapon, false):"-";
		const aname = (cur_armor != null)? inv_name(cur_armor , false):"-";
		const rlname = (cur_ring[d.LEFT] != null) ? inv_name(cur_ring[d.LEFT] , false):"";
		const rrname = (cur_ring[d.RIGHT] != null)? inv_name(cur_ring[d.RIGHT], false):"";
		const selname = (select != null)? `SEL) ${inv_name(select, false)}`:"";
		//const dstname = (dest != null)? `=> : ${inv_name(dest, false)}`:"";

		r.UI.setDsp(d.DSP_EQUIP);
		r.UI.clear();

		r.UI.mvaddstr(0, 0,`EQUIP)`);
		r.UI.mvaddstr(1, 0,` ${wname}`);
		r.UI.mvaddstr(2, 0,` ${aname}`);
		r.UI.mvaddstr(3, 0,` ${rlname}`);
		r.UI.mvaddstr(4, 0,` ${rrname}`);
		r.UI.mvaddstr(6, 0,`${selname}`);
		//r.UI.mvaddstr(7, 0,`${dstname}`);

		r.UI.setDsp(d.DSP_MAIN);
	}
}