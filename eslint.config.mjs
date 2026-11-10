import nextVitals from 'eslint-config-next/core-web-vitals';

// Preserve the React 18 policy from next/core-web-vitals 14. This application
// does not use React Compiler; adopting its additional diagnostics is a
// separate application migration, not part of replacing deprecated tooling.
const hooksRules = new Set(['react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps']);
const config = nextVitals.map(entry => {
  if (entry.name === 'next') {
    return {
      ...entry,
      rules: Object.fromEntries(Object.entries(entry.rules).filter(([name]) => !name.startsWith('react-hooks/') || hooksRules.has(name)))
    };
  }
  if (entry.name === 'next/typescript') return { ...entry, files: ['**/*.{ts,tsx,mts,cts}'] };
  return entry;
});

export default [
  ...config,
  { ignores: ['.next-sql/**', '.next-nosql/**', '.local/**', 'NoSQL/data/**', 'vendor/**', 'coverage/**', 'output/**'] }
];
