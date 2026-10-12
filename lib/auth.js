import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { one, run } from './db.js';
import { bacaCookie } from './http.js';

const COOKIE = 'smbh_sesi';
const UMUR_SESI_HARI = 90;

export function hashPin(pin) {
  const salt = randomBytes(16);
  const hasil = scryptSync(pin, salt, 32);
  return `${salt.toString('hex')}:${hasil.toString('hex')}`;
}

export function cekPin(pin, tersimpan) {
  if (!tersimpan) return false;
  const [salt, hash] = tersimpan.split(':');
  const hitung = scryptSync(String(pin), Buffer.from(salt, 'hex'), 32);
  return timingSafeEqual(hitung, Buffer.from(hash, 'hex'));
}

export function pinLemah(pin) {
  if (!/^\d{6}$/.test(pin)) return 'PIN harus 6 angka.';
  if (/^(\d)\1{5}$/.test(pin)) return 'PIN tidak boleh angka yang sama semua.';
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'PIN tidak boleh angka berurutan.';
  return null;
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// Disimpan dalam format 08xxxxxxxxxx
export function normalHp(hp) {
  let d = String(hp ?? '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  if (d.startsWith('8')) d = '0' + d;
  return d;
}

export function ringkasPengguna(u) {
  return {
    id: u.id,
    nip: u.nip ?? null,
    nama: u.nama,
    hp: u.hp,
    is_pengajar: !!u.is_pengajar,
    level: u.level,
    tipe: u.tipe,
    is_admin: !!u.is_admin,
    is_petugas: !!u.is_petugas,
  };
}

const lewatHttps = (req) => !!req.socket?.encrypted || String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';

export async function buatSesi(req, res, penggunaId) {
  const token = randomBytes(32).toString('base64url');
  const kedaluwarsa = new Date(Date.now() + UMUR_SESI_HARI * 86400_000).toISOString();
  await run('INSERT INTO sesi_login (token_hash, pengguna_id, kedaluwarsa) VALUES (?, ?, ?)', sha256(token), penggunaId, kedaluwarsa);
  await run('DELETE FROM sesi_login WHERE kedaluwarsa < ?', new Date().toISOString());
  const secure = lewatHttps(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${UMUR_SESI_HARI * 86400}${secure}`);
}

export async function hapusSesi(req, res) {
  const token = bacaCookie(req, COOKIE);
  if (token) await run('DELETE FROM sesi_login WHERE token_hash = ?', sha256(token));
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export async function penggunaDariReq(req) {
  const token = bacaCookie(req, COOKIE);
  if (!token) return null;
  return (
    (await one(
      `SELECT u.* FROM sesi_login s JOIN pengguna u ON u.id = s.pengguna_id
       WHERE s.token_hash = ? AND s.kedaluwarsa > ? AND u.aktif = 1`,
      sha256(token),
      new Date().toISOString(),
    )) ?? null
  );
}

export async function buatUndangan(penggunaId) {
  const kode = randomBytes(9).toString('base64url');
  const kedaluwarsa = new Date(Date.now() + 7 * 86400_000).toISOString();
  await run('UPDATE pengguna SET undangan_kode = ?, undangan_kedaluwarsa = ? WHERE id = ?', kode, kedaluwarsa, penggunaId);
  return { kode, kedaluwarsa };
}
