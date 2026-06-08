import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  external: [
    // Don't bundle these — they're runtime dependencies
    'express', 'cors', 'zod',
  ],
});