import { defineConfig, Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';

function serveRootAssets(): Plugin {
  return {
    name: 'serve-root-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        const rootDir = path.resolve(__dirname, '../../');
        const urlPath = req.url.split('?')[0];
        let targetPath = '';

        if (urlPath.endsWith('nethack.wasm')) {
          targetPath = path.join(rootDir, 'nethack.wasm');
        } else if (urlPath.endsWith('nethack_jp.wasm')) {
          targetPath = path.join(rootDir, 'nethack_jp.wasm');
        } else if (urlPath.endsWith('nethack.js')) {
          targetPath = path.join(rootDir, 'nethack.js');
        } else if (urlPath.endsWith('nethack_jp.js')) {
          targetPath = path.join(rootDir, 'nethack_jp.js');
        } else if (urlPath.startsWith('/src/driver/')) {
          targetPath = path.join(rootDir, urlPath);
        } else if (
          urlPath.startsWith('/pict/') ||
          urlPath.startsWith('/dat/') ||
          urlPath.startsWith('/param/') ||
          urlPath.startsWith('/sys/')
        ) {
          targetPath = path.join(rootDir, urlPath);
        } else {
          const possibleFile = path.join(rootDir, urlPath);
          if (fs.existsSync(possibleFile) && fs.statSync(possibleFile).isFile()) {
            targetPath = possibleFile;
          }
        }

        if (targetPath && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
          const mimeTypes: Record<string, string> = {
            '.js': 'application/javascript; charset=utf-8',
            '.wasm': 'application/wasm',
            '.png': 'image/png',
            '.json': 'application/json',
            '.css': 'text/css',
            '.html': 'text/html',
          };
          const ext = path.extname(targetPath).toLowerCase();
          res.statusCode = 200;
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          fs.createReadStream(targetPath).pipe(res);
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [serveRootAssets(), vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@driver': path.resolve(__dirname, '../../src/driver'),
      '@param': path.resolve(__dirname, '../../param'),
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    fs: {
      allow: ['../..'],
    },
  },
});
