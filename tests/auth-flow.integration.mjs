import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = 4191;
const base = `http://127.0.0.1:${port}`;

function cookiesFrom(response, jar) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const first = value.split(";", 1)[0];
    const index = first.indexOf("=");
    if (index < 0) continue;
    const name = first.slice(0, index);
    const cookieValue = first.slice(index + 1);
    if (cookieValue) jar.set(name, cookieValue); else jar.delete(name);
  }
}

function cookieHeader(jar, names) {
  return [...jar.entries()].filter(([name]) => !names || names.includes(name)).map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(url, { jar, method = "GET", body, userAgent = "Integration Test", cookieNames } = {}) {
  const headers = { "user-agent": userAgent };
  if (method !== "GET") {
    headers.origin = base;
    headers["content-type"] = "application/json";
  }
  if (jar?.size) headers.cookie = cookieHeader(jar, cookieNames);
  const response = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (jar) cookiesFrom(response, jar);
  return { response, json: await response.json().catch(() => ({})) };
}

async function waitForServer(output) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base + "/");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`本地测试服务启动超时\n${output.value.slice(-3000)}`);
}

async function run() {
  const temp = await mkdtemp(path.join(tmpdir(), "classroom-auth-test-"));
  const databasePath = path.join(temp, "classroom.db");
  const output = { value: "" };
  const command = process.execPath;
  const args = [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "-H", "127.0.0.1", "-p", String(port)];
  const server = spawn(command, args, {
    cwd: root,
    env: {
      ...process.env,
      CLASSROOM_DB_PATH: databasePath,
      AUTH_ENFORCEMENT_ENABLED: "true",
      AUTH_ALLOW_INSECURE_HTTP: "true",
      AUTH_SESSION_SECRET: "integration-session-secret-1234567890",
      REDEEM_CODE_SECRET: "integration-redeem-secret-1234567890",
      ADMIN_KEY: "aaaa2222",
      ADMIN_ALLOWED_IPS: "*",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => { output.value += chunk; });
  server.stderr.on("data", (chunk) => { output.value += chunk; });

  try {
    await waitForServer(output);
    const admin = new Map();
    let result = await request("/api/admin/session", { jar: admin, method: "POST", body: { password: "aaaa2222" } });
    assert.equal(result.response.status, 200, JSON.stringify(result.json));
    result = await request("/api/admin/redeem-codes", { jar: admin, method: "POST", body: { quantity: 3, codeLength: 8, maxDevices: 2, validDays: 30 } });
    assert.equal(result.response.status, 201, JSON.stringify(result.json));
    const [codeA, codeB, expiredCode] = result.json.codes;

    result = await request("/api/auth/enter", { jar: new Map(), method: "POST", body: { redeemCode: "short", phone: "123" } });
    assert.equal(result.response.status, 400);
    assert.equal(result.json.code, "INVALID_INPUT");
    assert.equal(result.json.error, "请填写有效的兑换码和手机号");

    const directDatabase = new DatabaseSync(databasePath);
    directDatabase.prepare("UPDATE redeem_codes SET expires_at = ? WHERE code_hint = ?").run(Date.now() - 1_000, expiredCode.slice(-4));
    directDatabase.close();
    result = await request("/api/auth/enter", { jar: new Map(), method: "POST", body: { redeemCode: expiredCode, phone: "13700000003" } });
    assert.equal(result.response.status, 401);
    assert.equal(result.json.code, "INVALID_REDEEM");
    assert.equal(result.json.error, "兑换码或手机号不正确", "过期码不得泄露自身存在或过期状态");

    const deviceA = new Map();
    result = await request("/api/auth/enter", { jar: deviceA, method: "POST", body: { redeemCode: codeA, phone: "13800000001" }, userAgent: "Windows Chrome A" });
    assert.equal(result.response.status, 201, JSON.stringify(result.json));
    const tokenA = result.json.workspace.token;
    assert.ok(deviceA.has("classroom_session") && deviceA.has("classroom_device"));

    const deviceB = new Map();
    result = await request("/api/auth/enter", { jar: deviceB, method: "POST", body: { redeemCode: codeA, phone: "13800000001" }, userAgent: "Android Chrome B" });
    assert.equal(result.response.status, 201, JSON.stringify(result.json));

    const deviceC = new Map();
    result = await request("/api/auth/enter", { jar: deviceC, method: "POST", body: { redeemCode: codeA, phone: "13800000001" }, userAgent: "iPad Safari C" });
    assert.equal(result.response.status, 409);
    assert.equal(result.json.code, "DEVICE_LIMIT");

    result = await request("/api/admin/users?q=13800000001&page=1", { jar: admin });
    const userA = result.json.users[0];
    assert.ok(userA?.id);
    result = await request(`/api/admin/users/${userA.id}`, { jar: admin, method: "PATCH", body: { status: "disabled" } });
    assert.equal(result.response.status, 200);

    const disabledJar = new Map(deviceA);
    result = await request("/api/auth/me", { jar: disabledJar });
    assert.equal(result.response.status, 401);
    assert.ok(disabledJar.has("classroom_device"), "禁用后应保留设备令牌以便管理员恢复账户");

    result = await request(`/api/admin/users/${userA.id}`, { jar: admin, method: "PATCH", body: { status: "active" } });
    assert.equal(result.response.status, 200);
    const restoredJar = new Map([["classroom_device", disabledJar.get("classroom_device")]]);
    result = await request("/api/auth/me", { jar: restoredJar });
    assert.equal(result.response.status, 200, JSON.stringify(result.json));
    assert.ok(restoredJar.has("classroom_session"));
    result = await request("/api/auth/enter", { jar: deviceB, method: "POST", body: { redeemCode: codeA, phone: "13800000001" }, userAgent: "Android Chrome B" });
    assert.equal(result.response.status, 201, JSON.stringify(result.json));

    const userBJar = new Map();
    result = await request("/api/auth/enter", { jar: userBJar, method: "POST", body: { redeemCode: codeB, phone: "13900000002" }, userAgent: "Windows Edge D" });
    assert.equal(result.response.status, 201, JSON.stringify(result.json));
    const tokenB = result.json.workspace.token;
    result = await request(`/api/workspace/${tokenB}`, { jar: userBJar });
    assert.equal(result.response.status, 200, JSON.stringify(result.json));
    assert.equal(result.json.workspace.data.students.length, 0, "正式新工作台不得带入演示学生");
    assert.equal(result.json.workspace.data.records.length, 0, "正式新工作台不得带入演示沟通记录");
    result = await request(`/api/workspace/${tokenB}`, { jar: restoredJar });
    assert.equal(result.response.status, 404, "用户 A 不得读取用户 B 的工作台");

    result = await request(`/api/workspace/${tokenA}`, { jar: restoredJar });
    assert.equal(result.response.status, 200, JSON.stringify(result.json));
    const revision = result.json.workspace.revision;
    const data = result.json.workspace.data;
    data.dictation = {
      version: 1,
      children: [{ id: "test-child-a", name: "合成孩子甲", grade: "三年级" }, { id: "test-child-b", name: "合成孩子乙", grade: "一年级" }],
      books: [],
      tasks: [{ id: "test-dictation", title: "隔离听写测试", date: "2026-09-11", subject: "英语", context: { kind: "family", childId: "test-child-a" }, participants: [{ id: "test-child-a", name: "合成孩子甲", number: "" }], words: [{ id: "test-word", text: "school", meaning: "学校", lesson: "第一组" }], results: {}, createdAt: "2026-09-11T00:00:00Z" }],
    };
    const malformed = structuredClone(data);
    malformed.dictation.tasks[0].participants[0].id = "test-child-b";
    result = await request(`/api/workspace/${tokenA}`, { jar: restoredJar, method: "PUT", body: { data: malformed, revision } });
    assert.equal(result.response.status, 400, "家庭任务不得混入另一个孩子");
    result = await request(`/api/workspace/${tokenA}`, { jar: userBJar, method: "PUT", body: { data, revision } });
    assert.equal(result.response.status, 404, "另一账户不得写入听写记录");
    data.students = data.students.map((student, index) => index === 0 ? { ...student, note: "并发保存测试" } : student);
    const [saveA, saveB] = await Promise.all([
      request(`/api/workspace/${tokenA}`, { jar: restoredJar, method: "PUT", body: { data, revision } }),
      request(`/api/workspace/${tokenA}`, { jar: deviceB, method: "PUT", body: { data, revision } }),
    ]);
    assert.deepEqual([saveA.response.status, saveB.response.status].sort((a, b) => a - b), [200, 409]);
    result = await request(`/api/workspace/${tokenA}`, { jar: restoredJar });
    assert.equal(result.json.workspace.data.dictation.tasks.length, 1);
    assert.deepEqual(result.json.workspace.data.dictation.tasks[0].results, {}, "未批改不产生全对结果");
    assert.equal((saveA.response.status === 409 ? saveA : saveB).json.code, "WORKSPACE_CONFLICT");

    result = await request("/api/auth/logout", { jar: userBJar, method: "POST" });
    assert.equal(result.response.status, 200, JSON.stringify(result.json));
    assert.equal(userBJar.has("classroom_session"), false, "退出后应清除当前会话");
    assert.equal(userBJar.has("classroom_device"), false, "退出后应清除当前设备令牌");
    result = await request("/api/auth/me", { jar: userBJar });
    assert.equal(result.response.status, 401, "退出后的当前设备不得继续访问账户");
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.stack : error}\nServer output:\n${output.value.slice(-5000)}`);
  } finally {
    if (process.platform === "win32" && server.pid) spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else server.kill("SIGTERM");
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try { await rm(temp, { recursive: true, force: true }); break; }
      catch (cleanupError) {
        if (attempt === 9) throw cleanupError;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }
}

await run();
console.log("auth integration: passed");
