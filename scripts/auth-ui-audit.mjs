import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const baseUrl = (process.argv[2] || "http://127.0.0.1:3007").replace(/\/$/, "");
const outputDir = process.env.QA_SCREENSHOT_DIR || path.join(tmpdir(), "classroom-auth-ui-audit");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFile(filePath, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (existsSync(filePath)) return;
    await wait(150);
  }
  throw new Error(`Timed out waiting for ${filePath}`);
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

function cdpSession(wsUrl) {
  let id = 0;
  const pending = new Map();
  const ws = new WebSocket(wsUrl);
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
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
    close() { ws.close(); },
  };
}

async function evaluate(page, expression, awaitPromise = false) {
  const response = await page.send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Browser evaluation failed");
  return response.result.value;
}

async function navigate(page, url, selector) {
  await page.send("Page.navigate", { url });
  await waitForSelector(page, selector, url);
}

async function waitForSelector(page, selector, context = "current page") {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (await evaluate(page, `Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await wait(180);
  }
  const visibleText = await evaluate(page, "document.body.innerText.slice(0, 500)");
  throw new Error(`Timed out waiting for ${selector} at ${context}. Visible text: ${visibleText}`);
}

async function screenshot(page, name) {
  const result = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const target = path.join(outputDir, name);
  writeFileSync(target, Buffer.from(result.data, "base64"));
  return target;
}

const browserPath = findBrowser();
if (!browserPath) throw new Error("Chrome or Edge executable was not found.");
mkdirSync(outputDir, { recursive: true });
const userDataDir = await mkdtemp(path.join(tmpdir(), "classroom-auth-ui-browser-"));
const browserProcess = spawn(browserPath, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${userDataDir}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });

try {
  const activePortPath = path.join(userDataDir, "DevToolsActivePort");
  await waitForFile(activePortPath);
  const [port, wsPath] = (await readFile(activePortPath, "utf8")).trim().split(/\r?\n/);
  const browser = cdpSession(`ws://127.0.0.1:${port}${wsPath}`);
  await browser.opened;
  const target = await browser.send("Target.createTarget", { url: "about:blank" });
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const pageTarget = targets.find((item) => item.id === target.targetId);
  const page = cdpSession(pageTarget.webSocketDebuggerUrl);
  await page.opened;
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const nativeFetch = window.fetch.bind(window);
    let adminAuthenticated = false;
    let generatedCodes = [];
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    window.fetch = async (input, init = {}) => {
      const requestUrl = new URL(typeof input === 'string' ? input : input.url, location.origin);
      const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
      if (requestUrl.pathname === '/api/admin/session') {
        if (method === 'POST') { adminAuthenticated = true; return json({ authenticated: true }); }
        if (method === 'DELETE') { adminAuthenticated = false; return json({ ok: true }); }
        return adminAuthenticated ? json({ authenticated: true }) : json({ authenticated: false, error: '管理员会话已过期' }, 401);
      }
      if (requestUrl.pathname === '/api/admin/users') return json({ users: [{ id: 1, phone: '18512346182', status: 'active', class_name: '三年级2班', expires_at: '2027-08-21', workspaceMode: 'active', active_devices: 2 }] });
      if (requestUrl.pathname === '/api/admin/redeem-codes' && method === 'POST') {
        const payload = JSON.parse(init.body || '{}');
        const quantity = Math.min(50, Math.max(1, Number(payload.quantity) || 1));
        const length = Math.min(8, Math.max(6, Number(payload.codeLength) || 8));
        generatedCodes = Array.from({ length: quantity }, (_, index) => ('K7M9Q2' + String(index + 1) + 'X').slice(0, length));
        return json({ codes: generatedCodes });
      }
      if (requestUrl.pathname === '/api/admin/redeem-codes') return json({ codes: [{ id: 1, code: 'A8T4Q7M2', code_hint: 'Q7M2', phone: '18512346182', status: 'used', max_devices: 2, expires_at: Date.now() + 86400000, workspace_expires_at: '2027-08-21' }, ...generatedCodes.map((code, index) => ({ id: index + 2, code, code_hint: code.slice(-4), phone: '', status: 'active', max_devices: 2, expires_at: Date.now() + 86400000 }))] });
      if (requestUrl.pathname.startsWith('/api/admin/users/')) return json({ devices: [] });
      if (requestUrl.pathname === '/api/auth/enter') return json({ workspace: { path: '/w/visual' } });
      if (requestUrl.pathname === '/api/auth/me') return json({ user: { phone: '18512346182' }, workspace: { expiresAt: '2027-08-21' } });
      if (requestUrl.pathname === '/api/workspace/visual' && method === 'PUT') return json({ ok: true });
      if (requestUrl.pathname === '/api/workspace/visual') {
        const response = await nativeFetch('/api/workspace/demo');
        const body = await response.json();
        body.workspace.accessMode = 'active';
        return json(body);
      }
      return nativeFetch(input, init);
    };
  })();` });
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await navigate(page, `${baseUrl}/admin`, ".admin-login");
  await evaluate(page, `(() => { const input = document.querySelector('#admin-password'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'aaaa2222'); input.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.admin-login button[type="submit"]').click(); })()`);
  await waitForSelector(page, ".admin-page", "admin login");
  await evaluate(page, `(() => { const input = document.querySelector('.admin-code-maker input[type="number"]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '4'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await wait(80);
  await evaluate(page, `document.querySelector('.admin-code-maker > button').click()`);
  const started = Date.now();
  while (Date.now() - started < 10000 && !(await evaluate(page, `Boolean(document.querySelector('.admin-issued-codes code'))`))) await wait(180);
  const code = await evaluate(page, `document.querySelector('.admin-issued-codes code')?.textContent.trim()`);
  if (!code || code.length < 6 || code.length > 8) throw new Error("A 6-8 character redeem code was not rendered.");
  const adminScreenshot = await screenshot(page, "admin-desktop.png");

  const entry = await evaluate(page, `(async () => { const response = await fetch('/api/auth/enter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: ${JSON.stringify(code)}, phone: '18512346182' }) }); return { ok: response.ok, body: await response.json() }; })()`, true);
  if (!entry.ok) throw new Error(entry.body?.error || "Test user creation failed.");

  const workspaceBase = `${baseUrl}${entry.body.workspace.path}`;
  const desktopPages = [];
  for (const pageId of ["records", "homework", "growth"]) {
    await navigate(page, `${workspaceBase}?page=${pageId}`, ".app-shell");
    await wait(220);
    const shellState = await evaluate(page, `({ hasTopbar: Boolean(document.querySelector('.topbar')), pageHeadings: document.querySelectorAll('.page-content h2').length, scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth })`);
    if (shellState.hasTopbar) throw new Error(`${pageId} still renders the duplicate desktop topbar.`);
    if (shellState.scrollWidth > shellState.viewportWidth + 2) throw new Error(`${pageId} has desktop horizontal overflow.`);
    desktopPages.push(await screenshot(page, `workbench-${pageId}-desktop.png`));
  }

  const workspaceUrl = `${workspaceBase}?page=students`;
  await navigate(page, workspaceUrl, ".app-shell");
  await evaluate(page, `document.querySelector('.sidebar-account-entry').click()`);
  const accountReady = Date.now();
  while (Date.now() - accountReady < 10000 && !(await evaluate(page, `Boolean(document.querySelector('.account-dialog'))`))) await wait(180);
  const desktopScreenshot = await screenshot(page, "workbench-account-desktop.png");

  await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(page, workspaceUrl, ".mobile-workbench");
  await evaluate(page, `[...document.querySelectorAll('.mobile-tabbar button')].find((button) => button.textContent.trim() === '更多').click()`);
  await wait(120);
  await evaluate(page, `[...document.querySelectorAll('.mobile-account-actions button')].find((button) => button.textContent.includes('我的工作台')).click()`);
  const mobileReady = Date.now();
  while (Date.now() - mobileReady < 10000 && !(await evaluate(page, `Boolean(document.querySelector('.mobile-account-brief'))`))) await wait(180);
  const mobileScreenshot = await screenshot(page, "workbench-account-mobile.png");

  const result = await evaluate(page, `({ scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, text: document.body.innerText })`);
  const failures = [];
  if (result.scrollWidth > result.viewportWidth + 2) failures.push(`Mobile horizontal overflow: ${result.scrollWidth - result.viewportWidth}px`);
  if (!result.text.includes("18512346182")) failures.push("Full phone number is not visible in the mobile account sheet.");
  if (result.text.includes("当前浏览器") || result.text.includes("退出并解绑") || result.text.includes("AI 编写")) failures.push("Removed account details are still visible.");
  writeFileSync(path.join(outputDir, "report.json"), JSON.stringify({ failures, screenshots: [adminScreenshot, ...desktopPages, desktopScreenshot, mobileScreenshot] }, null, 2));
  page.close();
  browser.close();
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(`Auth UI audit passed: ${outputDir}`);
} finally {
  browserProcess.kill("SIGTERM");
  await wait(250);
  rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}
