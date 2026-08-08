//============================================
// include for Release (Self-contained)
//============================================

const r = "rogue/";
const p = "../../param/";
const s = "../../sys/";

const n = "../../"; // Wasm files are in root folder

// Emscripten Module configuration
window.Module = {
    noInitialRun: true,
    arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
    preRun: [function () {
        if (typeof ENV !== 'undefined') {
            ENV.USER = undefined;
            ENV.LOGNAME = undefined;
            ENV.HOME = "/";
            ENV.HACKDIR = "/"; // Embedded files are at root
            ENV.SCOREDIR = "/save/";
            ENV.LEVELDIR = "/";
            ENV.SAVEDIR = "/save/";
            ENV.NETHACKOPTIONS = "time,showexp,showvers,number_pad";//askname";
        }
        if (typeof FS !== 'undefined') {
            try {
                if (!FS.analyzePath('/save').exists) {
                    FS.mkdir('/save');
                }
            } catch (e) {}
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
    s + "coremin.js",
    s + "inputKeyboard2.js",
    r + "UI/DisplayDevice.js",
    r + "UI/DisplayManager.js",
    r + "UI/LayoutManager.js",
    s + "jncurses.js",
    s + "main.js",
    s + "ioControl.js",
    s + "sceneControl.js",
    // Driver
    "../../src/driver/NetHackMemory.js",
    "../../src/driver/NetHackFSManager.js",
    "../../src/driver/InputResolver.js",
    "../../src/driver/NetHackWasmDriver.js",
    "../../src/driver/NetHackWasmWorkerBridge.js",
    // Rogue 
    r + "SoundManager.js",
    r + "GameManager.js",
    r + "UIManager.js",
    r + "UI/io.js",
    r + "UI/trancelate.js",
    r + "UI/moveEffect.js",
    r + "UI/monsHpView.js",
    r + "UI/barEffect.js",
    r + "UI/fontPrintControl_with_glyph.js",
    r + "UI/mobileCurses.js",
    r + "GpadToKey.js",
    r + "inputGridPad.js",
    // Rogue Parameters
    p + "rogueDefines.js",
    p + "rogueFuncs.js",
    p + "rogueTypes.js",
    p + "tileMapping.js",
    p + "nhMessage.js",
    p + "utfmap.js",
    // Wasm files are loaded inside WebWorker (NetHackWasmWorkerBridge)
    // n + "nethack.js",
];

for (let i in w) {
    const cb = new Date().getTime();
    document.write(`<script type="text/javascript" src="${w[i]}?v=${cb}"></script>`);
};
