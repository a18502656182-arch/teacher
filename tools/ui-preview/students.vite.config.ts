import { mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import base from './vite.config';
export default mergeConfig(base, {
  resolve:{alias:{'next/link':fileURLToPath(new URL('./PreviewLink.tsx',import.meta.url))}},
  build:{outDir:fileURLToPath(new URL('../../.qa-shots/students-design/build',import.meta.url)),emptyOutDir:true,rollupOptions:{input:fileURLToPath(new URL('./students.html',import.meta.url))}},
});
