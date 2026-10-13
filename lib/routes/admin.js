import { one, all, run, tx, setSetting, getSetting } from '../db.js';
import { gagal, teks, bulat, tanggal as cekTanggal, jam as cekJam, pilihan } from '../http.js';
import { now, tglStr, hariDari, tambahHari, akhirBulan } from '../waktu.js';
import { normalHp, buatUndangan } from '../auth.js';
import { JABATAN, BAWAAN, pengaturanHonor, simpanPengaturanHonor, hitungHonor, nomorSurat } from '../honor.js';
import {
  slotHari, semuaKelas, ambilSlot, statusSlot, tanggalAktif, tugasPengguna, daftarSlot, slotJadwal,
  kandidatPengganti, izinMenunggu, butuhPengganti, riwayatPengguna, liburPada, kelasUntukSlot, kelasDiSlot,
} from '../jadwal.js';

const hariIni = () => tglStr(now());

async function pilihTanggalSlot(query) {
  const t = query.tanggal ? cekTanggal(query.tanggal) : await tanggalAktif();
  const slots = (await slotHari(t)).map((s) => ({ ...s, status_slot: statusSlot(s, t) }));
  const diminta = query.slot_id ? Number(query.slot_id) : null;
  const slot = slots.find((s) => s.id === diminta) ?? slots.find((s) => s.status_slot === 'buka') ?? slots.find((s) => s.status_slot === 'nanti') ?? slots[0] ?? null;
  return { tanggal: t, slots, slot };
}

// Penugasan harian hanya boleh dibuat untuk sesi yang belum selesai, pada hari yang sesuai slotnya.
async function cekSesiTerbuka(t, slot) {
  if (!slot) gagal(404, 'Slot tidak ditemukan.');
  if (hariDari(t) !== slot.hari) gagal(400, `Slot ${slot.nama} tidak ada di tanggal tersebut.`);
  const libur = await liburPada(t);
  if (libur) gagal(400, `Tanggal tersebut libur: ${libur.alasan}.`);
  if (statusSlot(slot, t) === 'selesai') gagal(400, 'Sesi ini sudah selesai.');
}

async function bacaPengguna(body, id = null) {
  const data = {
    nip: String(body.nip ?? '').trim(),
    nama: teks(body.nama, { wajib: true, maks: 80, label: 'Nama lengkap' }),
    hp: normalHp(body.hp),
    is_pengajar: body.is_pengajar ? 1 : 0,
    is_admin: body.is_admin ? 1 : 0,
    is_petugas: body.is_petugas ? 1 : 0,
    aktif: body.aktif === false ? 0 : 1,
  };
  if (!/^08\d{7,12}$/.test(data.hp)) gagal(400, 'No. HP tidak valid.');
  if (data.is_pengajar && !data.nip) gagal(400, 'NIPSMB wajib diisi untuk pembina/asisten.');
  if (data.nip && !/^\d{3,20}$/.test(data.nip)) gagal(400, 'NIPSMB hanya boleh angka (3-20 digit).');
  if (!data.nip) data.nip = null;
  if (data.nip) {
    const sama = await one('SELECT nama FROM pengguna WHERE nip = ? AND id != ?', data.nip, id ?? 0);
    if (sama) gagal(400, `NIPSMB sudah dipakai oleh ${sama.nama}.`);
  }
  const dobel = await one('SELECT id, nama FROM pengguna WHERE hp = ? AND id != ?', data.hp, id ?? 0);
  if (dobel) gagal(400, `No. HP sudah dipakai oleh ${dobel.nama}.`);
  if (!data.is_pengajar && !data.is_admin && !data.is_petugas) gagal(400, 'Pilih minimal satu peran: pengajar, admin, atau petugas QR.');
  data.jabatan = body.jabatan ? pilihan(body.jabatan, Object.keys(JABATAN), 'Jabatan') : null;
  if (data.jabatan) {
    const pemegang = await one('SELECT nama FROM pengguna WHERE jabatan = ? AND id != ? AND aktif = 1', data.jabatan, id ?? 0);
    if (pemegang) gagal(400, `Jabatan ${JABATAN[data.jabatan]} sudah dipegang ${pemegang.nama}. Kosongkan dulu jabatannya.`);
  }
  data.level = data.is_pengajar ? pilihan(body.level, ['guru', 'asisten'], 'Level') : null;
  data.tipe = data.is_pengajar ? pilihan(body.tipe, ['tetap', 'cadangan'], 'Tipe') : null;

  const penugasan = [];
  if (data.is_pengajar && data.tipe === 'tetap') {
    const terpakai = new Set();
    for (const p of Array.isArray(body.penugasan) ? body.penugasan : []) {
      const slot = await ambilSlot(bulat(p.slot_id, 'Slot'));
      const kelas = await one('SELECT * FROM kelas WHERE id = ?', bulat(p.kelas_id, 'Kelas'));
      if (!slot || !kelas) gagal(400, 'Kelas atau slot tidak ditemukan.');
      if (!(await kelasDiSlot(kelas.id, slot.id))) gagal(400, `Kelas ${kelas.nama} tidak terdaftar di sesi ${slot.nama}.`);
      if (terpakai.has(slot.id)) gagal(400, `Bentrok: dua kelas di slot ${slot.nama}.`);
      terpakai.add(slot.id);
      const peran = pilihan(p.peran, ['guru', 'asisten'], 'Peran');
      if (peran === 'guru') {
        const lain = await all(
          `SELECT u.nama FROM penugasan p JOIN pengguna u ON u.id = p.pengguna_id
           WHERE p.kelas_id = ? AND p.slot_id = ? AND p.peran = 'guru' AND p.pengguna_id != ?`,
          kelas.id, slot.id, id ?? 0,
        );
        if (lain.length >= 2) gagal(400, `Kelas ${kelas.nama} (${slot.nama}) sudah punya 2 pembina: ${lain.map((l) => l.nama).join(' dan ')}.`);
        if (lain.length === 1 && !body.setuju_pembina_kedua) {
          gagal(400, `Kelas ${kelas.nama} (${slot.nama}) sudah punya pembina: ${lain[0].nama}. Pembina kedua harus disetujui admin.`);
        }
      }
      penugasan.push({ slot_id: slot.id, kelas_id: kelas.id, peran });
    }
  }
  return { data, penugasan };
}

// Jadwal yang tidak berubah mempertahankan tanggal mulainya; jadwal baru/berubah berlaku mulai hari ini.
async function simpanPenugasan(penggunaId, penugasan) {
  const lama = await all('SELECT kelas_id, slot_id, peran, mulai FROM penugasan WHERE pengguna_id = ?', penggunaId);
  await run('DELETE FROM penugasan WHERE pengguna_id = ?', penggunaId);
  for (const p of penugasan) {
    const sama = lama.find((l) => l.slot_id === p.slot_id && l.kelas_id === p.kelas_id && l.peran === p.peran);
    await run(
      'INSERT INTO penugasan (pengguna_id, kelas_id, slot_id, peran, mulai) VALUES (?, ?, ?, ?, ?)',
      penggunaId, p.kelas_id, p.slot_id, p.peran, sama?.mulai ?? hariIni(),
    );
  }
}

// Sesi (slot) tempat kelas berlangsung. Bila sudah ada slot, kelas wajib masuk minimal satu sesi.
async function bacaSlotKelas(body) {
  const semua = (await all('SELECT id FROM slot')).map((s) => s.id);
  const ids = [...new Set((Array.isArray(body.slot_ids) ? body.slot_ids : []).map((x) => bulat(x, 'Sesi')))];
  for (const id of ids) if (!semua.includes(id)) gagal(400, 'Sesi tidak ditemukan.');
  if (semua.length && !ids.length) gagal(400, 'Pilih minimal satu sesi (pagi atau siang) untuk kelas ini.');
  return ids;
}

function csvSel(v) {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const penggunaRingkas = (u) => ({
  id: u.id, nip: u.nip, nama: u.nama, hp: u.hp, is_pengajar: !!u.is_pengajar,
  level: u.level, tipe: u.tipe, is_admin: !!u.is_admin, is_petugas: !!u.is_petugas, aktif: !!u.aktif,
  sudah_aktivasi: !!u.pin_hash, jabatan: u.jabatan,
});

function bacaSlot(body) {
  const s = {
    nama: teks(body.nama, { wajib: true, maks: 30, label: 'Nama slot' }),
    hari: bulat(body.hari, 'Hari'),
    jam_mulai: cekJam(body.jam_mulai, 'Jam mulai'),
    jam_selesai: cekJam(body.jam_selesai, 'Jam selesai'),
    mode: pilihan(body.mode, ['konfirmasi', 'masuk'], 'Mode'),
    scan_mulai: cekJam(body.scan_mulai, 'Scan dibuka'),
    scan_selesai: cekJam(body.scan_selesai, 'Scan ditutup'),
    toleransi_menit: bulat(body.toleransi_menit ?? 0, 'Toleransi'),
  };
  if (s.hari < 0 || s.hari > 6) gagal(400, 'Hari tidak valid.');
  if (s.jam_mulai >= s.jam_selesai) gagal(400, 'Jam selesai harus setelah jam mulai.');
  if (s.scan_mulai >= s.scan_selesai) gagal(400, 'Scan ditutup harus setelah scan dibuka.');
  if (s.toleransi_menit < 0 || s.toleransi_menit > 120) gagal(400, 'Toleransi 0–120 menit.');
  return s;
}

export default [
  {
    method: 'GET', path: '/api/admin/dashboard', akses: 'admin',
    handler: async ({ query }) => {
      const { tanggal, slots, slot } = await pilihTanggalSlot(query);
      const [data, izin, butuh, libur] = await Promise.all([
        slot ? daftarSlot(tanggal, slot) : null,
        izinMenunggu(hariIni()),
        butuhPengganti(hariIni()),
        liburPada(tanggal),
      ]);
      return {
        tanggal, hari_ini: hariIni(), libur, slots, slot_id: slot?.id ?? null,
        data, izin_menunggu: izin, butuh_pengganti: butuh,
      };
    },
  },
  {
    method: 'POST', path: '/api/admin/izin/:id', akses: 'admin',
    handler: async ({ user, params, body }) => {
      const keputusan = pilihan(body.keputusan, ['disetujui', 'ditolak'], 'Keputusan');
      const r = await run("UPDATE izin SET status = ?, diputus_oleh = ? WHERE id = ? AND status = 'menunggu'", keputusan, user.id, bulat(params.id));
      if (!r.changes) gagal(400, 'Izin ini sudah diputuskan.');
      return { ok: true };
    },
  },
  {
    method: 'GET', path: '/api/admin/tugas', akses: 'admin',
    handler: async ({ query }) => {
      const { tanggal, slots, slot } = await pilihTanggalSlot(query);
      const kelas = slot ? await kelasUntukSlot(slot.id) : await semuaKelas();
      if (!slot) return { tanggal, slots, slot_id: null, kelas, asisten: [], tugas: [], kelas_pembina: {} };
      const [asistenRows, tugas, daftar] = await Promise.all([
        all(
          `SELECT p.pengguna_id, u.nama, p.kelas_id, k.nama AS kelas_nama FROM penugasan p
           JOIN pengguna u ON u.id = p.pengguna_id JOIN kelas k ON k.id = p.kelas_id
           WHERE p.slot_id = ? AND p.peran = 'asisten' AND u.aktif = 1 ORDER BY k.urutan, u.nama`,
          slot.id,
        ),
        all(
          `SELECT t.id, t.jenis, t.peran, t.pengguna_id, u.nama, k.nama AS kelas_nama, g.nama AS diganti_nama, d.nama AS dari_kelas_nama,
           (SELECT 1 FROM absensi a WHERE a.pengguna_id = t.pengguna_id AND a.tanggal = t.tanggal AND a.slot_id = t.slot_id) AS sudah_scan
           FROM tugas_harian t JOIN pengguna u ON u.id = t.pengguna_id JOIN kelas k ON k.id = t.kelas_id
           LEFT JOIN pengguna g ON g.id = t.menggantikan_id LEFT JOIN kelas d ON d.id = t.dari_kelas_id
           WHERE t.tanggal = ? AND t.slot_id = ? ORDER BY t.jenis, k.urutan`,
          tanggal, slot.id,
        ),
        daftarSlot(tanggal, slot),
      ]);
      const asisten = [];
      for (const a of asistenRows) {
        const t = await tugasPengguna(a.pengguna_id, tanggal, slot);
        asisten.push({ ...a, tugas_kelas_id: t?.kelas_id ?? a.kelas_id, tugas_jenis: t?.jenis ?? 'tetap' });
      }
      const kelasPembina = {};
      for (const k of daftar?.kelas ?? []) {
        kelasPembina[k.id] = k.anggota.filter((a) => a.peran === 'guru').map((a) => ({
          pengguna_id: a.pengguna_id, nama: a.nama, status: a.status, jenis: a.jenis, tugas_id: a.tugas_id ?? null,
        }));
      }
      return { tanggal, slots, slot_id: slot.id, status_slot: statusSlot(slot, tanggal), kelas, asisten, tugas, kelas_pembina: kelasPembina };
    },
  },
  {
    method: 'GET', path: '/api/admin/kandidat', akses: 'admin',
    handler: async ({ query }) => {
      const t = cekTanggal(query.tanggal);
      const slot = await ambilSlot(bulat(query.slot_id, 'Slot'));
      if (!slot) gagal(404, 'Slot tidak ditemukan.');
      const kelasId = bulat(query.kelas_id, 'Kelas');
      const peran = pilihan(query.peran, ['guru', 'asisten'], 'Peran');
      const menggantikan = query.menggantikan_id ? bulat(query.menggantikan_id) : null;
      return kandidatPengganti(t, slot, kelasId, peran, menggantikan);
    },
  },
  {
    method: 'POST', path: '/api/admin/pengganti', akses: 'admin',
    handler: async ({ user, body }) => {
      const t = cekTanggal(body.tanggal);
      const slot = await ambilSlot(bulat(body.slot_id, 'Slot'));
      await cekSesiTerbuka(t, slot);
      const kelasId = bulat(body.kelas_id, 'Kelas');
      if (!(await one('SELECT id FROM kelas WHERE id = ?', kelasId))) gagal(404, 'Kelas tidak ditemukan.');
      if (!(await kelasDiSlot(kelasId, slot.id))) gagal(400, 'Kelas ini tidak terdaftar di sesi tersebut.');
      const peran = pilihan(body.peran, ['guru', 'asisten'], 'Peran');
      const penggunaId = bulat(body.pengguna_id, 'Pengganti');
      const menggantikan = body.menggantikan_id ? bulat(body.menggantikan_id) : null;
      const k = await kandidatPengganti(t, slot, kelasId, peran, menggantikan);
      const boleh = [...k.kelas_ini, ...k.cadangan, ...k.lain].some((c) => c.pengguna_id === penggunaId);
      if (!boleh) gagal(400, 'Pengajar ini tidak tersedia di sesi tersebut.');
      if (menggantikan && (await one('SELECT id FROM tugas_harian WHERE tanggal = ? AND slot_id = ? AND menggantikan_id = ?', t, slot.id, menggantikan))) {
        gagal(400, 'Sudah ada pengganti untuk pengajar ini.');
      }
      await run(
        `INSERT INTO tugas_harian (tanggal, slot_id, kelas_id, pengguna_id, peran, jenis, menggantikan_id, dibuat_oleh)
         VALUES (?, ?, ?, ?, ?, 'pengganti', ?, ?)`,
        t, slot.id, kelasId, penggunaId, peran, menggantikan, user.id,
      );
      return { ok: true };
    },
  },
  {
    // Pembina kedua di satu kelas: hanya admin yang menetapkan, maksimal 2 pembina aktif per kelas per sesi.
    method: 'POST', path: '/api/admin/pembina-kedua', akses: 'admin',
    handler: async ({ user, body }) => {
      const t = cekTanggal(body.tanggal);
      const slot = await ambilSlot(bulat(body.slot_id, 'Slot'));
      await cekSesiTerbuka(t, slot);
      const kelasId = bulat(body.kelas_id, 'Kelas');
      if (!(await one('SELECT id FROM kelas WHERE id = ?', kelasId))) gagal(404, 'Kelas tidak ditemukan.');
      if (!(await kelasDiSlot(kelasId, slot.id))) gagal(400, 'Kelas ini tidak terdaftar di sesi tersebut.');
      const penggunaId = bulat(body.pengguna_id, 'Pembina');
      const tetap = !!body.tetap;
      const kelas = (await daftarSlot(t, slot))?.kelas.find((k) => k.id === kelasId);
      const aktif = (kelas?.anggota ?? []).filter((a) => a.peran === 'guru' && a.status !== 'izin');
      if (!aktif.length) gagal(400, 'Kelas ini belum punya pembina. Gunakan tab Pengganti.');
      if (aktif.length >= 2) gagal(400, `Kelas ini sudah punya 2 pembina: ${aktif.map((a) => a.nama).join(' dan ')}.`);
      const k = await kandidatPengganti(t, slot, kelasId, 'guru', null);
      if (![...k.kelas_ini, ...k.cadangan, ...k.lain].some((c) => c.pengguna_id === penggunaId)) gagal(400, 'Orang ini tidak tersedia di sesi tersebut.');
      await tx(async () => {
        if (!tetap) {
          await run(
            `INSERT INTO tugas_harian (tanggal, slot_id, kelas_id, pengguna_id, peran, jenis, menggantikan_id, dibuat_oleh)
             VALUES (?, ?, ?, ?, 'guru', 'tambahan', NULL, ?)`,
            t, slot.id, kelasId, penggunaId, user.id,
          );
          return;
        }
        const u = await one('SELECT tipe, level FROM pengguna WHERE id = ?', penggunaId);
        if (u.tipe !== 'tetap') gagal(400, 'Pembina tetap hanya untuk pengajar bertipe Tetap. Pilih "Tanggal ini saja" untuk cadangan.');
        const ada = await one('SELECT * FROM penugasan WHERE pengguna_id = ? AND slot_id = ?', penggunaId, slot.id);
        if (ada && (ada.kelas_id !== kelasId || ada.peran !== 'asisten')) gagal(400, 'Orang ini sudah punya kelas tetap lain di slot tersebut.');
        if (ada) await run("UPDATE penugasan SET peran = 'guru', mulai = ? WHERE id = ?", t, ada.id);
        else await run("INSERT INTO penugasan (pengguna_id, kelas_id, slot_id, peran, mulai) VALUES (?, ?, ?, 'guru', ?)", penggunaId, kelasId, slot.id, t);
      });
      return { ok: true };
    },
  },
  {
    method: 'POST', path: '/api/admin/pindah', akses: 'admin',
    handler: async ({ user, body }) => {
      const t = cekTanggal(body.tanggal);
      const slot = await ambilSlot(bulat(body.slot_id, 'Slot'));
      await cekSesiTerbuka(t, slot);
      const penggunaId = bulat(body.pengguna_id, 'Asisten');
      const keKelas = bulat(body.ke_kelas_id, 'Kelas tujuan');
      if (!(await one('SELECT id FROM kelas WHERE id = ?', keKelas))) gagal(404, 'Kelas tidak ditemukan.');
      if (!(await kelasDiSlot(keKelas, slot.id))) gagal(400, 'Kelas tujuan tidak terdaftar di sesi tersebut.');
      const asal = await one("SELECT * FROM penugasan WHERE pengguna_id = ? AND slot_id = ? AND peran = 'asisten'", penggunaId, slot.id);
      if (!asal) gagal(400, 'Hanya asisten dengan kelas tetap di slot ini yang bisa dipindah.');
      if (await one('SELECT id FROM absensi WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ?', penggunaId, t, slot.id)) {
        gagal(400, 'Asisten ini sudah scan di sesi ini.');
      }
      if (await one("SELECT id FROM izin WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ? AND status = 'disetujui'", penggunaId, t, slot.id)) {
        gagal(400, 'Asisten ini sedang izin di sesi ini.');
      }
      const harian = await one('SELECT * FROM tugas_harian WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ?', penggunaId, t, slot.id);
      if (harian && harian.jenis !== 'pindah') gagal(400, 'Asisten ini sudah ditugaskan sebagai pengganti di sesi ini.');
      await tx(async () => {
        await run("DELETE FROM tugas_harian WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ? AND jenis = 'pindah'", penggunaId, t, slot.id);
        if (keKelas !== asal.kelas_id) {
          await run(
            `INSERT INTO tugas_harian (tanggal, slot_id, kelas_id, pengguna_id, peran, jenis, dari_kelas_id, dibuat_oleh)
             VALUES (?, ?, ?, ?, 'asisten', 'pindah', ?, ?)`,
            t, slot.id, keKelas, penggunaId, asal.kelas_id, user.id,
          );
        }
      });
      return { ok: true };
    },
  },
  {
    method: 'DELETE', path: '/api/admin/tugas/:id', akses: 'admin',
    handler: async ({ params }) => {
      const h = await one('SELECT * FROM tugas_harian WHERE id = ?', bulat(params.id));
      if (!h) gagal(404, 'Penugasan tidak ditemukan.');
      if (await one('SELECT id FROM absensi WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ?', h.pengguna_id, h.tanggal, h.slot_id)) {
        gagal(400, 'Tidak bisa dibatalkan: pengajar ini sudah scan di sesi tersebut.');
      }
      await run('DELETE FROM tugas_harian WHERE id = ?', h.id);
      return { ok: true };
    },
  },

  // ---- Data pembina & asisten ----
  {
    method: 'GET', path: '/api/admin/pengguna', akses: 'admin',
    handler: async () => {
      const [jadwal, pengguna] = await Promise.all([
        all(
          `SELECT p.pengguna_id, p.peran, k.nama AS kelas, s.nama AS slot FROM penugasan p
           JOIN kelas k ON k.id = p.kelas_id JOIN slot s ON s.id = p.slot_id ORDER BY s.hari, s.jam_mulai`,
        ),
        all('SELECT * FROM pengguna ORDER BY aktif DESC, nama'),
      ]);
      return {
        pengguna: pengguna.map((u) => ({
          ...penggunaRingkas(u),
          jadwal: jadwal.filter((j) => j.pengguna_id === u.id).map((j) => `${j.kelas} (${j.slot})`),
        })),
      };
    },
  },
  {
    method: 'GET', path: '/api/admin/pembina-kelas', akses: 'admin',
    handler: async () => ({
      pembina: await all(
        `SELECT p.kelas_id, p.slot_id, p.pengguna_id, u.nama FROM penugasan p JOIN pengguna u ON u.id = p.pengguna_id
         WHERE p.peran = 'guru' AND u.aktif = 1`,
      ),
    }),
  },
  {
    method: 'GET', path: '/api/admin/pengguna/:id', akses: 'admin',
    handler: async ({ params }) => {
      const u = await one('SELECT * FROM pengguna WHERE id = ?', bulat(params.id));
      if (!u) gagal(404, 'Pengguna tidak ditemukan.');
      return {
        pengguna: {
          ...penggunaRingkas(u),
          undangan: u.undangan_kode && new Date(u.undangan_kedaluwarsa) > new Date() ? { kode: u.undangan_kode, kedaluwarsa: u.undangan_kedaluwarsa } : null,
        },
        penugasan: await all('SELECT kelas_id, slot_id, peran FROM penugasan WHERE pengguna_id = ?', u.id),
      };
    },
  },
  {
    method: 'POST', path: '/api/admin/pengguna', akses: 'admin',
    handler: async ({ body }) => {
      const { data, penugasan } = await bacaPengguna(body);
      const id = await tx(async () => {
        const r = await one(
          `INSERT INTO pengguna (nip, nama, hp, is_pengajar, level, tipe, is_admin, is_petugas, aktif, jabatan)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          data.nip, data.nama, data.hp, data.is_pengajar, data.level, data.tipe, data.is_admin, data.is_petugas, data.aktif, data.jabatan,
        );
        await simpanPenugasan(r.id, penugasan);
        return r.id;
      });
      return { id, undangan: await buatUndangan(id) };
    },
  },
  {
    method: 'PUT', path: '/api/admin/pengguna/:id', akses: 'admin',
    handler: async ({ user, params, body }) => {
      const id = bulat(params.id);
      if (!(await one('SELECT id FROM pengguna WHERE id = ?', id))) gagal(404, 'Pengguna tidak ditemukan.');
      const { data, penugasan } = await bacaPengguna(body, id);
      if (id === user.id && (!data.is_admin || !data.aktif)) gagal(400, 'Anda tidak bisa mencabut akses admin atau menonaktifkan akun sendiri.');
      await tx(async () => {
        await run(
          `UPDATE pengguna SET nip = ?, nama = ?, hp = ?, is_pengajar = ?, level = ?, tipe = ?,
           is_admin = ?, is_petugas = ?, aktif = ?, jabatan = ? WHERE id = ?`,
          data.nip, data.nama, data.hp, data.is_pengajar, data.level, data.tipe, data.is_admin, data.is_petugas, data.aktif, data.jabatan, id,
        );
        await simpanPenugasan(id, penugasan);
        if (!data.aktif) await run('DELETE FROM sesi_login WHERE pengguna_id = ?', id);
      });
      return { ok: true };
    },
  },
  {
    method: 'POST', path: '/api/admin/pengguna/:id/undangan', akses: 'admin',
    handler: async ({ user, params, body }) => {
      const id = bulat(params.id);
      if (!(await one('SELECT id FROM pengguna WHERE id = ?', id))) gagal(404, 'Pengguna tidak ditemukan.');
      if (body.reset_pin) {
        if (id === user.id) gagal(400, 'Untuk mengganti PIN sendiri, minta admin lain mereset.');
        await run('UPDATE pengguna SET pin_hash = NULL WHERE id = ?', id);
        await run('DELETE FROM sesi_login WHERE pengguna_id = ?', id);
      }
      return { undangan: await buatUndangan(id) };
    },
  },

  // ---- Kelas & slot ----
  {
    method: 'GET', path: '/api/admin/kelas', akses: 'admin',
    handler: async () => {
      const [kelas, slot, ks] = await Promise.all([
        semuaKelas(),
        all('SELECT * FROM slot ORDER BY hari, jam_mulai'),
        all('SELECT kelas_id, slot_id FROM kelas_slot'),
      ]);
      return {
        kelas: kelas.map((k) => ({ ...k, slot_ids: ks.filter((x) => x.kelas_id === k.id).map((x) => x.slot_id) })),
        slot,
      };
    },
  },
  {
    method: 'POST', path: '/api/admin/kelas', akses: 'admin',
    handler: async ({ body }) => {
      const nama = teks(body.nama, { wajib: true, maks: 40, label: 'Nama kelas' });
      if (await one('SELECT id FROM kelas WHERE nama = ?', nama)) gagal(400, 'Nama kelas sudah ada.');
      const slotIds = await bacaSlotKelas(body);
      const urutan = ((await one('SELECT MAX(urutan) AS m FROM kelas')).m ?? 0) + 1;
      const id = await tx(async () => {
        const r = await one('INSERT INTO kelas (nama, urutan) VALUES (?, ?) RETURNING id', nama, urutan);
        for (const s of slotIds) await run('INSERT INTO kelas_slot (kelas_id, slot_id) VALUES (?, ?)', r.id, s);
        return r.id;
      });
      return { ok: true, id };
    },
  },
  {
    method: 'PUT', path: '/api/admin/kelas/:id', akses: 'admin',
    handler: async ({ params, body }) => {
      const id = bulat(params.id);
      const ada = await one('SELECT id, nama FROM kelas WHERE id = ?', id);
      if (!ada) gagal(404, 'Kelas tidak ditemukan.');
      const nama = teks(body.nama, { wajib: true, maks: 40, label: 'Nama kelas' });
      if (await one('SELECT id FROM kelas WHERE nama = ? AND id != ?', nama, id)) gagal(400, 'Nama kelas sudah ada.');
      const ubahSlot = body.slot_ids !== undefined;
      const slotIds = ubahSlot ? await bacaSlotKelas(body) : [];
      if (ubahSlot) {
        const lama = (await all('SELECT slot_id FROM kelas_slot WHERE kelas_id = ?', id)).map((r) => r.slot_id);
        for (const s of lama.filter((x) => !slotIds.includes(x))) {
          const dipakai = await one(
            `SELECT u.nama, sl.nama AS slot FROM penugasan p JOIN pengguna u ON u.id = p.pengguna_id JOIN slot sl ON sl.id = p.slot_id
             WHERE p.kelas_id = ? AND p.slot_id = ? LIMIT 1`,
            id, s,
          );
          if (dipakai) {
            gagal(400, `Kelas ${ada.nama} masih punya pengajar tetap di sesi ${dipakai.slot} (${dipakai.nama}). Pindahkan dulu di Data Pembina & Asisten.`);
          }
        }
      }
      await tx(async () => {
        await run('UPDATE kelas SET nama = ? WHERE id = ?', nama, id);
        if (ubahSlot) {
          await run('DELETE FROM kelas_slot WHERE kelas_id = ?', id);
          for (const s of slotIds) await run('INSERT INTO kelas_slot (kelas_id, slot_id) VALUES (?, ?)', id, s);
        }
      });
      return { ok: true };
    },
  },
  {
    method: 'POST', path: '/api/admin/slot', akses: 'admin',
    handler: async ({ body }) => {
      const s = bacaSlot(body);
      const r = await one(
        `INSERT INTO slot (nama, hari, jam_mulai, jam_selesai, mode, scan_mulai, scan_selesai, toleransi_menit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        s.nama, s.hari, s.jam_mulai, s.jam_selesai, s.mode, s.scan_mulai, s.scan_selesai, s.toleransi_menit,
      );
      return { ok: true, id: r.id };
    },
  },
  {
    method: 'PUT', path: '/api/admin/slot/:id', akses: 'admin',
    handler: async ({ params, body }) => {
      const id = bulat(params.id);
      const s = bacaSlot(body);
      const r = await run(
        `UPDATE slot SET nama = ?, hari = ?, jam_mulai = ?, jam_selesai = ?, mode = ?, scan_mulai = ?, scan_selesai = ?, toleransi_menit = ? WHERE id = ?`,
        s.nama, s.hari, s.jam_mulai, s.jam_selesai, s.mode, s.scan_mulai, s.scan_selesai, s.toleransi_menit, id,
      );
      if (!r.changes) gagal(404, 'Slot tidak ditemukan.');
      return { ok: true };
    },
  },

  // ---- Laporan ----
  {
    method: 'GET', path: '/api/admin/laporan.csv', akses: 'admin',
    handler: async ({ query }) => {
      const bulan = /^\d{4}-\d{2}$/.test(query.bulan ?? '') ? query.bulan : hariIni().slice(0, 7);
      const baris = [['NIPSMB', 'Nama Lengkap', 'Level', 'Tipe', 'Hadir', 'Terlambat', 'Izin', 'Alpa', 'Persentase Hadir']];
      for (const u of await all('SELECT * FROM pengguna WHERE is_pengajar = 1 ORDER BY nama')) {
        const r = await riwayatPengguna(u, bulan);
        baris.push([
          u.nip ?? '', u.nama, u.level === 'guru' ? 'Pembina' : u.level === 'asisten' ? 'Asisten' : '', u.tipe ?? '',
          r.ringkasan.hadir, r.ringkasan.terlambat, r.ringkasan.izin, r.ringkasan.alpa, r.persen === null ? '' : `${r.persen}%`,
        ]);
      }
      const isi = '﻿' + baris.map((b) => b.map(csvSel).join(';')).join('\r\n');
      return { __berkas: { isi, tipe: 'text/csv; charset=utf-8', nama: `rekap-absensi-${bulan}.csv` } };
    },
  },
  {
    method: 'PUT', path: '/api/admin/vihara', akses: 'admin',
    handler: async ({ body }) => {
      await setSetting('nama_vihara', teks(body.nama, { wajib: true, maks: 80, label: 'Nama vihara' }));
      return { ok: true, nama: await getSetting('nama_vihara') };
    },
  },

  // ---- Rekap absensi bulanan (untuk dicetak PDF) ----
  {
    method: 'GET', path: '/api/admin/rekap', akses: 'admin',
    handler: async ({ query }) => {
      const bulan = /^\d{4}-\d{2}$/.test(query.bulan ?? '') ? query.bulan : hariIni().slice(0, 7);
      const akhir = akhirBulan(bulan);
      const batas = hariIni() < akhir ? hariIni() : akhir;
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
      const sesi = [];
      const orang = new Map();
      const detail = [];
      for (const { t, slot, d } of sesiList) {
        const kunci = `${t}|${slot.id}`;
        sesi.push({ kunci, tanggal: t, slot_nama: slot.nama, mode: slot.mode, status_slot: d.status_slot });
        for (const k of d.kelas) {
          for (const a of k.anggota) {
            if (!orang.has(a.pengguna_id)) orang.set(a.pengguna_id, { pengguna_id: a.pengguna_id, nama: a.nama, sel: {}, ringkasan: { hadir: 0, terlambat: 0, izin: 0, alpa: 0 } });
            const o = orang.get(a.pengguna_id);
            o.sel[kunci] = { status: a.status, jam: a.jam ?? null, kelas: k.nama, peran: a.peran, jenis: a.jenis };
            if (a.status in o.ringkasan) o.ringkasan[a.status]++;
            detail.push({
              tanggal: t, slot_nama: slot.nama, slot_mulai: slot.jam_mulai, nama: a.nama, kelas: k.nama, peran: a.peran,
              jam: a.jam ?? null, status: a.status, keterangan: a.keterangan || ({ sakit: 'Sakit', izin: 'Keperluan pribadi', tugas: 'Tugas lain' }[a.izin_jenis] ?? ''),
            });
          }
        }
      }
      const urutStatus = { hadir: 0, terlambat: 0, izin: 1, alpa: 2, belum: 3, nanti: 4 };
      detail.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.slot_mulai.localeCompare(b.slot_mulai) || urutStatus[a.status] - urutStatus[b.status] || (a.jam ?? '').localeCompare(b.jam ?? '') || a.nama.localeCompare(b.nama));
      const daftarOrang = [...orang.values()].sort((a, b) => a.nama.localeCompare(b.nama)).map((o) => {
        const r = o.ringkasan;
        const total = r.hadir + r.terlambat + r.izin + r.alpa;
        return { ...o, persen: total ? Math.round(((r.hadir + r.terlambat) / total) * 100) : null };
      });
      const [kepala, kop, vihara] = await Promise.all([
        one("SELECT nama FROM pengguna WHERE jabatan = 'kepala' AND aktif = 1"),
        pengaturanHonor(),
        getSetting('nama_vihara'),
      ]);
      return {
        bulan, hari_ini: hariIni(), sesi, orang: daftarOrang, detail,
        nama_vihara: vihara ?? 'Vihara', kop, kepala: kepala?.nama ?? null,
      };
    },
  },

  // ---- Honor & surat permohonan pencairan ----
  {
    method: 'GET', path: '/api/admin/honor', akses: 'admin',
    handler: async ({ query }) => {
      const bulan = /^\d{4}-\d{2}$/.test(query.bulan ?? '') ? query.bulan : hariIni().slice(0, 7);
      const [honor, kepala, vihara, surat] = await Promise.all([
        hitungHonor(bulan),
        one("SELECT nama, nama_dharma FROM pengguna WHERE jabatan = 'kepala' AND aktif = 1"),
        getSetting('nama_vihara'),
        one('SELECT nomor, tanggal_surat FROM pengajuan_honor WHERE bulan = ?', bulan),
      ]);
      return {
        ...honor,
        nama_vihara: vihara ?? 'Vihara',
        kepala: kepala ?? null,
        surat: surat ?? null,
        hari_ini: hariIni(),
      };
    },
  },
  {
    method: 'POST', path: '/api/admin/honor/surat', akses: 'admin',
    handler: async ({ user, body }) => {
      const bulan = String(body.bulan ?? '');
      if (!/^\d{4}-\d{2}$/.test(bulan)) gagal(400, 'Bulan tidak valid.');
      if (!(await hitungHonor(bulan)).baris.length) gagal(400, 'Belum ada honor yang bisa diajukan untuk bulan ini.');
      const s = await nomorSurat(bulan, user.id);
      return { nomor: s.nomor, tanggal_surat: s.tanggal_surat };
    },
  },
  {
    method: 'GET', path: '/api/admin/honor/pengaturan', akses: 'admin',
    handler: async () => ({ pengaturan: await pengaturanHonor(), jabatan: JABATAN }),
  },
  {
    method: 'PUT', path: '/api/admin/honor/pengaturan', akses: 'admin',
    handler: async ({ body }) => {
      const data = {};
      for (const [k, v] of Object.entries(BAWAAN)) {
        if (typeof v === 'number') {
          const n = Number(body[k]);
          if (!Number.isInteger(n) || n < 0 || n > 100_000_000) gagal(400, 'Nominal harus angka bulat 0 atau lebih.');
          data[k] = n;
        } else {
          data[k] = teks(body[k], { maks: 160, label: 'Isian kop surat' }) || v;
        }
      }
      if (!/^[A-Za-z0-9.-]{1,20}$/.test(data.kode_surat)) gagal(400, 'Kode surat hanya huruf, angka, titik, dan tanda hubung.');
      await simpanPengaturanHonor(data);
      return { ok: true };
    },
  },
];

