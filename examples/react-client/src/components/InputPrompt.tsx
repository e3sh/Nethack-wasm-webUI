import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
    const ctx = activePrompt.context;
    return ctx === 'text' || ctx === 'getlin' || ctx === 'askname' || ctx === 'name' || ctx === 'get_ext_cmd';
  }, [activePrompt]);

  const isExtCmd = useMemo(() => {
    return activePrompt?.context === 'get_ext_cmd';
  }, [activePrompt]);

  const isYNPrompt = useMemo(() => {
    if (!activePrompt || isTurnInput) return false;
    const ctx = activePrompt.context;
    const choices = activePrompt.choices;
    const prompt = activePrompt.prompt || '';

    return (
      ctx === 'yn' ||
      ctx === 'yn_function' ||
      !!choices ||
      prompt.includes('[y/n]') ||
      prompt.includes('(y/n)') ||
      prompt.includes('?') ||
      prompt.toLowerCase().includes('tutorial')
    );
  }, [activePrompt, isTurnInput]);

  useEffect(() => {
    if (activePrompt && isTextPrompt) {
      setInputText('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [activePrompt, isTextPrompt]);

  const respondDirect = useCallback(
    (val: any) => {
      respondPrompt(val);
    },
    [respondPrompt]
  );

  const sendChar = useCallback(
    (char: string) => {
      respondDirect(char.charCodeAt(0));
    },
    [respondDirect]
  );

  const submitText = useCallback(() => {
    const val = inputText ? inputText.trim() : (isExtCmd ? 'pray' : 'Hero');
    setInputText('');
    respondDirect(val);
  }, [inputText, isExtCmd, respondDirect]);

  const cancelText = useCallback(() => {
    setInputText('');
    if (isExtCmd) {
      respondDirect(-1);
    } else {
      respondDirect('');
    }
  }, [isExtCmd, respondDirect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activePrompt) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isTextPrompt) {
          cancelText();
        } else {
          respondDirect(27);
        }
        return;
      }

      if (isYNPrompt && !isTurnInput) {
        const k = e.key.toLowerCase();
        if (k === 'y' || k === 'n' || k === 'q') {
          e.preventDefault();
          e.stopPropagation();
          sendChar(k);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          sendChar('y');
          return;
        }
      }

      if (isTextPrompt && document.activeElement === inputRef.current) {
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activePrompt, isTextPrompt, isYNPrompt, isTurnInput, cancelText, respondDirect, sendChar]);

  return (
    <div className="prompt-wrapper">
      {activePrompt ? (
        <div className="prompt-container">
          <div className={`prompt-badge ${isTurnInput ? 'turn-badge' : ''}`}>
            <span className="pulse-icon">●</span>{' '}
            {isTurnInput ? '[TURN WAITING]' : '[INPUT WAITING]'}
          </div>

          <div className="prompt-text">{activePrompt.prompt}</div>

          {/* 1. テキスト入力プロンプト (askname, getlin, get_ext_cmd, options 等) */}
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
          ) : isYNPrompt && !isTurnInput ? (
            /* 2. Y/N または 選択肢(Choices/Yes/No) 質問プロンプトの場合 */
            <div className="prompt-actions">
              <button onClick={() => sendChar('y')} className="btn btn-yes">
                Yes (y)
              </button>
              <button onClick={() => sendChar('n')} className="btn btn-no">
                No (n)
              </button>
              <button onClick={() => sendChar('q')} className="btn btn-cancel">
                Quit/Cancel (ESC)
              </button>
            </div>
          ) : isTurnInput ? (
            /* 3. 通常移動/ターン入力待ちの場合 */
            <div className="turn-hint">
              <span>Use Arrow keys / hjkl to move</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="prompt-placeholder">
          <span className="idle-text">Ready / Turn Input Waiting (Press arrow keys or hjkl)</span>
        </div>
      )}
    </div>
  );
};
