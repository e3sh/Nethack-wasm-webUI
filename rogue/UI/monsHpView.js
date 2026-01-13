
//monsterHpBar Draw graphics
//
function monsHpView(g){

    let elist = []; //effectlist

    let shiftx = 0;
    let shifty = 0;

    this.setDrawIndex =(x, y)=>{shiftx = x; shifty = y;} 
    /**
     * タスク用
     * @param {coord} pos 表示位置 ({x:､y:}) 
     * @param {number} hp 現在のHP
     * @param {number} max 最大HP
    */
    function eftask(pos, hp, max){

        let sx = pos.x * 8;
        let sy = pos.y * 16;

        sx += shiftx;
        sy += shifty;

        this.draw = function(g){
            let str = `${hp}/${max}`;
            let ix = Math.floor((str.length/2) * 6);

            g.font["small"].putchr(str, sx-ix, sy);
        }
    }

    /**
     * 文字移動の中継位置表示用
     * @param {char} ch 表示キャラクタ
     * @param {coord} st 開始テキスト位置({x:､y:}) 
     * @param {coord} ed 終了位置
     */
    this.setEffect = function(pos, hp, max){

        let rx = pos.x;
        let ry = pos.y;

        const ioC = g.task.read("io");
        if (ioC.camera.enable){
            let locx = ioC.camera.x/8;
            let locy = ioC.camera.y/16;

            rx = pos.x + locx;
            ry = pos.y + locy;
        }

        const obj = new eftask({x:rx, y:ry}, hp, max);
        elist.push(obj)
    }
    
    this.resetEffects = function(){
        elist = [];
   }

    this.draw = function(g){
        elist.forEach((value)=>{
            value.draw(g);
        })
    }
}