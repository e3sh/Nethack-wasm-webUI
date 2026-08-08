import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const GameOverModal: React.FC = () => {
  const engineState = useGameStore((state) => state.engineState);
  const gameOverResult = useGameStore((state) => state.gameOverResult);
  const { restartGame } = useNetHackDriver();

  if (engineState !== 'GAMEOVER' && !gameOverResult) {
    return null;
  }

  const topScores =
    gameOverResult?.scoreboard ||
    gameOverResult?.records ||
    gameOverResult?.topScores ||
    [];
  const deathMessage =
    gameOverResult?.deathMessage ||
    gameOverResult?.translatedDeathMessage ||
    'You have perished in the Dungeons of Doom...';

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="gameover-header">
          <h2>☠️ GAME OVER ☠️</h2>
        </div>

        <div className="death-message">
          <p>{deathMessage}</p>
        </div>

        {topScores.length > 0 && (
          <div className="scoreboard">
            <h3>🏆 Top 10 Hall of Fame</h3>
            <table className="score-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Score</th>
                  <th>Name</th>
                  <th>Death / Title</th>
                </tr>
              </thead>
              <tbody>
                {topScores.map((entry: any, idx: number) => (
                  <tr key={idx}>
                    <td>#{entry.rank || idx + 1}</td>
                    <td className="score">{entry.score || entry.points || 0}</td>
                    <td className="name">{entry.name || entry.playerName || 'Hero'}</td>
                    <td className="death">{entry.death || entry.reason || entry.title || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-footer">
          <button onClick={() => restartGame()} className="btn btn-restart">
            🔄 Restart Game
          </button>
        </div>
      </div>
    </div>
  );
};
