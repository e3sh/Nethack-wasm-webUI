/**
 * FloatingMessageHud.js
 *
 * 全画面マップ上に最新メッセージを透過表示するフローティング HUD コンポーネント。
 * - 状態管理・世代判定・ライフサイクルは FloatingMessageHudController (Headless) に委譲
 * - 画面上部中央に最新 2〜3 行を半透明カードでポップアップ表示
 * - isBold や緊急メッセージのハイライト
 * - ターン経過または一定時間でのフェードアウト
 * - pointer-events: none によりマップ上のクリックや探索操作を一切妨げない
 */
import { FloatingMessageHudController, LINE_STATE } from '../../../../src/ui-controller/index.js';

export class FloatingMessageHud {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - HUD 行を追加する親コンテナ
   * @param {number} [options.maxLines=5] - 最大表示行数 (標準 4〜5 行)
   * @param {number} [options.fadeTimeoutMs=0] - 受信時の自動フェードアウト時間 (0: 操作起点モード。正数の場合は時間経過でも消滅)
   * @param {number} [options.fadeDelayAfterActionMs=2500] - ユーザー操作が行われた後、フェードアウトを開始するまでの待機時間 (ミリ秒)
   * @param {Document} [options.document] - DOM ドキュメントオブジェクト
   */
  constructor({ container, maxLines = 5, fadeTimeoutMs = 0, fadeDelayAfterActionMs = 2500, document: doc = null } = {}) {
    this.container = container;
    this.maxLines = maxLines;
    this.fadeTimeoutMs = fadeTimeoutMs;
    this.fadeDelayAfterActionMs = fadeDelayAfterActionMs;
    this.document = doc || (typeof document !== 'undefined' ? document : null);
    this.currentLanguage = 'ja';

    this.controller = new FloatingMessageHudController({
      maxLines,
      fadeTimeoutMs,
      fadeDelayAfterActionMs
    });

    // Web Component (<nh-floating-hud>) との接続
    this.isWebComponent = Boolean(
      this.container && (
        (this.container.tagName && this.container.tagName.toUpperCase() === 'NH-FLOATING-HUD') ||
        typeof this.container.setController === 'function'
      )
    );
    if (this.isWebComponent && typeof this.container.setController === 'function') {
      this.container.setController(this.controller);
    }

    this.lines = []; // Array<{ id, element, timer, isBold, state: 'active' | 'stale' | 'fading' }>
  }

  /**
   * 最大表示行数の変更
   * @param {number} num
   */
  setMaxLines(num) {
    this.maxLines = Math.max(1, Math.min(10, num));
    this.controller.setMaxLines(this.maxLines);
    if (this.isWebComponent && this.container && typeof this.container.setAttribute === 'function') {
      this.container.setAttribute('max-lines', String(this.maxLines));
    }

    while (this.lines.length > this.maxLines) {
      const oldest = this.lines.shift();
      if (oldest) {
        if (oldest.timer) clearTimeout(oldest.timer);
        if (oldest.element && oldest.element.parentNode) {
          oldest.element.parentNode.removeChild(oldest.element);
        }
      }
    }
    this._updateLineAges();
  }

  /**
   * 各行の新旧世代クラスを更新 (最新行: line-age-0, 古い行: line-age-1..)
   * @private
   */
  _updateLineAges() {
    const total = this.lines.length;
    this.lines.forEach((entry, idx) => {
      const revIdx = total - 1 - idx; // 0: 最新行
      entry.element.classList.remove('line-age-0', 'line-age-1', 'line-age-2', 'line-age-3', 'line-age-4');
      entry.element.classList.add(`line-age-${Math.min(revIdx, 4)}`);
    });
  }

  /**
   * 最新メッセージを追加表示
   * @param {Object} messageItem
   * @param {number} messageItem.id
   * @param {string} messageItem.text
   * @param {string} [messageItem.rawText]
   * @param {boolean} [messageItem.isBold]
   * @param {number} [messageItem.attr]
   */
  pushMessage({ id, text, rawText, isBold = false, attr = 0 }) {
    if (!this.container || !text || !this.document) return;

    // 同一メッセージがすでにキューの末尾にある場合の連続重複処理（更新のみ）
    const lastLine = this.lines.length > 0 ? this.lines[this.lines.length - 1] : null;
    if (lastLine && lastLine.id === id) {
      this.updateMessage({ id, text, isBold, attr });
      return;
    }

    this.controller.pushMessage({ id, text, rawText, isBold, attr });

    const lineEl = this.document.createElement('div');
    lineEl.className = 'floating-message-line' + (isBold ? ' bold' : '');
    lineEl.dataset.messageId = String(id);
    lineEl.textContent = text;
    if (typeof this.container.appendChild === 'function') {
      this.container.appendChild(lineEl);
    }

    const lineEntry = {
      id,
      element: lineEl,
      isBold: Boolean(isBold),
      timer: null,
      state: 'active'
    };

    if (this.fadeTimeoutMs > 0) {
      lineEntry.timer = setTimeout(() => {
        this._fadeLine(lineEntry);
      }, this.fadeTimeoutMs);
    }

    this.lines.push(lineEntry);

    // 最大行数を超えた古い行を即削除
    while (this.lines.length > this.maxLines) {
      const oldest = this.lines.shift();
      if (oldest) {
        if (oldest.timer) clearTimeout(oldest.timer);
        if (oldest.element && oldest.element.parentNode) {
          oldest.element.parentNode.removeChild(oldest.element);
        }
      }
    }

    this._updateLineAges();
  }

  /**
   * 既存メッセージの太字昇格・文面更新を反映
   * @param {Object} messageItem
   */
  updateMessage(messageItem) {
    if (!messageItem || !this.container) return;

    this.controller.updateMessage(messageItem);

    const entry = this.lines.find(l => l.id === messageItem.id);
    if (!entry) return;

    if (messageItem.text) {
      entry.element.textContent = messageItem.text;
    }

    if (messageItem.isBold !== undefined) {
      entry.isBold = Boolean(messageItem.isBold);
      if (entry.isBold) {
        entry.element.classList.add('bold');
      } else {
        entry.element.classList.remove('bold');
      }
    }

    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.state = 'active';
    if (entry.element) {
      entry.element.classList.remove('stale', 'fading-fast');
    }

    if (this.fadeTimeoutMs > 0) {
      entry.timer = setTimeout(() => {
        this._fadeLine(entry);
      }, this.fadeTimeoutMs);
    }
  }

  /**
   * ユーザー操作が行われたことを通知し、直前行を半透明化＋最古行から順次時間差で1行ずつフェードアウト
   */
  notifyUserAction() {
    if (this.controller && typeof this.controller.notifyUserAction === 'function') {
      this.controller.notifyUserAction();
    }

    // 操作起点モード (fadeTimeoutMs === 0)
    if (this.fadeTimeoutMs === 0) {
      const activeLines = this.lines.filter(l => l.state !== 'fading');
      
      // 1. 直前の未フェード行を直ちに半透明 (fading-fast: opacity 0.4) にする
      for (const entry of activeLines) {
        if (entry.element && !entry.element.classList.contains('fading-fast')) {
          entry.element.classList.add('fading-fast');
        }
      }

      // 連続操作時: 前回の操作ですでに待機中 (stale) の最古行を速やかにフェードアウトへ移行
      const staleLines = this.lines.filter(l => l.state === 'stale');
      if (staleLines.length > 0) {
        this._fadeLine(staleLines[0]);
      }

      // 2. 最古の行から順次、時間差（スタガード 400ms 刻み）で1行ずつフェードアウト待機タイマーを起動
      const baseDelay = this.fadeDelayAfterActionMs > 0 ? this.fadeDelayAfterActionMs : 1500;
      const stepDelay = 400;

      activeLines.forEach((entry, idx) => {
        entry.state = 'stale';
        if (entry.timer) clearTimeout(entry.timer);

        const delay = baseDelay + idx * stepDelay;
        entry.timer = setTimeout(() => {
          this._fadeLine(entry);
        }, delay);
      });
      return;
    }

    // fadeTimeoutMs > 0 の場合（互換用）
    for (const entry of this.lines) {
      if (entry.element && !entry.element.classList.contains('fading')) {
        entry.element.classList.add('fading-fast');
      }
    }
  }

  /**
   * ターン経過時に直前のメッセージを速やかに半透明フェードへ移行
   */
  onTurnPassed() {
    this.notifyUserAction();
  }

  fadeAll() {
    this.controller.fadeAll();
    for (const entry of this.lines) {
      this._fadeLine(entry);
    }
  }

  clear() {
    this.controller.clear();
    for (const entry of this.lines) {
      if (entry.timer) clearTimeout(entry.timer);
      if (entry.element && entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
    }
    this.lines = [];
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * 単一行のフェードアウト処理
   * @private
   */
  _fadeLine(entry) {
    if (!entry || !entry.element || entry.state === 'fading') return;
    entry.state = 'fading';
    this.controller.fadeLine(entry.id);

    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.element.classList.add('fading');
    setTimeout(() => {
      if (entry.element && entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
      const idx = this.lines.indexOf(entry);
      if (idx !== -1) {
        this.lines.splice(idx, 1);
        this.controller.removeLine(entry.id);
        this._updateLineAges();
      }
    }, 400);
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
  }
}
