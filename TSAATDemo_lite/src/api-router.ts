import * as cyberImpact from "@/app/api/cyber-cop/impact-analyser-2/route";
import * as cyberImpactFindings from "@/app/api/cyber-cop/impact-analyser-2/findings/route";
import * as discoveryNetworkReport from "@/app/api/discovery-coverage/network-report/route";
import * as discoveryRemediationReport from "@/app/api/discovery-coverage/remediation-report/route";
import * as discoveryTargetTemplate from "@/app/api/discovery-coverage/target-state-template/route";
import * as discoveryToolAssets from "@/app/api/discovery-coverage/tool-assets/route";
import * as discoverySettings from "@/app/api/discovery-tools/settings/route";
import * as findingAssetDetails from "@/app/api/findings/asset-details/route";
import * as findingExport from "@/app/api/findings/export/route";
import * as measuresSettings from "@/app/api/measures/settings/route";
import * as networkPerformanceReport from "@/app/api/networks/performance-report/route";
import * as networkRemediationReport from "@/app/api/networks/remediation-report/route";
import * as networkDiscoveryExport from "@/app/api/networks/[networkId]/discovery-coverage-export/route";
import * as networkImpact from "@/app/api/networks/[networkId]/impact-analyser/route";
import * as networkImpactFindings from "@/app/api/networks/[networkId]/impact-analyser/findings/route";
import * as networkDetailRemediationReport from "@/app/api/networks/[networkId]/remediation-report/route";
import * as reportSummary from "@/app/api/report/summary/route";
import * as systemModellingReport from "@/app/api/systems/modelling-status-report/route";
import * as systemOutOfSupportReport from "@/app/api/systems/out-of-support-os-report/route";
import * as systemPerformanceReport from "@/app/api/systems/performance-report/route";
import * as systemRemediationReport from "@/app/api/systems/remediation-report/route";
import * as systemCoverageGapsReport from "@/app/api/systems/[systemId]/coverage-gaps-report/route";
import * as systemDiscoveryExport from "@/app/api/systems/[systemId]/discovery-coverage-export/route";
import * as systemImpact from "@/app/api/systems/[systemId]/impact-analyser/route";
import * as systemImpactFindings from "@/app/api/systems/[systemId]/impact-analyser/findings/route";
import * as systemDetailRemediationReport from "@/app/api/systems/[systemId]/remediation-report/route";
import * as taskingReport from "@/app/api/tasking-report/route";
import { authenticate, clearAuthentication, isAuthenticated } from "./auth";
import { NextRequest, NextResponse } from "./shims/next-server";

type RouteModule = Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", (...args: any[]) => Promise<Response>>>;

const staticRoutes = new Map<string, RouteModule>([
  ["/api/cyber-cop/impact-analyser-2", cyberImpact],
  ["/api/cyber-cop/impact-analyser-2/findings", cyberImpactFindings],
  ["/api/discovery-coverage/network-report", discoveryNetworkReport],
  ["/api/discovery-coverage/remediation-report", discoveryRemediationReport],
  ["/api/discovery-coverage/target-state-template", discoveryTargetTemplate],
  ["/api/discovery-coverage/tool-assets", discoveryToolAssets],
  ["/api/discovery-tools/settings", discoverySettings],
  ["/api/findings/asset-details", findingAssetDetails],
  ["/api/findings/export", findingExport],
  ["/api/measures/settings", measuresSettings],
  ["/api/networks/performance-report", networkPerformanceReport],
  ["/api/networks/remediation-report", networkRemediationReport],
  ["/api/report/summary", reportSummary],
  ["/api/systems/modelling-status-report", systemModellingReport],
  ["/api/systems/out-of-support-os-report", systemOutOfSupportReport],
  ["/api/systems/performance-report", systemPerformanceReport],
  ["/api/systems/remediation-report", systemRemediationReport],
  ["/api/tasking-report", taskingReport]
]);

interface DynamicRoute {
  pattern: RegExp;
  paramName: "networkId" | "systemId";
  module: RouteModule;
}

const dynamicRoutes: DynamicRoute[] = [
  {
    pattern: /^\/api\/networks\/([^/]+)\/discovery-coverage-export$/,
    paramName: "networkId",
    module: networkDiscoveryExport
  },
  {
    pattern: /^\/api\/networks\/([^/]+)\/impact-analyser\/findings$/,
    paramName: "networkId",
    module: networkImpactFindings
  },
  {
    pattern: /^\/api\/networks\/([^/]+)\/impact-analyser$/,
    paramName: "networkId",
    module: networkImpact
  },
  {
    pattern: /^\/api\/networks\/([^/]+)\/remediation-report$/,
    paramName: "networkId",
    module: networkDetailRemediationReport
  },
  {
    pattern: /^\/api\/systems\/([^/]+)\/coverage-gaps-report$/,
    paramName: "systemId",
    module: systemCoverageGapsReport
  },
  {
    pattern: /^\/api\/systems\/([^/]+)\/discovery-coverage-export$/,
    paramName: "systemId",
    module: systemDiscoveryExport
  },
  {
    pattern: /^\/api\/systems\/([^/]+)\/impact-analyser\/findings$/,
    paramName: "systemId",
    module: systemImpactFindings
  },
  {
    pattern: /^\/api\/systems\/([^/]+)\/impact-analyser$/,
    paramName: "systemId",
    module: systemImpact
  },
  {
    pattern: /^\/api\/systems\/([^/]+)\/remediation-report$/,
    paramName: "systemId",
    module: systemDetailRemediationReport
  }
];

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function handleAuthentication(request: NextRequest): Promise<Response | null> {
  const path = request.nextUrl.pathname;
  if (path === "/api/auth/login" && request.method === "POST") {
    try {
      const payload = (await request.json()) as Record<string, unknown>;
      const username = typeof payload.username === "string" ? payload.username.trim() : "";
      const password = typeof payload.password === "string" ? payload.password.trim() : "";
      if (!username || !password) {
        return json({ error: "Username and password are required." }, 400);
      }
      if (!authenticate(username, password)) {
        return json({ error: "Invalid username or password." }, 401);
      }
      return json({ authenticated: true, username: "demo" });
    } catch {
      return json({ error: "Login request is invalid." }, 400);
    }
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    clearAuthentication();
    return json({ authenticated: false });
  }
  if (path === "/api/auth/session" && request.method === "GET") {
    return json(isAuthenticated() ? { authenticated: true, username: "demo" } : { authenticated: false });
  }
  return null;
}

function toNextRequest(input: RequestInfo | URL, init: RequestInit = {}): NextRequest {
  const original = input instanceof Request ? input : null;
  const rawUrl = original?.url ?? input.toString();
  const url = new URL(rawUrl, "https://tsaat-demo-lite.local");
  const method = (init.method ?? original?.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers ?? original?.headers);
  const body = method === "GET" || method === "HEAD" ? undefined : (init.body ?? (original ? original.clone().body : undefined));
  return new NextRequest(url, {
    method,
    headers,
    body,
    signal: init.signal ?? original?.signal
  });
}

export async function handleApiRequest(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const request = toNextRequest(input, init);
  const authResponse = await handleAuthentication(request);
  if (authResponse) {
    return authResponse;
  }
  if (!isAuthenticated()) {
    return json({ error: "Authentication required." }, 401);
  }

  const pathname = request.nextUrl.pathname;
  let routeModule = staticRoutes.get(pathname);
  let params: Record<string, string> = {};
  if (!routeModule) {
    for (const route of dynamicRoutes) {
      const match = pathname.match(route.pattern);
      if (match) {
        routeModule = route.module;
        params = { [route.paramName]: decodeURIComponent(match[1]) };
        break;
      }
    }
  }
  if (!routeModule) {
    return json({ error: "API route not found." }, 404);
  }
  const handler = routeModule[request.method as keyof RouteModule];
  if (!handler) {
    return json({ error: "Method not allowed." }, 405);
  }
  try {
    return await handler(request, { params });
  } catch (error) {
    console.error("Offline API route failed", pathname, error);
    return json({ error: error instanceof Error ? error.message : "Offline API request failed." }, 500);
  }
}

function isApiInput(input: RequestInfo | URL): boolean {
  const raw = input instanceof Request ? input.url : input.toString();
  try {
    return new URL(raw, "https://tsaat-demo-lite.local").pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function responseFilename(response: Response, href: string): string {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1].replace(/^"|"$/g, ""));
  }
  const simpleMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (simpleMatch) {
    return simpleMatch[1];
  }
  const pathName = new URL(href, "https://tsaat-demo-lite.local").pathname.split("/").filter(Boolean).pop();
  return pathName || "tsaat-export";
}

export async function downloadApiResponse(href: string): Promise<void> {
  const response = await handleApiRequest(href, { method: "GET" });
  if (!response.ok) {
    let message = `Export failed (${response.status}).`;
    try {
      const payload = (await response.clone().json()) as { error?: string };
      message = payload.error ?? message;
    } catch {
      // Retain the status fallback.
    }
    window.alert(message);
    return;
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = responseFilename(response, href);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function installApiBridge(): void {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    return isApiInput(input) ? handleApiRequest(input, init) : nativeFetch(input, init);
  }) as typeof fetch;
  globalThis.__TSAAT_DOWNLOAD_API__ = downloadApiResponse;

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || !(event.target instanceof Element)) {
      return;
    }
    const anchor = event.target.closest("a[href]") as HTMLAnchorElement | null;
    const href = anchor?.getAttribute("href") ?? "";
    if (!anchor || !href.startsWith("/api/") || event.button !== 0) {
      return;
    }
    event.preventDefault();
    void downloadApiResponse(href);
  });
}
