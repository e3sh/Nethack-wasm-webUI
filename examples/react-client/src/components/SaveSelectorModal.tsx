import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';
import { trapFocus } from '@core/input/focusTrap.js';

export const SaveSelectorModal: React.FC = () => {
  const pendingSaveInfo = useGameStore((state) => state.pendingSaveInfo);
  const currentLanguage = useGameStore((state) => state.currentLanguage);
  const isEn = currentLanguage === 'en';
  const { resumeSavedGame, startNewGame } = useNetHackDriver();
  const modalCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pendingSaveInfo) return;
      if (e.key === 'Tab' && modalCardRef.current) {
        trapFocus(modalCardRef.current, e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingSaveInfo]);

  if (!pendingSaveInfo) return null;

  const handleStartNew = () => {
    const confirmMsg = isEn
      ? 'Delete saved game and start a new game?'
      : '保存されているセーブデータを破棄して最初から開始しますか？';
    if (window.confirm(confirmMsg)) {
      startNewGame();
    }
  };

  return (
    <div className="modal-backdrop">
      <div ref={modalCardRef} className="modal-card">
        <div className="modal-header">
          <h2>{isEn ? '💾 Saved Game Detected' : '💾 セーブデータが見つかりました'}</h2>
        </div>
        <div className="modal-body">
          <p className="save-desc">
            {isEn
              ? 'A previous adventure was found. Do you want to resume or start a new game?'
              : '前回の冒険記録が残っています。再開しますか？それとも新規に開始しますか？'}
          </p>
          <div className="save-info-box">
            <span className="label">{isEn ? 'Player Name:' : '冒険者名 (Player):'}</span>
            <strong className="player-name">
              {pendingSaveInfo.savePlayerName || 'Hero'}
            </strong>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={() => resumeSavedGame()} className="btn btn-primary btn-large">
            {isEn ? '▶️ Resume Saved Game (Continue)' : '▶️ セーブデータから再開 (Continue Game)'}
          </button>
          <button onClick={handleStartNew} className="btn btn-danger">
            {isEn ? '⚠️ Start New Game (Delete Save)' : '⚠️ 新規ゲーム開始 (New Game / セーブ破棄)'}
          </button>
        </div>
      </div>
    </div>
  );
};
