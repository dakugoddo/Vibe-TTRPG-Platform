const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const isDev = Boolean(process.env.VIBE_ELECTRON_DEV_SERVER_URL);
const devServerUrl = process.env.VIBE_ELECTRON_DEV_SERVER_URL || 'http://localhost:5173';
const fileServerUrl = process.env.VIBE_FILE_SERVER_URL || 'http://localhost:3001';
const fileServerStartupTimeoutMs = Number(process.env.VIBE_ELECTRON_SERVER_STARTUP_TIMEOUT_MS || 12000);
const shouldOpenDevTools = process.env.VIBE_ELECTRON_OPEN_DEVTOOLS === '1';
let fileServerProcess = null;
let embeddedFileServer = null;
let isQuitting = false;
const appIconPath = path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

if (process.platform === 'win32') {
  app.setAppUserModelId('local.eternity-table.app');
}

const userDataDir = process.env.VIBE_ELECTRON_USER_DATA_DIR
  || (isDev ? path.join(__dirname, '..', '.tmp', 'electron-dev-user-data') : null);

if (userDataDir) {
  fs.mkdirSync(userDataDir, { recursive: true });
  app.setPath('userData', userDataDir);
}

if (process.env.VIBE_ELECTRON_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

function isFileServerAvailable(timeoutMs = 900) {
  return new Promise((resolve) => {
    const request = http.get(`${fileServerUrl}/api/world/status`, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function readFileServerJson(pathname, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const request = http.get(`${fileServerUrl}${pathname}`, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`File server returned HTTP ${response.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      reject(new Error(`File server request timed out: ${pathname}`));
    });
  });
}

function normalizeAssetPath(assetPath) {
  return assetPath.replace(/\\/g, '/').split('/').filter(Boolean).join('/');
}

function resolveAssetPath(assetsDir, requestedPath) {
  const normalizedPath = normalizeAssetPath(requestedPath);
  const parts = normalizedPath.split('/');

  if (!normalizedPath || parts.some((part) => part === '.' || part === '..')) {
    return null;
  }

  const root = path.resolve(assetsDir);
  const filePath = path.resolve(root, ...parts);
  const relative = path.relative(root, filePath);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return filePath;
}

function resolveTranslationsFolderPath() {
  const candidates = [
    path.join(__dirname, '..', 'src', 'locales'),
    path.join(app.getAppPath(), 'src', 'locales'),
    path.join(process.cwd(), 'src', 'locales'),
    ...(process.resourcesPath ? [path.join(process.resourcesPath, 'locales')] : []),
    path.join(__dirname, '..', 'locales'),
    path.join(__dirname, '..', 'dist', 'locales'),
  ];

  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  }) || null;
}


function resolvePreviewWorldTemplatePath() {
  const candidates = [
    path.join(__dirname, '..', 'preview-world'),
    path.join(app.getAppPath(), 'preview-world'),
    path.join(process.cwd(), 'preview-world'),
    ...(process.resourcesPath ? [path.join(process.resourcesPath, 'preview-world')] : []),
  ];

  return candidates.find((candidate) => {
    try {
      return fs.existsSync(path.join(candidate, 'world.yaml')) && fs.statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  }) || null;
}

function copyDirectoryRecursive(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function createPreviewWorldSession() {
  const templatePath = resolvePreviewWorldTemplatePath();
  if (!templatePath) {
    throw new Error('Bundled preview world template was not found');
  }

  const sessionPath = path.join(app.getPath('temp'), 'eternity-table-preview-world');
  fs.rmSync(sessionPath, { recursive: true, force: true });
  copyDirectoryRecursive(templatePath, sessionPath);
  fs.writeFileSync(
    path.join(sessionPath, '.preview-session.txt'),
    [
      'Eternity Table preview world session.',
      'This folder is recreated whenever the bundled preview world is opened.',
      'Changes here are temporary and are not part of your saved worlds.',
      new Date().toISOString(),
      '',
    ].join('\n'),
    'utf-8',
  );
  return sessionPath;
}

function startFileServer() {
  if (process.env.VIBE_ELECTRON_SKIP_SERVER === '1') return null;

  if (app.isPackaged) {
    return startPackagedFileServer();
  }

  const serverDir = path.join(__dirname, '..', '..', 'server');
  const nodeCommand = process.env.VIBE_NODE_EXEC_PATH || 'node';
  const tsxCliPath = path.join(serverDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const child = spawn(nodeCommand, [tsxCliPath, 'src/index.ts'], {
    cwd: serverDir,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });

  child.on('exit', (code, signal) => {
    if (fileServerProcess === child) fileServerProcess = null;
    if (code !== 0 && signal !== 'SIGTERM') {
      console.warn(`Vibe file server exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`);
    }
  });

  return child;
}

async function startPackagedFileServer() {
  const serverEntryPath = path.join(process.resourcesPath, 'server', 'dist', 'index.js');
  const serverModule = await import(pathToFileURL(serverEntryPath).href);
  if (typeof serverModule.startVibeFileServer !== 'function') {
    throw new Error(`Packaged server entry does not export startVibeFileServer: ${serverEntryPath}`);
  }

  await serverModule.startVibeFileServer({ registerProcessHandlers: false });
  embeddedFileServer = serverModule;
  return {
    killed: false,
    kill: () => {
      void stopPackagedFileServer();
    },
  };
}

async function stopPackagedFileServer() {
  if (!embeddedFileServer || typeof embeddedFileServer.stopVibeFileServer !== 'function') return;
  const serverModule = embeddedFileServer;
  embeddedFileServer = null;
  await serverModule.stopVibeFileServer();
}

async function ensureFileServer() {
  if (await isFileServerAvailable()) return true;
  try {
    fileServerProcess = await startFileServer();
  } catch (error) {
    console.error('Failed to start Vibe file server', error);
    return false;
  }

  if (!fileServerProcess) return false;

  const deadline = Date.now() + fileServerStartupTimeoutMs;
  while (Date.now() < deadline) {
    if (await isFileServerAvailable()) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return false;
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#080d13',
    show: false,
    title: 'Eternity Table',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    void mainWindow.loadURL(devServerUrl);
    if (shouldOpenDevTools) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      });
    }
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return mainWindow;
}

ipcMain.handle('vibe:select-world-folder', async (event) => {
  const ownerWindow = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(ownerWindow ?? undefined, {
    title: 'Select Eternity Table world folder',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0] ?? null;
});


ipcMain.handle('vibe:open-preview-world', async () => {
  return createPreviewWorldSession();
});

ipcMain.handle('vibe:show-asset-in-folder', async (_event, assetPath) => {
  if (typeof assetPath !== 'string' || !assetPath.trim()) {
    throw new Error('assetPath is required');
  }

  const status = await readFileServerJson('/api/world/status');
  const worldPath = typeof status.path === 'string' ? status.path : '';
  if (!worldPath) {
    throw new Error('No world is currently open');
  }

  const filePath = resolveAssetPath(path.join(worldPath, 'assets'), assetPath);
  if (!filePath) {
    throw new Error('Access denied or invalid asset path');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('Asset file not found');
  }

  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('vibe:show-translations-folder', async () => {
  const folderPath = resolveTranslationsFolderPath();
  if (!folderPath) {
    throw new Error('Translations folder was not found');
  }

  const errorMessage = await shell.openPath(folderPath);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return folderPath;
});

const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
  app.quit();
} else {
  let mainWindow = null;

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    const serverReady = await ensureFileServer();
    if (!serverReady) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Eternity Table server did not start',
        message: 'Local file server is not available.',
        detail: `Electron could not reach ${fileServerUrl} within ${fileServerStartupTimeoutMs} ms. Check that port 3001 is free and server dependencies are installed.`,
      });
    }

    mainWindow = createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', (event) => {
    if (embeddedFileServer && !isQuitting) {
      isQuitting = true;
      event.preventDefault();
      void stopPackagedFileServer().finally(() => app.quit());
      return;
    }

    if (fileServerProcess && !fileServerProcess.killed) {
      fileServerProcess.kill();
      fileServerProcess = null;
    }
  });
}
