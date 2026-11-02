import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runtimeReachability } from '../scripts/runtime-reachability.mjs';

test('reachability preserves aliases, workers, API routes and script helpers while rejecting test-only cycles', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsaat-reachability-'));
  try {
    const files = {
      'app/page.tsx': 'import "@/components/current";',
      'app/api/compat/route.ts': 'import "@/lib/api";',
      'components/current.tsx': 'new Worker(new URL("./worker.ts", import.meta.url));',
      'components/worker.ts': 'import("@/lib/worker-helper");',
      'lib/worker-helper.ts': 'export const value = 1;',
      'lib/api.ts': 'export const value = 1;',
      'scripts/maintain.mjs': 'import "../lib/maintenance";',
      'lib/maintenance.ts': 'export const value = 1;',
      'tests/old.test.ts': 'import "@/components/retired";',
      'components/retired.tsx': 'import "@/lib/retired";',
      'lib/retired.ts': 'import "@/components/retired";'
    };
    for (const [name, source] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      fs.writeFileSync(path.join(root, name), source);
    }
    assert.deepEqual(runtimeReachability(root).unused, ['components/retired.tsx', 'lib/retired.ts']);
  } finally {
    const absolute = fs.realpathSync(root);
    assert.ok(absolute.startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
    assert.ok(path.basename(absolute).startsWith('tsaat-reachability-'));
    fs.rmSync(absolute, { recursive: true });
  }
});
