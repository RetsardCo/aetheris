import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const watch = process.argv.includes('--watch');

async function build() {
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  // Copy sql-wasm.wasm from node_modules if present
  const sqlWasmSource = path.resolve('node_modules/sql.js/dist/sql-wasm.wasm');
  if (fs.existsSync(sqlWasmSource)) {
    fs.copyFileSync(sqlWasmSource, 'dist/sql-wasm.wasm');
  }

  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: !watch,
    sourcemap: true,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info'
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching extension host...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
