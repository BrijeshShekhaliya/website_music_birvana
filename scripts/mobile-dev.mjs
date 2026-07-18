import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const mobileDir = path.join(rootDir, 'apps', 'mobile');
const isWindows = process.platform === 'win32';

if (!isWindows) {
  console.error('mobile:dev is currently wired for Windows only.');
  process.exit(1);
}

function runPowerShell(command) {
  return spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function killDevPorts() {
  runPowerShell(
    "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | " +
      "Where-Object { $_.LocalPort -in 3000,8081,8082,8083 } | " +
      "Select-Object -ExpandProperty OwningProcess -Unique | " +
      "ForEach-Object { try { taskkill /PID $_ /T /F | Out-Null } catch {} }",
  );
}

function startBackgroundPowerShell(cwd, command, stdoutPath, stderrPath) {
  ensureDir(stdoutPath);
  ensureDir(stderrPath);

  if (fs.existsSync(stdoutPath)) {
    fs.unlinkSync(stdoutPath);
  }

  if (fs.existsSync(stderrPath)) {
    fs.unlinkSync(stderrPath);
  }

  const script = [
    `$out = '${stdoutPath.replace(/'/g, "''")}'`,
    `$err = '${stderrPath.replace(/'/g, "''")}'`,
    `Start-Process powershell.exe -WindowStyle Hidden -WorkingDirectory '${cwd.replace(/'/g, "''")}' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','${command.replace(/'/g, "''")}' -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null`,
  ].join('; ');

  const result = runPowerShell(script);

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to start ${command}`);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestUrl(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          body: Buffer.concat(chunks).toString('utf8'),
          statusCode: res.statusCode ?? 0,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(2500, () => {
      req.destroy(new Error(`Timeout requesting ${url}`));
    });
  });
}

async function waitForUrl(url, validate, label) {
  const startedAt = Date.now();
  let lastError = 'not started yet';

  while (Date.now() - startedAt < 120000) {
    try {
      const response = await requestUrl(url);
      if (validate(response)) {
        console.log(`${label} ready: ${url}`);
        return;
      }

      lastError = `Unexpected response ${response.statusCode}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await wait(2000);
  }

  throw new Error(`${label} did not become ready. Last error: ${lastError}`);
}

function configureAdbReverse() {
  const result = spawnSync(
    'cmd.exe',
    ['/d', '/s', '/c', 'adb reverse tcp:8081 tcp:8081'],
    {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'adb reverse failed');
  }
}

function runAndroidInstall() {
  return new Promise((resolve, reject) => {
    const child = spawn('cmd.exe', ['/d', '/s', '/c', 'npx expo run:android --no-bundler'], {
      cwd: mobileDir,
      env: process.env,
      shell: false,
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`expo run:android exited with code ${code ?? 'unknown'}`));
    });

    child.on('error', reject);
  });
}

async function main() {
  const webOut = path.join(rootDir, '.logs', 'web-live.out.log');
  const webErr = path.join(rootDir, '.logs', 'web-live.err.log');
  const metroOut = path.join(mobileDir, '.expo-metro.out.log');
  const metroErr = path.join(mobileDir, '.expo-metro.err.log');

  console.log('Cleaning old dev listeners...');
  killDevPorts();
  await wait(1500);

  console.log('Starting backend in the background...');
  startBackgroundPowerShell(rootDir, 'npm run dev:network', webOut, webErr);
  await waitForUrl('http://localhost:3000', (response) => response.statusCode === 200, 'Backend');

  console.log('Starting Metro in the background...');
  startBackgroundPowerShell(
    mobileDir,
    'npx expo start --clear --dev-client',
    metroOut,
    metroErr,
  );
  await waitForUrl(
    'http://localhost:8081/status',
    (response) => response.statusCode === 200 && response.body.includes('packager-status:running'),
    'Metro',
  );

  console.log('Configuring adb reverse...');
  configureAdbReverse();

  console.log('Installing and opening Android app...');
  await runAndroidInstall();

  console.log('');
  console.log('Birvana mobile is live.');
  console.log(`Backend log: ${webOut}`);
  console.log(`Metro log: ${metroOut}`);
  console.log('You can keep editing code; Metro will live reload changes.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
