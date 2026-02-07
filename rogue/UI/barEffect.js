function barEffect(g, x, y, width, height) {

	let before_barwidth = 0;
	let device = g.screen[0];
	let w_hp, mhp;

	const barDraw = { hp: 0, mhp: 0, bbw: 0 };

	const domRoot = document.getElementById(`ui-root`);
	const domMode = (domRoot) ? true : false;
	let domContainer, domMain, domEffect;

	if (domMode) {
		domContainer = document.createElement('div');
		domContainer.id = "EffectbarContainer";
		domContainer.style.position = 'absolute';
		domContainer.style.left = `${x}px`;
		domContainer.style.top = `${y}px`;
		domContainer.style.width = `${width}px`;
		domContainer.style.height = `${height}px`;
		domContainer.style.backgroundColor = 'black';
		domContainer.style.zIndex = '150';
		domContainer.style.display = 'none';
		domContainer.style.pointerEvents = 'none';

		// 追従用の赤いバー
		domEffect = document.createElement('div');
		domEffect.style.position = 'absolute';
		domEffect.style.left = '1px';
		domEffect.style.top = '1px';
		domEffect.style.width = '0px';
		domEffect.style.height = `${height - 2}px`;
		domEffect.style.backgroundColor = 'red';

		// メインのHPバー (meterを利用)
		domMain = document.createElement('meter');
		domMain.style.position = 'absolute';
		domMain.style.left = '1px';
		domMain.style.top = '1px';
		domMain.style.width = `${width - 2}px`;
		domMain.style.height = `${height - 2}px`;
		// meterのデフォルト背景を消すためのスタイル
		domMain.style.backgroundColor = 'transparent';
		domMain.style.border = 'none';

		domContainer.appendChild(domEffect);
		domContainer.appendChild(domMain);
		domRoot.appendChild(domContainer);
	}

	this.set = function (hp, max) {
		w_hp = hp;
		mhp = max;
	}

	this.draw = function () {
		let now_bw = Math.trunc((w_hp / mhp) * width);

		if (domMode) {
			if (w_hp == mhp || !mhp) {
				domContainer.style.display = 'none';
			} else {
				domContainer.style.display = 'block';

				// ステータスバーの移動（レイアウト変更）に追従させる
				const ioTask = g.task.read("io");
				if (ioTask && ioTask.layout && ioTask.layout[2]) {
					const l = ioTask.layout[2];
					domContainer.style.left = `${l.x}px`;
					domContainer.style.top = `${l.y}px`;
				}

				const maxW = width - 2;
				const dom_bbw = Math.trunc((before_barwidth / width) * maxW);
				const dom_now_bw = Math.trunc((now_bw / width) * maxW);

				// 赤いバー（減少時の追従エフェクト）
				domEffect.style.width = `${dom_bbw}px`;

				// メインのバー（HP残量）
				domMain.max = maxW;
				domMain.value = (dom_bbw < dom_now_bw) ? dom_bbw : dom_now_bw;
				domMain.low = maxW * 0.2;
				domMain.high = maxW * 0.7;
				domMain.optimum = maxW * 0.8;
			}
		}

		barDraw.hp = w_hp;
		barDraw.mhp = mhp;
		barDraw.bbw = before_barwidth;

		device.putFunc(barDraw);

		if (before_barwidth > now_bw) before_barwidth = before_barwidth - 1;
		if (before_barwidth < now_bw) before_barwidth = before_barwidth + 3;
	};

	// hpbar - Canvas用描画
	barDraw.draw = function (device) {
		if (this.hp == this.mhp) return;

		const per = this.hp / this.mhp;
		let cbar = (per > 0.7) ? "limegreen" : (per > 0.5) ? "yellowgreen" : (per > 0.2) ? "yellow" : "orange";

		device.beginPath();
		device.fillStyle = "black"; //clear 
		device.fillRect(x, y, width, height);

		device.fillStyle = "red"; //effect 
		device.fillRect(x + 1, y + 1, this.bbw, height - 1);
		device.fillStyle = cbar; //hpbar 
		const bw = Math.trunc((this.hp / this.mhp) * width);
		device.fillRect(x + 1, y + 1, (this.bbw < bw) ? this.bbw : bw, height - 1);
	};
}