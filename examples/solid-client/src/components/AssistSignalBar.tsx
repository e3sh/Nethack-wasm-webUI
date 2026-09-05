import { Component, Show, createSignal, createMemo } from 'solid-js';
import {
  isPlayerDead,
  engineState,
  status,
  gklSituation,
  currentLanguage
} from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';

export const AssistSignalBar: Component = () => {
  const [showWhyTooltip, setShowWhyTooltip] = createSignal(false);

  const isEn = () => currentLanguage() === 'en';

  const assistState = createMemo(() => {
    if (isPlayerDead() || engineState() !== 'RUNNING' || status.hpMax <= 0) {
      return null;
    }
    return gklSituation()?.assistState || null;
  });

  const primarySignal = createMemo(() => {
    if (isPlayerDead() || engineState() !== 'RUNNING' || status.hpMax <= 0) {
      return null;
    }
    return assistState()?.primarySignal || null;
  });

  const primaryAction = createMemo(() => {
    return assistState()?.primaryAction || null;
  });

  const barSeverityClass = createMemo(() => {
    const sig = primarySignal();
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

  const signalText = createMemo(() => {
    const sig = primarySignal();
    if (!sig) return '';
    return isEn()
      ? (sig.shortMessageEn || sig.shortMessageJa || '')
      : (sig.shortMessageJa || sig.shortMessageEn || '');
  });

  const actionLabel = createMemo(() => {
    const act = primaryAction();
    if (!act) return isEn() ? 'Execute' : '実行';
    return isEn()
      ? (act.labelEn || act.labelJa || 'Execute')
      : (act.labelJa || act.labelEn || '実行');
  });

  const whyText = createMemo(() => {
    const sig = primarySignal();
    if (!sig) return '';
    const text = isEn()
      ? (sig.detailWhyEn || sig.detailWhyJa)
      : (sig.detailWhyJa || sig.detailWhyEn);
    return text || (isEn() ? 'Recommended tactical move for survival.' : '生存率を高めるための推奨アクションです。');
  });

  const handleExecuteAction = (e: MouseEvent) => {
    e.stopPropagation();
    const act = primaryAction();
    if (!act || !act.keySequence || act.keySequence.length === 0) return;

    const rawSeq = JSON.parse(JSON.stringify(act.keySequence));
    driverController.executeSequence(rawSeq);
  };

  return (
    <Show when={primarySignal()}>
      <div class={`assist-signal-bar ${barSeverityClass()}`}>
        <div class="assist-signal-main">
          <span class="assist-signal-icon">{primarySignal()?.icon || '🛡️'}</span>
          <span class="assist-signal-text">{signalText()}</span>
        </div>

        <div class="assist-signal-actions">
          {/* Level 3 ワンタップ実行ボタン */}
          <Show when={primaryAction() && primaryAction()?.keySequence && primaryAction()?.keySequence.length > 0}>
            <button
              class="btn btn-assist-action"
              onClick={handleExecuteAction}
              title={whyText()}
            >
              ⚡ {actionLabel()}
            </button>
          </Show>

          {/* 理由ポップオーバー */}
          <button
            class="btn-assist-why"
            onClick={(e) => {
              e.stopPropagation();
              setShowWhyTooltip(!showWhyTooltip());
            }}
            title={isEn() ? 'Why this action?' : 'なぜこの行動？'}
          >
            ❓
          </button>
        </div>

        <Show when={showWhyTooltip()}>
          <div class="assist-why-tooltip">
            <strong>💡 {isEn() ? 'Tactical Reasoning:' : '状況推論と理由:'}</strong>
            <p style={{ margin: '4px 0 0 0' }}>{whyText()}</p>
          </div>
        </Show>
      </div>
    </Show>
  );
};
