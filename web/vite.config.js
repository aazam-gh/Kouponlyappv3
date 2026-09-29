import path from "path"
import { fileURLToPath } from "url"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "firebase/firestore": path.resolve(__dirname, "./src/firebase/firestore.ts"),
      "firebase/functions": path.resolve(__dirname, "./src/firebase/functions.ts"),
      "firebase/storage": path.resolve(__dirname, "./src/firebase/storage.ts"),
      "firebase/auth": path.resolve(__dirname, "./src/firebase/auth.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'vendor-tanstack': ['@tanstack/react-query', '@tanstack/react-router'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
