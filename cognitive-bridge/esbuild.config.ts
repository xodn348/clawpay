import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const isWatch = process.argv.includes('--watch');

const commonOptions: esbuild.BuildOptions = {
  bundle: true,
  minify: true,
  sourcemap: true,
  target: 'ES2020',
  logLevel: 'info',
};

const buildConfigs: esbuild.BuildOptions[] = [
  {
    ...commonOptions,
    entryPoints: ['src/content/index.ts'],
    outfile: 'dist/content.js',
    format: 'iife',
  },
  {
    ...commonOptions,
    entryPoints: ['src/background/index.ts'],
    outfile: 'dist/background.js',
    format: 'iife',
  },
  {
    ...commonOptions,
    entryPoints: ['src/popup/index.ts'],
    outfile: 'dist/popup.js',
    format: 'iife',
  },
];

async function build() {
  try {
    // Ensure dist directory exists
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }

    // Copy manifest.json to dist
    fs.copyFileSync('manifest.json', 'dist/manifest.json');

    // Copy popup.html to dist
    if (fs.existsSync('src/popup/index.html')) {
      fs.copyFileSync('src/popup/index.html', 'dist/popup.html');
    }

    if (isWatch) {
      const contexts = await Promise.all(
        buildConfigs.map((config) => esbuild.context(config))
      );

      await Promise.all(contexts.map((ctx) => ctx.watch()));
      console.log('Watching for changes...');
    } else {
      await Promise.all(buildConfigs.map((config) => esbuild.build(config)));
      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
