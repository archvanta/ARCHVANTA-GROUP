import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { WorkspaceError } from './store.mjs';

const files = new URL('../dist/', import.meta.url);
const digest = value => createHash('sha256').update(value).digest();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const sessionAge = 8 * 60 * 60;
const identifier = /^[\w-]{1,80}$/;

function send(res, status, payload, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
}

async function body(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new WorkspaceError(415, 'قالب درخواست معتبر نیست.');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > 24_000) {
      req.resume();
      throw new WorkspaceError(413, 'حجم درخواست بیش از حد مجاز است.');
    }
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch { /* Format errors are returned below. */ }
  throw new WorkspaceError(400, 'درخواست قابل خواندن نیست.');
}

function validateText(value, limit, label, optional = false) {
  if (typeof value !== 'string' || value.length > limit || (!optional && !value.trim())) throw new WorkspaceError(400, `${label} را بررسی کنید.`);
  return value.trim();
}

export function createWorkspaceServer({ store, key, origin, modelConfigured }) {
  if (typeof key !== 'string' || key.length < 32) throw new Error('Set a strong ARCHVANTA_CEO_KEY (32 characters minimum).');
  const trusted = new URL(origin);
  const keyDigest = digest(key);
  const sessionHash = token => createHash('sha256').update(token).update(keyDigest).digest('hex');
  const secure = trusted.protocol === 'https:';
  const cookieName = secure ? '__Host-archvanta' : 'archvanta_session';
  const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  let failedLogins = [];

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      if (req.headers.host !== trusted.host || !req.url.startsWith('/') || req.url.startsWith('//')) throw new WorkspaceError(421, 'نشانی درخواست معتبر نیست.');
      const url = new URL(req.url, origin);
      const { pathname } = url;
      const method = req.method;
      if (!['GET', 'HEAD', 'POST'].includes(method)) throw new WorkspaceError(405, 'روش درخواست معتبر نیست.');
      if (method === 'POST' && req.headers.origin !== trusted.origin) throw new WorkspaceError(403, 'درخواست از این نشانی مجاز نیست.');
      if (pathname.startsWith('/api/')) {
        const token = (req.headers.cookie ?? '').split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
        const hash = token && sessionHash(token);
        const authenticated = !!hash && store.hasSession(hash);
        if (pathname === '/api/session' && method === 'GET') return send(res, 200, { authenticated, modelConfigured: authenticated && modelConfigured });
        if (pathname === '/api/login' && method === 'POST') {
          const now = Date.now();
          failedLogins = failedLogins.filter(attempt => now - attempt < 60_000);
          if (failedLogins.length >= 8) throw new WorkspaceError(429, 'یک دقیقه صبر کنید و دوباره تلاش کنید.');
          const data = await body(req);
          if (typeof data.key !== 'string' || data.key.length > 256 || !timingSafeEqual(digest(data.key), keyDigest)) {
            failedLogins.push(now);
            throw new WorkspaceError(401, 'کلید ورود معتبر نیست.');
          }
          if (hash) store.removeSession(hash);
          const session = randomBytes(32).toString('base64url');
          store.addSession(sessionHash(session), now + sessionAge * 1000);
          return send(res, 200, { authenticated: true, modelConfigured }, { 'set-cookie': cookie(session, sessionAge) });
        }
        if (!authenticated) throw new WorkspaceError(401, 'ابتدا وارد دفتر خصوصی شوید.');
        if (pathname === '/api/logout' && method === 'POST') {
          store.removeSession(hash);
          return send(res, 200, { authenticated: false }, { 'set-cookie': cookie('', 0) });
        }
        if (pathname === '/api/state' && method === 'GET') return send(res, 200, store.state(url.searchParams.get('room')));
        if (pathname === '/api/queue' && method === 'POST') {
          const { paused } = await body(req);
          if (typeof paused !== 'boolean') throw new WorkspaceError(400, 'وضعیت صف معتبر نیست.');
          store.setPaused(paused);
          return send(res, 200, { paused });
        }
        if (pathname === '/api/rooms' && method === 'POST') {
          const data = await body(req);
          return send(res, 201, store.addRoom(data.departmentId, validateText(data.title, 70, 'نام اتاق')));
        }
        if (pathname === '/api/runs' && method === 'POST') {
          if (!modelConfigured) throw new WorkspaceError(503, 'مدل هوش مصنوعی به دفتر متصل نشده است.');
          const data = await body(req);
          if (typeof data.key !== 'string' || !identifier.test(data.key) || typeof data.roomId !== 'string' ||
              !identifier.test(data.roomId) || typeof data.gate !== 'boolean' ||
              (data.parentId != null && (typeof data.parentId !== 'string' || !identifier.test(data.parentId)))) {
            throw new WorkspaceError(400, 'مشخصات کار معتبر نیست.');
          }
          const scheduledAt = data.scheduledAt ?? 0;
          if (!Number.isSafeInteger(scheduledAt) || scheduledAt < 0 || scheduledAt > Date.now() + 30 * 86_400_000) {
            throw new WorkspaceError(400, 'زمان اجرا باید در ۳۰ روز آینده باشد.');
          }
          const run = store.enqueue({ key: data.key, roomId: data.roomId, gate: data.gate,
            prompt: validateText(data.prompt, 2000, 'متن درخواست'), parentId: data.parentId ?? null, scheduledAt });
          return send(res, 202, { id: run.id });
        }
        const match = /^\/api\/runs\/([\w-]{1,80})\/decision$/.exec(pathname);
        if (match && method === 'POST') {
          const data = await body(req);
          const run = store.decide(match[1], data.decision, validateText(data.note ?? '', 500, 'یادداشت تصمیم', true));
          return send(res, 200, { id: run.id, status: run.status });
        }
        throw new WorkspaceError(404, 'درخواست پیدا نشد.');
      }
      if (method !== 'GET' && method !== 'HEAD') throw new WorkspaceError(405, 'روش درخواست معتبر نیست.');
      if (pathname === '/') { res.writeHead(302, { location: '/office.html?workspace=private', 'cache-control': 'no-store' }).end(); return; }
      const file = pathname.slice(1);
      const type = types[extname(file)];
      if (!type || !/^(?:assets\/(?:three\/)?)?[\w.-]+$/.test(file)) throw new WorkspaceError(404, 'فایل پیدا نشد.');
      const content = await readFile(new URL(file, files)).catch(() => null);
      if (!content) throw new WorkspaceError(404, 'فایل پیدا نشد.');
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' }).end(method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!(error instanceof WorkspaceError)) console.error('Workspace request failed.');
      if (!res.headersSent) send(res, error instanceof WorkspaceError ? error.code : 500, { error: error instanceof WorkspaceError ? error.message : 'خطای داخلی دفتر.' });
    }
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  return server;
}
