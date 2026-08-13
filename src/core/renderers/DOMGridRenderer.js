/**
 * DOMGridRenderer.js - WebUICore モバイル DOM グリッド描画アダプター
 *
 * 80x21 の DOM <span class="map-cell"> グリッドによる全表示・レスポンシブ DOM UI 用 IRenderer 実装。
 * MobileDomClient.js の描画仕様を上位カプセル化。
 */

export class DOMGridRenderer {
    /**
     * @param {Object} [options]
     * @param {string} [options.mapContainerId='map-viewport']
     * @param {string} [options.messageLogId='message-log']
     * @param {string} [options.statusBarId='status-bar']
     * @param {boolean} [options.useTiles=true]
     * @param {string} [options.tileImage='pict/nethack_default_32.png']
     * @param {number} [options.tileSize=16]
     */
    constructor(options = {}) {
        this.options = Object.assign({
            mapContainerId: 'map-viewport',
            messageLogId: 'message-log',
            statusBarId: 'status-bar',
            useTiles: true,
            tileImage: 'pict/nethack_default_32.png',
            tileSize: 16
        }, options);

        this.mapWidth = 80;
        this.mapHeight = 21;
        this.cells = [];
        const fn = getTileMappingFunction();
        this.tileMap = fn ? fn() : null;
    }

    init() {
        if (typeof document === 'undefined') return;

        this.mapContainer = document.getElementById(this.options.mapContainerId);
        this.messageLog = document.getElementById(this.options.messageLogId);
        this.statusBar = document.getElementById(this.options.statusBarId);

        if (!this.mapContainer) return;

        this.mapContainer.innerHTML = '';
        this.cells = [];

        const gridFrag = document.createDocumentFragment();
        for (let y = 0; y < this.mapHeight; y++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'map-row';
            const rowCells = [];

            for (let x = 0; x < this.mapWidth; x++) {
                const cellSpan = document.createElement('span');
                cellSpan.className = 'map-cell';
                cellSpan.dataset.x = x;
                cellSpan.dataset.y = y;
                cellSpan.textContent = ' ';
                rowDiv.appendChild(cellSpan);

                rowCells.push({
                    el: cellSpan,
                    ch: ' ',
                    color: 7,
                    glyph: -1
                });
            }
            gridFrag.appendChild(rowDiv);
            this.cells.push(rowCells);
        }
        this.mapContainer.appendChild(gridFrag);
    }

    clearMap() {
        if (!this.cells.length) return;
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const cell = this.cells[y][x];
                cell.ch = ' ';
                cell.color = 7;
                cell.glyph = -1;
                cell.el.textContent = ' ';
                cell.el.style.backgroundImage = '';
                cell.el.className = 'map-cell';
            }
        }
    }

    drawGlyph(x, y, glyphInfo) {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return;
        const cell = this.cells[y]?.[x];
        if (!cell) return;

        cell.ch = glyphInfo.ch || ' ';
        cell.color = glyphInfo.color !== undefined ? glyphInfo.color : 7;
        cell.glyph = glyphInfo.glyph !== undefined ? glyphInfo.glyph : -1;

        const ts = this.options.tileSize;

        if (this.options.useTiles && cell.glyph >= 0 && this.tileMap) {
            const tileIdx = this.tileMap[cell.glyph];
            if (tileIdx !== undefined) {
                const colsInImg = 40;
                const sx = (tileIdx % colsInImg) * ts;
                const sy = Math.floor(tileIdx / colsInImg) * ts;

                cell.el.textContent = '';
                cell.el.className = 'map-cell tile-cell';
                cell.el.style.backgroundImage = `url(${this.options.tileImage})`;
                cell.el.style.backgroundPosition = `-${sx}px -${sy}px`;
                cell.el.style.width = `${ts}px`;
                cell.el.style.height = `${ts}px`;
                return;
            }
        }

        cell.el.style.backgroundImage = '';
        cell.el.className = `map-cell color-${cell.color}`;
        cell.el.textContent = cell.ch;
    }

    updateStatus(statusFields) {
        if (!this.statusBar) return;
        if (statusFields.0) {
            this.statusBar.textContent = `${statusFields.0} HP:${statusFields.18 || ''} Gold:${statusFields.10 || 0}`;
        }
    }

    appendMessage(text) {
        if (!this.messageLog) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message-line';
        msgDiv.textContent = text;
        this.messageLog.appendChild(msgDiv);
        this.messageLog.scrollTop = this.messageLog.scrollHeight;
    }

    showPrompt(promptInfo) {}
    hidePrompt() {}
    showMenu(items) {}
    showTextModal(text) {}
}
