import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { openStore } from '../server/store.mjs';
import { startWorker } from '../server/worker.mjs';
import { createWorkspaceServer } from '../server/http.mjs';

const job = (values = {}) => ({ key: randomUUID(), roomId: 'arc', prompt: 'Draft an internal checklist.', gate: true, parentId: null, scheduledAt: 0, ...values });
const listen = (server, port = 0) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', () => resolve(server.address().port));
});
const close = server => new Promise(resolve => server.close(resolve));

test('a scheduled run persists across restarts and the worker produces all three stages', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'archvanta-test-'));
  const path = join(dir, 'workspace.sqlite');
  let now = Date.now();
  let store = openStore(path, () => now);
  const calls = [];
  const model = { name: 'test-model', async generate(messages) { calls.push(messages); return ['Draft', 'Independent review', 'CEO briefing'][calls.length - 1]; } };
  let worker;
  try {
    const input = job({ scheduledAt: now + 20_000 });
    const run = store.enqueue(input);
    assert.equal(store.enqueue(input).id, run.id);
    assert.throws(() => store.enqueue({ ...input, gate: false }), { code: 409 });
    assert.equal(store.claim(), null);
    assert.equal(store.state('arc').scheduled[0].id, run.id);
    store.close();
    store = openStore(path, () => now);
    now += 20_001;
    store.setPaused(true);
    assert.equal(store.state('arc').paused, true);
    assert.equal(store.claim(), null);
    store.setPaused(false);
    worker = startWorker(store, model);
    await worker.tick();
    assert.equal(calls.length, 3);
    const state = store.state('arc');
    assert.equal(state.pending[0].id, run.id);
    assert.equal(state.runs[0].briefing, 'CEO briefing');
    assert.deepEqual(state.events.map(item => item.kind), ['escalated', 'reviewed', 'drafted', 'started', 'scheduled']);
    assert.throws(() => store.decide(run.id, 'changes_requested', ''), { code: 400 });
    store.decide(run.id, 'changes_requested', 'Add a source list.');
    const revision = store.enqueue(job({ parentId: run.id }));
    assert.equal(revision.parent_id, run.id);
    assert.throws(() => store.enqueue(job({ parentId: run.id })), { code: 409 });
    assert.throws(() => store.decide(run.id, 'approved', ''), { code: 409 });
  } finally {
    worker?.stop();
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('a stale worker cannot finish an expired lease or publish twice', async () => {
  let now = Date.now();
  const store = openStore(':memory:', () => now);
  try {
    const run = store.enqueue(job({ gate: false }));
    const expired = store.claim();
    now += 5 * 60_000 + 1;
    const valid = store.claim();
    assert.equal(valid.attempts, 2);
    assert.equal(store.progress(expired, 'briefing', 'stale', 'test'), false);
    store.progress(valid, 'draft', 'Draft', 'test');
    store.progress(valid, 'review', 'Review', 'test');
    assert.equal(store.progress(valid, 'briefing', 'Brief', 'test'), true);
    assert.equal(store.progress(valid, 'briefing', 'Duplicate', 'test'), false);
    assert.equal(store.state('arc').runs[0].status, 'published');
    assert.throws(() => store.decide(run.id, 'rejected', 'Out of scope.'), { code: 409 });
  } finally { store.close(); }
});

test('private HTTP state and mutations require a session and the trusted origin', async () => {
  const store = openStore(':memory:');
  const probe = createServer();
  const port = await listen(probe);
  await close(probe);
  const origin = `http://127.0.0.1:${port}`;
  const key = randomBytes(32).toString('base64url');
  const server = createWorkspaceServer({ store, key, origin, modelConfigured: true });
  await listen(server, port);
  const get = (path, cookie) => fetch(`${origin}/api/${path}`, { headers: cookie ? { cookie } : {} });
  const post = (path, data, cookie, requestOrigin = origin) => fetch(`${origin}/api/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: requestOrigin, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(data),
  });
  try {
    assert.equal((await get('state')).status, 401);
    assert.equal((await post('runs', job())).status, 401);
    assert.equal((await post('login', { key }, null, 'https://example.com')).status, 403);
    const session = await post('login', { key });
    const raw = session.headers.get('set-cookie');
    assert.match(raw, /HttpOnly; SameSite=Strict/);
    const cookie = raw.split(';', 1)[0];
    assert.equal((await get('state', cookie)).status, 200);
    assert.equal((await post('rooms', { title: 'QA', departmentId: 'eng' }, cookie)).status, 201);
    const reply = await post('runs', job(), cookie);
    const { id } = await reply.json();
    assert.equal(reply.status, 202);
    assert.equal((await post(`runs/${id}/decision`, { decision: 'approved' }, cookie)).status, 409);
    const lease = store.claim();
    store.progress(lease, 'draft', 'Draft', 'test');
    store.progress(lease, 'review', 'Review', 'test');
    store.progress(lease, 'briefing', 'Brief', 'test');
    const results = await Promise.all([post(`runs/${id}/decision`, { decision: 'approved' }, cookie), post(`runs/${id}/decision`, { decision: 'approved' }, cookie)]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    assert.equal((await post('logout', {}, cookie)).status, 200);
    assert.equal((await get('state', cookie)).status, 401);
  } finally {
    await close(server);
    store.close();
  }
});
