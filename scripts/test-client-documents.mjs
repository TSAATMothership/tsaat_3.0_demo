import { checkInventoryRuntime } from './inventory-smoke.mjs';
// Document coverage is part of the retained compiled feature contract.
await checkInventoryRuntime('json');
if (process.env.TSAAT_EVIDENCE_PARITY_DATABASE) await checkInventoryRuntime('sql');
