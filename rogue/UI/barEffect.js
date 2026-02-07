function barEffect(g, x, y, width, height){

	let before_barwidth = 0;
	let device = g.screen[0];
	let w_hp, mhp;

	const barDraw = { hp: 0, mhp: 0, bbw: 0 };
	/*
    <div style="position:fixed; top:0; right:0; z-index:100; opacity:0.3;">
        <a href="javascript:void(0)" onclick="saveAndTransition()" style="color:white; font-size:10px;">Canvas Mode</a>
    </div>
	*/
	/*
	const domroot = document.getElementById(`ui-root`); //ui-root
	const domMode = (domroot)? true: false;
	if (domMode){
		const barMain = document.createElement('meter');
		barMain.id = "Effectbar";
		barMain.style = "position:fixed; top:0; right:0; z-index:100; opacity:0.3;";
		barMain.optimum = 0.3;
		barMain.value = 0.5;
		stbar.appendChild(barMain);
	}
	*/

	this.set = function(hp, max){
		w_hp = hp;
		mhp = max;
	}

	this.draw = function () {
		let now_bw = Math.trunc((w_hp / mhp) * width);

		barDraw.hp = w_hp;
		barDraw.mhp = mhp;
		barDraw.bbw = before_barwidth;

		device.putFunc(barDraw);

		if (before_barwidth > now_bw) before_barwidth = before_barwidth - 1;
		if (before_barwidth < now_bw) before_barwidth = before_barwidth + 3//now_bw;
	};

	//hpbar
	barDraw.draw = function (device) {
		if (this.hp == this.mhp) return;// && this.bbw == this.hp) return;

		const per = this.hp / this.mhp;
		let cbar = (per > 0.7) ? "limegreen" : (per > 0.5) ? "yellowgreen" : (per > 0.2)? "yellow" : "orange" ; 

		device.beginPath();
		device.fillStyle = "black"; //clear 
		device.fillRect(x, y, width, height);

		device.fillStyle = "red"; //effect 
		device.fillRect(x + 1, y + 1, this.bbw, height - 1);
		device.fillStyle = cbar; //hpbar 
		const bw =  Math.trunc((this.hp / this.mhp) * width);
		device.fillRect(x + 1, y + 1, (this.bbw < bw)?this.bbw: bw, height - 1);
		//border
		//device.strokeStyle = cborder;
		//device.lineWidth = 2;
		//device.rect(x, y, width, height);
		//device.stroke();
	};
}