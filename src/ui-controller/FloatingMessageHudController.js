/**
 * FloatingMessageHudController.js
 *
 * 全画面マップ上に最新メッセージを透過表示するフローティング HUD の
 * キュー管理・世代判定・フェードアウト状態遷移を司る Headless コントローラー。
 * DOM非依存。
 */

export const LINE_STATE = {
  ACTIVE: 'active',
  STALE: 'stale',
  FADING: 'fading'
};

export class FloatingMessageHudController {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxLines=5] - 最大表示行数 (標準 4〜5 行)
   * @param {number} [options.fadeTimeoutMs=0] - 受信時の自動フェードアウト時間 (0: 操作起点モード)
   * @param {number} [options.fadeDelayAfterActionMs=2500] - 操作後フェード開始待機時間
   */
  constructor({ maxLines = 5, fadeTimeoutMs = 0, fadeDelayAfterActionMs = 2500 } = {}) {
    this.maxLines = Math.max(1, Math.min(10, maxLines));
    this.fadeTimeoutMs = fadeTimeoutMs;
    this.fadeDelayAfterActionMs = fadeDelayAfterActionMs;

    /** @type {Array<{ id: number, text: string, rawText?: string, isBold: boolean, attr?: number, state: string, age: number, timer: any }>} */
    this.lines = [];
    this.listeners = new Set();
  }

  /**
   * 最大表示行数の変更
   * @param {number} num
   */
  setMaxLines(num) {
    this.maxLines = Math.max(1, Math.min(10, num));
    while (this.lines.length > this.maxLines) {
      const oldest = this.lines.shift();
      if (oldest && oldest.timer) clearTimeout(oldest.timer);
    }
    this._updateLineAges();
    this._notify('maxLinesChanged');
  }

  /**
   * 操作後フェード開始待機時間の変更
   * @param {number} ms
   */
  setFadeDelayAfterActionMs(ms) {
    if (typeof ms === 'number' && !Number.isNaN(ms)) {
      this.fadeDelayAfterActionMs = Math.max(0, ms);
    }
  }

  /**
   * 現在の行リストを取得（世代 age 付き）
   */
  getLines() {
    return this.lines.map(line => ({ ...line }));
  }

  /**
   * 各行の新旧世代（0: 最新行, 1: 1つ前 ...）を更新
   * @private
   */
  _updateLineAges() {
    const total = this.lines.length;
    this.lines.forEach((entry, idx) => {
      entry.age = Math.min(total - 1 - idx, 4);
    });
  }

  /**
   * 最新メッセージを追加
   * @param {Object} messageItem
   */
  pushMessage({ id, text, rawText, isBold = false, attr = 0 }) {
    if (!text) return null;

    // 同一メッセージがすでにキューの末尾にある場合の連続重複処理
    const lastLine = this.lines.length > 0 ? this.lines[this.lines.length - 1] : null;
    if (lastLine && lastLine.id === id) {
      return this.updateMessage({ id, text, rawText, isBold, attr });
    }

    const lineEntry = {
      id,
      text,
      rawText,
      isBold: Boolean(isBold),
      attr: attr || 0,
      state: LINE_STATE.ACTIVE,
      age: 0,
      timer: null
    };

    if (this.fadeTimeoutMs > 0) {
      lineEntry.timer = setTimeout(() => {
        this.fadeLine(lineEntry.id);
      }, this.fadeTimeoutMs);
    }

    this.lines.push(lineEntry);

    while (this.lines.length > this.maxLines) {
      const oldest = this.lines.shift();
      if (oldest && oldest.timer) clearTimeout(oldest.timer);
    }

    this._updateLineAges();
    this._notify('push', lineEntry);
    return lineEntry;
  }

  /**
   * 既存メッセージの文面・属性更新
   * @param {Object} messageItem
   */
  updateMessage(messageItem) {
    if (!messageItem) return null;

    const entry = this.lines.find(l => l.id === messageItem.id);
    if (!entry) return null;

    if (messageItem.text) {
      entry.text = messageItem.text;
    }
    if (messageItem.rawText !== undefined) {
      entry.rawText = messageItem.rawText;
    }
    if (messageItem.isBold !== undefined) {
      entry.isBold = Boolean(messageItem.isBold);
    }
    if (messageItem.attr !== undefined) {
      entry.attr = messageItem.attr;
    }

    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.state = LINE_STATE.ACTIVE;

    if (this.fadeTimeoutMs > 0) {
      entry.timer = setTimeout(() => {
        this.fadeLine(entry.id);
      }, this.fadeTimeoutMs);
    }

    this._notify('update', entry);
    return entry;
  }

  /**
   * ユーザー操作通知によるライフサイクル進行
   */
  notifyUserAction() {
    for (const entry of [...this.lines]) {
      if (entry.state === LINE_STATE.ACTIVE) {
        entry.state = LINE_STATE.STALE;
        if (entry.timer) clearTimeout(entry.timer);

        if (this.fadeDelayAfterActionMs > 0) {
          entry.timer = setTimeout(() => {
            this.fadeLine(entry.id);
          }, this.fadeDelayAfterActionMs);
        } else {
          this.fadeLine(entry.id);
        }
      } else if (entry.state === LINE_STATE.STALE) {
        this.fadeLine(entry.id);
      }
    }
    this._notify('userAction');
  }

  /**
   * 指定メッセージ行をフェードアウト状態へ移行
   * @param {number} id
   */
  fadeLine(id) {
    const entry = this.lines.find(l => l.id === id);
    if (!entry || entry.state === LINE_STATE.FADING) return;

    entry.state = LINE_STATE.FADING;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    this._notify('fade', entry);
  }

  /**
   * フェード完了による配列からの削除
   * @param {number} id
   */
  removeLine(id) {
    const idx = this.lines.findIndex(l => l.id === id);
    if (idx !== -1) {
      const removed = this.lines.splice(idx, 1)[0];
      if (removed.timer) clearTimeout(removed.timer);
      this._updateLineAges();
      this._notify('remove', removed);
    }
  }

  /**
   * 全メッセージのフェードアウト
   */
  fadeAll() {
    for (const entry of this.lines) {
      this.fadeLine(entry.id);
    }
  }

  /**
   * 全メッセージの即時消去
   */
  clear() {
    for (const entry of this.lines) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    this.lines = [];
    this._notify('clear');
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify(type, data = null) {
    for (const listener of this.listeners) {
      try {
        listener(type, data, this.getLines());
      } catch (err) {
        console.error('[FloatingMessageHudController] Listener error', err);
      }
    }
  }
}
