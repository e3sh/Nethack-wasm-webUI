/**
 * @nethack-webui/ui-controller
 *
 * NetHack WASM WebUI - Headless UI Controller & Presenter Layer
 * DOM非依存のUI状態管理・入力調停・プレゼンター基盤を提供します。
 */

// 1. UI Configuration & Persistence
export {
  UIConfigStore,
  STORAGE_KEY_DEFAULT,
  PRESETS,
  DEFAULT_LAYOUT_CONFIG
} from './UIConfigStore.js';

// 2. Modal Stack & Priority Coordination
export {
  ModalStackController
} from './ModalStackController.js';

// 3. Input Coordination & Routing
export {
  InputCoordinator,
  ROUTE_ACTIONS
} from './InputCoordinator.js';

// 4. Floating Message HUD State & Lifecycles
export {
  FloatingMessageHudController,
  LINE_STATE
} from './FloatingMessageHudController.js';

// 5. Paperdoll Presenter & Equipment Slot Mapping
export {
  PaperdollPresenter,
  SLOT_DEFINITIONS
} from './PaperdollPresenter.js';

// 6. Container Draft Controller & Safety Guard
export {
  ContainerDraftController,
  TRANSFER_DIRECTION
} from './ContainerDraftController.js';
