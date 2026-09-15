import { mergeConfig } from 'vite';
import base from './vite.config';
// Export current local components in memory for read-only synthetic recovery.
export default mergeConfig(base, { define: { 'process.env': '{}' }, server: { port: 4211 }, plugins: [{ name: 'growth-source-recovery', enforce: 'pre', transform(code: string, id: string) { if (id.replaceAll('\\', '/').endsWith('/app/w/[token]/ClassroomApp.tsx')) return code + '\nexport { Growth as GrowthSource, MobileSecondaryPage as GrowthMobileSource };'; } }] });
