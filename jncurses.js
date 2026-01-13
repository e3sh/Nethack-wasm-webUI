/**
 * @class
 * @classdesc
 * TEXT CONSOLE DISPLAY EMU LIB 
 * javascript ncurses
 * @example
 * consl = new textConsole(80, 30);
 * consl.setFontId("std"); 
 * consl.setPrompt( ["#" ,"_"]);
 * consl.setCharwidth(8);
 * consl.setLinewidth(16);
 * 
 * consl.draw(gameCore, 0 ,0);
 */
class jncurses{
    /**
     * @constructor
     * @param {number} width textBufferWidthSize
     * @param {number} column textBufferLineSize
     * @description
     * instance create
     */
   constructor(width, column){

        const textbuffer = [];
        const rewritecount = [];

        const BUFW = width;
        const BUFH = column;

        const cursor = {x:0, y:0};
        let enableScroll = false;
        let scrollCount = 0;

        let fontId;
        let prompt;
        let charw = 8;
        let linew = 16;

        let useutf = false;

        let shift = {ready:false, pos:15, v:0};

        /**
         * @member
         * @type {string[]}
         * @description
         * textBuffer
         */
        this.buffer = textbuffer;
        /**
         * @member
         * @type {object}
         * @description
         * cursorPosition
         */
        this.cursor = cursor;
        /**
         * @method
         * @param {number | string} Id
         * @description
         * 使用するフォントIDの指定/ASCII font Id
         */
        this.setFontId = (fId)=>{
            fontId = fId;
        }
        /**
         * @method
         * @param {string[]} p 
         * @description
         * カーソル文字の指定
         * @example
         * ["_","#"]
         */
        this.setPrompt = (p)=>{
            prompt = p;
        }
        /**
         * @method
         * @param {number} num 行間pixel
         * @description
         * 改行幅の指定
         */
        this.setLinewidth = (num)=>{
            linew = num;
        }
        /**
         * @method
         * @param {number} num 文字幅pixel
         * @description
         * 文字幅の指定
         */
        this.setCharwidth = (num)=>{
            charw = num;
        }
        /**
         * @method
         * @param {boolean} sw 漢字使用
         * @description
         * ASCIIのみか漢字使用か選択指定
         */
        this.setUseUTF = (sw)=>{
            useutf = sw;
        }
        /**
         * @method
         * @param {number} new_x 移動先ｘ座標
         * @param {number} new_y 移動先ｙ座標
         * @description
         * カーソルを任意の位置（座標）に移動
         */
        this.move = (new_x, new_y)=>{
            if ((new_x >= 0)&&(new_x <= BUFW-1)) cursor.x = new_x;
            if ((new_y >= 0)&&(new_y <= BUFH-1)) cursor.y = new_y;
        }
        /**
         * @method
         * @param {string} chr_to_add 文字
         * @description
         * カーソル位置に1文字表示 
         */
        this.addch = (chr_to_add) =>{
            this.printw(chr_to_add);
        }
        /**
         * @method
         * @param {string} text 文字列
         * @description
         * カーソル位置から右方向に文字列を表示 
         */
        this.printw = (text) =>{
            let s = textbuffer[cursor.y];

           // console.log(s + cursor.x + cursor.y);

            let d = s.slice(0,cursor.x);

            let n = cursor.x + text.length; 
            if (n < BUFW) {
                d = d + text + s.slice(n,BUFW-1);
            } else {
                d = d + text;
                d = d.slice(0, BUFW);
            }

            textbuffer[cursor.y] = d;
            rewritecount[cursor.y]++;
        }
        /**
         * @method
         * @param {string} text 文字列
         * @param {number} x 開始ｘ座標
         * @param {number} y 開始ｙ座標
         * @description
         * カーソル位置を指定して右方向に文字列を表示<br>\
         * move関数とprintw関数を組み合わせた関数
         */
        this.mvprintw = (text, x, y) =>{
            this.move(x, y);
            this.printw(text);
        }
        /**
         * @method
         * @param {string} string
         * @description
         * カーソル位置に文字を挿入し、それより右の文字列を右に1文字分ずらす 
         */
        this.insch = (str) =>{
            let s = textbuffer[cursor.y];

            let d = s.slice(0,cursor.x);

            d = d + str + s.slice(cursor.x, BUFW-1);
            //d = d.slice(0, BUFW);

            textbuffer[cursor.y] = d;
            rewritecount[cursor.y]++;
        }
        /**
         * @method
         * @description
         * カーソル位置に空行を挿入し、それより下の行を下方向に1行分スクロールする 
         */
        this.insertln = () =>{

            for (let i = BUFH-1; i>cursor.y; i-- ){
                textbuffer[i] = textbuffer[i-1];
            }
            textbuffer[cursor.y] = " ".repeat(BUFW);
            rewritecount[cursor.y]++;

            shift = {ready:true, pos:linew, v:1};
        }
        /**
         * @method
         * @description
         * カーソル位置の文字を削除し、それより右の文字列を左に1文字分ずらす
         */
        this.delch = () =>{
            let s = textbuffer[cursor.y];

            let d;
            if (cursor.x > 0){
                d = s.slice(0,cursor.x);
                d = d + s.slice(cursor.x+1, BUFW-1);
            } else {
                d = s.slice(1,BUFW-1);
            }
            textbuffer[cursor.y] = d;
            rewritecount[cursor.y]++;
        }
        /**
         * @method
         * @description
         * カーソル位置の行を削除し、それより下の行を上に1行分スクロールする
         */
        this.deleteln = () =>{
            scrollUp(cursor.y);
            /*
            for (let i = cursor.y; i<BUFH-1; i++ ){
                textbuffer[i] = textbuffer[i+1];
            }
            textbuffer[BUFH-1] = " ".repeat(BUFW);
            */
            shift = {ready:true, pos:linew, v:-1};
        }
        /**
         * @method
         * @description
         * 画面全体を消去
         */
        this.clear = ()=>{
            
            for (let i=0; i<BUFH; i++){
                textbuffer[i] = " ".repeat(BUFW); 
                rewritecount[i] = 0;               
            }
        }
        // textbuffer initialize.
        this.clear();
        /**
         * @method
         * @param {boolean} mode
         * @description
         * スクロール可能/不可を設定
         * (Scroll:false/free ,true/lock 
         */
        this.scrolllock =(mode) =>{
            enableScroll = !mode;
        }
        /**
         * @method
         * @param {number} linenum
         * @description 
         * 指定行数をスクロール
         */
        this.wscrl = (linenum) =>{

            if (enableScroll && (scrollCount < 1)) { //action 
                scrollCount = linenum;
            }
            //console.log(scrollCount +" "+ enableScroll);
        }
        /**
         * 
         * @param {number} startLn
         * @description
         * inner function 
         */
        function scrollUp(startLn){
            for (let i = startLn; i<BUFH-1; i++ ){
                textbuffer[i] = textbuffer[i+1];
                rewritecount[i]++;
            }
            textbuffer[BUFH-1] = " ".repeat(BUFW);
        }

        this.rewritecheck = ()=>{
            let c = 0;
            for (let i=0; i<BUFH; i++){
                c = c + rewritecount[i];               
            }
            c = c + scrollCount;
            c = c + ((shift.ready)?1:0);

            return c;
        }
        /**
         * @method
         * @param {GameCore} g　gameCoreインスタンス
         * @param {number} [x=0] 描画位置x 
         * @param {number} [y=0] 描画位置y
         * @description
         * draw funciton/描画してscreenに反映する
        */
        this.draw = (g, x = 0, y = 0)=>{

            let pos = 0;
            if (shift.ready){
                shift.pos--;

                if (shift.v > 0){
                    pos = (-shift.pos+linew)-linew;
                }else{
                    pos = shift.pos;
                }

                if (shift.pos < 1) shift.ready = false;

            }
            if (scrollCount >0){
                scrollUp(0);
                scrollCount--;
            }
            if (Boolean(fontId)){
                for (let i in textbuffer){
                    let w = 0;
                    if (i >= cursor.y) w = pos;

                    if (!useutf) {
                        g.font[fontId].putchr(textbuffer[i], x,  y + i*linew + w);
                    }else{
                        g.kanji.putchr(textbuffer[i], x,  y + i*linew + w, 0.5);
                    }
                }        
                if (Boolean(prompt)){   
                    let d = (g.blink())?prompt[1]:prompt[0];   

                    if (!useutf) {
                        g.font[fontId].putchr(d,x + cursor.x*charw ,y + cursor.y*linew);
                    }else{
                        g.kanji.putchr(d,x + cursor.x*charw ,y + cursor.y*linew, 0.5);
                    }
                }
                //g.font[fontId].putchr(`${this.rewritecheck()}`,x,y);    
            }

            for (let i=0; i<BUFH; i++){
                rewritecount[i] = 0;               
            }
        }
    } 
}
