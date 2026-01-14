import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Always use the repository name as base path for GitHub Pages
  // This works for both local development and GitHub Pages deployment
  base: '/reverse-verification-tool/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      '~backend/client': path.resolve(__dirname, './client'),
      '~backend': path.resolve(__dirname, '../backend'),
    },
  },
  plugins: [tailwindcss(), react()],
  mode: "development",
  build: {
    minify: false,
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    host: true,
  }
})
