const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const devServerStartupTimeoutMs = Number(process.env.VIBE_ELECTRON_DEV_SERVER_STARTUP_TIMEOUT_MS || 20000);
const remoteDebuggingPort = process.env.VIBE_ELECTRON_REMOTE_DEBUGGING_PORT;
const devServerHost = process.env.VIBE_ELECTRON_DEV_SERVER_HOST || '127.0.0.1';
const preferredDevServerPort = Number(process.env.VIBE_ELECTRON_DEV_SERVER_PORT || 5173);
const devServerUrlOverride = process.env.VIBE_ELECTRON_DEV_SERVER_URL;
const shouldSkipVite = process.env.VIBE_ELECTRON_SKIP_VITE === '1';

let viteProcess = null;
let electronProcess = null;
let isShuttingDown = false;

const appRoot = path.resolve(__dirname, '..');
const viteCliPath = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const electronCliPath = path.join(appRoot, 'node_modules', 'electron', 'cli.js');

function getDevServerTarget() {
  if (!devServerUrlOverride) {
    return {
      url: `http://${devServerHost}:${preferredDevServerPort}`,
      host: devServerHost,
      port: preferredDevServerPort,
    };
  }

  const url = new URL(devServerUrlOverride);
  return {
    url: devServerUrlOverride,
    host: url.hostname || devServerHost,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
  };
}

function canListen(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findAvailablePort(host, preferredPort) {
  const firstPort = Number.isFinite(preferredPort) && preferredPort > 0 ? preferredPort : 5173;
  for (let port = firstPort; port < firstPort + 40; port += 1) {
    if (await canListen(host, port)) return port;
  }

  throw new Error(`No available Vite dev server port found from ${firstPort} to ${firstPort + 39}`);
}

function isUrlAvailable(url, timeoutMs = 900) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
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

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isUrlAvailable(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

function stopChild(child) {
  if (!child || child.killed) return;
  child.kill();
}

function spawnNodeScript(scriptPath, args, options = {}) {
  return spawn(process.execPath, [scriptPath, ...args], {
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    ...options,
  });
}

function shutdown(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  stopChild(electronProcess);
  stopChild(viteProcess);
  process.exitCode = code;
}

async function main() {
  const devServerTarget = getDevServerTarget();
  let devServerUrl = devServerTarget.url;

  if (!shouldSkipVite) {
    const vitePort = devServerUrlOverride
      ? devServerTarget.port
      : await findAvailablePort(devServerTarget.host, devServerTarget.port);
    devServerUrl = `http://${devServerTarget.host}:${vitePort}`;

    if (vitePort !== devServerTarget.port) {
      console.warn(`Port ${devServerTarget.port} is unavailable; using Vite dev server at ${devServerUrl}`);
    }

    viteProcess = spawnNodeScript(viteCliPath, ['--host', devServerTarget.host, '--port', String(vitePort), '--strictPort']);

    viteProcess.on('exit', (code, signal) => {
      viteProcess = null;
      if (!isShuttingDown) {
        console.warn(`Vite dev server exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`);
        shutdown(code || 1);
      }
    });
  } else {
    console.warn(`Skipping Vite startup and using existing dev server at ${devServerUrl}`);
  }

  const devServerReady = await waitForUrl(devServerUrl, devServerStartupTimeoutMs);
  if (!devServerReady) {
    console.error(`Vite dev server did not become available at ${devServerUrl}`);
    shutdown(1);
    return;
  }

  const electronArgs = remoteDebuggingPort
    ? [`--remote-debugging-port=${remoteDebuggingPort}`, '.']
    : ['.'];

  electronProcess = spawnNodeScript(electronCliPath, electronArgs, {
    env: {
      ...process.env,
      VIBE_ELECTRON_DEV_SERVER_URL: devServerUrl,
      VIBE_NODE_EXEC_PATH: process.execPath,
    },
  });

  electronProcess.on('exit', (code, signal) => {
    electronProcess = null;
    if (!isShuttingDown) {
      if (signal) console.warn(`Electron exited with signal ${signal}`);
      shutdown(code || 0);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => {
  stopChild(electronProcess);
  stopChild(viteProcess);
});

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
