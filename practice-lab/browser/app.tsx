import { Component, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { NavigationContext, BASE, currentRoute, navigate } from './navigation';
import { installLocalApi } from './api';
import { loadStoreManifest } from './store';
import Image from './image';
import { PersonaProvider } from '@/components/persona-provider';
import { WorkspaceShell } from '@/components/workspace-shell';
import { WorkspaceHeaderControls } from '@/components/workspace-header-controls';
import { CmdbDrillThroughProvider } from '@/components/cmdb-drill-through';
import { DocumentGenerationDialog } from '@/components/document-generation-dialog';
import DiscoveryPage from '@/app/discovery-coverage/page';
import EndpointPage from '@/app/governance/end-point-insights/page';
import SoftwarePage from '@/app/governance/installed-software-insights/page';
import VulnerabilityPage from '@/app/governance/security-vulnerability-insights/page';
import DocumentPage from '@/app/documents/generate/page';
import { clearDataLoaderCaches } from '@/lib/data-loader';

const pages: Record<string, any> = {
  '/discovery-coverage': DiscoveryPage,
  '/governance/end-point-insights': EndpointPage,
  '/governance/installed-software-insights': SoftwarePage,
  '/governance/security-vulnerability-insights': VulnerabilityPage,
  '/documents/generate': DocumentPage,
  '/': () => <section className="panel p-5"><h1>Choose a workspace view</h1><p>Select a view from Governance or Discovery to explore the sample evidence.</p></section>
};
let learner = '', initialRoute = '';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <section className="panel p-5" role="alert"><h1>Unable to open this view</h1><p>Reset the practice session to try again.</p></section> : this.props.children; }
}
function App() {
  const [route, setRoute] = useState(currentRoute), [view, setView] = useState<ReactNode>(null), [pending, setPending] = useState(true), [reset, setReset] = useState(0);
  useEffect(() => {
    const change = () => setRoute(currentRoute());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    let cancelled = false; setPending(true);
    const url = new URL(route, BASE), searchParams: Record<string, string | string[]> = {};
    for (const key of new Set(url.searchParams.keys())) { const values = url.searchParams.getAll(key); searchParams[key] = values.length === 1 ? values[0] : values; }
    const page = pages[url.pathname];
    Promise.resolve().then(() => page ? page({ searchParams }) : <section className="panel p-5"><h1>View unavailable in this practice edition</h1><a href={'#' + initialRoute}>Return to End Point Explorer</a></section>)
      .then(result => { if (!cancelled) setView(result); })
      .catch(error => { console.error(error); if (!cancelled) setView(<section className="panel p-5" role="alert"><h1>Unable to load this view</h1><p>{error.message}</p><button onClick={() => setReset(x => x + 1)}>Try again</button></section>); })
      .finally(() => { if (!cancelled) setPending(false); });
    return () => { cancelled = true; };
  }, [route, reset]);
  return <NavigationContext.Provider value={route}><div className="app-bg" /><div className="topography-overlay" />
    <div className="practice-banner"><strong>Practice lab</strong><span>Sample data · Browser only</span><span className="practice-learner">{learner}</span>
      <button onClick={() => { clearDataLoaderCaches(); (window as any).__practicePersona = null; setReset(x => x + 1); navigate(initialRoute, true); }}>Reset practice</button>
      <button onClick={() => window.print()}>Print view</button></div>
    <PersonaProvider key={reset}><div className="app-workspace-shell">
      <header className="workspace-header no-print"><div className="workspace-header-inner"><div className="workspace-brand"><Image src="/tsaat-logo.png" alt="TSAAT logo" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" /><div><p className="text-xl uppercase tracking-[0.14em] text-slate-100">TSAAT</p><p className="text-xs text-slate-300/75">Threat Surface Area Assessment Tool</p></div></div><WorkspaceHeaderControls /></div></header>
      <WorkspaceShell><CmdbDrillThroughProvider key={route + reset}><div aria-busy={pending}>{pending ? <p className="panel p-5" role="status">Loading sample evidence…</p> : <ErrorBoundary key={route + reset}>{view}</ErrorBoundary>}</div></CmdbDrillThroughProvider></WorkspaceShell>
    </div></PersonaProvider><DocumentGenerationDialog /></NavigationContext.Provider>;
}
async function start() {
  installLocalApi();
  const manifest = await loadStoreManifest();
  initialRoute = '/discovery-coverage?discoveryView=endpoints&network=net-1&dataDate=' + manifest.snapshots.at(-1).date;
  const original = new URL(currentRoute(), BASE);
  learner = (original.searchParams.get('learner') || (window.name.startsWith('tsaat-practice:') ? window.name.slice(15) : '') || 'Practice session').slice(0, 64);
  window.name = 'tsaat-practice:' + learner;
  original.searchParams.delete('learner');
  navigate(original.pathname === '/' ? initialRoute : original.pathname + original.search, true);
  document.addEventListener('click', event => {
    const link = (event.target as Element)?.closest('a');
    const href = link?.getAttribute('href');
    if (!event.defaultPrevented && href?.startsWith('/') && !href.startsWith('//')) { event.preventDefault(); navigate(href); }
    if (!event.defaultPrevented && href?.startsWith('#/')) { event.preventDefault(); navigate(href.slice(1)); }
    if (!event.defaultPrevented && href?.startsWith('#') && !href.startsWith('#/')) {
      event.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    }
  });
  createRoot(document.getElementById('practice-root')!).render(<App />);
}
start().catch(error => { document.getElementById('practice-root')!.textContent = 'The bundled practice data could not be loaded. Reopen the guide and try again. ' + error.message; });
