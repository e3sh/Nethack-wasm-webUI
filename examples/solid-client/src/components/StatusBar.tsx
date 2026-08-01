import { Component, For, Show } from 'solid-js';
import { status } from '../stores/gameStore';

export const StatusBar: Component = () => {
  return (
    <div class="status-bar">
      <div class="status-main">
        <span class="title">{status.title || 'NetHack Hero'}</span>
        <span class="dlvl">{status.dlvl || 'Dlvl:1'}</span>
        <span class="hp">HP: {status.hp}/{status.hpMax}</span>
        <span class="pw">Pw: {status.pw}/{status.pwMax}</span>
        <span class="ac">AC: {status.ac}</span>
        <span class="gold">$: {status.gold}</span>
      </div>

      <div class="status-badges">
        <Show when={status.hunger}>
          <span class="badge hunger-badge">{status.hunger}</span>
        </Show>

        <For each={status.condition}>
          {(cond) => <span class="badge cond-badge">{cond}</span>}
        </For>
      </div>
    </div>
  );
};
