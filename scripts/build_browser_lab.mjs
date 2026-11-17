/** Build the original TSAAT screens against browser-only adapters. No server is shipped. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceIndex = process.argv.indexOf('--app-source');
const source = path.resolve(sourceIndex >= 0 ? process.argv[sourceIndex + 1] : path.join(root, '../DSMR_TSAAT'));
const browser = path.join(root, 'practice-lab/browser');
const requireApp = createRequire(path.join(source, 'package.json'));
const { build, transform } = requireApp('esbuild');
const postcss = requireApp('postcss'), tailwind = requireApp('tailwindcss');
const JSZip = createRequire(import.meta.url)('../vendor/jszip/jszip.min.js');
const read = file => fs.readFile(file, 'utf8');
const normalize = file => file.replaceAll('\\', '/');
const substitutions = {
  '@/lib/data-loader': path.join(browser, 'provider.ts'),
  '@/lib/cmdb-attribute-loader': path.join(source, 'lib/json-store/cmdb-attributes.ts'),
  '@/lib/route-loading': path.join(browser, 'route-loading.ts'),
  'next/navigation': path.join(browser, 'navigation.tsx'),
  'next/link': path.join(browser, 'navigation.tsx'),
  'next/image': path.join(browser, 'image.tsx'),
  'next/server': path.join(browser, 'server.ts'),
  'server-only': path.join(browser, 'empty.ts')
};
async function resolveSource(file) {
  for (const candidate of [file, file + '.ts', file + '.tsx', file + '.mjs', file + '.js']) {
    try { if ((await fs.stat(candidate)).isFile()) return candidate; } catch {}
  }
  throw Error('Cannot resolve application source: ' + file);
}
function replaceRequired(text, before, after, file) {
  if (!text.includes(before)) throw Error('Browser compatibility adapter needs review: ' + file + ' / ' + before);
  return text.replaceAll(before, after);
}
const plugin = {
  name: 'self-contained-practice',
  setup(builder) {
    builder.onResolve({ filter: /^(?:@\/|next\/|server-only$|node:)/ }, async args => {
      if (substitutions[args.path]) return { path: substitutions[args.path] };
      if (args.path.startsWith('@/')) return { path: await resolveSource(path.join(source, args.path.slice(2))) };
      if (args.path === 'node:perf_hooks') return { path: 'perf', namespace: 'browser-perf' };
      throw Error('Unexpected server dependency in browser bundle: ' + args.path);
    });
    builder.onLoad({ filter: /.*/, namespace: 'browser-perf' }, () => ({ contents: 'export const performance = globalThis.performance;' }));
    builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async args => {
      const relative = normalize(path.relative(source, args.path));
      if (relative.startsWith('..') || relative.startsWith('node_modules/')) return;
      const adapters = { 'lib/json-store/files.ts': 'store.ts', 'lib/json-store/persona-settings.ts': 'personas.ts' };
      if (adapters[relative]) return { contents: await read(path.join(browser, adapters[relative])), loader: 'ts', resolveDir: browser };
      let contents = await read(args.path);
      const swap = (before, after) => { contents = replaceRequired(contents, before, after, relative); };
      if (relative === 'lib/server-cache.ts') swap('Buffer.byteLength(JSON.stringify(value) ?? "", "utf8")', 'new TextEncoder().encode(JSON.stringify(value) ?? "").byteLength');
      if (relative === 'lib/browser-location.ts') swap('new URL(location.hash.slice(1), location.href)', 'new URL(location.hash.slice(1), "https://tsaat.practice.invalid")');
      if (relative === 'components/persona-provider.tsx') {
        swap('window.localStorage', 'practiceStorage');
        contents += '\nconst practiceStorage = { getItem: (_key: string) => (window as any).__practicePersona ?? null, setItem: (_key: string, value: string) => { (window as any).__practicePersona = value; }, removeItem: (_key: string) => { (window as any).__practicePersona = null; } };\n';
      }
      if (relative === 'components/workspace-shell.tsx') {
        swap('useState, type ReactNode', 'useEffect, useState, type ReactNode');
        swap('const [collapsed, setCollapsed] = useState(false);', `const [collapsed, setCollapsed] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => { const media = window.matchMedia("(max-width: 760px)"); const change = () => setCollapsed(media.matches); media.addEventListener("change", change); return () => media.removeEventListener("change", change); }, []);`);
        swap('if (!hasScope && window.matchMedia("(max-width: 760px)").matches)', 'if (window.matchMedia("(max-width: 760px)").matches)');
      }
      if (relative === 'components/topology-explorer.tsx') {
        swap('new URLSearchParams(window.location.search)', 'new URL(window.location.hash.slice(1), "https://tsaat.practice.invalid").searchParams');
        swap('`${window.location.pathname}?${query}`', '`#${window.location.hash.slice(1).split("?")[0]}?${query}`');
      }
      if (relative === 'components/cmdb-drill-through.tsx') {
        swap('window.location.assign(topologyHref)', '(window.history.pushState(null, "", "#" + topologyHref), window.dispatchEvent(new HashChangeEvent("hashchange")))');
        swap('<a href={row.href} target="_blank" rel="noreferrer" className="cmdb-record-link">{row.value}</a>', '<button type="button" disabled className="cmdb-record-link" title="Unavailable in the practice lab">{row.value}</button>');
      }
      if (relative === 'lib/documents/client.ts') {
        swap('new URL("./document.worker.ts", import.meta.url)', '(window as any).__practiceWorkerUrl');
        swap('{ type: "module" }', '{ name: "tsaat-practice-documents" }');
        swap('new URL("/", window.location.href).href', '"https://tsaat.practice.invalid/"');
        swap('new URL(url, window.location.href)', 'new URL(url, "https://tsaat.practice.invalid/")');
        swap('source.origin !== window.location.origin', 'source.origin !== "https://tsaat.practice.invalid"');
        swap('worker.postMessage({ id: task.id, job, assetBaseUrl:', 'worker.postMessage({ id: task.id, job, assets: (window as any).__practiceAssets, assetBaseUrl:');
      }
      return { contents, loader: args.path.endsWith('.tsx') ? 'tsx' : args.path.endsWith('.ts') ? 'ts' : 'js' };
    });
  }
};

const config = {
  absWorkingDir: source, bundle: true, write: false, minify: true, format: 'iife', platform: 'browser',
  target: ['chrome110', 'firefox115', 'safari16'], jsx: 'automatic', legalComments: 'inline', metafile: true,
  nodePaths: [path.join(source, 'node_modules')], plugins: [plugin],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_TSAAT_DATA_PROVIDER': '"json"',
    'process.env.TSAAT_PERF_DEBUG': '"0"', 'process.env.TSAAT_CACHE_DEBUG': '"0"' }
};
await fs.mkdir(path.join(root, 'build'), { recursive: true });
const stage = await fs.mkdtemp(path.join(root, 'build/browser-lab-'));
try {
  const { initializeJsonStore } = await import(pathToFileURL(path.join(source, 'scripts/setup-json-store.mjs')));
  await initializeJsonStore({ target: path.join(stage, 'data'), sourceRoot: source });
  const zip = new JSZip(), evidence = [];
  async function addFiles(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) await addFiles(file);
      else {
        const bytes = await fs.readFile(file), name = normalize(path.relative(path.join(stage, 'data'), file));
        zip.file(name, bytes, { date: new Date('2026-01-01T00:00:00Z') });
        evidence.push({ file: name, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
    }
  }
  await addFiles(path.join(stage, 'data'));
  const manifest = JSON.parse(await read(path.join(stage, 'data/store.json')));
  if (manifest.snapshots.length !== 8 || manifest.sampleDataProfile !== 'tsaat-aligned-evidence-v1') throw Error('Expected the complete eight-week sample evidence.');
  const data = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const assets = {};
  for (const filename of ['tsaat-logo.png', 'endpoint-evidence.svg', 'software-terrain.svg', 'vulnerability-evidence.svg', 'insights-report-art/endpoint-evidence.png', 'insights-report-art/software-terrain.png', 'insights-report-art/vulnerability-evidence.png']) {
    assets['/' + filename] = 'data:' + (filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png') + ';base64,' + (await fs.readFile(path.join(source, 'public', filename))).toString('base64');
  }
  const [app, worker] = await Promise.all([
    build({ ...config, entryPoints: [path.join(browser, 'app.tsx')] }),
    build({ ...config, entryPoints: [path.join(source, 'lib/documents/document.worker.ts')] })
  ]);
  const inputs = [...new Set([...Object.keys(app.metafile.inputs), ...Object.keys(worker.metafile.inputs)])].sort();
  const dependencies = inputs.filter(file => file.startsWith('node_modules/'));
  const packageRoots = [...new Set(dependencies.map(file => file.match(/^node_modules\/(?:@[^/]+\/)?[^/]+/)[0]))].sort();
  const notices = ['TSAAT browser practice lab — third-party notices', await read(path.join(root, 'vendor/jszip/LICENSE.markdown'))];
  for (const directory of packageRoots) {
    const metadata = JSON.parse(await read(path.join(source, directory, 'package.json')));
    const licenses = (await fs.readdir(path.join(source, directory))).filter(name => /^(?:licen[cs]e|copying)(?:\.|$)/i.test(name));
    notices.push('\n' + metadata.name + ' ' + metadata.version + ' (' + (metadata.license ?? 'see package notice') + ')');
    for (const filename of licenses) if ((await fs.stat(path.join(source, directory, filename))).isFile()) notices.push(await read(path.join(source, directory, filename)));
  }
  await fs.writeFile(path.join(root, 'practice-lab/THIRD-PARTY-NOTICES.txt'), notices.join('\n\n'));
  const tailwindCode = (await transform(await read(path.join(source, 'tailwind.config.ts')), { loader: 'ts', format: 'cjs' })).code;
  const module = { exports: {} }; new Function('module', 'exports', tailwindCode)(module, module.exports);
  const tw = module.exports.default;
  tw.content = [...tw.content.map(glob => normalize(path.join(source, glob))), normalize(path.join(browser, '**/*.{ts,tsx}'))];
  const background = 'data:image/svg+xml;base64,' + (await fs.readFile(path.join(source, 'public/bg-topography.svg'))).toString('base64');
  const css = (await postcss([tailwind(tw)]).process(await read(path.join(source, 'app/globals.css')), { from: path.join(source, 'app/globals.css') })).css.replaceAll('/bg-topography.svg', background) + '\n' + await read(path.join(browser, 'practice.css'));
  const workerPrelude = `let assets={};self.addEventListener("message",event=>{assets=event.data.assets||{}});self.fetch=async input=>{const key=new URL(String(input),"https://tsaat.practice.invalid").pathname;const asset=assets[key];if(!asset)throw Error("Missing bundled report artwork");return new Response(Uint8Array.from(atob(asset.split(",")[1]),x=>x.charCodeAt(0)),{headers:{"Content-Type":"image/png"}})};\n`;
  const workerCode = Buffer.from(workerPrelude + worker.outputFiles[0].text).toString('base64');
  const boot = `window.__practiceAssets=${JSON.stringify(assets)};window.__practiceWorkerUrl=URL.createObjectURL(new Blob([Uint8Array.from(atob(${JSON.stringify(workerCode)}),x=>x.charCodeAt(0))],{type:"text/javascript"}));`;
  const escapeScript = value => value.replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html>\n<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; worker-src blob:; connect-src 'none'; font-src data:; base-uri 'none'; form-action 'none'"><title>TSAAT Practice Lab</title><link rel="icon" href="${assets['/tsaat-logo.png']}"><style>${css}</style></head><body class="font-['Segoe_UI','Trebuchet_MS','Arial',sans-serif] antialiased"><div id="practice-root"><p role="status">Opening TSAAT practice lab…</p></div><noscript>Enable JavaScript to run the practice lab.</noscript><script id="practice-launch" type="application/json">null</script><script id="practice-data" type="application/octet-stream">${data}</script><script type="text/plain" id="third-party-notices">${escapeScript(notices.join('\n\n'))}</script><script>${escapeScript(await read(path.join(root, 'vendor/jszip/jszip.min.js')))}</script><script>${escapeScript(boot + '\n' + app.outputFiles[0].text)}</script></body></html>\n`;
  await fs.writeFile(path.join(root, 'guide/TSAAT-Practice-Lab.html'), html);
  if (inputs.some(file => /(?:sql-data-loader|db-config)\.ts$/.test(file))) throw Error('Unexpected server provider bundled.');
  const sourceFiles = await Promise.all(inputs.filter(file => !file.startsWith('node_modules/')).map(async file => ({
    file: normalize(file), sha256: createHash('sha256').update(await fs.readFile(path.resolve(source, file))).digest('hex')
  })));
  const buildInputPaths = [fileURLToPath(import.meta.url), ...((await fs.readdir(browser)).map(file => path.join(browser, file))),
    ...['app/globals.css', 'tailwind.config.ts', 'package-lock.json', 'scripts/setup-json-store.mjs', 'public/bg-topography.svg', ...Object.keys(assets).map(file => 'public' + file)].map(file => path.join(source, file))];
  const buildInputs = await Promise.all(buildInputPaths.map(async file => ({file: normalize(path.relative(root, file)), sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')})));
  let commit = 'unavailable'; try { commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
  await fs.writeFile(path.join(root, 'practice-lab/source-manifest.json'), JSON.stringify({ source: 'DSMR_TSAAT', commit,
    snapshots: manifest.snapshots.map(({ id, date }) => ({ id, date })), evidence, sourceFiles, buildInputs, dependencies,
    htmlSha256: createHash('sha256').update(html).digest('hex') }, null, 2) + '\n');
  console.log(`Built self-contained practice app: ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MiB; ${manifest.snapshots.length} snapshots; ${inputs.length} bundled modules.`);
} finally {
  // Only this build's verified temporary child may be removed.
  if (path.dirname(stage) !== path.join(root, 'build') || !path.basename(stage).startsWith('browser-lab-')) throw Error('Unsafe build cleanup path.');
  await fs.rm(stage, { recursive: true, force: true });
}
