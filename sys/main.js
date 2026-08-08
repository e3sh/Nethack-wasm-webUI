// main Nethack web UI 2026/01/12-
//----------------------------------------------------------------------
async function main() {

    const USE_TILE = true;//false;
    const RESW = 960; //(USE_TILE)?1280:960;
    const RESH = 600;

    //console.log("main.js start");

    const sysParam = {
        canvasId: "layer0",
        screen: [{ resolution: { w: RESW, h: RESH, x: 0, y: 0 } }]
    };
    const game = new GameCore(sysParam);
    
    // 軽量化・パッシブ化版 inputKeyboard2 にキーボード処理を丸ごと差し替え
    game.keyboard = new inputKeyboard2(true);
    game.keyboard.codeMode();

    // Load Default Configurations from JSON with multi-path fallbacks
    try {
        const isLegacyDirInMain = typeof window !== 'undefined' && window.location.pathname.includes('/examples/legacy-client/');
        const fetchConfig = async (url) => {
            const prefixes = isLegacyDirInMain ? ["../../", "", "../", "examples/legacy-client/"] : ["", "../../", "../", "examples/legacy-client/"];
            for (const prefix of prefixes) {
                try {
                    const res = await fetch(prefix + url);
                    if (res.ok) return await res.json();
                } catch (e) {}
            }
            return null;
        };
        game.gpadConfigDefault = await fetchConfig("param/gpad_config_default.json");
        game.touchConfigDefault = await fetchConfig("param/touch_mapping_default.json");

        // Load External Translation Data if available
        const extTrData = await fetchConfig("nhMessage_ext.json");
        if (extTrData) {
            game.nhMessageExtData = extTrData;
        }
    } catch (e) {
        console.warn("External default config or translation not found or invalid.", e);
    }

    window.g = game; // グローバルに公開

    // Game Asset Setup with location fallback
    const isLegacyDir = typeof window !== 'undefined' && window.location.pathname.includes('/examples/legacy-client/');
    const p = isLegacyDir ? "../../pict/" : "pict/";
    game.asset.imageLoad("ASCII", p + "pdcfont.png");
    game.asset.imageLoad("SMALL", p + "k12x8_jisx0201c.png");
    game.asset.imageLoad("MINIF", p + "font4x6.png");
    game.asset.imageLoad("ASC32", p + "a32_jisx0201c.png");
    game.asset.imageLoad("KNJ32", p + "k32_jisx0208.png");
    game.asset.imageLoad("TILES", p + "nethack_default_32.png");

    if (USE_TILE) {
        game.kanji = new fontPrintControl_with_glyph(game,
            game.asset.image["ASC32"].img, 16, 32,
            game.asset.image["KNJ32"].img, 32, 32,
            game.asset.image["TILES"].img, 32, 32,
            tileMapping()
        );
    } else {
        game.kanji = new fontPrintControl(game,
            game.asset.image["ASC32"].img, 16, 32,
            game.asset.image["KNJ32"].img, 32, 32,
        );
    }
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
    canvas.width = RESW;
    canvas.height = RESH;

    const ctx = canvas.getContext('2d');
    // 画像の平滑化を無効にする
    ctx.imageSmoothingEnabled = false;

    game.screen[0].setBackgroundcolor("black");
    game.screen[0].setInterval(1);

    game.keyboard.codeMode();

    // イベント駆動型スマート描画制御 (Dirty Flag)
    // キー入力やタッチ、マウス操作が発生した瞬間は即座に(最大60FPSで)描画し、
    // 放置・長考中はアニメーションタイマー(200ms周期=毎秒5回)のみに描画を抑えてGPU/CPU負荷を極限まで下げる
    let isDirty = true;

    // 入力イベント発生時に描画フラグをON
    const markDirty = () => { isDirty = true; };
    window.addEventListener('keydown', markDirty, { passive: true });
    window.addEventListener('keyup', markDirty, { passive: true });
    canvas.addEventListener('mousedown', markDirty, { passive: true });
    canvas.addEventListener('mouseup', markDirty, { passive: true });
    canvas.addEventListener('mousemove', markDirty, { passive: true });
    canvas.addEventListener('touchstart', markDirty, { passive: true });
    canvas.addEventListener('touchend', markDirty, { passive: true });

    // 点滅・カーソルアニメーション用に定期的に描画フラグをON (200ms = 毎秒5回)
    setInterval(() => {
        isDirty = true;
    }, 200);

    const MAX_FPS = 60; // 操作時の最大FPS上限
    const fpsInterval = 1000 / MAX_FPS;
    const _originalrAF = window.requestAnimationFrame;
    let _lastFrameTime = 0;

    window.requestAnimationFrame = function (callback) {
        return _originalrAF(function (timestamp) {
            const elapsed = timestamp - _lastFrameTime;
            // 描画フラグが立っており、かつ前回の描画からフレーム上限時間が経過していれば描画を実行
            if (isDirty && elapsed >= fpsInterval) {
                _lastFrameTime = timestamp - (elapsed % fpsInterval);
                isDirty = false; // 描画したらフラグをクリア
                callback(timestamp);
            } else {
                _originalrAF(callback);
            }
        });
    };

    //console.log("gameCore start");
    game.run();

    // Hide loading screen with a slight delay to ensure UI is ready
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        // すぐに非表示にせず、少しだけ待機してレンダリングの準備を待つ
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }, 300);
    }
}

//----------------------------------------------------------------------
// SpriteFontData
function SpriteFontData() {

    //8_16_font
    let sp = [];
    for (let i = 0; i < 8; i++) {// normal 1 - 3(<4)
        for (j = 0; j < 32; j++) {
            ptn = { x: 8 * j, y: 16 * i, w: 8, h: 16 }
            sp.push(ptn);
        }
    }
    //6_8_font
    let s2 = [];
    for (let i = 0; i < 16; i++) {
        for (j = 0; j < 16; j++) {
            ptn = { x: 6 * j, y: 8 * i, w: 6, h: 8 }
            s2.push(ptn);
        }
    }
    //4_6_font
    let ss = [];
    for (let i = 0; i < 6; i++) {
        for (j = 0; j < 16; j++) {
            ptn = { x: 4 * j, y: 6 * i, w: 4, h: 6 }
            ss.push(ptn);
        }
    }
    //16_32_font
    let s3 = [];
    for (let i = 0; i < 16; i++) {
        for (j = 0; j < 16; j++) {
            ptn = { x: 8 * j, y: 16 * i, w: 8, h: 16 }
            s3.push(ptn);
        }
    }

    return [
        { name: "std", id: "ASCII", pattern: sp, ucc: true },
        { name: "std_l", id: "ASC32", pattern: s3, ucc: true },
        { name: "small", id: "SMALL", pattern: s2, ucc: true },
        { name: "mini", id: "MINIF", pattern: ss },
        //{ name: "stdbg" , id: "ASCBG", pattern: sp, ucc: true },
    ]
}
