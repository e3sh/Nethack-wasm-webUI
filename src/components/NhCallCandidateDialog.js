/**
 * NhCallCandidateDialog.js
 *
 * 命名アシスト＆GamePad候補選択ダイアログ Web Component (<nh-call-candidate-dialog>)
 * (ROADMAP §2.1 / Gap 2 対応)
 *
 * 【設計思想】
 * 1. modal_interaction_and_navigation_guide.ja.md (1次元縦リスト型) に完全準拠。
 * 2. キーボード (ArrowUp/Down, j/k, Enter, ESC) および ゲームパッド (D-Pad, A/Bボタン)
 *    によるマウスレス100%完全操作。
 * 3. クイックショートハンド (100G?, identify? 等)・真名候補リスト・命名解除(クリア)・自由テキスト入力の統合。
 * 4. ダークガラス Dark Glass UI スタイル統一。
 */

import { NhBaseElement } from './NhBaseElement.js';

const DIALOG_CSS = `
:host {
  display: contents;
}

:host(:not([open])) .dialog-overlay {
  display: none !important;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(4, 7, 13, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11000;
  padding: 16px;
  box-sizing: border-box;
}

.dialog-card {
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(56, 189, 248, 0.35);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
  border-radius: 12px;
  width: 100%;
  max-width: 540px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e2e8f0;
  font-family: var(--nh-font-mono, "Consolas", "Courier New", monospace);
  animation: dialogPop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dialogPop {
  0% {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(22, 33, 62, 0.45);
}

.dialog-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #38bdf8;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.dialog-close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.dialog-close-btn:hover {
  color: #f87171;
  background: rgba(239, 68, 68, 0.2);
}

.dialog-body {
  padding: 14px 18px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 対象アイテム情報 */
.target-info-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  padding: 8px 12px;
}

.target-info-name {
  font-weight: bold;
  font-size: 0.95rem;
  color: #f8fafc;
}

.target-info-meta {
  font-size: 0.8rem;
  color: #94a3b8;
}

/* クイックショートハンドピル */
.shorthand-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shorthand-label {
  font-size: 0.75rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.shorthand-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.shorthand-chip {
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.shorthand-chip:hover,
.shorthand-chip.is-focused {
  background: rgba(56, 189, 248, 0.25);
  border-color: #38bdf8;
  transform: translateY(-1px);
}

/* 自由テキスト入力 */
.custom-input-box {
  display: flex;
  gap: 8px;
}

.custom-input {
  flex: 1;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  color: #f8fafc;
  font-family: inherit;
  font-size: 0.9rem;
  outline: none;
}

.custom-input:focus,
.custom-input.is-focused {
  border-color: #38bdf8;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
}

.custom-submit-btn {
  background: #0284c7;
  border: 1px solid #38bdf8;
  color: #fff;
  border-radius: 6px;
  padding: 8px 14px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.85rem;
}

.custom-submit-btn:hover {
  background: #0369a1;
}

/* 候補リスト */
.candidates-list-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.candidate-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.12s ease;
  user-select: none;
}

.candidate-item:hover,
.candidate-item.is-focused {
  background: rgba(56, 189, 248, 0.18);
  border-color: #38bdf8;
  outline: none;
}

.candidate-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.candidate-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #f8fafc;
}

.candidate-sub {
  font-size: 0.78rem;
  color: #94a3b8;
}

.candidate-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.candidate-cost-badge {
  font-size: 0.75rem;
  background: rgba(234, 179, 8, 0.15);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
}

.candidate-clear-item {
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

.candidate-clear-item:hover,
.candidate-clear-item.is-focused {
  background: rgba(239, 68, 68, 0.25);
  border-color: #f87171;
}

.candidate-badges {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}

.candidate-badge {
  font-size: 0.68rem;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-align-lawful { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
.badge-align-neutral { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.4); }
.badge-align-chaotic { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.4); }
.badge-role { background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); }
.badge-quest { background: rgba(234, 179, 8, 0.2); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.4); }
.badge-rec { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.4); font-weight: bold; }
.candidate-effect { font-size: 0.72rem; color: #94a3b8; margin-top: 3px; }


/* フッター / ガイドバー */
.dialog-footer {
  padding: 8px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.9);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #94a3b8;
}

.guide-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.guide-pill kbd {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 0.7rem;
  color: #f8fafc;
}
`;

const CALL_DIALOG_I18N = {
  ja: {
    titleCall: '🏷️ 命名アシスト (Call Item)',
    titleArtifact: '🗡️ 個別命名 / アーティファクト銘 (Name Item)',
    fallbackArtifactTarget: 'ベースアイテム',
    fallbackCallTarget: '未識別アイテム',
    currentArtifactName: '現在の銘:',
    currentCallName: '現在の仮名:',
    quickCandidates: 'クイック候補 (One-tap)',
    clearArtifactTitle: '❌ 個別銘を解除 (クリア)',
    clearArtifactSub: '名前を消去して通常のベースアイテムに戻す',
    clearCallTitle: '❌ 命名を解除 (クリア)',
    clearCallSub: '名前を消去して未命名に戻す',
    placeholderArtifact: '愛称・銘を入力 (Enterで決定)...',
    placeholderCall: '自由に入力 (Enterで決定)...',
    submitBtn: '決定',
    badgeRec: '推奨',
    guideSelect: '選択',
    guideSubmit: '決定',
    guideBack: '戻る'
  },
  en: {
    titleCall: '🏷️ Call Item Assistant',
    titleArtifact: '🗡️ Name Item / Artifact Inscription',
    fallbackArtifactTarget: 'Base Item',
    fallbackCallTarget: 'Unidentified Item',
    currentArtifactName: 'Current Name:',
    currentCallName: 'Current Call:',
    quickCandidates: 'Quick Presets (One-tap)',
    clearArtifactTitle: '❌ Clear Inscription (Reset)',
    clearArtifactSub: 'Clear custom name and revert to base item',
    clearCallTitle: '❌ Clear Name (Reset)',
    clearCallSub: 'Clear called name and revert to unnamed',
    placeholderArtifact: 'Enter custom name/inscription (Enter to submit)...',
    placeholderCall: 'Enter custom name (Enter to submit)...',
    submitBtn: 'Submit',
    badgeRec: 'REC',
    guideSelect: 'Select',
    guideSubmit: 'Submit',
    guideBack: 'Back'
  }
};

export class NhCallCandidateDialog extends NhBaseElement {
    static get observedAttributes() {
        return ['open', 'target-name', 'target-category', 'current-call', 'mode', 'lang'];
    }

    constructor() {
        super({ customCss: DIALOG_CSS });

        this._candidates = [];
        this._shorthands = [];
        this._focusedIndex = 0;
        this._navItems = []; // 選択可能なアイテム（クリア + 候補 + 自由入力）
        this._currentLanguage = 'ja';

        this._boundKeyDown = this._handleKeyDown.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this._boundKeyDown, true);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this._boundKeyDown, true);
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        if (name === 'lang') {
            this._currentLanguage = newValue === 'en' ? 'en' : 'ja';
        }
        this.render();
    }

    get open() {
        return this.hasAttribute('open');
    }

    set open(val) {
        if (Boolean(val)) {
            this.setAttribute('open', '');
            this._focusedIndex = 0;
            this.render();
        } else {
            this.removeAttribute('open');
        }
    }

    get mode() {
        return this.getAttribute('mode') || 'call';
    }

    set mode(val) {
        this.setAttribute('mode', val || 'call');
    }

    get targetName() {
        return this.getAttribute('target-name') || '';
    }

    set targetName(val) {
        this.setAttribute('target-name', val || '');
    }

    get targetCategory() {
        return this.getAttribute('target-category') || '';
    }

    set targetCategory(val) {
        this.setAttribute('target-category', val || '');
    }

    get currentCall() {
        return this.getAttribute('current-call') || '';
    }

    set currentCall(val) {
        this.setAttribute('current-call', val || '');
    }

    get currentLanguage() {
        return this._currentLanguage || (this.getAttribute('lang') === 'en' ? 'en' : 'ja');
    }

    set currentLanguage(val) {
        const lang = val === 'en' ? 'en' : 'ja';
        this._currentLanguage = lang;
        if (this.getAttribute('lang') !== lang) {
            this.setAttribute('lang', lang);
        }
        this.render();
    }

    get language() {
        return this.currentLanguage;
    }

    set language(val) {
        this.currentLanguage = val;
    }

    setLanguage(lang) {
        this.currentLanguage = lang;
    }

    /**
     * 候補データのセット
     * @param {Object} data 
     * @param {Array<Object>} [data.candidates]
     * @param {Array<string>} [data.shorthands]
     * @param {string} [data.targetName]
     * @param {string} [data.targetCategory]
     * @param {string} [data.currentCall]
     * @param {string} [data.mode]
     * @param {string} [data.language]
     * @param {string} [data.currentLanguage]
     */
    setData(data = {}) {
        if (data.candidates) this._candidates = data.candidates;
        if (data.shorthands) this._shorthands = data.shorthands;
        if (data.targetName) this.targetName = data.targetName;
        if (data.targetCategory) this.targetCategory = data.targetCategory;
        if (data.currentCall !== undefined) this.currentCall = data.currentCall;
        if (data.mode) this.mode = data.mode;
        if (data.language || data.currentLanguage) {
            this.currentLanguage = data.language || data.currentLanguage;
        }

        this._focusedIndex = 0;
        this.render();
    }

    /**
     * 候補リストの取得
     * @returns {Array<Object>}
     */
    getCandidates() {
        return this._candidates;
    }

    /**
     * ダイアログを開く
     * @param {Object} [data]
     */
    show(data) {
        if (data) {
            this.setData(data);
        }
        this.open = true;
    }

    /**
     * ダイアログを閉じる
     */
    close() {
        this.open = false;
        this.emit('nh-call-cancel', {});
    }

    /**
     * 決定処理の発火
     * @param {string} name 
     * @param {Object} [item]
     */
    submit(name, item = null) {
        this.open = false;
        this.emit('nh-call-submit', {
            name: name || '',
            onum: item ? (item.baseOnum || item.onum) : null,
            item,
            mode: this.mode
        });
    }

    /**
     * キーボードイベント処理 (modal_interaction_and_navigation_guide.ja.md 準拠)
     * @param {KeyboardEvent} e 
     */
    _handleKeyDown(e) {
        if (!this.open) return;

        const isInputFocused = this._isCustomInputFocused();

        // 自由テキスト入力欄にフォーカスがある場合
        if (isInputFocused) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.close();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this._submitCustomInput();
                return;
            }
            // ArrowUp/Down でリストに戻れるようにする
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this._blurCustomInput();
                this._moveFocus(-1);
                return;
            }
            return; // その他のキーは通常文字入力に通す
        }

        // リスト選択モード時
        if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') {
            e.preventDefault();
            e.stopPropagation();
            this.close();
            return;
        }

        if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
            e.preventDefault();
            this._moveFocus(1);
            return;
        }

        if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
            e.preventDefault();
            this._moveFocus(-1);
            return;
        }

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            this._activateCurrentFocus();
            return;
        }
    }

    /**
     * ゲームパッド入力のハンドリング
     * @param {string} button - 'UP' | 'DOWN' | 'A' | 'B' | 'X' | 'Y'
     */
    handleGamepadButton(button) {
        if (!this.open) return false;

        switch (button) {
            case 'UP':
            case 'DPAD_UP':
                this._moveFocus(-1);
                return true;
            case 'DOWN':
            case 'DPAD_DOWN':
                this._moveFocus(1);
                return true;
            case 'A':
            case 'BTN_A':
                this._activateCurrentFocus();
                return true;
            case 'B':
            case 'BTN_B':
                this.close();
                return true;
            case 'X':
            case 'BTN_X':
                // クイッククリア
                this.submit('');
                return true;
            case 'Y':
            case 'BTN_Y':
                // 先頭ショートハンド適用
                if (this._shorthands.length > 0) {
                    this.submit(this._shorthands[0]);
                    return true;
                }
                return false;
            default:
                return false;
        }
    }

    _moveFocus(delta) {
        if (this._navItems.length === 0) return;
        this._focusedIndex = (this._focusedIndex + delta + this._navItems.length) % this._navItems.length;
        this._updateFocusVisual();
    }

    _updateFocusVisual() {
        const root = this.shadowRoot;
        if (!root) return;

        const items = root.querySelectorAll('.candidate-item, .shorthand-chip, .custom-input');
        items.forEach((el) => {
            const idx = parseInt(el.getAttribute('data-idx'), 10);
            if (idx === this._focusedIndex) {
                el.classList.add('is-focused');
                if (typeof el.scrollIntoView === 'function') {
                    el.scrollIntoView({ block: 'nearest' });
                }
            } else {
                el.classList.remove('is-focused');
            }
        });
    }

    _activateCurrentFocus() {
        if (this._focusedIndex < 0 || this._focusedIndex >= this._navItems.length) return;
        const current = this._navItems[this._focusedIndex];
        if (!current) return;

        if (current.type === 'clear') {
            this.submit('');
        } else if (current.type === 'shorthand') {
            this.submit(current.value);
        } else if (current.type === 'candidate') {
            // 候補リストから選択した場合は真名を送信
            const name = current.item.name || current.item.shorthand;
            this.submit(name, current.item);
        } else if (current.type === 'input') {
            this._focusCustomInput();
        }
    }

    _isCustomInputFocused() {
        const root = this.shadowRoot;
        if (!root) return false;
        const input = root.querySelector('.custom-input');
        return Boolean(input && document.activeElement === input);
    }

    _focusCustomInput() {
        const root = this.shadowRoot;
        if (!root) return;
        const input = root.querySelector('.custom-input');
        if (input && typeof input.focus === 'function') {
            input.focus();
        }
    }

    _blurCustomInput() {
        const root = this.shadowRoot;
        if (!root) return;
        const input = root.querySelector('.custom-input');
        if (input && typeof input.blur === 'function') {
            input.blur();
        }
    }

    _submitCustomInput() {
        const root = this.shadowRoot;
        if (!root) return;
        const input = root.querySelector('.custom-input');
        const val = input ? input.value : '';
        this.submit(val);
    }

    render() {
        const root = this.shadowRoot;
        if (!root) return;

        if (!this.open) {
            root.innerHTML = `<div class="dialog-overlay"></div>`;
            return;
        }

        const isEn = this.currentLanguage === 'en';
        const t = isEn ? CALL_DIALOG_I18N.en : CALL_DIALOG_I18N.ja;

        // ナビゲーション対象項目の再構築
        this._navItems = [];

        // 1. ショートハンドチップス
        const shorthandHtml = this._shorthands.map((s, idx) => {
            const itemIdx = this._navItems.length;
            this._navItems.push({ type: 'shorthand', value: s, index: itemIdx });
            return `
                <button type="button" class="shorthand-chip ${itemIdx === this._focusedIndex ? 'is-focused' : ''}" data-idx="${itemIdx}" data-val="${s}">
                    ${s}
                </button>
            `;
        }).join('');

        // 2. クリア項目
        const clearIdx = this._navItems.length;
        this._navItems.push({ type: 'clear', value: '', index: clearIdx });

        const isArtifactMode = this.mode === 'artifact_name';

        // 3. 候補リスト
        const candidateItemsHtml = this._candidates.map((cand) => {
            const itemIdx = this._navItems.length;
            this._navItems.push({ type: 'candidate', item: cand, index: itemIdx });

            let rightBadgesHtml = '';
            if (isArtifactMode) {
                const badges = [];
                if (cand.isRecommended) {
                    badges.push(`<span class="candidate-badge badge-rec">${t.badgeRec}</span>`);
                }
                if (cand.alignment) {
                    badges.push(`<span class="candidate-badge badge-align-${cand.alignment.toLowerCase()}">${cand.alignment}</span>`);
                }
                if (cand.role) {
                    badges.push(`<span class="candidate-badge badge-role">${cand.role}</span>`);
                }
                if (cand.isQuestArtifact) {
                    badges.push('<span class="candidate-badge badge-quest">QUEST</span>');
                }
                rightBadgesHtml = `<div class="candidate-badges">${badges.join('')}</div>`;
            } else {
                const costBadge = cand.cost > 0 ? `<span class="candidate-cost-badge">${cand.cost} ZM</span>` : '';
                rightBadgesHtml = costBadge;
            }

            const effectStr = isArtifactMode
                ? (isEn ? (cand.descEn || cand.attackEffect || cand.defenseEffect || '') : (cand.descJa || cand.attackEffect || cand.defenseEffect || ''))
                : '';

            return `
                <div class="candidate-item ${itemIdx === this._focusedIndex ? 'is-focused' : ''}" data-idx="${itemIdx}">
                    <div class="candidate-left">
                        <div>
                            <span class="candidate-name">${cand.name}</span>
                            ${(!isEn && cand.nameJa) ? `<span class="candidate-sub"> (${cand.nameJa})</span>` : ''}
                        </div>
                        ${effectStr ? `<div class="candidate-effect">${effectStr}</div>` : ''}
                    </div>
                    <div class="candidate-right">
                        ${rightBadgesHtml}
                    </div>
                </div>
            `;
        }).join('');

        // 4. 自由テキスト入力欄
        const inputIdx = this._navItems.length;
        this._navItems.push({ type: 'input', index: inputIdx });

        const titleText = isArtifactMode ? t.titleArtifact : t.titleCall;
        const callLabel = isArtifactMode ? t.currentArtifactName : t.currentCallName;
        const placeholderText = isArtifactMode ? t.placeholderArtifact : t.placeholderCall;
        const clearTitle = isArtifactMode ? t.clearArtifactTitle : t.clearCallTitle;
        const clearSub = isArtifactMode ? t.clearArtifactSub : t.clearCallSub;
        const fallbackTargetName = isArtifactMode ? t.fallbackArtifactTarget : t.fallbackCallTarget;

        root.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
                    <div class="dialog-header">
                        <h3 id="dialog-title" class="dialog-title">
                            ${titleText}
                        </h3>
                        <button type="button" class="dialog-close-btn" aria-label="Close">✕</button>
                    </div>

                    <div class="dialog-body">
                        <!-- 対象アイテム情報 -->
                        <div class="target-info-bar">
                            <div>
                                <span class="target-info-name">${this.targetName || fallbackTargetName}</span>
                                ${this.targetCategory ? `<span class="target-info-meta">(${this.targetCategory})</span>` : ''}
                            </div>
                            ${this.currentCall ? `<span class="target-info-meta">${callLabel} <strong>${this.currentCall}</strong></span>` : ''}
                        </div>

                        <!-- ショートハンド -->
                        ${this._shorthands.length > 0 ? `
                        <div class="shorthand-section">
                            <span class="shorthand-label">${t.quickCandidates}</span>
                            <div class="shorthand-chips">
                                ${shorthandHtml}
                            </div>
                        </div>
                        ` : ''}

                        <!-- 候補リスト -->
                        <div class="candidates-list-section">
                            <div class="candidate-item candidate-clear-item ${clearIdx === this._focusedIndex ? 'is-focused' : ''}" data-idx="${clearIdx}">
                                <div class="candidate-left">
                                    <span class="candidate-name">${clearTitle}</span>
                                    <span class="candidate-sub">${clearSub}</span>
                                </div>
                            </div>
                            ${candidateItemsHtml}
                        </div>

                        <!-- 自由テキスト入力 -->
                        <div class="custom-input-box">
                            <input type="text" class="custom-input ${inputIdx === this._focusedIndex ? 'is-focused' : ''}" 
                                   data-idx="${inputIdx}"
                                   placeholder="${placeholderText}" 
                                   value="${this.currentCall || ''}" />
                            <button type="button" class="custom-submit-btn">${t.submitBtn}</button>
                        </div>
                    </div>

                    <!-- フッター ガイドバー -->
                    <div class="dialog-footer">
                        <div class="guide-pill">
                            <kbd>↑↓</kbd> / <kbd>j k</kbd> / <kbd>D-Pad</kbd> ${t.guideSelect}
                        </div>
                        <div class="guide-pill">
                            <kbd>Enter</kbd> / <kbd>A</kbd> ${t.guideSubmit}
                        </div>
                        <div class="guide-pill">
                            <kbd>ESC</kbd> / <kbd>B</kbd> ${t.guideBack}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this._bindEvents();
    }

    _bindEvents() {
        const root = this.shadowRoot;
        if (!root) return;

        // 閉じるボタン
        const closeBtn = root.querySelector('.dialog-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // オーバーレイクリックで閉じる
        const overlay = root.querySelector('.dialog-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.close();
            });
        }

        // ショートハンドチップクリック
        const chips = root.querySelectorAll('.shorthand-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const val = chip.getAttribute('data-val');
                if (val) this.submit(val);
            });
            chip.addEventListener('mouseenter', () => {
                if (this._isCustomInputFocused()) {
                    this._blurCustomInput();
                }
                const idx = parseInt(chip.getAttribute('data-idx') || '0', 10);
                this._focusedIndex = idx;
                this._updateFocusVisual();
            });
        });

        // 候補アイテムクリック
        const items = root.querySelectorAll('.candidate-item');
        items.forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
                this._focusedIndex = idx;
                this._activateCurrentFocus();
            });
            el.addEventListener('mouseenter', () => {
                if (this._isCustomInputFocused()) {
                    this._blurCustomInput();
                }
                const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
                this._focusedIndex = idx;
                this._updateFocusVisual();
            });
        });

        // 自由テキスト入力欄
        const customInput = root.querySelector('.custom-input');
        if (customInput) {
            const syncInputFocus = () => {
                const idx = parseInt(customInput.getAttribute('data-idx') || '0', 10);
                this._focusedIndex = idx;
                this._updateFocusVisual();
            };
            customInput.addEventListener('focus', syncInputFocus);
            customInput.addEventListener('mouseenter', syncInputFocus);
        }

        // 自由テキスト入力決定ボタン
        const submitBtn = root.querySelector('.custom-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this._submitCustomInput());
        }
    }
}

if (typeof customElements !== 'undefined' && !customElements.get('nh-call-candidate-dialog')) {
    customElements.define('nh-call-candidate-dialog', NhCallCandidateDialog);
}
