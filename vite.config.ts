
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Load env file based on `mode`
    const env = loadEnv(mode, path.resolve(), '');
    
    // Ambil API Key dari berbagai kemungkinan nama variabel di Vercel
    const finalApiKey = env.API_KEY || env.VITE_API_KEY || env.GEMINI_API_KEY || process.env.API_KEY || "";

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Mendefinisikan process.env secara global agar tersedia di browser
        'process.env.API_KEY': JSON.stringify(finalApiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false
      }
    };
});
