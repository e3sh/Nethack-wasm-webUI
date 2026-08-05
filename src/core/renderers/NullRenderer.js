/**
 * NullRenderer.js - WebUICore 無描画（モック）レンダラー
 *
 * 画面描画処理をすべて no-op (無効化) またはログ追跡のみにした、
 * ヘッド構成での自動テスト・CI/CD環境・ベンチマーク専用の IRenderer 実装。
 */

export class NullRenderer {
    constructor() {
        this.drawnGlyphsCount = 0;
        this.messages = [];
        this.status = {};
    }

    init() {}
    clearMap() {
        this.drawnGlyphsCount = 0;
    }
    drawGlyph(x, y, glyphInfo) {
        this.drawnGlyphsCount++;
    }
    updateStatus(statusFields) {
        Object.assign(this.status, statusFields);
    }
    appendMessage(text) {
        this.messages.push(text);
    }
    showPrompt(promptInfo) {}
    hidePrompt() {}
    showMenu(items) {}
    showTextModal(text) {}
}
