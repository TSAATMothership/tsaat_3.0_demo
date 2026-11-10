import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { checkOfflineDependencies } from '../scripts/offline-dependencies.mjs';
import { parseInstallArguments } from '../scripts/offline-install.mjs';

function fixture(prefix = 'tsaat-offline-test-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const directory = path.join(root, 'vendor/npm');
  fs.mkdirSync(directory, { recursive: true });
  const bytes = Buffer.from('fixture package archive');
  const record = { file: '01234567890123456789-example-1.0.0.tgz', source: 'https://registry.npmjs.org/example/-/example-1.0.0.tgz', integrity: 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64') };
  const entry = { version: '1.0.0', resolved: 'file:vendor/npm/' + record.file, integrity: record.integrity };
  const lock = { lockfileVersion: 2, packages: { '': { name: 'fixture' }, 'node_modules/example': { ...entry } }, dependencies: { example: { ...entry } } };
  const writeLock = () => fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock));
  fs.writeFileSync(path.join(directory, record.file), bytes);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ version: 1, packages: [record] }));
  writeLock();
  return { root, directory, record, lock, writeLock };
}
function cleanup(root) {
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
  assert.ok(path.basename(root).startsWith('tsaat-offline-test-'));
  fs.rmSync(root, { recursive: true, force: true });
}
test('offline archive closure rejects remote entries in both lockfile representations', () => {
  const f = fixture();
  try {
    assert.equal(checkOfflineDependencies(f.root), 1);
    for (const entry of [f.lock.packages['node_modules/example'], f.lock.dependencies.example]) {
      const local = entry.resolved;
      entry.resolved = f.record.source; f.writeLock();
      assert.throws(() => checkOfflineDependencies(f.root), /Nonlocal locked package/);
      entry.resolved = local; f.writeLock();
    }
    f.lock.packages['node_modules/example'].integrity = 'sha512-other'; f.writeLock();
    assert.throws(() => checkOfflineDependencies(f.root), /Missing\/mismatched/);
  } finally { cleanup(f.root); }
});
test('offline archive closure rejects missing, corrupt, additional and unused archives', () => {
  const f = fixture();
  try {
    const archive = path.join(f.directory, f.record.file);
    const original = fs.readFileSync(archive);
    fs.writeFileSync(archive, 'corrupt');
    assert.throws(() => checkOfflineDependencies(f.root), /integrity mismatch/);
    fs.unlinkSync(archive);
    assert.throws(() => checkOfflineDependencies(f.root), /ENOENT/);
    fs.writeFileSync(archive, original);
    fs.writeFileSync(path.join(f.directory, 'unexpected.tgz'), 'extra');
    assert.throws(() => checkOfflineDependencies(f.root), /Unexpected offline artifact/);
    fs.unlinkSync(path.join(f.directory, 'unexpected.tgz'));
    delete f.lock.packages['node_modules/example']; delete f.lock.dependencies.example; f.writeLock();
    assert.throws(() => checkOfflineDependencies(f.root), /Unused offline package/);
  } finally { cleanup(f.root); }
});
test('network preload blocks HTTP, fetch, TCP, TLS, DNS and UDP, recording caught attempts', () => {
  const f = fixture();
  try {
    const attempts = path.join(f.root, 'attempts.log');
    const guard = path.resolve('scripts/offline-network.cjs');
    const probes = [
      "fetch('https://example.invalid')",
      "require('node:http').get('http://example.invalid')",
      "require('node:https').request('https://example.invalid')",
      "require('node:net').connect(9, '127.0.0.1')",
      "require('node:tls').connect(443, 'example.invalid')",
      "require('node:dns').lookup('example.invalid', () => {})",
      "require('node:dns/promises').resolve4('example.invalid')",
      "new (require('node:dns').Resolver)().resolve4('example.invalid', () => {})",
      "new (require('node:dns/promises').Resolver)().resolve4('example.invalid')",
      "require('node:http2').connect('https://example.invalid')",
      "require('node:dgram').createSocket('udp4').send('test', 9, '127.0.0.1')"
    ];
    for (const probe of probes) {
      const child = spawnSync(process.execPath, ['--require', guard, '-e', `try { ${probe}; process.exitCode = 2; } catch (e) { if (!e.message.includes('Offline compilation forbids')) throw e; }`], { env: { ...process.env, TSAAT_OFFLINE_ATTEMPTS: attempts }, encoding: 'utf8', timeout: 10000, windowsHide: true });
      assert.equal(child.status, 0, child.stderr);
    }
    assert.equal(fs.readFileSync(attempts, 'utf8').trim().split('\n').length, probes.length);
    // NODE_OPTIONS carries the guard to spawned Node processes, including ESM consumers.
    const child = spawnSync(process.execPath, ['-e', `const c = require('node:child_process').spawnSync(process.execPath, ['--input-type=module', '-e', 'import { get } from "node:https"; get("https://example.invalid")'], { encoding: 'utf8' }); process.stdout.write(c.stderr); process.exit(c.status);`], { env: { ...process.env, NODE_OPTIONS: `--require "${guard.replaceAll('\\', '/')}"`, TSAAT_OFFLINE_ATTEMPTS: attempts }, encoding: 'utf8', timeout: 10000, windowsHide: true });
    assert.equal(child.status, 1);
    assert.match(child.stdout, /Offline compilation forbids/);
  } finally { cleanup(f.root); }
});

test('missing or partial Next installation gives offline recovery before storage or build setup for both providers', () => {
  const f = fixture();
  try {
    const scripts = path.join(f.root, 'scripts');
    fs.mkdirSync(scripts);
    for (const name of ['run-app.mjs', 'offline-dependencies.mjs']) fs.copyFileSync(path.resolve('scripts', name), path.join(scripts, name));
    fs.writeFileSync(path.join(scripts, 'setup-json-store.mjs'), `import fs from 'node:fs'; import { fileURLToPath } from 'node:url'; export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url)); export async function initializeJsonStore() { fs.writeFileSync(new URL('../store-touched', import.meta.url), 'changed'); throw new Error('Storage must not be initialized before dependency validation'); }`);
    for (const partial of [false, true]) {
      if (partial) {
        const next = path.join(f.root, 'node_modules/next');
        fs.mkdirSync(next, { recursive: true });
        fs.writeFileSync(path.join(next, 'package.json'), JSON.stringify({ name: 'next', version: '14.2.35' }));
      }
      for (const mode of ['sql', 'nosql']) for (const command of ['dev', 'start', 'build']) {
        const child = spawnSync(process.execPath, [path.join(scripts, 'run-app.mjs'), command, mode], {
          encoding: 'utf8', timeout: 10000, windowsHide: true,
          env: { ...process.env, TEMP: f.root, TMP: f.root, TMPDIR: f.root }
        });
        assert.equal(child.status, 1, child.stderr);
        assert.match(child.stderr, /Next\.js is missing or incomplete in node_modules/);
        assert.match(child.stderr, /npm ci --offline/);
        assert.ok(child.stderr.includes(f.root));
        assert.ok(child.stderr.includes(`npm run ${command}:${mode}`));
        assert.doesNotMatch(child.stderr, /MODULE_NOT_FOUND|Require stack|Storage must not/);
        assert.equal(child.stdout, '');
        assert.equal(fs.existsSync(path.join(f.root, 'store-touched')), false);
        assert.equal(fs.readdirSync(f.root).some(name => name.startsWith('tsaat-offline-build-')), false);
      }
    }
  } finally { cleanup(f.root); }
});

test('both build wrappers fail even when a compiler catches its network error; runtime remains unguarded', () => {
  const f = fixture();
  try {
    const scripts = path.join(f.root, 'scripts');
    fs.mkdirSync(scripts);
    for (const name of ['run-app.mjs', 'offline-dependencies.mjs', 'offline-network.cjs']) fs.copyFileSync(path.resolve('scripts', name), path.join(scripts, name));
    fs.writeFileSync(path.join(scripts, 'setup-json-store.mjs'), `import { fileURLToPath } from 'node:url'; export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url)); export async function initializeJsonStore() { return { directory: 'fixture-store', created: false }; }`);
    const bin = path.join(f.root, 'node_modules/next/dist/bin');
    fs.mkdirSync(bin, { recursive: true });
    const compiler = path.join(bin, 'next.js');
    for (const mode of ['sql', 'nosql']) {
      fs.writeFileSync(compiler, `if (!process.env.TSAAT_OFFLINE_ATTEMPTS || process.env.NEXT_TELEMETRY_DISABLED !== '1') process.exit(3); try { fetch('https://example.invalid'); } catch {} process.exit(0);`);
      const failed = spawnSync(process.execPath, [path.join(scripts, 'run-app.mjs'), 'build', mode], { encoding: 'utf8', timeout: 10000, windowsHide: true });
      assert.equal(failed.status, 1, failed.stderr);
      assert.match(failed.stderr, /Offline compilation forbids/);
      fs.writeFileSync(compiler, `if (!process.env.TSAAT_OFFLINE_ATTEMPTS) process.exit(3);`);
      const succeeded = spawnSync(process.execPath, [path.join(scripts, 'run-app.mjs'), 'build', mode], { encoding: 'utf8', timeout: 10000, windowsHide: true });
      assert.equal(succeeded.status, 0, succeeded.stderr);
      fs.writeFileSync(compiler, `if (process.env.TSAAT_OFFLINE_ATTEMPTS || process.env.NODE_OPTIONS?.includes('offline-network')) process.exit(3);`);
      for (const command of ['dev', 'start']) {
        const runtime = spawnSync(process.execPath, [path.join(scripts, 'run-app.mjs'), command, mode], { encoding: 'utf8', timeout: 10000, windowsHide: true });
        assert.equal(runtime.status, 0, runtime.stderr);
      }
    }
  } finally { cleanup(f.root); }
});

test('network guard permits local named-pipe IPC', () => {
  const guard = path.resolve('scripts/offline-network.cjs');
  const script = `const net = require('node:net'); const os = require('node:os'); const path = require('node:path'); const pipe = process.platform === 'win32' ? '\\\\\\\\.\\\\pipe\\\\tsaat-offline-' + process.pid : path.join(os.tmpdir(), 'tsaat-offline-' + process.pid + '.sock'); const server = net.createServer(socket => socket.end()); server.listen(pipe, () => { const client = net.connect(pipe); client.on('close', () => server.close()); });`;
  const child = spawnSync(process.execPath, ['--require', guard, '-e', script], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(child.status, 0, child.stderr);
});

test('offline installer accepts cache selection but rejects policy overrides before any work', () => {
  assert.deepEqual(parseInstallArguments([]), { cache: undefined });
  assert.deepEqual(parseInstallArguments(['--cache', 'cache with spaces']), { cache: 'cache with spaces' });
  assert.deepEqual(parseInstallArguments(['--cache=cache']), { cache: 'cache' });
  for (const args of [['--offline=false'], ['--ignore-scripts=false'], ['--cache'], ['--cache='], ['--cache', 'a', '--cache', 'b'], ['--', '--force']]) {
    assert.throws(() => parseInstallArguments(args), /cannot be overridden/);
  }
});

function installerFixture() {
  const f = fixture('tsaat-offline-test- [installer] ');
  const scripts = path.join(f.root, 'scripts');
  fs.mkdirSync(scripts);
  for (const name of ['offline-install.mjs', 'offline-stop-servers.ps1', 'offline-dependencies.mjs', 'offline-network.cjs']) fs.copyFileSync(path.resolve('scripts', name), path.join(scripts, name));
  const npmCli = path.join(f.root, 'fake-npm.cjs');
  fs.writeFileSync(npmCli, `require('node:fs').writeFileSync('npm-invocation.json', JSON.stringify({args: process.argv.slice(2), env: {NODE_OPTIONS: process.env.NODE_OPTIONS, npm_config_ignore_scripts: process.env.npm_config_ignore_scripts}}));`);
  const run = (args = [], extraEnv = {}) => spawnSync(process.execPath, [path.join(scripts, 'offline-install.mjs'), ...args], {
    cwd: f.root, env: { ...process.env, npm_execpath: npmCli, ...extraEnv }, encoding: 'utf8', timeout: 60000, windowsHide: true
  });
  return { ...f, npmCli, run };
}

const windowsOnly = { skip: process.platform !== 'win32' };
test('installer invokes locked npm ci without installed packages and releases its install lock', windowsOnly, () => {
  const f = installerFixture();
  try {
    const result = f.run(['--cache', 'new cache']);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const invocation = JSON.parse(fs.readFileSync(path.join(f.root, 'npm-invocation.json')));
    for (const flag of ['ci', '--offline', '--ignore-scripts', '--include=dev', '--include=optional', '--no-audit']) assert.ok(invocation.args.includes(flag));
    assert.equal(invocation.args.at(-1), path.join(f.root, 'new cache'));
    assert.match(invocation.env.NODE_OPTIONS, /offline-network\.cjs/);
    assert.equal(invocation.env.npm_config_ignore_scripts, 'true');
    assert.equal(fs.existsSync(path.join(f.root, '.local/offline-install.lock')), false);
  } finally { cleanup(f.root); }
});

test('installer rejects caught network attempts and npm failures and retains evidence', windowsOnly, () => {
  const f = installerFixture();
  try {
    fs.writeFileSync(f.npmCli, `try { require('node:https').get('https://example.invalid'); } catch {} process.exit(0);`);
    const rejected = f.run();
    assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
    assert.match(rejected.stderr, /Installation attempted network access/);
    assert.ok(fs.readdirSync(path.join(f.root, '.local')).some(name => name.startsWith('offline-install-attempts-')));
    assert.equal(fs.existsSync(path.join(f.root, '.local/offline-install.lock')), false);
    fs.writeFileSync(f.npmCli, 'process.exit(7);');
    const failed = f.run();
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /exit 7/);
    assert.equal(fs.existsSync(path.join(f.root, '.local/offline-install.lock')), false);
  } finally { cleanup(f.root); }
});

test('archive errors and concurrent installers fail before npm can remove dependencies', windowsOnly, () => {
  const f = installerFixture();
  try {
    fs.mkdirSync(path.join(f.root, '.local'));
    fs.writeFileSync(path.join(f.root, '.local/offline-install.lock'), 'existing installer');
    assert.match(f.run().stderr, /already running or was interrupted/);
    assert.equal(fs.readFileSync(path.join(f.root, '.local/offline-install.lock'), 'utf8'), 'existing installer');
    fs.unlinkSync(path.join(f.root, '.local/offline-install.lock'));
    fs.writeFileSync(path.join(f.directory, f.record.file), 'corrupt');
    assert.match(f.run().stderr, /integrity mismatch/);
    assert.equal(fs.existsSync(path.join(f.root, 'npm-invocation.json')), false);
  } finally { cleanup(f.root); }
});

async function startFixtureApp(root, command, driveRelative = false) {
  const cli = path.join(root, 'node_modules/next/dist/bin/next');
  const worker = path.join(root, 'node_modules/next/dist/server/lib/start-server.js');
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.mkdirSync(path.dirname(worker), { recursive: true });
  fs.writeFileSync(worker, `process.send('ready'); setInterval(() => {}, 1000);`);
  fs.writeFileSync(cli, `const child = require('node:child_process').fork(${JSON.stringify(worker)}, [], {windowsHide: true}); child.once('message', () => console.log(JSON.stringify({worker: child.pid}))); setInterval(() => {}, 1000);`);
  const entry = driveRelative ? path.parse(root).root.slice(0, 2) + 'node_modules\\next\\dist\\bin\\next' : cli;
  const child = spawn(process.execPath, [entry, command], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '';
  const workerId = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Fixture server failed to start: ' + output)); }, 10000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.includes('\n')) { clearTimeout(timeout); resolve(JSON.parse(output.trim()).worker); }
    });
  });
  return { child, workerId, stop() { child.kill(); try { process.kill(workerId); } catch (error) { if (error.code !== 'ESRCH') throw error; } } };
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } }

test('installer stops checkout dev/start processes and workers while preserving a neighboring checkout', windowsOnly, async () => {
  const f = installerFixture();
  const sibling = f.root + '-neighbor with [spaces]';
  let dev, production, neighbor, relativeNeighbor;
  try {
    dev = await startFixtureApp(f.root, 'dev');
    production = await startFixtureApp(f.root, 'start');
    neighbor = await startFixtureApp(sibling, 'dev');
    relativeNeighbor = await startFixtureApp(sibling, 'dev', true);
    const result = f.run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const app of [dev, production]) {
      assert.equal(alive(app.child.pid), false);
      assert.equal(alive(app.workerId), false);
    }
    assert.equal(alive(neighbor.child.pid), true);
    assert.equal(alive(neighbor.workerId), true);
    assert.equal(alive(relativeNeighbor.child.pid), true);
    assert.equal(alive(relativeNeighbor.workerId), true);
    assert.ok(fs.existsSync(path.join(f.root, 'npm-invocation.json')));
  } finally {
    dev?.stop(); production?.stop(); neighbor?.stop(); relativeNeighbor?.stop();
    await new Promise(resolve => setTimeout(resolve, 100));
    cleanup(f.root); if (fs.existsSync(sibling)) cleanup(sibling);
  }
});

test('active checkout compilation blocks installation before servers are stopped', windowsOnly, async () => {
  const f = installerFixture();
  let build, dev;
  try {
    build = await startFixtureApp(f.root, 'build');
    dev = await startFixtureApp(f.root, 'dev');
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /build is active/);
    assert.equal(alive(build.child.pid), true);
    assert.equal(alive(dev.child.pid), true);
    assert.equal(fs.existsSync(path.join(f.root, 'npm-invocation.json')), false);
    assert.equal(fs.existsSync(path.join(f.root, '.local/offline-install.lock')), false);
  } finally {
    build?.stop(); dev?.stop();
    await new Promise(resolve => setTimeout(resolve, 100));
    cleanup(f.root);
  }
});

test('both providers reject launcher calls while an installation lock exists', () => {
  const f = fixture();
  try {
    const scripts = path.join(f.root, 'scripts');
    fs.mkdirSync(scripts);
    for (const name of ['run-app.mjs', 'offline-dependencies.mjs']) fs.copyFileSync(path.resolve('scripts', name), path.join(scripts, name));
    fs.writeFileSync(path.join(scripts, 'setup-json-store.mjs'), `import { fileURLToPath } from 'node:url'; export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url)); export function initializeJsonStore() { throw new Error('Must not initialize storage'); }`);
    fs.mkdirSync(path.join(f.root, '.local'));
    fs.writeFileSync(path.join(f.root, '.local/offline-install.lock'), 'install in progress');
    for (const mode of ['sql', 'nosql']) for (const command of ['dev', 'start', 'build']) {
      const result = spawnSync(process.execPath, [path.join(scripts, 'run-app.mjs'), command, mode], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /offline installation is in progress/);
      assert.doesNotMatch(result.stderr, /Next.js is missing|Must not initialize/);
    }
  } finally { cleanup(f.root); }
});
