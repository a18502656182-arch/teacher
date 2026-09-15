import {mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import base from './vite.config';
export default mergeConfig(base,{define:{'process.env':'{}'},server:{port:4216},build:{outDir:fileURLToPath(new URL('../../.qa-shots/records-p01-build',import.meta.url)),rollupOptions:{input:fileURLToPath(new URL('./records.html',import.meta.url))}}});
