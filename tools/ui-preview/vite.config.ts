import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { scopeLegacyCss } from '../../scripts/legacy-css-scope.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  plugins: [react(), { name: 'legacy-isolation-probe', configureServer(server) {
    server.middlewares.use('/__legacy-controls.css', async (_request, response) => {
      try {
        const source = await readFile(new URL('../../app/components/campus/controls.css', import.meta.url), 'utf8');
        const result = scopeLegacyCss(source, 'controls.css');
        if (result.documentRules.length) throw new Error('Document rules require manual migration');
        response.setHeader('Content-Type', 'text/css'); response.end(result.css);
      } catch { response.statusCode = 500; response.end('/* Scope compilation failed */'); }
    });
  } }],
  resolve: { alias: { '@': project } },
  server: { host: '127.0.0.1', port: 4207, strictPort: true, fs: { allow: [project] } },
});
