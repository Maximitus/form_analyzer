import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const distDir = path.dirname(require.resolve('onnxruntime-web'));
const destDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/ort');

fs.mkdirSync(destDir, { recursive: true });

// Cloudflare Workers rejects assets over 25 MiB. The WebGPU JSEP wasm is 25.6 MiB.
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const files = fs.readdirSync(distDir).filter((name) => {
  if (!/^ort-wasm-simd-threaded\.(mjs|wasm)$/.test(name)) return false;
  return fs.statSync(path.join(distDir, name)).size < MAX_ASSET_BYTES;
});

if (files.length === 0) {
  console.warn(`[copy-ort-wasm] no deployable ort-wasm binaries found in ${distDir}`);
  process.exit(0);
}

for (const file of fs.readdirSync(destDir)) {
  if (/^ort-wasm/.test(file)) fs.unlinkSync(path.join(destDir, file));
}

for (const file of files) {
  fs.copyFileSync(path.join(distDir, file), path.join(destDir, file));
}

console.log(`[copy-ort-wasm] copied ${files.join(', ')} to public/ort`);
