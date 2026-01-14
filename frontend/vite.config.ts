import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Determine base path for GitHub Pages
const getBasePath = () => {
  if (process.env.VITE_GITHUB_PAGES === 'true') {
    // For GitHub Pages, use the repository name as base path
    return '/reverse-verification-tool/'
  }
  return '/'
}

export default defineConfig({
  base: getBasePath(),
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
  },
  server: {
    port: 3000,
    host: true,
  }
})
