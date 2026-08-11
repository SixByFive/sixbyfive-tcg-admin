import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['chokidar'] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    optimizeDeps: {
      include: ['@tcg-admin/types'],
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@sixbyfive/kora-client': resolve('../../packages/kora-client/src/index.ts'),
        '@tcg-admin/api-client': resolve('../../packages/api-client/src/index.ts'),
        '@tcg-admin/types': resolve('../../packages/types/src/index.ts'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
})
