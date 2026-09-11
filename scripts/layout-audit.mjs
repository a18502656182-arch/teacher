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
const allPages = ["dictation", "dashboard", "students", "attendance", "homework", "points", "rules", "growth", "health", "weekly", "schedule", "tools", "seating", "duty", "cadres", "records", "scores", "reflection", "comments"];
const pages = process.env.QA_PAGES ? process.env.QA_PAGES.split(",").map((value) => value.trim()).filter((value) => allPages.includes(value)) : allPages;
const screenshotDir = process.env.QA_SCREENSHOT_DIR ? path.resolve(process.env.QA_SCREENSHOT_DIR) : "";
const scoreView = process.env.QA_SCORES_VIEW || "";
const openHealthEditor = process.env.QA_HEALTH_OPEN_EDITOR !== "false";
const viewports = [
  { width: 1440, height: 900, name: "desktop" },
  { width: 1280, height: 900, name: "desktop1280" },
  { width: 1057, height: 900, name: "narrowDesktop" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 360, height: 780, name: "smallMobile" },
  { width: 390, height: 844, name: "mobile" },
];

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function runStaticAudit() {
  const failures = [];
  const globals = readFileSync(path.join(root, "app", "globals.css"), "utf8");
  const repair = readFileSync(path.join(root, "app", "workbench-repair.css"), "utf8");
  const layout = readFileSync(path.join(root, "app", "layout.tsx"), "utf8");
  const route = readFileSync(path.join(root, "app", "api", "workspace", "[token]", "route.ts"), "utf8");
  const importantCount = (repair.match(/!important/g) || []).length;

  assert(globals.length < 8000, "globals.css still contains too much page-level legacy CSS.", failures);
  assert(!/weekly2|weekly3|points-workbench|growth-layout|student-score-row|homework-card|====\s*V\d/.test(globals), "globals.css still contains removed legacy selectors or version markers.", failures);
  assert(!/====\s*V\d|V3: workbench|V4|V5|V6|V7/.test(repair), "workbench-repair.css still contains versioned patch markers.", failures);
  assert(importantCount < 20, `workbench-repair.css still relies on too many !important rules (${importantCount}).`, failures);
  assert(/import "\.\/workbench-repair\.css";/.test(layout), "layout.tsx is not loading workbench-repair.css.", failures);
  assert(/\.app-shell\s*\{[^}]*grid-template-columns:\s*236px\s+minmax\(0,\s*1fr\)/i.test(repair), "Missing stable sidebar/content shell grid.", failures);
  assert(/\.app-main\s*\{[^}]*margin-left:\s*0;/i.test(repair), "Missing app-main double-offset reset.", failures);
  assert(/\.page-content\s*\{[^}]*max-width:\s*none;/i.test(repair), "Page content is not full-width in the workbench shell.", failures);
  assert(/\.exam4-table,\s*\.exam4-library-table\s*\{[^}]*display:\s*table;/i.test(repair) && /\.reflection5-score-table\s*\{[^}]*display:\s*table;[^}]*border-collapse:\s*collapse;/i.test(repair), "Score tables are not kept as semantic table layout.", failures);
  assert(/\.pointdesk-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*330px;/i.test(repair), "Points page is missing the final two-column desktop layout.", failures);
  assert(/\.point-pro-page\s*\{[^}]*display:\s*grid;[^}]*gap:\s*14px;/s.test(repair), "Points page is missing the redesign wrapper.", failures);
  assert(/\.point-pro-page \.pointdesk-student-table\s*\{[^}]*border-collapse:\s*collapse;/s.test(repair), "Points page is missing the student table surface.", failures);
  assert(!/growth-bs|growthdesk|growth-bootstrap|growth-first/.test(repair), "Growth page still contains removed legacy growth selectors.", failures);
  assert(/\.growth2-layout\s*\{[^}]*grid-template-columns:\s*340px\s+minmax\(0,\s*1fr\);/i.test(repair), "Growth page is missing the final list/detail layout.", failures);
  assert(/\.rule-pro-page\s*\{[^}]*display:\s*grid;[^}]*gap:\s*14px;/s.test(repair), "Rules page is missing the redesign wrapper.", failures);
  assert(/\.rule-pro-page \.ruledesk-table\s*\{[^}]*overflow-x:\s*auto;/s.test(repair), "Rules page is missing the responsive table-like rules surface.", failures);
  assert(/\.rule-pro-page \.ruledesk-toolbar\s*\{[^}]*display:\s*grid;[^}]*justify-content:\s*start;/s.test(repair), "Rules category toolbar must stay compact instead of spacing title and filters to both edges.", failures);
  assert(/\.rule-pro-page \.ruledesk-toolbar nav\s*\{[^}]*display:\s*inline-flex;[^}]*flex-wrap:\s*nowrap;/s.test(repair), "Rules category filters must use a nowrap segmented-control strip.", failures);
  assert(/\.point-pro-page \.pointdesk-groups\s*\{[^}]*display:\s*inline-flex;[^}]*flex-wrap:\s*nowrap;/s.test(repair), "Points group filters must use a compact nowrap segmented-control strip.", failures);
  assert(/\.point-pro-page \.pointdesk-clear\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s.test(repair), "Points clear action must remain a text action, not an input-like bordered button.", failures);
  assert(!new RegExp("[\\u935A\\u95BE\\u701B\\u7EFE\\u941D\\u4E3F\\u6500\\u5931\\u8F9C\\u6B8F]").test(layout), "Root layout still contains mojibake text.", failures);
  assert(/rowHasMojibake/.test(route), "Demo workspace no longer auto-recovers corrupted demo data.", failures);
  assert(/\.homework-status-segment\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*white-space:\s*nowrap;/s.test(repair), "Homework status options must use a nowrap segmented-control container.", failures);
  assert(/\.homework-status-segment button\s*\{[^}]*min-width:\s*58px;[^}]*white-space:\s*nowrap;/s.test(repair), "Homework status option buttons must reserve stable width and prevent squeezed text.", failures);

  return { name: "static", failures };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findBrowser() {
  return [
    process.env.QA_CHROME,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean).find((candidate) => existsSync(candidate));
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

function cdpSession(wsUrl, onEvent = () => {}) {
  let id = 0;
  const pending = new Map();
  const ws = new WebSocket(wsUrl);
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      onEvent(message);
      return;
    }
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
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
      return new Promise((resolve, reject) => pending.set(current, { resolve, reject }));
    },
    close() {
      ws.close();
    },
  };
}

async function withDevServer(fn) {
  if (!args.has("--serve")) return fn(defaultUrl);
  const port = process.env.QA_PORT || "4180";
  const server = spawn(process.platform === "win32" ? "cmd.exe" : "npm", process.platform === "win32"
    ? ["/d", "/s", "/c", `npm.cmd run dev -- --host 127.0.0.1 --port ${port}`]
    : ["run", "dev", "--", "--host", "127.0.0.1", "--port", port], {
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
    const candidates = [
      new URL("/w/demo", baseUrl).toString(),
      `http://localhost:${port}/w/demo`,
      `http://127.0.0.1:${port}/w/demo`,
    ];
    let url = candidates[0];
    let lastError;
    for (const candidate of [...new Set(candidates)]) {
      try {
        await waitForHttp(candidate, 15000);
        url = candidate;
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return await fn(url);
  } catch (error) {
    throw new Error(`${error.message}\nDev server output:\n${output.slice(-3000)}`);
  } finally {
    if (process.platform === "win32" && server.pid) spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else server.kill("SIGTERM");
  }
}

async function runRuntimeAudit(url) {
  const browserPath = findBrowser();
  if (!browserPath) return [{ name: "runtime", failures: ["Chrome or Edge executable was not found."] }];

  const userDataDir = await mkdtemp(path.join(tmpdir(), "classroom-layout-audit-"));
  if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
  const browserProcess = spawn(browserPath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  try {
    const activePortPath = path.join(userDataDir, "DevToolsActivePort");
    await waitForFile(activePortPath);
    const [port, wsPath] = (await readFile(activePortPath, "utf8")).trim().split(/\r?\n/);
    const browser = cdpSession(`ws://127.0.0.1:${port}${wsPath}`);
    await browser.opened;
    const target = await browser.send("Target.createTarget", { url: "about:blank" });
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    const pageTarget = targets.find((item) => item.id === target.targetId);
    let runtimeErrors = [];
    const page = cdpSession(pageTarget.webSocketDebuggerUrl, (message) => {
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params?.exceptionDetails;
        runtimeErrors.push(details?.exception?.description || details?.text || "Uncaught browser exception");
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
        const text = (message.params.args ?? []).map((argument) => argument.value ?? argument.description ?? argument.type).join(" ");
        runtimeErrors.push(text || "Browser console error");
      }
    });
    await page.opened;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: "try { Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }); } catch {}",
    });

    const results = [];
    for (const viewport of viewports) {
      await page.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width <= 900 });
      for (const pageId of pages) {
        runtimeErrors = [];
        await page.send("Page.navigate", { url: `${url}?page=${pageId}` });
        const pageReadyStarted = Date.now();
        while (Date.now() - pageReadyStarted < 15000) {
          const ready = await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: "Boolean(document.querySelector('.page-content'))",
          });
          if (ready.result.value) break;
          await wait(250);
        }
        if (pageId === "schedule") {
          await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              const buttons = document.querySelectorAll('.schedule-hub-switch button');
              const target = [...buttons].find((button) => button.textContent?.includes('我的日程') && button.getClientRects().length > 0);
              target?.click();
              return Boolean(target);
            })()`,
          });
        }
        if (pageId === "scores" && scoreView) {
          await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              const labels = ${JSON.stringify(scoreView)} === 'analysis' ? ['试卷'] : ${JSON.stringify(scoreView)} === 'trends' ? ['历次趋势'] : [${JSON.stringify(scoreView)}];
              const target = [...document.querySelectorAll('.score5-workspace-tabs button')].find((button) => labels.some((label) => button.textContent?.includes(label)) && button.getClientRects().length > 0);
              target?.click();
              return Boolean(target);
            })()`,
          });
        }
        if (pageId === "health" && openHealthEditor) {
          await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              const target = [...document.querySelectorAll('button')].find((button) => /新增照护|新增登记/.test(button.textContent ?? '') && button.getClientRects().length > 0);
              if (target) {
                const style = getComputedStyle(target);
                const rect = target.getBoundingClientRect();
                window.__healthHeaderAction = target.classList.contains('primary-button') && rect.height >= 36 && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'rgb(255, 255, 255)';
              }
              target?.click();
              return Boolean(target);
            })()`,
          });
          await wait(80);
          await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              const input = document.querySelector('.care-student-picker input');
              window.__healthPickerIdle = Boolean(input) && !document.querySelector('.care-student-options');
              if (!input) return false;
              const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
              setter?.call(input, '林');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            })()`,
          });
        }
        if (pageId === "homework") {
          await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              const isMobile = innerWidth <= 900;
              const target = isMobile
                ? document.querySelector('.mobile-homework-task-list > button')
                : document.querySelector('.homework-ledger-table .homework-row-actions .primary');
              target?.click();
              return { isMobile, opened: Boolean(target) };
            })()`,
          });
          await wait(120);
          if (viewport.width > 900) {
            await page.send("Runtime.evaluate", {
              returnByValue: true,
              expression: `(() => {
                const checkbox = document.querySelector('input[aria-label^="选择"]');
                checkbox?.click();
                const batch = [...document.querySelectorAll('.taskdesk-bulk button')].find((button) => button.textContent?.includes('选中设为待订正'));
                batch?.click();
                return Boolean(checkbox && batch);
              })()`,
            });
            await wait(120);
            await page.send("Runtime.evaluate", {
              returnByValue: true,
              expression: `(() => {
                window.__homeworkSelectionCleared = ![...document.querySelectorAll('input[aria-label^="选择"]')].some((input) => input.checked);
                document.querySelector('input[aria-label^="选择"]')?.click();
                [...document.querySelectorAll('.taskdesk-bulk button')].find((button) => button.textContent?.includes('选中加入待跟进名单'))?.click();
                return window.__homeworkSelectionCleared;
              })()`,
            });
          } else {
            await page.send("Runtime.evaluate", {
              returnByValue: true,
              expression: `(() => {
                const row = document.querySelector('.mobile-homework-edit-row > div[role="button"]');
                row?.click();
                return Boolean(row);
              })()`,
            });
          }
        }
        if (pageId === "attendance") {
          await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              const checkbox = document.querySelector('.attendance-row-select input[type="checkbox"]');
              checkbox?.click();
              const select = document.querySelector('.attendance-batch-bar select');
              if (select) {
                const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
                setter?.call(select, '迟到');
                select.dispatchEvent(new Event('change', { bubbles: true }));
              }
              window.__attendanceBatchBarVisible = Boolean(document.querySelector('.attendance-batch-bar'));
              return Boolean(checkbox && select);
            })()`,
          });
          await wait(80);
          await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              const apply = document.querySelector('.attendance-batch-bar .attendance-primary');
              apply?.click();
              return Boolean(apply);
            })()`,
          });
          await wait(100);
          await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              window.__attendanceSelectionCleared = ![...document.querySelectorAll('.attendance-row-select input[type="checkbox"]')].some((input) => input.checked);
              return window.__attendanceSelectionCleared;
            })()`,
          });
          for (const status of ["迟到", "请假", "缺勤", "正常"]) {
            await page.send("Runtime.evaluate", {
              returnByValue: true,
              expression: `(() => {
                const action = [...document.querySelectorAll('.attendance-status-actions button')].find((button) => button.textContent?.trim() === ${JSON.stringify(status)});
                action?.click();
                return Boolean(action);
              })()`,
            });
            await wait(80);
            await page.send("Runtime.evaluate", {
              returnByValue: true,
              expression: `(() => {
                window.__attendanceStatusActionsHealthy = (window.__attendanceStatusActionsHealthy ?? true) && Boolean(document.querySelector('.attendance-ledger .attendance-roster')) && !document.querySelector('nextjs-portal, [data-nextjs-dialog-overlay]');
                return window.__attendanceStatusActionsHealthy;
              })()`,
            });
          }
          await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              const allNormal = [...document.querySelectorAll('.attendance-primary')].find((button) => button.textContent?.includes('一键全员正常'));
              allNormal?.click();
              return Boolean(allNormal);
            })()`,
          });
          await wait(100);
          await page.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              window.__attendanceAllNormalHealthy = Boolean(document.querySelector('.attendance-ledger .attendance-roster')) && document.querySelectorAll('.attendance-status-actions button.active.normal').length > 0;
              return window.__attendanceAllNormalHealthy;
            })()`,
          });
        }
        await wait(250);
        const { result } = await page.send("Runtime.evaluate", {
          returnByValue: true,
          expression: `(() => {
            const content = document.querySelector('.page-content');
            const shell = document.querySelector('.app-shell');
            const main = document.querySelector('.app-main');
            const rect = (el) => {
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
            };
            return {
              pageId: ${JSON.stringify(pageId)},
              text: document.body.innerText.slice(0, 300),
              teacherAgenda: [...document.querySelectorAll('.teacher-agenda')].some((element) => element.getClientRects().length > 0),
              healthEditor: Boolean(document.querySelector('.health-care-editor')),
              healthStudentSearch: Boolean(document.querySelector('.care-student-picker input') && document.querySelector('.care-student-options')),
              healthStudentPickerIdle: window.__healthPickerIdle === true,
              healthStudentPickerPosition: document.querySelector('.care-student-options') ? getComputedStyle(document.querySelector('.care-student-options')).position : '',
              healthFooterActions: [...document.querySelectorAll('.health-care-editor > footer button')].filter((button) => button.getClientRects().length > 0 && button.textContent?.includes('保存登记')).length > 0,
              healthHeaderAction: window.__healthHeaderAction === true,
              homeworkDetail: Boolean(document.querySelector('.taskdesk-detail, .mobile-bottom-sheet')),
              homeworkFollowModal: Boolean(document.querySelector('.homework-follow-modal')),
              homeworkSelectionCleared: window.__homeworkSelectionCleared === true,
              mobileHomeworkTaskSummary: Boolean(document.querySelector('.mobile-task-sheet-summary')),
              mobileHomeworkSelectionRail: Boolean(document.querySelector('.mobile-homework-selection-rail')),
              mobileHomeworkSelectionVisible: Boolean(document.querySelector('.mobile-homework-edit-row.selected .mobile-homework-selection-mark')),
              attendanceLedger: Boolean(document.querySelector('.attendance-ledger .attendance-roster-controls')),
              attendanceBatchBar: window.__attendanceBatchBarVisible === true,
              attendanceSelectionCleared: window.__attendanceSelectionCleared === true,
              attendanceStatusActionsHealthy: window.__attendanceStatusActionsHealthy === true,
              attendanceAllNormalHealthy: window.__attendanceAllNormalHealthy === true,
              attendanceDetachedEditor: Boolean(document.querySelector('.attendance-editor, .attendance-mobile-editor-backdrop')),
              shell: rect(shell),
              main: rect(main),
              content: rect(content),
              scrollWidth: document.documentElement.scrollWidth,
              viewportWidth: innerWidth,
              cardsInsideCards: [...document.querySelectorAll('section section section')].length,
              inputLikeButtons: [...document.querySelectorAll('button')].filter((button) => {
                const style = getComputedStyle(button);
                return style.backgroundColor === 'rgb(255, 255, 255)' && style.borderStyle !== 'none' && button.textContent.length > 18;
              }).length,
              squeezedButtons: [...document.querySelectorAll('button')].filter((button) => {
                const text = button.textContent.trim();
                return text.length > 1 && button.scrollWidth > button.clientWidth + 1;
              }).map((button) => button.textContent.trim()).slice(0, 8),
              oversizedSegmentButtons: [...document.querySelectorAll('.ruledesk-toolbar nav button, .pointdesk-groups button')].filter((button) => {
                const text = button.textContent.trim();
                const rect = button.getBoundingClientRect();
                return text.length > 0 && (rect.width > Math.max(96, button.scrollWidth + 40) || rect.height > 42);
              }).map((button) => button.textContent.trim()).slice(0, 8),
              pointHeaderActionIssues: [...document.querySelectorAll('.pointdesk-head-actions button')].filter((button) => {
                const style = getComputedStyle(button);
                const rect = button.getBoundingClientRect();
                if (button.classList.contains('pointdesk-clear')) return style.borderStyle !== 'none' || style.backgroundColor !== 'rgba(0, 0, 0, 0)' || rect.height > 42;
                return rect.height > 42 || button.scrollWidth > button.clientWidth + 1;
              }).map((button) => button.textContent.trim()).slice(0, 8),
              crowdedActionCells: [...document.querySelectorAll('td, .taskdesk-table-row')].filter((cell) => {
                if (cell.closest('.homework-student-table')) return false;
                const strongButtons = [...cell.querySelectorAll('button')].filter((button) => {
                  const style = getComputedStyle(button);
                  return style.borderStyle !== 'none' && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
                });
                return strongButtons.length >= 3;
              }).length,
              crampedDialogTextareas: [...document.querySelectorAll('[role="dialog"] textarea')].filter((element) => element.getClientRects().length && element.getBoundingClientRect().height < 99).map((element) => element.getAttribute('aria-label') || element.placeholder || 'unlabelled textarea'),
              clippedSurfaces: [...document.querySelectorAll('.mobile-page [class*="filter"], .mobile-page .mobile-search, .mobile-page .mobile-card-list, .mobile-page .mobile-student-list, .page-content > section')].filter((element) => {
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && (rect.left < -2 || rect.right > innerWidth + 2);
              }).map((element) => element.className).slice(0, 8),
              widestElements: [...document.querySelectorAll('body *')].map((element) => ({ element, rect: element.getBoundingClientRect(), style: getComputedStyle(element) })).filter(({ element, rect, style }) => style.display !== 'none' && rect.width > innerWidth + 10).sort((a, b) => b.rect.width - a.rect.width).slice(0, 5).map(({ element, rect }) => ({ tag: element.tagName, className: element.className, width: Math.round(rect.width) })),
              overflowElements: [...document.querySelectorAll('body *')].filter((element) => { const style = getComputedStyle(element); return style.display !== 'none' && element.scrollWidth > element.clientWidth + 10; }).sort((a, b) => b.scrollWidth - b.clientWidth - (a.scrollWidth - a.clientWidth)).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth })),
            };
          })()`,
        });
        const data = result.value;
        const failures = [];
        if (data?.crampedDialogTextareas?.length) failures.push(`Dialog long-text fields are too short: ${data.crampedDialogTextareas.join(', ')}`);
        if (!data?.content) failures.push("Missing .page-content.");
        if (pageId === "schedule" && !data?.teacherAgenda) failures.push("Schedule module did not render the teacher agenda view.");
        if (pageId === "health" && openHealthEditor && !data?.healthEditor) failures.push("Health care module did not open its registration editor.");
        if (pageId === "health" && openHealthEditor && !data?.healthStudentPickerIdle) failures.push("Health care student picker opens results before the teacher starts searching.");
        if (pageId === "health" && openHealthEditor && !data?.healthStudentSearch) failures.push("Health care registration does not expose the searchable student selector.");
        if (pageId === "health" && openHealthEditor && data?.healthStudentPickerPosition !== "static") failures.push("Health care student results overlay the following form fields.");
        if (pageId === "health" && openHealthEditor && !data?.healthFooterActions) failures.push("Health care registration hides its save action outside the visible editor footer.");
        if (pageId === "health" && !data?.healthHeaderAction) failures.push("Health care header primary action is not rendered as a visible primary button.");
        if (pageId === "homework" && !data?.homeworkDetail) failures.push("Homework detail did not open from its list entry.");
        if (pageId === "homework" && viewport.width > 900 && !data?.homeworkSelectionCleared) failures.push("Homework batch status action did not clear completed row selections.");
        if (pageId === "homework" && viewport.width > 900 && !data?.homeworkFollowModal) failures.push("Homework follow-up list did not open from the detail toolbar.");
        if (pageId === "homework" && viewport.width <= 900 && data?.mobileHomeworkTaskSummary) failures.push("Mobile homework detail still repeats the task summary card.");
        if (pageId === "homework" && viewport.width <= 900 && !data?.mobileHomeworkSelectionRail) failures.push("Mobile homework rows do not expose the visual selection affordance.");
        if (pageId === "homework" && viewport.width <= 900 && !data?.mobileHomeworkSelectionVisible) failures.push("Mobile homework selection does not visibly update after tapping a student row.");
        if (pageId === "attendance" && !data?.attendanceLedger) failures.push("Attendance does not expose the searchable main roster.");
        if (pageId === "attendance" && !data?.attendanceBatchBar) failures.push("Attendance selection does not expose the batch-save controls.");
        if (pageId === "attendance" && !data?.attendanceSelectionCleared) failures.push("Attendance batch save did not clear completed row selections.");
        if (pageId === "attendance" && !data?.attendanceStatusActionsHealthy) failures.push("An attendance status action caused the main roster to disappear or show an error overlay.");
        if (pageId === "attendance" && !data?.attendanceAllNormalHealthy) failures.push("Attendance one-click all-normal did not keep the roster available with normal statuses.");
        if (pageId === "attendance" && data?.attendanceDetachedEditor) failures.push("Attendance still opens a detached editor instead of keeping records in the main roster.");
        if (runtimeErrors.length) failures.push(`Browser runtime error: ${runtimeErrors[0].slice(0, 500)}`);
        if (data?.text && new RegExp("[\\u935A\\u95BE\\u701B\\u7EFE\\u941D\\u4E3F\\u6500\\u5931\\u8F9C\\u6B8F]").test(data.text)) failures.push("Visible text still contains mojibake.");
        if (data && data.scrollWidth - data.viewportWidth > 10) failures.push(`Horizontal page overflow ${Math.round(data.scrollWidth - data.viewportWidth)}px.`);
        if (data?.squeezedButtons?.length) failures.push(`Button text is squeezed or clipped: ${data.squeezedButtons.join(", ")}.`);
        if (data?.oversizedSegmentButtons?.length) failures.push(`Segment filter buttons have abnormal empty space: ${data.oversizedSegmentButtons.join(", ")}.`);
        if (data?.pointHeaderActionIssues?.length) failures.push(`Points header actions are styled or sized incorrectly: ${data.pointHeaderActionIssues.join(", ")}.`);
        if (data?.crowdedActionCells) failures.push(`Table action cells contain too many strong buttons (${data.crowdedActionCells}).`);
        if (data?.clippedSurfaces?.length) failures.push(`Visible surfaces are clipped outside the viewport: ${data.clippedSurfaces.join(", ")}.`);
        if (data?.content && viewport.width >= 1000 && data.viewportWidth - data.content.right > 40) failures.push("Main content leaves an abnormal right gap.");
        if (screenshotDir) {
          const shot = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
          writeFileSync(path.join(screenshotDir, `${viewport.name}-${pageId}.png`), Buffer.from(shot.data, "base64"));
        }
        if (viewport.width >= 1000 && pageId === "seating") {
          const stickyResult = await page.send("Runtime.evaluate", {
            awaitPromise: true,
            returnByValue: true,
            expression: `(async () => {
              const scrollingElement = document.scrollingElement;
              const sideNav = document.querySelector('.side-nav');
              const sideNavMaxScroll = sideNav ? sideNav.scrollHeight - sideNav.clientHeight : 0;
              if (sideNav) sideNav.scrollTop = sideNav.scrollHeight;
              await new Promise((resolve) => setTimeout(resolve, 50));
              const sideNavScrollTop = sideNav?.scrollTop ?? 0;
              scrollingElement?.scrollTo(0, scrollingElement.scrollHeight);
              await new Promise((resolve) => setTimeout(resolve, 100));
              const shell = document.querySelector('.app-shell');
              return {
                scrollY,
                documentHeight: scrollingElement?.scrollHeight ?? 0,
                viewportHeight: innerHeight,
                sideNavMaxScroll,
                sideNavScrollTop,
                shellBackgroundImage: shell ? getComputedStyle(shell).backgroundImage : '',
              };
            })()`,
          });
          const sticky = stickyResult.result.value;
          if (sticky?.sideNavMaxScroll > 4 && sticky.sideNavScrollTop < sticky.sideNavMaxScroll - 4) failures.push("Desktop navigation cannot scroll to its final items.");
          if (!sticky?.shellBackgroundImage || sticky.shellBackgroundImage === "none") failures.push("Desktop shell is missing the continuous sidebar background rail.");
          if (screenshotDir) {
            const scrolledShot = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
            writeFileSync(path.join(screenshotDir, `${viewport.name}-${pageId}-scrolled.png`), Buffer.from(scrolledShot.data, "base64"));
          }
        }
        results.push({ name: `${viewport.name}:${pageId}`, data, failures });
      }
    }

    page.close();
    browser.close();
    return results;
  } catch (error) {
    return [{ name: "runtime", failures: [`Runtime audit failed: ${error.message}`] }];
  } finally {
    browserProcess.kill("SIGTERM");
    try {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch {
      // Windows can keep the browser profile locked briefly after process shutdown.
    }
  }
}

mkdirSync(reportDir, { recursive: true });
const allResults = [runStaticAudit()];
if (!args.has("--static")) allResults.push(...await withDevServer(runRuntimeAudit));
const failures = allResults.flatMap((result) => result.failures.map((failure) => `${result.name}: ${failure}`));
writeFileSync(reportPath, JSON.stringify({ createdAt: new Date().toISOString(), results: allResults, failures }, null, 2));

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`Layout audit report: ${reportPath}`);
  process.exit(1);
}

console.log(`Layout audit passed: ${reportPath}`);
