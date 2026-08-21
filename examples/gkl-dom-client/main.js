/**
 * main.js - NetHack GKL DOM-Grid Reference Client
 * 
 * 【特徴】
 * - 手動の Canvas 座標計算や複雑な追従描画が一切不要！
 * - 80x21 DOM Grid マップ上で、CSS `:hover` と DOM イベントだけで動くモダン・クリーン実装
 * - GKL (Gameplay Knowledge Layer) の全構造化ナレッジ能力をたった数行で直感的に発揮
 */

import { WebUICore } from '../../src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from '../../src/driver/index.js';
import { getAdaptiveItemSpecs } from '../../src/core/knowledge/ItemSpecPresenter.js';

class GklDomClient {
  constructor() {
    this.core = null;
    this.domGridElements = []; // 2D array [21][80] of DOM elements
    this.elMapGrid = document.getElementById('map-grid');
    this.elMessageLog = document.getElementById('message-log');
    this.elStatusBar = document.getElementById('status-bar');
    this.elKnowledgeContent = document.getElementById('knowledge-content');
    this.elInventoryList = document.getElementById('inventory-list');
    this.elSkillsDetail = document.getElementById('status-skills-detail');
    this.elBadge = document.getElementById('game-status-badge');
  }

  async init() {
    console.log('[GklDomClient] Initializing WebUICore & DOM Grid Map...');

    // 1. 80x21 DOM Grid マップを高速構築
    this.buildMapDomGrid();

    // 2. WebUICore を初期化 (driver に WorkerBridge を指定)
    const workerPath = '../../src/driver/nethack.worker.js';
    const bridge = new NetHackWasmWorkerBridge(workerPath);
    this.core = new WebUICore({ driver: bridge });

    // イベントバインド
    this.setupCoreEvents();
    this.setupGklListener();

    try {
      this.elBadge.textContent = 'Loading WASM...';
      const wasmJsUrl = 'nethack.js';
      
      const saveInfo = await this.core.detectSavedGameInfo();
      if (saveInfo.hasSave) {
        await this.core.start(wasmJsUrl);
      } else {
        await this.core.start(wasmJsUrl, { forceNewGame: true });
      }

      this.elBadge.textContent = 'Game Running';
      this.elBadge.className = 'badge badge-ready';

    } catch (err) {
      console.error('[GklDomClient] Core initialization failed:', err);
      this.elBadge.textContent = 'Error';
      this.elBadge.className = 'badge badge-lethal';
      this.elMessageLog.textContent = `初期化エラー: ${err.message}`;
    }
  }

  /**
   * 80x21 DOM Grid マップエレメントの構築
   */
  buildMapDomGrid() {
    this.elMapGrid.innerHTML = '';
    this.domGridElements = [];

    for (let y = 0; y < 21; y++) {
      const row = [];
      for (let x = 0; x < 80; x++) {
        const div = document.createElement('div');
        div.className = 'map-tile';
        div.dataset.x = x;
        div.dataset.y = y;
        div.textContent = ' ';

        // 🎯 DOM イベント一発で GKL ナレッジカードを描画！（座標計算一切不要）
        div.addEventListener('mouseenter', () => this.handleTileHover(x, y));
        div.addEventListener('mouseleave', () => this.handleTileLeave());

        this.elMapGrid.appendChild(div);
        row.push(div);
      }
      this.domGridElements.push(row);
    }
  }

  /**
   * WebUICore からの各種イベント (stateChange, message, statusUpdate, print_glyph, cursor, inputRequired) の購読設定
   */
  setupGklListener() {
    if (!this.core) return;

    // 1. State Change (ゲーム状態)
    this.core.on('stateChange', ({ state }) => {
      console.log('[GklDomClient] State changed:', state);
      if (state === 'READY' || state === 'RUNNING' || state === 'WAITING_INPUT') {
        this.elBadge.textContent = 'Game Running';
        this.elBadge.className = 'badge badge-ready';
      } else if (state === 'INITIALIZING') {
        this.elBadge.textContent = 'Initializing...';
        this.elBadge.className = 'badge badge-init';
      }
    });

    // 2. メッセージログ通知 ([object Object] バグ解消)
    this.core.on('message', (msg) => {
      const text = typeof msg === 'string' ? msg : (msg && typeof msg.text === 'string' ? msg.text : (msg && typeof msg.rawText === 'string' ? msg.rawText : null));
      if (text) {
        const div = document.createElement('div');
        div.textContent = text;
        this.elMessageLog.appendChild(div);
        this.elMessageLog.scrollTop = this.elMessageLog.scrollHeight;
      }
    });

    // 3. ステータス更新 ({ status } 分割代入)
    this.core.on('statusUpdate', ({ status }) => {
      console.log('[GklDomClient] Status update:', status);
      this.renderStatus(status);
    });

    // 4. Cursor (プレイヤー位置の同期)
    this.core.on('cursor', ({ x, y }) => {
      if (this.core.gkl && this.core.gkl.areaStateManager) {
        this.core.gkl.areaStateManager.updatePlayerPosition(x, y);
      }
    });

    // 5. Print Glyph (NetHack WASM マップ描画指示 ➔ GKL & DOM へ反映)
    this.core.on('print_glyph', ({ x, y, glyphInfo, glyph }) => {
      const gId = (glyphInfo && glyphInfo.glyph !== undefined) ? glyphInfo.glyph : (glyph !== undefined ? glyph : -1);
      
      // y: 0 はメッセージログ行、y: 1~21 がダンジョンマップ (DOM Grid y: 0~20)
      if (x >= 0 && x < 80 && y >= 1 && y <= 21) {
        const mapY = y - 1;
        const elTile = this.domGridElements[mapY][x];
        const ch = glyphInfo?.ch || ' ';
        const color = glyphInfo?.colorStr || glyphInfo?.colorHex || '#ffffff';

        elTile.textContent = ch;
        elTile.style.color = color;
        if (gId >= 0) {
          elTile.dataset.rawGlyph = gId;
        }

        // GKL の 3階層 AreaStateManager にグリフを即座に同期
        if (this.core.gkl && this.core.gkl.areaStateManager && gId >= 0) {
          this.core.gkl.areaStateManager.updateGlyph(x, mapY, gId, glyphInfo);
        }
      }
    });

    // 6. Clear Window / Clear Map
    this.core.on('clear_nhwindow', ({ windowId }) => {
      if (windowId === 2 || windowId === 0) {
        this.clearMapGrid();
      }
    });

    // 7. Input Required Prompts (キー入力要求プロンプト)
    this.core.on('inputRequired', (data) => {
      console.log('[GklDomClient] Input required:', data);
      if (data && data.prompt) {
        const div = document.createElement('div');
        div.style.color = '#00f3ff';
        div.style.fontWeight = 'bold';
        div.textContent = `▶ ${data.prompt}`;
        this.elMessageLog.appendChild(div);
        this.elMessageLog.scrollTop = this.elMessageLog.scrollHeight;
      }
    });
  }

  clearMapGrid() {
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 80; x++) {
        const elTile = this.domGridElements[y][x];
        elTile.textContent = ' ';
        elTile.style.color = '#ffffff';
        delete elTile.dataset.rawGlyph;
      }
    }
  }

  /**
   * AreaStateManager の 3 階層グリッド (top/middle/bottom) を DOM マップへ一括レンダリング
   */
  updateDomGridMap(asm) {
    if (!asm.grid) return;

    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 80; x++) {
        const cell = asm.grid[y] ? asm.grid[y][x] : null;
        const elTile = this.domGridElements[y][x];

        if (!cell) {
          elTile.textContent = ' ';
          elTile.style.color = '#ffffff';
          delete elTile.dataset.rawGlyph;
          continue;
        }

        // 優先度: top (モンスター/プレイヤー) -> middle (アイテム/死体) -> bottom (地形)
        const targetEntity = cell.top || cell.middle || cell.bottom;

        if (targetEntity) {
          elTile.textContent = targetEntity.ch || ' ';
          elTile.style.color = targetEntity.color || '#ffffff';
          const glyphId = (typeof targetEntity.glyph === 'number')
            ? targetEntity.glyph
            : (targetEntity.glyphInfo && typeof targetEntity.glyphInfo.glyph === 'number'
                ? targetEntity.glyphInfo.glyph
                : (typeof targetEntity.rawGlyph === 'number' ? targetEntity.rawGlyph : -1));
          if (glyphId >= 0) {
            elTile.dataset.rawGlyph = glyphId;
          } else {
            delete elTile.dataset.rawGlyph;
          }
        } else {
          elTile.textContent = ' ';
          elTile.style.color = '#ffffff';
          delete elTile.dataset.rawGlyph;
        }
      }
    }
  }

  /**
   * 🎯 タイルホバー時の超シンプル GKL ナレッジカード表示
   */
  handleTileHover(x, y) {
    if (!this.core || !this.core.gkl || !this.core.gkl.structuredKnowledge) return;

    const elTile = this.domGridElements[y][x];
    const rawGlyphStr = elTile.dataset.rawGlyph;

    if (!rawGlyphStr) {
      this.renderKnowledgeCard(null);
      return;
    }

    const rawGlyph = parseInt(rawGlyphStr, 10);
    if (isNaN(rawGlyph)) {
      this.renderKnowledgeCard(null);
      return;
    }

    // GKL アクセサ呼び出し（万能統合アクセサ getKnowledge）
    const data = this.core.gkl.structuredKnowledge.getKnowledge(rawGlyph, { translate: true });
    this.renderKnowledgeCard(data);
  }

  /**
   * タイル離脱時
   */
  handleTileLeave() {
    this.renderKnowledgeCard(null);
  }

  /**
   * 💡 GKL 構造化ナレッジカードの DOM レンダリング
   */
  renderKnowledgeCard(target) {
    const data = (target && typeof target === 'object' && target.knowledge)
      ? target.knowledge
      : ((target && typeof target === 'object' && (target.name || target.dangerLevel || target.category)) ? target : (this.core && this.core.gkl ? this.core.gkl.getKnowledge(target) : null));

    if (!data) {
      this.elKnowledgeContent.innerHTML = `
        <div class="gkl-empty-hint">
          マップのマスをホバーまたはタップすると<br>リアルタイムで構造化ナレッジが表示されます
        </div>`;
      return;
    }

    if (data.dangerLevel) {
      // モンスターカード
      const badgeClass = `kn-danger-${data.dangerLevel || 'LOW'}`;
      this.elKnowledgeContent.innerHTML = `
        <div class="kn-card">
          <div class="kn-header">
            <span class="kn-title">${data.name}</span>
            <span class="kn-danger-badge ${badgeClass}">${data.dangerLevel} DANGER</span>
          </div>
          <div class="kn-stats-row">
            <span>HD:${data.stats?.hd ?? '-'}</span>
            <span>AC:${data.stats?.ac ?? '-'}</span>
            <span>Spd:${data.stats?.speed ?? '-'}</span>
            <span>MR:${data.stats?.mr ?? 0}%</span>
          </div>
          ${data.corpseInfo?.warningNote ? `
            <div class="kn-warning-box">⚠️ ${data.corpseInfo.warningNote}</div>
          ` : ''}
          ${data.effectSummary ? `
            <div class="kn-effect-box">${data.effectSummary}</div>
          ` : ''}
          ${data.tacticalAdvice && data.tacticalAdvice.length > 0 ? `
            <div class="kn-section">
              <span class="kn-section-title">💡 実戦戦術アドバイス</span>
              <ul class="kn-list">
                ${data.tacticalAdvice.map(adv => `<li>• ${adv}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      // アイテム / 未識別ガイド / 地形カード
      const sm = this.core?.gkl?.skillStateManager || null;
      const adaptiveSpecs = getAdaptiveItemSpecs(data, { skillStateManager: sm });
      let specsHtml = '';
      if (adaptiveSpecs.length > 0) {
        specsHtml = `
          <div class="kn-stats-row" style="margin:6px 0; padding:6px 10px; background:rgba(56, 189, 248, 0.15); border:1px solid rgba(56, 189, 248, 0.3); border-radius:4px; font-size:12px; color:#38bdf8; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
            ${adaptiveSpecs.map(s => {
              const borderStyle = s.highlight ? 'border:1px solid #38bdf8; background:rgba(56,189,248,0.2);' : 'border:1px solid #475569; background:rgba(255,255,255,0.05);';
              const valColor = s.highlight ? '#f8fafc' : '#cbd5e1';
              const labelColor = s.highlight ? '#38bdf8' : '#94a3b8';
              const skillBadgeHtml = s.skillBadge ? `<span style="color:#22c55e; font-weight:bold; margin-left:4px;">${s.skillBadge.label}</span>` : '';
              return `
                <span style="${borderStyle} padding:2px 6px; border-radius:3px;">
                  <span style="color:${labelColor}; font-size:10px;">${s.labelJa || s.label}:</span>
                  <strong style="color:${valColor};">${s.value}</strong>
                  ${skillBadgeHtml}
                </span>
              `;
            }).join('')}
          </div>
        `;
      }

      this.elKnowledgeContent.innerHTML = `
        <div class="kn-card">
          <div class="kn-header">
            <span class="kn-title">${data.inventoryLabel || data.name}</span>
            <span class="kn-category-badge">${data.category || 'INFO'}</span>
          </div>
          ${specsHtml}
          ${data.effectSummary ? `
            <div class="kn-effect-box">${data.effectSummary}</div>
          ` : ''}
          ${data.unidentifiedTips && data.unidentifiedTips.length > 0 ? `
            <div class="kn-section">
              <span class="kn-section-title">🔍 未識別解明ヒント</span>
              <ul class="kn-list">
                ${data.unidentifiedTips.map(tip => `<li>• ${tip}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${data.usageAdvice && data.usageAdvice.length > 0 ? `
            <div class="kn-section">
              <span class="kn-section-title">💡 使用アドバイス</span>
              <ul class="kn-list">
                ${data.usageAdvice.map(adv => `<li>• ${adv}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  /**
   * ステータスバーのレンダリング
   */
  renderStatus(status) {
    if (!status) return;
    const hp = status.hp !== undefined ? status.hp : (status.hpCurrent !== undefined ? status.hpCurrent : '-');
    const hpMax = status.hpMax !== undefined ? status.hpMax : '-';
    const str = status.str !== undefined ? status.str : (status.st !== undefined ? status.st : '-');
    const dex = status.dex !== undefined ? status.dex : '-';
    const con = status.con !== undefined ? status.con : '-';
    const int = status.int !== undefined ? status.int : '-';
    const wis = status.wis !== undefined ? status.wis : '-';
    const cha = status.cha !== undefined ? status.cha : '-';
    const dlvl = status.dlevel !== undefined ? status.dlevel : (status.dlvl !== undefined ? status.dlvl : 1);
    const gold = status.gold !== undefined ? status.gold : 0;

    this.elStatusBar.innerHTML = `
      <span>HP: ${hp}/${hpMax}</span>
      <span>St: ${str}</span>
      <span>Dx: ${dex}</span>
      <span>Co: ${con}</span>
      <span>In: ${int}</span>
      <span>Wi: ${wis}</span>
      <span>Ch: ${cha}</span>
      <span>Dvl: ${dlvl}</span>
      <span>Gold: ${gold}</span>
    `;

    this.renderGklSkills();
  }

  /**
   * 🥋 GKL スキル熟練度バッジの描画
   */
  renderGklSkills() {
    if (!this.elSkillsDetail) return;
    if (!this.core || !this.core.gkl || !this.core.gkl.skillStateManager) {
      this.elSkillsDetail.innerHTML = '';
      return;
    }

    const activeSkills = this.core.gkl.skillStateManager.getActiveSkills();
    if (!activeSkills || activeSkills.length === 0) {
      this.elSkillsDetail.innerHTML = '<span class="gkl-skill-title">🥋 スキル:</span> <span style="font-size:0.75rem; color:#64748b;">(未熟 / なし)</span>';
      return;
    }

    const badgesHtml = activeSkills.map(skill => {
      const rankKey = skill.rank ? skill.rank.key : 'basic';
      const rankLabel = skill.rank ? (skill.rank.label || skill.rank.en) : '入門';
      const enhanceClass = skill.canEnhance ? 'skill-badge-enhanceable' : '';
      const star = skill.canEnhance ? '<span class="skill-star">⭐</span>' : '';
      return `
        <span class="skill-badge skill-badge-${rankKey} ${enhanceClass}" title="${skill.rawText || skill.name}">
          ${star}<strong>${skill.name}</strong> [${rankLabel}]
        </span>
      `;
    }).join('');

    this.elSkillsDetail.innerHTML = `<span class="gkl-skill-title">🥋 スキル:</span> ${badgesHtml}`;
  }

  /**
   * 所持品リストの表示
   */
  renderInventory(items) {
    if (!items || items.length === 0) {
      this.elInventoryList.innerHTML = '<div class="empty-inv">アイテムがありません</div>';
      return;
    }

    this.elInventoryList.innerHTML = items.map(item => `
      <div class="inv-item" data-name="${item.name || ''}">
        <span>${item.selector || ''}) ${item.name || 'Unknown Item'}</span>
      </div>
    `).join('');

    // クリックでナレッジ表示
    const invElements = this.elInventoryList.querySelectorAll('.inv-item');
    invElements.forEach(el => {
      el.addEventListener('click', () => {
        const name = el.dataset.name;
        if (name && this.core && this.core.gkl && this.core.gkl.structuredKnowledge) {
          const data = this.core.gkl.structuredKnowledge.getKnowledge(name, { translate: true });
          this.renderKnowledgeCard(data);
        }
      });
    });
  }

  setupCoreEvents() {
    // Keydown イベントハンドラ (NetHack WASM へキー入力を送信)
    window.addEventListener('keydown', (e) => {
      if (!this.core) return;

      // input タグでの文字入力中でなければゲーム入力を通す
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

      if (e.code) {
        if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) return;
        this.core.sendKey(e.code, e.shiftKey, e.ctrlKey, e.altKey, e.key);
      }
    });
  }
}

// 起動
window.addEventListener('DOMContentLoaded', () => {
  const client = new GklDomClient();
  client.init();
});
