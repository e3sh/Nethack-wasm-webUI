import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const InputPrompt: React.FC = () => {
  const activePrompt = useGameStore((state) => state.activePrompt);
  const { respondPrompt } = useNetHackDriver();

  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isTurnInput = useMemo(() => {
    if (!activePrompt) return false;
    const ctx = activePrompt.context;
    return ctx === 'nhgetch' || ctx === 'poskey' || ctx === 'getch' || ctx === 'nh_poskey';
  }, [activePrompt]);

  const isTextPrompt = useMemo(() => {
    if (!activePrompt) return false;
    const ctx = (activePrompt.context || '').toLowerCase();
    const cat = (((activePrompt as any).category) || '').toUpperCase();
    const prompt = (activePrompt.prompt || '').toLowerCase();

    return (
      cat === 'TEXT' ||
      cat === 'ASKNAME' ||
      ctx === 'text' ||
      ctx === 'getlin' ||
      ctx === 'askname' ||
      ctx === 'name' ||
      ctx === 'get_ext_cmd' ||
      prompt.includes('who are you') ||
      prompt.includes('your name') ||
      prompt.includes('what is your name')
    );
  }, [activePrompt]);

  const isExtCmd = activePrompt?.context === 'get_ext_cmd';

  const choiceButtons = useMemo(() => {
    if (!activePrompt || isTurnInput || isTextPrompt) return [];
    const rawChoices = activePrompt.choices || '';
    const prompt = (activePrompt.prompt || '').toLowerCase();

    let chars: string[] = [];

    if (rawChoices) {
      if (!rawChoices.includes('-') && rawChoices.length <= 10) {
        chars = rawChoices.split('');
      }
    }

    if (chars.length === 0) {
      if (prompt.includes('[r or l]') || prompt.includes('(r/l)') || prompt.includes('[r/l]')) {
        chars = ['r', 'l'];
      } else if (prompt.includes('[y/n]') || prompt.includes('(y/n)') || prompt.includes('[ynq]') || prompt.includes('[yn]')) {
        chars = ['y', 'n', 'q'];
      }
    }

    return chars.map((c) => {
      const lower = c.toLowerCase();
      let label = `${c}`;
      let btnClass = 'btn-secondary';

      if (lower === 'r') {
        label = 'Right (r)';
        btnClass = 'btn-primary';
      } else if (lower === 'l') {
        label = 'Left (l)';
        btnClass = 'btn-primary';
      } else if (lower === 'y') {
        label = 'Yes (y)';
        btnClass = 'btn-yes';
      } else if (lower === 'n') {
        label = 'No (n)';
        btnClass = 'btn-no';
      } else if (lower === 'q') {
        label = 'Quit/Cancel (q)';
        btnClass = 'btn-cancel';
      } else {
        label = `${c.toUpperCase()} (${c})`;
        btnClass = 'btn-primary';
      }

      return { char: c, label, btnClass };
    });
  }, [activePrompt, isTurnInput, isTextPrompt]);

  useEffect(() => {
    if (activePrompt && isTextPrompt) {
      setInputText('');
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [activePrompt, isTextPrompt]);

  const sendChar = (char: string) => {
    respondPrompt(char.charCodeAt(0));
  };

  const submitText = () => {
    const val = inputText.trim() ? inputText.trim() : isExtCmd ? 'pray' : 'Hero';
    setInputText('');
    respondPrompt(val);
  };

  const cancelText = () => {
    setInputText('');
    respondPrompt(isExtCmd ? -1 : '');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activePrompt) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (isTextPrompt) {
          cancelText();
        } else {
          respondPrompt(27);
        }
        return;
      }

      if (isTextPrompt) {
        return;
      }

      if (choiceButtons.length > 0) {
        const pressedKey = e.key.toLowerCase();
        const match = choiceButtons.find((b) => b.char.toLowerCase() === pressedKey);
        if (match) {
          e.preventDefault();
          sendChar(match.char);
          return;
        }
      }

      if (!isTextPrompt && e.key.length === 1) {
        let charCode = 0;
        if (e.key === 'ArrowUp') charCode = 107;
        else if (e.key === 'ArrowDown') charCode = 106;
        else if (e.key === 'ArrowLeft') charCode = 104;
        else if (e.key === 'ArrowRight') charCode = 108;
        else charCode = e.key.charCodeAt(0);

        if (charCode > 0) {
          e.preventDefault();
          respondPrompt(charCode);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePrompt, isTextPrompt, choiceButtons]);

  if (!activePrompt) {
    return (
      <div className="prompt-wrapper">
        <div className="prompt-placeholder">
          <span className="idle-text">Ready / Turn Input Waiting (Press arrow keys or hjkl)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-wrapper">
      <div className="prompt-container">
        <div className={`prompt-badge ${isTurnInput ? 'turn-badge' : ''}`}>
          <span className="pulse-icon">●</span>{' '}
          {isTurnInput ? '[TURN WAITING]' : '[INPUT WAITING]'}
        </div>

        <div className="prompt-content">
          <div className="prompt-text">
            {activePrompt.prompt}
            {activePrompt.choices && !isTurnInput && (
              <span className="choices-hint">(Choices: {activePrompt.choices})</span>
            )}
          </div>

          {isTextPrompt ? (
            <div className="prompt-text-input">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitText();
                  if (e.key === 'Escape') cancelText();
                }}
                type="text"
                placeholder={isExtCmd ? 'e.g. pray, dip, jump' : 'Input text (ESC to cancel)'}
                ref={inputRef}
                autoFocus
              />
              <button onClick={submitText} className="btn btn-primary">
                Submit
              </button>
              <button onClick={cancelText} className="btn btn-secondary">
                Cancel (ESC)
              </button>
            </div>
          ) : choiceButtons.length > 0 && !isTurnInput ? (
            <div className="prompt-actions">
              {choiceButtons.map((btn) => (
                <button
                  key={btn.char}
                  onClick={() => sendChar(btn.char)}
                  className={`btn ${btn.btnClass}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          ) : isTurnInput ? (
            <div className="turn-hint">
              <span>Use Arrow keys / hjkl to move</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
