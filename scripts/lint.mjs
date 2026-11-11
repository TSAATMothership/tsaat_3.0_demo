import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'node_modules/eslint/bin/eslint.js');
if (!fs.existsSync(cli)) {
  console.error('ESLint is missing or incomplete. Run npm run install:offline from the repository root.');
  process.exitCode = 1;
} else {
  // Preserve the existing application's next lint directories. Declarations
  // and native TypeScript modules remain covered by the flat configuration.
  const result = spawnSync(process.execPath, [cli, 'app', 'components', 'lib', ...process.argv.slice(2)], {
    cwd: root, stdio: 'inherit', env: process.env, windowsHide: true
  });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
