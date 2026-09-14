import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import './visual-design-workflow.test.mjs';
import { auditVisualBaseline, matchesTrigger } from "../scripts/visual-baseline-audit.mjs";

const sourceRoot = process.cwd();

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function writeJson(root, ledger) {
  mkdirSync(path.join(root, "trackers"), { recursive: true });
  writeFileSync(path.join(root, "trackers", "visual-baseline.json"), `${JSON.stringify(ledger, null, 2)}\n`);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex").toUpperCase();
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "visual-baseline-audit-"));
  const ledger = JSON.parse(readFileSync(path.join(sourceRoot, "trackers", "visual-baseline.json"), "utf8"));
  ledger.schemaVersion = 2; // Preserve the historical schema-2 contract tests.
  for (const page of Object.values(ledger.pages)) {
    page.status = "not-reviewed";
    page.currentEvidence = [];
    page.comparisons = [];
    delete page.productCommit;
    delete page.supervision;
  }
  for (const gate of ledger.gates) {
    gate.status = "blocked";
    gate.userApproval = { approved: false, approvedAt: null, commit: null };
  }
  ledger.gates[0].status = "active";
  for (const reference of Object.values(ledger.references)) {
    for (const relative of [reference.committedCopy, reference.sourceOriginal]) {
      mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      cpSync(path.join(sourceRoot, relative), path.join(root, relative));
    }
  }
  mkdirSync(path.join(root, "app", "components", "workbench"), { recursive: true });
  writeFileSync(path.join(root, "app", "components", "workbench", "fixture.css"), ".fixture{}\n");
  writeJson(root, ledger);
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "visual-gate@example.invalid"]);
  git(root, ["config", "user.name", "Visual Gate Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixture"]);
  return { root, ledger, productCommit: git(root, ["rev-parse", "HEAD"]) };
}

function evidence(root, productCommit, kind, directory, referenceId) {
  const content = Buffer.from(`${directory}-${kind}-${referenceId ?? "current"}`);
  const relative = `${directory}/${kind}.png`;
  mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  writeFileSync(path.join(root, relative), content);
  return {
    kind,
    path: relative.replaceAll("\\", "/"),
    viewport: kind === "desktop" ? "1536x1024" : "390x844",
    sha256: sha256(content),
    url: "http://127.0.0.1:4180/w/demo?page=dashboard",
    capturedAt: "2026-09-14T12:00:00+08:00",
    productCommit,
    ...(referenceId ? { referenceId } : {}),
  };
}

function makeDashboardReady(state, supervisionStatus = "pending") {
  const { root, ledger, productCommit } = state;
  const page = ledger.pages.dashboard;
  page.status = "ready-for-review";
  page.productCommit = productCommit;
  page.currentEvidence = [
    evidence(root, productCommit, "desktop", "docs/visual-baseline/current"),
    evidence(root, productCommit, "mobile", "docs/visual-baseline/current"),
  ];
  page.comparisons = [
    evidence(root, productCommit, "desktop", "docs/visual-baseline/comparisons", "C1"),
    evidence(root, productCommit, "mobile", "docs/visual-baseline/comparisons", "C5"),
  ];
  page.supervision = { status: supervisionStatus, checkpointId: "V1-dashboard-fixture", reviewedProductCommit: supervisionStatus === "PASS" ? productCommit : null, report: null };
  writeJson(root, ledger);
  return page;
}

test("extensionless trigger matches actual theme and primitive files", () => {
  assert.equal(matchesTrigger("app/components/campus/theme.ts", "app/components/campus/theme"), true);
  assert.equal(matchesTrigger("app/components/campus/primitives.tsx", "app/components/campus/primitives"), true);
});

test("ready evidence requires distinct desktop and mobile records bound to a product commit", () => {
  const state = fixture();
  makeDashboardReady(state);
  const result = auditVisualBaseline(state.root);
  assert.deepEqual(result.failures, []);
});

test("path traversal is rejected even when evidence names the persistent directory", () => {
  const state = fixture();
  const page = makeDashboardReady(state);
  page.currentEvidence[0].path = "docs/visual-baseline/current/../references/C1-dashboard-desktop.webp";
  writeJson(state.root, state.ledger);
  assert.ok(auditVisualBaseline(state.root).failures.some((failure) => failure.includes("outside docs/visual-baseline/current")));
});

test("one file cannot impersonate two evidence slots", () => {
  const state = fixture();
  const page = makeDashboardReady(state);
  page.currentEvidence[1].path = page.currentEvidence[0].path;
  writeJson(state.root, state.ledger);
  assert.ok(auditVisualBaseline(state.root).failures.some((failure) => failure.includes("reuses evidence path")));
});

test("two desktop records cannot satisfy the mobile requirement", () => {
  const state = fixture();
  const page = makeDashboardReady(state);
  page.currentEvidence[1].kind = "desktop";
  writeJson(state.root, state.ledger);
  assert.ok(auditVisualBaseline(state.root).failures.some((failure) => failure.includes("without distinct mobile current evidence")));
});

test("equivalent normalized paths cannot impersonate different evidence", () => {
  for (const alias of ["docs/visual-baseline/current/./desktop.png", "docs//visual-baseline/current/desktop.png", "docs\\visual-baseline\\current\\desktop.png"]) {
    const state = fixture();
    const page = makeDashboardReady(state);
    page.currentEvidence[1] = { ...page.currentEvidence[0], kind: "mobile", path: alias };
    writeJson(state.root, state.ledger);
    assert.ok(auditVisualBaseline(state.root).failures.some(failure => failure.includes("reuses evidence path")), alias);
  }
});

test("committed assets and visual configuration invalidate evidence and prior approvals", () => {
  for (const file of ["public/art/campus/scene.webp", "public/fonts/test.woff2", "package-lock.json", "vite.config.ts", "postcss.config.mjs", "build/style-plugin.ts"]) {
    const state = fixture();
    const page = makeDashboardReady(state, "PASS");
    page.status = "user-approved";
    state.ledger.gates[0].status = "user-approved";
    state.ledger.gates[0].userApproval = { approved: true, approvedAt: "2026-09-14T13:00:00+08:00", commit: state.productCommit };
    writeJson(state.root, state.ledger);
    mkdirSync(path.dirname(path.join(state.root, file)), { recursive: true });
    writeFileSync(path.join(state.root, file), "synthetic visual change");
    git(state.root, ["add", "."]);
    git(state.root, ["commit", "-m", "change asset or configuration"]);
    const failures = auditVisualBaseline(state.root).failures;
    assert.ok(failures.some(failure => failure.includes("product files changed")), file);
    assert.ok(failures.some(failure => failure.includes("must move to needs-regression-review")), file);
  }
});

test("page approval cannot exist without approval on its gate", () => {
  const state = fixture();
  const page = makeDashboardReady(state, "PASS");
  page.status = "user-approved";
  writeJson(state.root, state.ledger);
  assert.ok(auditVisualBaseline(state.root).failures.some((failure) => failure.includes("without approval on its gate")));
});

test("gate command keeps supervision PASS separate from visual readiness", () => {
  const state = fixture();
  makeDashboardReady(state, "pending");
  assert.ok(auditVisualBaseline(state.root, ["--gate", "V1"]).failures.some((failure) => failure.includes("does not have an independent supervision PASS")));
});

test("shared visual changes are detected after an approved commit", () => {
  const state = fixture();
  const page = makeDashboardReady(state, "PASS");
  page.status = "user-approved";
  const gate = state.ledger.gates[0];
  gate.status = "user-approved";
  gate.userApproval = { approved: true, approvedAt: "2026-09-14T13:00:00+08:00", commit: state.productCommit };
  writeJson(state.root, state.ledger);
  git(state.root, ["add", "."]);
  git(state.root, ["commit", "-m", "approve fixture"]);
  writeFileSync(path.join(state.root, "app", "components", "workbench", "fixture.css"), ".fixture{color:red}\n");
  git(state.root, ["add", "."]);
  git(state.root, ["commit", "-m", "change shared visual"]);
  const failures = auditVisualBaseline(state.root).failures;
  assert.ok(failures.some((failure) => failure.includes("must move to needs-regression-review")));
});

test("a page-local change invalidates its own evidence but not an approved sibling page", () => {
  const state = fixture();
  const page = makeDashboardReady(state, "PASS");
  page.status = "user-approved";
  const gate = state.ledger.gates[0];
  gate.status = "user-approved";
  gate.userApproval = { approved: true, approvedAt: "2026-09-14T13:00:00+08:00", commit: state.productCommit };
  writeJson(state.root, state.ledger);
  git(state.root, ["add", "."]);
  git(state.root, ["commit", "-m", "approve dashboard"]);
  const students = path.join(state.root, "app", "w", "[token]", "features", "students", "StudentsView.tsx");
  mkdirSync(path.dirname(students), { recursive: true });
  writeFileSync(students, "export const studentOnly = true;\n");
  git(state.root, ["add", "."]);
  git(state.root, ["commit", "-m", "change students only"]);
  assert.deepEqual(auditVisualBaseline(state.root).failures, []);

  const dashboard = path.join(state.root, "app", "w", "[token]", "features", "dashboard", "DashboardView.tsx");
  mkdirSync(path.dirname(dashboard), { recursive: true });
  writeFileSync(dashboard, "export const dashboardChange = true;\n");
  git(state.root, ["add", "."]);
  git(state.root, ["commit", "-m", "change dashboard"]);
  assert.ok(auditVisualBaseline(state.root).failures.some(failure => failure.includes("dashboard product files changed")));
});
