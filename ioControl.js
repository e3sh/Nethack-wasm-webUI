// ----------------------------------------------------------------------
// GameTask
class ioControl extends GameTask {

	watchdogTimer;

	resetWatchdog() {
		const TIMEOUT_MS = 5000; // 5秒

		if (!Boolean(this.watchdogTimer)) console.log("Watchdog Start");
		clearTimeout(this.watchdogTimer); // 既存タイマーをクリア
		this.watchdogTimer = setTimeout(this.onTimeout, TIMEOUT_MS); // 新しいタイマーを設定
	}

	onTimeout() {
		console.error("Watchdog TimeOut.");// Restart Application.");
		console.trace();
		debugger;
		// 実際のアプリケーションでは、ここで再起動処理（例: location.reload()）を呼び出す
		// location.reload();
	}
	
	constructor(id){
		super(id);
	}
//----------------------------------------------------------------------
	pre(g){// 最初の実行時に実行。

		g.font["std"].useScreen(0);

		const PTUB = ["_" ," "];
		const PTMSG = [String.fromCharCode(26) ,"_"];

		const cp = [
			//fontID,prompt	,charw, linew, location x,y,bgcolor, useutf
			[80, 24,"std"	,false  ,8,16,160,  0,null], //0: bg_mainscreen printw, addch, move, clear
			[80, 24,"std"	,false  ,8,16,160,  0,null], //1: sp_mainscreen printw, addch, move, clear
			[80, 24,"stdbg"	,PTUB  ,8,16,160,  0,null], //2: fg_mainscreen printw, addch, move, clear
			[80,  2,"std"	,false ,8,16,160,384,"rgb(128  0   0)"], //3:statusbar
			[40, 12,"std_l"	,false ,8,16,640,416,"rgb( 64 64  64)",true], //4:equip/select
			[74, 36,"std_l"	,PTMSG ,8,16, 48,416,"rgb(  0  0 100)",true], //5:msg
			[64, 28,"std_l"	,false ,8,16,240, 48,"rgb(  0  0 144)",true], //6:window 
			[32, 40,"small"	,PTUB  ,6, 8,760, 16,"rgb(  0 64  0/0.5)"],   //7:comment
			[32, 50,"small"	,PTUB  ,6, 8,  8,  8,"rgb(  0 64  0/0.5)"],   //8:entitylist
		]

		let cnsl = [];
		let layo = [];
		for (let i in cp){
			let p = cp[i];
			let c = new jncurses(p[0], p[1]);
			c.setFontId(p[2]);
			c.setPrompt(p[3]);
			c.setCharwidth(p[4]);
			c.setLinewidth(p[5]);
			const l = {con:c, x:p[6], y:p[7], w:p[0]*p[4], h:p[1]*p[5], bg:p[8]};
			c.setUseUTF(Boolean(p[9]));

			cnsl.push(c);
			layo.push(l);
		}
		g.console = cnsl;
		this.layout = layo;

		this.debugview = false;
		this.overlapview = false;
		this.waittime = g.time();
		this.input = {};

		this.msgCfullposition = false;

		this.camera = {x:0, y:0, enable: true};
	}
//----------------------------------------------------------------------
	step(g){// this.enable が true時にループ毎に実行される。

		// Input Keyboard ENTRY Check
	    let w = g.keyboard.check();

		const input = {
			HOME:	Boolean(w["Home"]),
			LOG:	Boolean(w["End"]),
			P_UP:	Boolean(w["PageUp"]),
			P_DOWN: Boolean(w["PageDown"])
		}

		if (this.waittime < g.time()){
			let fullscr = (input.HOME)?true:false;
			if (fullscr){
				if (!document.fullscreenElement){ 
					g.systemCanvas.requestFullscreen();
				}
			}

			if (input.LOG) {
				this.debugview = (this.debugview)?false:true;
				this.camera.enable = Boolean(!this.debugview);
				this.waittime = g.time() + 500;
			}

			if (input.P_UP || input.P_DOWN){
				this.msgCfullposition = (input.P_DOWN)?true:false;
			}
		}
		let p = false;
		for (let i in input){
			if (input[i]) p = true;
		}
		input.pushdown = p;

		let keylist = [];
		for (let i in w){
			if (w[i]){
				keylist.push(i);
			}
		}
		keylist = GpadToKey(g, keylist);

		input.keylist = keylist;
		this.input = input;
		
		const MSG = this.layout[5]
		if (this.msgCfullposition){
			if (MSG.y > 0) 
				MSG.y-= 16; 
			else 
				MSG.y = 0;
		}else{
			if (MSG.y <416 ) 
				MSG.y+= 16;
			else 
				MSG.y = 416;

			//Hungup debug用
			//this.resetWatchdog();
		}

		//this.camera.enable = !this.debugview;

		//-----------------------------------------------------------------------------
		// internal function 
		function GpadToKey(g, input){

			let gpd = g.gamepad;
			gpd.check();

			const KEYASSIGN = { 
				N0: "Numpad0",
				N1: "Numpad1",
				N2: "Numpad2",
				N3: "Numpad3",
				N4: "Numpad4",
				N5: "Numpad5",
				N6: "Numpad6",
				N7: "Numpad7",
				N8: "Numpad8",
				N9: "Numpad9",
				D:  "KeyD", 
				I:  "KeyI",
				SPC:"Space",
				RET:"Enter",
				HOME:"Home",
				END:"End",
				UP: "ArrowUp",
				DOWN:"ArrowDown"
			}
			
			if (gpd.upkey){
				if (gpd.leftkey || gpd.rightkey){
					input.push((gpd.leftkey)?KEYASSIGN.N7:KEYASSIGN.N9);
				}else
					input.push(KEYASSIGN.N8);
			} else 
				if (gpd.downkey){
					if (gpd.leftkey || gpd.rightkey){
						input.push((gpd.leftkey)?KEYASSIGN.N1:KEYASSIGN.N3);
					}else
						input.push(KEYASSIGN.N2);
				}else
					if (!gpd.upkey && !gpd.downkey) {
						if (gpd.leftkey) input.push(KEYASSIGN.N4);
						if (gpd.rightkey) input.push(KEYASSIGN.N6);
					}
			if (gpd.btn_x) input.push(KEYASSIGN.N0);
			if (gpd.btn_a) input.push(KEYASSIGN.N5);
			if (gpd.btn_b) input.push(KEYASSIGN.I);
			if (gpd.btn_y) input.push(KEYASSIGN.D);

			if (gpd.btn_start) input.push(KEYASSIGN.RET);
			//if (gpd.btn_back) input.push(KEYASSIGN.END) ;

			if (gpd.btn_rb) input.push(KEYASSIGN.DOWN);
			if (gpd.btn_rt || gpd.btn_lb) input.push(KEYASSIGN.UP);

			//if (gpd.btn_lb) input.push(KEYASSIGN.HOME);

			return input;
		}
	}
//----------------------------------------------------------------------
	draw(g){// this.visible が true時にループ毎に実行される。

		if (this.debugview){
			let r = g.fpsload.result();
			let dt = g.deltaTime().toString().substring(0,4);
			g.font["small"].putchr(`FPS:${Math.floor(r.fps)}  delta:${dt}`,840, 0);

			let s = "input:";
			for (let i in this.input.keylist){s += `${this.input.keylist[i]},`}
			g.font["small"].putchr(s,0 , 600-8);
		}
		let subv = this.debugview;
		//			 0:bg  1:sp  2:fg    3:st  4:eq  5:msg 6:window          7:comment       8:entity    
		let dispf = [subv, subv, true, true, true, true, this.overlapview, this.debugview, this.debugview];

		for (let i in this.layout){
			let d = this.layout[i];
			let x = this.layout[i].x;
			let y = this.layout[i].y;

			if (i==2 && this.camera.enable){
				x = x + this.camera.x;
				y = y + this.camera.y;
			}

			if (dispf[i]) {
				if (d.bg) g.screen[0].fill(x, y, d.w, d.h, d.bg);
				d.con.draw(g, x, y);
			}
		}
	}
}