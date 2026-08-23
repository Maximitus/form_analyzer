import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ortDist = path.dirname(require.resolve('onnxruntime-web'));
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const coopCoepHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
} as const;

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: path.join(ortDist, 'ort-wasm*.wasm'),
          dest: 'ort',
        },
        {
          src: path.join(ortDist, 'ort-wasm*.mjs'),
          dest: 'ort',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // Use ORT's external-WASM build so Vite does not inline 20MB+ binaries into the worker.
    conditions: ['onnxruntime-web-use-extern-wasm'],
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    headers: coopCoepHeaders,
    fs: {
      allow: ['.', ortDist],
    },
  },
  preview: {
    headers: coopCoepHeaders,
  },
});
