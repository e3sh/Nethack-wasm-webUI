/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module '@driver/index.js' {
  export const NetHackWasmWorkerBridge: any;
  export const NetHackWasmDriver: any;
  export const NetHackFSManager: any;
  export const NetHackMemory: any;
  export const InputResolver: any;
}

declare module '@param/tileMapping.js' {
  export function tileMapping(offsets?: any): Record<number, number>;
  export default tileMapping;
}
