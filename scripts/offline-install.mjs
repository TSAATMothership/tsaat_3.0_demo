import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkOfflineDependencies, repositoryRoot } from './offline-dependencies.mjs';

export function parseInstallArguments(args) {
  let cache;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--cache' && args[index + 1] && !args[index + 1].startsWith('--') && !cache) cache = args[++index];
    else if (argument.startsWith('--cache=') && argument.length > 8 && !cache) cache = argument.slice(8);
    else throw new Error('Usage: npm run install:offline [-- --cache <directory>]. Offline and lifecycle protections cannot be overridden.');
  }
  return { cache };
}

export function installOffline({ cache } = {}) {
  if (process.platform !== 'win32') throw new Error('The supported offline installer requires Windows and PowerShell.');
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    const launcher = path.join(repositoryRoot, 'scripts/offline-npm.ps1');
    if (!fs.existsSync(launcher)) throw new Error('Offline runtime launcher is missing. Restore the complete offline package or provision Node.js 24/npm.');
    console.log(`Node.js ${process.versions.node} is active; switching to the offline Node.js 24 launcher.`);
    // The PowerShell launcher verifies/selects Node 24 before invoking npm again.
    // Handoff occurs before this process takes an install lock or touches dependencies.
    const handedOff = spawnSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', launcher,
      'run', 'install:offline', ...(cache ? ['--', '--cache', cache] : [])
    ], { cwd: repositoryRoot, stdio: 'inherit', windowsHide: true });
    if (handedOff.error) throw handedOff.error;
    if (handedOff.status === null) throw new Error('Offline runtime launcher was interrupted.');
    return handedOff.status;
  }
  const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (!path.isAbsolute(npmCli) || !fs.existsSync(npmCli)) throw new Error('npm CLI not found. Run npm run install:offline with the preinstalled Node.js 24/npm host tools.');
  const modules = path.join(repositoryRoot, 'node_modules');
  if (fs.existsSync(modules) && fs.lstatSync(modules).isSymbolicLink()) throw new Error('node_modules is a link/junction. Refusing to reinstall outside this checkout.');
  console.log(`Offline dependencies verified: ${checkOfflineDependencies()} archives.`);

  const local = path.join(repositoryRoot, '.local');
  fs.mkdirSync(local, { recursive: true });
  const lockPath = path.join(local, 'offline-install.lock');
  let lock;
  try { lock = fs.openSync(lockPath, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`An offline install is already running or was interrupted. Check the PID recorded in ${lockPath}; remove only this lock file once that installer has exited, then retry.`);
  }
  try {
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + '\n');
    const stopped = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(repositoryRoot, 'scripts/offline-stop-servers.ps1'), '-RepositoryRoot', repositoryRoot], {
      cwd: repositoryRoot, stdio: 'inherit', windowsHide: true, timeout: 60000
    });
    if (stopped.error) throw stopped.error;
    if (stopped.status !== 0) throw new Error('Could not stop this checkout\'s app servers. Dependencies have not been removed.');

    const attempts = path.join(local, `offline-install-attempts-${crypto.randomUUID()}.log`);
    const guard = path.join(repositoryRoot, 'scripts/offline-network.cjs').replaceAll('\\', '/');
    const env = {
      ...process.env,
      NODE_OPTIONS: `--require "${guard}" ${process.env.NODE_OPTIONS ?? ''}`.trim(),
      TSAAT_OFFLINE_ATTEMPTS: attempts,
      NEXT_TELEMETRY_DISABLED: '1',
      npm_config_offline: 'true',
      npm_config_ignore_scripts: 'true',
      npm_config_audit: 'false',
      npm_config_update_notifier: 'false'
    };
    const cachePath = path.resolve(repositoryRoot, cache || '.local/npm-cache');
    console.log('Installing from repository archives with Node network access blocked and lifecycle scripts disabled.');
    const installed = spawnSync(process.execPath, [npmCli, 'ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--include=dev', '--include=optional', '--legacy-peer-deps', '--cache', cachePath], {
      cwd: repositoryRoot, env, stdio: 'inherit', windowsHide: true
    });
    if (installed.error) throw installed.error;
    if (fs.existsSync(attempts)) throw new Error(`Installation attempted network access and was rejected. Evidence: ${attempts}\n${fs.readFileSync(attempts, 'utf8')}`);
    if (installed.status !== 0) throw new Error(`Offline npm ci failed (exit ${installed.status ?? 'unknown'}). Resolve the reported file lock or archive error, then retry npm run install:offline.`);
    console.log('Offline installation complete. Checkout app servers remain stopped.');
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = installOffline(parseInstallArguments(process.argv.slice(2))) ?? 0; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
