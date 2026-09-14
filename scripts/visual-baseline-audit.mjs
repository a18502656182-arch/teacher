import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expectedPages = ["dashboard", "students", "homework", "dictation", "attendance", "growth", "health", "records", "scores", "reflection", "schedule", "tools", "seating", "duty", "cadres", "rules", "points", "weekly", "comments"];
const allowedGateStatuses = new Set(["blocked", "active", "in-progress", "needs-fix", "awaiting-user-review", "user-approved", "needs-regression-review"]);
const reviewableStatuses = new Set(["ready-for-review", "user-approved"]);
const evidenceKinds = new Set(["desktop", "mobile"]);

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex").toUpperCase();
}

function gateArgument(argv) {
  const inline = argv.find((value) => value.startsWith("--gate="));
  if (inline) return inline.slice("--gate=".length).toUpperCase();
  const index = argv.indexOf("--gate");
  return index >= 0 ? String(argv[index + 1] ?? "").toUpperCase() : "";
}

function gitOutput(root, args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function gitCommitExists(root, commit) {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function changedTrackedFiles(root, fromCommit = "HEAD") {
  const committed = fromCommit === "HEAD" ? "" : gitOutput(root, ["diff", "--name-only", `${fromCommit}..HEAD`, "--"]);
  const working = gitOutput(root, ["diff", "--name-only", "HEAD", "--"]);
  return `${committed}\n${working}`
      .split(/\r?\n/)
      .map((value) => value.trim().replaceAll("\\", "/"))
      .filter((value, index, items) => value && items.indexOf(value) === index);
}

export function matchesTrigger(file, trigger) {
  const normalizedFile = file.replaceAll("\\", "/");
  const normalizedTrigger = trigger.replaceAll("\\", "/").replace(/\/$/, "");
  return normalizedFile === normalizedTrigger
    || normalizedFile.startsWith(`${normalizedTrigger}/`)
    || (!path.extname(normalizedTrigger) && normalizedFile.startsWith(`${normalizedTrigger}.`));
}

function safeEvidencePath(root, relativePath, requiredDirectory) {
  if (typeof relativePath !== "string" || !relativePath) return false;
  const normalized = relativePath.replaceAll("\\", "/");
  if (path.isAbsolute(relativePath) || normalized.split("/").includes("..")) return false;
  const directory = path.resolve(root, requiredDirectory);
  const resolved = path.resolve(root, relativePath);
  return resolved.startsWith(`${directory}${path.sep}`);
}

function evidencePath(item) {
  return typeof item === "string" ? item : item?.path;
}

function validateEvidence(root, pageId, item, requiredDirectory, productCommit, failures) {
  const label = requiredDirectory.endsWith("current") ? "current evidence" : "comparison";
  const file = evidencePath(item);
  if (!safeEvidencePath(root, file, requiredDirectory)) {
    failures.push(`${pageId} ${label} is outside ${requiredDirectory}: ${file ?? "missing path"}.`);
    return;
  }
  const absolute = path.join(root, file);
  if (!existsSync(absolute)) failures.push(`${pageId} ${label} is missing: ${file}.`);
  if (typeof item === "string") return;
  if (!evidenceKinds.has(item.kind)) failures.push(`${pageId} ${label} has invalid kind ${item.kind}.`);
  if (!/^\d+x\d+$/.test(item.viewport ?? "")) failures.push(`${pageId} ${label} is missing a valid viewport.`);
  if (!item.url || !/^https?:\/\//.test(item.url)) failures.push(`${pageId} ${label} is missing an actual URL.`);
  if (!item.capturedAt || Number.isNaN(Date.parse(item.capturedAt))) failures.push(`${pageId} ${label} is missing capture time.`);
  if (!productCommit || item.productCommit !== productCommit) failures.push(`${pageId} ${label} is not bound to the page product commit.`);
  if (!/^[A-Fa-f0-9]{64}$/.test(item.sha256 ?? "")) failures.push(`${pageId} ${label} is missing a SHA-256 hash.`);
  else if (existsSync(absolute) && sha256(absolute) !== item.sha256.toUpperCase()) failures.push(`${pageId} ${label} hash changed: ${file}.`);
  if (label === "comparison" && !item.referenceId) failures.push(`${pageId} comparison is missing its reference ID.`);
}

export function auditVisualBaseline(root, argv = []) {
  const failures = [];
  const warnings = [];
  const ledgerPath = path.join(root, "trackers", "visual-baseline.json");
  if (!existsSync(ledgerPath)) return { failures: ["Missing trackers/visual-baseline.json."], warnings, summary: "missing ledger" };

  let ledger;
  try {
    ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  } catch (error) {
    return { failures: [`Invalid visual baseline JSON: ${error.message}`], warnings, summary: "invalid ledger" };
  }

  if (ledger.schemaVersion !== 2) failures.push("Unsupported visual baseline schemaVersion.");
  if (ledger.scope !== "teacher-workbench-only") failures.push("Visual baseline scope must remain teacher-workbench-only.");
  if (!ledger.excluded?.includes("family")) failures.push("Family must remain explicitly excluded from this correction program.");
  if (ledger.gates?.length !== 7) failures.push("Exactly seven user-review gates are required.");

  const gatedPages = [];
  const gateByPage = new Map();
  for (const [index, gate] of (ledger.gates ?? []).entries()) {
    if (gate.id !== `V${index + 1}`) failures.push(`Gate order is invalid at ${gate.id ?? index}.`);
    if (!gate.pauseRequired) failures.push(`${gate.id} must require a user pause.`);
    if (!allowedGateStatuses.has(gate.status)) failures.push(`${gate.id} has invalid status ${gate.status}.`);
    if (!Array.isArray(gate.pages) || gate.pages.length === 0) failures.push(`${gate.id} has no pages.`);
    gatedPages.push(...(gate.pages ?? []));
    for (const pageId of gate.pages ?? []) gateByPage.set(pageId, gate);
    if (gate.userApproval?.approved) {
      if (!gate.userApproval.approvedAt || !gate.userApproval.commit) failures.push(`${gate.id} approval is missing date or commit.`);
      if (gate.status !== "user-approved") failures.push(`${gate.id} has a current approval but is not marked user-approved.`);
      for (const pageId of gate.pages ?? []) if (ledger.pages?.[pageId]?.status !== "user-approved") failures.push(`${gate.id} is approved but ${pageId} is not user-approved.`);
    }
    if (gate.status === "user-approved" && !gate.userApproval?.approved) failures.push(`${gate.id} is marked user-approved without a current user approval.`);
    if (gate.status === "needs-fix" && !(gate.pages ?? []).some((pageId) => ledger.pages?.[pageId]?.status === "needs-fix")) failures.push(`${gate.id} is needs-fix but none of its pages are needs-fix.`);
  }

  if (new Set(gatedPages).size !== gatedPages.length) failures.push("A teacher page appears in more than one visual gate.");
  const missingPages = expectedPages.filter((page) => !gatedPages.includes(page));
  const unexpectedPages = gatedPages.filter((page) => !expectedPages.includes(page));
  if (missingPages.length) failures.push(`Missing teacher pages: ${missingPages.join(", ")}.`);
  if (unexpectedPages.length) failures.push(`Unexpected or excluded pages: ${unexpectedPages.join(", ")}.`);

  const allowedPageStatuses = new Set(ledger.allowedPageStatuses ?? []);
  const usedEvidencePaths = new Map();
  for (const pageId of expectedPages) {
    const page = ledger.pages?.[pageId];
    if (!page) {
      failures.push(`Missing page ledger entry: ${pageId}.`);
      continue;
    }
    if (!allowedPageStatuses.has(page.status)) failures.push(`${pageId} has invalid status ${page.status}.`);
    if (!page.referenceIds?.length) failures.push(`${pageId} has no visual authority reference.`);
    for (const referenceId of page.referenceIds ?? []) if (!ledger.references?.[referenceId]) failures.push(`${pageId} refers to missing ${referenceId}.`);
    if (!Number.isInteger(page.requiredComparisons) || page.requiredComparisons < 2) failures.push(`${pageId} must require desktop and mobile comparisons.`);
    if (!Array.isArray(page.currentEvidence)) failures.push(`${pageId} currentEvidence must be an array.`);
    if (!Array.isArray(page.comparisons)) failures.push(`${pageId} comparisons must be an array.`);
    for (const current of page.currentEvidence ?? []) validateEvidence(root, pageId, current, "docs/visual-baseline/current", page.productCommit, failures);
    for (const comparison of page.comparisons ?? []) validateEvidence(root, pageId, comparison, "docs/visual-baseline/comparisons", page.productCommit, failures);
    for (const item of [...(page.currentEvidence ?? []), ...(page.comparisons ?? [])]) {
      const file = evidencePath(item);
      if (!file) continue;
      if (usedEvidencePaths.has(file)) failures.push(`${pageId} reuses evidence path already claimed by ${usedEvidencePaths.get(file)}: ${file}.`);
      else usedEvidencePaths.set(file, pageId);
    }
    if (reviewableStatuses.has(page.status)) {
      if (!/^[A-Fa-f0-9]{40}$/.test(page.productCommit ?? "") || !gitCommitExists(root, page.productCommit)) failures.push(`${pageId} is ready without a valid product commit.`);
      const productChanges = changedTrackedFiles(root, page.productCommit).filter((file) => /^(app|lib|db|drizzle|worker)\//.test(file));
      if (productChanges.length) failures.push(`${pageId} product files changed after its evidence commit: ${productChanges.join(", ")}.`);
      const kinds = new Set((page.currentEvidence ?? []).map((item) => item?.kind));
      const comparisonKinds = new Set((page.comparisons ?? []).map((item) => item?.kind));
      for (const kind of evidenceKinds) {
        if (!kinds.has(kind)) failures.push(`${pageId} is ready without distinct ${kind} current evidence.`);
        if (!comparisonKinds.has(kind)) failures.push(`${pageId} is ready without distinct ${kind} comparison evidence.`);
      }
      if (!page.supervision || !["pending", "PASS", "CHANGES_REQUESTED", "BLOCKED", "STALE"].includes(page.supervision.status)) failures.push(`${pageId} is ready without an independent supervision state.`);
      if (page.supervision?.status === "PASS" && page.supervision.reviewedProductCommit !== page.productCommit) failures.push(`${pageId} supervision PASS is not bound to its product commit.`);
    }
    if (page.status === "user-approved") {
      if ((page.comparisons?.length ?? 0) < page.requiredComparisons) failures.push(`${pageId} is approved without enough comparison evidence.`);
      const gate = gateByPage.get(pageId);
      if (!gate?.userApproval?.approved || gate.status !== "user-approved") failures.push(`${pageId} is user-approved without approval on its gate.`);
      if (gate?.userApproval?.commit !== page.productCommit) failures.push(`${pageId} approval is not bound to its product commit.`);
    }
  }

  for (const gate of ledger.gates ?? []) {
    if (!gate.userApproval?.approved) continue;
    const changedSharedFiles = changedTrackedFiles(root, gate.userApproval.commit).filter((file) => (ledger.sharedRegressionTriggers ?? []).some((trigger) => matchesTrigger(file, trigger)));
    if (changedSharedFiles.length) {
      if (gate.status !== "needs-regression-review") failures.push(`${gate.id} was user-approved before a shared visual file changed and must move to needs-regression-review.`);
      for (const pageId of gate.pages ?? []) {
        if (ledger.pages?.[pageId]?.status !== "needs-regression-review") failures.push(`${pageId} must move to needs-regression-review after a shared visual file changed.`);
      }
    }
  }

  for (const [referenceId, reference] of Object.entries(ledger.references ?? {})) {
    const committedPath = path.join(root, reference.committedCopy);
    if (!existsSync(committedPath)) failures.push(`${referenceId} committed reference is missing.`);
    else if (sha256(committedPath) !== reference.committedSha256) failures.push(`${referenceId} committed reference hash changed.`);
    const originalPath = path.join(root, reference.sourceOriginal);
    if (!existsSync(originalPath)) warnings.push(`${referenceId} original is unavailable; use the committed visual copy.`);
    else if (sha256(originalPath) !== reference.sourceSha256) failures.push(`${referenceId} original reference hash changed.`);
  }

  const requestedGateId = gateArgument(argv);
  if (requestedGateId) {
    const requestedIndex = (ledger.gates ?? []).findIndex((gate) => gate.id === requestedGateId);
    if (requestedIndex < 0) failures.push(`Unknown gate ${requestedGateId}.`);
    else {
      for (const prior of ledger.gates.slice(0, requestedIndex)) if (!prior.userApproval?.approved) failures.push(`${requestedGateId} cannot pass before ${prior.id} receives user approval.`);
      const gate = ledger.gates[requestedIndex];
      for (const pageId of gate.pages) {
        const page = ledger.pages[pageId];
        if (!reviewableStatuses.has(page.status)) failures.push(`${pageId} is ${page.status}, not ready for user review.`);
        if ((page.comparisons?.length ?? 0) < page.requiredComparisons) failures.push(`${pageId} needs ${page.requiredComparisons} persistent comparison files.`);
        if (page.supervision?.status !== "PASS") failures.push(`${pageId} does not have an independent supervision PASS for ${page.productCommit ?? "its product commit"}.`);
      }
    }
  }

  const approved = (ledger.gates ?? []).filter((gate) => gate.userApproval?.approved).length;
  return { failures, warnings, summary: `${expectedPages.length} teacher pages, ${ledger.gates?.length ?? 0} gates, ${approved} user-approved gates` };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const result = auditVisualBaseline(process.cwd(), process.argv.slice(2));
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  if (result.failures.length) {
    for (const failure of result.failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
  } else console.log(`Visual baseline contract OK: ${result.summary}.`);
}
