import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const InputPrompt: React.FC = () => {
  const activePrompt = useGameStore((state) => state.activePrompt);
  const { respondPrompt, cancelPrompt } = useNetHackDriver();

  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isLineText = activePrompt?.inputType === 'LINE_TEXT';
  const isDirectionPrompt = activePrompt?.inputType === 'DIRECTION';
  const isTurnInput = activePrompt?.inputType === 'TURN_INPUT';
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
    cancelPrompt();
  };

  if (!activePrompt || isTurnInput) {
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
        <div className={`prompt-badge ${isDirectionPrompt ? 'turn-badge' : ''}`}>
          <span className="pulse-icon">●</span> {isDirectionPrompt ? '[DIRECTION WAITING]' : '[INPUT WAITING]'}
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
          ) : isDirectionPrompt ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* 3x3 方向グリッド */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: '4px' }}>
                  {[
                    { id: 'DIR_NW', icon: '↖', label: '7 / y' },
                    { id: 'DIR_N',  icon: '↑', label: '8 / k' },
                    { id: 'DIR_NE', icon: '↗', label: '9 / u' },
                    { id: 'DIR_W',  icon: '←', label: '4 / h' },
                    { id: 'DIR_SELF', icon: '●', label: '. (自身)' },
                    { id: 'DIR_E',  icon: '→', label: '6 / l' },
                    { id: 'DIR_SW', icon: '↙', label: '1 / b' },
                    { id: 'DIR_S',  icon: '↓', label: '2 / j' },
                    { id: 'DIR_SE', icon: '↘', label: '3 / n' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      onClick={() => respondPrompt(d.id)}
                      style={{
                        background: d.id === 'DIR_SELF' ? '#4c566a' : '#3b4252',
                        border: '1px solid #88c0d0',
                        borderRadius: '4px',
                        color: '#eceff4',
                        height: '38px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: '2px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                      title={d.label}
                    >
                      <span style={{ fontSize: '13px', lineHeight: 1, fontWeight: 'bold' }}>{d.icon}</span>
                      <span style={{ fontSize: '7px', opacity: 0.75 }}>{d.label}</span>
                    </button>
                  ))}
                </div>

                {/* 補助操作: 上層 / 下層 / 取消 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    onClick={() => respondPrompt('DIR_UP')}
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="上階 / 上方向 (<)"
                  >
                    <span>▲ &lt;</span>
                    <span>上方向</span>
                  </button>
                  <button
                    onClick={() => respondPrompt('DIR_DOWN')}
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="下階 / 下方向 (>)"
                  >
                    <span>▼ &gt;</span>
                    <span>下方向</span>
                  </button>
                  <button
                    onClick={() => cancelPrompt()}
                    className="btn btn-danger"
                    style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                    title="詠唱・行動の中止 (ESC)"
                  >
                    <span>✖</span>
                    <span>取消 (ESC)</span>
                  </button>
                </div>
              </div>

              <div className="turn-hint" style={{ marginTop: '2px', fontSize: '11px', color: '#a3be8c' }}>
                <span>💡 テンキー (1-9)、viキー (hjklyubn)、または画面の方向ボタンで指定してください</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
