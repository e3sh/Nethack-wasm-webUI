/**
 * StatusAccessor.js - NetHack Wasm ステータス統一アクセサ
 *
 * Cコアの status_update イベント (フィールド ID: 0~22+) から
 * マジックナンバーをカプセル化し、UI層に型安全な構造体プロパティを提供する。
 */

export class StatusAccessor {
    constructor() {
        this.fields = {};
    }

    /**
     * status_update イベント受信時にフィールドバッファを更新
     * @param {number} field - フィールド ID (例: 18 = BL_HP, 10 = BL_GOLD)
     * @param {any} value - 更新値
     */
    updateField(field, value) {
        if (field !== undefined && field !== null) {
            this.fields[field] = value;
        }
    }

    /**
     * 現在の全フィールドバッファを一括設定
     * @param {Record<number, any>} allFields 
     */
    setAllFields(allFields) {
        if (allFields && typeof allFields === 'object') {
            this.fields = { ...allFields };
        }
    }

    /**
     * 統一ステータスモデルオブジェクトを生成して取得
     * @returns {Object} 構造化ステータスオブジェクト
     */
    getStatus() {
        const f = this.fields;

        // HP パース (18: BL_HP, 19: BL_HPMAX)
        const curHp = parseInt(f[18] !== undefined ? f[18] : 0, 10) || 0;
        const maxHp = parseInt(f[19] !== undefined ? f[19] : 0, 10) || 0;
        const hpPercent = maxHp > 0 ? Math.min(1.0, Math.max(0, curHp / maxHp)) : 0;

        // Pw / Ene パース (11: BL_ENE, 12: BL_ENEMAX)
        const curPw = parseInt(f[11] !== undefined ? f[11] : 0, 10) || 0;
        const maxPw = parseInt(f[12] !== undefined ? f[12] : 0, 10) || 0;
        const pwPercent = maxPw > 0 ? Math.min(1.0, Math.max(0, curPw / maxPw)) : 0;

        // Gold (10: BL_GOLD)
        let goldAmount = 0;
        const rawGold = f[10];
        if (rawGold && typeof rawGold === 'object' && rawGold.amount !== undefined) {
            goldAmount = parseInt(rawGold.amount, 10) || 0;
        } else if (typeof rawGold === 'string') {
            const match = rawGold.match(/(\d+)/);
            goldAmount = match ? parseInt(match[1], 10) : 0;
        } else if (typeof rawGold === 'number') {
            goldAmount = rawGold;
        }

        // Dlevel (20: BL_DLEVEL)
        const dlvlRaw = f[20] !== undefined ? String(f[20]) : "Dlvl:1";
        let branchName = "Dlvl";
        let levelNum = 1;
        const dlvlMatch = dlvlRaw.match(/^(.*?):?\s*(\d+)$/i);
        if (dlvlMatch) {
            branchName = dlvlMatch[1] || "Dlvl";
            levelNum = parseInt(dlvlMatch[2], 10) || 1;
        }

        // Conditions (22: BL_CONDITION) -> 常に string[] を保証
        let conditions = [];
        const condRaw = f[22] !== undefined ? f[22] : f[21];
        if (Array.isArray(condRaw)) {
            conditions = condRaw.map(c => String(c));
        } else if (typeof condRaw === 'string' && condRaw.trim()) {
            conditions = condRaw.split(/\s+/).filter(Boolean);
        } else if (typeof condRaw === 'number' && condRaw > 0) {
            const condFlags = [
                { bit: 0x1, name: "Stone" },
                { bit: 0x2, name: "Gold" },
                { bit: 0x4, name: "Sterm" },
                { bit: 0x8, name: "Blind" },
                { bit: 0x10, name: "Stun" },
                { bit: 0x20, name: "Conf" },
                { bit: 0x40, name: "Hallu" },
                { bit: 0x80, name: "Ill" },
                { bit: 0x100, name: "FoodPois" },
                { bit: 0x200, name: "Slimed" },
            ];
            condFlags.forEach(flag => {
                if ((condRaw & flag.bit) !== 0) conditions.push(flag.name);
            });
        }

        // Hunger status (17: BL_HUNGER) -> 常に string を保証
        const hungerStr = f[17] !== undefined ? String(f[17]).trim() : "";

        // Status Stats (1: BL_STR, 2: BL_DEX, 3: BL_CON, 4: BL_INT, 5: BL_WIS, 6: BL_CHA)
        const stats = {
            str: f[1] !== undefined ? String(f[1]) : "--",
            dex: parseInt(f[2] !== undefined ? f[2] : 0, 10) || 0,
            con: parseInt(f[3] !== undefined ? f[3] : 0, 10) || 0,
            int: parseInt(f[4] !== undefined ? f[4] : 0, 10) || 0,
            wis: parseInt(f[5] !== undefined ? f[5] : 0, 10) || 0,
            cha: parseInt(f[6] !== undefined ? f[6] : 0, 10) || 0
        };

        // Score (8: BL_SCORE) & Turns (16: BL_TIME)
        const rawScore = f[8] !== undefined ? f[8] : f[21];
        const scoreVal = parseInt(rawScore !== undefined ? rawScore : 0, 10) || 0;
        const turnsVal = parseInt(f[16] !== undefined ? f[16] : 0, 10) || 0;

        return {
            title: f[0] !== undefined ? String(f[0]) : "--",
            hp: { current: curHp, max: maxHp, percent: hpPercent },
            pw: { current: curPw, max: maxPw, percent: pwPercent },
            gold: { amount: goldAmount, glyphId: 3886 },
            dlevel: { branch: branchName, level: levelNum, text: dlvlRaw },
            conditions: conditions,
            hunger: hungerStr,
            stats: stats,
            score: scoreVal,
            ac: parseInt(f[13] !== undefined ? f[13] : (f[14] !== undefined ? f[14] : 10), 10) || 10,
            turns: turnsVal,
            allFields: { ...this.fields }
        };
    }
}
