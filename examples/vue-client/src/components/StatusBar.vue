<template>
  <div class="status-bar">
    <div class="status-main">
      <span class="st-item title">{{ status.title || 'Hero' }}</span>
      <span class="st-item dlvl">{{ status.dlvl }}</span>

      <!-- HP ゲージバー -->
      <div class="gauge-box">
        <span class="st-item hp">HP:{{ status.hp }}({{ status.hpMax }})</span>
        <div class="gauge-bg">
          <div
            class="gauge-fill hp-fill"
            :style="{ width: `${hpPercent}%`, background: hpColor }"
          ></div>
        </div>
      </div>

      <!-- MP ゲージバー -->
      <div class="gauge-box">
        <span class="st-item pw">Pw:{{ status.pw }}({{ status.pwMax }})</span>
        <div class="gauge-bg">
          <div
            class="gauge-fill mp-fill"
            :style="{ width: `${pwPercent}%` }"
          ></div>
        </div>
      </div>

      <span class="st-item ac">AC:{{ status.ac }}</span>
      <span class="st-item gold">💰 {{ status.gold }}</span>

      <!-- 詳細ステータス展開トグルボタン -->
      <button
        class="btn-status-toggle"
        :title="showDetails ? '詳細を折りたたむ' : '詳細を展開'"
        @click="showDetails = !showDetails"
      >
        {{ showDetails ? '▲' : '▼' }}
      </button>
    </div>

    <!-- 動的バッジエリア (Hunger & Condition & 危機) -->
    <div class="status-badges">
      <!-- 認識された種族・職業バッジ -->
      <span v-if="characterTag" class="badge char-badge">
        {{ characterTag }}
      </span>

      <span v-if="status.hunger" class="badge hunger-badge">
        {{ status.hunger }}
      </span>
      <span
        v-for="(cond, idx) in status.condition"
        :key="idx"
        class="badge cond-badge"
      >
        {{ cond }}
      </span>
      <span
        v-if="hasCriticalAdvice"
        class="badge cond-badge critical-crisis"
        title="重大な危険が発生中 (右下の戦術アドバイスを確認)"
      >
        🚨 危険
      </span>
    </div>

    <!-- 展開詳細行 (詳細ステータス領域) -->
    <div v-show="showDetails" class="status-details">
      <!-- 6大能力値グリッド -->
      <div class="status-stats-grid">
        <span class="st-item stat"><label>St:</label>{{ status.stats.str || '--' }}</span>
        <span class="st-item stat"><label>Dx:</label>{{ status.stats.dex || '--' }}</span>
        <span class="st-item stat"><label>Co:</label>{{ status.stats.con || '--' }}</span>
        <span class="st-item stat"><label>In:</label>{{ status.stats.int || '--' }}</span>
        <span class="st-item stat"><label>Wi:</label>{{ status.stats.wis || '--' }}</span>
        <span class="st-item stat"><label>Ch:</label>{{ status.stats.cha || '--' }}</span>
      </div>

      <div class="status-extra-grid">
        <span class="st-item align"><label>Align:</label>{{ status.align || 'Neutral' }}</span>
        <span class="st-item exp"><label>Exp:</label>{{ status.level }}{{ status.exp > 0 ? `/${status.exp}` : '' }}</span>
        <span class="st-item turns"><label>T:</label>{{ status.turns }}</span>
        <span v-if="status.score > 0" class="st-item score"><label>Score:</label>{{ status.score }}</span>
      </div>

      <!-- GKL 拡張: 属性耐性 ＆ 修得魔法 ＆ スキル熟練度の詳細行 -->
      <div class="status-gkl-extra">
        <!-- 🛡️ 確定属性耐性 -->
        <div class="gkl-detail-row">
          <strong class="detail-label">🛡️ {{ isEn ? 'Resistances:' : '確定耐性:' }}</strong>
          <div v-if="activeResistances.length > 0" class="detail-badges-list">
            <span
              v-for="attr in activeResistances"
              :key="attr.key"
              class="attr-badge active"
              :title="`${attr.label} (${attr.en})`"
            >
              {{ isEn ? attr.en : attr.label }}
            </span>
          </div>
          <span v-else class="detail-empty">{{ isEn ? 'None' : 'なし' }}</span>
        </div>

        <!-- 📖 修得魔法 -->
        <div class="gkl-detail-row">
          <strong class="detail-label">📖 {{ isEn ? 'Spells:' : '修得魔法:' }}</strong>
          <div v-if="spellsList.length > 0" class="detail-badges-list">
            <button
              v-for="sp in spellsList"
              :key="sp.letter"
              class="spell-tag-btn"
              :title="`[${sp.letter}] ${sp.name} (Lv.${sp.level} 失敗率:${sp.failRate})`"
              @click="handleCastSpell(sp.letter)"
            >
              ✨ [{{ sp.letter }}] {{ sp.name }} <small>({{ sp.failRate }})</small>
            </button>
          </div>
          <span v-else class="detail-empty">{{ isEn ? 'None' : 'なし' }}</span>
        </div>

        <!-- 🥋 スキル熟練度 -->
        <div class="gkl-detail-row">
          <strong class="detail-label">🥋 {{ isEn ? 'Skills:' : 'スキル熟練度:' }}</strong>
          <div v-if="skillsList.length > 0" class="detail-badges-list">
            <span
              v-for="sk in skillsList"
              :key="sk.name"
              class="skill-tag"
              :class="{ 'can-enhance': sk.canEnhance }"
              :title="sk.rawText || sk.name"
              @click="handleEnhanceSkill(sk)"
            >
              <span v-if="sk.canEnhance">⭐</span>
              {{ sk.name }} [{{ isEn ? (sk.rank?.en || sk.rank?.label) : (sk.rank?.label || sk.rank?.en) }}]
            </span>
          </div>
          <span v-else class="detail-empty">{{ isEn ? 'None' : 'なし' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../composables/useNetHackDriver';
import { storeToRefs } from 'pinia';
const gameStore = useGameStore();
const { status, gklSituation } = storeToRefs(gameStore);
const { currentLanguage, castSpell, enhanceSkill } = useNetHackDriver();

const showDetails = ref(true); // 初期状態で詳細を展開

const isEn = computed(() => currentLanguage.value === 'en');

const hpPercent = computed(() => {
  if (!status.value.hpMax || status.value.hpMax <= 0) return 0;
  return Math.min(100, Math.max(0, (status.value.hp / status.value.hpMax) * 100));
});

const pwPercent = computed(() => {
  if (!status.value.pwMax || status.value.pwMax <= 0) return 0;
  return Math.min(100, Math.max(0, (status.value.pw / status.value.pwMax) * 100));
});

const hpColor = computed(() => {
  const pct = hpPercent.value;
  if (pct <= 25) return '#ef4444';
  if (pct <= 50) return '#f59e0b';
  return '#10b981';
});

const hasCriticalAdvice = computed(() => {
  if (gameStore.isPlayerDead || gameStore.engineState !== 'RUNNING' || gameStore.status.hpMax <= 0) {
    return false;
  }
  const sit = gklSituation.value;
  const advices = sit?.advices || sit?.tacticalAdvices || [];
  return advices.some((adv: any) => adv.isCritical || adv.severity === 'CRITICAL');
});

const characterTag = computed(() => {
  const sit = gklSituation.value;
  const summary = sit?.attributes?.characterSummary || sit?.playerState?.attributes?.characterSummary;
  if (summary?.displayTag) {
    return isEn.value ? (summary.displayTagEn || summary.displayTag) : (summary.displayTagJa || summary.displayTag);
  }
  const charInfo = sit?.attributes?.characterInfo || sit?.playerState?.attributes?.characterInfo;
  if (charInfo && (charInfo.race || charInfo.role)) {
    return `👤 ${charInfo.race || '??'} / ${charInfo.role || '??'}${charInfo.level ? ` Lv.${charInfo.level}` : ''}`;
  }
  return '';
});

const activeResistances = computed(() => {
  const sit = gklSituation.value;
  const attrState = sit?.attributes || sit?.playerState?.attributes || {};
  return attrState.activeResistances || [];
});

const spellsList = computed(() => {
  const sit = gklSituation.value;
  return sit?.spells?.items || sit?.spells?.spells || sit?.playerState?.spells?.spells || [];
});

const skillsList = computed(() => {
  const sit = gklSituation.value;
  return sit?.skills?.activeItems || sit?.skills?.items || sit?.skills?.skills || sit?.playerState?.skills?.skills || [];
});

function handleCastSpell(letter: string) {
  castSpell(letter);
}

function handleEnhanceSkill(skill: any) {
  enhanceSkill(skill);
}
</script>

<style scoped>
.status-bar {
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e5e7eb;
  font-family: monospace;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: bold;
}

.title { color: #34d399; }
.dlvl { color: #fbbf24; }
.hp { color: #f87171; font-size: 13px; }
.pw { color: #60a5fa; font-size: 13px; }
.ac { color: #c084fc; }
.gold { color: #facc15; }

.gauge-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 90px;
}

.gauge-bg {
  width: 100%;
  height: 5px;
  background: #374151;
  border-radius: 3px;
  overflow: hidden;
}

.gauge-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.mp-fill {
  background: #3b82f6;
}

.btn-status-toggle {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #cbd5e1;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  margin-left: auto;
  transition: all 0.2s;
}

.btn-status-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.status-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
}

.char-badge {
  background: #334155;
  color: #38bdf8;
  border: 1px solid #475569;
}

.hunger-badge {
  background-color: #d97706;
  color: #ffffff;
}

.cond-badge {
  background-color: #dc2626;
  color: #ffffff;
}

.critical-crisis {
  animation: pulse-crit 1s infinite;
}

@keyframes pulse-crit {
  0% { transform: scale(1); }
  50% { transform: scale(1.06); }
  100% { transform: scale(1); }
}

.status-details {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
}

.status-stats-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat {
  font-weight: bold;
  color: #f1f5f9;
}

.stat label {
  color: #9ca3af;
  margin-right: 2px;
  font-weight: normal;
}

.status-extra-grid {
  display: flex;
  gap: 12px;
  color: #d1d5db;
}

.status-extra-grid span label {
  color: #9ca3af;
  margin-right: 2px;
}

.status-gkl-extra {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 6px;
}

.gkl-detail-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.detail-label {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
}

.detail-badges-list {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.attr-badge {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.spell-tag-btn {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.spell-tag-btn:hover {
  background: rgba(59, 130, 246, 0.3);
  color: #ffffff;
}

.skill-tag {
  background: rgba(245, 158, 11, 0.15);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.skill-tag.can-enhance {
  background: rgba(16, 185, 129, 0.25);
  color: #6ee7b7;
  border-color: #10b981;
  font-weight: bold;
}

.detail-empty {
  color: #6b7280;
  font-size: 11px;
}
</style>
