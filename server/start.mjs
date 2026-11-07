import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { openStore } from './store.mjs';
import { createWorkspaceServer } from './http.mjs';
import { modelClient, startWorker } from './worker.mjs';

const env = process.env;
const port = Number(env.ARCHVANTA_PORT || 4310);
const host = env.ARCHVANTA_HOST || '127.0.0.1';
const origin = new URL(env.ARCHVANTA_ORIGIN || `http://127.0.0.1:${port}`);
if ((!['127.0.0.1', '::1'].includes(host) && origin.protocol !== 'https:') ||
    (origin.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) ||
    origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('Use loopback for local access, or configure the HTTPS origin for a private reverse proxy.');
}
const dbPath = resolve(env.ARCHVANTA_DB || '.runtime/company.sqlite');
await mkdir(dirname(dbPath), { recursive: true });
const model = modelClient({ baseUrl: env.ARCHVANTA_MODEL_URL, model: env.ARCHVANTA_MODEL, apiKey: env.ARCHVANTA_MODEL_API_KEY });
const store = openStore(dbPath);
const server = createWorkspaceServer({ store, key: env.ARCHVANTA_CEO_KEY, origin: origin.origin, modelConfigured: !!model });
startWorker(store, model);
server.listen(port, host, () => console.log(`Private workspace ${origin.origin}/ | AI ${model ? 'configured' : 'not configured'}`));
