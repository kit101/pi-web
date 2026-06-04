"use strict";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const net = require("net");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, BrowserWindow, dialog, shell } = require("electron");

let server;
let mainWindow;

function canUsePort(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close(() => resolve(true));
      })
      .listen(port, "127.0.0.1");
  });
}

async function findPort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await canUsePort(port)) return port;
  }
  throw new Error(`No available port found from ${startPort} to ${startPort + 49}`);
}

async function startBundledNextServer() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const next = require("next");
  const port = await findPort(Number(process.env.PI_WEB_DESKTOP_PORT || 30141));
  const hostname = "127.0.0.1";
  const dir = app.getAppPath();
  const nextApp = next({ dev: false, dir, hostname, port });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  server = http.createServer((req, res) => handle(req, res));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, resolve);
  });

  return `http://${hostname}:${port}`;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "PI",
    icon: path.join(app.getAppPath(), "assets", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.loadURL(url);
}

async function main() {
  const devUrl = process.env.PI_WEB_ELECTRON_URL;
  const url = devUrl || (await startBundledNextServer());
  createWindow(url);
}

app.whenReady().then(() => {
  main().catch((error) => {
    dialog.showErrorBox("PI failed to start", error?.stack || String(error));
    app.quit();
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow) {
    mainWindow.show();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (server) server.close();
});
