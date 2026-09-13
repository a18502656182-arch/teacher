import { useState } from 'react';
import { ThemeBoundary } from '../../app/components/workbench/theme/ThemeBoundary';
import { Input, Field } from '../../app/components/workbench/ui/Field';

/** Uses the complete production legacy stylesheet compiled by the local preview server. */
export function LegacyScopeProbe() {
  const [enabled, setEnabled] = useState(false);
  return <main style={{ padding: 24 }}>
    {/* This standalone Vite probe deliberately toggles a stylesheet for isolation testing. */}
    {/* eslint-disable-next-line @next/next/no-css-tags */}
    {enabled && <link rel="stylesheet" href="/__legacy-scoped.css" />}
    <h1>新旧控件作用域验证</h1>
    <p>加载正式入口使用的完整隔离产物；旧样本应变化，嵌套新控件的计算样式应保持。</p>
    <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />加载已限定作用域的完整旧CSS</label>
    <div data-ui-generation="legacy" data-theme="campus" style={{ marginTop: 24 }}>
      <label htmlFor="legacy-input">旧控件样本</label><input id="legacy-input" defaultValue="旧规则应只在这里生效" />
      <ThemeBoundary><div style={{ padding: 24 }}><Field id="next-input" label="嵌在旧容器内的新控件"><Input id="next-input" defaultValue="加载前后外观应不变" /></Field></div></ThemeBoundary>
    </div>
  </main>;
}
