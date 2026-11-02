import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { build, transform } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const json = file => JSON.parse(read(file));
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(dir + "/" + entry.name) : [dir + "/" + entry.name]);

export function packageReferences() {
  const refs = Object.fromEntries(walk("Database Schema/data").filter(f => f.endsWith(".json")).map(f => [path.basename(f, ".json"), json(f)]));
  const rules = refs["spi-rule-definitions"].rules;
  const calculations = refs["spi-sql-calculations"];
  refs["spi-definitions"] = refs["spi-definitions"].spis.map(spi => {
    const rule = rules.find(r => r.ruleKey === spi.ruleKey);
    const calc = calculations.calculations.find(c => c.ruleKey === spi.ruleKey);
    return { ...spi, ruleDefinition: rule, parameterDefinitions: rule.parameters, outcomeTemplates: rule.outcomes,
      calculationDefinition: { ...calc, source: calculations.calculationSources.find(s => s.sourceKey === calc.sourceKey) },
      reportDetailDefinition: refs["spi-report-detail-definitions"].reportDetails.find(d => d.reportDetailKey === spi.reportDetailKey),
      classificationRules: refs["spi-finding-classification-rules"].classificationRules,
      featureBindings: calculations.featureBindings.filter(b => b.spiId === spi.spiId) };
  });
  const tasking = refs["kpi-tasking"], report = refs["kpi-report-detail-definitions"];
  refs["kpi-definitions"] = refs["kpi-definitions"].kpis.map(kpi => {
    const task = tasking.kpis.find(t => t.id === kpi.id);
    return { ...kpi, taskingTeams: [...(task?.teams ?? []), ...tasking.baseTeams], taskingActions: task?.actions ?? [],
      taskingConditions: tasking.conditionTemplates, calculationDefinition: refs["kpi-calculations"].calculations.find(c => c.calculationKey === kpi.calculationKey),
      reportDetailDefinition: report.reportDetails.find(d => d.reportDetailKey === report.bindings.find(b => b.kpiId === kpi.id)?.reportDetailKey) };
  });
  refs["finding-priorities"] = calculations.findingPriorities;
  refs["cmdb-attributes"] = json("Demo/data/cmdb-attributes.json");
  return refs;
}
export function createDemoPackage() {
  const files = walk("data/snapshots").filter(f => /^week-\d+\.json$/.test(path.basename(f))).sort();
  return { references: packageReferences(), snapshots: files.map(file => {
    const dataset = json(file);
    if (!dataset.assets?.length || !dataset.ictSystems?.length || !dataset.managedNetworks?.length || !dataset.findings?.length) {
      throw new Error(file + ": demo snapshots require assets, systems, networks and persisted findings.");
    }
    const assets = new Set(dataset.assets.map(asset => asset.id));
    if (assets.size !== dataset.assets.length || dataset.findings.some(finding => !assets.has(finding.scope.assetId))) {
      throw new Error(file + ": duplicate assets or findings referencing missing assets.");
    }
    return { date: dataset.snapshotDate, json: gzipSync(JSON.stringify(dataset), { level: 9 }).toString("base64") };
  }), template: fs.readFileSync(path.join(root, "data/templates/network-target-state-template.xlsx")).toString("base64"),
    logo: "data:image/png;base64," + fs.readFileSync(path.join(root, "public/tsaat-logo.png")).toString("base64") };
}
function apiRegistry() {
  const routes = walk("app/api").filter(file => file.endsWith("/route.ts") && !/^app\/api\/(auth\/|settings\/)/.test(file));
  const imports = [], cases = [];
  routes.forEach((file, index) => {
    imports.push('import * as route' + index + ' from "' + path.join(root, file).replaceAll("\\", "/") + '";');
    const names = [...file.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
    const route = file.replace(/^app/, "").replace(/\/route\.ts$/, "").replace(/\[[^\]]+\]/g, "([^/]+)");
    const methods = [...read(file).matchAll(/export async function (GET|POST|PUT|DELETE|PATCH)\s*\(([^)]*)\)/g)];
    const handlers = methods.map(m => {
      const count = m[2].trim() ? m[2].includes("context") || m[2].includes("params") ? 2 : 1 : 0;
      const args = count === 2 ? "request, {params:" + JSON.stringify(Object.fromEntries(names.map((name, i) => [name, "MATCH" + (i + 1)]))).replace(/"MATCH(\d+)"/g, "decodeURIComponent(match[$1])") + "}" : count ? "request" : "";
      return 'if(request.method === "' + m[1] + '") return route' + index + "." + m[1] + "(" + args + ");";
    }).join("\n");
    cases.push('match = url.pathname.match(/^' + route.replaceAll("/", "\\/") + '$/); if(match) { ' + handlers + ' return new Response("Method not supported", {status:405}); }');
  });
  return imports.join("\n") + '\nexport async function dispatch(request) { const url = new URL(request.url); let match; try {' + cases.join("\n") +
    '} catch(error) { console.error(error); return Response.json({error:String(error)}, {status:500}); } return Response.json({error:"Endpoint unavailable in offline demo: "+url.pathname},{status:404}); }';
}
export async function buildDemo({ check = false } = {}) {
  const implemented = new Set([...read("Demo/src/main.tsx").matchAll(/\["(\/[^"?]+)", \w+\]/g)].map(match => match[1]));
  const required = [...read("lib/workspace-navigation.ts").matchAll(/href: "(\/[^"?]+)(?:\?[^"]*)?"/g)].map(match => match[1]);
  for (const route of required) if (!implemented.has(route)) throw new Error("Add the new workspace page to the demo: " + route);
  const contract = json("Demo/data/calculation-contract.json");
  for (const [file, expected] of Object.entries(contract.files)) {
    const digest = createHash("sha256").update(read(file).replace(/\r\n/g, "\n")).digest("hex");
    if (digest !== expected) throw new Error(file + ": review demo evaluator/mapping parity and tests before updating the calculation contract.");
  }
  const worker = await build({ absWorkingDir: root, entryPoints: ["components/ict-system-impact-analyser-2-worker.ts"], bundle: true, write: false, minify: true, format: "iife", platform: "browser", target: "es2022" });
  const aliases = {
    "@/lib/data-loader": "Demo/src/data-loader.ts",
    "@/lib/cmdb-attribute-loader": "Demo/src/cmdb-attributes.ts",
    "@/components/settings-popup": "Demo/src/settings-popup.tsx",
    "next/navigation": "Demo/src/navigation.tsx", "next/link": "Demo/src/navigation.tsx",
    "next/server": "Demo/src/server.ts", "server-only": "Demo/src/empty.ts",
    "fs/promises": "Demo/src/platform.ts", "path": "Demo/src/platform.ts", "zlib": "Demo/src/platform.ts",
    "node:perf_hooks": "Demo/src/platform.ts"
  };
  const plugin = { name: "offline-adapters", setup(context) {
    context.onResolve({ filter: /^demo:api$/ }, () => ({ path: "demo:api", namespace: "demo" }));
    context.onLoad({ filter: /.*/, namespace: "demo" }, () => ({ contents: apiRegistry(), loader: "js", resolveDir: root }));
    context.onResolve({ filter: /.*/ }, args => aliases[args.path] ? { path: path.join(root, aliases[args.path]) } : undefined);
    context.onLoad({ filter: /ict-system-impact-analyser-2\.tsx$/ }, args => ({
      contents: fs.readFileSync(args.path, "utf8").replace('new URL("./ict-system-impact-analyser-2-worker.ts", import.meta.url)', 'URL.createObjectURL(new Blob([__DEMO_WORKER__], {type: "text/javascript"}))'),
      loader: "tsx"
    }));
  }};
  const result = await build({
    absWorkingDir: root, entryPoints: ["Demo/src/main.tsx"], bundle: true, write: false, minify: true, format: "iife", platform: "browser",
    target: "es2022", jsx: "automatic", plugins: [plugin], inject: [path.join(root, "Demo/src/buffer.js")],
    define: { __dirname: '""', "process.env.NODE_ENV": '"production"', "process.env": "{}", "process.cwd": 'demoCwd', __DEMO_WORKER__: JSON.stringify(worker.outputFiles[0].text) },
    metafile: true, legalComments: "inline"
  });
  const configJs = (await transform(read("tailwind.config.ts"), { loader: "ts", format: "esm" })).code;
  const config = (await import("data:text/javascript;base64," + Buffer.from(configJs).toString("base64"))).default;
  config.content = ["app", "components", "lib", "Demo/src"].map(dir => path.join(root, dir, "**/*.{js,ts,jsx,tsx}").replaceAll("\\", "/"));
  let css = (await postcss([tailwindcss(config), autoprefixer]).process(read("app/globals.css") + "\n" + read("Demo/src/demo.css"), { from: path.join(root, "app/globals.css") })).css;
  css = css.replace(/url\(["']?(\/[^"')]+)["']?\)/g, (_, url) => {
    const file = path.join(root, "public", url);
    if (!fs.existsSync(file)) throw new Error("Missing offline CSS asset " + url);
    const mime = file.endsWith(".svg") ? "image/svg+xml" : file.endsWith(".png") ? "image/png" : "image/jpeg";
    return "url(data:" + mime + ";base64," + fs.readFileSync(file).toString("base64") + ")";
  });
  const packaged = createDemoPackage();
  const inputs = [...new Set([...Object.keys(result.metafile.inputs).filter(f => !f.startsWith("demo:") && !f.startsWith("<") && !f.startsWith("node_modules/")),
    ...walk("Demo/src"), ...walk("Demo/data"), ...walk("data/snapshots"), ...walk("Database Schema/data"),
    "scripts/build-demo.mjs", "app/globals.css", "tailwind.config.ts", "package.json", "package-lock.json", "data/templates/network-target-state-template.xlsx", "public/tsaat-logo.png"])].sort();
  const hash = createHash("sha256");
  for (const input of inputs) { hash.update(input.replaceAll("\\", "/")); const bytes = fs.readFileSync(path.join(root, input)); hash.update(/\.(ts|tsx|js|mjs|json|css)$/.test(input) ? bytes.toString("utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n") : bytes); }
  const fingerprint = hash.digest("hex");
  const html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>TSAAT · Offline Demo</title><style>' + css.replaceAll("</style", "<\\/style") +
    '</style></head><body><div id="root"><p style="padding:24px">Loading TSAAT offline demo…</p></div><noscript>Enable JavaScript to run this demo.</noscript><script type="application/json" id="demo-data">' +
    JSON.stringify(packaged).replaceAll("<", "\\u003c") + '</script><script>' + result.outputFiles[0].text.replaceAll("</script", "<\\/script") + '</script></body></html>\n';
  const manifest = JSON.stringify({ schemaVersion: 1, sourceFingerprint: fingerprint, snapshotDates: packaged.snapshots.map(s => s.date),
    pageRoutes: ["/measures", "/findings", "/discovery-coverage", "/network-risk-profile", "/ict-system-risk-profile", "/cyber-cop", "/report", "/settings"],
    sourceFiles: inputs, bytes: Buffer.byteLength(html) }, null, 2) + "\n";
  for (const [file, value] of [["Demo/index.html", html], ["Demo/build-manifest.json", manifest]]) {
    if (check) {
      if (!fs.existsSync(path.join(root, file)) || fs.readFileSync(path.join(root, file), "utf8") !== value) throw new Error(file + " is stale. Run npm run demo:build and commit the refreshed demo.");
    } else fs.writeFileSync(path.join(root, file), value);
  }
  console.log("Standalone demo " + (check ? "verified" : "built") + ": " + (Buffer.byteLength(html) / 1024 / 1024).toFixed(1) + " MiB; " + packaged.snapshots.length + " JSON snapshots.");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildDemo({ check: process.argv.includes("--check") });
}
