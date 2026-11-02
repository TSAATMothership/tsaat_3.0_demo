import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Every App Router file, middleware and maintenance script is an entry point.
// Treat local string literals conservatively as edges, including dynamic imports
// and new Worker(new URL(..., import.meta.url)). Tests cannot keep dead UI alive.
export function runtimeReachability(root = process.cwd()) {
  const files = [];
  function walk(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) walk(name);
      else if (/\.(?:[cm]?js|jsx|ts|tsx)$/.test(name)) files.push(name);
    }
  }
  for (const directory of ['app', 'components', 'lib', 'scripts']) walk(directory);
  if (fs.existsSync(path.join(root, 'middleware.ts'))) files.push('middleware.ts');
  const known = new Set(files);
  const edges = new Map();
  for (const file of files) {
    const targets = new Set();
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isStringLiteralLike(node)) {
        const value = node.text;
        const base = value.startsWith('@/') ? value.slice(2)
          : value.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), value)) : null;
        if (base) {
          const resolved = [base, ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].flatMap(extension => [base + extension, base + '/index' + extension])].find(candidate => known.has(candidate));
          if (resolved) targets.add(resolved);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    edges.set(file, targets);
  }
  const roots = files.filter(file => file.startsWith('app/') || file.startsWith('scripts/') || file === 'middleware.ts');
  const reachable = new Set();
  function trace(file) {
    if (reachable.has(file)) return;
    reachable.add(file);
    for (const dependency of edges.get(file) ?? []) trace(dependency);
  }
  roots.forEach(trace);
  return { roots, reachable: [...reachable].sort(), unused: files.filter(file => !reachable.has(file)).sort() };
}
