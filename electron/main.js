// electron/main.js
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const net = require('net');
const { fork } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let serverProcess = null;

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

function getAvailablePort(startPort = 3000) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(startPort, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', () => {
      resolve(getAvailablePort(startPort + 1));
    });
  });
}

function waitForServer(url, timeoutMs = 45000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const req = http.get(url, (res) => {
        clearInterval(interval);
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          reject(new Error('Timed out waiting for internal Next.js server to start.'));
        }
      });
      req.setTimeout(2000, () => req.destroy());
    }, 400);
  });
}

async function startProductionServer() {
  const port = await getAvailablePort(3000);
  
  // Locate standalone server.js
  // 1. Packaged extraResources path: resources/standalone/server.js
  // 2. Unpackaged fallback: ../.next/standalone/server.js
  let serverScript = path.join(process.resourcesPath, 'standalone', 'server.js');
  let serverCwd = path.join(process.resourcesPath, 'standalone');

  if (!fs.existsSync(serverScript)) {
    const localStandalone = path.join(__dirname, '..', '.next', 'standalone', 'server.js');
    if (fs.existsSync(localStandalone)) {
      serverScript = localStandalone;
      serverCwd = path.join(__dirname, '..', '.next', 'standalone');
    } else {
      throw new Error(`Could not find Next.js standalone server script at ${serverScript} or ${localStandalone}.`);
    }
  }

  console.log(`[Electron] Starting Next.js standalone server from: ${serverScript} on port ${port}`);

  serverProcess = fork(serverScript, [], {
    cwd: serverCwd,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: 'pipe'
  });

  serverProcess.stdout?.on('data', (data) => console.log(`[Next.js Server] ${data}`));
  serverProcess.stderr?.on('data', (data) => console.error(`[Next.js Server Error] ${data}`));

  serverProcess.on('exit', (code, signal) => {
    console.log(`[Next.js Server] Exited with code ${code}, signal ${signal}`);
  });

  const appUrl = `http://127.0.0.1:${port}`;
  await waitForServer(appUrl);
  return appUrl;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Pavithra Gold Finance',
    backgroundColor: '#0A192F',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  // Handle external links safely in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  let loadUrl = 'http://localhost:3000';

  if (!isDev) {
    try {
      loadUrl = await startProductionServer();
    } catch (err) {
      console.error('[Electron] Failed to start production server:', err);
      // Fallback error display
      mainWindow.loadURL(`data:text/html,<html><body style="background:#0A192F;color:white;font-family:sans-serif;padding:40px;"><h2>Failed to launch Pavithra Gold Finance</h2><p>${err.message}</p></body></html>`);
      return;
    }
  }

  console.log(`[Electron] Loading URL: ${loadUrl}`);
  await mainWindow.loadURL(loadUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    console.log('[Electron] Shutting down Next.js server...');
    try {
      serverProcess.kill('SIGTERM');
    } catch (e) {
      console.error('[Electron] Error killing server process:', e);
    }
    serverProcess = null;
  }
});
