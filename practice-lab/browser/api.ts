import { BASE } from './navigation';
import { NextRequest } from './server';
import * as options from '@/app/api/workspace-options/route';
import * as cmdb from '@/app/api/assets/cmdb-details/route';
import * as personas from '@/app/api/settings/personas/route';
import * as endpoints from '@/app/api/discovery-coverage/endpoints/export/route';
import * as software from '@/app/api/discovery-coverage/installed-software/export/route';
import * as vulnerabilities from '@/app/api/discovery-coverage/security-vulnerabilities/export/route';
import * as shadow from '@/app/api/discovery-coverage/shadow-it/export/route';
import * as endpointReport from '@/app/api/governance/end-point-insights/report/route';
import * as vulnerabilityReport from '@/app/api/governance/security-vulnerability-insights/report/route';
import * as softwareReport from '@/app/api/discovery/installed-software-insights/report/route';

const routes: Record<string, any> = {
  '/api/workspace-options': options, '/api/assets/cmdb-details': cmdb, '/api/settings/personas': personas,
  '/api/discovery-coverage/endpoints/export': endpoints,
  '/api/discovery-coverage/installed-software/export': software,
  '/api/discovery-coverage/security-vulnerabilities/export': vulnerabilities,
  '/api/discovery-coverage/shadow-it/export': shadow,
  '/api/governance/end-point-insights/report': endpointReport,
  '/api/governance/security-vulnerability-insights/report': vulnerabilityReport,
  '/api/discovery/installed-software-insights/report': softwareReport
};
export function installLocalApi() {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), BASE);
    if (url.origin !== BASE) throw Error('The practice app uses bundled data only.');
    const request = new NextRequest(url.href, input instanceof Request ? input : init);
    request.signal.throwIfAborted();
    const handler = routes[url.pathname]?.[request.method];
    if (!handler) return Response.json({ error: 'Unknown practice operation.' }, { status: 404 });
    const response = await handler(request);
    request.signal.throwIfAborted();
    return response;
  };
}
