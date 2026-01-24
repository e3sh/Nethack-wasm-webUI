/*
 * Various input/output functions
 */
function io(r, g) {

	const d = r.define;
	const f = r.func;
	const t = r.types;
	const v = r.globalValiable;
	const ms = r.messages;

	let statusFields = [];
	for (let i = 0; i < 24; i++) {
		statusFields.push({ value: 0 });
	}

	/*
	 * showInput:
	 *  Display a prompt and get user input from the game screen.
	 */
	this.showInput = function (query) {
		return new Promise((resolve) => {

			let inputStr = "";
			const originalHandler = r.pendingInputResolve;
			r.UI.msg(">");

			//const updateDisplay = () => {
			//	r.UI.updateInputLine(`${query} ${inputStr}`);
			//};
			async function updateDisplay(next){
				r.UI.updateInputLine(`${query}>${inputStr}`);
				await new Promise(resolve => setTimeout(resolve, 150));
				r.UI.updateInputLine(`${query} ${inputStr}`);
				if (next) r.pendingInputResolve = handler;
			}

			const handler = (charCode) => {
				if (charCode === 13) { // Enter
					r.pendingInputResolve = originalHandler;
					//r.UI.updateInputLine(`${query} ${inputStr}`);
					r.UI.msg(`${query} ${inputStr}`); // 履歴に残す
					resolve(inputStr);
				} else if (charCode === 27) { // ESC
					r.pendingInputResolve = originalHandler;
					r.UI.updateInputLine("");
					resolve(null);
				} else if (charCode === 8) { // Backspace
					if (inputStr.length > 0) {
						inputStr = inputStr.slice(0, -1);
						updateDisplay(false);
					}
					r.pendingInputResolve = handler;
				} else if (charCode >= 32 && charCode <= 126) { // ASCII printable
					inputStr += String.fromCharCode(charCode);
					updateDisplay(true);
					//r.pendingInputResolve = handler;
				} else {
					// 無視するキー
					r.pendingInputResolve = handler;
				}
			};

			updateDisplay(true);
			//r.pendingInputResolve = handler;
		});
	}

	this.updateStatus = function (fld, value, chg, clr) {

		if (fld <= d.BL_FLASH) {
			renderStatus();
			debugStatus();
			return;
		}

		if (fld == d.BL_DLEVEL) {
			//`BL_LEVELDESC` | 現在の階層 (Dlevel) が変更されるタイミング
			if (statusFields[d.BL_DLEVEL].value != value) {
				r.UI.wclear(d.DSP_MAIN);
				if (d.USE_GLYPH) {
					for (let i = 0; i < 25; i++) {
						r.UI.wmove(d.DSP_MAIN, i, 0);
						r.UI.waddstr(d.DSP_MAIN, "　".repeat(80));
					}
				}
			}
		}

		if (fld == d.BL_VERS) {
			//`BL_VERS` | バージョン情報が変更されるタイミング
			r.set_nhVersion(value);
			//console.log("Nethack ver:", value);
		}
		statusFields[fld] = { value: value, chg: chg, clr: clr };

		if (fld == d.BL_HP) renderStatus();
	};

	function renderStatus() {
		const statusDsp = d.DSP_STATUS;
		const s = d.STAT_FLD;
		const sf = [];

		r.UI.wclear(statusDsp);
		statusFields.forEach((field, index) => {
			if (field) {
				sf[Number(index)] = field.value;
			}
		});

		let splitwork = sf[s.GOLD].split(":");
		const goldGlyphId = parseInt(splitwork[0].slice(7), 16) || 3883; // Default to gold piece if parsing fails
		const glyphId = String.fromCharCode(goldGlyphId + d.GLYPH_BASE);
		const GOLD = `${glyphId}${splitwork[1]}`;

		const hpInd = warnIcon(sf[s.HP], sf[s.HPMAX]);
		const enInd = warnIcon(sf[s.ENE], sf[s.ENEMAX]);

		r.UI.setBarEffect(statusFields[d.BL_HP].value, statusFields[d.BL_HPMAX].value);

		r.UI.mvwaddstr(statusDsp, 0, 0,
			`${sf[s.TITLE]} St:${sf[s.STR]} Dx:${sf[s.DEX]} Co:${sf[s.CON]} In:${sf[s.INT]} Wi:${sf[s.WIS]} Ch:${sf[s.CHA]}`
		);
		r.UI.mvwaddstr(statusDsp, 1, 0,
			`${sf[s.ALIGN]} $:${GOLD} ${hpInd}HP:${sf[s.HP]}(${sf[s.HPMAX]}) ${enInd}Pw:${sf[s.ENE]}(${sf[s.ENEMAX]}) AC:${sf[s.AC]} Exp:${sf[s.XP]}/${sf[s.EXP]} ${sf[s.HUNGER]}`
		);
		r.UI.mvwaddstr(statusDsp, 2, 0,
			`${sf[s.DLEVEL]} T:${sf[s.TIME]} ${sf[s.CAP]} ${conditionString(sf[s.CONDITION])}`
		);
	};

	function warnIcon(value, maxvalue) {

		const parcent = Math.floor((value / maxvalue) * 100);

		let glaphId = 3926;
		if (parcent < 5)
			glaphId = 3926; //warning4(perple)
		else if (parcent < 10)
			glaphId = 7222; //warning4(perple)
		else if (parcent < 20)
			glaphId = 7221; //warning4(red)
		else if (parcent < 40)
			glaphId = 7220; //warning3(orange)
		else if (parcent < 70)
			glaphId = 7219; //warning2(yellow)
		else if (parcent < 95)
			glaphId = 7218; //warning1(green)
		else if (parcent < 99)
			glaphId = 7217; //warning1(green)
		else glaphId = 3926;//black //warning0(white)

		return String.fromCharCode(glaphId + d.GLYPH_BASE);
	}

	function debugStatus() {
		const statusDsp = d.DSP_MODE;
		r.UI.wclear(statusDsp);
		let line = [];
		statusFields.forEach((field, index) => {
			if (field) {
				line.push(`${index}:${field.value} `);
			}
		});
		for (let i in line) {
			r.UI.mvwaddstr(statusDsp, i, 0, line[i]);
		}

		if (Boolean(statusFields[22])) {
			const list = conditionCheck(statusFields[22].value);
			for (let i in list) {
				r.UI.mvwaddstr(statusDsp, Number(i) + 10, 20, list[i]);
			}
		}
	}

	function conditionString(condvalue) {
		const CDT = d.CONDITION;
		let str = "";

		for (let i in CDT) {
			str += `${(condvalue & CDT[i]) ? `${i} ` : ""}`;
		}
		return str;
	}

	function conditionCheck(condvalue) {
		const CDT = d.CONDITION;
		let list = [];

		for (let i in CDT) {
			list.push(`${(condvalue & CDT[i]) ? "o" : "-"}:${i}`);
		}
		return list;
	}
}
