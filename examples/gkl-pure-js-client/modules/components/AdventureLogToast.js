/**
 * AdventureLogToast.js - 冒険手帳 リアルタイム発見HUDトースト通知
 *
 * モンスター初遭遇、アイテム初識別、噂初収集の瞬間に
 * 画面隅に控えめで洗練されたネオ・レトロトーストを一時表示する。
 * 操作を妨げず、今どきのゲームらしい達成感を提供。
 */

import { GlyphHelper } from '../../../../src/core/renderers/GlyphHelper.js';
import { GLYPH_OFFSETS } from '../../../../src/core/knowledge/engines/glyphClassifier.js';

export class AdventureLogToast {
    /**
     * @param {Object} options
     * @param {HTMLElement} [options.container] - トースト描画親コンテナ
     * @param {Function} [options.onToastClick] - トーストクリック時のコールバック（手帳を開く等）
     */
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.onToastClick = options.onToastClick || null;
        this.toastWrapper = null;
        this.queue = [];
        this.maxVisible = 3;
        this.displayDurationMs = 4000;
        this.currentLang = 'ja';
        this.tileImage = options.tileImage || 'pict/nethack_default_32.png';

        this._initWrapper();
    }

    setLanguage(lang) {
        this.currentLang = lang === 'en' ? 'en' : 'ja';
    }

    setTileImage(url) {
        this.tileImage = url;
    }

    _initWrapper() {
        if (typeof document === 'undefined') return;

        let el = document.getElementById('adventure-log-toast-wrapper');
        if (!el) {
            el = document.createElement('div');
            el.id = 'adventure-log-toast-wrapper';
            el.style.position = 'fixed';
            el.style.top = '60px';
            el.style.left = '50%';
            el.style.transform = 'translateX(-50%)';
            el.style.zIndex = '10050';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'center';
            el.style.gap = '8px';
            el.style.pointerEvents = 'none';
            this.container.appendChild(el);
        }
        this.toastWrapper = el;
    }

    /**
     * 新規アンロックイベントを処理
     * @param {Object} eventData 
     */
    notifyUnlock(eventData) {
        if (!eventData || !this.toastWrapper) return;

        const isEn = this.currentLang === 'en';
        let icon = '📖';
        let glyphId = -1;
        let title = isEn ? 'Adventure Log Updated' : '冒険手帳に登録';
        let detail = '';

        if (eventData.category === 'monster') {
            icon = '👾';
            title = isEn ? '✨ New Monster Encountered!' : '✨ 新種モンスター遭遇！';
            detail = isEn ? (eventData.name || `Monster #${eventData.monOffset}`) : (eventData.nameJa || eventData.name);
            if (eventData.monOffset !== undefined && eventData.monOffset !== null) {
                glyphId = (GLYPH_OFFSETS?.GLYPH_MON_OFF ?? 0) + eventData.monOffset;
            }
        } else if (eventData.category === 'object') {
            icon = '⚔️';
            title = isEn ? '✨ New Item Recorded!' : '✨ 新アイテム入手！';
            detail = isEn ? (eventData.name || `Object #${eventData.onum}`) : (eventData.nameJa || eventData.name);
            if (eventData.onum !== undefined && eventData.onum !== null) {
                glyphId = (GLYPH_OFFSETS?.GLYPH_OBJ_OFF ?? 3448) + eventData.onum;
            }
        } else if (eventData.category === 'rumor') {
            icon = '📜';
            const isTrue = Boolean(eventData.isTrue);
            title = isEn ? `📜 Rumor Recorded (${isTrue ? 'True' : 'False'})` : `📜 噂を記録 (${isTrue ? '真実' : '偽り'})`;
            detail = isEn ? (eventData.text || '') : (eventData.textJa || eventData.text || '');
            if (detail.length > 45) detail = detail.substring(0, 42) + '...';
        } else if (eventData.category === 'oracle') {
            icon = '🏛️';
            title = isEn ? '🏛️ Oracle Prophecies Recorded' : '🏛️ オラクルの神託を記録';
            if (eventData.isBulk) {
                detail = isEn ? `Revealed ${eventData.count || 20} prophecies!` : `ダンジョンの大予言（全${eventData.count || 20}篇）を記録しました！`;
            } else {
                detail = isEn ? (eventData.title || eventData.text || '') : (eventData.textJa || eventData.titleJa || eventData.title || eventData.text || '');
                if (detail.length > 45) detail = detail.substring(0, 42) + '...';
            }
        }

        this._createToast(icon, title, detail, eventData, glyphId);
    }

    _createToast(icon, title, detail, rawData, glyphId = -1) {
        if (!this.toastWrapper) return;

        const toast = document.createElement('div');
        toast.className = 'adventure-log-toast';
        toast.style.pointerEvents = 'auto';
        toast.style.cursor = 'pointer';
        toast.style.background = 'rgba(15, 23, 42, 0.95)';
        toast.style.backdropFilter = 'blur(12px)';
        toast.style.border = '1px solid rgba(56, 189, 248, 0.6)';
        toast.style.borderRadius = '10px';
        toast.style.padding = '8px 16px';
        toast.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.65), 0 0 16px rgba(56, 189, 248, 0.3)';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '12px';
        toast.style.minWidth = '280px';
        toast.style.maxWidth = '420px';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-16px) scale(0.95)';
        toast.style.transition = 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)';

        // タイル画像の解決
        let iconHtml = `<div style="font-size: 1.5rem; line-height: 1; flex-shrink: 0;">${icon}</div>`;
        if (glyphId >= 0) {
            const styleObj = GlyphHelper.getGlyphStyle(glyphId, {
                tileImage: this.tileImage,
                tileSize: 32,
                displaySize: 32
            });
            if (styleObj) {
                const styleStr = Object.entries(styleObj)
                    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
                    .join(';');
                iconHtml = `<span style="${styleStr}; border-radius: 4px; flex-shrink: 0; background-color: rgba(30,41,59,0.5);"></span>`;
            }
        }

        toast.innerHTML = `
            ${iconHtml}
            <div style="flex: 1; overflow: hidden;">
                <div style="font-size: 0.72rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">${title}</div>
                <div style="font-size: 0.9rem; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${detail}</div>
            </div>
            <div style="font-size: 0.75rem; color: #94a3b8; margin-left: 6px; flex-shrink: 0;" title="手帳を見る">📖</div>
        `;

        // クリックで手帳を開くなどの連携
        toast.addEventListener('click', () => {
            if (typeof this.onToastClick === 'function') {
                this.onToastClick(rawData);
            }
            this._dismissToast(toast);
        });

        // 既存トーストが最大数以上ある場合は、古いものを即時除去して表示上限を維持
        const activeToasts = Array.from(this.toastWrapper.children).filter(el => !el.dataset.dismissing);
        if (activeToasts.length >= this.maxVisible) {
            const countToRemove = activeToasts.length - this.maxVisible + 1;
            for (let i = 0; i < countToRemove; i++) {
                const oldToast = activeToasts[i];
                oldToast.dataset.dismissing = 'true';
                this._dismissToast(oldToast, true);
            }
        }

        this.toastWrapper.appendChild(toast);

        // 表示アニメーション（次フレーム）
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0) scale(1)';
            });
        } else {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0) scale(1)';
        }

        // 自動フェードアウト
        setTimeout(() => {
            this._dismissToast(toast, false);
        }, this.displayDurationMs);
    }

    _dismissToast(toast, immediate = false) {
        if (!toast || !toast.parentNode) return;
        toast.dataset.dismissing = 'true';
        if (immediate) {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            return;
        }
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px) scale(0.95)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 250);
    }
}
