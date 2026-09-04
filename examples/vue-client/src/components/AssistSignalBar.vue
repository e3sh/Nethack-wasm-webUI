<template>
  <div
    v-if="primarySignal"
    class="assist-signal-bar"
    :class="barSeverityClass"
  >
    <div class="assist-signal-main">
      <span class="assist-signal-icon">{{ primarySignal.icon || '🛡️' }}</span>
      <span class="assist-signal-text">{{ signalText }}</span>
    </div>

    <div class="assist-signal-actions">
      <!-- Level 3 ワンタップ実行ボタン -->
      <button
        v-if="primaryAction && primaryAction.keySequence && primaryAction.keySequence.length > 0"
        class="btn btn-assist-action"
        @click="handleExecuteAction"
      >
        <span class="assist-action-label">{{ actionLabel }}</span>
      </button>

      <!-- Why 理由解説ツールチップトグルボタン -->
      <button
        class="btn btn-assist-why"
        title="推奨理由を表示"
        @click.stop="toggleWhyTooltip"
      >
        ❓
      </button>
    </div>

    <!-- Why 理由解説ツールチップ -->
    <div v-if="showWhyTooltip" class="assist-why-tooltip">
      {{ whyText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../composables/useNetHackDriver';
import { storeToRefs } from 'pinia';

const gameStore = useGameStore();
const { gklSituation } = storeToRefs(gameStore);
const { currentLanguage, queueSequence, executeSequence } = useNetHackDriver();

const showWhyTooltip = ref(false);

const isEn = computed(() => currentLanguage.value === 'en');

const assistState = computed(() => {
  if (gameStore.isPlayerDead || gameStore.engineState !== 'RUNNING' || gameStore.status.hpMax <= 0) {
    return null;
  }
  return gklSituation.value?.assistState || null;
});

const primarySignal = computed(() => {
  if (gameStore.isPlayerDead || gameStore.engineState !== 'RUNNING' || gameStore.status.hpMax <= 0) {
    return null;
  }
  return assistState.value?.primarySignal || null;
});

const primaryAction = computed(() => {
  return assistState.value?.primaryAction || null;
});

const barSeverityClass = computed(() => {
  const sig = primarySignal.value;
  if (!sig) return '';
  if (sig.category === 'SURVIVAL' || (sig.priority && sig.priority >= 80)) {
    return 'danger';
  } else if (sig.priority && sig.priority >= 60) {
    return 'warning';
  } else if (sig.stance === 'CURE' || sig.category === 'TACTICAL_COMBAT') {
    return 'success';
  }
  return '';
});

const signalText = computed(() => {
  const sig = primarySignal.value;
  if (!sig) return '';
  return isEn.value
    ? (sig.shortMessageEn || sig.shortMessageJa || '')
    : (sig.shortMessageJa || sig.shortMessageEn || '');
});

const actionLabel = computed(() => {
  const act = primaryAction.value;
  if (!act) return isEn.value ? 'Execute' : '実行';
  return isEn.value
    ? (act.labelEn || act.labelJa || 'Execute')
    : (act.labelJa || act.labelEn || '実行');
});

const whyText = computed(() => {
  const sig = primarySignal.value;
  if (!sig) return '';
  const text = isEn.value
    ? (sig.detailWhyEn || sig.detailWhyJa)
    : (sig.detailWhyJa || sig.detailWhyEn);
  return text || (isEn.value ? 'Recommended tactical move for survival.' : '生存率を高めるための推奨アクションです。');
});

function toggleWhyTooltip() {
  showWhyTooltip.value = !showWhyTooltip.value;
}

async function handleExecuteAction(e: MouseEvent) {
  e.stopPropagation();
  const act = primaryAction.value;
  if (!act || !act.keySequence || act.keySequence.length === 0) return;

  const rawSeq = JSON.parse(JSON.stringify(act.keySequence));
  const res = await queueSequence(rawSeq);
  if (!res) {
    await executeSequence(rawSeq);
  }
}
</script>

<style scoped>
.assist-signal-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: linear-gradient(90deg, #1e293b, #0f172a);
  border: 1px solid #334155;
  border-left: 5px solid #38bdf8;
  border-radius: 6px;
  font-size: 13px;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  transition: all 0.3s ease;
  user-select: none;
}

.assist-signal-bar.danger {
  background: linear-gradient(90deg, rgba(220, 38, 38, 0.25), #1e1b2e);
  border-color: #ef4444;
  border-left-color: #ef4444;
  animation: pulse-danger-border 1.5s infinite;
}

.assist-signal-bar.warning {
  background: linear-gradient(90deg, rgba(217, 119, 6, 0.2), #1e1b2e);
  border-color: #f59e0b;
  border-left-color: #f59e0b;
}

.assist-signal-bar.success {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.2), #1e1b2e);
  border-color: #10b981;
  border-left-color: #10b981;
}

@keyframes pulse-danger-border {
  0% { box-shadow: 0 0 4px rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 12px rgba(239, 68, 68, 0.8); }
  100% { box-shadow: 0 0 4px rgba(239, 68, 68, 0.4); }
}

.assist-signal-main {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #f8fafc;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assist-signal-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.assist-signal-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assist-signal-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.btn-assist-action {
  background: #2563eb;
  color: #ffffff;
  border: none;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.assist-signal-bar.danger .btn-assist-action {
  background: #dc2626;
}

.assist-signal-bar.danger .btn-assist-action:hover {
  background: #b91c1c;
}

.assist-signal-bar.warning .btn-assist-action {
  background: #d97706;
}

.assist-signal-bar.warning .btn-assist-action:hover {
  background: #b45309;
}

.btn-assist-action:hover {
  background: #1d4ed8;
}

.btn-assist-why {
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-assist-why:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.assist-why-tooltip {
  position: absolute;
  top: 100%;
  right: 12px;
  margin-top: 4px;
  background: #0f172a;
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #e2e8f0;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  max-width: 320px;
  white-space: normal;
}
</style>
