import { one, all, run, tx, getSetting } from '../db.js';
import { gagal, teks, bulat, tanggal as cekTanggal, pilihan, HttpError } from '../http.js';
import { now, tglStr, tambahHari, akhirBulan } from '../waktu.js';
import { normalHp } from '../auth.js';
import { pengaturanHonor } from '../honor.js';
import { ambilSlot, tugasPengguna, liburPada, semuaKelas, slotHari, daftarSlot, pembinaUtamaId } from '../jadwal.js';

const STATUS_SISWA = ['hadir', 'izin', 'sakit', 'alpa'];

// Pembina boleh mengisi absensi siswa hanya setelah ia sendiri absen (scan QR) di sesi itu, pada hari itu.
async function sesiPembina(user, slotId) {
  const tanggal = tglStr(now());
  const slot = await ambilSlot(bulat(slotId, 'Sesi'));
  if (!slot) gagal(404, 'Sesi tidak ditemukan.');
  const libur = await liburPada(tanggal);
  if (libur) gagal(400, `Hari ini libur: ${libur.alasan}.`);
  const tugas = await tugasPengguna(user.id, tanggal, slot);
  if (!tugas || tugas.peran !== 'guru') gagal(403, 'Absensi siswa hanya bisa diisi oleh pembina kelas.');
  const kelasHariIni = (await daftarSlot(tanggal, slot))?.kelas.find((k) => k.id === tugas.kelas_id);
  const utama = pembinaUtamaId(kelasHariIni);
  if (utama && utama !== user.id) gagal(403, 'Absensi siswa dan materi hanya diisi pembina utama kelas. Pembina kedua dan cadangan tidak mengisinya.');
  const hadir = await one('SELECT id FROM absensi WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ?', user.id, tanggal, slot.id);
  if (!hadir) gagal(400, 'Absen dulu lewat scan QR. Absensi siswa terbuka setelah Anda tercatat hadir.');
  return { tanggal, slot, tugas };
}

async function bacaMurid(body, id = null) {
  const baru = id === null;
  const d = {
    nik: String(body.nik ?? '').trim() || null,
    nama: teks(body.nama, { wajib: true, maks: 80, label: 'Nama lengkap siswa' }),
    kelas_id: bulat(body.kelas_id, 'Kelas'),
    tempat_lahir: teks(body.tempat_lahir, { wajib: true, maks: 60, label: 'Tempat lahir' }),
    tanggal_lahir: cekTanggal(body.tanggal_lahir, 'Tanggal lahir'),
    hp: String(body.hp ?? '').trim() ? normalHp(body.hp) : null,
    nama_ortu: teks(body.nama_ortu, { wajib: true, maks: 80, label: 'Nama orang tua' }),
    hp_ortu: normalHp(body.hp_ortu),
    asal_sekolah: teks(body.asal_sekolah, { wajib: true, maks: 80, label: 'Asal sekolah' }),
    // Wajib untuk siswa baru; siswa lama yang belum punya alamat tetap bisa diedit tanpa mengisinya.
    alamat: String(body.alamat ?? '').trim() ? teks(body.alamat, { maks: 200, label: 'Alamat siswa' }) : baru ? teks('', { wajib: true, label: 'Alamat siswa' }) : null,
    aktif: body.aktif === false ? 0 : 1,
  };
  if (d.nik) {
    if (!/^\d{16}$/.test(d.nik)) gagal(400, 'NIK harus 16 digit angka, atau kosongkan dulu bila belum diketahui.');
    const dobel = await one('SELECT nama FROM murid WHERE nik = ? AND id != ?', d.nik, id ?? 0);
    if (dobel) gagal(400, `NIK sudah terdaftar atas nama ${dobel.nama}.`);
  }
  if (!(await one('SELECT id FROM kelas WHERE id = ?', d.kelas_id))) gagal(400, 'Kelas tidak ditemukan.');
  if (d.tanggal_lahir > tglStr(now())) gagal(400, 'Tanggal lahir tidak boleh di masa depan.');
  if (d.hp && !/^08\d{7,12}$/.test(d.hp)) gagal(400, 'No. HP siswa tidak valid.');
  if (!/^08\d{7,12}$/.test(d.hp_ortu)) gagal(400, 'No. HP orang tua tidak valid.');
  return d;
}

// Kelas yang diampu pembina: jadwal tetap (penugasan) ditambah tugas pembina pengganti/tambahan yang masih berlaku.
// Pembina utama (tetap, pembina pertama di kelasnya) selalu memegang kelasnya. Pembina kedua, cadangan, dan
// pengganti hanya memegang kelas pada hari mereka benar-benar bertugas. Tanggal mulai jadwal tidak memengaruhi ini: pembina tetap selalu melihat murid kelasnya (ada tugas pembina di sesi hari ini).
// Kepala SMB tidak memakai Data Murid pembina: ia memakai daftar semua murid seperti admin.
// Wakil Kurikulum yang berstatus pembina (termasuk pembina cadangan) juga melihat Data Murid seluruh jenjangnya:
// wakil_pgtksd untuk kelas PG, TK, dan SD; wakil_smpsma untuk kelas SMP dan SMA. Dikenali dari nama kelas.
const JENJANG_WAKIL = {
  wakil_pgtksd: /^(PG|TK)(\s|$)|(^|\s)SD(\s|$)/i,
  wakil_smpsma: /(^|\s)(SMP|SMA)(\s|$)/i,
};

// Id kelas satu jenjang untuk Wakil Kurikulum (dipakai tab Wakil: izin & atur tugas). null bila bukan wakil.
export async function idKelasJenjang(user) {
  const jenjang = JENJANG_WAKIL[user.jabatan];
  if (!jenjang) return null;
  return new Set((await all('SELECT id, nama FROM kelas')).filter((k) => jenjang.test(k.nama.trim())).map((k) => k.id));
}

export async function kelasPembina(user) {
  if (user.level !== 'guru' || user.jabatan === 'kepala') gagal(403, 'Data Murid hanya untuk pembina.');
  const hariIni = tglStr(now());
  const ids = new Set();
  if (user.tipe === 'tetap') {
    const utama = await all(
      `SELECT p.kelas_id FROM penugasan p WHERE p.pengguna_id = ? AND p.peran = 'guru'
         AND NOT EXISTS (SELECT 1 FROM penugasan q WHERE q.kelas_id = p.kelas_id AND q.slot_id = p.slot_id
           AND q.peran = 'guru' AND q.pengguna_id != p.pengguna_id AND (q.mulai < p.mulai OR (q.mulai = p.mulai AND q.id < p.id)))`,
      user.id,
    );
    for (const r of utama) ids.add(r.kelas_id);
  }
  for (const slot of await slotHari(hariIni)) {
    const t = await tugasPengguna(user.id, hariIni, slot);
    if (t?.peran === 'guru') ids.add(t.kelas_id);
  }
  const jenjang = JENJANG_WAKIL[user.jabatan];
  if (jenjang) {
    for (const k of await all('SELECT id, nama FROM kelas')) if (jenjang.test(k.nama.trim())) ids.add(k.id);
  }
  if (!ids.size) return [];
  return all(`SELECT id, nama, urutan FROM kelas WHERE id IN (${[...ids].map(() => '?').join(',')}) ORDER BY urutan, id`, ...ids);
}

// Murid yang kelasnya diampu pembina ini, atau 404/403.
async function muridPembinaById(user, idMentah) {
  const kelas = await kelasPembina(user);
  const m = await one('SELECT id, ' + MURID_BACA + ' FROM murid WHERE id = ?', bulat(idMentah));
  if (!m) gagal(404, 'Murid tidak ditemukan.');
  if (!kelas.some((k) => k.id === m.kelas_id)) gagal(403, 'Murid ini bukan dari kelas yang Anda ampu.');
  return { m, kelas };
}

// NIK bersifat rahasia: setelah disimpan tidak pernah dikirim kembali ke aplikasi (hanya penanda nik_ada). Ambil dari database bila perlu.
// Impor massal dari Excel: tiap baris divalidasi seperti input satu per satu. simpan=false hanya memeriksa.
const BATAS_IMPOR = 500;
async function imporMurid(kelasBoleh, body) {
  const baris = Array.isArray(body.murid) ? body.murid : [];
  if (!baris.length) gagal(400, 'Tidak ada data murid untuk diimpor.');
  if (baris.length > BATAS_IMPOR) gagal(400, `Maksimal ${BATAS_IMPOR} murid per impor.`);
  const kelasPeta = new Map(kelasBoleh.map((k) => [String(k.nama).trim().toLowerCase(), k.id]));
  const nikDalamFile = new Set();
  const hasil = [];
  const siap = [];
  for (const [i, b] of baris.entries()) {
    const no = Number(b.baris) || i + 2;
    const nama = String(b.nama ?? '').trim();
    try {
      const kelasId = kelasPeta.get(String(b.kelas ?? '').trim().toLowerCase());
      if (!kelasId) gagal(400, `Kelas "${String(b.kelas ?? '').trim()}" tidak ditemukan atau bukan kelas yang boleh Anda isi.`);
      const d = await bacaMurid({ ...b, kelas_id: kelasId, aktif: true });
      if (d.nik) {
        if (nikDalamFile.has(d.nik)) gagal(400, 'NIK dobel di dalam file ini.');
        nikDalamFile.add(d.nik);
      }
      siap.push(d);
      hasil.push({ baris: no, nama, pesan: null });
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      hasil.push({ baris: no, nama, pesan: e.message });
    }
  }
  let tersimpan = 0;
  if (body.simpan === true && siap.length) {
    await tx(async () => {
      for (const d of siap) {
        await run(
          `INSERT INTO murid (${MURID_KOLOM}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          d.nik, d.nama, d.kelas_id, d.tempat_lahir, d.tanggal_lahir, d.hp, d.nama_ortu, d.hp_ortu, d.asal_sekolah, d.alamat, d.aktif,
        );
        tersimpan += 1;
      }
    });
  }
  return { baris: hasil, tersimpan };
}

const MURID_BACA = "nama, kelas_id, tempat_lahir, tanggal_lahir, hp, nama_ortu, hp_ortu, asal_sekolah, alamat, aktif, (nik IS NOT NULL) AS nik_ada";
const MURID_KOLOM = 'nik, nama, kelas_id, tempat_lahir, tanggal_lahir, hp, nama_ortu, hp_ortu, asal_sekolah, alamat, aktif';
const NOW_UTC = "to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')";

export default [
  // ---- Pembina: absensi siswa & materi ----
  {
    method: 'GET', path: '/api/siswa', akses: 'pengajar',
    handler: async ({ user, query }) => {
      const { tanggal, slot, tugas } = await sesiPembina(user, query.slot_id);
      const tercatat = new Map(
        (await all('SELECT murid_id, status FROM absensi_murid WHERE tanggal = ? AND slot_id = ? AND kelas_id = ?', tanggal, slot.id, tugas.kelas_id))
          .map((r) => [r.murid_id, r.status]),
      );
      const murid = (await all('SELECT id, nama, aktif FROM murid WHERE kelas_id = ? ORDER BY nama', tugas.kelas_id))
        .filter((m) => m.aktif || tercatat.has(m.id))
        .map((m) => ({ id: m.id, nama: m.nama, status: tercatat.get(m.id) ?? null }));
      const materi = await one('SELECT isi FROM materi WHERE tanggal = ? AND slot_id = ? AND kelas_id = ?', tanggal, slot.id, tugas.kelas_id);
      return {
        tanggal, slot_id: slot.id, slot_nama: slot.nama, kelas_id: tugas.kelas_id, kelas_nama: tugas.kelas_nama,
        murid, absensi_tersimpan: tercatat.size > 0, materi: materi?.isi ?? '',
      };
    },
  },
  {
    method: 'PUT', path: '/api/siswa/absensi', akses: 'pengajar',
    handler: async ({ user, body }) => {
      const { tanggal, slot, tugas } = await sesiPembina(user, body.slot_id);
      const aktif = (await all('SELECT id FROM murid WHERE kelas_id = ? AND aktif = 1', tugas.kelas_id)).map((m) => m.id);
      const kirim = new Map();
      for (const a of Array.isArray(body.absen) ? body.absen : []) {
        kirim.set(bulat(a.murid_id, 'Siswa'), pilihan(a.status, STATUS_SISWA, 'Status'));
      }
      const anggota = new Set((await all('SELECT id FROM murid WHERE kelas_id = ?', tugas.kelas_id)).map((m) => m.id));
      for (const id of kirim.keys()) {
        if (!anggota.has(id)) gagal(400, 'Ada siswa yang bukan anggota kelas ini.');
      }
      if (aktif.some((id) => !kirim.has(id))) gagal(400, 'Semua siswa harus diisi statusnya.');
      await tx(async () => {
        for (const [id, status] of kirim) {
          await run(
            `INSERT INTO absensi_murid (tanggal, slot_id, kelas_id, murid_id, status, dicatat_oleh) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (tanggal, slot_id, murid_id) DO UPDATE SET status = excluded.status, dicatat_oleh = excluded.dicatat_oleh, waktu = ${NOW_UTC}`,
            tanggal, slot.id, tugas.kelas_id, id, status, user.id,
          );
        }
      });
      return { ok: true, hadir: [...kirim.values()].filter((s) => s === 'hadir').length, total: kirim.size };
    },
  },
  {
    method: 'PUT', path: '/api/siswa/materi', akses: 'pengajar',
    handler: async ({ user, body }) => {
      const { tanggal, slot, tugas } = await sesiPembina(user, body.slot_id);
      const isi = teks(body.isi, { wajib: true, maks: 1000, label: 'Materi' });
      const adaMurid = await one('SELECT id FROM murid WHERE kelas_id = ? AND aktif = 1', tugas.kelas_id);
      const sudahAbsen = await one('SELECT id FROM absensi_murid WHERE tanggal = ? AND slot_id = ? AND kelas_id = ?', tanggal, slot.id, tugas.kelas_id);
      if (adaMurid && !sudahAbsen) gagal(400, 'Selesaikan absensi siswa dulu, baru isi materi.');
      await run(
        `INSERT INTO materi (tanggal, slot_id, kelas_id, isi, dicatat_oleh) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (tanggal, slot_id, kelas_id) DO UPDATE SET isi = excluded.isi, dicatat_oleh = excluded.dicatat_oleh, waktu = ${NOW_UTC}`,
        tanggal, slot.id, tugas.kelas_id, isi, user.id,
      );
      return { ok: true };
    },
  },

  // ---- Pembina: data murid kelasnya ----
  {
    method: 'GET', path: '/api/pembina/murid', akses: 'pengajar',
    handler: async ({ user }) => {
      const kelas = await kelasPembina(user);
      const ids = kelas.map((k) => k.id);
      const murid = ids.length
        ? (await all(
          `SELECT m.id, m.nama, m.kelas_id, k.nama AS kelas_nama, m.tanggal_lahir, m.asal_sekolah, m.nama_ortu, m.hp_ortu, m.aktif
           FROM murid m JOIN kelas k ON k.id = m.kelas_id WHERE m.kelas_id IN (${ids.map(() => '?').join(',')})
           ORDER BY m.aktif DESC, k.urutan, m.nama`,
          ...ids,
        )).map((m) => ({ ...m, aktif: !!m.aktif }))
        : [];
      return { kelas, murid };
    },
  },
  {
    method: 'POST', path: '/api/pembina/murid', akses: 'pengajar',
    handler: async ({ user, body }) => {
      const kelas = await kelasPembina(user);
      const d = await bacaMurid({ ...body, aktif: true });
      if (!kelas.some((k) => k.id === d.kelas_id)) gagal(403, 'Anda hanya bisa menambah murid di kelas yang Anda ampu.');
      const r = await one(
        `INSERT INTO murid (${MURID_KOLOM}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        d.nik, d.nama, d.kelas_id, d.tempat_lahir, d.tanggal_lahir, d.hp, d.nama_ortu, d.hp_ortu, d.asal_sekolah, d.alamat, d.aktif,
      );
      return { ok: true, id: r.id };
    },
  },

  {
    method: 'POST', path: '/api/pembina/murid/impor', akses: 'pengajar',
    handler: async ({ user, body }) => imporMurid(await kelasPembina(user), body),
  },
  {
    method: 'GET', path: '/api/pembina/murid/:id', akses: 'pengajar',
    handler: async ({ user, params }) => {
      const { m, kelas } = await muridPembinaById(user, params.id);
      return { murid: { ...m, aktif: !!m.aktif }, kelas };
    },
  },
  {
    method: 'PUT', path: '/api/pembina/murid/:id', akses: 'pengajar',
    handler: async ({ user, params, body }) => {
      const { m, kelas } = await muridPembinaById(user, params.id);
      const d = await bacaMurid(body, m.id);
      if (!kelas.some((k) => k.id === d.kelas_id)) gagal(403, 'Anda hanya bisa memindahkan murid ke kelas yang Anda ampu.');
      await run(
        `UPDATE murid SET nik = COALESCE(?, nik), nama = ?, kelas_id = ?, tempat_lahir = ?, tanggal_lahir = ?, hp = ?, nama_ortu = ?,
         hp_ortu = ?, asal_sekolah = ?, alamat = ?, aktif = ? WHERE id = ?`,
        d.nik, d.nama, d.kelas_id, d.tempat_lahir, d.tanggal_lahir, d.hp, d.nama_ortu, d.hp_ortu, d.asal_sekolah, d.alamat, d.aktif, m.id,
      );
      return { ok: true };
    },
  },
  // Arsipkan (aktif=false) atau aktifkan kembali. Riwayat absensi tetap tersimpan.
  {
    method: 'PUT', path: '/api/pembina/murid/:id/aktif', akses: 'pengajar',
    handler: async ({ user, params, body }) => {
      const { m } = await muridPembinaById(user, params.id);
      await run('UPDATE murid SET aktif = ? WHERE id = ?', body.aktif === false ? 0 : 1, m.id);
      return { ok: true };
    },
  },
  // Hapus permanen hanya bila belum punya riwayat absensi; kalau sudah, arsipkan saja.
  {
    method: 'DELETE', path: '/api/pembina/murid/:id', akses: 'pengajar',
    handler: async ({ user, params }) => {
      const { m } = await muridPembinaById(user, params.id);
      if (await one('SELECT id FROM absensi_murid WHERE murid_id = ? LIMIT 1', m.id)) {
        gagal(400, 'Murid ini sudah punya riwayat absensi sehingga tidak bisa dihapus. Arsipkan saja agar riwayat tetap aman.');
      }
      await run('DELETE FROM murid WHERE id = ?', m.id);
      return { ok: true };
    },
  },

  // ---- Admin: data siswa ----
  {
    method: 'GET', path: '/api/admin/murid', akses: 'laporan',
    handler: async () => ({
      kelas: await semuaKelas(),
      murid: (await all(
        `SELECT m.id, m.nama, m.kelas_id, k.nama AS kelas_nama, m.asal_sekolah, m.nama_ortu, m.hp_ortu, m.aktif
         FROM murid m JOIN kelas k ON k.id = m.kelas_id ORDER BY m.aktif DESC, k.urutan, m.nama`,
      )).map((m) => ({ ...m, aktif: !!m.aktif })),
    }),
  },
  {
    method: 'POST', path: '/api/admin/murid/impor', akses: 'laporan',
    handler: async ({ body }) => imporMurid(await semuaKelas(), body),
  },
  {
    method: 'GET', path: '/api/admin/murid/:id', akses: 'laporan',
    handler: async ({ params }) => {
      const m = await one('SELECT id, ' + MURID_BACA + ' FROM murid WHERE id = ?', bulat(params.id));
      if (!m) gagal(404, 'Siswa tidak ditemukan.');
      return { murid: { ...m, aktif: !!m.aktif }, kelas: await semuaKelas() };
    },
  },
  {
    method: 'POST', path: '/api/admin/murid', akses: 'laporan',
    handler: async ({ body }) => {
      const d = await bacaMurid(body);
      const r = await one(
        `INSERT INTO murid (${MURID_KOLOM}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        d.nik, d.nama, d.kelas_id, d.tempat_lahir, d.tanggal_lahir, d.hp, d.nama_ortu, d.hp_ortu, d.asal_sekolah, d.alamat, d.aktif,
      );
      return { ok: true, id: r.id };
    },
  },
  {
    method: 'PUT', path: '/api/admin/murid/:id', akses: 'laporan',
    handler: async ({ params, body }) => {
      const id = bulat(params.id);
      if (!(await one('SELECT id FROM murid WHERE id = ?', id))) gagal(404, 'Siswa tidak ditemukan.');
      const d = await bacaMurid(body, id);
      await run(
        `UPDATE murid SET nik = COALESCE(?, nik), nama = ?, kelas_id = ?, tempat_lahir = ?, tanggal_lahir = ?, hp = ?, nama_ortu = ?,
         hp_ortu = ?, asal_sekolah = ?, alamat = ?, aktif = ? WHERE id = ?`,
        d.nik, d.nama, d.kelas_id, d.tempat_lahir, d.tanggal_lahir, d.hp, d.nama_ortu, d.hp_ortu, d.asal_sekolah, d.alamat, d.aktif, id,
      );
      return { ok: true };
    },
  },

  // ---- Admin: rekap absensi murid + materi per bulan ----
  {
    method: 'GET', path: '/api/admin/rekap-murid', akses: 'laporan',
    handler: async ({ query }) => {
      const hariIni = tglStr(now());
      const bulan = /^\d{4}-\d{2}$/.test(query.bulan ?? '') ? query.bulan : hariIni.slice(0, 7);
      const akhir = akhirBulan(bulan);
      const batas = hariIni < akhir ? hariIni : akhir;
      const kelasId = query.kelas_id ? bulat(query.kelas_id, 'Kelas') : null;
      const [absenRows, murid, kelasSemua, liburRows, kepala, kop, viharaNama] = await Promise.all([
        all('SELECT tanggal, slot_id, murid_id, status FROM absensi_murid WHERE substr(tanggal, 1, 7) = ?', bulan),
        all('SELECT id, nama, kelas_id, aktif FROM murid ORDER BY nama'),
        semuaKelas(),
        all('SELECT jenis, mulai, selesai, alasan FROM libur WHERE mulai <= ? AND selesai >= ? ORDER BY mulai', akhir, `${bulan}-01`),
        one("SELECT nama FROM pengguna WHERE jabatan = 'kepala' AND aktif = 1"),
        pengaturanHonor(),
        getSetting('nama_vihara'),
      ]);
      const status = new Map(absenRows.map((a) => [`${a.tanggal}|${a.slot_id}|${a.murid_id}`, a.status]));
      const kelas = kelasSemua.filter((k) => !kelasId || k.id === kelasId).map((k) => ({ ...k, sesi: [], murid: [] }));
      const tanggalList = [];
      for (let t = `${bulan}-01`; t <= batas; t = tambahHari(t, 1)) tanggalList.push(t);
      const sesiList = (
        await Promise.all(
          tanggalList.map(async (t) => {
            const hasil = [];
            for (const slot of await slotHari(t)) hasil.push({ t, slot, d: await daftarSlot(t, slot) });
            return hasil;
          }),
        )
      ).flat();
      for (const { t, slot, d } of sesiList) {
        for (const k of kelas) {
          const dk = d.kelas.find((x) => x.id === k.id);
          if (!dk || d.status_slot === 'nanti') continue;
          k.sesi.push({
            kunci: `${t}|${slot.id}`, tanggal: t, slot_id: slot.id, slot_nama: slot.nama, materi: dk.materi,
            pembina: dk.anggota.filter((a) => a.peran === 'guru' && (a.status === 'hadir' || a.status === 'terlambat')).map((a) => a.nama),
            hadir: dk.siswa.hadir, total: dk.siswa.tercatat,
          });
        }
      }
      for (const k of kelas) {
        for (const mu of murid.filter((x) => x.kelas_id === k.id)) {
          const sel = {};
          const r = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
          for (const s of k.sesi) {
            const st = status.get(`${s.kunci}|${mu.id}`);
            if (st) {
              sel[s.kunci] = st;
              r[st]++;
            }
          }
          const total = r.hadir + r.izin + r.sakit + r.alpa;
          if (!mu.aktif && !total) continue;
          k.murid.push({ id: mu.id, nama: mu.nama, aktif: !!mu.aktif, sel, ringkasan: r, persen: total ? Math.round((r.hadir / total) * 100) : null });
        }
      }
      return {
        bulan, hari_ini: hariIni, kelas, daftar_kelas: kelasSemua, libur: liburRows,
        nama_vihara: viharaNama ?? '', kop, kepala: kepala?.nama ?? null,
      };
    },
  },

  // ---- Admin: hari libur ----
  {
    method: 'GET', path: '/api/admin/libur', akses: 'admin',
    handler: async () => ({ libur: await all('SELECT id, jenis, mulai, selesai, alasan FROM libur ORDER BY mulai DESC'), hari_ini: tglStr(now()) }),
  },
  {
    method: 'POST', path: '/api/admin/libur', akses: 'admin',
    handler: async ({ user, body }) => {
      const jenis = pilihan(body.jenis, ['harian', 'semester'], 'Jenis libur');
      const mulai = cekTanggal(body.mulai, 'Tanggal');
      const selesai = jenis === 'harian' ? mulai : cekTanggal(body.selesai, 'Tanggal selesai');
      if (selesai < mulai) gagal(400, 'Tanggal selesai tidak boleh sebelum tanggal mulai.');
      if (mulai < tglStr(now())) gagal(400, 'Libur hanya bisa dibuat mulai hari ini. Tanggal yang sudah lewat tidak diubah.');
      const alasan = teks(body.alasan, { wajib: jenis === 'harian', maks: 120, label: 'Alasan libur' }) || 'Libur Semester';
      if (await one('SELECT id FROM libur WHERE mulai <= ? AND selesai >= ?', selesai, mulai)) gagal(400, 'Tanggal ini bertumpuk dengan libur yang sudah ada.');
      await run('INSERT INTO libur (jenis, mulai, selesai, alasan, dibuat_oleh) VALUES (?, ?, ?, ?, ?)', jenis, mulai, selesai, alasan, user.id);
      return { ok: true };
    },
  },
  {
    method: 'DELETE', path: '/api/admin/libur/:id', akses: 'admin',
    handler: async ({ params }) => {
      const r = await run('DELETE FROM libur WHERE id = ?', bulat(params.id));
      if (!r.changes) gagal(404, 'Libur tidak ditemukan.');
      return { ok: true };
    },
  },
];
