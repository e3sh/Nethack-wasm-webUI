import { tokenKnowledgeResolver } from '../../../../src/core/message/TokenKnowledgeResolver.js';
/**
 * MessageHistoryDrawer.js
 *
 * 過去メッセージ全履歴をスライドイン表示する展開型ドロワーコンポーネント。
 * - NetHack 伝統の Ctrl+P キー、ヘッダーボタン、またはマウスホイール上スクロールで展開
 * - 3大表示モード: [ 🔀 並列 (Bilingual) | 🇯🇵 日本語 | 🇺🇸 原文 (Raw) ]
 * - 世代別透明度グラデーション (最新行 100% 〜 過去行 40%)
 * - ワンタップ原文コピー機能 (海外Wiki / Spoilers 検索を爆速化)
 */

export class MessageHistoryDrawer {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.drawerElement - ドロワー外枠要素
   * @param {HTMLElement} options.listElement - メッセージ一覧コンテナ要素
   * @param {HTMLElement} [options.backdropElement] - 背景オーバーレイ要素
   * @param {HTMLElement} [options.btnClose] - 閉じるボタン
   * @param {HTMLElement} [options.btnPin] - ピン留め（左側常時固定）ボタン
   * @param {HTMLElement} [options.btnModeBilingual] - 並列表示ボタン
   * @param {HTMLElement} [options.btnModeJa] - 日本語のみボタン
   * @param {HTMLElement} [options.btnModeRaw] - 原文のみボタン
   * @param {Function} [options.onPinStateChanged] - ピン留め状態変更時コールバック
   * @param {Function} options.getCore - WebUICore インスタンス取得関数
   * @param {Document} [options.document] - DOM ドキュメント
   */
  constructor({
    drawerElement,
    listElement,
    backdropElement,
    btnClose,
    btnPin,
    btnModeBilingual,
    btnModeJa,
    btnModeRaw,
    modeToggleElement,
    titleElement,
    language = 'ja',
    onPinStateChanged,
    getCore,
    knowledgeModal,
    knowledgeCard,
    getKnowledgeModal,
    getKnowledgeCard,
    onTokenClick,
    tokenResolver,
    document: doc = null
  } = {}) {
    this.drawerElement = drawerElement;
    this.listElement = listElement;
    this.backdropElement = backdropElement;
    this.btnClose = btnClose;
    this.btnPin = btnPin;
    this.btnModeBilingual = btnModeBilingual;
    this.btnModeJa = btnModeJa;
    this.btnModeRaw = btnModeRaw;
    this.modeToggleElement = modeToggleElement || (this.btnModeBilingual ? this.btnModeBilingual.parentElement : null);
    this.titleElement = titleElement || (this.drawerElement?.querySelector ? this.drawerElement.querySelector('.drawer-title-text') : null);
    this.onPinStateChanged = onPinStateChanged || null;
    this.getCore = getCore || (() => null);
    this.knowledgeModal = knowledgeModal || null;
    this.knowledgeCard = knowledgeCard || null;
    this.getKnowledgeModal = getKnowledgeModal || (() => null);
    this.getKnowledgeCard = getKnowledgeCard || (() => null);
    this.onTokenClick = onTokenClick || null;
    this.tokenResolver = tokenResolver || tokenKnowledgeResolver;
    this.document = doc || (typeof document !== 'undefined' ? document : null);
    this._injectStyles();

    this.displayMode = language === 'en' ? 'raw' : 'bilingual'; // 'bilingual' | 'ja' | 'raw'
    this.currentLanguage = language;
    this._isOpen = false;
    this.isPinned = false;

    this.initEvents();
    this.setLanguage(language);
  }

  initEvents() {
    if (this.btnClose) {
      this.btnClose.onclick = (e) => {
        e.stopPropagation();
        this.close();
      };
    }

    if (this.btnPin) {
      this.btnPin.onclick = (e) => {
        e.stopPropagation();
        this.togglePin();
      };
    }

    if (this.backdropElement) {
      this.backdropElement.onclick = (e) => {
        e.stopPropagation();
        this.close();
      };
    }

    if (this.btnModeBilingual) {
      this.btnModeBilingual.onclick = () => this.setDisplayMode('bilingual');
    }
    if (this.btnModeJa) {
      this.btnModeJa.onclick = () => this.setDisplayMode('ja');
    }
    if (this.btnModeRaw) {
      this.btnModeRaw.onclick = () => this.setDisplayMode('raw');
    }
  }

  /**
   * ドロワーを開く
   */
  open() {
    if (!this.drawerElement) return;
    this._isOpen = true;
    this.drawerElement.classList.remove('hidden');
    this.drawerElement.classList.add('open');

    if (this.isPinned) {
      this.drawerElement.classList.add('docked-left');
      if (this.backdropElement) {
        this.backdropElement.classList.remove('open');
        this.backdropElement.classList.add('hidden');
      }
    } else {
      this.drawerElement.classList.remove('docked-left');
      if (this.backdropElement) {
        this.backdropElement.classList.remove('hidden');
        this.backdropElement.classList.add('open');
      }
    }

    this.updateModeButtonStates();
    this.renderList({ forceScrollToBottom: true });
    this.scrollToBottom(false);
  }

  /**
   * ドロワーを閉じる (ピン留めもOFFに復帰)
   */
  close() {
    if (!this.drawerElement) return;
    this._isOpen = false;

    if (this.isPinned) {
      this.isPinned = false;
      if (this.btnPin) this.btnPin.classList.remove('active');
      this.drawerElement.classList.remove('docked-left');
      if (this.onPinStateChanged) this.onPinStateChanged(false);
    }

    this.drawerElement.classList.remove('open');
    if (this.backdropElement) {
      this.backdropElement.classList.remove('open');
    }
    setTimeout(() => {
      if (!this._isOpen) {
        this.drawerElement.classList.add('hidden');
        if (this.backdropElement) {
          this.backdropElement.classList.add('hidden');
        }
      }
    }, 250);
  }

  /**
   * ピン留め (画面左側に常時固定 / 出しっぱなし) のトグル
   */
  togglePin() {
    this.setPinned(!this.isPinned);
  }

  /**
   * ピン留め状態を明示設定
   * @param {boolean} pinned
   * @param {boolean} [silent=false] - true の場合は onPinStateChanged を発火しない (外部同期用)
   */
  setPinned(pinned, silent = false) {
    const nextPinned = Boolean(pinned);
    if (this.isPinned === nextPinned) {
      this.applyPinState();
      return;
    }
    this.isPinned = nextPinned;
    this.applyPinState();
    if (!silent && this.onPinStateChanged) {
      this.onPinStateChanged(this.isPinned);
    }
  }

  /**
   * 現在のピン留め状態をUI・DOMへ反映
   */
  applyPinState() {
    if (this.btnPin) {
      this.btnPin.classList.toggle('active', this.isPinned);
    }
    if (this.drawerElement) {
      this.drawerElement.classList.toggle('docked-left', this.isPinned);
    }

    if (this.isPinned) {
      if (this.backdropElement) {
        this.backdropElement.classList.remove('open');
        this.backdropElement.classList.add('hidden');
      }
      if (!this._isOpen) {
        this.open();
      }
    } else {
      if (this._isOpen && this.backdropElement) {
        this.backdropElement.classList.remove('hidden');
        this.backdropElement.classList.add('open');
      }
    }
  }

  /**
   * 開閉トグル
   */
  toggle() {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  isOpen() {
    return this._isOpen;
  }

  /**
   * 表示モード切替
   * @param {'bilingual'|'ja'|'raw'} mode
   */
  setDisplayMode(mode) {
    if (!['bilingual', 'ja', 'raw'].includes(mode)) return;
    this.displayMode = mode;
    this.updateModeButtonStates();
    this.renderList();
  }

  updateModeButtonStates() {
    if (this.btnModeBilingual) {
      this.btnModeBilingual.classList.toggle('active', this.displayMode === 'bilingual');
    }
    if (this.btnModeJa) {
      this.btnModeJa.classList.toggle('active', this.displayMode === 'ja');
    }
    if (this.btnModeRaw) {
      this.btnModeRaw.classList.toggle('active', this.displayMode === 'raw');
    }
  }

  /**
   * メッセージ一覧のレンダリング
   */
  /**
   * メッセージ一覧のレンダリング
   * @param {Object} [options]
   * @param {boolean} [options.forceScrollToBottom=false] - 強制的に最下部へスクロール
   */
  renderList({ forceScrollToBottom = false } = {}) {
    if (!this.listElement || !this.document) return;

    // ユーザーが最下部付近にいるか判定 (意図的に上スクロールしている場合は維持)
    const scrollHeight = this.listElement.scrollHeight || 0;
    const scrollTop = this.listElement.scrollTop || 0;
    const clientHeight = this.listElement.clientHeight || 0;
    const wasNearBottom = (scrollHeight - scrollTop - clientHeight) <= 100;

    this.listElement.innerHTML = '';

    const core = this.getCore();
    const items = core && typeof core.getMessageItems === 'function' ? core.getMessageItems() : [];

    if (!items || items.length === 0) {
      const emptyEl = this.document.createElement('div');
      emptyEl.className = 'drawer-empty-msg';
      emptyEl.textContent = this.currentLanguage === 'en' ? 'No message history yet.' : 'メッセージ履歴はありません。';
      this.listElement.appendChild(emptyEl);
      return;
    }

    const totalCount = items.length;

    items.forEach((item, index) => {
      // 世代別透明度グラデーションの計算
      const revIndex = totalCount - 1 - index;
      let ageClass = 'age-older';
      if (item.isLatest || revIndex === 0) {
        ageClass = 'age-latest';
      } else if (revIndex <= 2) {
        ageClass = 'age-recent';
      } else if (revIndex <= 5) {
        ageClass = 'age-medium';
      }

      const rowEl = this.document.createElement('div');
      rowEl.className = `drawer-msg-item ${ageClass}` + (item.isBold ? ' is-bold' : '');
      rowEl.dataset.messageId = String(item.id);

      const contentBox = this.document.createElement('div');
      contentBox.className = 'drawer-msg-content';

      const jaText = item.text || item.rawText || '';
      const rawText = item.rawText || item.text || '';

      if (this.displayMode === 'bilingual') {
        const jaEl = this.document.createElement('div');
        jaEl.className = 'drawer-msg-text-ja';
        this.renderContentWithTokens(jaEl, jaText, item.tokens, true);
        contentBox.appendChild(jaEl);

        if (rawText && rawText !== jaText) {
          const rawEl = this.document.createElement('div');
          rawEl.className = 'drawer-msg-text-raw';
          this.renderContentWithTokens(rawEl, rawText, item.tokens, false);
          contentBox.appendChild(rawEl);
        }
      } else if (this.displayMode === 'ja') {
        const jaEl = this.document.createElement('div');
        jaEl.className = 'drawer-msg-text-ja';
        this.renderContentWithTokens(jaEl, jaText, item.tokens, true);
        contentBox.appendChild(jaEl);
      } else if (this.displayMode === 'raw') {
        const rawEl = this.document.createElement('div');
        rawEl.className = 'drawer-msg-text-raw primary';
        this.renderContentWithTokens(rawEl, rawText, item.tokens, false);
        contentBox.appendChild(rawEl);
      }

      rowEl.appendChild(contentBox);

      // コピーボタン
      const btnCopy = this.document.createElement('button');
      btnCopy.className = 'btn-drawer-copy';
      btnCopy.title = this.currentLanguage === 'en' ? 'Copy raw English message' : '英語原文をコピー (Wiki検索等)';
      btnCopy.textContent = '📋';
      btnCopy.onclick = (e) => {
        e.stopPropagation();
        this.copyRawText(rawText, btnCopy);
      };

      rowEl.appendChild(btnCopy);
      this.listElement.appendChild(rowEl);
    });

    // 最新メッセージへの自動スクロール追従
    if (forceScrollToBottom || wasNearBottom) {
      this.scrollToBottom();
    }
  }

  /**
   * メッセージリストの最下部へスクロール
   * @param {boolean} [smooth=false]
   */
  scrollToBottom(smooth = false) {
    if (!this.listElement) return;
    if (typeof this.listElement.scrollTo === 'function') {
      try {
        this.listElement.scrollTo({
          top: this.listElement.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
        return;
      } catch {}
    }
    this.listElement.scrollTop = this.listElement.scrollHeight;
  }

  /**
   * 原文テキストをクリップボードにコピー
   * @param {string} text
   * @param {HTMLElement} [triggerBtn]
   */
  async copyRawText(text, triggerBtn) {
    if (!text) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
      if (triggerBtn) {
        const originalText = triggerBtn.textContent;
        triggerBtn.textContent = '✅';
        setTimeout(() => {
          triggerBtn.textContent = originalText;
        }, 1200);
      }
    } catch (err) {
      console.warn('[MessageHistoryDrawer] Failed to copy to clipboard:', err);
    }
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    const isEn = lang === 'en';

    if (this.btnPin) {
      this.btnPin.title = isEn ? 'Dock to left (Keep open)' : '画面左側に常時固定 (ピン留め)';
    }
    if (this.btnClose) {
      this.btnClose.title = isEn ? 'Close [ESC]' : '閉じる [ESC]';
    }
    if (this.titleElement) {
      this.titleElement.textContent = isEn ? 'Message History' : 'メッセージ過去ログ (Message History)';
    }

    if (this.btnModeBilingual) {
      this.btnModeBilingual.textContent = isEn ? '🔀 Bilingual' : '🔀 並列';
      this.btnModeBilingual.title = isEn ? 'Show Japanese and original text in parallel' : '日本語と原文を並列表示';
    }
    if (this.btnModeJa) {
      this.btnModeJa.textContent = isEn ? '🇯🇵 Japanese' : '🇯🇵 日本語';
      this.btnModeJa.title = isEn ? 'Show Japanese only' : '日本語のみ表示';
    }
    if (this.btnModeRaw) {
      this.btnModeRaw.textContent = isEn ? '🇺🇸 Raw' : '🇺🇸 原文';
      this.btnModeRaw.title = isEn ? 'Show original English text only' : '英語原文のみ表示';
    }

    if (this.modeToggleElement) {
      if (isEn) {
        this.modeToggleElement.classList.add('hidden');
        this.displayMode = 'raw';
      } else {
        this.modeToggleElement.classList.remove('hidden');
        if (this.displayMode === 'raw') {
          this.displayMode = 'bilingual';
        }
      }
      this.updateModeButtonStates();
    } else if (isEn) {
      this.displayMode = 'raw';
      this.updateModeButtonStates();
    }

    if (this._isOpen) {
      this.renderList();
    }
  }

  /**
   * トークン要素を含むテキスト描画
   * @param {HTMLElement} container
   * @param {string} text 表示テキスト
   * @param {Array<Object>} tokens MessageToken[]
   * @param {boolean} [isJa=false] 日本語文か
   */
  renderContentWithTokens(container, text, tokens, isJa = false) {
    if (!tokens || !tokens.length || !tokens.some(t => t.interactive)) {
      container.textContent = text;
      return;
    }

    if (!isJa) {
      // 🇺🇸 英語原文: tokens の range スライスを忠実に配置
      container.innerHTML = '';
      for (const t of tokens) {
        if (!t.interactive) {
          container.appendChild(this.document.createTextNode(t.text));
        } else {
          const span = this._createTokenElement(t);
          container.appendChild(span);
        }
      }
      return;
    }

    // 🇯🇵 日本語文: tokens 内の interactive トークンに対応する和名を探索・置換
    container.innerHTML = '';
    const interactiveTokens = tokens.filter(t => t.interactive);
    const replacements = [];

    for (const t of interactiveTokens) {
      const nameJa = this.tokenResolver?.getJapaneseName(t);
      if (nameJa && text.includes(nameJa)) {
        replacements.push({ nameJa, token: t });
      }
    }

    if (replacements.length === 0) {
      container.textContent = text;
      return;
    }

    // 和名の長い順（部分一致衝突防止）でソート
    replacements.sort((a, b) => b.nameJa.length - a.nameJa.length);

    const pieces = [{ text, token: null }];

    for (const { nameJa, token } of replacements) {
      const nextPieces = [];
      for (const piece of pieces) {
        if (piece.token !== null) {
          nextPieces.push(piece);
          continue;
        }
        const parts = piece.text.split(nameJa);
        for (let i = 0; i < parts.length; i++) {
          if (parts[i]) {
            nextPieces.push({ text: parts[i], token: null });
          }
          if (i < parts.length - 1) {
            nextPieces.push({ text: nameJa, token });
          }
        }
      }
      pieces.length = 0;
      pieces.push(...nextPieces);
    }

    for (const piece of pieces) {
      if (piece.token) {
        const span = this._createTokenElement(piece.token, piece.text);
        container.appendChild(span);
      } else {
        container.appendChild(this.document.createTextNode(piece.text));
      }
    }
  }

  /**
   * インタラクティブなトークン DOM 要素を生成
   */
  _createTokenElement(token, displayText = null) {
    const span = this.document.createElement('span');
    span.className = 'nh-token token-' + token.type;
    span.tabIndex = 0;
    span.setAttribute('role', 'button');
    span.setAttribute('aria-label', 'Look up ' + token.text);
    span.textContent = displayText || token.text;

    span.onclick = (e) => {
      e.stopPropagation();
      this.handleTokenActivation(token);
    };

    span.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this.handleTokenActivation(token);
      }
    };

    return span;
  }

  /**
   * トークン選択時（クリック / Enter / Gamepad Aボタン）の遅延解決と図鑑起動
   */
  handleTokenActivation(token) {
    if (!token) return;
    const core = this.getCore();
    const gkl = core?.gkl;

    const knowledge = this.tokenResolver
      ? this.tokenResolver.resolveTokenKnowledge(token, gkl, { language: this.currentLanguage })
      : null;

    console.log('[MessageHistoryDrawer] Token activated:', token.text, 'Resolved knowledge:', knowledge);

    if (typeof this.onTokenClick === 'function') {
      this.onTokenClick(token, knowledge);
    }

    if (knowledge) {
      const modal = this.knowledgeModal || (typeof this.getKnowledgeModal === 'function' ? this.getKnowledgeModal() : null);
      const card = this.knowledgeCard || (typeof this.getKnowledgeCard === 'function' ? this.getKnowledgeCard() : null);

      if (modal && typeof modal.open === 'function') {
        modal.open(knowledge);
      } else if (card && typeof card.setTarget === 'function') {
        card.setTarget(knowledge);
      } else if (typeof window !== 'undefined' && window.app?.knowledgeDetailModal && typeof window.app.knowledgeDetailModal.open === 'function') {
        window.app.knowledgeDetailModal.open(knowledge);
      } else {
        const domCard = this.document?.querySelector('nh-knowledge-card');
        if (domCard && typeof domCard.setTarget === 'function') {
          domCard.setTarget(knowledge);
        }
      }
    }
  }

  /**
   * ゲームパッド A ボタンまたはボタン入力時のフォーカストークン起動
   */
  handleGamepadButton(buttonIndex) {
    if (!this._isOpen) return false;
    // Aボタン (buttonIndex === 0)
    if (buttonIndex === 0) {
      const activeEl = this.document?.activeElement;
      if (activeEl && activeEl.classList && activeEl.classList.contains('nh-token')) {
        activeEl.click();
        return true;
      }
    }
    return false;
  }

  /**
   * トークン用ハイライトスタイルの自動注入
   */
  _injectStyles() {
    if (!this.document || !this.document.head || typeof this.document.getElementById !== 'function') {
      return;
    }
    if (this.document.getElementById('nh-token-drawer-styles')) {
      return;
    }
    const styleEl = this.document.createElement('style');
    styleEl.id = 'nh-token-drawer-styles';
    styleEl.textContent = ".nh-token { display: inline; cursor: pointer; border-radius: 3px; padding: 0 2px; font-weight: 600; text-decoration: underline dotted 1px; transition: all 0.15s ease; }\n.nh-token.token-monster { color: #e5c07b; border-bottom: 1px dashed #e5c07b; }\n.nh-token.token-monster:hover, .nh-token.token-monster:focus-visible { background: rgba(229, 192, 123, 0.2); outline: 2px solid #e5c07b; outline-offset: 1px; }\n.nh-token.token-item { color: #56b6c2; border-bottom: 1px dashed #56b6c2; }\n.nh-token.token-item:hover, .nh-token.token-item:focus-visible { background: rgba(86, 182, 194, 0.2); outline: 2px solid #56b6c2; outline-offset: 1px; }";
    this.document.head.appendChild(styleEl);
  }
}
