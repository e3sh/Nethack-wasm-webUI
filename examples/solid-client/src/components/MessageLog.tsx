import { Component, createEffect, For } from 'solid-js';
import { messages } from '../stores/gameStore';

export const MessageLog: Component = () => {
  let logContainer: HTMLDivElement | undefined;

  createEffect(() => {
    messages(); // 依存関係追跡
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  });

  return (
    <div class="message-log" ref={logContainer}>
      <For each={messages()}>
        {(msg) => <div class="log-line">{msg}</div>}
      </For>
    </div>
  );
};
