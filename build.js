#!/usr/bin/env node
/**
 * Build script for SmartCDN using Rollup
 * Bundles all ES modules into a single file for Cloudflare Workers deployment
 */

import { rollup } from 'rollup';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import config from './rollup.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

console.log('🔨 Building SmartCDN for Cloudflare Workers...\n');

try {
  // Ensure dist directory exists
  const distDir = resolve(__dirname, 'dist');
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  // Build with Rollup
  const bundle = await rollup(config);
  
  // Generate output
  await bundle.write(config.output);
  await bundle.close();

  // Get bundle size
  const outputPath = resolve(__dirname, 'dist/worker.js');
  const stats = readFileSync(outputPath);
  const sizeKB = (stats.length / 1024).toFixed(2);

  console.log('✅ Build successful!');
  console.log(`📦 Output: dist/worker.js`);
  console.log(`📊 Bundle size: ${sizeKB} KB\n`);

  process.exit(0);
} catch (error) {
  console.error('❌ Build failed:', error.message);
  if (error.loc) {
    console.error(`   Location: ${error.loc.file}:${error.loc.line}:${error.loc.column}`);
  }
  if (error.frame) {
    console.error(error.frame);
  }
  process.exit(1);
}

