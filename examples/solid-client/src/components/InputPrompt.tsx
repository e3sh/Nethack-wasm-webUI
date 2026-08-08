import { Component, createSignal, createMemo, Show, For } from 'solid-js';
import { activePrompt } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';

export const InputPrompt: Component = () => {
  const [inputText, setInputText] = createSignal('');
  let inputRef: HTMLInputElement | undefined;

  const isLineText = createMemo(() => activePrompt()?.inputType === 'LINE_TEXT');
  const isTurnInput = createMemo(() => activePrompt()?.inputType === 'DIRECTION');
  const options = createMemo(() => activePrompt()?.options || []);

  const submitText = () => {
    const val = inputText().trim();
    setInputText('');
    driverController.respondPrompt(val);
  };

  const cancelText = () => {
    setInputText('');
    driverController.cancelPrompt();
  };

  return (
    <div class="prompt-wrapper">
      <Show
        when={activePrompt()}
        fallback={
          <div class="prompt-placeholder">
            <span class="idle-text">Ready / Turn Input Waiting</span>
          </div>
        }
      >
        {(prompt) => (
          <div class="prompt-container">
            <div class={`prompt-badge ${isTurnInput() ? 'turn-badge' : ''}`}>
              <span class="pulse-icon">●</span> {isTurnInput() ? '[TURN WAITING]' : '[INPUT WAITING]'}
            </div>

            <div class="prompt-content">
              <div class="prompt-text">
                {prompt().promptText || prompt().prompt || ''}
                <Show when={prompt().choicesHint}>
                  <span class="choices-hint">({prompt().choicesHint})</span>
                </Show>
              </div>

              <Show
                when={isLineText()}
                fallback={
                  <Show
                    when={options().length > 0}
                    fallback={
                      <Show when={isTurnInput()}>
                        <div class="turn-hint">
                          <span>Use Arrow keys / hjkl / numpad to move</span>
                        </div>
                      </Show>
                    }
                  >
                    <div class="prompt-actions">
                      <For each={options()}>
                        {(btn) => (
                          <button
                            onClick={() => driverController.respondPrompt(btn.key)}
                            class={`btn ${btn.btnClass || 'btn-primary'}`}
                          >
                            {btn.label}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                }
              >
                <div class="prompt-text-input">
                  <input
                    ref={inputRef}
                    value={inputText()}
                    onInput={(e) => setInputText(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitText();
                      if (e.key === 'Escape') cancelText();
                    }}
                    type="text"
                    placeholder="Input text (ESC to cancel)"
                    autofocus
                  />
                  <button onClick={submitText} class="btn btn-primary">Submit</button>
                  <button onClick={cancelText} class="btn btn-secondary">Cancel</button>
                </div>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};
