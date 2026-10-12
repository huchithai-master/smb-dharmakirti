export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function gagal(status, pesan) {
  throw new HttpError(status, pesan);
}

export async function bacaJson(req) {
  // Di Vercel, isi permintaan sudah dibaca dan tersedia di req.body.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    try {
      const data = JSON.parse(String(req.body) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch {
      gagal(400, 'Format data tidak valid.');
    }
  }
  const chunks = [];
  let ukuran = 0;
  for await (const c of req) {
    ukuran += c.length;
    if (ukuran > 100_000) gagal(413, 'Data terlalu besar.');
    chunks.push(c);
  }
  if (!ukuran) return {};
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    gagal(400, 'Format data tidak valid.');
  }
}

export function bacaCookie(req, nama) {
  for (const bagian of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = bagian.trim().split('=');
    if (k === nama) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Validasi input sederhana
export function teks(v, { maks = 200, wajib = false, label = 'Data' } = {}) {
  const s = String(v ?? '').trim();
  if (wajib && !s) gagal(400, `${label} wajib diisi.`);
  if (s.length > maks) gagal(400, `${label} terlalu panjang.`);
  return s;
}

export function bulat(v, label = 'Data') {
  const n = Number(v);
  if (!Number.isInteger(n)) gagal(400, `${label} tidak valid.`);
  return n;
}

export function tanggal(v, label = 'Tanggal') {
  const s = String(v ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) gagal(400, `${label} tidak valid.`);
  return s;
}

export function jam(v, label = 'Jam') {
  const s = String(v ?? '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) gagal(400, `${label} tidak valid.`);
  return s;
}

export function pilihan(v, opsi, label = 'Pilihan') {
  if (!opsi.includes(v)) gagal(400, `${label} tidak valid.`);
  return v;
}
