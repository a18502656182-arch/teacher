import {mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import base from './vite.config';
export default mergeConfig(base,{define:{'process.env':'{}'},server:{port:4220},build:{outDir:fileURLToPath(new URL('../../.qa-shots/reflection-p01-build',import.meta.url)),rollupOptions:{input:fileURLToPath(new URL('./reflection.html',import.meta.url))}}});
