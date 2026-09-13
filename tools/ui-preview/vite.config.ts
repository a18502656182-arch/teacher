import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { compileLegacyCss } from '../../scripts/build-legacy-css.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  plugins: [react(), { name: 'legacy-isolation-probe', configureServer(server) {
    server.middlewares.use('/__legacy-scoped.css', async (_request, response) => {
      try {
        response.setHeader('Content-Type', 'text/css'); response.end(await compileLegacyCss(project));
      } catch { response.statusCode = 500; response.end('/* Scope compilation failed */'); }
    });
  } }],
  resolve: { alias: { '@': project } },
  server: { host: '127.0.0.1', port: 4207, strictPort: true, fs: { allow: [project] } },
});
