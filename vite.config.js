import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative asset paths so builds work on GitHub Pages and local file/preview hosts.
  base: './',
  build: {
    // Match current GitHub Pages publish folder.
    outDir: 'docs'
  }
});
