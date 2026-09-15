import { mergeConfig } from 'vite';
import base from './vite.config';
export default mergeConfig(base,{server:{port:4209}});
