import tailwind from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The gallery of the look: `npx vite --config design/vite.config.ts`.
// It uses the repository's own libraries and the kit in src/catalyst.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react(), tailwind()],
  server: { host: '127.0.0.1', port: 18560, strictPort: true },
  build: { outDir: '../dist/design', emptyOutDir: true },
})
