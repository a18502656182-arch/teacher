import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const reportDir = process.env.QA_REPORT_DIR || path.join(tmpdir(), "classroom-layout-audit");
const reportPath = path.join(reportDir, "layout-audit.json");
const defaultUrl = process.env.QA_URL || "http://127.0.0.1:4180/w/demo";
const viewports = [
  { width: 1673, height: 920, name: "desktop-wide" },
  { width: 1366, height: 768, name: "desktop-compact" },
  { width: 390, height: 844, name: "mobile" },
];
const pages = ["工作台", "学生名单", "作业登记", "积分评价", "积分规则", "成长档案", "周报系统", "课程表", "座位表", "值日岗位", "班干部", "家校沟通", "成绩分析", "考试反思", "期末评语"];

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function runStaticAudit() {
  const failures = [];
  const cssPath = path.join(root, "app", "globals.css");
  const css = readFileSync(cssPath, "utf8");
  assert(/\.page-content\{[^}]*max-width:none!important/i.test(css), "Missing final .page-content max-width:none override.", failures);
  assert(/\.app-main\{[^}]*width:calc\(100vw - 240px\)!important/i.test(css), "Missing desktop .app-main full-width calculation.", failures);
  assert(/\.page-content>\*\{[^}]*max-width:none!important/i.test(css), "Missing direct-child max-width reset for app pages.", failures);
  assert(/\.weekly2-page,.seating-wrap,.seat-instruction,.rule-form\{[^}]*max-width:none!important/i.test(css), "Known page-level max-width containers are not reset.", failures);
  assert(/@media\(max-width:1240px\)\{[^}]*\.points-workbench\{grid-template-columns:1fr!important/i.test(css), "Points page does not collapse before it can overlap.", failures);
  assert(/\.points-filter-bar \.resource-search,\.points-filter-bar select,\.points-filter-bar button\{[^}]*height:56px!important/i.test(css), "Points filter controls are not locked to a shared visual height.", failures);
  assert(/\.student-score-head,\.student-score-row\{[^}]*grid-template-columns:72px minmax\(180px,1fr\) 86px 88px 96px!important/i.test(css), "Points score table columns are not using the audited alignment grid.", failures);
  assert(/\.growth-layout\{[^}]*grid-template-columns:320px minmax\(0,1fr\)!important/i.test(css), "Growth page student panel is not wide enough for dense filtering.", failures);
  assert(/\.growth-timeline\.spec \.growth-record\{[^}]*grid-template-columns:96px minmax\(0,1fr\)!important/i.test(css), "Growth timeline records are not locked to the audited two-column layout.", failures);
  return { name: "static-css", failures };
}

function findChrome() {
  const candidates = [
    process.env.QA_CHROME,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function waitForHttp(url, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await wait(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForFile(filePath, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (existsSync(filePath)) return;
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function withDevServer(fn) {
  if (!args.has("--serve")) return fn(defaultUrl);
  const port = process.env.QA_PORT || "4180";
  const serverCommand = process.platform === "win32" ? "cmd.exe" : "npm";
  const serverArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm.cmd run dev -- --host 127.0.0.1 --port ${port}`]
    : ["run", "dev", "--", "--host", "127.0.0.1", "--port", port];
  const server = spawn(serverCommand, serverArgs, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", (chunk) => { output += chunk.toString(); });
  server.stderr.on("data", (chunk) => { output += chunk.toString(); });
  try {
    const started = Date.now();
    let baseUrl = `http://127.0.0.1:${port}/`;
    while (Date.now() - started < 45000) {
      const match = output.match(/Local:\s+(http:\/\/(?:localhost|127\.0\.0\.1):\d+\/)/);
      if (match) {
        baseUrl = match[1];
        break;
      }
      await wait(250);
    }
    const url = new URL("/w/demo", baseUrl).toString();
    try {
      await waitForHttp(url);
    } catch (error) {
      throw new Error(`${error.message}\nDev server output:\n${output.slice(-4000)}`);
    }
    return await withTimeout(fn(url), Number(process.env.QA_RUNTIME_TIMEOUT_MS || 120000), "Runtime layout audit");
  } finally {
    if (process.platform === "win32" && server.pid) {
      spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
      await wait(500);
      if (!server.killed) server.kill("SIGKILL");
    }
    if (process.env.QA_DEBUG_SERVER) writeFileSync(path.join(reportDir, "layout-audit-server.log"), output);
  }
}

function cdpSession(wsUrl) {
  let id = 0;
  const pending = new Map();
  const ws = new WebSocket(wsUrl);
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return {
    opened,
    send(method, params = {}) {
      const current = ++id;
      ws.send(JSON.stringify({ id: current, method, params }));
      return withTimeout(new Promise((resolve, reject) => pending.set(current, { resolve, reject })), Number(process.env.QA_CDP_TIMEOUT_MS || 30000), `CDP ${method}`);
    },
    close() {
      ws.close();
    },
  };
}

async function runRuntimeAudit(url) {
  const chrome = findChrome();
  if (!chrome) return [{ name: "runtime", failures: ["Chrome or Edge executable was not found."] }];

  const userDataDir = await mkdtemp(path.join(tmpdir(), "classroom-layout-audit-"));
  const chromeProcess = spawn(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-gpu-sandbox",
    "--disable-gpu-compositing",
    "--disable-gpu-rasterization",
    "--disable-accelerated-2d-canvas",
    "--disable-webgl",
    "--disable-features=VizDisplayCompositor,UseSkiaRenderer,CalculateNativeWinOcclusion",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let stderr = "";
  chromeProcess.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  try {
    const activePortPath = path.join(userDataDir, "DevToolsActivePort");
    await waitForFile(activePortPath);
    const [port, wsPath] = (await readFile(activePortPath, "utf8")).trim().split(/\r?\n/);
    const browserWsUrl = `ws://127.0.0.1:${port}${wsPath}`;
    const browser = cdpSession(browserWsUrl);
    await browser.opened;
    const target = await browser.send("Target.createTarget", { url: "about:blank" });
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    const pageTarget = targets.find((item) => item.id === target.targetId);
    const page = cdpSession(pageTarget.webSocketDebuggerUrl);
    await page.opened;
    await page.send("Page.enable");
    await page.send("Runtime.enable");

    async function waitForAppShell(timeoutMs = 20000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const { result } = await page.send("Runtime.evaluate", {
          returnByValue: true,
          expression: "Boolean(document.querySelector('.page-content'))",
        });
        if (result.value) return true;
        await wait(500);
      }
      return false;
    }

    const results = [];
    for (const viewport of viewports) {
      await page.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 700 });
      await page.send("Page.navigate", { url });
      await waitForAppShell();
      for (const label of pages) {
        await page.send("Runtime.evaluate", {
          expression: `(() => { const item = [...document.querySelectorAll('button')].find((button) => button.textContent.includes(${JSON.stringify(label)})); if (item) item.click(); })()`,
          awaitPromise: true,
        });
        await wait(450);
        const { result } = await page.send("Runtime.evaluate", {
          returnByValue: true,
          awaitPromise: true,
          expression: `(() => {
            const body = document.body || document.documentElement;
            const box = (selector) => {
              const el = document.querySelector(selector);
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
            };
            const boxes = (selector) => [...document.querySelectorAll(selector)].filter((el) => {
              const style = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              return style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0;
            }).map((el) => {
              const r = el.getBoundingClientRect();
              return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
            });
            const spread = (items, key) => {
              const values = items.map((item) => item[key]).filter((value) => Number.isFinite(value));
              if (values.length < 2) return 0;
              return Math.max(...values) - Math.min(...values);
            };
            const centerX = (item) => item ? item.left + item.width / 2 : 0;
            const overlap = (a, b) => {
              const ra = box(a), rb = box(b);
              if (!ra || !rb) return false;
              return !(ra.right <= rb.left || rb.right <= ra.left || ra.bottom <= rb.top || rb.bottom <= ra.top);
            };
            const pointsFilterItems = boxes('.points-filter-bar > *');
            const statCards = boxes('.stat-row > *');
            const firstStatRow = statCards.length ? statCards.filter((item) => Math.abs(item.top - statCards[0].top) < 8) : [];
            const headCheckbox = box('.student-score-head input');
            const firstRowCheckbox = box('.student-score-row input');
            const filterBar = box('.points-filter-bar');
            const groupStrip = box('.points-group-strip');
            const scoreTable = box('.student-score-table');
            const growthControlItems = boxes('.growth-list-controls select');
            const growthDateBoxes = boxes('.growth-timeline.spec .growth-record-date');
            const growthTitleBoxes = boxes('.growth-timeline.spec .growth-record-title');
            const growthTagBoxes = boxes('.growth-timeline.spec .growth-record-tags span');
            const firstGrowthDate = growthDateBoxes[0];
            const firstGrowthTitle = growthTitleBoxes[0];
            return {
              label: ${JSON.stringify(label)},
              readyState: document.readyState,
              viewport: { width: innerWidth, height: innerHeight },
              scrollWidth: document.documentElement.scrollWidth,
              bodyWidth: body ? body.scrollWidth : 0,
              pageContent: box('.page-content'),
              appMain: box('.app-main'),
              pointsFilterActionOverlap: overlap('.points-filter-bar', '.points-action-panel'),
              pointsWorkbench: box('.points-workbench'),
              pointsAesthetic: {
                filterHeightSpread: spread(pointsFilterItems, 'height'),
                filterTopSpread: spread(pointsFilterItems, 'top'),
                filterToGroupGap: filterBar && groupStrip ? groupStrip.top - filterBar.bottom : null,
                groupToTableGap: groupStrip && scoreTable ? scoreTable.top - groupStrip.bottom : null,
                selectColumnWidth: box('.student-score-head label')?.width ?? null,
                checkboxCenterDelta: headCheckbox && firstRowCheckbox ? Math.abs(centerX(headCheckbox) - centerX(firstRowCheckbox)) : null,
                firstStatRowHeightSpread: spread(firstStatRow, 'height'),
              },
              growthAesthetic: {
                panel: box('.growth-student-panel'),
                listControlsCount: growthControlItems.length,
                listControlHeightSpread: spread(growthControlItems, 'height'),
                listControlTopSpread: spread(growthControlItems.slice(0, 2), 'top'),
                timeline: box('.growth-timeline.spec'),
                firstDateAspect: firstGrowthDate ? firstGrowthDate.height / Math.max(1, firstGrowthDate.width) : null,
                firstDateWidth: firstGrowthDate?.width ?? null,
                firstDateTitleOverlap: firstGrowthDate && firstGrowthTitle ? !(firstGrowthDate.right <= firstGrowthTitle.left || firstGrowthTitle.right <= firstGrowthDate.left || firstGrowthDate.bottom <= firstGrowthTitle.top || firstGrowthTitle.bottom <= firstGrowthDate.top) : false,
                maxTagHeight: growthTagBoxes.length ? Math.max(...growthTagBoxes.map((item) => item.height)) : null,
              },
              visibleText: document.body.innerText.slice(0, 200),
            };
          })()`,
        });
        const data = result.value;
        const failures = [];
        if (!data) {
          results.push({ name: `${viewport.name}:${label}`, data: null, failures: ["Runtime evaluation returned no layout data."] });
          continue;
        }
        const scrollOverflow = Math.max(data.scrollWidth, data.bodyWidth) - data.viewport.width;
        if (scrollOverflow > 8) failures.push(`Horizontal overflow ${scrollOverflow}px.`);
        if (data.pageContent) {
          const rightGap = data.viewport.width - data.pageContent.right;
          if (viewport.width >= 1000 && rightGap > 36) failures.push(`Right gap ${Math.round(rightGap)}px is too large.`);
        } else {
          failures.push("Missing .page-content.");
        }
        if (data.pointsWorkbench && data.pointsFilterActionOverlap) failures.push("Points filter controls overlap the action panel.");
        if (data.pointsWorkbench && data.pointsAesthetic && viewport.width >= 1000) {
          const aesthetic = data.pointsAesthetic;
          if (aesthetic.filterHeightSpread > 2) failures.push(`Points filter controls have uneven heights (${Math.round(aesthetic.filterHeightSpread)}px spread).`);
          if (aesthetic.filterTopSpread > 2) failures.push(`Points filter controls are not top-aligned (${Math.round(aesthetic.filterTopSpread)}px spread).`);
          if (aesthetic.filterToGroupGap !== null && (aesthetic.filterToGroupGap < 8 || aesthetic.filterToGroupGap > 16)) failures.push(`Points filter-to-group spacing is irregular (${Math.round(aesthetic.filterToGroupGap)}px).`);
          if (aesthetic.groupToTableGap !== null && (aesthetic.groupToTableGap < 8 || aesthetic.groupToTableGap > 18)) failures.push(`Points group-to-table spacing is irregular (${Math.round(aesthetic.groupToTableGap)}px).`);
          if (aesthetic.selectColumnWidth !== null && aesthetic.selectColumnWidth > 76) failures.push(`Points select-all column is too wide (${Math.round(aesthetic.selectColumnWidth)}px).`);
          if (aesthetic.checkboxCenterDelta !== null && aesthetic.checkboxCenterDelta > 4) failures.push(`Points header checkbox is not aligned with row checkboxes (${Math.round(aesthetic.checkboxCenterDelta)}px).`);
          if (aesthetic.firstStatRowHeightSpread > 6) failures.push(`Summary cards in the first row have uneven heights (${Math.round(aesthetic.firstStatRowHeightSpread)}px spread).`);
        }
        if (data.growthAesthetic?.timeline && viewport.width >= 1000) {
          const aesthetic = data.growthAesthetic;
          if (!aesthetic.panel || aesthetic.panel.width < 292) failures.push(`Growth student panel is too narrow (${Math.round(aesthetic.panel?.width ?? 0)}px).`);
          if (aesthetic.listControlsCount < 4) failures.push("Growth student panel is missing dense filter controls.");
          if (aesthetic.listControlHeightSpread > 2) failures.push(`Growth list filters have uneven heights (${Math.round(aesthetic.listControlHeightSpread)}px spread).`);
          if (aesthetic.listControlTopSpread > 2) failures.push(`Growth list filters are not aligned (${Math.round(aesthetic.listControlTopSpread)}px spread).`);
          if (aesthetic.firstDateWidth !== null && aesthetic.firstDateWidth < 70) failures.push(`Growth timeline date column is too narrow (${Math.round(aesthetic.firstDateWidth)}px).`);
          if (aesthetic.firstDateAspect !== null && aesthetic.firstDateAspect > 1.2) failures.push(`Growth timeline date is wrapping vertically (${aesthetic.firstDateAspect.toFixed(2)} aspect).`);
          if (aesthetic.firstDateTitleOverlap) failures.push("Growth timeline date overlaps the record title.");
          if (aesthetic.maxTagHeight !== null && aesthetic.maxTagHeight > 30) failures.push(`Growth timeline tags are too tall (${Math.round(aesthetic.maxTagHeight)}px).`);
        }
        results.push({ name: `${viewport.name}:${label}`, data, failures });
      }
    }
    page.close();
    browser.close();
    return results;
  } catch (error) {
    return [{ name: "runtime-browser", failures: [`Browser layout audit failed: ${error.message}`, stderr.slice(-2000)] }];
  } finally {
    chromeProcess.kill("SIGTERM");
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

mkdirSync(reportDir, { recursive: true });
const allResults = [runStaticAudit()];
if (!args.has("--static")) {
  allResults.push(...await withDevServer(runRuntimeAudit));
}
const failures = allResults.flatMap((result) => result.failures.map((failure) => `${result.name}: ${failure}`));
writeFileSync(reportPath, JSON.stringify({ createdAt: new Date().toISOString(), results: allResults, failures }, null, 2));
if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`Layout audit report: ${reportPath}`);
  process.exit(1);
}
console.log(`Layout audit passed: ${reportPath}`);
