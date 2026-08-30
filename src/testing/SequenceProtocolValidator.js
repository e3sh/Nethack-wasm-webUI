/**
 * SequenceProtocolValidator.js
 * 上り方向キーシーケンス・プロトコル検証エンジン (第1防壁: 静的リンター)
 *
 * NetHack Cコアおよび NetHackWasmDriver の入力ステートマシン規約に適合しているかを静的検証する。
 */
import { NetHackWasmDriver } from '../driver/NetHackWasmDriver.js';

export const VALID_DIR_CODES = new Set([
    'DIR_N', 'DIR_NE', 'DIR_E', 'DIR_SE',
    'DIR_S', 'DIR_SW', 'DIR_W', 'DIR_NW', 'DIR_SELF'
]);

export class SequenceProtocolValidator {

    /**
     * トークン配列のフォーマットを静的に検証
     * @param {Array<string|number>} tokens 
     * @param {Object} [context={}] 
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validateSequence(tokens, context = {}) {
        const errors = [];
        if (!Array.isArray(tokens)) {
            return { valid: false, errors: ['tokens must be an array'] };
        }
        if (tokens.length === 0) {
            return { valid: false, errors: ['tokens array cannot be empty'] };
        }

        tokens.forEach((token, index) => {
            const strToken = String(token);

            // 1. 改行文字の混入検査 (No Newline / Carriage Return)
            if (strToken.includes('\n') || strToken.includes('\r')) {
                errors.push(`Token[${index}] "${strToken}" contains forbidden newline characters (\\n or \\r).`);
            }

            // 2. 抽象方向コードの妥当性検査
            if (strToken.startsWith('DIR_') && !VALID_DIR_CODES.has(strToken)) {
                errors.push(`Token[${index}] "${strToken}" is an invalid direction code.`);
            }
        });

        // 3. 拡張コマンド (#) のシーケンス検査
        if (tokens[0] === '#') {
            if (tokens.length < 2) {
                errors.push('Sequence starts with "#" but is missing the extended command token.');
            } else {
                const extCmdToken = String(tokens[1]).trim().toLowerCase().replace(/^#/, '');
                const validExtCmds = NetHackWasmDriver.DEFAULT_EXTCMDS;
                if (!validExtCmds.includes(extCmdToken)) {
                    errors.push(`Token[1] "${extCmdToken}" is not a valid NetHack extended command.`);
                }
            }
        }

        // 4. 先頭トークン (poskey) の単一文字検査 (プレースホルダーは除外)
        const firstToken = String(tokens[0]);
        if (!firstToken.startsWith('${') && !firstToken.startsWith('DIR_') && firstToken !== '#') {
            if (firstToken.length !== 1) {
                errors.push(`Token[0] "${firstToken}" in poskey must be a single character or direction code.`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
