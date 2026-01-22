//============================================
// include for Release (Self-contained)
//============================================

const r = "rogue/";
const p = "param/";
const n = "./"; // Wasm files are in the same folder

// Emscripten Module configuration
window.Module = {
    noInitialRun: true,
    arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
    preRun: [function () {
        if (typeof ENV !== 'undefined') {
            ENV.USER = undefined;
            ENV.LOGNAME = undefined;
            ENV.HACKDIR = "/"; // Embedded files are at root
            ENV.SCOREDIR = "/save/";
            ENV.LEVELDIR = "/";
            ENV.SAVEDIR = "/save/";
            ENV.NETHACKOPTIONS = "time,showexp,showvers,number_pad";//askname";
        }
    }],
    print: function (text) {
        if (text.trim()) console.log('NH Log: ' + text);
    },
    printErr: function (text) {
        if (text.trim()) console.error('NH Error: ' + text);
    },
    locateFile: function (path, prefix) {
        if (path.endsWith(".wasm")) return n + path;
        return prefix + path;
    }
};

const w = [
    // GameCore (Local copy)
    "coremin.js",
    "jncurses.js",
    "main.js",
    "ioControl.js",
    "sceneControl.js",
    // Rogue 
    r + "GameManager.js",
    r + "UIManager.js",
    r + "UI/io.js",
    r + "UI/trancelate.js",
    r + "UI/moveEffect.js",
    r + "UI/monsHpView.js",
    r + "UI/barEffect.js",
    r + "UI/fontPrintControl_with_glyph.js",
    // Rogue Parameters
    p + "rogueDefines.js",
    p + "rogueFuncs.js",
    p + "rogueTypes.js",
    p + "tileMapping.js",
    p + "nhMessage_org.js",
    p + "nhMessage_jp.js",
    p + "nhMessage_pattern.js",
    p + "nhMessage_entity.js",
    p + "utfmap.js",
    // Wasm files    // NetHack Wasm
    n + "nethack.js",
];

for (let i in w) {
    document.write(`<script type="text/javascript" src="${w[i]}"></script>`);
};
