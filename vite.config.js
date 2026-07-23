import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Allow all hosts, bypassing ngrok 403 Forbidden checks
    cors: true
  }
});
