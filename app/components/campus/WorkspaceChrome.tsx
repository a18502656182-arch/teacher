'use client';

import Link from 'next/link';
import type { RosterClass } from '@/lib/classroom';
import { CampusIcon } from './primitives';
import { ClassSwitcher } from './ClassSwitcher';

export type WorkspaceModuleId = 'dictation' | 'dashboard' | 'students' | 'attendance' | 'homework' | 'points' | 'rules' | 'growth' | 'health' | 'weekly' | 'schedule' | 'tools' | 'seating' | 'duty' | 'cadres' | 'records' | 'scores' | 'reflection' | 'comments';
export type LearningScene = 'class' | 'family';

export const workspaceModules: { id: WorkspaceModuleId; label: string }[] = [
  { id: 'dashboard', label: '今日工作台' }, { id: 'students', label: '学生名单' },
  { id: 'dictation', label: '听写与复习' }, { id: 'attendance', label: '考勤与请假' },
  { id: 'homework', label: '作业追踪' }, { id: 'points', label: '积分评价' },
  { id: 'rules', label: '积分规则' }, { id: 'growth', label: '成长档案' },
  { id: 'health', label: '健康与照护' }, { id: 'weekly', label: '班级周报' },
  { id: 'schedule', label: '课程日程' }, { id: 'tools', label: '课堂工具' },
  { id: 'seating', label: '座位分组' }, { id: 'duty', label: '值日岗位' },
  { id: 'cadres', label: '班干部' }, { id: 'records', label: '家校沟通' },
  { id: 'scores', label: '成绩分析' }, { id: 'reflection', label: '考试反思' },
  { id: 'comments', label: '期末评语' },
];

export const workspaceNavGroups: { title: string; items: WorkspaceModuleId[] }[] = [
  { title: '今日', items: ['dashboard', 'homework', 'dictation', 'attendance'] },
  { title: '学生', items: ['students', 'growth', 'points', 'health', 'records'] },
  { title: '教学', items: ['scores', 'reflection', 'schedule', 'tools'] },
  { title: '班级', items: ['seating', 'duty', 'cadres', 'rules', 'weekly', 'comments'] },
];

type SaveStatusProps = { saving: boolean; dirty: boolean; error: string; isDemo: boolean; isReadOnly: boolean };
export function SaveStatus({ saving, dirty, error, isDemo, isReadOnly }: SaveStatusProps) {
  const state = isDemo ? 'demo' : isReadOnly ? 'readonly' : error ? 'error' : saving ? 'saving' : dirty ? 'dirty' : 'saved';
  const label = isDemo ? '演示模式' : isReadOnly ? '只读' : error ? '保存失败' : saving ? '正在保存' : dirty ? '待同步' : '已保存';
  return <span className="campus-save-status" data-state={state} role="status"><CampusIcon name={error ? 'warning' : saving ? 'sync' : 'check'}/>{label}</span>;
}

type DesktopHeaderProps = SaveStatusProps & {
  classes: RosterClass[]; activeClass: RosterClass; scene: LearningScene;
  onSwitchClass: (id: string) => void; onScene: (scene: LearningScene) => void; onAccount: () => void;
};
export function DesktopHeader({ classes, activeClass, scene, onSwitchClass, onScene, onAccount, ...status }: DesktopHeaderProps) {
  return <header className="campus-desktop-header">
    <Link className="campus-brand" href="/"><span><CampusIcon name="book"/></span><b>班主任工作台</b></Link>
    <label className="campus-header-class"><span>当前班级</span><select aria-label="当前班级" value={activeClass.id} onChange={event => onSwitchClass(event.target.value)}>{classes.map(item => <option value={item.id} key={item.id}>{item.name}（{item.students.length}人）</option>)}</select></label>
    <nav className="campus-domain-switch" aria-label="工作场景">
      <button type="button" aria-pressed={scene === 'class'} onClick={() => onScene('class')}><CampusIcon name="school"/>班级教学</button>
      <button type="button" aria-pressed={scene === 'family'} onClick={() => onScene('family')}><CampusIcon name="home"/>家庭学习</button>
    </nav>
    <div className="campus-header-account"><SaveStatus {...status}/><button type="button" onClick={onAccount}><CampusIcon name="user"/>我的工作台</button></div>
  </header>;
}

type WorkspaceNavProps = {
  active: WorkspaceModuleId; classes: RosterClass[]; activeClass: RosterClass; isDemo: boolean;
  onOpen: (id: WorkspaceModuleId) => void; onSwitch: (id: string) => void;
  onPatch: (patch: Partial<RosterClass>) => void; onAdd: () => void; onDelete: () => void;
  onAccount: () => void; onExport: () => void; onImport: () => void;
};
export function WorkspaceNav({ active, classes, activeClass, isDemo, onOpen, onSwitch, onPatch, onAdd, onDelete, onAccount, onExport, onImport }: WorkspaceNavProps) {
  return <aside className="campus-workspace-nav">
    <nav aria-label="班级工具">{workspaceNavGroups.map(group => <details key={`${group.title}-${group.items.includes(active) ? 'active' : 'idle'}`} open={group.items.includes(active) ? true : undefined}>
      <summary>{group.title}<CampusIcon name="chevron"/></summary>
      <div>{group.items.map(id => { const item = workspaceModules.find(entry => entry.id === id)!; return <button type="button" key={id} data-module={id} aria-current={active === id ? 'page' : undefined} onClick={() => onOpen(id)}><CampusIcon name={id}/><span>{item.label}</span></button>; })}</div>
    </details>)}</nav>
    <div className="campus-nav-utility">
      <ClassSwitcher classes={classes} activeClass={activeClass} onSwitch={onSwitch} onPatch={onPatch} onAdd={onAdd} onDelete={onDelete} showSelector={false}/>
      {isDemo ? <p><CampusIcon name="view"/><b>演示模式</b><span>数据不会保存</span></p> : <><button type="button" onClick={onAccount}><CampusIcon name="user"/><span><b>我的工作台</b><small>账户与使用期限</small></span></button><div><button type="button" onClick={onExport}>导出备份</button><button type="button" onClick={onImport}>恢复备份</button></div></>}
    </div>
  </aside>;
}
