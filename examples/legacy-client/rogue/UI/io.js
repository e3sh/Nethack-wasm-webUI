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

	this.setSimpleSL = (b) => { d.SL_SIMPLE = b; }

	/*
	 * showInput:
	 *  Display a prompt and get user input from the game screen.
	 */
	this.showInput = function (query) {
		if (Boolean(r.UI.trancelate))
			query = r.UI.trancelate.message(query);

		const isMobile = !!document.getElementById("ui-root");

		if (isMobile) {
			return new Promise((resolve) => {
				const container = document.getElementById("mobile-input-container");
				const promptEl = document.getElementById("mobile-input-prompt");
				const field = document.getElementById("mobile-input-field");
				const okBtn = document.getElementById("mobile-input-ok");
				const cancelBtn = document.getElementById("mobile-input-cancel");

				if (!container || !promptEl || !field) {
					console.warn("Mobile input elements not found. Falling back to default.");
					this.defaultShowInput(query).then(resolve);
					return;
				}

				promptEl.textContent = query;
				field.value = "";
				container.style.display = "block";
				if (r && r.UI) r.UI.inputOverlayActive = true;

				// 少し遅延させてフォーカス（仮想キーボード表示のため）
				setTimeout(() => field.focus(), 100);

				const cleanup = () => {
					container.style.display = "none";
					if (r && r.UI) r.UI.inputOverlayActive = false;
					field.removeEventListener("keydown", keyHandler);
					okBtn.removeEventListener("click", onOk);
					cancelBtn.removeEventListener("click", onCancel);
				};

				const onOk = () => {
					const val = field.value;
					cleanup();
					r.UI.msg(`${query} ${val}`);
					resolve(val);
				};

				const onCancel = () => {
					cleanup();
					resolve(null);
				};

				const keyHandler = (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						onOk();
					} else if (e.key === "Escape") {
						e.preventDefault();
						onCancel();
					}
				};

				field.addEventListener("keydown", keyHandler);
				okBtn.addEventListener("click", onOk);
				cancelBtn.addEventListener("click", onCancel);
			});
		}

		return this.defaultShowInput(query);
	}

	// 従来の Canvas ベースの入力処理を内部関数として維持
	this.defaultShowInput = function (query) {
		return new Promise((resolve) => {

			let inputStr = "";
			const originalHandler = r.pendingInputResolve;
			r.UI.msg(">");

			function updateDisplay() {
				r.UI.updateInputLine(`${query}>${inputStr}`);
			}

			const handler = (charCode) => {
				// ★キーが入った瞬間、隙間なく直ちにハンドラを即時維持！
				r.pendingInputResolve = handler;

				if (charCode === 13) { // Enter
					r.pendingInputResolve = originalHandler;
					r.UI.msg(`${query} ${inputStr}`); // 履歴に残す
					resolve(inputStr);
				} else if (charCode === 27) { // ESC
					r.pendingInputResolve = originalHandler;
					r.UI.updateInputLine("");
					resolve(null);
				} else if (charCode === 8) { // Backspace
					if (inputStr.length > 0) {
						inputStr = inputStr.slice(0, -1);
					}
					updateDisplay();
				} else if (charCode >= 32 && charCode <= 126) { // ASCII printable
					inputStr += String.fromCharCode(charCode);
					updateDisplay();
				}
			};

			// 初期ハンドラ登録
			r.pendingInputResolve = handler;
			updateDisplay();
		});
	}

	this.updateStatus = function (fld, value, chg, clr) {

		if (fld <= d.BL_FLASH) {
			renderStatus();
			//debugStatus();
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
				r.UI.wclear(d.DSP_MODE); //minimapも同時にクリア
			}
		}

		if (fld == d.BL_VERS) {
			//`BL_VERS` | バージョン情報が変更されるタイミング
			r.set_nhVersion(value);
			//console.log("Nethack ver:", value);
		}
		statusFields[fld] = { value: value, chg: chg, clr: clr };
	};

	this.endsequenceDetected = function () {
		//Death or End sequence detected. Synchronizing HP to 0.
		statusFields[d.BL_HP].value = 0;

		renderStatus();
		//debugStatus();
	}

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

		const hungerText = r.UI.trancelate.message(sf[s.HUNGER]);
		const condText = conditionString(sf[s.CONDITION]);

		r.UI.setBarEffect(statusFields[d.BL_HP].value, statusFields[d.BL_HPMAX].value);

		if (!d.SL_SIMPLE) {
			r.UI.mvwaddstr(statusDsp, 0, 0,
				`${sf[s.TITLE]} St:${sf[s.STR]} Dx:${sf[s.DEX]} Co:${sf[s.CON]} In:${sf[s.INT]} Wi:${sf[s.WIS]} Ch:${sf[s.CHA]}`
			);
			r.UI.mvwaddstr(statusDsp, 1, 0,
				`${sf[s.ALIGN]} $:${GOLD} ${hpInd}HP:${sf[s.HP]}(${sf[s.HPMAX]}) ${enInd}Pw:${sf[s.ENE]}(${sf[s.ENEMAX]}) AC:${sf[s.AC]} Exp:${sf[s.XP]}/${sf[s.EXP]} ${hungerText}`
			);
			r.UI.mvwaddstr(statusDsp, 2, 0,
				`${sf[s.DLEVEL]} T:${sf[s.TIME]} ${sf[s.CAP]} ${condText}`
			);
		} else {
			r.UI.mvwaddstr(statusDsp, 0, 0,
				`${sf[s.TITLE]}`
			);
			r.UI.mvwaddstr(statusDsp, 1, 0,
				`${hpInd}HP:${sf[s.HP]}(${sf[s.HPMAX]}) ${enInd}Pw:${sf[s.ENE]}(${sf[s.ENEMAX]})  Exp:${sf[s.XP]}/${sf[s.EXP]}`
			);
			r.UI.mvwaddstr(statusDsp, 2, 0,
				`${sf[s.DLEVEL]} ${hungerText} ${sf[s.CAP]} ${condText}`
			);

		}
	};

	function warnIcon(value, maxvalue) {

		const parcent = Math.floor((value / maxvalue) * 100);

		let glaphId = 9623; //nothing
		if (parcent < 5)
			glaphId = 7226; //nothing
		else if (parcent < 10)
			glaphId = 7225; //warning5(perple)
		else if (parcent < 20)
			glaphId = 7224; //warning4(red)
		else if (parcent < 40)
			glaphId = 7223; //warning3(perple)
		else if (parcent < 70)
			glaphId = 7222; //warning2(orange)
		else if (parcent < 95)
			glaphId = 7221; //warning1(pink)
		else if (parcent < 99)
			glaphId = 7220; //warning0(white)
		else glaphId = 9623;//black 

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
			str += `${(condvalue & CDT[i]) ? `${r.UI.trancelate.message(i)} ` : ""}`;
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

	this.getStatusFields = function () {
		return statusFields;
	};
}
