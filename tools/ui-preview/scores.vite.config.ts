import {mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import base from './vite.config';
export default mergeConfig(base,{define:{'process.env':'{}'},server:{port:4218},build:{outDir:fileURLToPath(new URL('../../.qa-shots/scores-p01-build',import.meta.url)),rollupOptions:{input:fileURLToPath(new URL('./scores.html',import.meta.url))}}});
