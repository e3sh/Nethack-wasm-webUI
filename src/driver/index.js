/**
 * NetHack WASM Driver - Unified Entry Point (index.js)
 * NetHack 5.0 / 3.7 Wasm Core を JavaScript / WebUI / Headless App から利用するための汎用ドライバーライブラリ。
 */

import './NetHackMemory.js';
import './InputResolver.js';
import './NetHackFSManager.js';
import './NetHackWasmDriver.js';
import './NetHackWasmWorkerBridge.js';

const scope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : global);

export const NetHackMemory = scope.NetHackMemory;
export const InputResolver = scope.InputResolver;
export const NetHackFSManager = scope.NetHackFSManager;
export const NetHackWasmDriver = scope.NetHackWasmDriver;
export const NetHackWasmWorkerBridge = scope.NetHackWasmWorkerBridge;

export default {
    NetHackWasmDriver: scope.NetHackWasmDriver,
    NetHackWasmWorkerBridge: scope.NetHackWasmWorkerBridge,
    NetHackFSManager: scope.NetHackFSManager,
    NetHackMemory: scope.NetHackMemory,
    InputResolver: scope.InputResolver
};

if (typeof scope !== 'undefined') {
    scope.NetHackWasmDriverLib = {
        NetHackWasmDriver: scope.NetHackWasmDriver,
        NetHackWasmWorkerBridge: scope.NetHackWasmWorkerBridge,
        NetHackFSManager: scope.NetHackFSManager,
        NetHackMemory: scope.NetHackMemory,
        InputResolver: scope.InputResolver
    };
}

