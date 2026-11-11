import { it } from 'vitest';
import { checkEvidenceParity } from '../scripts/check-evidence-parity';

it.skipIf(!process.env.TSAAT_EVIDENCE_PARITY_DATABASE)('compares real SQL and JSON inventory across identical weekly dates and scopes', async () => {
  await checkEvidenceParity();
}, 600000);
