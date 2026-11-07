import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = new URL('../site/', import.meta.url);
const output = new URL('../dist/', import.meta.url);
const publicFiles = ['index.html', 'styles.css', 'app.js', 'model.js', 'data.js', 'icons.js', 'assets/mark.svg', 'assets/blueprint.svg', 'assets/vazirmatn.woff2', 'assets/OFL-Vazirmatn.txt'];

await rm(output, { recursive: true, force: true });
for (const file of publicFiles) {
  const destination = new URL(file, output);
  await mkdir(dirname(fileURLToPath(destination)), { recursive: true });
  await copyFile(new URL(file, source), destination);
}
await writeFile(new URL('.nojekyll', output), '');
console.log(`Built ${publicFiles.length} public files in dist/.`);
