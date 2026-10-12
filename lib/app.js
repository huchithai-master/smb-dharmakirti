// Penangan API: dipakai oleh fungsi Vercel (api/[...path].js) dan server lokal (scripts/dev.js).
import { HttpError, bacaJson } from './http.js';
import { penggunaDariReq } from './auth.js';
import authRoutes from './routes/auth.js';
import pengajarRoutes from './routes/pengajar.js';
import petugasRoutes from './routes/petugas.js';
import adminRoutes from './routes/admin.js';
import siswaRoutes from './routes/siswa.js';

const routes = [...authRoutes, ...pengajarRoutes, ...petugasRoutes, ...adminRoutes, ...siswaRoutes].map((r) => {
  const nama = [];
  const pola = new RegExp('^' + r.path.replace(/:(\w+)/g, (_, n) => (nama.push(n), '([^/]+)')) + '$');
  return { ...r, pola, nama };
});

const BOLEH = {
  publik: () => true,
  login: (u) => !!u,
  pengajar: (u) => !!u?.is_pengajar,
  petugas: (u) => !!u?.is_petugas,
  admin: (u) => !!u?.is_admin,
};

export function headerKeamanan(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()');
}

function kirimJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

export async function tanganiApi(req, res) {
  headerKeamanan(res);
  try {
    const url = new URL(req.url, 'http://localhost');
    const route = routes.find((r) => r.method === req.method && r.pola.test(url.pathname));
    if (!route) return kirimJson(res, 404, { error: 'Alamat tidak ditemukan.' });

    if (req.method !== 'GET') {
      // Perlindungan CSRF: wajib JSON dan, bila ada, Origin harus sama dengan host.
      const origin = req.headers.origin;
      const hostSah = [req.headers.host, req.headers['x-forwarded-host']].filter(Boolean);
      if (origin && !hostSah.includes(new URL(origin).host)) return kirimJson(res, 403, { error: 'Permintaan ditolak.' });
      if (!(req.headers['content-type'] || '').startsWith('application/json')) {
        return kirimJson(res, 415, { error: 'Permintaan harus berformat JSON.' });
      }
    }

    const user = await penggunaDariReq(req);
    if (!BOLEH[route.akses](user)) {
      return kirimJson(res, user ? 403 : 401, { error: user ? 'Anda tidak punya akses ke fitur ini.' : 'Silakan login dulu.' });
    }
    const cocok = route.pola.exec(url.pathname);
    const params = Object.fromEntries(route.nama.map((n, i) => [n, decodeURIComponent(cocok[i + 1])]));
    const body = req.method === 'GET' ? {} : await bacaJson(req);
    const hasil = await route.handler({ req, res, body, params, query: Object.fromEntries(url.searchParams), user });
    if (hasil?.__berkas) {
      const { isi, tipe, nama } = hasil.__berkas;
      res.writeHead(200, { 'Content-Type': tipe, 'Content-Disposition': `attachment; filename="${nama}"`, 'Cache-Control': 'no-store' });
      return res.end(isi);
    }
    kirimJson(res, 200, hasil);
  } catch (e) {
    if (e instanceof HttpError) return kirimJson(res, e.status, { error: e.message });
    console.error(e);
    if (!res.headersSent) kirimJson(res, 500, { error: 'Terjadi kesalahan di server.' });
  }
}
