import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// @types/node を入れていないため process は参照不可（CI の tsc -b で TS2580）。
// VITE_BASE_PATH は loadEnv で .env から読む（CI は deploy.yml が .env を生成）。
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: loadEnv(mode, '.').VITE_BASE_PATH || '/',
  server: { port: 5175 },
}));
