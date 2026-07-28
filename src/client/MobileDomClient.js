/**
 * MobileDomClient.js
 * 
 * NetHackWasmDriver のドメインイベントと直接接続する、
 * デスクトップ表示プロトタイプ Client (mobileCurses.js の 100% 正確なタイル描画仕様準拠)。
 */

class MobileDomClient {
    /**
     * @param {NetHackWasmDriver} driver - NetHackWasmDriver インスタンス
     * @param {Object} [options]
     */
    constructor(driver, options = {}) {
        this.driver = driver;
        this.options = Object.assign({
            mapContainerId: 'map-viewport',
            messageLogId: 'message-log',
            statusBarId: 'status-bar',
            dialogOverlayId: 'dialog-overlay',
            useTiles: true,
            tileImage: 'pict/nethack_default_32.png',
            tileSize: 16 // デスクトップ全表示用 16px スケール
        }, options);

        this.mapWidth = 80;
        this.mapHeight = 21;
        this.cells = [];
        this.cursor = { x: 0, y: 0 };
        this.activeResolver = null;
        this.statusData = {};
        this.messageHistory = [];
        this.windows = {};

        // mobileCurses.js と同じ 1:1 タイルマッピング表の取得
        this.tileMap = typeof tileMapping === 'function' ? tileMapping() : null;

        this.initDOM();
        this.bindDriverEvents();
        this.bindInputEvents();
    }

    /**
     * DOM 要素の初期化および 80x21 マップグリッドの作成
     */
    initDOM() {
        this.mapContainer = document.getElementById(this.options.mapContainerId);
        this.messageLog = document.getElementById(this.options.messageLogId);
        this.statusBar = document.getElementById(this.options.statusBarId);
        this.dialogOverlay = document.getElementById(this.options.dialogOverlayId);

        if (!this.mapContainer) {
            console.error(`MobileDomClient: #${this.options.mapContainerId} not found.`);
            return;
        }

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

    /**
     * タイル表示 (Tiles) / アスキー表示 (ASCII) の切り替え
     */
    setTileMode(useTiles) {
        this.options.useTiles = useTiles;
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const cell = this.cells[y][x];
                if (cell && cell.glyph >= 0) {
                    const g = cell.glyph;
                    cell.glyph = -1;
                    this.renderGlyph(x, y, { glyph: g, ch: cell.ch, color: cell.color });
                }
            }
        }
    }

    /**
     * NetHackWasmDriver イベントのバインド
     */
    bindDriverEvents() {
        if (!this.driver) return;

        this.driver.on('create_nhwindow', ({ type }) => {
            this.windows[type] = { type, lines: [], title: "", visible: false };
        });

        this.driver.on('clear_nhwindow', ({ windowId }) => {
            if (this.windows[windowId]) {
                this.windows[windowId].lines = [];
            }
            if (windowId === 3 || windowId === 0) {
                this.clearMap();
            }
        });

        this.driver.on('destroy_nhwindow', ({ windowId }) => {
            delete this.windows[windowId];
        });

        this.driver.on('display_nhwindow', ({ windowId, blocking, resolver }) => {
            this.handleDisplayNhWindow(windowId, blocking, resolver);
        });

        this.driver.on('curs', ({ windowId, x, y }) => {
            if (windowId === 3) {
                this.setCursor(x, y);
            }
        });

        this.driver.on('print_glyph', ({ windowId, x, y, glyphInfo }) => {
            this.renderGlyph(x, y, glyphInfo);
        });

        this.driver.on('putstr', ({ windowId, attr, text }) => {
            if (this.windows[windowId]) {
                this.windows[windowId].lines.push({ attr, text });
            }
            if (windowId === 1 || windowId === 2) {
                if (text && text.trim().length > 0) {
                    this.addMessage(text);
                }
            }
        });

        this.driver.on('raw_print', ({ text }) => {
            if (text && text.trim().length > 0) {
                this.addMessage(text);
            }
        });

        this.driver.on('raw_print_bold', ({ text }) => {
            if (text && text.trim().length > 0) {
                this.addMessage(`**${text}**`);
            }
        });

        this.driver.on('status_update', ({ field, value, change, color }) => {
            this.updateStatus(field, value, change, color);
        });

        this.driver.on('display_file', ({ filename, fileText, resolver }) => {
            this.showTextWindow(filename, fileText || "", resolver);
        });

        this.driver.on('bell', () => {
            this.triggerBell();
        });

        this.driver.on('inputRequired', (data) => {
            console.log("[MobileDomClient] inputRequired:", data.context, data);
            this.activeResolver = data.resolver;

            switch (data.context) {
                case 'poskey':
                case 'getch':
                    break;

                case 'yn_function':
                    this.showYNPrompt(data.question, data.choices, data.defaultChoice, data.resolver);
                    break;

                case 'getlin':
                case 'askname':
                    this.showTextInputPrompt(data.prompt || "What is your name?", data.resolver);
                    break;

                case 'get_ext_cmd':
                    this.showExtCmdPrompt(data.extcmds, data.resolver);
                    break;

                case 'select_menu':
                    this.showMenuModal(data.items, data.how, data.prompt, data.resolver);
                    break;

                default:
                    console.warn("[MobileDomClient] Unhandled inputRequired context:", data.context);
                    break;
            }
        });
    }

    /**
     * 物理キーボードおよびタッチコントロールのバインド
     */
    bindInputEvents() {
        window.addEventListener('keydown', (e) => {
            const resolver = this.activeResolver || (this.driver && this.driver.activeResolver);
            if (!resolver || resolver.isResolved) return;

            if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                if (e.key !== 'Escape' && e.key !== 'Enter') return;
            }

            const charCode = this.convertKeyToCharCode(e);
            if (charCode > 0) {
                e.preventDefault();
                e.stopPropagation();

                if (this.dialogOverlay) {
                    this.dialogOverlay.classList.remove('active');
                    this.dialogOverlay.innerHTML = '';
                }

                this.activeResolver = null;
                resolver.respond(charCode);
            }
        }, true);

        const handleButtonInput = (target) => {
            const btn = target.closest('[data-key]');
            const resolver = this.activeResolver || (this.driver && this.driver.activeResolver);

            if (btn && resolver && !resolver.isResolved) {
                const keyAttr = btn.dataset.key;
                let charCode = 0;
                if (keyAttr.length === 1) {
                    charCode = keyAttr.charCodeAt(0);
                } else if (!isNaN(parseInt(keyAttr))) {
                    charCode = parseInt(keyAttr);
                }

                if (charCode > 0) {
                    this.activeResolver = null;
                    resolver.respond(charCode);
                }
            }
        };

        document.addEventListener('pointerdown', (e) => handleButtonInput(e.target));
        document.addEventListener('click', (e) => handleButtonInput(e.target));
    }

    /**
     * キーイベントを NetHack ASCII/Control コードへ変換
     */
    convertKeyToCharCode(e) {
        const arrowMap = {
            'ArrowUp': 'k'.charCodeAt(0),
            'ArrowDown': 'j'.charCodeAt(0),
            'ArrowLeft': 'h'.charCodeAt(0),
            'ArrowRight': 'l'.charCodeAt(0),
        };

        if (arrowMap[e.key]) {
            return arrowMap[e.key];
        }

        if (e.ctrlKey) {
            if (e.key.length === 1 && e.key.toLowerCase() >= 'a' && e.key.toLowerCase() <= 'z') {
                return e.key.toLowerCase().charCodeAt(0) - 96;
            }
        }
        if (e.altKey && e.key.length === 1) {
            return e.key.toLowerCase().charCodeAt(0) | 0x80;
        }

        switch (e.key) {
            case 'Enter': return 13;
            case 'Escape': return 27;
            case 'Backspace': return 8;
            case 'Tab': return 9;
            case ' ': return 32;
        }

        if (e.key.length === 1) {
            return e.key.charCodeAt(0);
        }
        return 0;
    }

    // --- Multi-Window Management ---

    handleDisplayNhWindow(windowId, blocking, resolver) {
        const win = this.windows[windowId];
        if (!win) {
            if (resolver) resolver.respond(32);
            return;
        }

        if (win.type === 5 || win.type === 4) { // NHW_TEXT (5) or NHW_MENU (4)
            const contentText = win.lines.map(l => l.text).join('\n');
            this.showTextWindow(`Window #${windowId}`, contentText, resolver);
        } else if (win.type === 3) { // NHW_MAP
            if (blocking && resolver) {
                this.activeResolver = resolver;
            } else if (resolver) {
                resolver.respond(32);
            }
        } else {
            if (resolver) resolver.respond(32);
        }
    }

    showTextWindow(title, text, resolver) {
        if (!this.dialogOverlay) {
            if (resolver) resolver.respond(32);
            return;
        }

        const lines = text.split('\n').map(line => `<div class="txt-line">${line || '&nbsp;'}</div>`).join('');

        this.dialogOverlay.innerHTML = `
            <div class="dlg-box dlg-large">
                <div class="dlg-title">${title}</div>
                <div class="txt-content">${lines}</div>
                <div class="dlg-buttons">
                    <button id="dlg-txt-close" class="dlg-btn primary">Close (Space/ESC)</button>
                </div>
            </div>
        `;
        this.dialogOverlay.classList.add('active');

        const closeText = () => {
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
            this.activeResolver = null;
            if (resolver) resolver.respond(32);
        };

        document.getElementById('dlg-txt-close').onclick = closeText;
        if (resolver) {
            this.activeResolver = resolver;
        }
    }

    // --- Render Functions (Glyph & Tile Mapping: mobileCurses.js 100% 準拠) ---

    clearMap() {
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const cell = this.cells[y][x];
                cell.ch = ' ';
                cell.color = 7;
                cell.glyph = -1;
                cell.el.textContent = ' ';
                cell.el.className = 'map-cell';
                cell.el.style.color = '';
                cell.el.style.backgroundImage = '';
            }
        }
    }

    setCursor(x, y) {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return;

        if (this.cursor.x >= 0 && this.cursor.y >= 0 && this.cells[this.cursor.y]) {
            const oldCell = this.cells[this.cursor.y][this.cursor.x];
            if (oldCell) oldCell.el.classList.remove('has-cursor');
        }

        this.cursor = { x, y };
        if (this.cells[y] && this.cells[y][x]) {
            this.cells[y][x].el.classList.add('has-cursor');
        }
    }

    /**
     * (x, y) へのグリフ描画 (mobileCurses.js 100% 完全準拠: tilesPerRow = 40, 16px スケール)
     */
    renderGlyph(x, y, glyphInfo) {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return;
        const cell = this.cells[y][x];
        if (!cell) return;

        const ch = glyphInfo ? (glyphInfo.ch || String.fromCharCode(glyphInfo.symbol)) : ' ';
        const color = glyphInfo ? glyphInfo.color : 7;
        const glyph = glyphInfo ? glyphInfo.glyph : -1;

        if (cell.ch === ch && cell.color === color && cell.glyph === glyph) {
            return;
        }

        cell.ch = ch;
        cell.color = color;
        cell.glyph = glyph;

        // mobileCurses.js 完全準拠: 1行あたり 40 タイル (1280px / 32px = 40)
        if (this.options.useTiles && this.tileMap && glyph >= 0) {
            const tileIdx = this.tileMap[glyph] !== undefined ? this.tileMap[glyph] : this.tileMap[String(glyph)];
            if (tileIdx !== undefined && tileIdx >= 0) {
                const tilesPerRow = 40; // mobileCurses.js の 1行あたり 40 タイル
                const origTileSize = 32; // 元画像 32px
                const displaySize = 16; // 16px スケール表示

                const tx = (tileIdx % tilesPerRow) * origTileSize;
                const ty = Math.floor(tileIdx / tilesPerRow) * origTileSize;

                cell.el.textContent = '';
                cell.el.className = 'map-cell tile-cell';
                cell.el.style.width = `${displaySize}px`;
                cell.el.style.height = `${displaySize}px`;
                cell.el.style.display = 'inline-block';
                cell.el.style.backgroundImage = 'url("pict/nethack_default_32.png")';
                cell.el.style.backgroundRepeat = 'no-repeat';
                cell.el.style.backgroundSize = `${tilesPerRow * displaySize}px auto`; // 640px auto
                cell.el.style.backgroundPosition = `-${tx / 2}px -${ty / 2}px`;
                return;
            }
        }

        // ASCII フォールバック
        cell.el.style.backgroundImage = '';
        cell.el.style.width = '16px';
        cell.el.style.height = '16px';
        cell.el.style.display = 'inline-block';
        cell.el.textContent = ch;
        cell.el.className = `map-cell nh-color-${color}`;
    }

    addMessage(text) {
        this.messageHistory.push(text);
        if (this.messageHistory.length > 100) this.messageHistory.shift();

        if (this.messageLog) {
            const msgItem = document.createElement('div');
            msgItem.className = 'msg-item';
            msgItem.textContent = text;
            this.messageLog.appendChild(msgItem);
            this.messageLog.scrollTop = this.messageLog.scrollHeight;
        }
    }

    updateStatus(field, value, change, color) {
        this.statusData[field] = value;

        if (this.statusBar) {
            const st = this.statusData;
            const nameStr = st[0] || 'Hero';
            const rankStr = st[1] || 'Novice';
            const hpStr = `HP:${st[10] || 0}(${st[11] || 0})`;
            const pwStr = `Pw:${st[12] || 0}(${st[13] || 0})`;
            const acStr = `AC:${st[14] || 10}`;
            const goldStr = `Au:${st[9] || 0}`;
            const lvlStr = `Lvl:${st[18] || 1}`;

            this.statusBar.innerHTML = `
                <span class="st-item st-name">${nameStr} the ${rankStr}</span>
                <span class="st-item st-hp">${hpStr}</span>
                <span class="st-item st-pw">${pwStr}</span>
                <span class="st-item st-ac">${acStr}</span>
                <span class="st-item st-gold">${goldStr}</span>
                <span class="st-item st-lvl">${lvlStr}</span>
            `;
        }
    }

    triggerBell() {
        if (this.mapContainer) {
            this.mapContainer.classList.add('flash-bell');
            setTimeout(() => this.mapContainer.classList.remove('flash-bell'), 150);
        }
    }

    // --- Dynamic Prompts & Dialogs ---

    showYNPrompt(question, choices, defaultChoice, resolver) {
        if (!this.dialogOverlay) {
            resolver.respond(defaultChoice ? defaultChoice.charCodeAt(0) : 27);
            return;
        }

        const qLower = (question || "").toLowerCase();
        const rawChoices = choices || "";
        const choiceChars = [];
        
        for (let i = 0; i < rawChoices.length; i++) {
            const ch = rawChoices[i];
            if (!choiceChars.includes(ch) && ch !== '-' && ch !== ' ') {
                choiceChars.push(ch);
            }
        }

        // もし choices に指定がなく、質問文字列に [ab *] や (y/n) が含まれていれば文字列から抽出
        if (choiceChars.length === 0) {
            const matchBracket = (question || "").match(/\[(.*?)\]/);
            if (matchBracket && matchBracket[1]) {
                const bStr = matchBracket[1];
                for (let i = 0; i < bStr.length; i++) {
                    const c = bStr[i];
                    if (!choiceChars.includes(c) && c !== '-' && c !== ' ') choiceChars.push(c);
                }
            }
        }

        if (choiceChars.length === 0) {
            choiceChars.push('y', 'n', 'q');
        }

        // 方向指示質問の判定
        const isDirection = qLower.includes('direction') || rawChoices.includes('hjklyubn');

        const buttonsHtml = choiceChars.map(c => {
            const isDefault = (c === defaultChoice);
            let label = `'${c}'`;

            if (isDirection) {
                switch(c) {
                    case 'k': label = 'North (k)'; break;
                    case 'j': label = 'South (j)'; break;
                    case 'h': label = 'West (h)'; break;
                    case 'l': label = 'East (l)'; break;
                    case 'y': label = 'NW (y)'; break;
                    case 'u': label = 'NE (u)'; break;
                    case 'b': label = 'SW (b)'; break;
                    case 'n': label = 'SE (n)'; break;
                    case '.': label = 'Self (.)'; break;
                    case '>': label = 'Down (>)'; break;
                    case '<': label = 'Up (<)'; break;
                    default: label = `Dir (${c})`;
                }
            } else {
                switch(c) {
                    case 'y': label = 'Yes (y)'; break;
                    case 'n': label = 'No (n)'; break;
                    case 'q': label = 'Quit (q)'; break;
                    case 'a':
                        // キャラクター選択・ランダム作成質問の場合
                        if (qLower.includes('pick') || qLower.includes('character') || qLower.includes('random') || qLower.includes('all')) {
                            label = 'Auto / Random (a)';
                        } else {
                            label = 'All / Auto (a)';
                        }
                        break;
                    case '*': label = 'All (*)'; break;
                    case '?': label = 'List (?)'; break;
                    default: label = `(${c})`;
                }
            }

            return `<button class="dlg-btn ${isDefault ? 'primary' : ''}" data-choice="${c}">${label}</button>`;
        }).join('');

        const defaultLabel = defaultChoice && defaultChoice !== '\u0000' ? ` (Default: '${defaultChoice}')` : '';

        this.dialogOverlay.innerHTML = `
            <div class="dlg-box">
                <div class="dlg-title">${question}${defaultLabel}</div>
                <div class="dlg-buttons" style="flex-wrap: wrap; gap: 8px;">${buttonsHtml}</div>
                <div style="margin-top: 12px; font-size: 12px; color: #94a3b8;">Or press corresponding key on your keyboard</div>
            </div>
        `;
        this.dialogOverlay.classList.add('active');

        const closeDialog = (code) => {
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
            this.activeResolver = null;
            resolver.respond(code);
        };

        this.dialogOverlay.querySelectorAll('.dlg-btn').forEach(btn => {
            btn.onclick = () => {
                const choice = btn.dataset.choice;
                closeDialog(choice.charCodeAt(0));
            };
        });
    }

    showTextInputPrompt(promptText, resolver) {
        if (!this.dialogOverlay) {
            resolver.respond("player");
            return;
        }

        this.dialogOverlay.innerHTML = `
            <div class="dlg-box">
                <div class="dlg-title">${promptText}</div>
                <input type="text" id="dlg-input" class="dlg-input" value="player" autofocus />
                <div class="dlg-buttons">
                    <button id="dlg-ok" class="dlg-btn primary">OK</button>
                    <button id="dlg-cancel" class="dlg-btn">Cancel</button>
                </div>
            </div>
        `;
        this.dialogOverlay.classList.add('active');

        const inputEl = document.getElementById('dlg-input');
        inputEl.focus();
        inputEl.select();

        const submit = () => {
            const val = inputEl.value.trim() || "player";
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
            this.activeResolver = null;
            resolver.respond(val);
        };

        document.getElementById('dlg-ok').onclick = submit;
        document.getElementById('dlg-cancel').onclick = () => {
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
            this.activeResolver = null;
            resolver.respond("");
        };
        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') submit();
        };
    }

    showExtCmdPrompt(extcmds, resolver) {
        if (!this.dialogOverlay || !extcmds) {
            resolver.respond(-1);
            return;
        }

        const optionsHtml = extcmds.map((cmd, idx) => `
            <button class="dlg-cmd-btn" data-idx="${idx}">#${cmd}</button>
        `).join('');

        this.dialogOverlay.innerHTML = `
            <div class="dlg-box dlg-large">
                <div class="dlg-title">Select Extended Command (#)</div>
                <div class="dlg-cmd-grid">${optionsHtml}</div>
                <button id="dlg-close" class="dlg-btn">Cancel</button>
            </div>
        `;
        this.dialogOverlay.classList.add('active');

        this.dialogOverlay.querySelectorAll('.dlg-cmd-btn').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.idx);
                this.dialogOverlay.classList.remove('active');
                this.dialogOverlay.innerHTML = '';
                this.activeResolver = null;
                resolver.respond(idx);
            };
        });

        document.getElementById('dlg-close').onclick = () => {
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
            this.activeResolver = null;
            resolver.respond(-1);
        };
    }

    /**
     * インベントリ・メニュー表示ダイアログ (select_menu) - タイルグラフィック & アクセラレータ 'a)', 'b)' 対応
     */
    showMenuModal(items, how, promptText, resolver) {
        if (!this.dialogOverlay || !items || items.length === 0) {
            resolver.respond(0);
            return;
        }

        const selectedSet = new Set();
        const itemsHtml = items.map((item, idx) => {
            if (item.isHeader) {
                return `<div class="menu-header">${item.str || ''}</div>`;
            }

            // アクセラレータ文字 ('a', 'b', 'c'...) の確実な抽出
            let accChar = '';
            const rawCh = item.ch || item.accelerator;
            if (typeof rawCh === 'string') {
                accChar = rawCh;
            } else if (typeof rawCh === 'number' && rawCh > 0) {
                accChar = String.fromCharCode(rawCh);
            }

            // インベントリ用 Glyph タイル画像 (mobileCurses.js 準拠: 40タイル/行, 16px スケール)
            let tileStyle = '';
            const gInfo = item.glyph || item.glyphInfo;
            const glyphVal = (gInfo && typeof gInfo === 'object') ? gInfo.glyph : (typeof gInfo === 'number' ? gInfo : -1);

            if (this.options.useTiles && this.tileMap && glyphVal >= 0) {
                const tileIdx = this.tileMap[glyphVal] !== undefined ? this.tileMap[glyphVal] : this.tileMap[String(glyphVal)];
                if (tileIdx !== undefined && tileIdx >= 0) {
                    const tilesPerRow = 40;
                    const origTileSize = 32;
                    const tx = (tileIdx % tilesPerRow) * origTileSize;
                    const ty = Math.floor(tileIdx / tilesPerRow) * origTileSize;
                    tileStyle = `background-image: url("pict/nethack_default_32.png"); background-position: -${tx / 2}px -${ty / 2}px; background-size: 640px auto; width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px; background-repeat: no-repeat;`;
                }
            }

            return `
                <div class="menu-item" data-idx="${idx}" data-acc="${accChar}">
                    <span class="menu-acc">${accChar ? accChar + ')' : ''}</span>
                    ${tileStyle ? `<span class="menu-tile" style="${tileStyle}"></span>` : ''}
                    <span class="menu-str">${item.str || ''}</span>
                </div>
            `;
        }).join('');

        this.dialogOverlay.innerHTML = `
            <div class="dlg-box dlg-large">
                <div class="dlg-title">${promptText || "Select Item"}</div>
                <div class="menu-list">${itemsHtml}</div>
                <div class="dlg-buttons">
                    <button id="dlg-menu-ok" class="dlg-btn primary">OK</button>
                    <button id="dlg-menu-cancel" class="dlg-btn">Cancel</button>
                </div>
            </div>
        `;
        this.dialogOverlay.classList.add('active');

        const itemEls = this.dialogOverlay.querySelectorAll('.menu-item');
        itemEls.forEach(el => {
            el.onclick = () => {
                const idx = parseInt(el.dataset.idx);
                const item = items[idx];

                if (how === 1) { // PICK_ONE
                    window.removeEventListener('keydown', menuKeyHandler, true);
                    this.dialogOverlay.classList.remove('active');
                    this.dialogOverlay.innerHTML = '';
                    this.activeResolver = null;
                    resolver.respond([item]);
                    return;
                }

                if (selectedSet.has(item)) {
                    selectedSet.delete(item);
                    el.classList.remove('selected');
                } else {
                    selectedSet.add(item);
                    el.classList.add('selected');
                }
            };
        });

        // モーダル表示中のキーボードショートカット ('a', 'b', 'c'...) 対応
        const menuKeyHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                window.removeEventListener('keydown', menuKeyHandler, true);
                document.getElementById('dlg-menu-cancel').click();
                return;
            }

            if (e.key.length === 1) {
                const pressedKey = e.key;
                const menuItems = Array.from(this.dialogOverlay.querySelectorAll('.menu-item'));
                const matchEl = menuItems.find(el => el.dataset.acc === pressedKey);

                if (matchEl) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    window.removeEventListener('keydown', menuKeyHandler, true);
                    
                    // イベントループ終了後に非同期でクリックを発火 (二重キー入力伝播を100%防止)
                    setTimeout(() => {
                        matchEl.click();
                    }, 10);
                }
            }
        };
        window.addEventListener('keydown', menuKeyHandler, true);

        document.getElementById('dlg-menu-ok').onclick = () => {
            window.removeEventListener('keydown', menuKeyHandler, true);
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
            this.activeResolver = null;
            resolver.respond(Array.from(selectedSet));
        };

        document.getElementById('dlg-menu-cancel').onclick = () => {
            window.removeEventListener('keydown', menuKeyHandler, true);
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
            this.activeResolver = null;
            resolver.respond(0);
        };
    }
}

if (typeof module !== 'undefined') {
    module.exports = MobileDomClient;
}
