import { backup, DatabaseSync } from 'node:sqlite';
import { mkdir, open, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const source = resolve(process.env.ARCHVANTA_DB || '.runtime/company.sqlite');
const stamp = new Date().toISOString().replaceAll(':', '-');
const destination = resolve('.runtime/backups', `company-${stamp}.sqlite`);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await mkdir(dirname(destination), { recursive: true });
  await (await open(destination, 'wx', 0o600)).close();
  try { await backup(db, destination); }
  catch (error) { await rm(destination, { force: true }); throw error; }
  console.log(`Private backup created: ${destination}`);
} finally { db.close(); }
