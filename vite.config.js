import { defineConfig } from 'vite';

const port = Number(process.env.CW_PORT || 8787);

export default defineConfig({
  server: {
    proxy: {
      '/api': `http://localhost:${port}`
    }
  }
});
