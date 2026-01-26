import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages repo site at https://benhg.github.io/ragchewer/
  base: '/ragchewer/',
  build: {
    // Match current GitHub Pages publish folder.
    outDir: 'docs'
  }
});
