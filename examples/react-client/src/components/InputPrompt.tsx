import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const InputPrompt: React.FC = () => {
  const activePrompt = useGameStore((state) => state.activePrompt);
  const { respondPrompt } = useNetHackDriver();

  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isLineText = activePrompt?.inputType === 'LINE_TEXT';
  const isTurnInput = activePrompt?.inputType === 'DIRECTION';
  const options = activePrompt?.options || [];

  useEffect(() => {
    if (activePrompt && isLineText) {
      setInputText('');
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [activePrompt, isLineText]);

  const submitText = () => {
    const val = inputText.trim();
    setInputText('');
    respondPrompt(val);
  };

  const cancelText = () => {
    setInputText('');
    respondPrompt(27);
  };

  if (!activePrompt) {
    return (
      <div className="prompt-wrapper">
        <div className="prompt-placeholder">
          <span className="idle-text">Ready / Turn Input Waiting</span>
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-wrapper">
      <div className="prompt-container">
        <div className={`prompt-badge ${isTurnInput ? 'turn-badge' : ''}`}>
          <span className="pulse-icon">●</span> {isTurnInput ? '[TURN WAITING]' : '[INPUT WAITING]'}
        </div>

        <div className="prompt-content">
          <div className="prompt-text">
            {activePrompt.promptText || activePrompt.prompt || ''}
            {activePrompt.choicesHint && (
              <span className="choices-hint">({activePrompt.choicesHint})</span>
            )}
          </div>

          {isLineText ? (
            <div className="prompt-text-input">
              <input
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitText();
                  if (e.key === 'Escape') cancelText();
                }}
                type="text"
                placeholder="Input text (ESC to cancel)"
                autoFocus
              />
              <button onClick={submitText} className="btn btn-primary">Submit</button>
              <button onClick={cancelText} className="btn btn-secondary">Cancel</button>
            </div>
          ) : options.length > 0 ? (
            <div className="prompt-actions">
              {options.map((btn: any) => (
                <button
                  key={btn.key}
                  onClick={() => respondPrompt(btn.key)}
                  className={`btn ${btn.btnClass || 'btn-primary'}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          ) : isTurnInput ? (
            <div className="turn-hint">
              <span>Use Arrow keys / hjkl / numpad to move</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
