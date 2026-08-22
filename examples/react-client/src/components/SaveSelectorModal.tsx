import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const SaveSelectorModal: React.FC = () => {
  const pendingSaveInfo = useGameStore((state) => state.pendingSaveInfo);
  const { resumeSavedGame, startNewGame } = useNetHackDriver();

  if (!pendingSaveInfo) return null;

  const handleStartNew = () => {
    if (window.confirm('保存されているセーブデータを破棄して最初から開始しますか？')) {
      startNewGame();
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h2>💾 セーブデータが見つかりました</h2>
        </div>
        <div className="modal-body">
          <p className="save-desc">
            前回の冒険記録が残っています。再開しますか？それとも新規に開始しますか？
          </p>
          <div className="save-info-box">
            <span className="label">冒険者名 (Player):</span>
            <strong className="player-name">
              {pendingSaveInfo.savePlayerName || 'Hero'}
            </strong>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={() => resumeSavedGame()} className="btn btn-primary btn-large">
            ▶️ セーブデータから再開 (Continue Game)
          </button>
          <button onClick={handleStartNew} className="btn btn-danger">
            ⚠️ 新規ゲーム開始 (New Game / セーブ破棄)
          </button>
        </div>
      </div>
    </div>
  );
};
