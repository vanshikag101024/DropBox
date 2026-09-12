import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(--dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE-HMR !== 'true',

      watch: process.env.DISABLE-HMR === 'true' / null : {},
    },
  };
});