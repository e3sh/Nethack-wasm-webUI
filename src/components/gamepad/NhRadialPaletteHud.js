/**
 * NhRadialPaletteHud.js
 * 
 * <nh-radial-hud> Web Component
 * アナログスティックの入力状態と連動し、8方向リングコマンド（ラジアルパレット）を
 * 画面中央またはプレイヤー周辺にオンデマンドで美しく描画する Neo-Retro Glass HUD。
 */

import { NhBaseElement } from '../NhBaseElement.js';
import { RADIAL_SECTORS, RADIAL_PALETTE_DEFAULT } from '../../core/input/index.js';

const RADIAL_CSS = `
:host {
  display: block;
  pointer-events: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  width: 320px;
  height: 320px;
  transition: opacity 0.15s cubic-bezier(0.2, 0, 0, 1), transform 0.15s cubic-bezier(0.2, 0, 0, 1);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.85);
}

:host([active]) {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.radial-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 中央のデッドゾーン・インジケーター (デフォルトは非表示、debug 属性時のみ表示) */
.center-reticle {
  display: none;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.75);
  border: 2px dashed rgba(56, 189, 248, 0.4);
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  position: relative;
}

:host([debug]) .center-reticle {
  display: flex;
}


.stick-pointer {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
  position: absolute;
  transform: translate(0, 0);
  transition: transform 0.05s linear;
}

/* 8方向スロット */
.sector-slot {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #f1f5f9;
  font-family: var(--nh-font-mono, monospace);
  min-width: 64px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
  user-select: none;
}

.sector-slot .icon {
  font-size: 1.25rem;
  line-height: 1;
  margin-bottom: 2px;
}

.sector-slot .label {
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.sector-slot .hint {
  font-size: 0.65rem;
  color: #94a3b8;
  margin-top: 1px;
}

/* ハイライト・アクティブ状態 */
.sector-slot.active {
  transform: scale(1.22);
  background: rgba(14, 165, 233, 0.9);
  border-color: #38bdf8;
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.6);
  color: #ffffff;
  z-index: 10;
}

.sector-slot.active .hint {
  color: #e0f2fe;
}

/* 8方向配置 (半径 110px) */
/* N  : (0, -110) */
.sector-N  { top: 12px; left: 50%; transform: translateX(-50%); }
.sector-N.active  { transform: translateX(-50%) scale(1.22); }

/* NE : (78, -78) */
.sector-NE { top: 32px; right: 20px; }

/* E  : (110, 0) */
.sector-E  { top: 50%; right: 4px; transform: translateY(-50%); }
.sector-E.active  { transform: translateY(-50%) scale(1.22); }

/* SE : (78, 78) */
.sector-SE { bottom: 32px; right: 20px; }

/* S  : (0, 110) */
.sector-S  { bottom: 12px; left: 50%; transform: translateX(-50%); }
.sector-S.active  { transform: translateX(-50%) scale(1.22); }

/* SW : (-78, 78) */
.sector-SW { bottom: 32px; left: 20px; }

/* W  : (-110, 0) */
.sector-W  { top: 50%; left: 4px; transform: translateY(-50%); }
.sector-W.active  { transform: translateY(-50%) scale(1.22); }

/* NW : (-78, -78) */
.sector-NW { top: 32px; left: 20px; }
`;

export class NhRadialPaletteHud extends NhBaseElement {
    constructor() {
        super();
        this.palette = Object.assign({}, RADIAL_PALETTE_DEFAULT);
        this._currentSector = null;
        this._isActive = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._render();
    }

    /**
     * ラジアル状態の更新反映
     * @param {{ state: string, currentSector: string|null, radius: number, angleDeg: number }} radialData 
     */
    updateState(radialData) {
        if (!radialData) return;

        const hasAnyAction = Object.values(this.palette).some(item => item && (item.isContextAction || item.action || item.key));
        const isEngaged = radialData.state === 'ENGAGED' && hasAnyAction;
        if (isEngaged !== this._isActive) {
            this._isActive = isEngaged;
            if (isEngaged) {
                this.setAttribute('active', '');
            } else {
                this.removeAttribute('active');
            }
        }

        // スティックポインタの移動 (半径 20px 範囲)
        const pointer = this.shadowRoot?.querySelector('.stick-pointer');
        if (pointer) {
            const rad = (radialData.angleDeg ?? 0) * (Math.PI / 180);
            const dist = Math.min(radialData.radius ?? 0, 1) * 20;
            const px = Math.cos(rad) * dist;
            const py = Math.sin(rad) * dist;
            pointer.style.transform = `translate(${px}px, ${py}px)`;
        }

        // ハイライトセクターの切り替え
        if (radialData.currentSector !== this._currentSector) {
            this._currentSector = radialData.currentSector;
            const slots = this.shadowRoot?.querySelectorAll('.sector-slot') || [];
            slots.forEach(slot => {
                const sector = slot.getAttribute('data-sector');
                if (sector === this._currentSector) {
                    slot.classList.add('active');
                } else {
                    slot.classList.remove('active');
                }
            });
        }
    }

    /**
     * update メソッド (updateState のエイリアス)
     * @param {Object} radialData 
     */
    update(radialData) {
        this.updateState(radialData);
    }

    /**
     * パレット定義の動的更新
     * @param {Object} newPalette 
     */
    setPalette(newPalette) {
        if (!newPalette || typeof newPalette !== 'object') return;
        this.palette = Object.assign({}, newPalette);
        this._render();
    }


    _render() {
        if (!this.shadowRoot) return;

        const sectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const slotsHtml = sectors.map(sec => {
            const item = this.palette[sec];
            if (!item) return '';
            return `
                <div class="sector-slot sector-${sec}" data-sector="${sec}">
                    <span class="icon">${item.icon || '•'}</span>
                    <span class="label">${item.label || sec}</span>
                    <span class="hint">${item.hint || ''}</span>
                </div>
            `;
        }).filter(Boolean).join('');

        this.shadowRoot.innerHTML = `
            <style>${RADIAL_CSS}</style>
            <div class="radial-container">
                ${slotsHtml}
                <div class="center-reticle">
                    <div class="stick-pointer"></div>
                </div>
            </div>
        `;
    }
}

export { NhRadialPaletteHud as RadialPaletteHud };

if (typeof customElements !== 'undefined' && !customElements.get('nh-radial-hud')) {
    customElements.define('nh-radial-hud', NhRadialPaletteHud);
}

