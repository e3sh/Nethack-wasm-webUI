/**
 * ContainerSequenceBuilder.js
 *
 * コンテナ操作用のキーシーケンスを安全に組み立てるビルダー。
 * 一括シーケンス実行 (querySequenceSilent) 前に事前検証を行い、
 * 危険物・装備中アイテム・コンテナ自身・無効レターを確実に除外して
 * C コアでのエラーメッセージ割り込みやシーケンス不整合 (desync) を未然に防止する。
 */

import { ContainerSafetyGuard } from './ContainerSafetyGuard.js';

export class ContainerSequenceBuilder {

    /**
     * @param {Object} [options={}]
     * @param {ContainerSafetyGuard} [options.safetyGuard]
     */
    constructor(options = {}) {
        this.safetyGuard = options.safetyGuard || new ContainerSafetyGuard();
    }

    /**
     * 投入対象アイテムの事前検証とフィルタリング
     *
     * @param {Object} container - コンテナ情報 { letter, onum, isBagOfHolding, name }
     * @param {Array<Object>} items - 投入候補アイテム配列
     * @param {Object} [options={}] - { allowSuspicious: boolean }
     * @returns {{ validItems: Array<Object>, excludedItems: Array<{ item: Object, reason: string }> }}
     */
    validatePutInItems(container, items, options = {}) {
        const itemList = Array.isArray(items) ? items : (items ? [items] : []);
        const validItems = [];
        const excludedItems = [];

        const isBoh = !!(container && (container.isBagOfHolding || /bag of holding/i.test(container.name || '')));
        const containerLetter = container ? (container.letter || container.invlet) : null;
        const containerOnum = container ? (typeof container.onum === 'number' ? container.onum : -1) : -1;

        for (const item of itemList) {
            if (!item) continue;

            const letter = item.letter || item.invlet;
            const itemOnum = typeof item.onum === 'number' ? item.onum : -1;

            // 1. 有効な英字レターまたは有効な identifier を持っているか
            const hasValidLetter = letter && typeof letter === 'string' && /^[a-zA-Z]$/.test(letter);
            const hasValidIdentifier = typeof item.identifier === 'number' && item.identifier > 0;
            if (!hasValidLetter && !hasValidIdentifier) {
                excludedItems.push({ item, reason: 'INVALID_LETTER' });
                continue;
            }

            // 2. 開いているコンテナ自身ではないか (Self-containment Guard)
            const containerIdentifier = container ? container.identifier : null;
            if ((containerLetter && letter === containerLetter) ||
                (containerOnum !== -1 && itemOnum !== -1 && itemOnum === containerOnum) ||
                (containerIdentifier && item.identifier && containerIdentifier === item.identifier)) {
                excludedItems.push({ item, reason: 'SELF_CONTAINER' });
                continue;
            }

            // 3. 装備中・着用中ではないか (Equipped Guard)
            if (item.isWielded || item.isWorn || item.worn || item.isQuivered) {
                excludedItems.push({ item, reason: 'EQUIPPED' });
                continue;
            }

            // 4. Bag of Holding への投入時の防爆セーフティチェック
            if (isBoh) {
                const normalizedItem = item.rawText ? item : { ...item, rawText: item.name || '' };
                const assessment = this.safetyGuard.assessItem(normalizedItem, container);
                // 確定危険物 (CRITICAL): ハード除外
                if (assessment.level === 'CRITICAL') {
                    excludedItems.push({ item, reason: 'BOH_CRITICAL' });
                    continue;
                }
                // 未識別疑わしい物 (SUSPICIOUS): 明示的同意がない限り除外
                if (assessment.level === 'SUSPICIOUS' && !options.allowSuspicious) {
                    excludedItems.push({ item, reason: 'BOH_SUSPICIOUS' });
                    continue;
                }
            }

            validItems.push(item);
        }

        return { validItems, excludedItems };
    }

    /**
     * コンテナを開くためのプレフィックスシーケンスを取得
     * - 手持ちコンテナ: ['a', letter]
     * - 床コンテナ (#loot): ['#', 'loot']
     *
     * @param {Object|string} container - コンテナ情報 { letter, isFloorContainer, ... } または レター文字列
     * @returns {Array<string>} プレフィックス配列
     */
    getContainerOpenPrefix(container) {
        if (!container) return ['#', 'loot'];
        if (typeof container === 'string') {
            if (/^[a-zA-Z]$/.test(container)) {
                return ['a', container];
            }
            return ['#', 'loot'];
        }
        if (container.isFloorContainer || !container.letter || container.letter === '.' || !/^[a-zA-Z]$/.test(container.letter)) {
            // 同一マスに複数コンテナが存在し、対象選択レター (targetLetter) が指定されている場合
            if (container.targetLetter && /^[a-zA-Z]$/.test(container.targetLetter)) {
                return ['#', 'loot', container.targetLetter];
            }
            return ['#', 'loot'];
        }
        return ['a', container.letter];
    }

    /**
     * アイテム選択用のオブジェクト配列（identifier, count）を生成
     * ※キーストローク（文字や数値列）ではなく、select_menu に渡す純粋な構造体配列
     *
     * @param {Array<Object>} items - 選択対象アイテム配列
     * @param {number} [defaultQuantity=-1] - デフォルト数量 (-1 = 全量)
     * @returns {Array<{ identifier: number, count: number }>}
     */
    buildItemSelectionObjects(items, defaultQuantity = -1) {
        const itemList = Array.isArray(items) ? items : (items ? [items] : []);
        return itemList.map(it => ({
            identifier: it.identifier !== undefined ? it.identifier : (it.accelerator ? it.accelerator.charCodeAt(0) : (it.letter ? it.letter.charCodeAt(0) : 0)),
            count: typeof it.count === 'number' ? it.count : (typeof it.transferCount === 'number' ? it.transferCount : defaultQuantity),
        }));
    }

    /**
     * 後方互換性ヘルパー: 常にオブジェクト配列を返却（文字送信は全廃）
     * @param {Array<Object>} items
     * @returns {Array<{ identifier: number, count: number }>}
     */
    buildItemSelectionToken(items) {
        return this.buildItemSelectionObjects(items);
    }

    /**
     * コンテナ中身確認・同期用のキーシーケンスを生成
     * 【ユーザー考案による重大改善】
     * ':' (Look inside) だとアクセラレータキー（文字）や identifier が存在しないため、
     * 'o' (take something out) のアイテム選択メニューを利用して完全な正解中身データを取得。
     * 取得後は '\x1b' (ESC: キャンセル) を送ってアイテムを取り出さずに安全に終了する。
     *
     * @param {Object|string} container - コンテナ情報またはインベントリレター
     * @returns {Array<string>} トークン配列 (例: ['a', 'f', 'o', 'a', '\x1b'])
     */
    buildLookSequence(container) {
        const prefix = this.getContainerOpenPrefix(container);
        return [...prefix, 'o', 'a', '\x1b'];
    }

    /**
     * アイテム投入用の安全なキーシーケンスを生成 (Put in)
     * - コンテナを開く
     * - 'i' で投入モード
     * - 'a' で全カテゴリ (All types)
     * ※アイテム選択自体はキーストロークではなく、シグナルハンドラ側で完了させる
     *
     * @param {Object} container - { letter, onum, isBagOfHolding, name, isFloorContainer }
     * @param {Array<Object>} items - 投入対象アイテム
     * @param {Object} [options={}] - { allowSuspicious: boolean }
     * @returns {{ sequence: Array<string>|null, validItems: Array<Object>, excludedItems: Array<Object> }}
     */
    buildPutInSequence(container, items, options = {}) {
        const prefix = this.getContainerOpenPrefix(container);

        const { validItems, excludedItems } = this.validatePutInItems(container, items, options);
        if (validItems.length === 0) {
            return { sequence: null, validItems: [], excludedItems };
        }

        // 純粋な起動キーのみ（アイテム選択はシグナルハンドラ側で実施）
        const sequence = [...prefix, 'i', 'a'];
        return { sequence, validItems, excludedItems };
    }

    /**
     * アイテム取り出し用のキーシーケンスを生成 (Take out)
     * - コンテナを開く
     * - 'o' で取り出しモード
     * - 'a' で全カテゴリ (All types)
     * ※アイテム選択自体はキーストロークではなく、シグナルハンドラ側で完了させる
     *
     * @param {Object} container - { letter, isFloorContainer }
     * @param {Array<Object>} items - 取り出し対象アイテム
     * @returns {{ sequence: Array<string>|null, items: Array<Object> }}
     */
    buildTakeOutSequence(container, items) {
        const prefix = this.getContainerOpenPrefix(container);

        const itemList = Array.isArray(items) ? items : (items ? [items] : []);
        if (itemList.length === 0) {
            return { sequence: null, items: [] };
        }

        const sequence = [...prefix, 'o', 'a'];
        return { sequence, items: itemList };
    }
}
