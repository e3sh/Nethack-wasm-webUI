/**
 * types.js - WebUICore 型定義 & 定数定義
 */

/**
 * 描画アダプター共通インターフェース仕様 (IRenderer)
 * 各描画ターゲット (Canvas, Mobile DOM, Null, Vue/React 等) は
 * 以下のメソッドを実装する。
 *
 * @interface IRenderer
 * @property {function(): void} init - レンダラーの初期化
 * @property {function(): void} clearMap - マップ描画領域の全クリア
 * @property {function(number, number, {glyph: number, ch: string, color: number}): void} drawGlyph - マップセル描画
 * @property {function(Record<string, any>): void} updateStatus - ステータス更新
 * @property {function(string): void} appendMessage - メッセージログ追加
 * @property {function(Object): void} showPrompt - 入力プロンプト表示
 * @property {function(): void} hidePrompt - 入力プロンプト非表示
 * @property {function(Array<Object>): void} showMenu - メニューモーダル表示
 * @property {function(string): void} showTextModal - テキスト情報表示
 */

/**
 * 入力プロンプトカテゴリ
 */
export const PROMPT_CATEGORY = {
  NONE: 'NONE',
  TEXT: 'TEXT',
  YN: 'YN',
  KEY: 'KEY',
  MENU: 'MENU',
  POSKEY: 'POSKEY',
  DIRECTION: 'DIRECTION',
  FILE: 'FILE',
  ASKNAME: 'ASKNAME',
  EXTCMD: 'EXTCMD',
  OTHER: 'OTHER'
};

/**
 * ドライバー状態
 */
export const DRIVER_STATE = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  WAITING_INPUT: 'WAITING_INPUT',
  STOPPED: 'STOPPED'
};

/**
 * サウンドモード
 */
export const SOUND_MODE = {
  MUTE: 'mute',
  SE: 'se',
  BEEP: 'beep'
};
