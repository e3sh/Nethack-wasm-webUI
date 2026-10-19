import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockDom } from '../../components/testElementHelper.js';
import { ItemCandidateResolver } from '../../../src/core/knowledge/engines/ItemCandidateResolver.js';
import { CustomNameStore } from '../../../src/core/knowledge/state/CustomNameStore.js';
import { DiscoveryStateManager } from '../../../src/core/knowledge/state/DiscoveryStateManager.js';
import { InventoryStateManager } from '../../../src/core/knowledge/state/InventoryStateManager.js';
import { NhCallCandidateDialog } from '../../../src/components/NhCallCandidateDialog.js';
import { NhKnowledgeCard } from '../../../src/components/NhKnowledgeCard.js';
import { KnowledgeDetailModal } from '../../../examples/gkl-pure-js-client/modules/components/KnowledgeDetailModal.js';
import { ModalManager } from '../../../examples/gkl-pure-js-client/modules/components/ModalManager.js';

describe('CallAssistantIntegration - 直接命名起動＆Cコア能動コマンドシーケンス統合シナリオ (ROADMAP §2.1)', () => {
    let restoreDom;
    let discoveryStateManager;
    let customNameStore;
    let dialog;

    beforeEach(() => {
        restoreDom = setupMockDom();
        if (typeof customElements !== 'undefined' && typeof customElements.define === 'function') {
            if (!customElements.get('nh-call-candidate-dialog')) {
                customElements.define('nh-call-candidate-dialog', NhCallCandidateDialog);
            }
            if (!customElements.get('nh-knowledge-card')) {
                customElements.define('nh-knowledge-card', NhKnowledgeCard);
            }
        }
        discoveryStateManager = new DiscoveryStateManager();
        customNameStore = new CustomNameStore({
            autoPersist: false,
            discoveryStateManager
        });
        dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();
    });

    it('1. ItemCandidateResolver による候補逆引きとダイアログでの選択・決定・CustomNameStore登録の一連のフロー', () => {
        // 1. 候補リストの導出 (価格帯・未識別フィルタ)
        const resolution = ItemCandidateResolver.resolveCandidates({
            category: 'POTION',
            appearance: 'red',
            discoveryStateManager
        });

        expect(resolution.candidates.length).toBeGreaterThan(0);
        expect(resolution.shorthands.length).toBeGreaterThan(0);

        // 2. ダイアログの表示
        dialog.show({
            targetName: 'red potion',
            targetCategory: 'POTION',
            candidates: resolution.candidates,
            shorthands: resolution.shorthands
        });

        expect(dialog.open).toBe(true);
        expect(dialog.shadowRoot.innerHTML).toContain('red potion');

        // 3. 候補の選択 (例: "extra healing?")
        let submittedName = null;
        dialog.addEventListener('nh-call-submit', (e) => {
            submittedName = e.detail.name;
            customNameStore.setCustomName('red', submittedName, {
                category: 'POTION'
            });
        });

        // 候補の決定をシミュレート
        dialog.submit('extra healing?');

        expect(submittedName).toBe('extra healing?');
        expect(dialog.open).toBe(false);

        // 4. CustomNameStore & DiscoveryStateManager に仮名が反映されていること
        expect(customNameStore.getCustomName('red')).toBe('extra healing?');
        expect(discoveryStateManager.getCalledName('red')).toBe('extra healing?');
    });

    it('2. 巻物の候補解決とショートハンド（100G?等）選択の連携', () => {
        // 識別済みアイテムをシミュレート（scroll of identify を識別済みに登録）
        const identifyOnum = discoveryStateManager.lookupOnum('scroll of identify');
        discoveryStateManager.registerKnownItem(identifyOnum, 'scroll of identify');

        // 基礎価格 100 の巻物（買値 133G 相当）を逆引き
        const resolution = ItemCandidateResolver.resolveCandidates({
            category: 'SCROLL',
            baseCost: 100,
            discoveryStateManager,
            excludeDiscovered: true
        });

        expect(resolution.candidates.every(c => c.cost === 100)).toBe(true);
        expect(resolution.shorthands).toContain('100G?');

        // ダイアログでショートハンドを選択
        let chosen = null;
        dialog.addEventListener('nh-call-submit', (e) => {
            chosen = e.detail.name;
        });

        dialog.setData({
            targetName: 'labeled ZELGO MER',
            targetCategory: 'SCROLL',
            shorthands: resolution.shorthands,
            candidates: resolution.candidates
        });
        dialog.show();

        // 最初のショートハンド "100G?" を選択
        dialog.submit('100G?');
        expect(chosen).toBe('100G?');
    });

    it('3. 命名解除（クリア）フローで名前が消去されること', () => {
        // 事前に仮名を登録
        customNameStore.setCustomName('silver wand', 'digging?');
        expect(customNameStore.getCustomName('silver wand')).toBe('digging?');

        dialog.setData({
            targetName: 'silver wand',
            currentCall: 'digging?',
            candidates: []
        });
        dialog.show();

        dialog.addEventListener('nh-call-submit', (e) => {
            if (e.detail.name === '') {
                customNameStore.removeCustomName('silver wand');
            }
        });

        // クリアを選択
        dialog.submit('');

        expect(customNameStore.hasCustomName('silver wand')).toBe(false);
        expect(discoveryStateManager.getCalledName('silver wand')).toBeNull();
    });

    it('4. ModalManager.openDirectCallDialog で Cコアが通常待機中の場合、能動コマンドシーケンス（C -> o -> letter -> chosenName）が送信されること', () => {
        const mockCore = {
            executeSequence: vi.fn(),
            respond: vi.fn(),
            currentPrompt: null,
            gkl: { discoveryStateManager }
        };

        const modalManager = new ModalManager({
            getCore: () => mockCore
        });

        // 所持品レター 'e' を持つ未識別ポーションの仮名ダイアログを開く
        modalManager.openDirectCallDialog({
            name: 'smoky potion',
            appearanceName: 'smoky potion',
            category: 'POTION',
            letter: 'e',
            isUnidentified: true
        });

        const createdDialog = document.getElementById('nh-call-candidate-dialog');
        expect(createdDialog).not.toBeNull();
        expect(createdDialog.open).toBe(true);

        // 候補を選択・送信
        createdDialog.submit('extra healing?');

        // Cコアへ 能動シーケンス ['C', 'o', 'e', 'extra healing?'] が送られたこと
        expect(mockCore.executeSequence).toHaveBeenCalledWith(['C', 'o', 'e', 'extra healing?']);
        expect(createdDialog.open).toBe(false);

        // DiscoveryStateManager に反映されていること
        expect(discoveryStateManager.getCalledName('smoky potion')).toBe('extra healing?');
    });

    it('5. ModalManager.openDirectArtifactNameDialog で Cコアへ能動コマンドシーケンス（C -> i -> letter -> chosenName）が送信されること', () => {
        const mockCore = {
            executeSequence: vi.fn(),
            respond: vi.fn(),
            currentPrompt: null,
            gkl: {
                discoveryStateManager,
                statusAccessor: { role: 'valkyrie', alignment: 'NEUTRAL' }
            }
        };

        const modalManager = new ModalManager({
            getCore: () => mockCore
        });

        // 所持品レター 'b' を持つ long sword の個別命名ダイアログを開く
        modalManager.openDirectArtifactNameDialog({
            name: 'long sword',
            onum: 54,
            category: 'WEAPON',
            letter: 'b',
            isUnidentified: false
        });

        const createdDialog = document.getElementById('nh-call-candidate-dialog');
        expect(createdDialog).not.toBeNull();
        expect(createdDialog.open).toBe(true);
        expect(createdDialog.mode).toBe('artifact_name');

        // "Frost Brand" を決定
        createdDialog.submit('Frost Brand');

        // Cコアへ 能動シーケンス ['C', 'i', 'b', 'Frost Brand'] が送られたこと
        expect(mockCore.executeSequence).toHaveBeenCalledWith(['C', 'i', 'b', 'Frost Brand']);
        expect(createdDialog.open).toBe(false);

        // DiscoveryStateManager に反映されていること
        expect(discoveryStateManager.getCalledName('long sword')).toBe('Frost Brand');
    });

    it('6. <nh-knowledge-card> の [仮名] / [アーティファクト銘] ボタン押下から ModalManager が直接ダイアログを開き、Cコアシーケンス送信とカード即時更新が行われること', () => {
        const mockCore = {
            executeSequence: vi.fn(),
            currentPrompt: null,
            gkl: { discoveryStateManager }
        };

        const modalManager = new ModalManager({
            getCore: () => mockCore
        });

        const card = new NhKnowledgeCard();
        card.connectedCallback();
        document.body.appendChild(card);

        card.setTarget({
            name: 'scroll labeled FOO',
            appearanceName: 'scroll labeled FOO',
            category: 'SCROLL',
            letter: 'r',
            isUnidentified: true
        });

        // 1. カード内の [仮名] ボタンをクリック
        const callBtn = card.shadowRoot.querySelector('#callItemBtn');
        expect(callBtn).not.toBeNull();
        callBtn.click();

        // 2. ModalManager が <nh-call-candidate-dialog> を開いたこと
        const callDialog = document.getElementById('nh-call-candidate-dialog');
        expect(callDialog).not.toBeNull();
        expect(callDialog.open).toBe(true);

        // 3. ダイアログで仮名を決定
        callDialog.submit('identify?');

        // 4. Cコアへ送信され、カード表示が即座に更新されたこと
        expect(mockCore.executeSequence).toHaveBeenCalledWith(['C', 'o', 'r', 'identify?']);
        expect(card.shadowRoot.innerHTML).toContain('called "identify?"');
    });

    it('7. 床のアイテム（letterなし）を閲覧している場合は [仮名] / [アーティファクト銘] ボタンが表示されないこと', () => {
        const card = new NhKnowledgeCard();
        card.connectedCallback();
        document.body.appendChild(card);

        // A. 床の未識別アイテム（letter なし）
        card.setTarget({
            name: 'ruby potion',
            appearanceName: 'ruby potion',
            category: 'POTION',
            isUnidentified: true
            // letter なし
        });
        expect(card.shadowRoot.querySelector('#callItemBtn')).toBeNull();

        // B. 床のアーティファクト元アイテム（letter なし）
        card.setTarget({
            name: 'long sword',
            onum: 54,
            category: 'WEAPON',
            isUnidentified: false
            // letter なし
        });
        expect(card.shadowRoot.querySelector('#nameItemBtn')).toBeNull();

        // C. KnowledgeDetailModal でも同様に letter なし時はボタンが表示されないこと
        const modal = new KnowledgeDetailModal({ getCore: () => null });
        modal.open({
            name: 'ruby potion',
            category: 'POTION',
            isUnidentified: true
            // letter なし
        });
        expect(modal.elModal.querySelector('#btn-modal-call-item')).toBeNull();

        modal.open({
            name: 'long sword',
            onum: 54,
            category: 'WEAPON',
            isUnidentified: false
            // letter なし
        });
        expect(modal.elModal.querySelector('#btn-modal-name-item')).toBeNull();
    });

    it('8. KnowledgeDetailModal からの直接仮名・個別命名起動（ボタンクリック / c・n キー）と Cコア連携・モーダル再描画が行われること', () => {
        const mockCore = {
            executeSequence: vi.fn(),
            currentPrompt: null,
            gkl: { discoveryStateManager }
        };

        const modalManager = new ModalManager({
            getCore: () => mockCore
        });

        const detailModal = new KnowledgeDetailModal({
            getCore: () => mockCore
        });

        // 1. 所持品（letter: 'k'）の未識別杖を開く
        detailModal.open({
            name: 'glass wand',
            appearanceName: 'glass wand',
            category: 'WAND',
            letter: 'k',
            isUnidentified: true
        });

        // 仮名ボタンが存在すること
        const callBtn = detailModal.elModal.querySelector('#btn-modal-call-item');
        expect(callBtn).not.toBeNull();
        callBtn.click();

        // ダイアログが開いたこと
        const callDialog = document.getElementById('nh-call-candidate-dialog');
        expect(callDialog).not.toBeNull();
        expect(callDialog.open).toBe(true);

        // 決定
        callDialog.submit('digging?');

        // Cコアへの送信とモーダルへの反映
        expect(mockCore.executeSequence).toHaveBeenCalledWith(['C', 'o', 'k', 'digging?']);
        expect(discoveryStateManager.getCalledName('glass wand')).toBe('digging?');

        // 2. 所持品（letter: 'w'）の long sword を開き、'n' キーでのアーティファクト命名起動を検証
        mockCore.executeSequence.mockClear();
        detailModal.open({
            name: 'long sword',
            onum: 54,
            category: 'WEAPON',
            letter: 'w',
            isUnidentified: false
        });

        const nameBtn = detailModal.elModal.querySelector('#btn-modal-name-item');
        expect(nameBtn).not.toBeNull();

        // 'n' キー押下イベントをシミュレート
        document.dispatchEvent({ type: 'keydown', key: 'n', bubbles: true, preventDefault: vi.fn(), stopPropagation: vi.fn() });

        expect(callDialog.open).toBe(true);
        expect(callDialog.mode).toBe('artifact_name');

        callDialog.submit('Excalibur');
        expect(mockCore.executeSequence).toHaveBeenCalledWith(['C', 'i', 'w', 'Excalibur']);
        expect(discoveryStateManager.getCalledName('long sword')).toBe('Excalibur');
    });

    it('9. KnowledgeDetailModal から仮名/銘起動時、詳細モーダルが閉じて命名ダイアログへスマートに遷移すること', () => {
        const mockCore = {
            executeSequence: vi.fn(),
            currentPrompt: null,
            gkl: { discoveryStateManager }
        };

        const modalManager = new ModalManager({
            getCore: () => mockCore
        });

        const detailModal = new KnowledgeDetailModal({
            getCore: () => mockCore
        });

        detailModal.open({
            name: 'ruby potion',
            appearanceName: 'ruby potion',
            category: 'POTION',
            letter: 'p',
            isUnidentified: true
        });

        expect(detailModal.isVisible).toBe(true);

        // 1. 仮名ボタンをクリック
        const callBtn = detailModal.elModal.querySelector('#btn-modal-call-item');
        callBtn.click();

        // 2. 詳細モーダルは閉じていること
        expect(detailModal.isVisible).toBe(false);
        expect(detailModal.elModal.classList.contains('hidden')).toBe(true);

        // 3. 命名ダイアログが前面に開いていること
        const callDialog = document.getElementById('nh-call-candidate-dialog');
        expect(callDialog).not.toBeNull();
        expect(callDialog.open).toBe(true);

        // 4. ダイアログ決定後、Cコアへ能動送信されること
        callDialog.submit('100G?');
        expect(mockCore.executeSequence).toHaveBeenCalledWith(['C', 'o', 'p', '100G?']);
        expect(callDialog.open).toBe(false);
    });

    it('10. targetData から真名候補リストおよびショートハンドがダイアログに正常生成・表示されること', () => {
        const mockCore = {
            executeSequence: vi.fn(),
            currentPrompt: null,
            gkl: { discoveryStateManager }
        };

        const modalManager = new ModalManager({
            getCore: () => mockCore
        });

        modalManager.openDirectCallDialog({
            name: 'scroll labeled FOO',
            rawText: 'a scroll labeled FOO',
            category: 'SCROLL',
            letter: 's',
            isUnidentified: true
        });

        const callDialog = document.getElementById('nh-call-candidate-dialog');
        expect(callDialog).not.toBeNull();
        expect(callDialog.open).toBe(true);

        // 候補リスト（巻物一覧）とショートハンドが正しく注入されていること
        const candidates = callDialog.getCandidates();
        expect(candidates.length).toBeGreaterThan(0);
        expect(candidates.some(c => c.name === 'scroll of identify')).toBe(true);
        expect(candidates.some(c => c.name === 'scroll of teleportation')).toBe(true);

        // ショートハンドピルに identify? 等が含まれていること
        expect(callDialog.shadowRoot.innerHTML).toContain('identify?');
        expect(callDialog.shadowRoot.innerHTML).toContain('scroll of identify');
    });

    it('11. 命名解除（クリア/リセット）時、NetHack C コアへはキャンセル回避のためスペース1文字（" "）がシーケンス送信され、状態が完全消去されること', () => {
        const mockCore = {
            executeSequence: vi.fn(),
            currentPrompt: null,
            gkl: { discoveryStateManager, inventoryStateManager: { isSynced: true } }
        };

        const modalManager = new ModalManager({
            getCore: () => mockCore
        });

        const targetData = {
            name: 'ruby potion',
            appearanceName: 'ruby potion',
            category: 'POTION',
            letter: 'c',
            calledName: 'oldName',
            isUnidentified: true
        };

        modalManager.openDirectCallDialog(targetData);
        const callDialog = document.getElementById('nh-call-candidate-dialog');
        expect(callDialog.open).toBe(true);

        // クリア決定 (空文字)
        callDialog.submit('');

        // Cコアへはキャンセルを避けるためスペース1文字（' '）が送られること
        expect(mockCore.executeSequence).toHaveBeenCalledWith(['C', 'o', 'c', ' ']);
        expect(targetData.calledName).toBe('');
        expect(discoveryStateManager.getCalledName('ruby potion')).toBeNull();
        expect(mockCore.gkl.inventoryStateManager.isSynced).toBe(false);
    });

    it('12. 候補リストのアイテム選択時は、短縮形ではなくアイテム真名が送信されること', () => {
        const dialog = new NhCallCandidateDialog();
        dialog.connectedCallback();
        document.body.appendChild(dialog);

        dialog.setData({
            targetName: 'ruby potion',
            targetCategory: 'POTION',
            candidates: [
                { onum: 310, name: 'potion of healing', nameJa: '回復の薬', shorthand: 'healing?' }
            ],
            shorthands: ['healing?']
        });
        dialog.show();

        const submitSpy = vi.fn();
        dialog.addEventListener('nh-call-submit', submitSpy);

        // 候補リストの先頭アイテム要素をクリック (index 0 はクリア項目、index 1 が候補アイテム)
        const items = dialog.shadowRoot.querySelectorAll('.candidate-item');
        const candidateEl = items[1];
        expect(candidateEl).not.toBeNull();
        candidateEl.click();

        // shorthand ('healing?') ではなく真名 ('potion of healing') が送信されたこと
        expect(submitSpy).toHaveBeenCalled();
        expect(submitSpy.mock.calls[0][0].detail.name).toBe('potion of healing');
    });

    it('13. 命名決定時に C コア真値 (getObjectUname) または DiscoveryStateManager の仮名が InventoryStateManager の baseName および identification.calledName に反映されること', () => {
        const mockWasmBinding = {
            isAvailable: () => true,
            getInventory: () => [
                { ptr: 100, onum: 310, oclass: 3, quan: 1, spe: 0, flags: { bknown: false }, invlet: 'a' }, // potion of healing (未鑑定)
                { ptr: 200, onum: 27, oclass: 1, quan: 1, spe: 0, flags: { bknown: true, known: true }, invlet: 'b' } // dagger (識別済み)
            ],
            getEquipmentPtrs: () => ({ rawPtrs: {}, slotByPtr: new Map(), ptrBySlot: new Map() }),
            getDiscoveries: () => new Uint8Array(600),
            getDescrIndexes: () => new Int32Array(600),
            getObjectUname: (onum) => {
                if (onum === 310) return 'my_potion';
                if (onum === 27) return 'my_dagger';
                return null;
            }
        };

        const discoveryMgr = new DiscoveryStateManager({
            wasmDirectBindingService: mockWasmBinding
        });
        const invMgr = new InventoryStateManager({
            discoveryStateManager: discoveryMgr,
            wasmDirectBindingService: mockWasmBinding
        });

        // WasmDirectBinding 経由でインベントリ同期
        invMgr.syncFromDirectBinding();

        const items = invMgr.getItems();
        expect(items.length).toBe(2);

        // 未鑑定の薬: baseName に "called my_potion" が含まれ、identification.calledName にセットされること
        const potion = items.find(it => it.letter === 'a');
        expect(potion).toBeDefined();
        expect(potion.baseName).toContain('called my_potion');
        expect(potion.identification?.calledName).toBe('my_potion');

        // 識別済みの槍 (onum=27: spear): NetHack Cコア仕様により、識別済みアイテムには仮名は付与されず真名のみが表示されること
        const spear = items.find(it => it.letter === 'b');
        expect(spear).toBeDefined();
        expect(spear.baseName).toBe('spear');
        expect(spear.baseName).not.toContain('called');
        expect(spear.identification?.calledName).toBeNull();
    });

    it('14. ディスカバリー図鑑（値段付き未識別アイテム）-> 個別ナレッジ -> 価格連動候補絞り込み＆仮名登録の統合フロー', () => {
        const mockCore = {
            gkl: {
                discoveryStateManager: discoveryStateManager,
                wasmDirectBindingService: null,
                inventoryStateManager: { isSynced: true, syncFromDirectBinding: vi.fn() }
            },
            currentPrompt: null,
            executeSequence: vi.fn(),
            emit: vi.fn()
        };

        const modalManager = new ModalManager({
            getCore: () => mockCore
        });

        // 1. DiscoveryStateManager に仮名（"133G"）および内部キー "onum:300" を設定
        discoveryStateManager.setCalledName('scroll labeled FOO', '133G');
        discoveryStateManager.setCalledName('onum:300', '133G');

        // インベントリ内に同一外見の巻物を所持
        const mockInventoryStateManager = {
            getItems: () => [
                {
                    letter: 'd',
                    rawText: 'a scroll labeled FOO (unpaid, 133 zorkmids)',
                    name: 'scroll labeled FOO',
                    identification: {
                        appearanceName: 'scroll labeled FOO',
                        calledName: '133G',
                        isUnidentified: true
                    }
                }
            ]
        };
        discoveryStateManager.inventoryStateManager = mockInventoryStateManager;

        // 2. getDiscoveredItems の検証:
        // - "onum:300" は単体行として出力されないこと
        // - 未識別アイテムに isUnidentified: true が付与され、所持品から letter, rawText が引き継がれていること
        const discovered = discoveryStateManager.getDiscoveredItems();
        expect(discovered.some(d => d.trueName === 'onum:300')).toBe(false);

        const codexItem = discovered.find(d => (d.appearance || '').toLowerCase() === 'scroll labeled foo');
        expect(codexItem).toBeDefined();
        expect(codexItem.isUnidentified).toBe(true);
        expect(codexItem.isDiscovered).toBe(false);
        expect(codexItem.letter).toBe('d');
        expect(codexItem.calledName).toBe('133G');
        expect(codexItem.rawText).toContain('133 zorkmids');

        // 3. KnowledgeDetailModal での表示と _canCallItem() の検証
        const modal = new KnowledgeDetailModal({
            getCore: () => mockCore,
            language: 'ja'
        });
        modal.open(codexItem);

        expect(modal._canCallItem()).toBe(true);
        const modalHtml = modal.elModal.innerHTML;
        // 価格からの推定候補セクションが表示されていること
        expect(modalHtml).toContain('価格からの推定候補');
        // 基礎価格 100 ZM（買値133Gからの逆算）の巻物候補（teleport? 等）が含まれていること
        expect(modalHtml).toContain('teleport?');

        // 4. クイック仮名登録（"teleport?"）の実行
        modal.triggerQuickCallItem('teleport?');

        // 5. Cコアコマンドシーケンス送信 & 仮名ストア更新の検証
        expect(mockCore.executeSequence).toHaveBeenCalledWith(['C', 'o', 'd', 'teleport?']);
        expect(discoveryStateManager.getCalledName('scroll labeled FOO')).toBe('teleport?');
        expect(codexItem.calledName).toBe('teleport?');
    });

    it('15. ModalManager.setLanguage で開いている <nh-call-candidate-dialog> の言語が動的に切り替わること', () => {
        const mockCore = {
            executeSequence: vi.fn(),
            currentPrompt: null,
            gkl: { discoveryStateManager, inventoryStateManager: { isSynced: true } }
        };

        const modalManager = new ModalManager({
            getCore: () => mockCore
        });

        // 1. 日本語でダイアログを開く
        modalManager.currentLanguage = 'ja';
        modalManager.openDirectCallDialog({
            name: 'scroll labeled FOO',
            category: 'SCROLL',
            letter: 's',
            isUnidentified: true
        });

        const callDialog = document.getElementById('nh-call-candidate-dialog');
        expect(callDialog).not.toBeNull();
        expect(callDialog.open).toBe(true);
        expect(callDialog.currentLanguage).toBe('ja');
        expect(callDialog.shadowRoot.innerHTML).toContain('🏷️ 命名アシスト (Call Item)');

        // 2. 言語切替実行 (en)
        modalManager.setLanguage('en');

        // 3. ダイアログの表示が英語に切り替わっていること
        expect(callDialog.currentLanguage).toBe('en');
        expect(callDialog.shadowRoot.innerHTML).toContain('🏷️ Call Item Assistant');
        expect(callDialog.shadowRoot.innerHTML).toContain('Quick Presets (One-tap)');
        expect(callDialog.shadowRoot.innerHTML).toContain('❌ Clear Name (Reset)');

        // 4. 言語切替実行 (ja)
        modalManager.setLanguage('ja');
        expect(callDialog.currentLanguage).toBe('ja');
        expect(callDialog.shadowRoot.innerHTML).toContain('🏷️ 命名アシスト (Call Item)');
    });
});

