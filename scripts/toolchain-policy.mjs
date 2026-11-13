// Version floors are compatibility requirements; the offline archive remains integrity-pinned.
export const minimumNodeVersion = '24.13.1';
export const minimumNpmVersion = '11.8.0';
export function isVersionAtLeast(actual, minimum) {
  const parse = value => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number);
  const left = parse(actual), right = parse(minimum);
  if (!left || !right) return false; // Do not treat preview builds as stable releases.
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}
