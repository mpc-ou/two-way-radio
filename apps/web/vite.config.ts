import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// FE chỉ được build (vite build / vite build --watch) ra dist/; NestJS (apps/server)
// phục vụ dist/ cùng cổng HTTPS với Socket.IO, nên không còn dev server hay proxy.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: mode !== 'development',
    target: 'es2022',
    // mediasoup-client + socket.io + React; tải qua LAN nên không cần chia nhỏ.
    chunkSizeWarningLimit: 800
  }
}));
