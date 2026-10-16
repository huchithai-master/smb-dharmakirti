import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getSetting, setSetting } from './db.js';

// QR berganti setiap 30 detik. Server menerima QR jendela saat ini dan satu jendela sebelumnya.
export const WINDOW_MS = 30_000;

let rahasiaCache = null;

async function rahasia() {
  if (rahasiaCache) return rahasiaCache;
  let s = process.env.QR_SECRET || (await getSetting('qr_secret'));
  if (!s) {
    s = randomBytes(32).toString('hex');
    await setSetting('qr_secret', s);
    s = (await getSetting('qr_secret')) ?? s; // bila dua instance berbarengan, pakai yang tersimpan
  }
  rahasiaCache = s;
  return s;
}

// Kunci turunan per petugas per hari. HP petugas bisa membuat QR sendiri tanpa internet,
// dan kunci yang bocor hanya berlaku untuk satu petugas pada satu tanggal.
export async function kunciPetugas(petugasId, tanggal) {
  return createHmac('sha256', await rahasia()).update(`petugas:${petugasId}:${tanggal}`).digest();
}

const tandaTangan = (kunci, payload) => createHmac('sha256', kunci).update(payload).digest('base64url').slice(0, 22);

// Format: SMBH1.<slot>.<tanggal>.<kelas>.<petugas>.<jendela>.<tanda tangan>
export function bacaToken(str) {
  const bagian = String(str ?? '').trim().split('.');
  if (bagian.length !== 7 || bagian[0] !== 'SMBH1') return null;
  const [, s, d, k, p, w, sig] = bagian;
  if (![s, k, p, w].every((x) => /^\d+$/.test(x)) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return {
    slot_id: Number(s),
    tanggal: d,
    kelas_id: Number(k),
    petugas_id: Number(p),
    jendela: Number(w),
    sig,
    payload: `${s}.${d}.${k}.${p}.${w}`,
  };
}

export async function tokenSah(tok) {
  const harus = Buffer.from(tandaTangan(await kunciPetugas(tok.petugas_id, tok.tanggal), tok.payload));
  const dapat = Buffer.from(tok.sig);
  return harus.length === dapat.length && timingSafeEqual(harus, dapat);
}
