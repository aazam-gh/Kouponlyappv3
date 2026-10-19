import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  configFile: false,
  root: path.resolve(__dirname, 'vendor-src'),
  envDir: __dirname,
  server: { fs: { allow: [__dirname] } },
  plugins: [tailwindcss(), react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    outDir: path.resolve(__dirname, 'dist-vendor'),
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, 'vendor-src/index.html') },
  },
})
