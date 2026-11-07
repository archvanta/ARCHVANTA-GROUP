import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const [modelUrl, model] = process.argv.slice(2);
if (Boolean(modelUrl) !== Boolean(model) || [modelUrl, model].some(value => value && /[\r\n"#]/.test(value))) {
  throw new Error('Pass an optional model URL and model name together.');
}
if (modelUrl) new URL(modelUrl);
const file = new URL('../.env.local', import.meta.url);
const lines = [`ARCHVANTA_CEO_KEY=${randomBytes(32).toString('base64url')}`];
if (modelUrl) lines.push(`ARCHVANTA_MODEL_URL="${modelUrl}"`, `ARCHVANTA_MODEL="${model}"`);
try {
  await writeFile(file, `${lines.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Private settings saved in .env.local. Open that file on this computer to read your access key.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('The existing .env.local was preserved.');
}
