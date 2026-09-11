import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { themes, resolveTheme, type ArtworkSlot } from './theme';
const paths: Record<string,string> = {
  dashboard:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z', students:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  book:'M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v16c-4-1-7 0-9 2-2-2-5-3-9-2Z',
  homework:'M5 3h12l3 3v15H5ZM8 8h8M8 12h8M8 16h5', attendance:'M8 3h8v4H8ZM6 5H3v16h18V5h-3M7 14l3 3 7-7',
  scores:'M4 3v18h17M8 17v-5M13 17V8M18 17V4', points:'m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1Z',
  schedule:'M4 5h16v16H4ZM8 2v6M16 2v6M4 10h16M8 14h3M14 14h3', health:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
  records:'M3 4h18v13H8l-5 4ZM7 8h10M7 12h7', seating:'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  rules:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M8 15v6', tools:'M4 4h16v16H4ZM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
  growth:'M12 21V9M12 16C3 16 3 9 3 7c7 0 9 4 9 9ZM12 12c9 0 9-7 9-9-7 0-9 4-9 9Z',
  more:'M4 4h5v5H4ZM15 4h5v5h-5ZM4 15h5v5H4ZM15 15h5v5h-5Z', plus:'M12 5v14M5 12h14', check:'m5 12 4 4L19 6', arrow:'M5 12h14m-5-5 5 5-5 5', search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
};
const names: Record<string,string> = {'🎒':'students','📚':'homework','🧾':'attendance','🩺':'health','🎲':'tools','⭐':'points','🌱':'growth','🗞️':'homework','🪑':'seating','🧹':'attendance','🎖️':'students','💬':'records','📈':'scores','📝':'book','✍️':'records','🗂️':'schedule','📏':'rules','今日工作台':'dashboard','学生名单':'students','作业追踪':'homework','考勤与请假':'attendance','听写与复习':'book','成绩分析':'scores','积分评价':'points','积分规则':'rules','成长档案':'growth','健康与照护':'health','班级周报':'homework','课程日程':'schedule','课堂工具':'tools','座位分组':'seating','值日岗位':'attendance','班干部':'students','家校沟通':'records','考试反思':'book','期末评语':'records',dictation:'book',weekly:'homework',duty:'attendance',cadres:'students',reflection:'book',comments:'records'};
export function CampusIcon({ name, className = '' }: { name: string; className?: string }) { return <svg className={`campus-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[names[name] ?? name] ?? paths.book}/></svg>; }
// Assets are locally generated WebP files, pre-sized during asset production.
// eslint-disable-next-line @next/next/no-img-element
export function ThemeArtwork({ slot, className = '' }: { slot: ArtworkSlot; className?: string }) { const src = themes[resolveTheme()].artwork[slot]; return src ? <img className={`campus-art ${className}`} src={src} width="300" height="200" alt="" aria-hidden="true" decoding="async"/> : null; }
export function Button({ intent = 'secondary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { intent?: 'primary' | 'secondary' | 'text' | 'danger' }) { return <button type="button" className={`campus-button campus-${intent} ${className}`} {...props}>{children}</button>; }
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) { return <div className="campus-empty"><ThemeArtwork slot="empty"/><p>{children}</p>{action}</div>; }
export function MetricStrip({ items }: { items: { label:string; value:ReactNode; detail:string }[] }) { return <section className="campus-metric-strip" aria-label="班级概况">{items.map(item=><div key={item.label}><span>{item.label}</span><b>{item.value}</b><small>{item.detail}</small></div>)}</section>; }
export function PageHeader({ title, description, actions, artwork }: { title: string; description?: string; actions?: ReactNode; artwork?: ArtworkSlot }) { return <header className="campus-page-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="campus-actions">{actions}</div>}{artwork && <ThemeArtwork slot={artwork}/>}</header>; }
export function Pager({ page, count, size = 20, onPage }: { page:number; count:number; size?:number; onPage:(n:number)=>void }) { const pages=Math.max(1,Math.ceil(count/size)); return <nav className="campus-pager" aria-label="分页"><span>{count ? (page-1)*size+1 : 0}至{Math.min(page*size,count)} / 共{count}项</span><Button disabled={page<=1} onClick={()=>onPage(page-1)}>上一页</Button><span>{page} / {pages}</span><Button disabled={page>=pages} onClick={()=>onPage(page+1)}>下一页</Button></nav>; }
