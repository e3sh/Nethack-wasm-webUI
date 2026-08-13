import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/core/prompt/*.test.js',
      'src/core/window/*.test.js',
      'src/core/input/*.test.js',
      'src/core/translation/*.test.js',
      'src/core/lifecycle/GameOverResolver.test.js',
      'src/core/StatusAccessor.test.js',
      'src/core/knowledge/InventoryStateManager.test.js',
      'src/core/inspector/*.test.js'
    ]
  }
});
