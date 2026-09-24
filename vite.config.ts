import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'google-translate-api',
        configureServer(server) {
          server.middlewares.use('/api/translate', async (req, res) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
              req.on('end', async () => {
                try {
                  const { text, from = 'auto', to = 'zh-CN' } = JSON.parse(body || '{}');
                  if (!text || !text.trim()) {
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify({ translation: '', success: true }));
                  }
                  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
                  const response = await fetch(url);
                  const data = await response.json();
                  const translation = Array.isArray(data?.[0])
                    ? data[0].map((item: any) => item?.[0] || '').join('')
                    : '';
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ translation, success: true }));
                } catch (err: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message, success: false }));
                }
              });
            } else {
              res.statusCode = 405;
              res.end('Method Not Allowed');
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
