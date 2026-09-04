<template>
  <div class="gkl-card knowledge-tabs-card">
    <div class="gkl-card-header gkl-card-header-tabs">
      <div class="gkl-header-tabs">
        <button
          class="gkl-tab-btn"
          :class="{ active: activeTab === 'advices' }"
          :title="isEn ? 'Show tactical advices and danger warnings' : '戦術アドバイス ＆ 危険警告を表示'"
          @click="activeTab = 'advices'"
        >
          🛡️ {{ isEn ? 'Advice' : 'アドバイス' }}
          <span v-if="tacticalAdvices.length > 0" class="gkl-badge">{{ tacticalAdvices.length }}</span>
        </button>

        <button
          class="gkl-tab-btn"
          :class="{ active: activeTab === 'knowledge' }"
          :title="isEn ? 'Show structured knowledge for inspected tile/item' : '直前に調査した構造化ナレッジを表示'"
          @click="activeTab = 'knowledge'"
        >
          💡 {{ isEn ? 'Knowledge' : 'ナレッジ' }}
        </button>
      </div>
    </div>

    <div class="gkl-knowledge-content">
      <!-- 1. 🛡️ アドバイスタブ -->
      <div v-if="activeTab === 'advices'" class="tab-pane-advices">
        <div v-if="tacticalAdvices.length === 0" class="gkl-empty-hint">
          {{ isEn ? 'No urgent tactical advices' : '現在、特に緊急の戦術アドバイスはありません' }}
        </div>

        <div
          v-for="(adv, idx) in tacticalAdvices"
          :key="idx"
          class="advice-item"
          :class="{ 'is-critical': adv.isCritical || adv.severity === 'CRITICAL' }"
        >
          <span class="advice-icon">{{ (adv.isCritical || adv.severity === 'CRITICAL') ? '⚠️' : '💡' }}</span>
          <div class="advice-text">
            {{ typeof adv === 'string' ? adv : (isEn ? (adv.textEn || adv.messageEn || adv.text || adv.message || adv.advice) : (adv.textJa || adv.messageJa || adv.text || adv.message || adv.advice)) }}
          </div>
        </div>
      </div>

      <!-- 2. 💡 ナレッジタブ -->
      <div v-else-if="activeTab === 'knowledge'" class="tab-pane-knowledge">
        <div v-if="!currentKnowledge" class="gkl-empty-hint">
          {{ isEn ? 'Hover on zoom camera or inventory item to inspect knowledge' : 'ズームカメラホバーまたは所持品選択でナレッジ表示' }}
        </div>

        <div v-else class="knowledge-view-container">
          <div class="knowledge-title-bar">
            <span class="k-name">{{ knowledgeName }}</span>
            <span v-if="currentKnowledge.category" class="k-cat-badge">{{ currentKnowledge.category }}</span>
          </div>

          <!-- 危険度・ステータスインジケーター -->
          <div class="k-status-bar">
            <!-- 態度・ディスポジションバッジ -->
            <span
              v-if="dispositionBadgeInfo"
              class="kn-status-badge"
              :class="dispositionBadgeInfo.badgeClass"
            >
              {{ dispositionBadgeInfo.label }}
            </span>

            <!-- 危険度バッジ -->
            <span
              v-if="currentKnowledge.dangerLevel && currentKnowledge.dangerLevel !== 'NONE'"
              class="kn-danger-badge"
              :class="`danger-${currentKnowledge.dangerLevel.toLowerCase()}`"
            >
              {{ currentKnowledge.dangerLevel }} DANGER
            </span>

            <!-- Look 確定確認済みバッジ -->
            <span v-if="currentKnowledge.isClickConfirmed || hoveredTileKnowledge?.isClickConfirmed" class="kn-status-badge kn-status-confirmed">
              {{ isEn ? '🔍 Look Inspected' : '🔍 Look確認済み' }}
            </span>
          </div>

          <!-- 通常平和モンスターの注釈 -->
          <div v-if="currentKnowledge.dispositionStatus === 'DEFAULT_PEACEFUL'" class="k-peaceful-note">
            {{ isEn ? '※ Normally peaceful; becomes hostile (LETHAL) if attacked or stolen from.' : '※ 通常は平和的ですが、攻撃・泥棒を行うと敵対化 (LETHAL) します' }}
          </div>

          <!-- モンスター / プレイヤー 構造化ステータス行 (HD/Lv, AC, HP, Pw, Gold, Dlvl, 所持品数) -->
          <div v-if="monsterStats" class="k-stats-row">
            <span>HD/Lv:{{ monsterStats.hd ?? '-' }}</span>
            <span>AC:{{ monsterStats.ac ?? '-' }}</span>
            <span v-if="monsterStats.hp" class="text-hp">HP:{{ monsterStats.hp }}</span>
            <span v-if="monsterStats.pw" class="text-pw">Pw:{{ monsterStats.pw }}</span>
            <span v-if="monsterStats.gold" class="text-gold">{{ isEn ? 'Gold:' : '金:' }}{{ monsterStats.gold }}</span>
            <span v-if="monsterStats.dlvl">{{ monsterStats.dlvl }}</span>
            <span v-if="currentKnowledge.inventoryCount !== undefined" class="text-inv">🎒{{ isEn ? 'Items:' : '所持品:' }}{{ currentKnowledge.inventoryCount }}</span>
          </div>

          <!-- 死体警告ボックス -->
          <div v-if="currentKnowledge.corpseInfo?.warningNote" class="k-warning-box">
            ⚠️ {{ currentKnowledge.corpseInfo.warningNote }}
          </div>

          <!-- 説明・効果要約 -->
          <div v-if="currentKnowledge.effectSummary || currentKnowledge.summary || currentKnowledge.description" class="k-desc">
            {{ currentKnowledge.effectSummary || currentKnowledge.summary || currentKnowledge.description }}
          </div>

          <!-- 実戦戦術アドバイス (Tactical Advice) -->
          <div v-if="currentKnowledge.tacticalAdvice && currentKnowledge.tacticalAdvice.length > 0" class="k-advice-section">
            <div class="k-section-label">💡 {{ isEn ? 'Tactical Advice' : '実戦戦術アドバイス' }}</div>
            <ul class="k-advice-list">
              <li v-for="(adv, advIdx) in currentKnowledge.tacticalAdvice" :key="advIdx">• {{ adv }}</li>
            </ul>
          </div>

          <!-- 用途・活用アドバイス (Usage Advice) -->
          <div v-if="currentKnowledge.usageAdvice && currentKnowledge.usageAdvice.length > 0" class="k-advice-section">
            <div class="k-section-label">💡 {{ isEn ? 'Usage & Strategy Advice' : '用途・活用アドバイス' }}</div>
            <ul class="k-advice-list">
              <li v-for="(uAdv, uIdx) in currentKnowledge.usageAdvice" :key="uIdx">• {{ uAdv }}</li>
            </ul>
          </div>

          <!-- 識別戦術テクニック (Unidentified Tips) -->
          <div v-if="currentKnowledge.unidentifiedTips && currentKnowledge.unidentifiedTips.length > 0" class="k-advice-section">
            <div class="k-section-label">🔍 {{ isEn ? 'Identification Tips' : '識別戦術テクニック' }}</div>
            <ul class="k-advice-list">
              <li v-for="(tip, tIdx) in currentKnowledge.unidentifiedTips" :key="tIdx">• {{ tip }}</li>
            </ul>
          </div>

          <!-- 耐性・弱点・特効タグ -->
          <div v-if="knowledgeTags.length > 0" class="k-tags-list">
            <span
              v-for="(t, tIdx) in knowledgeTags"
              :key="tIdx"
              class="k-tag"
              :class="t.type"
            >
              {{ t.label }}
            </span>
          </div>

          <!-- 推奨アクションヒント -->
          <div v-if="currentKnowledge.actionLabel" class="k-action-hint">
            💡 {{ isEn ? 'Recommended Move:' : '推奨アクション:' }} <strong>{{ currentKnowledge.actionLabel }}</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../composables/useNetHackDriver';
import { storeToRefs } from 'pinia';

const gameStore = useGameStore();
const { gklSituation, hoveredTileKnowledge } = storeToRefs(gameStore);
const { currentLanguage } = useNetHackDriver();

const activeTab = ref<'advices' | 'knowledge'>('advices');

const isEn = computed(() => currentLanguage.value === 'en');

// アドバイス: advices または tacticalAdvices から取得
const tacticalAdvices = computed(() => {
  if (gameStore.isPlayerDead || gameStore.engineState !== 'RUNNING' || gameStore.status.hpMax <= 0) {
    return [];
  }
  const sit = gklSituation.value;
  return sit?.advices || sit?.tacticalAdvices || [];
});

// ナレッジがホバーまたはクリックされたら自動でナレッジタブに切り替え
watch(hoveredTileKnowledge, (newVal) => {
  if (newVal) {
    activeTab.value = 'knowledge';
  }
});

const currentKnowledge = computed(() => {
  if (hoveredTileKnowledge.value?.knowledge) {
    return hoveredTileKnowledge.value.knowledge;
  }
  return hoveredTileKnowledge.value || null;
});

const knowledgeName = computed(() => {
  const k = currentKnowledge.value;
  if (!k) return '';
  return isEn.value ? (k.nameEn || k.name || k.title) : (k.nameJa || k.name || k.title);
});

const dispositionBadgeInfo = computed(() => {
  const k = currentKnowledge.value;
  if (!k) return null;
  const disp = k.dispositionStatus;
  const isPet = k.type === 'PET' || k.isPet;
  const isPlayer = k.type === 'PLAYER' || k.isPlayer;

  if (disp === 'PEACEFUL') {
    return { label: isEn.value ? '☮️ Peaceful (SAFE)' : '☮️ 平和的 (SAFE)', badgeClass: 'kn-status-peaceful' };
  } else if (disp === 'DEFAULT_PEACEFUL') {
    return { label: isEn.value ? '☮️ Normally Peaceful' : '☮️ 通常平和 (SAFE)', badgeClass: 'kn-status-peaceful' };
  } else if (disp === 'TAMED' || isPet) {
    return { label: isEn.value ? '🐾 Pet (TAMED)' : '🐾 ペット (TAMED)', badgeClass: 'kn-status-tamed' };
  } else if (disp === 'PLAYER' || isPlayer) {
    return { label: isEn.value ? '👤 Player' : '👤 プレイヤー', badgeClass: 'kn-status-player' };
  } else if (disp === 'HOSTILE' || k.dangerLevel) {
    return { label: isEn.value ? `⚔️ Hostile (${k.dangerLevel || 'LETHAL'})` : `⚔️ 敵対的 (${k.dangerLevel || 'LETHAL'})`, badgeClass: 'kn-status-hostile' };
  }
  return null;
});

const monsterStats = computed(() => {
  const k = currentKnowledge.value;
  if (!k || !k.stats) return null;
  return k.stats;
});

const knowledgeTags = computed(() => {
  const k = currentKnowledge.value;
  if (!k) return [];
  const tags: Array<{ label: string; type: string }> = [];

  if (k.resistances && Array.isArray(k.resistances)) {
    k.resistances.forEach((r: string) => tags.push({ label: `耐: ${r}`, type: 'res' }));
  }
  if (k.weaknesses && Array.isArray(k.weaknesses)) {
    k.weaknesses.forEach((w: string) => tags.push({ label: `弱: ${w}`, type: 'weak' }));
  }
  if (k.traits && Array.isArray(k.traits)) {
    k.traits.forEach((t: string) => tags.push({ label: t, type: 'trait' }));
  }
  return tags;
});
</script>

<style scoped>
.gkl-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.gkl-card-header-tabs {
  padding: 0;
  background: #0f172a;
  border-bottom: 1px solid #334155;
}

.gkl-header-tabs {
  display: flex;
  gap: 2px;
}

.gkl-tab-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.gkl-tab-btn:hover {
  color: #f1f5f9;
}

.gkl-tab-btn.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
}

.gkl-badge {
  background: #38bdf8;
  color: #0f172a;
  font-size: 10px;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 10px;
}

.gkl-knowledge-content {
  padding: 10px;
  max-height: 220px;
  overflow-y: auto;
}

.gkl-empty-hint {
  text-align: center;
  color: #64748b;
  font-size: 12px;
  padding: 16px 0;
}

.tab-pane-advices {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.advice-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 10px;
  background: #0f172a;
  border: 1px solid #334155;
  border-left: 3px solid #10b981;
  border-radius: 4px;
  font-size: 12px;
  color: #e2e8f0;
}

.advice-item.is-critical {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  font-weight: 600;
}

.advice-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.advice-text {
  line-height: 1.4;
}

.knowledge-view-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.knowledge-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.k-name {
  font-size: 13px;
  font-weight: 700;
  color: #f8fafc;
}

.k-cat-badge {
  font-size: 10px;
  background: #334155;
  color: #94a3b8;
  padding: 1px 6px;
  border-radius: 4px;
}

.k-status-bar {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.kn-status-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
}

.kn-status-peaceful {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.kn-status-tamed {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.kn-status-player {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.4);
}

.kn-status-hostile {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.kn-status-confirmed {
  background: rgba(234, 179, 8, 0.15);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.kn-danger-badge {
  font-size: 10px;
  font-weight: bold;
  padding: 1px 6px;
  border-radius: 4px;
  background: #ef4444;
  color: #fff;
}

.kn-danger-badge.danger-safe {
  background: #10b981;
}

.kn-danger-badge.danger-medium {
  background: #f59e0b;
}

.kn-danger-badge.danger-lethal {
  background: #dc2626;
}

.k-peaceful-note {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.3;
}

.k-stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.6);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #334155;
}

.text-hp { color: #4ade80; font-weight: bold; }
.text-pw { color: #60a5fa; font-weight: bold; }
.text-gold { color: #facc15; font-weight: bold; }
.text-inv { color: #c084fc; font-weight: bold; }

.k-warning-box {
  background: rgba(220, 38, 38, 0.15);
  border: 1px solid #ef4444;
  color: #fca5a5;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
}

.k-desc {
  font-size: 11px;
  color: #cbd5e1;
  line-height: 1.4;
}

.k-advice-section {
  margin-top: 2px;
}

.k-section-label {
  font-size: 11px;
  font-weight: bold;
  color: #38bdf8;
  margin-bottom: 2px;
}

.k-advice-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 11px;
  color: #cbd5e1;
  line-height: 1.4;
}

.k-tags-list {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.k-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.k-tag.res { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
.k-tag.weak { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
.k-tag.trait { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }

.k-action-hint {
  font-size: 11px;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  border-left: 3px solid #38bdf8;
}
</style>
