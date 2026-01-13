//do_motion
//throw firebolt missile 
//motionanimation graphics
function moveEffect(g){

    let elist = []; //effectlist

    let shiftx = 0;
    let shifty = 0;

    this.setDrawIndex =(x, y)=>{shiftx = x; shifty = y;} 
    /**
     * タスク用
     * @param {char} aschr 表示キャラクタ
     * @param {coord} st 開始テキスト位置 ({x:､y:}) 
     * @param {coord} ed 終了テキスト位置 ({x:､y:})
     * @param {number} lifetime 移動停止後の表示フレーム数指定 
     * @param {number} startdelay 設定から移動開始するまでの待機フレーム数指定
    */
    function eftask(aschr, st, ed, lifetime, startdelay){

        if (isNaN(lifetime)) lifetime = 0;
        if (isNaN(startdelay)) startdelay = 0;
        //if (isNaN(wait)) wait = 1;

        let living = true;

        let sx = st.x * 8;
        let sy = st.y * 16;

        let cw = (ed.x*8 ) - sx
        let ch = (ed.y*16) - sy;

        sx += shiftx;
        sy += shifty;

        let count = Math.max(Math.abs(cw), Math.abs(ch));
        
        let vx = cw / count;
        let vy = ch / count;

        this.step = function(){
            if (--startdelay < 0){
                if (--count < 0) {
                    if (--lifetime<0) living = false;
                }else{
                    sx += vx;
                    sy += vy;
                }
            }
            return living;
        }
        this.draw = function(g){
            if (startdelay <= 0)
                g.font["small"].putchr(aschr, sx, sy);
        }
    }

    /**
     * 文字移動の中継位置表示用
     * @param {char} ch 表示キャラクタ
     * @param {coord} st 開始テキスト位置({x:､y:}) 
     * @param {coord} ed 終了位置
     */
    this.setEffect = function(ch, st, ed, lt, sd){

        const ioC = g.task.read("io");
        if (ioC.camera.enable){
            let locx = ioC.camera.x/8;
            let locy = ioC.camera.y/16;

            st.x += locx;
            st.y += locy;
            ed.x += locx;
            ed.y += locy;
        }


        const obj = new eftask(ch, st, ed, lt, sd);
        elist.push(obj)
    }
    
    this.step = function(){

        let nl = [];
        elist.forEach((value)=>{
            if (value.step()) nl.push(value);
        })
        elist = nl;
   }

    this.draw = function(g){
        elist.forEach((value)=>{
            value.draw(g);
        })
    }
}