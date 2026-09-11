const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = __dirname;
const out = fs.openSync(path.join(root, "dev-live-3006.log"), "a");
const err = fs.openSync(path.join(root, "dev-live-3006.err.log"), "a");

const child = spawn("D:\\nodejs\\npm.cmd", ["run", "dev", "--", "--host", "0.0.0.0", "--port", "3006"], {
  cwd: root,
  detached: true,
  shell: false,
  stdio: ["ignore", out, err],
  windowsHide: true,
});

child.unref();
console.log(child.pid);
