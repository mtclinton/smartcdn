import { nodeResolve } from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/worker.js',
    format: 'es',
    banner: `// SmartCDN Worker - Built ${new Date().toISOString()}\n`,
  },
  plugins: [
    nodeResolve({
      preferBuiltins: false,
      exportConditions: ['worker', 'browser'],
    }),
    esbuild({
      target: 'es2022',
      minify: process.env.NODE_ENV === 'production',
      sourcemap: process.env.NODE_ENV !== 'production',
      legalComments: 'none',
    }),
  ],
  external: [], // Bundle everything
  onwarn(warning, warn) {
    // Suppress certain warnings
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'EVAL') return;
    warn(warning);
  },
};
