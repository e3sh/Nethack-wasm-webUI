/**
 * @class LayoutManager
 * @description
 * 画面解像度や実行環境（Mobile/Desktop）に応じたレイアウト調整を管理します。
 * DisplayManager と連携して各コンソールの座標を制御します。
 */
class LayoutManager {
    constructor(displayManager) {
        this.dm = displayManager;
        this.g = displayManager.g;
    }

    /**
     * 画面サイズに基づいてレイアウトを更新します。
     * (mobile.html の reportWindowSize ロジックを抽象化したもの)
     */
    applyResponsiveLayout(width, height) {
        const dm = this.dm;
        const gm = this.g.rogue;
        const scene = this.g.task.read("scene");

        if (!dm || !gm || !scene) return;

        // Named Layouts へのショートカット
        const MAP = dm.getLayout("MAP");
        const STATUS = dm.getLayout("STATUS");
        const MESSAGE = dm.getLayout("MESSAGE");
        const WINDOW = dm.getLayout("WINDOW");

        const d = gm.define;

        const isMobileOrNarrow = (height < 600 || width < 640);

        if (isMobileOrNarrow) {
            // モバイルまたは縦長画面向け：下部固定フッターレイアウト
            const footerH = 96; // Status(48) + Message(48)
            const mapH = height - footerH;

            if (MAP) {
                MAP.x = 0;
                MAP.y = 0;
                MAP.w = 640;
                MAP.h = mapH;
            }
            // 下から順に配置 (Message が一番下、その上が Status)
            if (STATUS) {
                STATUS.x = 16;
                STATUS.y = height - 96;
                STATUS.w = (width < 640) ? 320 : 640;
                STATUS.h = 48;
            }
            if (MESSAGE) {
                MESSAGE.x = 0;
                MESSAGE.y = height - 48;
                MESSAGE.w = 864;
                MESSAGE.h = 576;
            }
            if (WINDOW) { WINDOW.x = 0; WINDOW.y = 0; WINDOW.w = 640; WINDOW.h = 512; }

            // キャラクターを可視マップ領域の中心に持ってくるための調整 (16pxタイル基準)
            // UIManager.js の setCameraPos (COLS/2, LINES/2) と整合性を取る
            const adjX = (d.COLS * 8) - (width / 2);
            const adjY = (d.LINES * 8) - (mapH / 2);

            scene.setCameraAdjparam(adjX);
            gm.UI.setCameraAdjY(adjY);

            gm.UI.setVScroll(true);
            gm.UI.io.setSimpleSL(width < 640);
        } else {
            // デスクトップ/大画面固定レイアウト
            if (MAP) { MAP.x = 0; MAP.y = 0; MAP.w = 640; MAP.h = 384; }
            if (STATUS) { STATUS.x = 64; STATUS.y = 384; STATUS.w = 640; STATUS.h = 48; }
            if (MESSAGE) { MESSAGE.x = 48; MESSAGE.y = 432; MESSAGE.w = 864; MESSAGE.h = 576; }
            if (WINDOW) { WINDOW.x = 320; WINDOW.y = 48; WINDOW.w = 640; WINDOW.h = 512; }

            gm.UI.setCameraAdjY(0);
            scene.setCameraAdjparam(160);
            gm.UI.io.setSimpleSL(false);
            gm.UI.setVScroll(false);
        }
    }
}
