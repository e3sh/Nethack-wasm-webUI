function rogueFuncs(r){

   const d = rogueDefines();

   const f = {
      /*
      * All the fun defines
      */
      next:(ptr)=>{return ptr.l_next},
      prev:(ptr)=>{return ptr.l_prev},
      ldata:(ptr)=>{return ptr.l_data},
      OBJPTR:(what)=>{return what.l_data},
      THINGPTR:(what)=>{return what.l_data},
      inroom:(rp, cp)=>{ 
         return ((cp).x <= (rp).r_pos.x + ((rp).r_max.x - 1) && 
         (rp).r_pos.x <= (cp).x && (cp).y <= (rp).r_pos.y + 
         ((rp).r_max.y - 1) && (rp).r_pos.y <= (cp).y)
      },
      unc:(cp)=>{return {x:cp.x, y:cp.y}},

      cmov:(xy)=>{move((xy).y, (xy).x)},
      DISTANCE:(y1,x1,y2,x2)=>{
         return ((x2 - x1)*(x2 - x1) + (y2 - y1)*(y2 - y1))
      },
      //when break;case
      //otherwise break;default
      //until:(expr) while(!(expr))

      ce:(a, b)=>{return (a.x == b.x && a.y == b.y)},
      draw:(window)=>{wrefresh(window)},

      //hero player.t_pos
      //pstats player.t_stats
      //pack player.t_pack

      herowis:()=>{ (getpwis(him)) },
      herodex:()=>{ (getpdex(him,false)) },
      herostr:()=>{ (pstats.s_ef.a_str) },
      herocon:()=>{ (pstats.s_ef.a_con) },

      //attach:(a,b) _attach(&a,b)
      //detach:(a,b) _detach(&a,b)
      //free_list:(a) _free_list(&a)
      max:(a, b)=>{return  ((a) > (b) ? (a) : (b))},
      goingup:()=>{return (level < max_level)},

      on: (thing, flag)=> {return ((thing.t_flags & flag) != 0)},
      off:(thing, flag)=> {return ((thing.t_flags & flag) == 0)},
      CTRL:(ch)=>{ return (ch & 0x1F)},

      //ALLOC:(x) malloc((unsigned int) x)
      //FREE:(x) free((char *) x)
      EQSTR:(a, b, c)=>{return (((a == b)&&(a == c)))},
      GOLDCALC: ()=>{return (r.rnd(50 + 10 * level) + 2)},
      ISMULT:(type)=>{return (type == d.POTION || type == d.SCROLL || type == d.FOOD)},

      //newgrp:() ++group
      //o_charges o_ac
      flushout:()=>{},	//ioctl(_tty_ch, TIOCFLUSH, 0)

      // flushout:()	//ioctl(2, TCFLSH, 0)

      toupper:(str)=>{return str.substring(0,1).toUpperCase() + str.substring(1);},
      tolower:(str)=>{return str.substring(0,1).toLowerCase() + str.substring(1);},

		isupper:(str)=>{ return /^[A-Z]+$/.test(str); },
		islower:(str)=>{ return /^[a-z]+$/.test(str); },
   }
   return f;
}