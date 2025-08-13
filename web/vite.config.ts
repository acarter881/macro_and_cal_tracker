import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'desktop'
      ? viteStaticCopy({
          targets: [{ src: '../server/**/*', dest: 'server' }],
        })
      : undefined,
  ].filter(Boolean),
}))
