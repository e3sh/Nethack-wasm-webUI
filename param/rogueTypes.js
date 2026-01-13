function rogueTypes(r){

    /*
    * Now we define the structures and types
    */
    t = {
        delayed_action: class{
            d_type;//:0,
            d_func;//()=>{},//int (*d_func)();
            d_arg ;//:0,
            d_time;//:0,
        },

        /*
        * Help list
        */
        h_list: class{
            h_ch;//: "",
            h_desc;//:"",
        },

        /*
        * Coordinate data type
        */
        coord: class{
            x;//:  0,			/* column position */
            y;//:  0,			/* row position */
        },

        monlev: class{
            l_lev;//:  0,		/* lowest level for a monster */
            h_lev;//:  0,		/* highest level for a monster */
            d_wand;//: false,	/* true if monster wanders */
        },

        /*
        * Linked list data type
        */
        linked_list: class{
            l_next;//: null,//struct linked_list *l_next;
            l_prev;//: null,//struct linked_list *l_prev;
            l_data;//: null,//char *l_data;/* Various structure pointers */
        },

        /*
        * Stuff about magic items
        */
        //#define mi_wght mi_worth
        magic_item: class{
            mi_name;//: "",		/* name of item */
            mi_prob;//: 0,        /* probability of getting item */
            mi_worth;//: 0,		/* worth of item */
        },

        magic_info: class{
            mf_max;//:	0,					/* max # of this type */
            mf_vol;//:	0,					/* volume of this item */
            mf_show;//: "",					/* appearance on screen */
            mf_magic;//: null,	/* pointer to magic tables */
        },

        /*
        * staff/wand stuff
        */
        rod: class{
            ws_type;//: "",		/* either "staff" or "wand" */
            ws_made;//: "",		/* "mahogany", etc */
            ws_vol;//: 0,		/* volume of this type stick */
            ws_wght;//: 0,		/* weight of this type stick */
        },

        /*
        * armor structure 
        */
        init_armor: class{
            a_class;//: 0,		/* normal armor class */
            a_wght;//: 0,			/* weight of armor */
            a_vol;//: 0,			/* volume of armor */
        },

        /*
        * weapon structure
        */
        init_weps: class{
            w_dam;//: "0x0",		/* hit damage */
            w_hrl;//: "0x0",		/* hurl damage */
            w_flags;//: 0,		/* flags */
            w_wght;//: 0,		/* weight of weapon */
            w_vol;//: 0,			/* volume of weapon */
            w_launch;//: "",		/* need to launch it */
        },

        /*
        * Room structure
        */
        room: class{
            r_pos;//: {x:0,y:0},		/* Upper left corner */
            r_max;//: {x:0,y:0},		/* Size of room */
            r_gold;//:{x:0,y:0},	/* Where the gold is */
            r_exit;//:[],//[4],	/* Where the exits are */
            r_ptr;//: [],//[4],	/* this exits' link to next rm */
            r_goldval;//: 0,			/* How much the gold is worth */
            r_flags;//: 0,			/* Info about the room */
            r_nexits;//: 0,			/* Number of exits */
        },

        /*
        * Array of all traps on this level
        */
        trap: class{
            tr_pos;//: {x:0,y:0},	/* Where trap is */
            tr_goto;//: {x:0,y:0},	/* where trap tranports to (if any) */
            tr_flags;//: 0,			/* Info about trap */
            tr_type;//: "",			/* What kind of trap */
        },

        /*
        * structure for describing true abilities
        */
        real: class{
            a_str;//: 0,			/* strength (3-24) */
            a_dex;//: 0,			/* dexterity (3-18) */
            a_wis;//: 0, 			/* wisdom (3-18) */
            a_con;//: 0,			/* constitution (3-18) */
        },

        /*
        * Structure describing a fighting being
        */
        stats: class{
            s_re;//: {},	/* True ability */
            s_ef;//: {},	/* Effective ability */
            s_exp;//: 0,	/* Experience */
            s_lvl;//: 0,	/* Level of mastery */
            s_arm;//: 0,	/* Armor class */
            s_hpt;//: 0,	/* Hit points */
            s_maxhp;//: 0,	/* max value of hit points */
            s_pack;//: 0,	/* current weight of his pack */
            s_carry;//: 0,	/* max weight he can carry */
            s_dmg;//: "0x0",	/* String describing damage done */
        },

        /*
        * Structure for monsters and player
        */
        thing: class{
            t_stats;//: null,		/* Physical description */
            t_pos;//: {x:0,y:0},			/* Position */
            t_oldpos;//: {x:0,y:0},		/* last spot of it */
            t_dest;//: [],		/* Where it is running to */
            t_pack;//: null,	/* What the thing is carrying */
            t_room;//: null,		/* Room this thing is in */
            t_flags;//: 0, 				/* State word */
            t_indx;//: 0,					/* Index into monster structure */
            t_nomove;//: 0,				/* # turns you cant move */
            t_nocmd;//: 0,				/* # turns you cant do anything */
            t_turn;//: false,				/* If slow, is it a turn to move */
            t_type;//: "",				/* What it is */
            t_disguise;//: "",			/* What mimic looks like */
            t_oldch;//: "",				/* Char that was where it was */
            t_reserved;//: "",
        },

        /*
        * Array containing information on all the various types of mosnters
        */
        monster: class{
            m_name;//: "unknown",			/* What to call the monster */
            m_show;//: "@",			/* char that monster shows */
            m_carry;//: 0,			/* Probability of having an item */
            m_lev;//: null,	/* level stuff */
            m_flags;//: 0,			/* Things about the monster */
            m_stats;//: null,	/* Initial stats */
        },

        /*
        * Structure for a thing that the rogue can carry
        */
        object: class{
            o_pos;//: {x:0,y:0},		/* Where it lives on the screen */
            o_damage;//: "0x0",		/* Damage if used like sword */
            o_hurldmg;//: "0x0",	/* Damage if thrown */
            o_typname;//: "name",		/* name this thing is called */
            o_type;//: 0,				/* What kind of object it is */
            o_count;//: 0,			/* Count for plural objects */
            o_which;//: 0,			/* Which object of a type it is */
            o_hplus;//: 0,			/* Plusses to hit */
            o_dplus;//: 0,			/* Plusses to damage */
            o_ac;//: 0,				/* Armor class or charges */
            o_flags;//: 0,			/* Information about objects */
            o_group;//: 0,			/* Group number for this object */
            o_weight;//: 0,			/* weight of this object */
            o_vol;//: 0,				/* volume of this object */
            o_launch;//: "",			/* What you need to launch it */
        },

        sgttyb: class{
            sg_ispeed;//:0,		/* input speed */
            sg_ospeed;//:0,		/* output speed */
            sg_erase;//:0,		/* erase character */
            sg_kill;//:0,		/* kill character */
            sg_flags;//:0,		/* mode flags */
        },
    }
    return t;
}