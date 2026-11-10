import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const isWatch = process.argv.includes('--watch');

function copyStaticAssets() {
  mkdirSync(distDir, { recursive: true });
  cpSync(resolve(rootDir, 'public/manifest.json'), resolve(distDir, 'manifest.json'));
  cpSync(resolve(rootDir, 'public/icons'), resolve(distDir, 'icons'), { recursive: true });
  cpSync(resolve(rootDir, 'src/popup/popup.html'), resolve(distDir, 'popup.html'));
  cpSync(resolve(rootDir, 'src/popup/popup.css'), resolve(distDir, 'popup.css'));
}

async function run() {
  rmSync(distDir, { recursive: true, force: true });
  copyStaticAssets();

  const shared = {
    bundle: true,
    sourcemap: false,
    minify: !isWatch,
    target: 'es2022',
    logLevel: 'info'
  };

  const contexts = await Promise.all([
    esbuild.context({
      ...shared,
      entryPoints: [resolve(rootDir, 'src/popup/popup.ts')],
      outfile: resolve(distDir, 'popup.js'),
      format: 'esm'
    }),
    esbuild.context({
      ...shared,
      entryPoints: [resolve(rootDir, 'src/background.ts')],
      outfile: resolve(distDir, 'background.js'),
      format: 'esm'
    }),
    esbuild.context({
      ...shared,
      entryPoints: [resolve(rootDir, 'src/content.ts')],
      outfile: resolve(distDir, 'content.js'),
      format: 'iife'
    })
  ]);

  if (isWatch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('Watching extension source files...');
    return;
  }

  await Promise.all(contexts.map((ctx) => ctx.rebuild()));
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
  console.log('Build complete -> dist/');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
