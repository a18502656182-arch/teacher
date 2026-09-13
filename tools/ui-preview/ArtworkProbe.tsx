import { Artwork } from '../../app/components/workbench/theme/Artwork';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import type { ArtworkRole } from '../../app/components/workbench/theme/contracts';

const roles: Array<{ role: ArtworkRole; title: string; detail: string }> = [
  { role: 'home.scene', title: '今天的班务', detail: '左侧文字安全区 · 教室晨光母样' },
  { role: 'dictation.context', title: '英语听写', detail: '词卡、铅笔与留白' },
  { role: 'student.detail', title: '学生档案', detail: '空白名册与学习记录' },
  { role: 'homework.context', title: '语文作业', detail: '作业本、批注笔与文具' },
];

/** Container crop probe only; all displayed copy is HTML, never baked into assets. */
export function ArtworkProbe() {
  return <ThemeBoundary><main className="artwork-probe">
    <header><h1>首批校园插画裁切检查</h1><p>桌面与手机使用独立资源；文字由HTML提供。</p></header>
    {roles.map(item => <section className="artwork-probe-banner" key={item.role} data-role={item.role}>
      <Artwork role={item.role} className="artwork-probe-image" sizes="(max-width: 600px) 100vw, 920px" />
      <div><h2>{item.title}</h2><p>{item.detail}</p></div>
    </section>)}
  </main></ThemeBoundary>;
}
