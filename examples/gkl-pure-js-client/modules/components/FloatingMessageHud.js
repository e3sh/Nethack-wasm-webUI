/**
 * FloatingMessageHud.js
 *
 * 全画面マップ上に最新メッセージを透過表示するフローティング HUD コンポーネント。
 * - 画面上部中央に最新 2〜3 行を半透明カードでポップアップ表示
 * - isBold や緊急メッセージのハイライト
 * - ターン経過または一定時間でのフェードアウト
 * - pointer-events: none によりマップ上のクリックや探索操作を一切妨げない
 */

export class FloatingMessageHud {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - HUD 行を追加する親コンテナ
   * @param {number} [options.maxLines=5] - 最大表示行数 (標準 4〜5 行)
   * @param {number} [options.fadeTimeoutMs=4500] - 自動フェードアウトまでの時間 (ミリ秒)
   * @param {Document} [options.document] - DOM ドキュメントオブジェクト
   */
  constructor({ container, maxLines = 5, fadeTimeoutMs = 4500, document: doc = null } = {}) {
    this.container = container;
    this.maxLines = maxLines;
    this.fadeTimeoutMs = fadeTimeoutMs;
    this.document = doc || (typeof document !== 'undefined' ? document : null);
    this.lines = []; // Array<{ id, element, timer, isBold }>
    this.currentLanguage = 'ja';
  }

  /**
   * 最大表示行数の変更
   * @param {number} num
   */
  setMaxLines(num) {
    this.maxLines = Math.max(1, Math.min(10, num));
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

    // 同一メッセージがすでにキューの末尾にある場合の連続重複処理（必要に応じて更新のみ）
    const lastLine = this.lines.length > 0 ? this.lines[this.lines.length - 1] : null;
    if (lastLine && lastLine.id === id) {
      this.updateMessage({ id, text, isBold, attr });
      return;
    }

    const lineEl = this.document.createElement('div');
    lineEl.className = 'floating-message-line' + (isBold ? ' bold' : '');
    lineEl.dataset.messageId = String(id);
    lineEl.textContent = text;

    this.container.appendChild(lineEl);

    const lineEntry = {
      id,
      element: lineEl,
      isBold: Boolean(isBold),
      timer: null
    };

    // 自動フェードアウトのタイマー設定
    if (this.fadeTimeoutMs > 0) {
      lineEntry.timer = setTimeout(() => {
        this._fadeLine(lineEntry);
      }, this.fadeTimeoutMs);
    }

    this.lines.push(lineEntry);

    // 最大行数を超えた古い行をフェードアウトまたは即削除
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

    // 更新された場合はタイマーをリセットして再延長
    if (entry.timer) clearTimeout(entry.timer);
    if (this.fadeTimeoutMs > 0) {
      entry.timer = setTimeout(() => {
        this._fadeLine(entry);
      }, this.fadeTimeoutMs);
    }
  }

  /**
   * ターン経過時に直前のメッセージを速やかにフェードアウトへ移行
   */
  onTurnPassed() {
    for (const entry of this.lines) {
      if (entry.element && !entry.element.classList.contains('fading')) {
        entry.element.classList.add('fading-fast');
      }
    }
  }

  /**
   * 全メッセージのフェードアウト
   */
  fadeAll() {
    for (const entry of this.lines) {
      this._fadeLine(entry);
    }
  }

  /**
   * 全メッセージの即時消去
   */
  clear() {
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
    if (!entry || !entry.element) return;
    entry.element.classList.add('fading');
    setTimeout(() => {
      if (entry.element && entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
      const idx = this.lines.indexOf(entry);
      if (idx !== -1) {
        this.lines.splice(idx, 1);
        this._updateLineAges();
      }
    }, 400);
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
  }
}
