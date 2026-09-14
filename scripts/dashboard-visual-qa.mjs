import { writeFileSync } from 'node:fs';
import path from 'node:path';

// Runs only in an isolated QA browser. No production endpoint or persisted data is changed.
export function dashboardFixtureScript(scenario, date = '') {
  return `(${installFixture.toString()})(${JSON.stringify(scenario)}, ${JSON.stringify(date)})`;
}

function installFixture(scenario, date) {
  if (date) {
    const NativeDate = Date;
    const fixed = new NativeDate(`${date}T09:00:00+08:00`).getTime();
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    };
  }
  if (!scenario) return;
  // Clear only this run's synthetic workspace draft between viewport navigations.
  window.localStorage.removeItem('classroom-workspace-draft:qa-visual');
  const nativeFetch = window.fetch.bind(window);
  window.__dashboardFixture = { scenario, date, workspaceWrites: 0 };
  window.fetch = async (input, options) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.includes('/api/workspace/qa-visual')) return nativeFetch(input, options);
    if ((options?.method ?? 'GET') !== 'GET') {
      window.__dashboardFixture.workspaceWrites++;
      // A simulated acknowledgement only: the request never reaches an API/database.
      return new Response(JSON.stringify({ ok: true, revision: (JSON.parse(options.body).revision || 1) + 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const response = await nativeFetch('/api/workspace/demo');
    const payload = await response.json();
    const data = payload.workspace.data;
    payload.workspace.accessMode = 'active';
    const count = scenario === 'large' ? 105 : 2;
    const students = Array.from({ length: count }, (_, i) => ({ id: `qa-a-${i}`, name: i === 0 ? '欧阳慕容长姓名测试同学' : `测试甲${i + 1}`, gender: '女', group: i % 4 + 1, seat: i + 1, points: 0, homework: '已交', attendance: '正常', score: 90 }));
    const other = [{ ...students[1], id: 'qa-b-0', name: '测试乙同学' }];
    data.students = students;
    data.activeClassId = 'qa-a';
    data.rosterClasses = [{ id: 'qa-a', name: '合成甲班', grade: '五年级', term: '上学期', students }, { id: 'qa-b', name: '合成乙班', grade: '五年级', term: '上学期', students: other }];
    data.homeworkTasks = [];
    data.records = [];
    data.attendanceRecords = [];
    data.teacherAgenda = [];
    data.courses = [];
    data.scheduleWeeks = [];
    data.scheduleEvents = [];
    data.dailyFocus = [];
    data.dutyJobs = [];
    const disabledJobs = [{ id: 'qa-disabled', name: '合成已停用岗位', area: '', standard: '', enabled: false }];
    data.classDutySettings = { 'qa-a': { jobs: disabledJobs }, 'qa-b': { jobs: disabledJobs } };
    const periods = Array.from({ length: 8 }, (_, i) => ({ label: `第${i + 1}节`, time: `${String(8 + i).padStart(2, '0')}:00-${String(8 + i).padStart(2, '0')}:40` }));
    data.classSchedules = {
      'qa-a': { config: { days: [scenario === 'large' ? '周一' : '周二'], periods }, courses: [periods.map((_, i) => `合成课程${i + 1}`)], events: [], focuses: [], weeks: [] },
      'qa-b': { config: { days: ['周二'], periods }, courses: [['乙班课程']], events: [], focuses: [], weeks: [] },
    };
    const today = date || '2026-09-14';
    data.dictation = { version: 1, children: [], books: [], tasks: [] };
    if (scenario === 'large') {
      const task = { id: 'qa-dictation', title: '合成甲班长标题听写：校园生活与日常学习词语复习', date: today, subject: '语文', context: { kind: 'class', classId: 'qa-a' }, participants: students.map((s, i) => ({ id: s.id, name: s.name, number: String(i + 1) })), words: Array.from({ length: 200 }, (_, i) => ({ id: `qa-word-${i}`, text: `测试词语${i + 1}`, meaning: '', lesson: '第1组' })), results: {}, createdAt: `${today}T01:00:00Z` };
      data.dictation.tasks = [task];
      data.attendanceRecords = [{ id: 'qa-attendance', classId: 'qa-a', studentId: students[0].id, date: today, period: '上午', status: '迟到', reason: '合成待确认事实', approval: '待确认', createdAt: 1 }];
      data.classDutySettings['qa-a'].jobs = [{ id: 'qa-duty', name: '教室整理', area: '讲台与窗台', standard: '合成场景', enabled: true, studentIds: [students[0].id] }];
    }
    return new Response(JSON.stringify(payload), { status: response.status, headers: { 'content-type': 'application/json' } });
  };
}

export async function inspectDashboard(page, viewport, screenshotDir, failures) {
  const evaluate = async (fn, ...args) => {
    const value = await page.send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: `(${fn.toString()})(...${JSON.stringify(args)})` });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
    return value.result.value;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const metrics = await evaluate(() => {
    const visible = selector => [...document.querySelectorAll(selector)].find(el => el.getClientRects().length > 0);
    const root = visible('[aria-labelledby="dashboard-title"]');
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    const article = [...root.querySelectorAll('article')].find(el => el.querySelector('h2')?.textContent === '听写与复习');
    const body = article.querySelector('header + div');
    const art = body?.querySelector('img');
    const copy = body?.querySelector(':scope > div');
    const date = root.querySelector('[class*="mobileDate"]');
    const primary = root.querySelector('[class*="tasks"] > button:last-child');
    const style = getComputedStyle(primary);
    const luminance = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    const fg = luminance(style.color), bg = luminance(style.backgroundColor);
    const artwork = el => el ? { box: box(el), source: el.currentSrc, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, fit: getComputedStyle(el).objectFit, position: getComputedStyle(el).objectPosition } : null;
    return {
      url: location.href, title: document.title, userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      fixture: window.__dashboardFixture ?? { scenario: 'unchanged-demo' },
      headings: [...root.querySelectorAll('h2')].map(el => el.textContent),
      visualRoles: {
        sceneArtwork: artwork(root.querySelector('[data-artwork-role="home.scene"]')),
        stationeryArtwork: artwork(article.querySelector('[class*="stationery"] img')),
        heading: root.querySelector('h1')?.textContent,
        headingSize: getComputedStyle(root.querySelector('h1')).fontSize,
        dateSize: getComputedStyle(root.querySelector('header time')).fontSize,
        scene: root.querySelector('[data-artwork-role="home.scene"]')?.currentSrc,
        stationery: box(article.querySelector('[class*="stationery"]')),
        sections: [...root.querySelectorAll('article')].map(el => ({title: el.querySelector('h2')?.textContent, background: getComputedStyle(el).backgroundColor, icon: getComputedStyle(el.querySelector('header .campus-icon')).color})),
        subjects: [...root.querySelectorAll('[data-course-tone]')].map(el => ({text: el.textContent, tone: el.dataset.courseTone, background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color})),
      },
      dictation: { state: article.querySelector('h3') ? 'task' : 'empty', image: box(art), picture: box(art?.parentElement), text: box(copy), textContent: copy?.innerText, body: box(body) },
      date: { groups: [...date.querySelectorAll('span')].map(el => ({ text: el.textContent, box: box(el), whiteSpace: getComputedStyle(el).whiteSpace })) },
      primary: { color: style.color, background: style.backgroundColor, contrast: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) },
      stage: box(root.querySelector('[aria-label="今日班务总览"]')),
      lower: box(root.querySelector('[class*="lower"]')),
      alignment: [...root.querySelectorAll('article')].map(el => {
        const header = el.querySelector('header');
        const css = getComputedStyle(el);
        return { title: el.querySelector('h2').textContent, box: box(el), header: box(header), icon: box(header.querySelector('.campus-icon')), heading: box(el.querySelector('h2')), content: box(header.nextElementSibling), padding: [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft], border: css.borderTopWidth, radius: css.borderRadius, action: box(header.querySelector('button')), grid: getComputedStyle(el.parentElement).gridTemplateColumns, gap: getComputedStyle(el.parentElement).columnGap };
      }),
      taskActions: [...root.querySelectorAll('[class*="tasks"] > button:not(:last-child)')].map(el => ({ label: el.querySelector('b').textContent, action: el.querySelector('[class*="taskAction"]')?.textContent, icon: box(el.querySelector('.campus-icon')), iconPadding: getComputedStyle(el.querySelector('.campus-icon')).padding, nestedButtons: el.querySelectorAll('button').length })),
      courseCount: root.querySelectorAll('ol li').length,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  if (metrics.dictation.text?.width < 170) failures.push(`Dashboard dictation text squeezed: ${metrics.dictation.text.width}px`);
  if (metrics.dictation.state === 'empty' && metrics.dictation.image?.width > 119) failures.push('Dashboard empty artwork exceeds its local width constraint.');
  if (viewport.width <= 900 && metrics.date.groups.some(group => group.whiteSpace !== 'nowrap')) failures.push('Dashboard date groups can break inside a semantic word.');
  if (viewport.width > 900 && metrics.primary.contrast < 4.5) failures.push(`Dashboard primary contrast ${metrics.primary.contrast} < 4.5.`);
  if (metrics.horizontalOverflow) failures.push('Dashboard horizontal overflow.');
  const near = (a, b) => Math.abs(a - b) <= 1;
  const regions = metrics.alignment;
  for (const [a, b] of (viewport.width > 900 ? [[0, 2], [1, 3]] : [[0, 1], [0, 2], [0, 3]])) {
    for (const field of ['box', 'header', 'heading', 'icon', 'content']) {
      if (!near(regions[a][field].x, regions[b][field].x)) failures.push(`Dashboard ${field} starts misaligned: ${regions[a].title} / ${regions[b].title}`);
    }
    if (!near(regions[a].box.width, regions[b].box.width) || regions[a].gap !== regions[b].gap || regions[a].radius !== regions[b].radius) failures.push('Dashboard region widths/gaps/container expressions differ.');
  }
  if (metrics.taskActions.some(action => !action.action || action.icon.width < 36 || action.nestedButtons)) failures.push('Dashboard task action/icon contract failed.');
  if (metrics.visualRoles.stationeryArtwork?.fit !== 'contain') failures.push('Dashboard stationery must preserve the complete subject.');
  if (viewport.width > 900 && metrics.visualRoles.sceneArtwork?.fit !== 'contain') failures.push('Dashboard classroom foreground must not be cover-cropped.');
  const sequence = [];
  if (screenshotDir) {
    let done = false;
    for (let index = 0; index < 20 && !done; index++) {
      const position = await evaluate(async (index) => {
        const content = [...document.querySelectorAll('[aria-labelledby="dashboard-title"]')].find(el => el.getClientRects().length);
        let scroller = content.parentElement;
        while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
        scroller ??= document.scrollingElement;
        const step = Math.max(200, (scroller === document.scrollingElement ? innerHeight : scroller.clientHeight) - 180);
        scroller.scrollTo({ top: index * step, behavior: 'instant' });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { top: scroller.scrollTop, height: scroller.scrollHeight, clientHeight: scroller.clientHeight, atEnd: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2 };
      }, index);
      await wait(100);
      const shot = await page.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      const file = `${viewport.name}-dashboard-scroll-${String(index).padStart(2, '0')}.png`;
      writeFileSync(path.join(screenshotDir, file), Buffer.from(shot.data, 'base64'));
      sequence.push({ file, ...position });
      done = position.atEnd;
    }
    if (!done) failures.push('Dashboard continuous capture did not reach the page end.');
    metrics.bottom = await evaluate(() => {
      const visible = selector => [...document.querySelectorAll(selector)].find(el => el.getClientRects().length);
      const root = visible('[aria-labelledby="dashboard-title"]');
      const nav = visible('[aria-label="手机底部导航"]');
      const buttons = [...root.querySelectorAll('button')].filter(el => el.getClientRects().length);
      const last = buttons.at(-1);
      const rect = last.getBoundingClientRect();
      const navTop = nav?.getBoundingClientRect().top ?? innerHeight;
      return { lastAction: last.textContent, lastActionBottom: rect.bottom, navigationTop: navTop, safe: rect.bottom <= navTop + 1 };
    });
    if (!metrics.bottom.safe) failures.push('Dashboard last action is covered by the bottom navigation.');
  }
  metrics.scrollSequence = sequence;
  metrics.localCaptures = [];
  if (screenshotDir) {
    for (const region of ['tasks', 'agenda', 'dictation', 'duty', 'attention', ...(viewport.width > 900 ? ['four-regions'] : [])]) {
      const clip = await evaluate(async region => {
        const root = [...document.querySelectorAll('[aria-labelledby="dashboard-title"]')].find(el => el.getClientRects().length);
        const el = region === 'four-regions' ? root.querySelector('[class*="middle"]') : root.querySelector(`[class*="${region}"]`);
        el.scrollIntoView({ block: region === 'four-regions' ? 'start' : 'center', behavior: 'instant' });
        if (region === 'four-regions') window.scrollBy(0, -90);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const r = el.getBoundingClientRect();
        const bottom = region === 'four-regions' ? root.querySelector('[class*="lower"]').getBoundingClientRect().bottom : r.bottom;
        return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: bottom - r.y, scale: 1 };
      }, region);
      const shot = await page.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true, clip });
      const file = `${viewport.name}-local-${region}.png`;
      writeFileSync(path.join(screenshotDir, file), Buffer.from(shot.data, 'base64'));
      metrics.localCaptures.push({ region, file, clip, nativeScale: 1 });
    }
  }
  metrics.interactions = [];
  if (viewport.width <= 900) {
    for (const [label, destination] of [['学生名单', 'students'], ['听写与复习', 'dictation'], ['作业追踪', 'homework'], ['值日安排', 'duty']]) {
      const clicked = await evaluate(label => {
        const header = [...document.querySelectorAll('#dashboard-quick-title')].find(el => el.getClientRects().length);
        const button = [...header.parentElement.parentElement.querySelectorAll('button')].find(el => el.textContent === label);
        button.scrollIntoView({ block: 'center' });
        button.click(); return true;
      }, label);
      let actual;
      for (let i = 0; i < 30; i++) {
        actual = await evaluate(() => [...document.querySelectorAll('[data-module]')].find(el => el.getClientRects().length)?.dataset.module);
        const loaded = await evaluate(() => ![...document.querySelectorAll('[data-workspace-loading]')].some(el => el.getClientRects().length));
        if (actual === destination && loaded) break;
        await wait(100);
      }
      const state = await evaluate(() => ({ url: location.href, visibleHeadings: [...document.querySelectorAll('h1,h2')].filter(el => el.getClientRects().length).map(el => el.textContent), loading: [...document.querySelectorAll('[data-workspace-loading]')].some(el => el.getClientRects().length), visibleContent: document.body.innerText.slice(0, 600) }));
      if (state.loading) failures.push(`Dashboard quick action ${label} remained loading.`);
      metrics.interactions.push({ label, expected: destination, actual, clicked, ...state });
      if (screenshotDir) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        writeFileSync(path.join(screenshotDir, `${viewport.name}-action-${destination}.png`), Buffer.from(shot.data, 'base64'));
      }
      if (actual !== destination) failures.push(`Dashboard quick action ${label} opened ${actual}.`);
      await evaluate(() => [...document.querySelectorAll('[aria-label="手机底部导航"] button')].find(el => el.getClientRects().length && el.textContent === '首页').click());
      for (let i = 0; i < 50; i++) {
        if (await evaluate(() => [...document.querySelectorAll('#dashboard-quick-title')].some(el => el.getClientRects().length))) break;
        await wait(100);
      }
    }
  }
  if (metrics.fixture.scenario === 'large') {
    metrics.classSwitch = await evaluate(async () => {
      const select = [...document.querySelectorAll('select')].find(el => el.getClientRects().length && [...el.options].some(o => o.value === 'qa-b'));
      select.value = 'qa-b'; select.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 200));
      const root = [...document.querySelectorAll('[aria-labelledby="dashboard-title"]')].find(el => el.getClientRects().length);
      const result = { selected: select.value, containsClassATask: root.innerText.includes('合成甲班长标题'), emptyDictation: root.innerText.includes('还没有班级听写任务'), emptyDay: root.innerText.includes('今天没有排课或待办'), writes: window.__dashboardFixture.workspaceWrites };
      select.value = 'qa-a'; select.dispatchEvent(new Event('change', { bubbles: true }));
      return result;
    });
    if (metrics.classSwitch.selected !== 'qa-b' || metrics.classSwitch.containsClassATask || !metrics.classSwitch.emptyDictation || !metrics.classSwitch.emptyDay) failures.push('Dashboard class switch leaked state.');
  }
  await evaluate(() => {
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll('[data-mobile-workspace-content], main')) el.scrollTop = 0;
  });
  return metrics;
}
