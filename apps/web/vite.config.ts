import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  const certPath = environment.DEV_TLS_CERT_PATH;
  const keyPath = environment.DEV_TLS_KEY_PATH;
  if (Boolean(certPath) !== Boolean(keyPath)) {
    throw new Error('DEV_TLS_CERT_PATH and DEV_TLS_KEY_PATH must both be set or both be empty.');
  }
  if (certPath && keyPath && (!existsSync(certPath) || !existsSync(keyPath))) {
    throw new Error('Configured Vite TLS certificate or key file does not exist.');
  }
  const https = certPath && keyPath
    ? { cert: readFileSync(certPath), key: readFileSync(keyPath) }
    : undefined;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      https,
      proxy: {
        '/socket.io': {
          target: 'http://127.0.0.1:3001',
          ws: true,
          changeOrigin: true,
          rewriteWsOrigin: true
        }
      }
    },
    preview: { host: '0.0.0.0', https }
  };
});
