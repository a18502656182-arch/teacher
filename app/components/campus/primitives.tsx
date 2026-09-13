import { Icon } from '../workbench/ui/Icon';
import { legacyIconNames } from '../workbench/ui/icons';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Artwork } from '../workbench/theme/Artwork';
import { artworkRoleBySlot, type ArtworkSlot } from './theme';
export function CampusIcon({ name, className = '' }: { name: string; className?: string }) {
  return <Icon name={legacyIconNames[name] ?? name} className={`campus-icon ${className}`}/>;
}
export function ThemeArtwork({ slot, className = '' }: { slot: ArtworkSlot; className?: string }) { return <Artwork role={artworkRoleBySlot[slot]} className={`campus-art ${className}`}/>; }
export function Button({ intent = 'secondary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { intent?: 'primary' | 'secondary' | 'text' | 'danger' }) { return <button type="button" className={`campus-button campus-${intent} ${className}`} {...props}>{children}</button>; }
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) { return <div className="campus-empty"><ThemeArtwork slot="empty"/><p>{children}</p>{action}</div>; }
export function MetricStrip({ items }: { items: { label:string; value:ReactNode; detail:string }[] }) { return <section className="campus-metric-strip" aria-label="班级概况">{items.map(item=><div key={item.label}><span>{item.label}</span><b>{item.value}</b><small>{item.detail}</small></div>)}</section>; }
export function PageHeader({ title, description, actions, artwork }: { title: string; description?: string; actions?: ReactNode; artwork?: ArtworkSlot }) { return <header className="campus-page-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="campus-actions">{actions}</div>}{artwork && <ThemeArtwork slot={artwork}/>}</header>; }
export function Pager({ page, count, size = 20, onPage }: { page:number; count:number; size?:number; onPage:(n:number)=>void }) { const pages=Math.max(1,Math.ceil(count/size)); return <nav className="campus-pager" aria-label="分页"><span>{count ? (page-1)*size+1 : 0}至{Math.min(page*size,count)} / 共{count}项</span><Button disabled={page<=1} onClick={()=>onPage(page-1)}>上一页</Button><span>{page} / {pages}</span><Button disabled={page>=pages} onClick={()=>onPage(page+1)}>下一页</Button></nav>; }
