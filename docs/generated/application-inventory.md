# Generated application inventory

Generated from routes, navigation, package metadata and SQL reference JSON. Do not edit by hand. A route can exist for compatibility without appearing in navigation.

## Visible navigation

| Item | Route | Scope restriction |
| --- | --- | --- |
| Trends | `/governance/trends` | Both scope types |
| Cyber Terrain Insights | `/governance/insights` | Both scope types |
| Installed Software Insights | `/governance/installed-software-insights` | Both scope types |
| Network Risk Profile | `/network-risk-profile` | network |
| ICT System Risk Profile | `/ict-system-risk-profile` | system |
| Service Impact Analyser | `/cyber-cop?copView=impact` | Both scope types |
| ICT System Impact Analyser | `/cyber-cop?copView=ict-system-impact-analyser` | system |
| ICT System Dependencies | `/cyber-cop?copView=ict-system-dependencies` | system |
| Overview | `/discovery-coverage?discoveryView=overview` | Both scope types |
| Discovery Tool Coverage | `/discovery-coverage` | Both scope types |
| Discovery Compliance Explorer | `/discovery-coverage?discoveryView=compliance` | Both scope types |
| End Point Explorer | `/discovery-coverage?discoveryView=endpoints` | Both scope types |
| Installed Software Explorer | `/discovery-coverage?discoveryView=installed-software` | Both scope types |
| Security Vulnerability Explorer | `/discovery-coverage?discoveryView=security-vulnerabilities` | Both scope types |
| Patch Management Explorer | `/discovery-coverage?discoveryView=patch-management` | Both scope types |
| Life Cycle Management | `/discovery-coverage?discoveryView=life-cycle-management` | Both scope types |
| Shadow IT Explorer | `/discovery-coverage?discoveryView=shadow-it` | Both scope types |
| Topology Explorer | `/discovery-coverage?discoveryView=topology` | Both scope types |
| Measures Trends | `/measures/trends` | Both scope types |
| Measures Summary | `/measures` | Both scope types |
| Key Performance Indicators (KPIs) | `/measures?measuresTab=measures-kpi` | Both scope types |
| Security Posture Indicators (SPIs) | `/measures?measuresTab=measures-spi` | Both scope types |
| Findings Register | `/findings` | Both scope types |
| Briefs & Reports | `/report` | Both scope types |

## Pages and APIs

| Route | Kind / HTTP methods | Source |
| --- | --- | --- |
| `/api/assets/cmdb-details` | GET | [Source](../../app/api/assets/cmdb-details/route.ts) |
| `/api/auth/login` | POST | [Source](../../app/api/auth/login/route.ts) |
| `/api/auth/logout` | POST | [Source](../../app/api/auth/logout/route.ts) |
| `/api/auth/session` | GET | [Source](../../app/api/auth/session/route.ts) |
| `/api/cyber-cop/impact-analyser-2/compliance` | GET | [Source](../../app/api/cyber-cop/impact-analyser-2/compliance/route.ts) |
| `/api/cyber-cop/impact-analyser-2/dependencies` | GET | [Source](../../app/api/cyber-cop/impact-analyser-2/dependencies/route.ts) |
| `/api/cyber-cop/impact-analyser-2/findings` | GET | [Source](../../app/api/cyber-cop/impact-analyser-2/findings/route.ts) |
| `/api/cyber-cop/impact-analyser-2` | GET | [Source](../../app/api/cyber-cop/impact-analyser-2/route.ts) |
| `/api/discovery-coverage/compliance/export` | POST | [Source](../../app/api/discovery-coverage/compliance/export/route.ts) |
| `/api/discovery-coverage/endpoints/export` | POST | [Source](../../app/api/discovery-coverage/endpoints/export/route.ts) |
| `/api/discovery-coverage/installed-software/export` | POST | [Source](../../app/api/discovery-coverage/installed-software/export/route.ts) |
| `/api/discovery-coverage/network-report` | GET | [Source](../../app/api/discovery-coverage/network-report/route.ts) |
| `/api/discovery-coverage/overview-report` | GET | [Source](../../app/api/discovery-coverage/overview-report/route.ts) |
| `/api/discovery-coverage/patch-management/export` | POST | [Source](../../app/api/discovery-coverage/patch-management/export/route.ts) |
| `/api/discovery-coverage/remediation-report` | GET | [Source](../../app/api/discovery-coverage/remediation-report/route.ts) |
| `/api/discovery-coverage/security-vulnerabilities/export` | POST | [Source](../../app/api/discovery-coverage/security-vulnerabilities/export/route.ts) |
| `/api/discovery-coverage/shadow-it/export` | POST | [Source](../../app/api/discovery-coverage/shadow-it/export/route.ts) |
| `/api/discovery-coverage/target-state-template` | GET | [Source](../../app/api/discovery-coverage/target-state-template/route.ts) |
| `/api/discovery-coverage/tool-assets` | GET | [Source](../../app/api/discovery-coverage/tool-assets/route.ts) |
| `/api/discovery-tools/settings` | GET, PUT | [Source](../../app/api/discovery-tools/settings/route.ts) |
| `/api/discovery/installed-software-insights/report` | GET | [Source](../../app/api/discovery/installed-software-insights/report/route.ts) |
| `/api/findings/asset-details` | GET | [Source](../../app/api/findings/asset-details/route.ts) |
| `/api/findings/export` | GET, POST | [Source](../../app/api/findings/export/route.ts) |
| `/api/governance/insights/report` | GET | [Source](../../app/api/governance/insights/report/route.ts) |
| `/api/measures/settings` | GET, PUT | [Source](../../app/api/measures/settings/route.ts) |
| `/api/networks/[networkId]/discovery-coverage-export` | GET | [Source](../../app/api/networks/%5BnetworkId%5D/discovery-coverage-export/route.ts) |
| `/api/networks/[networkId]/impact-analyser/findings` | GET | [Source](../../app/api/networks/%5BnetworkId%5D/impact-analyser/findings/route.ts) |
| `/api/networks/[networkId]/impact-analyser` | GET | [Source](../../app/api/networks/%5BnetworkId%5D/impact-analyser/route.ts) |
| `/api/networks/[networkId]/remediation-report` | GET | [Source](../../app/api/networks/%5BnetworkId%5D/remediation-report/route.ts) |
| `/api/networks/performance-report` | GET | [Source](../../app/api/networks/performance-report/route.ts) |
| `/api/networks/remediation-report` | GET | [Source](../../app/api/networks/remediation-report/route.ts) |
| `/api/report/summary` | GET | [Source](../../app/api/report/summary/route.ts) |
| `/api/settings/database` | GET, PUT | [Source](../../app/api/settings/database/route.ts) |
| `/api/settings/database/test-connection` | POST | [Source](../../app/api/settings/database/test-connection/route.ts) |
| `/api/settings/database/test-schema` | POST | [Source](../../app/api/settings/database/test-schema/route.ts) |
| `/api/settings/database/test-ssl` | POST | [Source](../../app/api/settings/database/test-ssl/route.ts) |
| `/api/settings/password` | PUT | [Source](../../app/api/settings/password/route.ts) |
| `/api/settings/personas` | GET, PUT | [Source](../../app/api/settings/personas/route.ts) |
| `/api/settings/storage` | GET | [Source](../../app/api/settings/storage/route.ts) |
| `/api/systems/[systemId]/coverage-gaps-report` | GET | [Source](../../app/api/systems/%5BsystemId%5D/coverage-gaps-report/route.ts) |
| `/api/systems/[systemId]/discovery-coverage-export` | GET | [Source](../../app/api/systems/%5BsystemId%5D/discovery-coverage-export/route.ts) |
| `/api/systems/[systemId]/impact-analyser/findings` | GET | [Source](../../app/api/systems/%5BsystemId%5D/impact-analyser/findings/route.ts) |
| `/api/systems/[systemId]/impact-analyser` | GET | [Source](../../app/api/systems/%5BsystemId%5D/impact-analyser/route.ts) |
| `/api/systems/[systemId]/remediation-report` | GET | [Source](../../app/api/systems/%5BsystemId%5D/remediation-report/route.ts) |
| `/api/systems/modelling-status-report` | GET | [Source](../../app/api/systems/modelling-status-report/route.ts) |
| `/api/systems/out-of-support-os-report` | GET | [Source](../../app/api/systems/out-of-support-os-report/route.ts) |
| `/api/systems/performance-report` | GET | [Source](../../app/api/systems/performance-report/route.ts) |
| `/api/systems/remediation-report` | GET | [Source](../../app/api/systems/remediation-report/route.ts) |
| `/api/tasking-report` | GET | [Source](../../app/api/tasking-report/route.ts) |
| `/api/workspace-options` | GET | [Source](../../app/api/workspace-options/route.ts) |
| `/cyber-cop` | Page | [Source](../../app/cyber-cop/page.tsx) |
| `/discovery-coverage` | Page | [Source](../../app/discovery-coverage/page.tsx) |
| `/findings` | Page | [Source](../../app/findings/page.tsx) |
| `/governance/insights` | Page | [Source](../../app/governance/insights/page.tsx) |
| `/governance/installed-software-insights` | Page | [Source](../../app/governance/installed-software-insights/page.tsx) |
| `/governance/overview` | Page | [Source](../../app/governance/overview/page.tsx) |
| `/governance/trends` | Page | [Source](../../app/governance/trends/page.tsx) |
| `/ict-system-risk-profile` | Page | [Source](../../app/ict-system-risk-profile/page.tsx) |
| `/login` | Page | [Source](../../app/login/page.tsx) |
| `/measures` | Page | [Source](../../app/measures/page.tsx) |
| `/measures/trends` | Page | [Source](../../app/measures/trends/page.tsx) |
| `/network-risk-profile` | Page | [Source](../../app/network-risk-profile/page.tsx) |
| `/networks/[networkId]` | Page | [Source](../../app/networks/%5BnetworkId%5D/page.tsx) |
| `/networks` | Page | [Source](../../app/networks/page.tsx) |
| `/` | Page | [Source](../../app/page.tsx) |
| `/report` | Page | [Source](../../app/report/page.tsx) |
| `/settings` | Page | [Source](../../app/settings/page.tsx) |
| `/systems/[systemId]` | Page | [Source](../../app/systems/%5BsystemId%5D/page.tsx) |
| `/systems` | Page | [Source](../../app/systems/page.tsx) |

## Locked package baseline

Installed versions are resolved by package-lock.json; this table lists declared requirements.

| Package | Requirement | Use |
| --- | --- | --- |
| clsx | ^2.1.1 | Runtime |
| next | ^14.2.35 | Runtime |
| papaparse | ^5.5.3 | Runtime |
| pdf-lib | ^1.17.1 | Runtime |
| puppeteer-core | ^24.37.5 | Runtime |
| react | 18.2.0 | Runtime |
| react-dom | 18.2.0 | Runtime |
| react-is | ^18.2.0 | Runtime |
| recharts | ^3.7.0 | Runtime |
| three | ^0.181.2 | Runtime |
| @types/node | 20.11.30 | Development |
| @types/papaparse | ^5.5.2 | Development |
| @types/react | 18.2.79 | Development |
| @types/react-dom | 18.2.25 | Development |
| @types/three | ^0.181.0 | Development |
| @vitest/coverage-v8 | ^4.0.18 | Development |
| autoprefixer | ^10.4.24 | Development |
| eslint | 8.57.0 | Development |
| eslint-config-next | ^14.2.35 | Development |
| postcss | ^8.5.6 | Development |
| tailwindcss | 3.4.17 | Development |
| tsx | ^4.21.0 | Development |
| typescript | ^5.9.3 | Development |
| vitest | ^4.0.18 | Development |

## KPI seed catalogue

Deployed SQL configuration is authoritative; these are repository seed defaults.

| ID | Name | Calculation |
| --- | --- | --- |
| KPI-1 | ICT Systems have an active ATO | active-ato-coverage |
| KPI-2 | ICT Systems are registered within DIIS | diis-registration-coverage |
