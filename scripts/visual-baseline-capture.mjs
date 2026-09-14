import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const ledger = JSON.parse(readFileSync(path.join(root, "trackers", "visual-baseline.json"), "utf8"));
const inline = process.argv.find((value) => value.startsWith("--gate="));
const index = process.argv.indexOf("--gate");
const gateId = String(inline?.slice(7) || (index >= 0 ? process.argv[index + 1] : "") || "").toUpperCase();
const gate = ledger.gates.find((candidate) => candidate.id === gateId);

if (!gate) {
  console.error("Use --gate V1 through --gate V7.");
  process.exit(1);
}

const output = path.join(root, ".qa-shots", "visual-baseline", gateId);
mkdirSync(output, { recursive: true });
const result = spawnSync(process.execPath, [path.join(root, "scripts", "layout-audit.mjs"), "--serve"], {
  cwd: root,
  env: {
    ...process.env,
    QA_PAGES: gate.pages.join(","),
    QA_VIEWPORTS: "referenceDesktop:1536x1024,referenceMobile:390x844",
    QA_SCREENSHOT_DIR: output,
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Visual gate screenshots: ${output}`);
