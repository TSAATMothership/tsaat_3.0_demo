import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const root = process.cwd();
function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [path.join(directory, entry.name)] : []);
}
function runtimeImports(file: string) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true), imports: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (clause?.isTypeOnly) return;
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && !clause.name && clause.namedBindings.elements.every(element => element.isTypeOnly)) return;
      imports.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some(element => !element.isTypeOnly)) imports.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require") && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return { imports, client: /^\s*["']use client["']/.test(source.text), text: source.text };
}
function localFile(importer: string, specifier: string) {
  const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : specifier.startsWith(".") ? path.resolve(path.dirname(importer), specifier) : null;
  if (!base) return null;
  return [base, ...[".ts", ".tsx", ".mjs", ".js", ".cjs"].flatMap(extension => [base + extension, path.join(base, "index" + extension)])]
    .find(file => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
}

it("keeps PDF and Excel construction outside every server page and API import graph", () => {
  const pending = files(path.join(root, "app")), seen = new Set<string>(), failures: string[] = [];
  while (pending.length) {
    const file = pending.pop()!; if (seen.has(file)) continue; seen.add(file);
    const { imports, client, text } = runtimeImports(file); if (client) continue;
    if (/PDFDocument\.create\(|\.embedFont\(|writeXlsxEntries\(|build\w*Workbook\(/.test(text)) failures.push(path.relative(root, file));
    for (const specifier of imports) {
      if (specifier === "pdf-lib") failures.push(path.relative(root, file) + " -> pdf-lib");
      const local = localFile(file, specifier); if (local) pending.push(local);
    }
  }
  expect(failures).toEqual([]);
});

it("keeps filesystem, SQL/JSON providers and Node binary APIs outside the browser worker", () => {
  const pending = [path.join(root, "lib/documents/document.worker.ts")], seen = new Set<string>(), failures: string[] = [];
  while (pending.length) {
    const file = pending.pop()!; if (seen.has(file)) continue; seen.add(file);
    const { imports, text } = runtimeImports(file);
    if (/\bBuffer\.|\bprocess\.cwd\(/.test(text)) failures.push(path.relative(root, file));
    for (const specifier of imports) {
      if (/^(node:|fs(?:\/|$)|path$|zlib$|child_process$|server-only$)/.test(specifier) || /(?:^|\/)(?:sql-data-loader|data-loader|sql-server|cmdb-attribute-loader)$/.test(specifier)) failures.push(path.relative(root, file) + " -> " + specifier);
      const local = localFile(file, specifier); if (local) pending.push(local);
    }
  }
  expect(failures).toEqual([]);
});
