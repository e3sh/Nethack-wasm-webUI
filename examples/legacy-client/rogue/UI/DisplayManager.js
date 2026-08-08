/**
 * @class DisplayManager
 * @description
 * 複数のコンソールデバイスを管理し、名前ベースのアクセスを提供します。
 * 実行環境に応じて適切なレンダラーを生成します。
 */
class DisplayManager {
    constructor(g) {
        this.g = g;
        this.devices = {};
        this.layouts = []; // インデックスベース（互換用）
        this.namedLayouts = {}; // 名前ベース
        this.isMobile = !!document.getElementById("ui-root");
        this.domRoot = document.getElementById("ui-root");
    }

    /**
     * 新しいコンソールを追加します
     * @param {string} name コンソール名 (e.g. "MAP", "STATUS")
     * @param {number} index 配列インデックス (互換用)
     * @param {Array} config [w, h, fontId, prompt, charW, lineW, x, y, bgColor, useUtf]
     */
    addConsole(name, index, config) {
        const [w, h, fontId, prompt, charW, lineW, x, y, bg, useUtf] = config;
        let device;

        if (this.isMobile) {
            const cId = `console-${name}`;
            let cDiv = document.getElementById(cId);
            if (!cDiv) {
                cDiv = document.createElement('div');
                cDiv.id = cId;
                this.domRoot.appendChild(cDiv);
            }
            if (bg) cDiv.style.backgroundColor = bg;

            device = new mobileCurses(w, h, cId);
        } else {
            device = new jncurses(w, h);
            device.setFontId(fontId);
            device.setPrompt(prompt);
            device.setCharwidth(charW);
            device.setLinewidth(lineW);
            device.setUseUTF(Boolean(useUtf));
        }

        const layout = { con: device, x: x, y: y, w: w * charW, h: h * lineW, bg: this.isMobile ? null : bg };

        this.devices[name] = device;
        this.namedLayouts[name] = layout;

        // 互換性維持のためグローバルな配列にも登録
        if (!this.g.console) this.g.console = [];
        this.g.console[index] = device;
        this.layouts[index] = layout;

        return device;
    }

    get(name) {
        return this.devices[name];
    }

    getLayout(name) {
        return this.namedLayouts[name];
    }

    /**
     * 指定した名前のコンソールの表示/非表示を切り替えます
     */
    setVisible(name, visible) {
        const dev = this.get(name);
        if (dev && dev.root) {
            dev.root.style.display = visible ? 'block' : 'none';
        }
    }
}
