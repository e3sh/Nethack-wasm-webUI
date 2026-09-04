import React, { useState, useMemo, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const AssistSignalBar: React.FC = () => {
  const [showWhyTooltip, setShowWhyTooltip] = useState(false);

  const isPlayerDead = useGameStore((state) => state.isPlayerDead);
  const engineState = useGameStore((state) => state.engineState);
  const hpMax = useGameStore((state) => state.status.hpMax);
  const gklSituation = useGameStore((state) => state.gklSituation);
  const currentLanguage = useGameStore((state) => state.currentLanguage);

  const { queueSequence, executeSequence } = useNetHackDriver();

  const isEn = currentLanguage === 'en';

  const assistState = useMemo(() => {
    if (isPlayerDead || engineState !== 'RUNNING' || hpMax <= 0) {
      return null;
    }
    return gklSituation?.assistState || null;
  }, [isPlayerDead, engineState, hpMax, gklSituation]);

  const primarySignal = useMemo(() => {
    if (isPlayerDead || engineState !== 'RUNNING' || hpMax <= 0) {
      return null;
    }
    return assistState?.primarySignal || null;
  }, [isPlayerDead, engineState, hpMax, assistState]);

  const primaryAction = useMemo(() => {
    return assistState?.primaryAction || null;
  }, [assistState]);

  const barSeverityClass = useMemo(() => {
    const sig = primarySignal;
    if (!sig) return '';
    if (sig.category === 'SURVIVAL' || (sig.priority && sig.priority >= 80)) {
      return 'danger';
    } else if (sig.priority && sig.priority >= 60) {
      return 'warning';
    } else if (sig.stance === 'CURE' || sig.category === 'TACTICAL_COMBAT') {
      return 'success';
    }
    return '';
  }, [primarySignal]);

  const signalText = useMemo(() => {
    const sig = primarySignal;
    if (!sig) return '';
    return isEn
      ? (sig.shortMessageEn || sig.shortMessageJa || '')
      : (sig.shortMessageJa || sig.shortMessageEn || '');
  }, [primarySignal, isEn]);

  const actionLabel = useMemo(() => {
    const act = primaryAction;
    if (!act) return isEn ? 'Execute' : '実行';
    return isEn
      ? (act.labelEn || act.labelJa || 'Execute')
      : (act.labelJa || act.labelEn || '実行');
  }, [primaryAction, isEn]);

  const whyText = useMemo(() => {
    const sig = primarySignal;
    if (!sig) return '';
    const text = isEn
      ? (sig.detailWhyEn || sig.detailWhyJa)
      : (sig.detailWhyJa || sig.detailWhyEn);
    return text || (isEn ? 'Recommended tactical move for survival.' : '生存率を高めるための推奨アクションです。');
  }, [primarySignal, isEn]);

  const handleExecuteAction = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const act = primaryAction;
    if (!act || !act.keySequence || act.keySequence.length === 0) return;

    const rawSeq = JSON.parse(JSON.stringify(act.keySequence));
    const res = await queueSequence(rawSeq);
    if (!res) {
      await executeSequence(rawSeq);
    }
  }, [primaryAction, queueSequence, executeSequence]);

  if (!primarySignal) return null;

  return (
    <div className={`assist-signal-bar ${barSeverityClass}`}>
      <div className="assist-signal-main">
        <span className="assist-signal-icon">{primarySignal.icon || '🛡️'}</span>
        <span className="assist-signal-text">{signalText}</span>
      </div>

      <div className="assist-signal-actions">
        {/* Level 3 ワンタップ実行ボタン */}
        {primaryAction && primaryAction.keySequence && primaryAction.keySequence.length > 0 && (
          <button
            className="btn btn-assist-action"
            onClick={handleExecuteAction}
          >
            <span className="assist-action-label">{actionLabel}</span>
          </button>
        )}

        {/* Why 理由解説ツールチップトグルボタン */}
        <button
          className="btn btn-assist-why"
          title="推奨理由を表示"
          onClick={(e) => {
            e.stopPropagation();
            setShowWhyTooltip((prev) => !prev);
          }}
        >
          ❓
        </button>
      </div>

      {/* Why 理由解説ツールチップ */}
      {showWhyTooltip && (
        <div className="assist-why-tooltip">
          {whyText}
        </div>
      )}
    </div>
  );
};
