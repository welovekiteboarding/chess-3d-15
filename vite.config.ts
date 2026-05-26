import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    css: true,
    environment: 'jsdom',
    // Avoid Vitest's parallel web-transform temp usage exhausting the
    // constrained Symphony workspace during full-suite collection.
    fileParallelism: false,
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
