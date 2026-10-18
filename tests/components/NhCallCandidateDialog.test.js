import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import { NhCallCandidateDialog } from '../../src/components/NhCallCandidateDialog.js';

describe('NhCallCandidateDialog (<nh-call-candidate-dialog>) (ROADMAP §2.1 / Gap 2)', () => {
    let restoreDom;

    beforeEach(() => {
        restoreDom = setupMockDom();
    });

    afterEach(() => {
        if (restoreDom) restoreDom();
    });

    it('1. 初期状態（非オープン）ではオーバーレイが空であること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();

        expect(dialog.open).toBe(false);
        expect(dialog.shadowRoot.innerHTML).toContain('<div class="dialog-overlay"></div>');
    });

    it('2. show() または open = true で対象アイテム情報、ショートハンド、候補リストが描画されること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();

        dialog.setData({
            targetName: 'ruby potion',
            targetCategory: 'POTION',
            currentCall: '100G?',
            shorthands: ['100G?', 'healing?', 'extra healing?'],
            candidates: [
                { onum: 310, name: 'potion of healing', nameJa: '回復の薬', cost: 100, shorthand: 'healing?' },
                { onum: 311, name: 'potion of extra healing', nameJa: '超回復の薬', cost: 100, shorthand: 'extra healing?' }
            ]
        });
        dialog.show();

        expect(dialog.open).toBe(true);
        const html = dialog.shadowRoot.innerHTML;
        expect(html).toContain('ruby potion');
        expect(html).toContain('(POTION)');
        expect(html).toContain('現在の仮名');
        expect(html).toContain('100G?');
        expect(html).toContain('healing?');
        expect(html).toContain('potion of healing');
        expect(html).toContain('回復の薬');
        expect(html).toContain('❌ 命名を解除 (クリア)');
    });

    it('3. ショートハンドチップのクリックで nh-call-submit イベントが発火すること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();

        dialog.setData({
            targetName: 'ruby potion',
            shorthands: ['healing?'],
            candidates: []
        });
        dialog.show();

        const submitSpy = vi.fn();
        dialog.addEventListener('nh-call-submit', submitSpy);

        const chip = dialog.shadowRoot.querySelector('.shorthand-chip');
        expect(chip).not.toBeNull();
        chip.click();

        expect(submitSpy).toHaveBeenCalledTimes(1);
        expect(submitSpy.mock.calls[0][0].detail.name).toBe('healing?');
        expect(dialog.open).toBe(false);
    });

    it('4. クリア（命名解除）の選択で空文字が submit されること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();

        dialog.setData({
            targetName: 'silver wand',
            candidates: [
                { onum: 200, name: 'wand of digging', cost: 150, shorthand: 'digging?' }
            ]
        });
        dialog.show();

        const submitSpy = vi.fn();
        dialog.addEventListener('nh-call-submit', submitSpy);

        const clearItem = dialog.shadowRoot.querySelector('.candidate-clear-item');
        expect(clearItem).not.toBeNull();
        clearItem.click();

        expect(submitSpy).toHaveBeenCalledTimes(1);
        expect(submitSpy.mock.calls[0][0].detail.name).toBe('');
    });

    it('5. キーボードナビゲーション (ArrowDown / ArrowUp / Enter / Escape) が動作すること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();

        dialog.setData({
            targetName: 'ruby potion',
            shorthands: ['100G?'],
            candidates: [
                { onum: 310, name: 'potion of healing', cost: 100, shorthand: 'healing?' }
            ]
        });
        dialog.show();

        const submitSpy = vi.fn();
        dialog.addEventListener('nh-call-submit', submitSpy);

        // 初期インデックスは 0 (shorthand '100G?')
        expect(dialog._focusedIndex).toBe(0);

        // ArrowDown (または 'j') で次へ (クリア項目)
        dialog._handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(dialog._focusedIndex).toBe(1);

        // 再度 ArrowDown で候補アイテムへ
        dialog._handleKeyDown({ key: 'j', preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(dialog._focusedIndex).toBe(2);

        // Enter で決定 (真名リストからの選択なので正式名が送信される)
        dialog._handleKeyDown({ key: 'Enter', preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(submitSpy).toHaveBeenCalledTimes(1);
        expect(submitSpy.mock.calls[0][0].detail.name).toBe('potion of healing');
    });

    it('6. Escape キーで nh-call-cancel が発火し、ダイアログが閉じること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();
        dialog.show();

        const cancelSpy = vi.fn();
        dialog.addEventListener('nh-call-cancel', cancelSpy);

        dialog._handleKeyDown({ key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(cancelSpy).toHaveBeenCalledTimes(1);
        expect(dialog.open).toBe(false);
    });

    it('7. ゲームパッド操作 (handleGamepadButton) が動作すること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();

        dialog.setData({
            targetName: 'ruby potion',
            shorthands: ['100G?'],
            candidates: [
                { onum: 310, name: 'potion of healing', cost: 100, shorthand: 'healing?' }
            ]
        });
        dialog.show();

        const submitSpy = vi.fn();
        dialog.addEventListener('nh-call-submit', submitSpy);

        // D-Pad DOWN
        dialog.handleGamepadButton('DOWN');
        expect(dialog._focusedIndex).toBe(1);

        // Button A (決定: クリア項目)
        dialog.handleGamepadButton('A');
        expect(submitSpy).toHaveBeenCalledTimes(1);
        expect(submitSpy.mock.calls[0][0].detail.name).toBe('');
    });

    it('8. artifact_name モードでアーティファクト個別命名のタイトル・属性バッジ・効果が表示され、submit できること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();

        dialog.setData({
            mode: 'artifact_name',
            targetName: 'long sword',
            targetCategory: 'WEAPON',
            currentCall: '',
            candidates: [
                {
                    name: 'Excalibur',
                    nameJa: 'エクスカリバー',
                    baseName: 'long sword',
                    baseOnum: 54,
                    alignment: 'LAWFUL',
                    role: 'knight',
                    isQuestArtifact: false,
                    isRecommended: true,
                    attackEffect: '追加物理(+1d10)'
                },
                {
                    name: 'The Orb of Detection',
                    nameJa: '探索の宝珠',
                    baseName: 'crystal ball',
                    baseOnum: 231,
                    alignment: 'LAWFUL',
                    role: 'archeologist',
                    isQuestArtifact: true,
                    isRecommended: false
                }
            ]
        });
        dialog.show();

        expect(dialog.mode).toBe('artifact_name');
        const html = dialog.shadowRoot.innerHTML;
        expect(html).toContain('アーティファクト銘');
        expect(html).toContain('Excalibur');
        expect(html).toContain('エクスカリバー');
        expect(html).toContain('LAWFUL');
        expect(html).toContain('knight');
        expect(html).toContain('推奨');
        expect(html).toContain('QUEST');
        expect(html).toContain('追加物理(+1d10)');
        expect(html).toContain('愛称・銘を入力');

        const submitSpy = vi.fn();
        dialog.addEventListener('nh-call-submit', submitSpy);

        // 候補リストの先頭（Excalibur）をクリック（clear項目の次のアイテム）
        const candItems = dialog.shadowRoot.querySelectorAll('.candidate-item');
        // candItems[0] は clear 項目、candItems[1] が Excalibur
        expect(candItems.length).toBe(3);
        candItems[1].click();

        expect(submitSpy).toHaveBeenCalledTimes(1);
        const detail = submitSpy.mock.calls[0][0].detail;
        expect(detail.name).toBe('Excalibur');
        expect(detail.onum).toBe(54);
        expect(detail.mode).toBe('artifact_name');
    });

    it('9. DOM上の要素順序と data-idx の順序が上から下へ一致していること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();

        dialog.setData({
            targetName: 'ruby potion',
            shorthands: ['100G?', 'healing?'],
            candidates: [
                { onum: 310, name: 'potion of healing', cost: 100 },
                { onum: 311, name: 'potion of extra healing', cost: 100 }
            ]
        });
        dialog.show();

        const root = dialog.shadowRoot;
        // shorthand-chip (2個), candidate-clear-item (1個), candidate-item (2個), custom-input (1個)
        const allNavElements = root.querySelectorAll('.shorthand-chip, .candidate-item, .custom-input');
        const indices = allNavElements.map(el => parseInt(el.getAttribute('data-idx'), 10));

        // 期待される順序: [0, 1, 2, 3, 4, 5]
        expect(indices).toEqual([0, 1, 2, 3, 4, 5]);

        // 各要素の種別と配置順の検証
        expect(allNavElements[0].classList.contains('shorthand-chip')).toBe(true);
        expect(allNavElements[1].classList.contains('shorthand-chip')).toBe(true);
        expect(allNavElements[2].classList.contains('candidate-clear-item')).toBe(true);
        expect(allNavElements[3].classList.contains('candidate-item')).toBe(true);
        expect(allNavElements[4].classList.contains('candidate-item')).toBe(true);
        expect(allNavElements[5].classList.contains('custom-input')).toBe(true);
    });

    it('10. マウスホバー（mouseenter）時に、ホバーした要素の data-idx のみに .is-focused が付与され、他の要素と二重に .is-focused が付かないこと', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();

        dialog.setData({
            targetName: 'ruby potion',
            shorthands: ['100G?'],
            candidates: [
                { onum: 310, name: 'potion of healing', cost: 100 },
                { onum: 311, name: 'potion of extra healing', cost: 100 }
            ]
        });
        dialog.show();

        const root = dialog.shadowRoot;
        const allNavElements = root.querySelectorAll('.shorthand-chip, .candidate-item, .custom-input');

        // 初期状態: data-idx=0 のみ is-focused
        expect(allNavElements[0].classList.contains('is-focused')).toBe(true);
        expect(allNavElements[1].classList.contains('is-focused')).toBe(false);

        // cand1 (data-idx=2) にマウスホバー
        allNavElements[2].dispatchEvent({ type: 'mouseenter' });

        expect(dialog._focusedIndex).toBe(2);
        // data-idx=2 の要素のみに is-focused が付与されていること
        expect(allNavElements[2].classList.contains('is-focused')).toBe(true);
        // 直前（1段上）のクリア項目 (data-idx=1) や先頭のショートハンド (data-idx=0) には付いていないこと
        expect(allNavElements[1].classList.contains('is-focused')).toBe(false);
        expect(allNavElements[0].classList.contains('is-focused')).toBe(false);
        expect(allNavElements[3].classList.contains('is-focused')).toBe(false);
        expect(allNavElements[4].classList.contains('is-focused')).toBe(false);

        // 全体で is-focused を持つ要素がホバー要素1つだけであること（二重枠防止）
        const focusedElements = root.querySelectorAll('.is-focused');
        expect(focusedElements.length).toBe(1);
        expect(focusedElements[0].getAttribute('data-idx')).toBe('2');
    });

    it('11. .custom-input へのフォーカス時に .is-focused が入力欄に移り、候補項目から外れること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();

        dialog.setData({
            targetName: 'ruby potion',
            shorthands: ['100G?'],
            candidates: [
                { onum: 310, name: 'potion of healing', cost: 100 }
            ]
        });
        dialog.show();

        const root = dialog.shadowRoot;
        const input = root.querySelector('.custom-input');
        const cand = root.querySelectorAll('.candidate-item')[1];

        expect(input).not.toBeNull();
        expect(cand).not.toBeNull();

        // custom-input にフォーカス（focus イベント発火）
        input.dispatchEvent({ type: 'focus' });

        const inputIdx = parseInt(input.getAttribute('data-idx'), 10);
        expect(dialog._focusedIndex).toBe(inputIdx);
        expect(input.classList.contains('is-focused')).toBe(true);

        // 他の要素（候補など）から is-focused が除去されていること
        const focusedElements = root.querySelectorAll('.is-focused');
        expect(focusedElements.length).toBe(1);
        expect(focusedElements[0]).toBe(input);

        // 次に候補アイテムに mouseenter した際、blur が呼ばれ、フォーカスが候補アイテムに移ること
        globalThis.document.activeElement = input;
        expect(dialog._isCustomInputFocused()).toBe(true);

        const blurSpy = vi.spyOn(input, 'blur');
        cand.dispatchEvent({ type: 'mouseenter' });

        expect(blurSpy).toHaveBeenCalled();
        const candIdx = parseInt(cand.getAttribute('data-idx'), 10);
        expect(dialog._focusedIndex).toBe(candIdx);
        expect(cand.classList.contains('is-focused')).toBe(true);
        expect(input.classList.contains('is-focused')).toBe(false);
    });
});


