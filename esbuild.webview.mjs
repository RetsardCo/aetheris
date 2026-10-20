import * as esbuild from 'esbuild';
import * as fs from 'fs';

const watch = process.argv.includes('--watch');

async function build() {
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  const ctx = await esbuild.context({
    entryPoints: ['src/webview/index.tsx'],
    bundle: true,
    format: 'iife',
    minify: !watch,
    sourcemap: true,
    platform: 'browser',
    outfile: 'dist/webview.js',
    define: {
      'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production')
    },
    logLevel: 'info'
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching webview...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
