import { writeFileSync } from 'node:fs';
import path from 'node:path';

export async function inspectStudents(page, viewport, screenshotDir, failures) {
  const evaluate = async (fn, ...args) => {
    const value = await page.send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: `(${fn.toString()})(...${JSON.stringify(args)})` });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
    return value.result.value;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const metrics = await evaluate(() => {
    const visible = selector => [...document.querySelectorAll(selector)].find(element => element.getClientRects().length > 0);
    const box = element => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    const workspace = visible('[data-students-region="workspace"]');
    const root = workspace?.closest('section');
    const detail = visible('[data-students-region="detail"]');
    const list = visible('[data-students-region="list"]');
    const tools = visible('[data-students-region="tools"]');
    const artwork = detail?.querySelector('[data-artwork-role="student.detail"]');
    const heading = [...(root?.querySelectorAll('h2') ?? [])].find(element => element.getClientRects().length > 0);
    return {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      fixture: window.__dashboardFixture ?? { scenario: 'unchanged-demo' },
      workspace: box(workspace), list: box(list), tools: box(tools), detail: box(detail),
      overview: box(visible('[data-students-region="overview"]')),
      artwork: artwork ? { box: box(artwork), source: artwork.currentSrc, fit: getComputedStyle(artwork).objectFit } : null,
      heading: heading?.textContent,
      headingSize: heading ? Number.parseFloat(getComputedStyle(heading).fontSize) : 0,
      rowCount: root?.querySelectorAll('[data-students-region="list"] tbody tr:not(:has(td[colspan])), [data-students-region="list"] article').length ?? 0,
      focusedRows: root?.querySelectorAll('tr[aria-current="true"]').length ?? 0,
      emptyText: root?.innerText.includes('没有符合条件的学生') || root?.innerText.includes('名单为空'),
      totalText: root?.innerText,
      exposesPhone: /(?:^|\D)1\d{10}(?:\D|$)/.test(root?.innerText ?? ''),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
    };
  });
  if (!metrics.workspace || !metrics.tools || !metrics.list) failures.push('Students page is missing the workspace, tools, or roster region.');
  if (metrics.headingSize < (viewport.width <= 900 ? 23 : 27)) failures.push(`Students heading hierarchy is too weak: ${metrics.headingSize}px.`);
  if (metrics.horizontalOverflow) failures.push('Students page has horizontal page overflow.');
  if (metrics.exposesPhone) failures.push('Students roster exposes a full parent phone number outside the single-student profile.');
  if (metrics.fixture.scenario === 'large' && !metrics.totalText?.includes('105')) failures.push('Students large scenario does not retain the 105-person roster total.');
  if (metrics.fixture.scenario === 'students-empty' && (!metrics.emptyText || metrics.rowCount !== 0)) failures.push('Students empty scenario does not render the true empty state.');
  if (metrics.fixture.scenario !== 'students-empty' && metrics.rowCount < 1) failures.push('Students roster does not render any current-class students.');
  if (viewport.width > 900) {
    if (!metrics.detail || !metrics.artwork) failures.push('Students desktop detail rail or roster artwork is missing.');
    if (metrics.workspace && metrics.detail && Math.abs(metrics.workspace.y - metrics.detail.y) > 1) failures.push('Students detail rail does not share the workspace top boundary.');
    if (viewport.width >= 1181 && metrics.detail && (metrics.detail.width < 330 || metrics.detail.width > 370)) failures.push(`Students detail rail should remain near 350px, found ${metrics.detail.width}px.`);
    if (viewport.width <= 1180 && metrics.detail && (metrics.detail.width < 280 || metrics.detail.width > 300)) failures.push(`Students intermediate detail rail should remain near 290px, found ${metrics.detail.width}px.`);
    if (!metrics.overview) failures.push('Students desktop class overview strip is missing.');
    if (metrics.artwork && (!metrics.artwork.source.includes('student-detail') || metrics.artwork.fit !== 'cover' || metrics.artwork.box.height < 160)) failures.push(`Students detail artwork is not integrated into its rail: ${JSON.stringify(metrics.artwork)}.`);
    if (metrics.fixture.scenario !== 'students-empty' && metrics.focusedRows !== 1) failures.push(`Students desktop must expose one current row, found ${metrics.focusedRows}.`);
  }
  const captureRegion = async (name, region) => {
    if (!screenshotDir || !region) return;
    const x = Math.max(0, region.x), y = Math.max(0, region.y);
    const width = Math.min(region.width, viewport.width - x), height = Math.min(region.height, viewport.height - y);
    if (width < 1 || height < 1) return;
    const shot = await page.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false, clip: { x, y, width, height, scale: 1 } });
    writeFileSync(path.join(screenshotDir, `${viewport.name}-students-${name}.png`), Buffer.from(shot.data, 'base64'));
  };
  await captureRegion('workspace', metrics.workspace);
  if (viewport.width > 900) await captureRegion('detail', metrics.detail);
  let interaction = null;
  if (viewport.width <= 900 && metrics.rowCount > 0) {
    const opened = await evaluate(() => {
      const row = [...document.querySelectorAll('[data-students-region="list"] article button')].find(element => element.getClientRects().length > 0);
      row?.click();
      return Boolean(row);
    });
    await wait(180);
    interaction = await evaluate(() => {
      const drawer = [...document.querySelectorAll('[role="dialog"]')].find(element => element.getClientRects().length > 0);
      return { opened: Boolean(drawer), title: drawer?.querySelector('h2,h3')?.textContent ?? '', hasFacts: drawer?.innerText.includes('近期成绩') && drawer?.innerText.includes('最近动态'), hasProfileAction: drawer?.innerText.includes('打开完整档案'), exposesPhone: /(?:^|\D)1\d{10}(?:\D|$)/.test(drawer?.innerText ?? '') };
    });
    if (screenshotDir && opened) {
      const shot = await page.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      writeFileSync(path.join(screenshotDir, `${viewport.name}-students-drawer.png`), Buffer.from(shot.data, 'base64'));
    }
    if (!opened || !interaction.opened || !interaction.hasFacts || !interaction.hasProfileAction || interaction.exposesPhone) failures.push(`Students mobile drawer interaction is incomplete: ${JSON.stringify(interaction)}.`);
  }
  if (metrics.rowCount > 0) {
    const selection = await evaluate(() => {
      const checkbox = [...document.querySelectorAll('[data-students-region="list"] input[type="checkbox"]')].find(element => element.getClientRects().length > 0);
      checkbox?.click();
      const bar = document.querySelector('[role="region"][aria-label="批量操作"]');
      return { clicked: Boolean(checkbox), visible: Boolean(bar?.getClientRects().length), text: bar?.innerText ?? '' };
    });
    if (!selection.clicked || !selection.visible || !selection.text.includes('已选')) failures.push(`Students selection does not expose the contextual batch bar: ${JSON.stringify(selection)}.`);
  }
  return { ...metrics, interaction };
}
