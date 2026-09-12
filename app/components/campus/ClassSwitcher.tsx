'use client';
import type { RosterClass } from '@/lib/classroom';
import { Button, CampusIcon } from './primitives';

export function ClassSwitcher({ classes, activeClass, onSwitch, onPatch, onAdd, onDelete, showSelector = true }: {
  classes: RosterClass[]; activeClass: RosterClass;
  onSwitch: (id: string) => void; onPatch: (patch: Partial<RosterClass>) => void;
  onAdd: () => void; onDelete: () => void; showSelector?: boolean;
}) {
  return <section className="campus-class-switch">
    {showSelector && <label><span>当前班级</span><select value={activeClass.id} onChange={event => onSwitch(event.target.value)}>{classes.map(item => <option value={item.id} key={item.id}>{item.name}（{item.students.length}人）</option>)}</select></label>}
    <details className="campus-class-settings"><summary><CampusIcon name="rules"/>班级设置</summary>
      <div className="campus-class-editor">
        <label><span>班级名称</span><input value={activeClass.name} onChange={event => onPatch({ name: event.target.value })}/></label>
        <label><span>年级</span><input value={activeClass.grade} onChange={event => onPatch({ grade: event.target.value })}/></label>
        <label><span>学期</span><input value={activeClass.term} onChange={event => onPatch({ term: event.target.value })}/></label>
        <Button onClick={onAdd}><CampusIcon name="plus"/>新建班级</Button>
        <Button intent="danger" disabled={classes.length <= 1} onClick={onDelete}>删除当前班级</Button>
      </div>
    </details>
  </section>;
}
