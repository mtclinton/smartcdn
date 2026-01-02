import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '*.config.js',
        'wrangler.toml',
      ],
    },
    // Use forks pool to avoid import issues (Vitest 4 format - poolOptions moved to top level)
    pool: 'forks',
    singleFork: true,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  // Use esbuild for transforms
  esbuild: {
    target: 'node24',
    format: 'esm',
  },
  // Configure plugins to skip source file transformation
  plugins: [],
});
