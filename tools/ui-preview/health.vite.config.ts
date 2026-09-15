import {mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import base from './vite.config';
export default mergeConfig(base,{define:{'process.env':'{}'},server:{port:4214},build:{outDir:fileURLToPath(new URL('../../.qa-shots/health-p01-build',import.meta.url)),rollupOptions:{input:fileURLToPath(new URL('./health.html',import.meta.url))}}});
