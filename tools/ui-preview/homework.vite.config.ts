import { mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import base from './vite.config';
export default mergeConfig(base, {
 server:{port:4208},
 resolve:{alias:{'next/link':fileURLToPath(new URL('./PreviewLink.tsx',import.meta.url))}},
 build:{outDir:fileURLToPath(new URL('../../.qa-shots/homework-design/build',import.meta.url)),emptyOutDir:true,rollupOptions:{input:fileURLToPath(new URL('./homework.html',import.meta.url))}},
});
