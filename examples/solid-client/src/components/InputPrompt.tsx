import { Component, createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
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
    const ctx = prompt.context;
    return ctx === 'text' || ctx === 'getlin' || ctx === 'askname' || ctx === 'name' || ctx === 'get_ext_cmd';
  };

  const isExtCmd = () => activePrompt()?.context === 'get_ext_cmd';

  const isYNPrompt = () => {
    const promptObj = activePrompt();
    if (!promptObj || isTurnInput()) return false;
    const ctx = promptObj.context;
    const choices = promptObj.choices;
    const promptStr = promptObj.prompt || '';

    return (
      ctx === 'yn' ||
      ctx === 'yn_function' ||
      !!choices ||
      promptStr.includes('[y/n]') ||
      promptStr.includes('(y/n)') ||
      promptStr.includes('?') ||
      promptStr.toLowerCase().includes('tutorial')
    );
  };

  createEffect(() => {
    if (activePrompt() && isTextPrompt()) {
      setInputText('');
      setTimeout(() => {
        inputRef?.focus();
      }, 50);
    }
  });

  const respondDirect = (val: any) => {
    if (activePrompt()) {
      driverController.respondPrompt(val);
    }
  };

  const sendChar = (char: string) => {
    respondDirect(char.charCodeAt(0));
  };

  const submitText = () => {
    const val = inputText() ? inputText().trim() : (isExtCmd() ? 'pray' : 'Hero');
    setInputText('');
    respondDirect(val);
  };

  const cancelText = () => {
    setInputText('');
    if (isExtCmd()) {
      respondDirect(-1);
    } else {
      respondDirect('');
    }
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const promptObj = activePrompt();
      if (!promptObj) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isTextPrompt()) {
          cancelText();
        } else {
          respondDirect(27);
        }
        return;
      }

      if (isYNPrompt() && !isTurnInput()) {
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
        if (e.key.length === 1) {
          e.preventDefault();
          e.stopPropagation();
          sendChar(e.key);
          return;
        }
      }

      if (isTextPrompt() && document.activeElement === inputRef) {
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown, true);
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
        <div class="prompt-container">
          <div class={`prompt-badge ${isTurnInput() ? 'turn-badge' : ''}`}>
            <span class="pulse-icon">●</span>{' '}
            {isTurnInput() ? '[TURN WAITING]' : '[INPUT WAITING]'}
          </div>

          <div class="prompt-text">
            {activePrompt()?.prompt}
            <Show when={isTurnInput()}>
              <span class="turn-hint">（hjkl / 矢印キーで移動, ?でヘルプ, #で拡張コマンド）</span>
            </Show>
          </div>

          <Show when={isTextPrompt()}>
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
                placeholder={isExtCmd() ? 'e.g. pray, dip, jump' : 'Input text (ESC to cancel)'}
              />
              <button onClick={submitText} class="btn btn-primary">
                Submit
              </button>
              <button onClick={cancelText} class="btn btn-secondary">
                Cancel (ESC)
              </button>
            </div>
          </Show>

          <Show when={isYNPrompt() && !isTurnInput()}>
            <div class="prompt-actions">
              <button onClick={() => sendChar('y')} class="btn btn-yes">
                Yes (y)
              </button>
              <button onClick={() => sendChar('n')} class="btn btn-no">
                No (n)
              </button>
              <button onClick={() => sendChar('q')} class="btn btn-cancel">
                Quit/Cancel (ESC)
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
