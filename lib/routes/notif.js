import { one, all, run } from '../db.js';
import { gagal, teks, bulat, pilihan } from '../http.js';
import { kunciVapid, kirimNotif, idSemuaAktif, idKepala } from '../notif.js';

export default [
  {
    method: 'GET', path: '/api/notif', akses: 'login',
    handler: async ({ user }) => {
      const daftar = await all(
        'SELECT id, jenis, judul, isi, dibaca, dibuat FROM notifikasi WHERE pengguna_id = ? ORDER BY id DESC LIMIT 60',
        user.id,
      );
      const { n } = await one('SELECT COUNT(*)::int AS n FROM notifikasi WHERE pengguna_id = ? AND dibaca = 0', user.id);
      const push = await one('SELECT COUNT(*)::int AS n FROM push_langganan WHERE pengguna_id = ?', user.id);
      return { belum_dibaca: n, daftar, push_aktif: push.n > 0 };
    },
  },
  {
    method: 'GET', path: '/api/notif/jumlah', akses: 'login',
    handler: async ({ user }) => ({
      belum_dibaca: (await one('SELECT COUNT(*)::int AS n FROM notifikasi WHERE pengguna_id = ? AND dibaca = 0', user.id)).n,
    }),
  },
  {
    method: 'POST', path: '/api/notif/baca', akses: 'login',
    handler: async ({ user, body }) => {
      if (body.id) await run('UPDATE notifikasi SET dibaca = 1 WHERE id = ? AND pengguna_id = ?', bulat(body.id), user.id);
      else await run('UPDATE notifikasi SET dibaca = 1 WHERE pengguna_id = ? AND dibaca = 0', user.id);
      return { ok: true };
    },
  },
  {
    method: 'GET', path: '/api/push/kunci', akses: 'login',
    handler: async () => {
      return { kunci: (await kunciVapid()).publicKey };
    },
  },
  {
    method: 'POST', path: '/api/push/langganan', akses: 'login',
    handler: async ({ user, body }) => {
      const endpoint = teks(body.endpoint, { wajib: true, maks: 1000, label: 'Endpoint' });
      const p256dh = teks(body.keys?.p256dh, { wajib: true, maks: 300, label: 'Kunci' });
      const auth = teks(body.keys?.auth, { wajib: true, maks: 300, label: 'Kunci' });
      if (!/^https:\/\//.test(endpoint)) gagal(400, 'Endpoint tidak valid.');
      await run(
        `INSERT INTO push_langganan (pengguna_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET pengguna_id = excluded.pengguna_id, p256dh = excluded.p256dh, auth = excluded.auth`,
        user.id, endpoint, p256dh, auth,
      );
      return { ok: true };
    },
  },
  {
    method: 'POST', path: '/api/push/berhenti', akses: 'login',
    handler: async ({ user, body }) => {
      if (body.endpoint) await run('DELETE FROM push_langganan WHERE endpoint = ? AND pengguna_id = ?', String(body.endpoint), user.id);
      else await run('DELETE FROM push_langganan WHERE pengguna_id = ?', user.id);
      return { ok: true };
    },
  },
  // Admin: pengumuman (juga dipakai untuk menguji notifikasi).
  {
    method: 'GET', path: '/api/admin/pengumuman', akses: 'admin',
    handler: async () => ({
      perangkat: (await one('SELECT COUNT(DISTINCT pengguna_id)::int AS n FROM push_langganan')).n,
      terakhir: await all(
        `SELECT judul, isi, MIN(dibuat) AS dibuat, COUNT(*)::int AS penerima FROM notifikasi WHERE jenis = 'pengumuman'
         GROUP BY judul, isi, substr(dibuat, 1, 16) ORDER BY MIN(id) DESC LIMIT 5`,
      ),
    }),
  },
  {
    method: 'POST', path: '/api/admin/pengumuman', akses: 'admin',
    handler: async ({ user, body }) => {
      const judul = teks(body.judul, { wajib: true, maks: 80, label: 'Judul' });
      const isi = teks(body.isi, { maks: 1500, label: 'Isi' });
      const untuk = pilihan(body.untuk, ['saya', 'semua', 'pengajar', 'pimpinan'], 'Penerima');
      let ids;
      if (untuk === 'saya') ids = [user.id];
      else if (untuk === 'semua') ids = await idSemuaAktif();
      else if (untuk === 'pengajar') ids = await idSemuaAktif('AND is_pengajar = 1');
      else ids = [...(await idKepala()), ...(await idSemuaAktif("AND jabatan IN ('wakil_pgtksd', 'wakil_smpsma')"))];
      return kirimNotif(ids, { jenis: 'pengumuman', judul, isi });
    },
  },
];
