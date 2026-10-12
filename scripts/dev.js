// Server lokal untuk mencoba aplikasi: node scripts/dev.js
// Tanpa DATABASE_URL, data disimpan di folder data/pglite (Postgres bawaan WASM).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tanganiApi } from '../lib/app.js';
import { siapkan } from '../lib/db.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const TIPE = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return tanganiApi(req, res);
  const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403);
    return res.end('Ditolak');
  }
  try {
    const isi = await readFile(file);
    res.writeHead(200, { 'Content-Type': TIPE[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(isi);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Tidak ditemukan');
  }
});

await siapkan();
const port = Number(process.env.PORT || 3000);
server.listen(port, () => console.log(`SMB Dharmakirti (lokal) di http://localhost:${port}`));
