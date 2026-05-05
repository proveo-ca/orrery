import { defineConfig } from 'vite';

export default defineConfig({
  base: '/nightfall/',
  build: {
    outDir: 'dist/nightfall',
    emptyOutDir: true,
  },
});
