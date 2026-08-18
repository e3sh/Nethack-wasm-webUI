/**
 * OnDemandLookService.js
 * マップセルクリック時に裏で Look (Far look: ;) を実行し、
 * 個体の最新動的ステータス (peaceful / friendly / tamed / hostile) をリアルタイムキャプチャするサービス
 */

export class OnDemandLookService {
    /**
     * @param {Object} [options={}]
     * @param {Object} [options.core=null] - WebUICore インスタンス
     * @param {Object} [options.driver=null] - NetHackWasmDriver インスタンス
     */
    constructor(options = {}) {
        this.core = options.core || null;
        this.driver = options.driver || (this.core ? this.core.driver : null);
    }

    setCore(core) {
        this.core = core;
        if (core && core.driver) {
            this.driver = core.driver;
        }
    }

    setDriver(driver) {
        this.driver = driver;
    }

    /**
     * プレイヤー位置から対象座標までの Far look 用 queueSequence (抽象方向トークン配列) を計算
     * @param {{x: number, y: number}} playerPos 
     * @param {{x: number, y: number}} targetPos 
     * @returns {Array<string>} トークン配列 (例: [';', 'DIR_N', 'DIR_N', 'DIR_W', '\u001b'])
     */
    buildLookSequence(playerPos, targetPos) {
        if (!playerPos || !targetPos) return [];

        const dx = targetPos.x - playerPos.x;
        const dy = targetPos.y - playerPos.y;

        if (dx === 0 && dy === 0) {
            // 自キャラマスの場合は ':' または '; DIR_SELF \u001b'
            return [';', 'DIR_SELF', '\u001b'];
        }

        const tokens = [';'];
        let curX = playerPos.x;
        let curY = playerPos.y;

        // 目的地に到達するまで 8 方向の抽象トークンを追加
        while (curX !== targetPos.x || curY !== targetPos.y) {
            const stepX = Math.sign(targetPos.x - curX);
            const stepY = Math.sign(targetPos.y - curY);

            let dirToken = null;
            if (stepX === 0 && stepY === -1) dirToken = 'DIR_N';
            else if (stepX === 1 && stepY === -1) dirToken = 'DIR_NE';
            else if (stepX === 1 && stepY === 0) dirToken = 'DIR_E';
            else if (stepX === 1 && stepY === 1) dirToken = 'DIR_SE';
            else if (stepX === 0 && stepY === 1) dirToken = 'DIR_S';
            else if (stepX === -1 && stepY === 1) dirToken = 'DIR_SW';
            else if (stepX === -1 && stepY === 0) dirToken = 'DIR_W';
            else if (stepX === -1 && stepY === -1) dirToken = 'DIR_NW';

            if (dirToken) {
                tokens.push(dirToken);
                curX += stepX;
                curY += stepY;
            } else {
                break; // ガード
            }
        }

        // 末尾は解説画面を開かないよう ESC (\u001b) でサイレント終了
        tokens.push('\u001b');
        return tokens;
    }

    /**
     * Look 応答のテキスト（1行または複数行バッファ）から動的状態を解析
     * @param {string|Array<string>} rawBuffer 
     * @returns {Object} { rawText, isPeaceful, isTamed, isHostile, parsedName }
     */
    parseLookResponse(rawBuffer) {
        let text = '';
        if (Array.isArray(rawBuffer)) {
            text = rawBuffer.map(b => (typeof b === 'string' ? b : (b.text || b.str || ''))).join(' ');
        } else if (typeof rawBuffer === 'string') {
            text = rawBuffer;
        }

        const trimmed = text.trim();
        const lower = trimmed.toLowerCase();
        const hasResult = trimmed.length > 0;

        const isPlayer = lower.includes('you (') || lower.includes('yourself') || lower.startsWith('you ') || lower === 'you';
        const isPeaceful = !isPlayer && (
            lower.includes('peaceful') || 
            lower.includes('appears peaceful') || 
            lower.includes('seems peaceful') ||
            trimmed.includes('平和')
        );
        const isTamed = !isPlayer && (
            lower.includes('tamed') || 
            lower.includes('friendly') || 
            lower.includes('is tamed') || 
            lower.includes('is friendly') ||
            trimmed.includes('大人しい') ||
            trimmed.includes('おとなしい') ||
            trimmed.includes('ペット')
        );
        const isHostile = !isPlayer && !isPeaceful && !isTamed && hasResult;

        return {
            rawText: text,
            isPlayer,
            isPeaceful,
            isTamed,
            isHostile,
            hasResult
        };
    }

    /**
     * 指定されたターゲットセルに対しオンデマンド Look を非同期実行して結果を獲得
     * @param {{x: number, y: number}} playerPos 
     * @param {{x: number, y: number}} targetPos 
     * @returns {Promise<Object>} 解析された動的状態
     */
    async executeLook(playerPos, targetPos) {
        const tokens = this.buildLookSequence(playerPos, targetPos);
        if (tokens.length === 0 || !this.driver || typeof this.driver.queueSequence !== 'function') {
            return this.parseLookResponse('');
        }

        try {
            const buffer = await this.driver.queueSequence(tokens, { isSilentSync: true, suppressPrompts: true });
            return this.parseLookResponse(buffer);
        } catch (e) {
            console.warn('[OnDemandLookService] Look execution failed or cancelled:', e);
            return this.parseLookResponse('');
        }
    }
}

export default OnDemandLookService;
