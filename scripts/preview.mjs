import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const root = new URL('../dist/', import.meta.url);
const projectPath = '/ARCHVANTA-GROUP/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

const server = createServer(async (request, response) => {
  const pathname = request.url.split('?', 1)[0];
  if (pathname === projectPath.slice(0, -1)) {
    response.writeHead(308, { location: projectPath }).end();
    return;
  }
  const path = pathname.startsWith(projectPath) ? pathname.slice(projectPath.length) : pathname.slice(1);
  const file = path || 'index.html';
  const type = types[extname(file)];
  if (!type || !/^(?:assets\/)?[\w.-]+$/.test(file)) { response.writeHead(404).end(); return; }
  try {
    const content = await readFile(new URL(file, root));
    response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(content);
  } catch {
    response.writeHead(404).end();
  }
});

server.listen(Number(process.argv[2] || 4173), '127.0.0.1', () => {
  console.log(`Local preview http://127.0.0.1:${server.address().port}${projectPath}`);
});
