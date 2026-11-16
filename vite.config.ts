import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ARTIFACT=1 → nombres de archivo estables (sin hash) para republicar siempre sobre las mismas rutas.
const stable = process.env.ARTIFACT === '1';

// base relativa: el sitio funciona servido desde cualquier subruta (GitHub Pages, artefacto, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: stable
      ? { output: { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' } }
      : {},
  },
});
