import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import base from './vite.config';
// Export current local components in memory for read-only synthetic recovery.
export default mergeConfig(base, { define: { 'process.env': '{}' }, server: { port: 4217 }, build:{outDir:fileURLToPath(new URL('../../.qa-shots/scores-source-build',import.meta.url)),rollupOptions:{input:fileURLToPath(new URL('./scores-source.html',import.meta.url))}}, plugins: [{ name: 'scores-source-recovery', enforce: 'pre', transform(code: string, id: string) { if (id.replaceAll('\\', '/').endsWith('/app/w/[token]/ClassroomApp.tsx')) return code + '\nexport { Scores as ScoresSource, MobileScores as ScoresMobileSource };'; } }] });
