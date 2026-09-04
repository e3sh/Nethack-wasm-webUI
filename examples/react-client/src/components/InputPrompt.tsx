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

  const currentLanguage = useGameStore((state) => state.currentLanguage);
  const isEn = currentLanguage === 'en';

  if (!activePrompt || isTurnInput) {
    return (
      <div className="prompt-wrapper">
        <div className="prompt-placeholder">
          <div className="idle-badge">
            <span className="idle-dot">●</span> {isEn ? '🎮 Ready / Waiting Command' : '🎮 コマンド待機中'}
          </div>
          <span className="idle-text">
            {isEn
              ? 'Use Arrow keys / vi keys (hjkl) / numpad (1-9) to move, or click action buttons.'
              : '矢印キー / viキー (hjkl) / テンキー (1-9) で移動・行動、または各種アクションボタンをクリック'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-wrapper">
      <div className="prompt-container">
        <div className={`prompt-badge ${isDirectionPrompt ? 'turn-badge' : ''}`}>
          <span className="pulse-icon">●</span> {isDirectionPrompt ? (isEn ? '[DIRECTION WAITING]' : '[方向入力待機]') : (isEn ? '[INPUT WAITING]' : '[入力待機]')}
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
                placeholder={isEn ? 'Input text (ESC to cancel)' : 'テキスト入力 (ESCで取消)'}
                autoFocus
              />
              <button onClick={submitText} className="btn btn-primary">{isEn ? 'Submit' : '決定'}</button>
              <button onClick={cancelText} className="btn btn-secondary">{isEn ? 'Cancel' : '取消'}</button>
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
                    { id: 'DIR_SELF', icon: '●', label: isEn ? '. (Self)' : '. (自身)' },
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
                    title={isEn ? 'Upstairs / Upward (<)' : '上階 / 上方向 (<)'}
                  >
                    <span>▲ &lt;</span>
                    <span>{isEn ? 'Up (<)' : '上方向'}</span>
                  </button>
                  <button
                    onClick={() => respondPrompt('DIR_DOWN')}
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title={isEn ? 'Downstairs / Downward (>)' : '下階 / 下方向 (>)'}
                  >
                    <span>▼ &gt;</span>
                    <span>{isEn ? 'Down (>)' : '下方向'}</span>
                  </button>
                  <button
                    onClick={() => cancelPrompt()}
                    className="btn btn-danger"
                    style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                    title={isEn ? 'Cancel action (ESC)' : '詠唱・行動の中止 (ESC)'}
                  >
                    <span>✖</span>
                    <span>{isEn ? 'Cancel (ESC)' : '取消 (ESC)'}</span>
                  </button>
                </div>
              </div>

              <div className="turn-hint" style={{ marginTop: '2px', fontSize: '11px', color: '#a3be8c' }}>
                <span>{isEn ? '💡 Specify direction via numpad (1-9), vi keys (hjklyubn), or buttons above' : '💡 テンキー (1-9)、viキー (hjklyubn)、または画面の方向ボタンで指定してください'}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
