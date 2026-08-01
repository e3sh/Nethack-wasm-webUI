import { defineConfig, Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import fs from 'fs';

// ビルド時に Wasm, JS, pict, param アセットを dist/ へ自動コピーするプラグイン
function copyAssetsToDist(): Plugin {
  return {
    name: 'copy-assets-to-dist',
    closeBundle() {
      const rootDir = path.resolve(__dirname, '../../');
      const distDir = path.resolve(__dirname, 'dist');

      const filesToCopy = [
        'nethack.wasm',
        'nethack_jp.wasm',
        'nethack.js',
        'nethack_jp.js',
      ];

      const dirsToCopy = ['pict', 'param', 'dat', 'src/driver'];

      // 単一ファイルのコピー
      filesToCopy.forEach((file) => {
        const src = path.join(rootDir, file);
        const dest = path.join(distDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      });

      // ディレクトリの再帰コピー関数
      const copyRecursive = (srcDir: string, destDir: string) => {
        if (!fs.existsSync(srcDir)) return;
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(srcDir, entry.name);
          const destPath = path.join(destDir, entry.name);
          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };

      dirsToCopy.forEach((dir) => {
        const src = path.join(rootDir, dir);
        const dest = path.join(distDir, dir);
        copyRecursive(src, dest);
      });
      console.log('✅ Standalone static game assets copied to dist/');
    },
  };
}

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
  base: './', // 相対パスビルドにより Live Server や GitHub Pages サブフォルダ階層でも動作
  plugins: [serveRootAssets(), copyAssetsToDist(), svelte()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@driver': path.resolve(__dirname, '../../src/driver'),
      '@param': path.resolve(__dirname, '../../param'),
    },
  },
  server: {
    port: 3002,
    strictPort: false,
    fs: {
      allow: ['../..'],
    },
  },
});
