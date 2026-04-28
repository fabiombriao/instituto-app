import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const devEnvPath = path.resolve(root, '.env.dev');

function readEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return dotenv.parse(fs.readFileSync(filePath));
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, root, '');
  const devEnv = readEnvFile(devEnvPath);

  const supabaseUrl =
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_PROJECT_URL ||
    devEnv.VITE_SUPABASE_URL ||
    devEnv.SUPABASE_PROJECT_URL ||
    '';

  const supabaseAnonKey =
    env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_PUBLIC_KEY ||
    devEnv.VITE_SUPABASE_ANON_KEY ||
    devEnv.SUPABASE_ANON_PUBLIC_KEY ||
    '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(
        env.GEMINI_API_KEY || devEnv.GEMINI_API_KEY || '',
      ),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    resolve: {
      alias: {
        '@': root,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (
              id.includes('react-router-dom') ||
              id.includes('react-dom') ||
              id.includes('/react/') ||
              id.includes('scheduler') ||
              id.includes('react-is') ||
              id.includes('use-sync-external-store')
            ) {
              return 'react-vendor';
            }

            if (id.includes('@supabase')) {
              return 'supabase-vendor';
            }

            if (id.includes('motion')) {
              return 'motion-vendor';
            }

            if (id.includes('date-fns')) {
              return 'datefns-vendor';
            }

            if (id.includes('recharts')) {
              return 'charts-vendor';
            }

            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }

            if (id.includes('@google/genai')) {
              return 'genai-vendor';
            }

            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
