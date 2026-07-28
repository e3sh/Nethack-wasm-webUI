/**
 * DriverDomTestClient.js
 * 
 * NetHackWasmDriver の動作検証・デバッグ・イベントテスト専用の DOM テストクライアント。
 * ユーザー名エントリー、2軸インジケータバッジ (#engine-state-badge, #input-state-badge) による状態表示、
 * およびオーバーラップ DIV モーダル (#dialog-overlay) によるテキスト・メニュー表示を提供する。
 */
class DriverDomTestClient {
    constructor(driver, options = {}) {
        this.driver = driver;
        this.options = Object.assign({
            mapContainerId: 'map-viewport',
            messageLogId: 'message-log',
            statusBarId: 'status-bar',
            promptLabelId: 'test-prompt-label',
            promptControlsId: 'test-prompt-controls',
            engineBadgeId: 'engine-state-badge',
            inputBadgeId: 'input-state-badge',
            dialogOverlayId: 'dialog-overlay',
            usernameInputId: 'username-input',
            useTiles: true,
            tileImage: 'pict/nethack_default_32.png',
            tileSize: 16
        }, options);

        this.mapContainer = document.getElementById(this.options.mapContainerId);
        this.messageLog = document.getElementById(this.options.messageLogId);
        this.statusBar = document.getElementById(this.options.statusBarId);
        this.promptLabel = document.getElementById(this.options.promptLabelId);
        this.promptControls = document.getElementById(this.options.promptControlsId);
        this.engineBadge = document.getElementById(this.options.engineBadgeId);
        this.inputBadge = document.getElementById(this.options.inputBadgeId);
        this.usernameInput = document.getElementById(this.options.usernameInputId);
        this.dialogOverlay = document.getElementById(this.options.dialogOverlayId);

        this.activeResolver = null;
        this.tileMap = typeof tileMapping === 'function' ? tileMapping() : null;

        // Map buffer (24 rows x 80 cols)
        this.rows = 24;
        this.cols = 80;
        this.mapGrid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
        this.cursorPos = { x: 0, y: 0 };
        this.statusData = {};
        this.textWindowBuffers = {}; // NHW_MENU / NHW_TEXT 用テキストバッファ

        this.initDOM();
        this.bindDriverEvents();
        this.bindKeyboardEvents();
        this.bindActionBarEvents();
    }

    initDOM() {
        if (!this.mapContainer) return;
        this.mapContainer.innerHTML = '';
        this.cellElements = [];

        for (let r = 0; r < this.rows; r++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'map-row';
            const rowCells = [];

            for (let c = 0; c < this.cols; c++) {
                const cellSpan = document.createElement('span');
                cellSpan.className = 'map-cell';
                cellSpan.id = `cell-${r}-${c}`;
                cellSpan.textContent = ' ';
                rowDiv.appendChild(cellSpan);
                rowCells.push(cellSpan);
            }
            this.mapContainer.appendChild(rowDiv);
            this.cellElements.push(rowCells);
        }
    }

    setTileMode(useTiles) {
        this.options.useTiles = useTiles;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cellData = this.mapGrid[r][c];
                if (cellData) this.renderCell(r, c, cellData);
            }
        }
    }

    bindDriverEvents() {
        if (!this.driver) return;

        this.driver.on('stateChange', ({ state, oldState }) => {
            this.updateEngineBadge(state);
        });

        this.driver.on('print_glyph', ({ windowId, x, y, glyphInfo }) => {
            this.updateGlyphCell(x, y, glyphInfo);
        });

        this.driver.on('curs', ({ windowId, x, y }) => {
            this.setCursorPosition(x, y);
        });

        // 生メッセージ (物拾いメッセージ "You pick up...", 通知等) の確実な受容
        this.driver.on('raw_print', ({ text }) => {
            this.appendMessage(text);
        });

        this.driver.on('raw_print_bold', ({ text }) => {
            this.appendMessage(text);
        });

        this.driver.on('putstr', ({ windowId, attr, text }) => {
            if (windowId === 1) { // NHW_MESSAGE (通常メッセージ)
                this.appendMessage(text);
            } else if (windowId === 2) { // NHW_STATUS (ステータスバー)
                this.updateStatusBarText(text);
            } else if (windowId >= 4) { // NHW_MENU / NHW_TEXT (Lookup Info, Help等)
                if (!this.textWindowBuffers[windowId]) {
                    this.textWindowBuffers[windowId] = [];
                }
                this.textWindowBuffers[windowId].push(text);
            } else {
                this.appendMessage(text);
            }
        });

        this.driver.on('putmixed', ({ windowId, attr, text }) => {
            if (windowId === 1) {
                this.appendMessage(text);
            } else if (windowId === 2) {
                this.updateStatusBarText(text);
            }
        });

        this.driver.on('status_update', ({ field, value }) => {
            this.updateStatusField(field, value);
        });

        this.driver.on('clear_nhwindow', ({ windowId }) => {
            if (windowId >= 4) {
                delete this.textWindowBuffers[windowId];
            }
        });

        this.driver.on('display_nhwindow', ({ windowId, blocking }) => {
            if (this.messageLog) {
                this.messageLog.scrollTop = this.messageLog.scrollHeight;
            }

            // Lookup Information や HELP などのテキストウィンドウ表示
            if (windowId >= 4 && this.textWindowBuffers[windowId] && this.textWindowBuffers[windowId].length > 0) {
                const lines = this.textWindowBuffers[windowId];
                this.textWindowBuffers[windowId] = []; // 表示後クリア
                this.showTextWindowModal(lines);
            }
        });

        this.driver.on('inputRequired', ({ context, question, choices, defaultChoice, prompt, items, how, resolver }) => {
            this.activeResolver = resolver;
            this.updateInputBadge(context);

            if (context === 'yn_function') {
                this.showYNPromptLine(question, choices, defaultChoice, resolver);
            } else if (context === 'getlin' || context === 'askname') {
                this.showTextInputPromptModal(prompt || question || "Who are you?", resolver);
            } else if (context === 'select_menu') {
                this.showMenuModal(items, how, prompt, resolver);
            } else if (context === 'nhgetch' || context === 'poskey') {
                // 通常ターンキー入力待ち
            }
        });
    }

    updateEngineBadge(state) {
        if (!this.engineBadge) return;
        this.engineBadge.className = 'state-badge';
        if (state === 'RUNNING' || state === 'WAITING_INPUT' || state === 'WAITING_MENU') {
            this.engineBadge.textContent = 'Engine: RUNNING';
            this.engineBadge.classList.add('state-running');
        } else {
            this.engineBadge.textContent = `Engine: ${state}`;
            this.engineBadge.classList.add('state-stopped');
        }
    }

    updateInputBadge(context) {
        if (!this.inputBadge) return;
        this.inputBadge.className = 'state-badge';

        if (!context || context === 'IDLE') {
            this.inputBadge.textContent = 'Input: IDLE';
            this.inputBadge.classList.add('input-idle');
        } else if (context === 'nhgetch' || context === 'poskey') {
            this.inputBadge.textContent = 'Input: WAITING_KEY';
            this.inputBadge.classList.add('input-key');
        } else if (context === 'yn_function') {
            this.inputBadge.textContent = 'Input: WAITING_YN';
            this.inputBadge.classList.add('input-yn');
        } else if (context === 'select_menu') {
            this.inputBadge.textContent = 'Input: WAITING_MENU';
            this.inputBadge.classList.add('input-menu');
        } else if (context === 'getlin' || context === 'askname') {
            this.inputBadge.textContent = 'Input: WAITING_TEXT';
            this.inputBadge.classList.add('input-text');
        } else {
            this.inputBadge.textContent = `Input: ${context}`;
            this.inputBadge.classList.add('input-key');
        }
    }

    bindKeyboardEvents() {
        window.addEventListener('keydown', (e) => {
            if (this.dialogOverlay && this.dialogOverlay.classList.contains('active')) {
                // Modal active
                return;
            }

            // ヘッダーや他の入力ボックスフォーカス時は無効
            if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                return;
            }

            let charCode = 0;
            if (e.key === 'ArrowUp') charCode = 107; // 'k'
            else if (e.key === 'ArrowDown') charCode = 106; // 'j'
            else if (e.key === 'ArrowLeft') charCode = 104; // 'h'
            else if (e.key === 'ArrowRight') charCode = 108; // 'l'
            else if (e.key === 'Enter') charCode = 13;
            else if (e.key === 'Escape') charCode = 27;
            else if (e.key === ' ') charCode = 32;
            else if (e.key.length === 1) charCode = e.key.charCodeAt(0);

            if (charCode > 0 && this.driver && this.driver.activeResolver) {
                this.updateInputBadge('IDLE');
                this.driver.activeResolver.respond(charCode);
            }
        });
    }

    bindActionBarEvents() {
        const actionBtns = document.querySelectorAll('#action-bar .btn-touch');
        actionBtns.forEach(btn => {
            btn.onclick = () => {
                const keyStr = btn.dataset.key;
                if (!keyStr) return;

                let charCode = 0;
                if (keyStr.length === 1) charCode = keyStr.charCodeAt(0);
                else charCode = parseInt(keyStr);

                if (charCode > 0 && this.driver && this.driver.activeResolver) {
                    this.updateInputBadge('IDLE');
                    this.driver.activeResolver.respond(charCode);
                }
            };
        });
    }

    updateGlyphCell(x, y, glyphInfo) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
        this.mapGrid[y][x] = glyphInfo;
        this.renderCell(y, x, glyphInfo);
    }

    renderCell(r, c, cellData) {
        const cellEl = this.cellElements[r][c];
        if (!cellEl || !cellData) return;

        cellEl.className = 'map-cell';
        if (r === this.cursorPos.y && c === this.cursorPos.x) {
            cellEl.classList.add('has-cursor');
        }

        const glyphVal = (cellData && typeof cellData === 'object') ? cellData.glyph : cellData;

        if (this.options.useTiles && this.tileMap && glyphVal >= 0) {
            const tileIdx = this.tileMap[glyphVal] !== undefined ? this.tileMap[glyphVal] : this.tileMap[String(glyphVal)];
            if (tileIdx !== undefined && tileIdx >= 0) {
                const tilesPerRow = 40;
                const origTileSize = 32;
                const tx = (tileIdx % tilesPerRow) * origTileSize;
                const ty = Math.floor(tileIdx / tilesPerRow) * origTileSize;

                cellEl.classList.add('tile-cell');
                cellEl.textContent = '';
                cellEl.style.backgroundImage = `url("${this.options.tileImage}")`;
                cellEl.style.backgroundPosition = `-${tx / 2}px -${ty / 2}px`;
                cellEl.style.backgroundSize = `640px auto`;
                return;
            }
        }

        cellEl.style.backgroundImage = 'none';
        cellEl.classList.remove('tile-cell');

        let chStr = ' ';
        if (cellData) {
            const rawSym = cellData.symbol !== undefined ? cellData.symbol : (cellData.ch !== undefined ? cellData.ch : cellData.ascii);
            if (typeof rawSym === 'string') {
                chStr = rawSym;
            } else if (typeof rawSym === 'number' && rawSym > 0) {
                chStr = String.fromCharCode(rawSym);
            }
        }

        cellEl.textContent = chStr;
        if (cellData && cellData.colorStr) {
            cellEl.style.color = cellData.colorStr;
        } else {
            cellEl.style.color = '#e2e8f0';
        }
    }

    setCursorPosition(x, y) {
        const oldX = this.cursorPos.x;
        const oldY = this.cursorPos.y;
        this.cursorPos = { x, y };

        if (this.cellElements[oldY] && this.cellElements[oldY][oldX]) {
            this.cellElements[oldY][oldX].classList.remove('has-cursor');
        }
        if (this.cellElements[y] && this.cellElements[y][x]) {
            this.cellElements[y][x].classList.add('has-cursor');
        }
    }

    clearMapBuffer() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                this.mapGrid[r][c] = null;
                const el = this.cellElements[r][c];
                if (el) {
                    el.className = 'map-cell';
                    el.textContent = ' ';
                    el.style.backgroundImage = 'none';
                }
            }
        }
    }

    appendMessage(text) {
        if (!this.messageLog || !text) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'msg-item';
        msgDiv.textContent = text;
        this.messageLog.appendChild(msgDiv);
        this.messageLog.scrollTop = this.messageLog.scrollHeight;
    }

    updateStatusBarText(text) {
        if (!this.statusBar || !text) return;
        this.statusBar.innerHTML = `<span class="st-item">${text}</span>`;
    }

    updateStatusField(field, value) {
        // 階層移動 (field 20: DLEVEL) の検知時、旧階層のマップバッファを全クリア
        if (field === 20 || field === '20') {
            if (this.statusData[20] !== undefined && this.statusData[20] !== value) {
                this.clearMapBuffer();
            }
        }

        this.statusData[field] = value;

        if (this.statusBar) {
            const st = this.statusData;
            // 5.0 / 3.7 STATUS フィールドインデックス (param/rogueDefines.js 準拠):
            // 0: TITLE, 7: ALIGN, 10: GOLD, 11: ENE(Pw), 12: ENEMAX, 13: XP(Lvl), 14: AC, 16: TIME, 17: HUNGER, 18: HP, 19: HPMAX, 20: DLEVEL, 21: EXP
            const titleStr = st[0] || 'Hero the Novice';
            const hpVal = st[18] !== undefined ? st[18] : 0;
            const hpMax = st[19] !== undefined ? st[19] : 0;
            const pwVal = st[11] !== undefined ? st[11] : 0;
            const pwMax = st[12] !== undefined ? st[12] : 0;
            const acVal = st[14] !== undefined ? st[14] : 10;

            // GOLD (field 10) パース ("glyph:0f2b:100" などの glyph コード表記に対応)
            let goldVal = '0';
            if (st[10] !== undefined) {
                const gStr = String(st[10]);
                if (gStr.includes(':')) {
                    const parts = gStr.split(':');
                    goldVal = parts[parts.length - 1];
                } else {
                    goldVal = gStr;
                }
            }

            const dlvlStr = st[20] || 'Dlvl:1';
            const expLvlStr = st[13] !== undefined ? `Lvl:${st[13]}` : 'Lvl:1';

            this.statusBar.innerHTML = `
                <span class="st-item st-name">${titleStr}</span>
                <span class="st-item st-hp">HP:${hpVal}(${hpMax})</span>
                <span class="st-item st-pw">Pw:${pwVal}(${pwMax})</span>
                <span class="st-item st-ac">AC:${acVal}</span>
                <span class="st-item st-gold">Au:${goldVal}</span>
                <span class="st-item st-lvl">${dlvlStr} ${expLvlStr}</span>
            `;
        }
    }

    // --- Inline & Overlay Test Prompt Handlers ---

    setPromptLine(labelText, controlsHtml = '') {
        if (this.promptLabel) this.promptLabel.textContent = labelText;
        if (this.promptControls) this.promptControls.innerHTML = controlsHtml;
    }

    resetPromptLine() {
        this.setPromptLine('Prompt Status: Ready (Use keyboard hjkl, arrows, or action bar)', '');
    }

    showYNPromptLine(question, choices, defaultChoice, resolver) {
        if (question) {
            this.appendMessage(question);
        }

        const qLower = (question || "").toLowerCase();
        const rawChoices = choices || "";
        const choiceChars = [];

        for (let i = 0; i < rawChoices.length; i++) {
            const ch = rawChoices[i];
            if (!choiceChars.includes(ch) && ch !== '-' && ch !== ' ') choiceChars.push(ch);
        }

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

        if (choiceChars.length === 0) choiceChars.push('y', 'n', 'q');

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
                    default: label = `Dir (${c})`;
                }
            } else {
                switch(c) {
                    case 'y': label = 'Yes (y)'; break;
                    case 'n': label = 'No (n)'; break;
                    case 'q': label = 'Quit (q)'; break;
                    case 'a':
                        if (qLower.includes('pick') || qLower.includes('character') || qLower.includes('random')) label = 'Auto / Random (a)';
                        else label = 'All / Auto (a)';
                        break;
                    case '*': label = 'All (*)'; break;
                    case '?': label = 'List (?)'; break;
                    default: label = `(${c})`;
                }
            }
            return `<button class="dlg-btn ${isDefault ? 'primary' : ''}" data-choice="${c}">${label}</button>`;
        }).join('');

        // インジケータ行へのプロンプト明示
        this.setPromptLine(`[INPUT WAITING] ${question}`, buttonsHtml);

        const closeAndRespond = (code) => {
            window.removeEventListener('keydown', lineKeyHandler, true);
            this.resetPromptLine();
            this.updateInputBadge('IDLE');
            resolver.respond(code);
        };

        const lineKeyHandler = (e) => {
            if (e.key.length === 1) {
                const pressed = e.key;
                if (choiceChars.includes(pressed)) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    closeAndRespond(pressed.charCodeAt(0));
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeAndRespond(27);
            } else if (isDirection) {
                let dirChar = '';
                if (e.key === 'ArrowUp') dirChar = 'k';
                else if (e.key === 'ArrowDown') dirChar = 'j';
                else if (e.key === 'ArrowLeft') dirChar = 'h';
                else if (e.key === 'ArrowRight') dirChar = 'l';

                if (dirChar) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    closeAndRespond(dirChar.charCodeAt(0));
                }
            }
        };
        window.addEventListener('keydown', lineKeyHandler, true);

        if (this.promptControls) {
            this.promptControls.querySelectorAll('.dlg-btn').forEach(btn => {
                btn.onclick = () => {
                    closeAndRespond(btn.dataset.choice.charCodeAt(0));
                };
            });
        }
    }

    showTextWindowModal(lines) {
        if (!this.dialogOverlay || !lines || lines.length === 0) return;

        const contentHtml = lines.map(line => {
            const safeLine = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<div style="margin-bottom: 2px; font-family: monospace; white-space: pre-wrap;">${safeLine || '&nbsp;'}</div>`;
        }).join('');

        this.dialogOverlay.innerHTML = `
            <div class="dlg-box dlg-large">
                <div class="dlg-title">Information / Text</div>
                <div class="menu-list" style="padding: 12px; font-size: 13px; color: #cbd5e1; background-color: #0f172a; max-height: 60vh; overflow-y: auto;">
                    ${contentHtml}
                </div>
                <div class="dlg-buttons">
                    <button id="dlg-text-ok" class="dlg-btn primary">OK (Space / Enter)</button>
                </div>
            </div>
        `;
        this.dialogOverlay.classList.add('active');

        const closeModal = () => {
            window.removeEventListener('keydown', textKeyHandler, true);
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
        };

        const textKeyHandler = (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeModal();
            }
        };
        window.addEventListener('keydown', textKeyHandler, true);

        const okBtn = document.getElementById('dlg-text-ok');
        if (okBtn) okBtn.onclick = closeModal;
    }

    showTextInputPromptModal(promptText, resolver) {
        if (!this.dialogOverlay) {
            const defaultName = this.usernameInput ? (this.usernameInput.value.trim() || "e3-sh") : "e3-sh";
            resolver.respond(defaultName);
            return;
        }

        const presetName = this.usernameInput ? (this.usernameInput.value.trim() || "e3-sh") : "e3-sh";

        this.dialogOverlay.innerHTML = `
            <div class="dlg-box">
                <div class="dlg-title">${promptText || "Who are you?"}</div>
                <input type="text" id="dlg-input" class="dlg-input" value="${presetName}" autofocus />
                <div class="dlg-buttons">
                    <button id="dlg-ok" class="dlg-btn primary">OK (Enter)</button>
                    <button id="dlg-cancel" class="dlg-btn">Cancel</button>
                </div>
            </div>
        `;
        this.dialogOverlay.classList.add('active');

        const inputEl = document.getElementById('dlg-input');
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
        }

        const submit = () => {
            const val = inputEl ? (inputEl.value.trim() || presetName) : presetName;
            if (this.usernameInput) this.usernameInput.value = val;
            try {
                localStorage.setItem('nethack_username', val);
            } catch (e) {}
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
            this.activeResolver = null;
            this.updateInputBadge('IDLE');
            resolver.respond(val);
        };

        if (inputEl) {
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                }
            };
        }

        document.getElementById('dlg-ok').onclick = submit;
        document.getElementById('dlg-cancel').onclick = () => {
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
            this.activeResolver = null;
            this.updateInputBadge('IDLE');
            resolver.respond(presetName);
        };
    }

    showMenuModal(items, how, promptText, resolver) {
        if (!this.dialogOverlay || !items || items.length === 0) {
            resolver.respond(0);
            return;
        }

        const selectedSet = new Set();
        const itemsHtml = items.map((item, idx) => {
            if (item.isHeader) return `<div class="menu-header">${item.str || ''}</div>`;

            let accChar = '';
            const rawCh = item.ch || item.accelerator;
            if (typeof rawCh === 'string' && rawCh.length === 1 && rawCh !== '\x00') {
                accChar = rawCh;
            } else if (typeof rawCh === 'number' && rawCh > 0) {
                accChar = String.fromCharCode(rawCh);
            }

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
                    <button id="dlg-menu-ok" class="dlg-btn primary">OK (Enter)</button>
                    <button id="dlg-menu-cancel" class="dlg-btn">Cancel (ESC)</button>
                </div>
            </div>
        `;
        this.dialogOverlay.classList.add('active');

        const closeAndRespond = (resValue) => {
            window.removeEventListener('keydown', menuKeyHandler, true);
            this.dialogOverlay.classList.remove('active');
            this.dialogOverlay.innerHTML = '';
            this.activeResolver = null;
            this.updateInputBadge('IDLE');
            resolver.respond(resValue);
        };

        const itemEls = this.dialogOverlay.querySelectorAll('.menu-item');
        itemEls.forEach(el => {
            el.onclick = () => {
                const idx = parseInt(el.dataset.idx);
                const item = items[idx];

                if (how === 1) { // PICK_ONE
                    closeAndRespond([item]);
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

        const menuKeyHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeAndRespond(0);
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (selectedSet.size > 0) {
                    closeAndRespond(Array.from(selectedSet));
                } else {
                    const firstItem = items.find(it => !it.isHeader);
                    closeAndRespond(firstItem ? [firstItem] : 0);
                }
                return;
            }

            if (e.key.length === 1) {
                const pressedKey = e.key;
                const matchItem = items.find(it => {
                    if (it.isHeader) return false;
                    const c = (typeof it.ch === 'string' && it.ch !== '\x00') ? it.ch : (it.ch > 0 ? String.fromCharCode(it.ch) : '');
                    return c === pressedKey;
                });

                if (matchItem) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    closeAndRespond([matchItem]);
                }
            }
        };
        window.addEventListener('keydown', menuKeyHandler, true);

        document.getElementById('dlg-menu-ok').onclick = () => {
            closeAndRespond(Array.from(selectedSet));
        };

        document.getElementById('dlg-menu-cancel').onclick = () => {
            closeAndRespond(0);
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DriverDomTestClient;
}
