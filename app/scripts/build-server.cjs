const { spawn } = require('node:child_process');
const path = require('node:path');

const serverDir = path.join(__dirname, '..', '..', 'server');
const tscCommand = process.platform === 'win32'
  ? `"${path.join(serverDir, 'node_modules', '.bin', 'tsc.cmd')}"`
  : `"${path.join(serverDir, 'node_modules', '.bin', 'tsc')}"`;

const child = spawn(`${tscCommand} --project tsconfig.json`, {
  cwd: serverDir,
  stdio: 'inherit',
  shell: true,
  windowsHide: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Server build exited with signal ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 0;
});
