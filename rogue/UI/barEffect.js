function barEffect(g, x, y, width, height){

	let before_barwidth = 0;
	let device = g.screen[0];
	let w_hp, mhp;

	const barDraw = { hp: 0, mhp: 0, bbw: 0 };

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
		if (before_barwidth <= now_bw) before_barwidth = now_bw;
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
		device.fillRect(x + 1, y + 1, (this.hp / this.mhp) * width, height - 1);
		//border
		//device.strokeStyle = cborder;
		//device.lineWidth = 2;
		//device.rect(x, y, width, height);
		//device.stroke();
	};
}