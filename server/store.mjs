import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { departments } from '../site/data.js';

const resultStatuses = { approved: 'published', rejected: 'rejected', changes_requested: 'needs_changes' };
const maxAttempts = 3;
const leaseDuration = 5 * 60_000;

export class WorkspaceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function openStore(path, clock = Date.now) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY, department_id TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, room_id TEXT NOT NULL REFERENCES rooms(id),
      parent_id TEXT UNIQUE REFERENCES runs(id), prompt TEXT NOT NULL, gate INTEGER NOT NULL CHECK (gate IN (0,1)),
      status TEXT NOT NULL CHECK (status IN ('queued','running','awaiting_approval','published','rejected','needs_changes','failed')),
      scheduled_at INTEGER NOT NULL, due_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      lease_id TEXT, lease_until INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
      draft TEXT, review TEXT, briefing TEXT, model TEXT, error TEXT, decision TEXT, note TEXT, decided_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS runs_due ON runs(status, due_at);
    CREATE INDEX IF NOT EXISTS runs_room ON runs(room_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), at INTEGER NOT NULL, actor TEXT NOT NULL, kind TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS events_run ON events(run_id, id);
    CREATE TABLE IF NOT EXISTS sessions (
      hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value INTEGER NOT NULL) STRICT;
    INSERT OR IGNORE INTO settings VALUES ('queue_paused', 0);
  `);

  const seed = db.prepare('INSERT OR IGNORE INTO rooms VALUES (?, ?, ?, ?)');
  for (const dept of departments) seed.run(dept.id, dept.id, dept.name, clock());
  const byRun = db.prepare('SELECT * FROM runs WHERE id = ?');
  const byRoom = db.prepare('SELECT * FROM rooms WHERE id = ?');
  const isPaused = () => Boolean(db.prepare("SELECT value FROM settings WHERE name = 'queue_paused'").get().value);
  const addEvent = db.prepare('INSERT INTO events (run_id, at, actor, kind) VALUES (?, ?, ?, ?)');
  const event = (id, actor, kind) => addEvent.run(id, clock(), actor, kind);

  function transaction(action) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function state(roomId) {
    const rooms = db.prepare(`SELECT r.*,
      (SELECT count(*) FROM runs j WHERE j.room_id = r.id AND j.status = 'awaiting_approval') AS pending,
      (SELECT count(*) FROM runs j WHERE j.room_id = r.id AND j.status = 'running') AS running
      FROM rooms r ORDER BY r.created_at, r.rowid`).all();
    const selected = rooms.some(room => room.id === roomId) ? roomId : rooms[0].id;
    const runs = db.prepare(`SELECT id, parent_id, room_id, prompt, gate, status, scheduled_at, created_at, updated_at,
      draft, review, briefing, model, error, decision, note, decided_at FROM runs WHERE room_id = ?
      ORDER BY (status = 'awaiting_approval') DESC, created_at DESC, rowid DESC LIMIT 50`).all(selected);
    const events = db.prepare(`SELECT e.*, j.room_id FROM events e JOIN runs j ON e.run_id = j.id
      WHERE j.room_id = ? ORDER BY e.id DESC LIMIT 30`).all(selected);
    const pending = db.prepare(`SELECT id, room_id, prompt, created_at FROM runs
      WHERE status = 'awaiting_approval' ORDER BY created_at LIMIT 40`).all();
    const scheduled = db.prepare(`SELECT id, room_id, prompt, scheduled_at FROM runs
      WHERE status = 'queued' AND scheduled_at > ? ORDER BY scheduled_at LIMIT 40`).all(clock());
    return { rooms, roomId: selected, runs, events, pending, scheduled, paused: isPaused() };
  }

  function addRoom(departmentId, title) {
    if (!departments.some(dept => dept.id === departmentId)) throw new WorkspaceError(400, 'دپارتمان معتبر نیست.');
    return transaction(() => {
      if (db.prepare('SELECT count(*) AS count FROM rooms').get().count >= 24) throw new WorkspaceError(409, 'سقف تعداد اتاق‌ها پر شده است.');
      const id = randomUUID();
      seed.run(id, departmentId, title, clock());
      return byRoom.get(id);
    });
  }

  function enqueue({ key, roomId, prompt, gate, scheduledAt, parentId }) {
    return transaction(() => {
      if (!byRoom.get(roomId)) throw new WorkspaceError(404, 'اتاق پیدا نشد.');
      const existing = db.prepare('SELECT * FROM runs WHERE request_key = ?').get(key);
      if (existing) {
        if (existing.room_id !== roomId || existing.prompt !== prompt || existing.gate !== Number(gate) ||
            existing.parent_id !== parentId || (scheduledAt && existing.scheduled_at !== scheduledAt)) {
          throw new WorkspaceError(409, 'شناسهٔ ارسال برای یک درخواست دیگر استفاده شده است.');
        }
        return existing;
      }
      if (parentId) {
        const parent = byRun.get(parentId);
        const child = db.prepare('SELECT 1 FROM runs WHERE parent_id = ?').get(parentId);
        if (!parent || parent.room_id !== roomId || parent.status !== 'needs_changes' || child || !gate) {
          throw new WorkspaceError(409, 'این کار برای ارسال نسخهٔ اصلاحی آماده نیست.');
        }
      }
      const waiting = db.prepare("SELECT count(*) AS count FROM runs WHERE status IN ('queued', 'running')").get().count;
      if (waiting >= 30) throw new WorkspaceError(409, 'صف اجرا پر است. پس از پایان چند کار دوباره تلاش کنید.');
      const id = randomUUID();
      const now = clock();
      if (db.prepare('SELECT count(*) AS count FROM runs WHERE created_at > ?').get(now - 86_400_000).count >= 40) {
        throw new WorkspaceError(429, 'سقف ۴۰ درخواست در ۲۴ ساعت پر شده است.');
      }
      const due = scheduledAt || now;
      db.prepare(`INSERT INTO runs (id, request_key, room_id, parent_id, prompt, gate, status, scheduled_at, due_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`).run(id, key, roomId, parentId, prompt, Number(gate), due, due, now, now);
      event(id, 'ceo', scheduledAt ? 'scheduled' : 'queued');
      return byRun.get(id);
    });
  }

  function claim() {
    return transaction(() => {
      if (isPaused()) return null;
      const now = clock();
      const expired = db.prepare("SELECT id, attempts FROM runs WHERE status = 'running' AND lease_until <= ?").all(now);
      for (const job of expired) {
        const status = job.attempts < maxAttempts ? 'queued' : 'failed';
        db.prepare('UPDATE runs SET status = ?, lease_id = NULL, lease_until = NULL, updated_at = ?, error = ? WHERE id = ?')
          .run(status, now, status === 'failed' ? 'مدت مجاز اجرا تمام شد.' : null, job.id);
        event(job.id, 'system', status === 'queued' ? 'retry' : 'failed');
      }
      const job = db.prepare("SELECT id FROM runs WHERE status = 'queued' AND due_at <= ? ORDER BY due_at, created_at LIMIT 1").get(now);
      if (!job) return null;
      db.prepare(`UPDATE runs SET status = 'running', attempts = attempts + 1, lease_id = ?, lease_until = ?, updated_at = ?, error = NULL WHERE id = ?`)
        .run(randomUUID(), now + leaseDuration, now, job.id);
      event(job.id, 'specialist', 'started');
      const run = byRun.get(job.id);
      const context = db.prepare(`SELECT prompt, draft FROM runs WHERE room_id = ? AND status = 'published'
        ORDER BY updated_at DESC LIMIT 2`).all(run.room_id).map(item => ({ prompt: item.prompt.slice(0, 400), draft: item.draft.slice(0, 700) }));
      return { ...run, room: byRoom.get(run.room_id), parent: run.parent_id ? byRun.get(run.parent_id) : null, context };
    });
  }

  function progress(job, step, value, model) {
    return transaction(() => {
      const now = clock();
      const status = job.gate ? 'awaiting_approval' : 'published';
      const updates = {
        draft: ['draft = ?, model = ?', [value, model]],
        review: ['review = ?', [value]],
        briefing: ['briefing = ?, status = ?, lease_id = NULL, lease_until = NULL', [value, status]],
      };
      const [assignment, values] = updates[step];
      const result = db.prepare(`UPDATE runs SET ${assignment}, updated_at = ? WHERE id = ? AND status = 'running' AND lease_id = ? AND lease_until > ?`)
        .run(...values, now, job.id, job.lease_id, now);
      if (result.changes !== 1) return false;
      if (step === 'draft') event(job.id, 'specialist', 'drafted');
      else if (step === 'review') event(job.id, 'manager', 'reviewed');
      else event(job.id, 'coo', job.gate ? 'escalated' : 'published');
      return true;
    });
  }

  function fail(job) {
    return transaction(() => {
      const now = clock();
      const retry = job.attempts < maxAttempts;
      const result = db.prepare(`UPDATE runs SET status = ?, error = ?, due_at = ?, updated_at = ?, lease_id = NULL, lease_until = NULL
        WHERE id = ? AND status = 'running' AND lease_id = ? AND lease_until > ?`).run(retry ? 'queued' : 'failed',
        'ارتباط با مدل یا دریافت پاسخ کامل ناموفق بود.', now + job.attempts * 15_000, now, job.id, job.lease_id, now);
      if (result.changes === 1) event(job.id, 'system', retry ? 'retry' : 'failed');
    });
  }

  function decide(id, decision, note) {
    if (!Object.hasOwn(resultStatuses, decision)) throw new WorkspaceError(400, 'تصمیم معتبر نیست.');
    if (!note && decision !== 'approved') throw new WorkspaceError(400, 'دلیل تصمیم را وارد کنید.');
    return transaction(() => {
      const now = clock();
      const result = db.prepare(`UPDATE runs SET status = ?, decision = ?, note = ?, decided_at = ?, updated_at = ?
        WHERE id = ? AND status = 'awaiting_approval'`).run(resultStatuses[decision], decision, note, now, now, id);
      if (result.changes !== 1) throw new WorkspaceError(409, 'این درخواست دیگر در صف تصمیم نیست.');
      event(id, 'ceo', decision);
      return byRun.get(id);
    });
  }

  return {
    state, addRoom, enqueue, claim, progress, fail, decide,
    setPaused: value => db.prepare("UPDATE settings SET value = ? WHERE name = 'queue_paused'").run(Number(value)),
    addSession(hash, expiresAt) {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(clock());
      db.prepare('INSERT INTO sessions VALUES (?, ?)').run(hash, expiresAt);
    },
    hasSession: hash => !!db.prepare('SELECT 1 FROM sessions WHERE hash = ? AND expires_at > ?').get(hash, clock()),
    removeSession: hash => db.prepare('DELETE FROM sessions WHERE hash = ?').run(hash),
    close: () => db.close(),
  };
}
