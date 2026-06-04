"use strict";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn } = require("child_process");

const rootDir = path.join(__dirname, "..");
const port = process.env.PI_WEB_DESKTOP_PORT || process.env.PORT || "30141";
const url = `http://127.0.0.1:${port}`;

function waitForServer(targetUrl, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(targetUrl, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${targetUrl}`));
          return;
        }
        setTimeout(poll, 500);
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    };

    poll();
  });
}

async function run() {
  const nextBin = require.resolve("next/dist/bin/next", { paths: [rootDir] });
  const nextProcess = spawn(process.execPath, [nextBin, "dev", "-p", port], {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env },
  });

  nextProcess.on("exit", (code) => {
    if (!electronProcess || electronProcess.killed) return;
    electronProcess.kill();
    process.exit(code ?? 0);
  });

  await waitForServer(url);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electronBin = require("electron");
  var electronProcess = spawn(electronBin, ["electron/main.cjs"], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      PI_WEB_ELECTRON_URL: url,
    },
  });

  electronProcess.on("exit", (code) => {
    nextProcess.kill();
    process.exit(code ?? 0);
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
