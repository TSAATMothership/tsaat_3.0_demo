// Build-only preload inherited by Node children/workers. Runtime networking is unchanged.
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
function deny(operation) {
  return function () {
    const message = `Offline compilation forbids network access: ${operation}`;
    if (process.env.TSAAT_OFFLINE_ATTEMPTS) fs.appendFileSync(process.env.TSAAT_OFFLINE_ATTEMPTS, message + '\n');
    throw new Error(message);
  };
}
for (const [moduleName, names] of [
  ['node:http', ['request', 'get']], ['node:https', ['request', 'get']],
  ['node:tls', ['connect']], ['node:http2', ['connect']],
  ['node:dns', ['lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse']],
  ['node:dns/promises', ['lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse']]
]) {
  const api = require(moduleName);
  for (const name of names) {
    api[name] = deny(`${moduleName}.${name}`);
    if (api.Resolver?.prototype[name]) api.Resolver.prototype[name] = deny(`${moduleName}.Resolver.${name}`);
  }
}
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const pipe = typeof options === 'string' ? options : options?.path;
  // Local IPC is allowed; TCP (including loopback), DNS and HTTP are not.
  if (typeof pipe === 'string' && (pipe.startsWith('\\\\.\\pipe\\') || pipe.startsWith('/'))) return connect.apply(this, args);
  return deny('net.Socket.connect')();
};
const dgram = require('node:dgram');
for (const name of ['connect', 'send']) dgram.Socket.prototype[name] = deny(`dgram.Socket.${name}`);
globalThis.fetch = deny('fetch');
if (globalThis.WebSocket) globalThis.WebSocket = deny('WebSocket');
syncBuiltinESMExports();
