/*
 * global variable declaration
 */
function global(r){

	const d = r.define;
	const f = r.func;
	const t = r.types;
	const v = r.globalValiable;

	//struct room rooms[MAXROOMS];		/* One for each room -- A level */
	//struct room *oldrp;					/* Roomin(&oldpos) */
	//struct linked_list *mlist = null;	/* monsters on this level */
	//struct thing player;				/* The rogue */
	//struct stats max_stats;				/* The maximum for the player */
	//struct linked_list *lvl_obj = null;	/* objects on this level */
	//struct object *cur_weapon = null;	/* Which weapon he is weilding */
	//struct object *cur_armor = null;	/* the rogue's armor */
	//struct object *cur_ring[2];			/* Which rings are being worn */
	//struct stats *him;					/* pointer to hero stats */
	//struct trap traps[MAXTRAPS];		/* traps on this level */

	v.playuid;				/* uid of current player */
	v.playgid;				/* gid of current player */
	v.level = 1;				/* What level rogue is on */
	v.levcount = 0;			/* # of active mons this level */
	v.levtype = d.NORMLEV;		/* type of level this is, maze, etc. */
	v.trader = 0;				/* no. of purchases */
	v.curprice = -1;			/* current price of item */
	v.purse = 0;				/* How much gold the rogue has */
	v.mpos = 0;				/* Where cursor is on top line */
	v.ntraps;					/* # of traps on this level */
	v.packvol = 0;			/* volume of things in pack */
	v.total = 0;				/* Total dynamic memory bytes */
	v.demoncnt = 0;			/* number of active daemons */
	v.lastscore = -1;			/* Score before this turn */
	v.no_food = 0;			/* # of levels without food */
	v.seed;					/* Random number seed */
	v.dnum;					/* Dungeon number */
	v.count = 0;				/* # of times to repeat cmd */
	v.fung_hit = 0;			/* # of time fungi has hit */
	v.quiet = 0;				/* # of quiet turns */
	v.max_level = 1;			/* Deepest player has gone */
	v.food_left = d.HUNGERTIME;	/* Amount of food stomach */
	v.group = d.NEWGROUP;		/* Current group number */
	v.hungry_state = d.F_OKAY;	/* How hungry is he */
	v.foodlev = 1;			/* how fast he eats food */
	v.ringfood = 0;			/* rings affect on food consumption */
	v.take;					/* Thing the rogue is taking */
	v.runch;					/* Direction player is running */
	v.curpurch;			/* name of item ready to buy */

	v.prbuf;			/* Buffer for sprintfs */
	v.whoami;		/* Name of player */
	v.fruit;			/* Favorite fruit */
	v.huh;			/* The last message printed */
	v.file_name;		/* Save file name */
	v.scorefile;		/* place for scorefile */
	v.home;			/* User's home directory */
	v.outbuf;		/* Output buffer for stdout */

	v.s_guess = [];//MAXSCROLLS];		/* his guess at what scroll is */
	v.p_guess = [];//MAXPOTIONS];		/* his guess at what potion is */
	v.r_guess = [];//MAXRINGS];		/* his guess at what ring is */
	v.ws_guess = [];//MAXSTICKS];		/* his guess at what wand is */

	v.isfight = false;		/* true if player is fighting */
	v.nlmove = false;		/* true when transported to new level */
	v.inpool = false;		/* true if hero standing in pool */
	v.inwhgt = false;		/* true if from wghtchk() */
	v.running = false;		/* True if player is running */
	v.playing = true;		/* True while(! he quits */
	v.wizard = false;		/* True if he is a wizard */
	v.after = true;			/* True if we want after daemons */
	v.door_stop = false;		/* Stop run when we pass a door */
	v.firstmove = false;		/* First move after door_stop */
	v.waswizard = false;		/* Was a wizard sometime */
	v.amulet = false;		/* He found the amulet */
	v.in_shell = false;		/* True if executing a shell */
	v.nochange = false;		/* true if last stat same as now */

	v.s_know = [];	//[MAXSCROLLS];		/* Does he know about a scroll */
	v.p_know = [];	//[MAXPOTIONS];		/* Does he know about a potion */
	v.r_know = [];	//[MAXRINGS];		/* Does he know about a ring */
	v.ws_know = [];	//[MAXSTICKS];		/* Does he know about a stick */

	v.spacemsg ="-- Press space to continue --";
	v.morestr =	"-- More --";
	v.retstr =	"[Press return to continue]";
	v.wizstr =	"Wizards Password: ";
	v.illegal = "Illegal command '%s'.";
	v.callit =	"Call it: ";
	v.starlist =" (* for a list)";

	//struct coord oldpos;		/* Pos before last look() call */
	//struct coord delta;			/* Change indicated to get_dir() */
	//struct coord stairs;		/* where the stairs are put */
	//struct coord rndspot = { -1, -1 };	/* for random teleporting */

	/*
	struct h_list helpstr[] = {
		'?',	"	prints help",
		'/',	"	identify object",
		'h',	"	left",
		'j',	"	down",
		'k',	"	up",
		'l',	"	right",
		'y',	"	up & left",
		'u',	"	up & right",
		'b',	"	down & left",
		'n',	"	down & right",
		'H',	"	run left",
		'J',	"	run down",
		'K',	"	run up",
		'L',	"	run right",
		'Y',	"	run up & left",
		'U',	"	run up & right",
		'B',	"	run down & left",
		'N',	"	run down & right",
		't',	"<dir>	throw something",
		'f',	"<dir>	forward while(! find something",
		'p',	"<dir>	zap a wand in a direction",
		'z',	"	zap a wand or staff",
		'>',	"	go down a staircase",
		's',	"	search for trap/secret door",
		'.',	"	(dot) rest for a while",
		'i',	"	inventory pack",
		'I',	"	inventory single item",
		'q',	"	quaff potion",
		'r',	"	read a scroll",
		'e',	"	eat food",
		'w',	"	wield a weapon",
		'W',	"	wear armor",
		'T',	"	take armor off",
		'P',	"	put on ring",
		'R',	"	remove ring",
		'd',	"	drop object",
		'c',	"	call object",
		'O',	"	examine/set options",
		'a',	"	display maximum stats",
		'D',	"	dip object in pool",
		CTRL('L'),"	redraw screen",
		ESCAPE,	"	cancel command",
		'!',	"	shell escape",
		'S',	"	save game",
		'Q',	"	quit",
		0, 0
	};
	*/

	v.e_levels = [
		10,20,40,80,160,320,640,1280,2560,5120,10240,20480,
		40920, 81920, 163840, 327680, 655360, 1310720, 2621440,
		3932160, 5242880, 7864320, 10485760, 15728640, 20971520,
		41943040, 83886080, 167772160, 335544320, 0,
	];

	//WINDOW *cw;		/* what the hero sees */
	//WINDOW *hw;		/* utility window */
	//WINDOW *mw;		/* monster window */
}