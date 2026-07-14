import {
  Component,
  Suspense,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode
} from "react";
import { createRoot } from "react-dom/client";
import CyberCopPage from "@/app/cyber-cop/page";
import DiscoveryCoveragePage from "@/app/discovery-coverage/page";
import FindingsPage from "@/app/findings/page";
import LoginPage from "@/app/login/page";
import MeasuresPage from "@/app/measures/page";
import NetworkDetailPage from "@/app/networks/[networkId]/page";
import NetworksPage from "@/app/networks/page";
import ReportPage from "@/app/report/page";
import SystemDetailPage from "@/app/systems/[systemId]/page";
import SystemsPage from "@/app/systems/page";
import { AuthenticatedSessionGuard } from "@/components/authenticated-session-guard";
import { FilterLoadingOverlay } from "@/components/filter-loading-overlay";
import { MenuNavigation } from "@/components/menu-navigation";
import { SiteFooter } from "@/components/site-footer";
import { APP_NAME } from "@/lib/constants";
import { completeRouteLoading } from "@/lib/route-loading";
import { assets, workerSource } from "virtual:embedded-assets";
import { installApiBridge } from "./api-router";
import { isAuthenticated } from "./auth";
import { installBrowserBuffer } from "./browser-buffer";
import {
  ensureInitialRoute,
  navigate,
  NotFoundSignal,
  RedirectSignal,
  useLogicalLocation,
  type LogicalLocation
} from "./router";

type SearchParamValue = string | string[] | undefined;
type SearchParamsRecord = Record<string, SearchParamValue>;

const navigation = [
  { href: "/cyber-cop", label: "Cyber COP" },
  { href: "/networks", label: "Networks" },
  { href: "/systems", label: "ICT Systems" }
];

function toSearchParamsRecord(searchParams: URLSearchParams): SearchParamsRecord {
  const result: SearchParamsRecord = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }
  return result;
}

async function pageForLocation(location: LogicalLocation): Promise<ReactNode> {
  const searchParams = toSearchParamsRecord(location.searchParams);
  if (location.pathname === "/" || location.pathname === "") {
    throw new RedirectSignal("/cyber-cop");
  }
  if (location.pathname === "/login") {
    return LoginPage({ searchParams });
  }
  if (location.pathname === "/cyber-cop") {
    return CyberCopPage({ searchParams });
  }
  if (location.pathname === "/networks") {
    return NetworksPage({ searchParams });
  }
  const networkMatch = location.pathname.match(/^\/networks\/([^/]+)$/);
  if (networkMatch) {
    return NetworkDetailPage({
      params: { networkId: decodeURIComponent(networkMatch[1]) },
      searchParams
    });
  }
  if (location.pathname === "/systems") {
    return SystemsPage({ searchParams });
  }
  const systemMatch = location.pathname.match(/^\/systems\/([^/]+)$/);
  if (systemMatch) {
    return SystemDetailPage({
      params: { systemId: decodeURIComponent(systemMatch[1]) },
      searchParams
    });
  }
  if (location.pathname === "/discovery-coverage") {
    return DiscoveryCoveragePage({ searchParams });
  }
  if (location.pathname === "/measures") {
    return MeasuresPage({ searchParams });
  }
  if (location.pathname === "/findings") {
    return FindingsPage({ searchParams });
  }
  if (location.pathname === "/report") {
    return ReportPage({ searchParams });
  }
  throw new NotFoundSignal();
}

function LoadingPage() {
  return (
    <section className="panel mx-auto mt-12 max-w-xl p-8 text-center">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-300/75">Offline data package</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">Loading TSAAT...</h1>
      <div className="mx-auto mt-5 h-1.5 w-64 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-300/80" />
      </div>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="panel mx-auto mt-12 max-w-xl p-8 text-center">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-300/75">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-100">Page not found</h1>
      <p className="mt-3 text-sm text-slate-300/80">The requested TSAAT view is not available in this application.</p>
      <button
        type="button"
        onClick={() => navigate("/cyber-cop")}
        className="mt-5 rounded-md border border-cyan-300/50 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100"
      >
        Return to Cyber COP
      </button>
    </section>
  );
}

function FailedPage({ error }: { error: Error }) {
  return (
    <section className="panel mx-auto mt-12 max-w-2xl border-rose-400/40 p-8">
      <p className="text-xs uppercase tracking-[0.16em] text-rose-300/80">Offline application error</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">This TSAAT view could not be rendered.</h1>
      <p className="mt-4 break-words rounded-md bg-slate-950/70 p-3 text-sm text-rose-200">{error.message}</p>
    </section>
  );
}

type PageState =
  | { status: "loading" }
  | { status: "ready"; locationHref: string; node: ReactNode }
  | { status: "not-found" }
  | { status: "error"; error: Error };

function RoutedPage({ location }: { location: LogicalLocation }) {
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    if (location.pathname !== "/login" && !isAuthenticated()) {
      const next = `${location.pathname}${location.search}${location.anchor ? `#${encodeURIComponent(location.anchor)}` : ""}`;
      navigate(`/login?next=${encodeURIComponent(next)}`, true);
      return () => {
        active = false;
      };
    }

    setState({ status: "loading" });
    void pageForLocation(location)
      .then((node) => {
        if (active) {
          setState({ status: "ready", locationHref: location.href, node });
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        if (error instanceof RedirectSignal) {
          navigate(error.href, true);
          return;
        }
        if (error instanceof NotFoundSignal) {
          setState({ status: "not-found" });
          return;
        }
        setState({ status: "error", error: error instanceof Error ? error : new Error(String(error)) });
      });

    return () => {
      active = false;
    };
  }, [location]);

  useEffect(() => {
    if (state.status !== "ready" || state.locationHref !== location.href) {
      return;
    }

    // The standalone route host owns the async page lifecycle. Notify the
    // shared loading overlay only after React has committed the matching page,
    // so replace-style hash navigation cannot leave the overlay waiting at 96%.
    const timeout = window.setTimeout(() => completeRouteLoading(), 0);
    return () => window.clearTimeout(timeout);
  }, [location.href, state]);

  useEffect(() => {
    if (state.status !== "ready" || !location.anchor) {
      return;
    }
    const timeout = window.setTimeout(() => {
      document.getElementById(location.anchor)?.scrollIntoView({ block: "start" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [location.anchor, state.status]);

  if (state.status === "loading" || (state.status === "ready" && state.locationHref !== location.href)) {
    return <LoadingPage />;
  }
  if (state.status === "not-found") {
    return <NotFoundPage />;
  }
  if (state.status === "error") {
    return <FailedPage error={state.error} />;
  }
  return <>{state.node}</>;
}

function AppShell() {
  const location = useLogicalLocation();
  const isLoginRoute = location.pathname === "/login";
  const page = <RoutedPage location={location} />;

  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  if (isLoginRoute) {
    return (
      <>
        <div className="app-bg" />
        <div className="topography-overlay" />
        <main className="mx-auto max-w-[1400px] px-4 py-5 md:px-6 md:py-8">{page}</main>
      </>
    );
  }

  return (
    <>
      <div className="app-bg" />
      <div className="topography-overlay" />
      <header className="no-print border-b border-sky-300/15 bg-slate-950/50 backdrop-blur-md">
        <div className="relative left-1/2 w-[min(2100px,calc(100vw-2rem))] -translate-x-1/2 py-4 md:w-[min(2100px,calc(100vw-3rem))]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex shrink-0 items-center gap-3">
              <img src={assets["/dct-mark.svg"]} alt="TSAAT mark" width={40} height={40} />
              <div>
                <p className="font-['Bahnschrift','Arial_Narrow','Arial',sans-serif] text-xl uppercase tracking-[0.14em] text-slate-100">
                  TSAAT
                </p>
                <p className="text-xs text-slate-300/75">Threat Surface Area Assessment Tool</p>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <Suspense fallback={<div className="h-[38px]" />}>
                <MenuNavigation items={navigation} authenticatedUsername={isAuthenticated() ? "demo" : ""} />
              </Suspense>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5 md:px-6 md:py-8">{page}</main>
      <Suspense fallback={null}>
        <AuthenticatedSessionGuard />
      </Suspense>
      <Suspense fallback={null}>
        <FilterLoadingOverlay />
      </Suspense>
      <SiteFooter />
    </>
  );
}

class RuntimeErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("TSAATDemo_lite render failure", error, info);
  }

  render() {
    return this.state.error ? <FailedPage error={this.state.error} /> : this.props.children;
  }
}

function installNavigationBridge(): void {
  globalThis.__TSAAT_NAVIGATE__ = (href: string, replace = false) => navigate(href, replace);

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!(event.target instanceof Element)) {
      return;
    }
    const anchor = event.target.closest("a[href]") as HTMLAnchorElement | null;
    const href = anchor?.getAttribute("href") ?? "";
    if (!anchor || !href.startsWith("/") || href.startsWith("/api/")) {
      return;
    }
    if (anchor.target && anchor.target !== "_self") {
      return;
    }
    event.preventDefault();
    navigate(href);
  });

  document.addEventListener("submit", (event) => {
    if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) {
      return;
    }
    const form = event.target;
    const action = form.getAttribute("action");
    const method = (form.getAttribute("method") ?? "get").toLowerCase();
    if (!action?.startsWith("/") || action.startsWith("/api/") || method !== "get") {
      return;
    }
    event.preventDefault();
    const target = new URL(action, "https://tsaat-demo-lite.local");
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value === "string") {
        params.append(key, value);
      }
    }
    target.search = params.toString();
    navigate(`${target.pathname}${target.search}${target.hash}`);
  });
}

installBrowserBuffer();
(globalThis as unknown as { process: { env: Record<string, string>; cwd: () => string } }).process = {
  env: {},
  cwd: () => "/"
};
globalThis.__TSAAT_ASSETS__ = assets;
globalThis.__TSAAT_WORKER_URL__ = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
installApiBridge();
installNavigationBridge();
ensureInitialRoute(isAuthenticated());

document.body.className = "font-['Segoe_UI','Trebuchet_MS','Arial',sans-serif] antialiased";
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("TSAATDemo_lite root element is missing.");
}
createRoot(rootElement).render(
  <RuntimeErrorBoundary>
    <AppShell />
  </RuntimeErrorBoundary>
);
