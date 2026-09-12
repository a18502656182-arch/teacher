import type { ClassroomData } from '@/lib/classroom';
export type Workspace = { className: string; grade: string; term: string; expiresAt: string; accessMode?: 'active' | 'readonly'; revision: number; data: ClassroomData };
export type LocalWorkspaceDraft = { revision: number; data: ClassroomData; savedAt: number };
