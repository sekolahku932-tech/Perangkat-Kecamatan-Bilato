
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, path.resolve(), '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Mendefinisikan process.env.API_KEY agar tersedia di client-side.
        // Mencari di file .env (env.API_KEY) atau di variabel sistem/Vercel (process.env.API_KEY)
        'process.env.API_KEY': JSON.stringify(
          env.API_KEY || 
          env.GEMINI_API_KEY || 
          process.env.API_KEY || 
          process.env.GEMINI_API_KEY
        ),
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
