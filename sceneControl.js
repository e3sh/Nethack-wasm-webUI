// ----------------------------------------------------------------------
// GameTask
class sceneControl extends GameTask {

	constructor(id) {
		super(id);

		let io, stf, waitc, keyon, spaceUsedAsCtrl;
		//let runstep;

		const keywait = 100; //0.10s

		this.init = function (g) {
			//create
		}

		this.pre = function (g) {

			io = g.task.read("io");
			this.moveEffect = new moveEffect(g);
			this.moveEffect.setDrawIndex(48, 0);

			this.monsHpView = new monsHpView(g);
			this.monsHpView.setDrawIndex(48, -8);
			//let mode = document.getElementById("lang").checked;

			const r = new GameManager(g);// ,mode? "jp":"en"); 
			g.rogue = r;

			const wName = ["0:MAIN", "1:STATUS",
				"2:MESSAGE", "3:WINDOW", "4:MODE", "5:COMMENT"];
			for (let i in wName) {
				//g.console[i].printw(`console:${wName[i]}`);
				//g.console[i].insertln();
			}

			stf = false;
			waitc = 60;
			this.runstep = 0;

			keyon = g.time();

			this.setCameraPos = function (x, y) {
				io.camera.x = x * 16 - 160;
				io.camera.y = y * 16;
			};
			this.setCameraEnable = function (flg) {
				io.camera.enable = flg;
			};
		}

		this.step = function (g) {

			waitc++;
			if (!stf && (waitc > 60)) {//90
				stf = true;
				//g.console[2].insertln();
				io.debugview = false;
				io.overlapview = false;
				for (let i = 0; i <= 6; i++) {
					//g.console[i].insertln();
					//g.console[i].printw(`rouge.start()`);
				}
				//g.console[3].clear();
				//                     
				g.rogue.main();
			} else {
				if ((waitc % 10) == 0 && !stf) {
					io.debugview = true;
					io.overlapview = true;
					//g.console[2].insertln();
					//g.console[2].printw(`start-wait:${10-Math.floor(waitc/9)}`);
					//g.console[3].insertln();
					for (let i = 0; i <= 6; i++)
						g.console[i].printw("rogue progress wait" + "..........".substring(0, Math.floor(waitc / 9)));
				}
			}

			if (stf) {
				// NetHack Wasm版の入力待ちチェック
				if (g.rogue.isWaitingForInput()) {
					if (keyon < g.time()) {
						const input = io.input;
						const keys = input.keylist;

						if (keys.length > 0) {
							// Spaceを修飾キーの代わりにするロジック
							let ctrl = false;
							let shift = input.shift;
							let alt = false;
							let effectiveKey = null;

							if (input.space) {
								// Spaceが押されている場合、Space以外のキーを探す
								const otherKey = keys.find(k => k !== "Space");
								if (otherKey) {
									ctrl = true;
									effectiveKey = otherKey;
									spaceUsedAsCtrl = true; // このSpace押下は修飾キーとして使われた
								}
							} else {
								alt = input.alt;
							}

							if (!effectiveKey && keys.length > 0) {
								// Space以外のキーがあればそれを採用、なければSpace（の可能性がある）
								effectiveKey = keys.find(k => k !== "Space");
								if (!effectiveKey && keys.includes("Space")) {
									effectiveKey = "Space";
									// Space単体押しの場合は、修飾キーとして使われていなければ後に送信するフラグ管理も可能
									if (spaceUsedAsCtrl !== true) spaceUsedAsCtrl = false;
								}
							}

							if (effectiveKey) {
								if (effectiveKey === "Space") {
									// Space単体押しの時は、同時押しを待つためにここでは送らない
								} else {
									g.rogue.sendKey(effectiveKey, shift, ctrl, alt);
									this.runstep++;
									keyon = g.time() + keywait;
								}
							}
						} else {
							// 全てのキーが離された時、Spaceが修飾キーとして使われていなかったら送る
							if (spaceUsedAsCtrl === false) {
								g.rogue.sendKey("Space", false, false, false);
								this.runstep++;
								keyon = g.time() + keywait;
							}
							spaceUsedAsCtrl = null;
						}
					}
				} else {
					// 入力待ちでない場合は、背景処理（アニメーション等）を継続
					if (!g.rogue.haste && this.runstep % 2 == 0) {
						// NetHack版では特に何もしない（Wasmが自分で進むため）
					}
				}
			}
		}

		this.draw = function (g) {

			//if (io.debugview)
			//	g.font["small"].putchr(`STEP:${this.runstep} ${this.runstep % 2 == 0 ? "haste" : "normal"}`, 840, 8);

			this.monsHpView.draw(g);

			this.moveEffect.step();
			this.moveEffect.step();
			this.moveEffect.step();
			this.moveEffect.draw(g);

			//console draw io
		}
	}
}
