import { createServer } from 'node:http';
import { existsSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..', 'www');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const localIps = Object.values(networkInterfaces())
  .flat()
  .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
  .map((entry) => entry.address);

function printInstructions() {
  console.log(`
Web preview server started.
Local URL: http://localhost:${port}`);

  localIps.forEach((ip) => {
    console.log(`Mobile URL: http://${ip}:${port}`);
  });

  console.log('Press Ctrl+C to stop.\n');
}

function resolveFile(urlPath) {
  let path = decodeURIComponent(urlPath.split('?')[0]);
  if (path === '/') {
    path = '/index.html';
  }

  const safePath = resolve(webRoot, '.' + path);
  if (!safePath.startsWith(`${webRoot}${sep}`) && safePath !== webRoot) {
    return null;
  }

  if (!existsSync(safePath)) {
    return null;
  }

  const stat = statSync(safePath);
  if (stat.isDirectory()) {
    return resolve(safePath, 'index.html');
  }

  return safePath;
}

function serve500(response, error) {
  response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(`Server error: ${error.message}`);
}

const server = createServer(async (request, response) => {
  try {
    const requestPath = request.url || '/';
    const filePath = resolveFile(requestPath);

    if (!filePath) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    response.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error instanceof Error) {
      serve500(response, error);
    } else {
      serve500(response, new Error('Unknown error'));
    }
  }
});

server.on('error', (error) => {
  console.error('Server failed to start:', error.message);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  printInstructions();
});
