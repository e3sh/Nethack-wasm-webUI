import { Component, createSignal, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import { activePrompt } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';

export const InputPrompt: Component = () => {
  const [inputText, setInputText] = createSignal('');
  let inputRef: HTMLInputElement | undefined;

  const isTurnInput = () => {
    const prompt = activePrompt();
    if (!prompt) return false;
    const ctx = prompt.context;
    return ctx === 'nhgetch' || ctx === 'poskey' || ctx === 'getch' || ctx === 'nh_poskey';
  };

  const isTextPrompt = () => {
    const prompt = activePrompt();
    if (!prompt) return false;
    const ctx = (prompt.context || '').toLowerCase();
    const cat = (((prompt as any).category) || '').toUpperCase();
    const promptText = (prompt.prompt || '').toLowerCase();

    return (
      cat === 'TEXT' ||
      cat === 'ASKNAME' ||
      ctx === 'text' ||
      ctx === 'getlin' ||
      ctx === 'askname' ||
      ctx === 'name' ||
      ctx === 'get_ext_cmd' ||
      promptText.includes('who are you') ||
      promptText.includes('your name') ||
      promptText.includes('what is your name')
    );
  };

  const isExtCmd = () => activePrompt()?.context === 'get_ext_cmd';

  const choiceButtons = () => {
    const prompt = activePrompt();
    if (!prompt || isTurnInput() || isTextPrompt()) return [];
    const rawChoices = prompt.choices || '';
    const promptText = (prompt.prompt || '').toLowerCase();

    let chars: string[] = [];

    if (rawChoices) {
      if (!rawChoices.includes('-') && rawChoices.length <= 10) {
        chars = rawChoices.split('');
      }
    }

    if (chars.length === 0) {
      if (promptText.includes('[r or l]') || promptText.includes('(r/l)') || promptText.includes('[r/l]')) {
        chars = ['r', 'l'];
      } else if (promptText.includes('[y/n]') || promptText.includes('(y/n)') || promptText.includes('[ynq]') || promptText.includes('[yn]')) {
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
  };

  createEffect(() => {
    if (activePrompt() && isTextPrompt()) {
      setInputText('');
      setTimeout(() => inputRef?.focus(), 10);
    }
  });

  const respondDirect = (val: any) => {
    driverController.respondPrompt(val);
  };

  const sendChar = (char: string) => {
    respondDirect(char.charCodeAt(0));
  };

  const submitText = () => {
    const val = inputText().trim() ? inputText().trim() : (isExtCmd() ? 'pray' : 'Hero');
    setInputText('');
    respondDirect(val);
  };

  const cancelText = () => {
    setInputText('');
    respondDirect(isExtCmd() ? -1 : '');
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activePrompt()) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (isTextPrompt()) {
          cancelText();
        } else {
          respondDirect(27);
        }
        return;
      }

      if (isTextPrompt()) return;

      const btns = choiceButtons();
      if (btns.length > 0) {
        const pressedKey = e.key.toLowerCase();
        const match = btns.find((b) => b.char.toLowerCase() === pressedKey);
        if (match) {
          e.preventDefault();
          sendChar(match.char);
          return;
        }
      }

      if (!isTextPrompt() && e.key.length === 1) {
        let charCode = 0;
        if (e.key === 'ArrowUp') charCode = 107;
        else if (e.key === 'ArrowDown') charCode = 106;
        else if (e.key === 'ArrowLeft') charCode = 104;
        else if (e.key === 'ArrowRight') charCode = 108;
        else charCode = e.key.charCodeAt(0);

        if (charCode > 0) {
          e.preventDefault();
          respondDirect(charCode);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
    });
  });

  return (
    <div class="prompt-wrapper">
      <Show
        when={activePrompt()}
        fallback={
          <div class="prompt-placeholder">
            <span class="idle-text">Ready / Turn Input Waiting (Press arrow keys or hjkl)</span>
          </div>
        }
      >
        {(prompt) => (
          <div class="prompt-container">
            <div class={`prompt-badge ${isTurnInput() ? 'turn-badge' : ''}`}>
              <span class="pulse-icon">●</span>{' '}
              {isTurnInput() ? '[TURN WAITING]' : '[INPUT WAITING]'}
            </div>

            <div class="prompt-content">
              <div class="prompt-text">
                {prompt().prompt}
                <Show when={prompt().choices && !isTurnInput()}>
                  <span class="choices-hint">(Choices: {prompt().choices})</span>
                </Show>
              </div>

              <Show
                when={isTextPrompt()}
                fallback={
                  <Show
                    when={choiceButtons().length > 0 && !isTurnInput()}
                    fallback={
                      <Show when={isTurnInput()}>
                        <div class="turn-hint">
                          <span>Use Arrow keys / hjkl to move</span>
                        </div>
                      </Show>
                    }
                  >
                    <div class="prompt-actions">
                      <For each={choiceButtons()}>
                        {(btn) => (
                          <button
                            onClick={() => sendChar(btn.char)}
                            class={`btn ${btn.btnClass}`}
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
                    value={inputText()}
                    onInput={(e) => setInputText(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitText();
                      if (e.key === 'Escape') cancelText();
                    }}
                    type="text"
                    placeholder={isExtCmd() ? 'e.g. pray, dip, jump' : 'Input text (ESC to cancel)'}
                    ref={inputRef}
                    autofocus
                  />
                  <button onClick={submitText} class="btn btn-primary">
                    Submit
                  </button>
                  <button onClick={cancelText} class="btn btn-secondary">
                    Cancel (ESC)
                  </button>
                </div>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};
