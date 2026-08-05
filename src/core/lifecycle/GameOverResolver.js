/**
 * GameOverResolver.js - WebUICore ゲームオーバー・勝敗判定 & ランキング解析モジュール
 *
 * 画面描画から独立し、ゲーム終了イベント発生時の「死亡/昇天/セーブ中断」の自動判定、
 * および /save/record ファイルの自動解析とランキングオブジェクト配列の返却を行う。
 */

export class GameOverResolver {
    /**
     * Wasm終了イベント (exited) 発生時に、ゲームオーバーか正常セーブかを非同期判定
     *
     * @param {NetHackWasmDriver|Object} driver - Wasm Driver または Worker Bridge
     * @returns {Promise<Object>} ゲーム終了結果オブジェクト { isGameOver, reason, deathMessage, lastRecord }
     */
    static async resolveGameOver(driver) {
        if (!driver) return { isGameOver: false, reason: 'unknown' };

        try {
            // 1. セーブファイルが存在するか非同期チェック
            let saveName = null;
            if (typeof driver.autoDetectSavePlayerName === 'function') {
                saveName = await driver.autoDetectSavePlayerName();
            } else if (driver.fsManager && typeof driver.fsManager.autoDetectSavePlayerName === 'function') {
                saveName = await driver.fsManager.autoDetectSavePlayerName();
            }

            // セーブデータが存在する場合は「正常なセーブ中断（次回再開可能）」
            if (saveName) {
                return {
                    isGameOver: false,
                    reason: 'save_and_exit',
                    savePlayerName: saveName
                };
            }

            // 2. セーブデータが存在せず、record ファイルに有効なゲームオーバー記録があるかチェック
            const scoreboard = this.getScoreboard(driver);
            if (!scoreboard || scoreboard.length === 0) {
                // record が空の場合は起動直後や誤終了
                return { isGameOver: false, reason: 'initial_or_no_record' };
            }

            const lastRecord = scoreboard[0];
            const deathReasonStr = lastRecord.death || lastRecord.deathReason || 'Died in dungeon';

            return {
                isGameOver: true,
                reason: this._parseReason(deathReasonStr),
                death: deathReasonStr,
                deathMessage: `${lastRecord.name || 'Hero'} (${lastRecord.role || 'Explorer'}) - ${deathReasonStr}`,
                playerName: lastRecord.name || 'Hero',
                role: lastRecord.role || 'Explorer',
                finalScore: lastRecord.points || lastRecord.score || 0,
                lastRecord: lastRecord,
                scoreboard: scoreboard
            };
        } catch (e) {
            console.warn("GameOverResolver error:", e);
            return { isGameOver: false, reason: 'error' };
        }
    }

    /**
     * /save/record ファイルから構造化されたハイスコア配列を取得
     *
     * @param {Object} driver
     * @returns {Array<Object>}
     */
    static getScoreboard(driver) {
        try {
            if (driver && driver.fsManager && typeof driver.fsManager.getScoreboard === 'function') {
                return driver.fsManager.getScoreboard();
            }
        } catch (e) {}
        return [];
    }

    static _parseReason(deathStr) {
        if (!deathStr) return 'died';
        const str = deathStr.toLowerCase();
        if (str.includes('ascended')) return 'ascended';
        if (str.includes('escaped')) return 'escaped';
        if (str.includes('quit')) return 'quit';
        return 'died';
    }
}
