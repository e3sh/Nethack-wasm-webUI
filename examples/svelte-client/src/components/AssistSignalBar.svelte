<script lang="ts">
  import {
    isPlayerDeadStore,
    engineStateStore,
    statusStore,
    gklSituationStore,
  } from '../stores/gameStore';
  import { currentLanguageStore, driverController } from '../services/useNetHackDriver';

  let showWhyTooltip = false;

  $: isEn = $currentLanguageStore === 'en';

  $: assistState = ($isPlayerDeadStore || $engineStateStore !== 'RUNNING' || $statusStore.hpMax <= 0)
    ? null
    : ($gklSituationStore?.assistState || null);

  $: primarySignal = ($isPlayerDeadStore || $engineStateStore !== 'RUNNING' || $statusStore.hpMax <= 0)
    ? null
    : (assistState?.primarySignal || null);

  $: primaryAction = assistState?.primaryAction || null;

  $: barSeverityClass = (() => {
    if (!primarySignal) return '';
    if (primarySignal.category === 'SURVIVAL' || (primarySignal.priority && primarySignal.priority >= 80)) {
      return 'danger';
    } else if (primarySignal.priority && primarySignal.priority >= 60) {
      return 'warning';
    } else if (primarySignal.stance === 'CURE' || primarySignal.category === 'TACTICAL_COMBAT') {
      return 'success';
    }
    return '';
  })();

  $: signalText = (() => {
    if (!primarySignal) return '';
    return isEn
      ? (primarySignal.shortMessageEn || primarySignal.shortMessageJa || '')
      : (primarySignal.shortMessageJa || primarySignal.shortMessageEn || '');
  })();

  $: actionLabel = (() => {
    if (!primaryAction) return isEn ? 'Execute' : '実行';
    return isEn
      ? (primaryAction.labelEn || primaryAction.labelJa || 'Execute')
      : (primaryAction.labelJa || primaryAction.labelEn || '実行');
  })();

  $: whyText = (() => {
    if (!primarySignal) return '';
    const text = isEn
      ? (primarySignal.detailWhyEn || primarySignal.detailWhyJa)
      : (primarySignal.detailWhyJa || primarySignal.detailWhyEn);
    return text || (isEn ? 'Recommended tactical move for survival.' : '生存率を高めるための推奨アクションです。');
  })();

  const handleExecuteAction = (e: MouseEvent) => {
    e.stopPropagation();
    if (!primaryAction || !primaryAction.keySequence || primaryAction.keySequence.length === 0) return;

    const rawSeq = JSON.parse(JSON.stringify(primaryAction.keySequence));
    driverController.executeSequence(rawSeq);
  };
</script>

{#if primarySignal}
  <div class="assist-signal-bar {barSeverityClass}">
    <div class="assist-signal-main">
      <span class="assist-signal-icon">{primarySignal.icon || '🛡️'}</span>
      <span class="assist-signal-text">{signalText}</span>
    </div>

    <div class="assist-signal-actions">
      <!-- Level 3 ワンタップ実行ボタン -->
      {#if primaryAction && primaryAction.keySequence && primaryAction.keySequence.length > 0}
        <button
          class="btn btn-assist-action"
          on:click={handleExecuteAction}
          title={whyText}
        >
          ⚡ {actionLabel}
        </button>
      {/if}

      <!-- 理由ポップオーバー -->
      <button
        class="btn-assist-why"
        on:click={(e) => {
          e.stopPropagation();
          showWhyTooltip = !showWhyTooltip;
        }}
        title={isEn ? 'Why this action?' : 'なぜこの行動？'}
      >
        ❓
      </button>
    </div>

    {#if showWhyTooltip}
      <div class="assist-why-tooltip">
        <strong>💡 {isEn ? 'Tactical Reasoning:' : '状況推論と理由:'}</strong>
        <p style="margin: 4px 0 0 0;">{whyText}</p>
      </div>
    {/if}
  </div>
{/if}
