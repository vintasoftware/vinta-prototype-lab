import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^vinta-prototype-lab$/, replacement: path.join(here, 'src/index.ts') }],
    dedupe: ['react', 'react-dom'],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/index.ts', '**/types.ts', 'src/ui/**', 'src/node/bin.ts'],
      // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature forbids process.env.CI
      reporter: process.env['CI'] ? ['text', 'json-summary'] : ['text', 'json-summary', 'html'],
    },
  },
})
