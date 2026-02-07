// ----------------------------------------------------------------------
// GameTask
class ioControl extends GameTask {

	watchdogTimer;

	resetWatchdog() {
		const TIMEOUT_MS = 5000; // 5秒
		if (!Boolean(this.watchdogTimer)) console.log("Watchdog Start");
		clearTimeout(this.watchdogTimer);
		this.watchdogTimer = setTimeout(this.onTimeout, TIMEOUT_MS);
	}

	onTimeout() {
		console.error("Watchdog TimeOut.");
		console.trace();
		debugger;
	}

	constructor(id) {
		super(id);
	}
	//----------------------------------------------------------------------
	pre(g) {
		g.font["std"].useScreen(0);

		const PTUB = ["_", " "];
		const PTMSG = [String.fromCharCode(26), "_"];

		/**
		 * コンソール設定定義
		 * [name, index, [w, h, fontId, prompt, charW, lineW, x, y, bgcolor, useUtf]]
		 */
		const consoleConfigs = [
			["MAP_BG", 0, [80, 24, "std_l", PTUB, 8, 16, 0, 0, null, true]],
			["MAP", 1, [80, 24, "std_l", false, 8, 16, 1, 0, null, true]],
			["STATUS", 2, [80, 3, "std_l", false, 8, 16, 64, 384, "rgb( 0 32 64)", true]],
			["MESSAGE", 3, [108, 36, "std_l", PTMSG, 8, 16, 48, 432, "rgb(  0  0 100)", true]],
			["WINDOW", 4, [80, 32, "std_l", false, 8, 16, 320, 48, "rgb(  0  0 144/0.7 )", true]],
			["MODE", 5, [80, 24, "small", PTUB, 6, 8, 0, 16, "rgb(  0 64  0/0.5)"]],
			["COMMENT", 6, [32, 70, "small", PTUB, 6, 8, 760, 16, "rgb(  0 64  0/0.5)"]]
		];

		// 新しいマネージャーの初期化
		this.display = new DisplayManager(g);
		this.layoutManager = new LayoutManager(this.display);

		for (const [name, idx, cfg] of consoleConfigs) {
			this.display.addConsole(name, idx, cfg);
		}

		// 既存コードとの互換性維持
		this.layout = this.display.layouts;
		this.modeM = this.display.isMobile;

		this.debugview = false;
		this.overlapview = false;
		this.waittime = g.time();
		this.input = {};

		this.msgCfullposition = false;
		this.camera = { x: 0, y: 0, enable: true };

		// ブラウザショートカット抑制
		window.addEventListener("keydown", function (event) {
			if (event.altKey && event.key !== "Alt") {
				event.preventDefault();
			}
		}, false);

		this.GpadToKey = new GpadToKey(g);
		this.GridPad = new inputGridPad("layer0", g);
	}
	//----------------------------------------------------------------------
	step(g) {
		// Input Keyboard ENTRY Check
		let w = g.keyboard.check();

		const input = {
			HOME: Boolean(w["Home"]),
			LOG: Boolean(w["End"]),
			P_UP: Boolean(w["PageUp"]),
			P_DOWN: Boolean(w["PageDown"])
		}

		if (this.waittime < g.time()) {
			if (input.HOME) {
				const el = g.systemCanvas;
				const requestMethod = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
				if (requestMethod) {
					requestMethod.call(el).catch(err => {
						console.warn("Fullscreen failed:", err);
					});
				}
			}

			if (input.LOG) {
				this.debugview = !this.debugview;
				this.camera.enable = !this.debugview;
				this.waittime = g.time() + 500;
			}

			if (input.P_UP || input.P_DOWN) {
				this.msgCfullposition = Boolean(input.P_DOWN);
			}
		}

		let p = false;
		for (let i in input) { if (input[i]) p = true; }
		input.pushdown = p;

		let keylist = [];
		let shift = false, space = false, alt = false;
		let gpresult = this.GpadToKey.check([]);
		if (g.rogue) this.GridPad.updateContext(g.rogue.inputContext);
		let tResult = this.GridPad.check();
		if (tResult) gpresult.push(tResult);

		const processKey = (i) => {
			if (i === "ShiftLeft" || i === "ShiftRight" || i === "") { shift = true; return; }
			if (i === "AltLeft" || i === "AltRight") { alt = true; return; }
			if (i === "Space") space = true;
			keylist.push(i);
		};

		if (gpresult.length > 0) {
			for (let gr of gpresult) {
				for (let i of gr) { if (i) processKey(i); }
			}
		}

		for (let i in w) { if (w[i]) processKey(i); }

		input.keylist = keylist;
		input.shift = shift;
		input.space = space;
		input.alt = alt;
		this.input = input;

		if (this.modeM) return;

		// 通常版のメッセージエリア移動ロジック
		const MSG = this.layout[3];
		if (this.msgCfullposition) {
			MSG.y = Math.max(0, MSG.y - 16);
		} else {
			MSG.y = Math.min(432, MSG.y + 16);
		}
	}
	//----------------------------------------------------------------------
	draw(g) {
		if (this.debugview) {
			let r = g.fpsload.result();
			let info = `FPS:${Math.floor(r.fps)} delta:${g.deltaTime().toString().substring(0, 4)}`;

			const smallConsole = this.display.get("MODE");
			if (smallConsole && smallConsole.printw) {
				smallConsole.move(0, 0);
				smallConsole.printw(info);
			}
			// Canvas用フォント直接描画（デバッグ）
			if (!this.modeM && g.font["small"]) {
				g.font["small"].putchr(info, 840, 0);
				g.font["small"].putchr(`input:${this.input.keylist.join(",")}`, 0, 592);
			}
		}

		let dispf = [true, true, true, true, this.overlapview, this.debugview, this.debugview];

		for (let i = 0; i < this.layout.length; i++) {
			let d = this.layout[i];
			const isVisible = dispf[i];

			if (isVisible) {
				let x = d.x;
				let y = d.y;

				if (i == 0 && this.camera.enable) {
					x += this.camera.x;
					y += this.camera.y;
				}

				if (d.bg) g.screen[0].fill(x, y, d.w, d.h, d.bg);

				if (i == 2) { // Status bar effect
					const sc = g.task.read("scene");
					if (sc && sc.barEffect) sc.barEffect.draw();
				}

				d.con.draw(g, x, y);
			}

			// DOM要素の表示制御を DisplayManager に一任
			const consoleName = Object.keys(this.display.devices)[i];
			if (consoleName) this.display.setVisible(consoleName, isVisible);
		}

		if (this.GpadToKey.ready) this.GpadToKey.draw(48, 312);
		this.GridPad.draw(g.screen[0]);
	}
}