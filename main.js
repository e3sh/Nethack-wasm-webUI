// main Nethack web UI 2026/01/12-
//----------------------------------------------------------------------
function main() {

    console.log("main.js start");

    const sysParam = { canvasId: "layer0", 
            screen: [{ resolution: { w: 960, h: 600 , x:0, y:0 } }]
     	};
	const game = new GameCore( sysParam );

	//Game Asset Setup
    const p = "pict/";
    game.asset.imageLoad("ASCII", p + "pdcfont.png");
    game.asset.imageLoad("SMALL", p + "k12x8_jisx0201c.png");
    game.asset.imageLoad("MINIF", p + "font4x6.png");
    //game.asset.imageLoad("ASCBG", p + "pdcfont_bg.png");
    //game.asset.imageLoad("SJISK", p + "k12x8_jisx0208c.png")
    game.asset.imageLoad("ASC32", p + "a32_jisx0201c.png")
    game.asset.imageLoad("KNJ32", p + "k32_jisx0208.png")
    game.asset.imageLoad("TILES", p + "NethackModern32x-360.png")

    game.kanji = new fontPrintControl_with_glyph(game,
        game.asset.image["ASC32"].img, 16, 32,
        game.asset.image["KNJ32"].img, 32, 32,
        game.asset.image["TILES"].img, 32, 32,
        tileMapping()
    );
    /*
    game.kanji = new fontPrintControl(game,
        game.asset.image["ASC32"].img, 16, 32,
        game.asset.image["KNJ32"].img, 32, 32,
    );
    */
    game.kanji.useScreen(0);

	const spfd = SpriteFontData();
	for (let i in spfd) {
	    game.setSpFont(spfd[i]);
	}

    //Game Task Setup
   	game.task.add(new ioControl("io"));
	game.task.add(new sceneControl("scene"));
	//
    const canvas = game.systemCanvas;
    canvas.width = 960;
    canvas.height = 600;

    const ctx = canvas.getContext('2d');
    // 画像の平滑化を無効にする
    ctx.imageSmoothingEnabled = false;

	game.screen[0].setBackgroundcolor("black"); 
    game.screen[0].setInterval(1); 

    game.keyboard.codeMode();

    console.log("gameCore start");
	game.run();
}

//----------------------------------------------------------------------
// SpriteFontData
function SpriteFontData() {

    //8_16_font
	let sp = [];
    for (let i = 0; i < 8; i++) {// normal 1 - 3(<4)
        for (j = 0; j <32; j++) {
            ptn = { x:  8 * j, y: 16 * i, w:  8, h: 16 }
            sp.push(ptn);
        }
    }
    //6_8_font
    let s2 = [];
    for (let i = 0; i < 16; i++) {
        for (j = 0; j <16; j++) {
            ptn = { x:  6 * j, y: 8 * i, w:  6, h: 8 }
            s2.push(ptn);
        }
    }
    //4_6_font
    let ss = [];
    for (let i = 0; i < 6; i++) {
        for (j = 0; j <16; j++) {
            ptn = { x:  4 * j, y: 6 * i, w:  4, h: 6 }
            ss.push(ptn);
        }
    }
    //16_32_font
    let s3 = [];
    for (let i = 0; i < 16; i++) {
        for (j = 0; j <16; j++) {
            ptn = { x:  8 * j, y: 16 * i, w:  8, h: 16 }
            s3.push(ptn);
        }
    }

    return [
        { name: "std"   , id: "ASCII", pattern: sp, ucc: true },
        { name: "std_l" , id: "ASC32", pattern: s3, ucc: true },
        { name: "small" , id: "SMALL", pattern: s2 ,ucc: true},
        { name: "mini"  , id: "MINIF", pattern: ss },
        //{ name: "stdbg" , id: "ASCBG", pattern: sp, ucc: true },
    ]
}
