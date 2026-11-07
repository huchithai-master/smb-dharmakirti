// Notifikasi: disimpan di tabel `notifikasi` (lonceng di aplikasi) dan, bila perangkat berlangganan, dikirim lewat Web Push
// sehingga muncul di layar kunci. Kunci VAPID dibuat otomatis sekali dan disimpan di tabel pengaturan.
import { one, all, run, getSetting } from './db.js';
import { JENJANG_WAKIL } from './routes/siswa.js';
import { buatKunciVapid, kirimPush } from './webpush.js';

export async function kunciVapid() {
  let data = await getSetting('vapid');
  if (!data) {
    await run("INSERT INTO pengaturan (kunci, nilai) VALUES ('vapid', ?) ON CONFLICT (kunci) DO NOTHING", JSON.stringify(buatKunciVapid()));
    data = await getSetting('vapid');
  }
  return JSON.parse(data);
}

// Simpan notifikasi untuk tiap penerima lalu kirim push (tanpa menggagalkan proses utama bila push bermasalah).
// `isi` boleh berupa string (sama untuk semua) atau fungsi (idPenerima) => string.
// Isi push di layar kunci: ambil beberapa baris pertama saja; isi lengkap dibuka dari lonceng.
const ringkas = (t) => String(t || '').replace(/\n{2,}/g, '\n').split('\n').slice(0, 4).join('\n').slice(0, 180);

export async function kirimNotif(penerima, { jenis = 'info', judul, isi = '' }, kecuali = []) {
  const ids = [...new Set(penerima)].filter((id) => id && !kecuali.includes(id));
  if (!ids.length) return { dikirim: 0, push_ok: 0, push_gagal: 0 };
  const muatan = [];
  for (const id of ids) {
    const teks = typeof isi === 'function' ? isi(id) : isi;
    const baru = await one('INSERT INTO notifikasi (pengguna_id, jenis, judul, isi) VALUES (?, ?, ?, ?) RETURNING id', id, jenis, judul, teks || null);
    muatan.push({ id, teks, notifId: baru.id });
  }
  let ok = 0;
  let gagal = 0;
  try {
    const vapid = await kunciVapid();
    const subjek = process.env.VAPID_SUBJECT || 'mailto:admin@smb-dharmakirti.app';
    const dalam = ids.map(() => '?').join(',');
    const langganan = await all(`SELECT id, pengguna_id, endpoint, p256dh, auth FROM push_langganan WHERE pengguna_id IN (${dalam})`, ...ids);
    const teksDari = new Map(muatan.map((m) => [m.id, m.teks]));
    const notifDari = new Map(muatan.map((m) => [m.id, m.notifId]));
    await Promise.allSettled(
      langganan.map(async (l) => {
        try {
          await kirimPush(l, JSON.stringify({ title: judul, body: ringkas(teksDari.get(l.pengguna_id)), url: `/#/notifikasi?buka=${notifDari.get(l.pengguna_id)}` }), vapid, { subjek });
          ok++;
        } catch (e) {
          gagal++;
          if (e?.statusCode === 404 || e?.statusCode === 410) await run('DELETE FROM push_langganan WHERE id = ?', l.id);
        }
      }),
    );
  } catch (e) {
    console.error('Push gagal:', e?.message);
  }
  return { dikirim: ids.length, push_ok: ok, push_gagal: gagal };
}

export const idKepala = async () => (await all("SELECT id FROM pengguna WHERE aktif = 1 AND jabatan = 'kepala'")).map((r) => r.id);

// Wakil Kurikulum yang jenjangnya mencakup nama kelas ini.
export async function idWakilUntukKelas(kelasNama) {
  const rows = await all("SELECT id, jabatan FROM pengguna WHERE aktif = 1 AND jabatan IN ('wakil_pgtksd', 'wakil_smpsma')");
  return rows.filter((u) => JENJANG_WAKIL[u.jabatan]?.test(String(kelasNama).trim())).map((u) => u.id);
}

// Pembina dan asisten yang bertugas di kelas itu pada sesi tersebut.
export async function idRekanSekelas(kelasId, tanggal, slotId) {
  const a = await all('SELECT pengguna_id AS id FROM penugasan WHERE kelas_id = ? AND slot_id = ?', kelasId, slotId);
  const b = await all('SELECT pengguna_id AS id FROM tugas_harian WHERE kelas_id = ? AND slot_id = ? AND tanggal = ?', kelasId, slotId, tanggal);
  return [...a, ...b].map((r) => r.id);
}

export async function idSemuaAktif(filter = '') {
  return (await all(`SELECT id FROM pengguna WHERE aktif = 1 ${filter}`)).map((r) => r.id);
}
