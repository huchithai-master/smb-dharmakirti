import { one, run } from '../db.js';
import { gagal } from '../http.js';
import { cekPin, hashPin, pinLemah, normalHp, buatSesi, hapusSesi, ringkasPengguna } from '../auth.js';
import { infoWaktu } from '../waktu.js';

const MAKS_GAGAL = 5;
const KUNCI_MENIT = 15;

async function undanganSah(kode) {
  const u = await one('SELECT * FROM pengguna WHERE undangan_kode = ? AND aktif = 1', String(kode ?? ''));
  if (!u || !u.undangan_kedaluwarsa || new Date(u.undangan_kedaluwarsa) < new Date()) {
    gagal(404, 'Link undangan tidak berlaku atau sudah kedaluwarsa. Minta link baru ke admin.');
  }
  return u;
}

export default [
  {
    method: 'POST', path: '/api/login', akses: 'publik',
    handler: async ({ req, res, body }) => {
      const hp = normalHp(body.hp);
      const pin = String(body.pin ?? '');
      const u = await one('SELECT * FROM pengguna WHERE hp = ?', hp);
      if (u?.kunci_sampai && new Date(u.kunci_sampai) > new Date()) {
        const sisa = Math.ceil((new Date(u.kunci_sampai) - new Date()) / 60000);
        gagal(429, `Terlalu banyak percobaan. Coba lagi dalam ${sisa} menit.`);
      }
      if (!u || !u.aktif || !u.pin_hash || !cekPin(pin, u.pin_hash)) {
        if (u) {
          const n = u.gagal_login + 1;
          const kunci = n >= MAKS_GAGAL ? new Date(Date.now() + KUNCI_MENIT * 60000).toISOString() : null;
          await run('UPDATE pengguna SET gagal_login = ?, kunci_sampai = ? WHERE id = ?', kunci ? 0 : n, kunci, u.id);
        }
        gagal(401, 'No. HP atau PIN salah.');
      }
      await run('UPDATE pengguna SET gagal_login = 0, kunci_sampai = NULL WHERE id = ?', u.id);
      await buatSesi(req, res, u.id, { ingat: body.ingat !== false });
      return { pengguna: ringkasPengguna(u) };
    },
  },
  {
    method: 'POST', path: '/api/logout', akses: 'publik',
    handler: async ({ req, res }) => {
      await hapusSesi(req, res);
      return { ok: true };
    },
  },
  {
    method: 'GET', path: '/api/me', akses: 'publik',
    handler: async ({ user }) => ({
      pengguna: user ? ringkasPengguna(user) : null,
      waktu: infoWaktu(),
    }),
  },
  {
    method: 'GET', path: '/api/aktivasi/:kode', akses: 'publik',
    handler: async ({ params }) => {
      const u = await undanganSah(params.kode);
      return { nama: u.nama, hp_akhir: u.hp.slice(-3), sudah_punya_pin: !!u.pin_hash };
    },
  },
  {
    method: 'POST', path: '/api/aktivasi', akses: 'publik',
    handler: async ({ req, res, body }) => {
      const u = await undanganSah(body.kode);
      if (normalHp(body.hp) !== u.hp) gagal(400, 'No. HP tidak sesuai dengan undangan ini.');
      const pin = String(body.pin ?? '');
      const lemah = pinLemah(pin);
      if (lemah) gagal(400, lemah);
      await run(
        `UPDATE pengguna SET pin_hash = ?, undangan_kode = NULL, undangan_kedaluwarsa = NULL,
         gagal_login = 0, kunci_sampai = NULL WHERE id = ?`,
        hashPin(pin), u.id,
      );
      await run('DELETE FROM sesi_login WHERE pengguna_id = ?', u.id);
      await buatSesi(req, res, u.id);
      return { pengguna: ringkasPengguna(u) };
    },
  },
];
