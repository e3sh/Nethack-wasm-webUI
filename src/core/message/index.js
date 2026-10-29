/**
 * index.js
 * Phase 5 - Stage 5.2: 状況シグナル基盤 メッセージモジュール公開エントリ
 */

export { MessageContextResolver } from './MessageContextResolver.js';
export { ContextFrameBuffer } from './ContextFrameBuffer.js';
export { MessageTokenParser } from './MessageTokenParser.js';
export { TokenKnowledgeResolver, tokenKnowledgeResolver } from './TokenKnowledgeResolver.js';
export { MESSAGE_CONTEXT_CATALOG } from './data/MessageContextCatalog.js';
export { TOKEN_PATTERNS, TOKEN_PREFIX_BUCKETS } from './data/MessageTokenCatalog.js';
