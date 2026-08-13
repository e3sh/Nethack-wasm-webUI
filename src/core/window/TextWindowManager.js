/**
 * TextWindowManager.js - WebUICore テキストウィンドウバッファ管理モジュール
 *
 * putstr / display_nhwindow / clear_nhwindow / destroy_nhwindow イベント時の
 * ウィンドウ別テキストバッファの生成・蓄積・消化・パースを集中管理する。
 */

export class TextWindowManager {
    constructor(options = {}) {
        this.buffers = {};
        this.translator = options.translator || null;
    }

    setTranslator(translator) {
        this.translator = translator;
    }

    /**
     * 全バッファをリセット・クリア
     */
    resetAll() {
        this.buffers = {};
    }

    /**
     * 特定ウィンドウのバッファを消去
     */
    clearWindow(windowId) {
        if (windowId !== undefined) {
            delete this.buffers[windowId];
        }
    }

    /**
     * 特定ウィンドウにテキスト行を追加
     */
    appendLine(windowId, rawText) {
        if (windowId === undefined) return;
        if (!this.buffers[windowId]) {
            this.buffers[windowId] = [];
        }
        this.buffers[windowId].push(rawText || '');
    }

    /**
     * 特定ウィンドウのバッファが存在し、中身があるか判定
     */
    hasBuffer(windowId) {
        return !!(this.buffers[windowId] && this.buffers[windowId].length > 0);
    }

    /**
     * 特定ウィンドウのバッファを取得してクリア
     */
    flushBuffer(windowId) {
        if (!this.hasBuffer(windowId)) return null;

        const rawBufferLines = [...this.buffers[windowId]];
        delete this.buffers[windowId];

        const rawText = rawBufferLines.join('\n').trim();
        if (!rawText) return null;

        // タイトルの抽出（1行目が短文かつヘッダーっぽい場合のパース）
        let title = '';
        if (rawBufferLines.length > 1) {
            const firstLine = rawBufferLines[0].trim();
            if (firstLine.length > 0 && firstLine.length < 50 && !firstLine.includes('.')) {
                title = firstLine.replace(/^#/, '').trim();
            }
        }

        const translatedTitle = (this.translator && typeof this.translator.translate === 'function')
            ? this.translator.translate(title || 'Document')
            : (title || 'Document');

        return {
            windowId: windowId,
            title: translatedTitle,
            rawTitle: title,
            lines: rawBufferLines,
            text: rawText
        };
    }
}
