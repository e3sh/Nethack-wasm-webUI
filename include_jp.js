//============================================
// include for NetHackJP Wasm Release
//============================================

const r = "rogue/";
const p = "param/";
const s = "sys/";
const n = "./"; // Wasm files are in the same folder

// Universal dynCall polyfill for WebAssembly table execution
(function setupUniversalDynCalls() {
    const executeWasmTable = function (index, ...args) {
        const table = (typeof wasmTable !== 'undefined') ? wasmTable : (window.Module && window.Module.wasmTable);
        if (table) return table.get(index)(...args);
        console.error("wasmTable is not available for index " + index);
    };

    // Specific signatures used by NetHack & Emscripten
    const knownSignatures = [
        'dynCall_v', 'dynCall_vi', 'dynCall_vii', 'dynCall_viii', 'dynCall_viiii', 'dynCall_viiiii', 'dynCall_viiiiii', 'dynCall_viiiiiiiii',
        'dynCall_i', 'dynCall_ii', 'dynCall_iii', 'dynCall_iiii', 'dynCall_iiiii', 'dynCall_iiiiii', 'dynCall_iiiiiii',
        'dynCall_viij', 'dynCall_jiji', 'dynCall_iidiiii'
    ];
    knownSignatures.forEach(sig => {
        window[sig] = function (index, ...args) { return executeWasmTable(index, ...args); };
    });

    // Auto-generate signatures for varying lengths of i / v
    for (let len = 1; len <= 12; len++) {
        const sigs = [
            'dynCall_' + 'i'.repeat(len),
            'dynCall_v' + 'i'.repeat(len),
            'dynCall_vi' + 'i'.repeat(len)
        ];
        sigs.forEach(sig => {
            if (!window[sig]) {
                window[sig] = function (index, ...args) { return executeWasmTable(index, ...args); };
            }
        });
    }
})();

// Emscripten Module configuration for NetHackJP
window.Module = {
    noInitialRun: true,
    arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
    preRun: [function () {
        if (typeof ENV !== 'undefined') {
            ENV.USER = undefined;
            ENV.LOGNAME = undefined;
            ENV.HOME = "/";
            ENV.HACKDIR = "/";
            ENV.SCOREDIR = "/save/";
            ENV.LEVELDIR = "/";
            ENV.SAVEDIR = "/save/";
            ENV.NETHACKOPTIONS = "time,showexp,showvers,number_pad";
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
        if (text.trim()) console.log('NHJP Log: ' + text);
    },
    printErr: function (text) {
        if (text.trim()) console.error('NHJP Error: ' + text);
    },
    locateFile: function (path, prefix) {
        if (path.endsWith(".wasm")) return n + "nethack_jp.wasm";
        return prefix + path;
    }
};

const w = [
    // GameCore
    s + "coremin.js",
    s + "inputKeyboard2.js",
    r + "UI/DisplayDevice.js",
    r + "UI/DisplayManager.js",
    r + "UI/LayoutManager.js",
    s + "jncurses.js",
    s + "main.js",
    s + "ioControl.js",
    s + "sceneControl.js",
    // Rogue 
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
    // NetHackJP Wasm
    n + "nethack_jp.js",
];

for (let i in w) {
    const cb = new Date().getTime();
    document.write(`<script type="text/javascript" src="${w[i]}?v=${cb}"></script>`);
};

// Force LANG_JP = false to bypass JS translation engine and display NetHackJP native UTF-8 strings as-is
window.addEventListener('DOMContentLoaded', () => {
    let checkG = setInterval(() => {
        if (window.g && window.g.define) {
            window.g.define.LANG_JP = false;
            console.log("NetHackJP Mode: JS-level LANG_JP set to false (Native UTF-8 Pass-through Mode)");
            clearInterval(checkG);
        }
    }, 100);
});
