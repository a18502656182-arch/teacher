'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { RosterClass } from '@/lib/classroom';
import { CampusIcon } from '@/app/components/campus/primitives';
import { ThemeBoundary } from '../theme/ThemeBoundary';
import { Drawer } from '../ui/Drawer';
import { mobileMoreGroups, mobilePrimaryModules, moduleLabel, workspaceModules, workspaceNavGroups, type LearningScene, type WorkspaceModuleId } from './catalog';
import styles from './shell.module.css';

type SaveState = { saving: boolean; dirty: boolean; error: string; isDemo: boolean; isReadOnly: boolean };

type WorkbenchShellProps = SaveState & {
  pageClassName?: string;
  active: WorkspaceModuleId;
  scene: LearningScene;
  classes: RosterClass[];
  activeClass: RosterClass;
  workspaceGrade: string;
  desktopContent: ReactNode;
  mobileContent: ReactNode;
  onOpen: (id: WorkspaceModuleId) => void;
  onBack: () => void;
  onSwitchClass: (id: string) => void;
  onScene: (scene: LearningScene) => void;
  onAccount: () => void;
  onRetrySave: () => void;
  onClearError: () => void;
  saveConflict: boolean;
  onExportDraft: () => void;
  onLoadLatest: () => void;
};

export function SaveStatus({ saving, dirty, error, isDemo, isReadOnly }: SaveState) {
  const state = isDemo ? 'demo' : isReadOnly ? 'readonly' : error ? 'error' : saving ? 'saving' : dirty ? 'dirty' : 'saved';
  const label = isDemo ? '演示模式' : isReadOnly ? '只读' : error ? '保存失败' : saving ? '正在保存' : dirty ? '待同步' : '已保存';
  return <span className={styles.saveStatus} data-state={state} role="status"><CampusIcon name={error ? 'warning' : saving ? 'sync' : 'check'}/>{label}</span>;
}

function StatusNotice(props: SaveState & Pick<WorkbenchShellProps, 'saveConflict' | 'onRetrySave' | 'onClearError' | 'onExportDraft' | 'onLoadLatest'>) {
  if (!props.error) return null;
  return <div className={styles.alert} role="alert"><span>{props.error}</span><div>{props.saveConflict ? <><button type="button" onClick={props.onExportDraft}>导出当前草稿</button><button type="button" onClick={props.onLoadLatest}>载入最新版本</button></> : props.error.includes('请在听写页面重试保存') ? <span>请使用听写表单中的重试操作</span> : <button type="button" disabled={props.saving} onClick={props.onRetrySave}>{props.saving ? '正在重试…' : '重试'}</button>}<button type="button" onClick={props.onClearError}>关闭</button></div></div>;
}

function AccessNotice({ isDemo, isReadOnly }: Pick<SaveState, 'isDemo' | 'isReadOnly'>) {
  if (!isDemo && !isReadOnly) return null;
  return <div className={styles.accessNotice}><b>{isDemo ? '演示模式' : '只读宽限期'}</b><span>{isDemo ? '数据不会保存，AI 使用静态示例。' : '可以查看和导出，续期后恢复编辑。'}</span></div>;
}

export function WorkbenchShell(props: WorkbenchShellProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const scrollPositionsRef = useRef<Record<string, { page: number; content: number }>>({});
  const primary = mobilePrimaryModules.some(item => item.id === props.active);
  const classStudents = props.activeClass.students ?? [];
  const contentFamily = props.active === 'dashboard' ? 'dashboard' : ['students', 'growth', 'points', 'health', 'records'].includes(props.active) ? 'student' : ['homework', 'dictation', 'attendance'].includes(props.active) ? 'task' : ['scores', 'reflection', 'schedule', 'tools'].includes(props.active) ? 'teaching' : 'class';
  const saveState = { saving: props.saving, dirty: props.dirty, error: props.error, isDemo: props.isDemo, isReadOnly: props.isReadOnly };

  const rememberScroll = () => {
    const content = document.querySelector<HTMLElement>('[data-mobile-workspace-content]');
    scrollPositionsRef.current[props.active] = { page: window.scrollY, content: content?.scrollTop ?? 0 };
  };

  useEffect(() => {
    const content = document.querySelector<HTMLElement>('[data-mobile-workspace-content]');
    const saved = scrollPositionsRef.current[props.active] ?? { page: 0, content: 0 };
    const frame = window.requestAnimationFrame(() => {
      content?.scrollTo({ top: saved.content, behavior: 'auto' });
      window.scrollTo({ top: saved.page, behavior: 'auto' });
    });
    setMoreOpen(false);
    return () => window.cancelAnimationFrame(frame);
  }, [props.active]);

  const openModule = (id: WorkspaceModuleId) => {
    rememberScroll();
    props.onOpen(id);
  };

  const back = () => {
    rememberScroll();
    props.onBack();
  };

  const openFromMore = (id: WorkspaceModuleId) => {
    setMoreOpen(false);
    openModule(id);
  };

  return <div className={styles.shell} data-module={props.active} data-theme="campus">
    <ThemeBoundary className={styles.desktopHeaderBoundary}>
      <header className={styles.desktopHeader}>
        <Link className={styles.brand} href="/"><span><CampusIcon name="book"/></span><b>班主任工作台</b></Link>
        <label className={styles.classPicker}><span>当前班级</span><select aria-label="当前班级" value={props.activeClass.id} onChange={event => props.onSwitchClass(event.target.value)}>{props.classes.map(item => <option value={item.id} key={item.id}>{item.name}（{item.students.length}人）</option>)}</select></label>
        <nav className={styles.sceneSwitch} aria-label="工作场景"><button type="button" aria-pressed={props.scene === 'class'} onClick={() => props.onScene('class')}><CampusIcon name="school"/>班级教学</button><button type="button" aria-pressed={props.scene === 'family'} onClick={() => props.onScene('family')}><CampusIcon name="home"/>家庭学习</button></nav>
        <div className={styles.account}><SaveStatus {...saveState}/><button type="button" onClick={props.onAccount}><CampusIcon name={props.isDemo ? 'view' : 'user'}/>{props.isDemo ? '演示说明' : '账户与班级'}</button></div>
      </header>
    </ThemeBoundary>

    <ThemeBoundary className={styles.desktopNavBoundary}>
      <aside className={styles.desktopNav} data-workbench-navigation><nav aria-label="班级工具">{workspaceNavGroups.map(group => <section key={group.title}><h2>{group.title}</h2>{group.items.map(id => { const item = workspaceModules.find(entry => entry.id === id)!; return <button type="button" key={id} aria-current={props.active === id ? 'page' : undefined} onClick={() => openModule(id)}><CampusIcon name={id}/><span>{item.label}</span></button>; })}</section>)}</nav>{props.isDemo && <p className={styles.demoNote}><CampusIcon name="view"/><span><b>演示模式</b><small>数据不会保存</small></span></p>}</aside>
    </ThemeBoundary>

    <section className={styles.mobile} data-module={props.active} aria-label="手机版班主任工作台">
      <ThemeBoundary className={styles.mobileHeaderBoundary}>
        <header className={styles.mobileHeader}>
          <div className={styles.mobileTitle}>{props.active !== 'dashboard' && <button type="button" aria-label="返回上一页" onClick={back}><CampusIcon name="chevron"/></button>}<span aria-hidden="true"><CampusIcon name={props.active === 'dashboard' ? 'book' : props.active}/></span><div><h1>{props.active === 'dashboard' ? '班主任工作台' : moduleLabel(props.active)}</h1><p>{props.scene === 'family' ? '家庭学习' : `${props.activeClass.grade || props.workspaceGrade || '当前班级'} · ${classStudents.length}人`}</p></div></div>
          <SaveStatus {...saveState}/>
          {['dashboard', 'dictation'].includes(props.active) && <div className={styles.mobileContext} data-scene-only={props.active === 'dictation' || undefined}>{props.active === 'dashboard' && <label><span>当前班级</span><select value={props.activeClass.id} onChange={event => props.onSwitchClass(event.target.value)}>{props.classes.map(item => <option key={item.id} value={item.id}>{item.name}（{item.students.length}人）</option>)}</select></label>}<nav aria-label="工作场景"><button type="button" aria-pressed={props.scene === 'class'} onClick={() => props.onScene('class')}>班级教学</button><button type="button" aria-pressed={props.scene === 'family'} onClick={() => props.onScene('family')}>家庭学习</button></nav></div>}
        </header>
      </ThemeBoundary>
      <StatusNotice {...props} {...saveState}/><AccessNotice {...saveState}/>
      <main className={`mobile-workbench mobile-screen ${styles.mobileContent} ${props.pageClassName ?? ''}`} data-module={props.active} data-mobile-workspace-content>{props.mobileContent}</main>
      <ThemeBoundary className={styles.mobileTabBoundary}>
        <nav className={styles.mobileTabs} aria-label="手机底部导航">{mobilePrimaryModules.map(item => <button type="button" key={item.id} aria-current={props.active === item.id ? 'page' : undefined} onClick={() => openModule(item.id)}><CampusIcon name={item.id}/><span>{item.label}</span></button>)}<button ref={moreTriggerRef} type="button" aria-expanded={moreOpen} aria-current={!primary ? 'page' : undefined} onClick={() => setMoreOpen(true)}><CampusIcon name="more"/><span>更多</span></button></nav>
      </ThemeBoundary>
      <ThemeBoundary className={styles.overlayBoundary}><Drawer open={moreOpen} title="全部工具" description="底栏之外的 15 个模块，按工作内容分组" drawerPlacement="bottom" returnFocusRef={moreTriggerRef} onRequestClose={() => setMoreOpen(false)}><div className={styles.moreGroups}>{mobileMoreGroups.map(group => <section key={group.title}><h3>{group.title}</h3><div>{group.items.map(id => <button type="button" key={id} aria-current={props.active === id ? 'page' : undefined} onClick={() => openFromMore(id)}><CampusIcon name={id}/><span>{moduleLabel(id)}</span></button>)}</div></section>)}</div><button className={styles.moreAccount} type="button" onClick={() => { setMoreOpen(false); props.onAccount(); }}>{props.isDemo ? '演示工作台说明' : '账户、班级与备份'}</button></Drawer></ThemeBoundary>
    </section>
    <main className={styles.desktopMain}><StatusNotice {...props} {...saveState}/><AccessNotice {...saveState}/><div className={`campus-workspace-content ${props.pageClassName ?? ''}`} data-family={contentFamily}>{props.desktopContent}</div></main>
  </div>;
}
