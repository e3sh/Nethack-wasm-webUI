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

        if (height < 600) {
            // モバイル縦向け/小画面最適化
            if (MAP) { MAP.x = 0; MAP.y = -512 + height; MAP.w = 640; MAP.h = 384; }
            if (STATUS) { STATUS.x = 16; STATUS.y = height - 96; STATUS.w = 640; STATUS.h = 48; }
            if (MESSAGE) { MESSAGE.x = 0; MESSAGE.y = height - 48; MESSAGE.w = 864; MESSAGE.h = 576; }
            if (WINDOW) { WINDOW.x = 0; WINDOW.y = 0; WINDOW.w = 640; WINDOW.h = 512; }

            gm.UI.setVScroll(true);
        } else {
            // デスクトップ/大画面向け標準配置
            if (MAP) { MAP.x = 0; MAP.y = 0; MAP.w = 640; MAP.h = 384; }
            if (STATUS) { STATUS.x = 64; STATUS.y = 384; STATUS.w = 640; STATUS.h = 48; }
            if (MESSAGE) { MESSAGE.x = 48; MESSAGE.y = 432; MESSAGE.w = 864; MESSAGE.h = 576; }
            if (WINDOW) { WINDOW.x = 320; WINDOW.y = 48; WINDOW.w = 640; WINDOW.h = 512; }

            scene.setCameraAdjparam(160);
            gm.UI.io.setSimpleSL(false);
            gm.UI.setVScroll(false);
        }

        if (width < 640) {
            // 横幅不足時の補正
            if (STATUS) { STATUS.x = 16; STATUS.y = 384; STATUS.w = 320; STATUS.h = 48; }
            scene.setCameraAdjparam((1280 - width) / 2);
            gm.UI.io.setSimpleSL(true);
        }
    }
}
