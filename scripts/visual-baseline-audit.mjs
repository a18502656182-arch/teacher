import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expectedPages = ["dashboard", "students", "homework", "dictation", "attendance", "growth", "health", "records", "scores", "reflection", "schedule", "tools", "seating", "duty", "cadres", "rules", "points", "weekly", "comments"];
const allowedGateStatuses = new Set(["blocked", "active", "in-progress", "awaiting-user-review", "user-approved", "needs-regression-review"]);

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex").toUpperCase();
}

function gateArgument(argv) {
  const inline = argv.find((value) => value.startsWith("--gate="));
  if (inline) return inline.slice("--gate=".length).toUpperCase();
  const index = argv.indexOf("--gate");
  return index >= 0 ? String(argv[index + 1] ?? "").toUpperCase() : "";
}

function changedTrackedFiles(root) {
  try {
    return execFileSync("git", ["diff", "--name-only", "HEAD", "--"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .map((value) => value.trim().replaceAll("\\", "/"))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function matchesTrigger(file, trigger) {
  return file === trigger || file.startsWith(`${trigger}/`);
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

  if (ledger.schemaVersion !== 1) failures.push("Unsupported visual baseline schemaVersion.");
  if (ledger.scope !== "teacher-workbench-only") failures.push("Visual baseline scope must remain teacher-workbench-only.");
  if (!ledger.excluded?.includes("family")) failures.push("Family must remain explicitly excluded from this correction program.");
  if (ledger.gates?.length !== 7) failures.push("Exactly seven user-review gates are required.");

  const gatedPages = [];
  for (const [index, gate] of (ledger.gates ?? []).entries()) {
    if (gate.id !== `V${index + 1}`) failures.push(`Gate order is invalid at ${gate.id ?? index}.`);
    if (!gate.pauseRequired) failures.push(`${gate.id} must require a user pause.`);
    if (!allowedGateStatuses.has(gate.status)) failures.push(`${gate.id} has invalid status ${gate.status}.`);
    if (!Array.isArray(gate.pages) || gate.pages.length === 0) failures.push(`${gate.id} has no pages.`);
    gatedPages.push(...(gate.pages ?? []));
    if (gate.userApproval?.approved) {
      if (!gate.userApproval.approvedAt || !gate.userApproval.commit) failures.push(`${gate.id} approval is missing date or commit.`);
      if (gate.status !== "user-approved") failures.push(`${gate.id} has a current approval but is not marked user-approved.`);
      for (const pageId of gate.pages ?? []) if (ledger.pages?.[pageId]?.status !== "user-approved") failures.push(`${gate.id} is approved but ${pageId} is not user-approved.`);
    }
    if (gate.status === "user-approved" && !gate.userApproval?.approved) failures.push(`${gate.id} is marked user-approved without a current user approval.`);
  }

  if (new Set(gatedPages).size !== gatedPages.length) failures.push("A teacher page appears in more than one visual gate.");
  const missingPages = expectedPages.filter((page) => !gatedPages.includes(page));
  const unexpectedPages = gatedPages.filter((page) => !expectedPages.includes(page));
  if (missingPages.length) failures.push(`Missing teacher pages: ${missingPages.join(", ")}.`);
  if (unexpectedPages.length) failures.push(`Unexpected or excluded pages: ${unexpectedPages.join(", ")}.`);

  const allowedPageStatuses = new Set(ledger.allowedPageStatuses ?? []);
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
    for (const current of page.currentEvidence ?? []) {
      if (!current.startsWith("docs/visual-baseline/current/")) failures.push(`${pageId} current evidence is outside the persistent current directory: ${current}.`);
      else if (!existsSync(path.join(root, current))) failures.push(`${pageId} current evidence is missing: ${current}.`);
    }
    for (const comparison of page.comparisons ?? []) {
      if (!comparison.startsWith("docs/visual-baseline/comparisons/")) failures.push(`${pageId} comparison is outside the persistent comparisons directory: ${comparison}.`);
      else if (!existsSync(path.join(root, comparison))) failures.push(`${pageId} comparison is missing: ${comparison}.`);
    }
    if (page.status === "user-approved") {
      if ((page.comparisons?.length ?? 0) < page.requiredComparisons) failures.push(`${pageId} is approved without enough comparison evidence.`);
    }
  }

  const changedFiles = changedTrackedFiles(root);
  const changedSharedFiles = changedFiles.filter((file) => (ledger.sharedRegressionTriggers ?? []).some((trigger) => matchesTrigger(file, trigger)));
  if (changedSharedFiles.length) {
    for (const gate of ledger.gates ?? []) {
      if (!gate.userApproval?.approved) continue;
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
        if (!new Set(["ready-for-review", "user-approved"]).has(page.status)) failures.push(`${pageId} is ${page.status}, not ready for user review.`);
        if ((page.comparisons?.length ?? 0) < page.requiredComparisons) failures.push(`${pageId} needs ${page.requiredComparisons} persistent comparison files.`);
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
