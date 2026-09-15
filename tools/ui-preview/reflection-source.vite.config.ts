import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import base from './vite.config';
// Export current local components in memory for read-only synthetic recovery.
export default mergeConfig(base, { define: { 'process.env': '{}' }, server: { port: 4219 }, build:{outDir:fileURLToPath(new URL('../../.qa-shots/reflection-source-build',import.meta.url)),rollupOptions:{input:fileURLToPath(new URL('./reflection-source.html',import.meta.url))}}, plugins: [{ name: 'reflection-source-recovery', enforce: 'pre', transform(code: string, id: string) { if (id.replaceAll('\\', '/').endsWith('/app/w/[token]/ClassroomApp.tsx')) return code + '\nexport { Reflection as ReflectionSource, MobileSecondaryPage as ReflectionMobileSource };'; } }] });
