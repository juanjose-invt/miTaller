import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: el sitio funciona servido desde cualquier subruta (GitHub Pages, artefacto, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
});
