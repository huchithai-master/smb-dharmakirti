import { one, all } from './db.js';
import { now, tglStr, menit, menitNow, hariDari, tambahHari, dariTgl, akhirBulan } from './waktu.js';

// Jadwal slot menurut hari dalam seminggu, tanpa memperhatikan hari libur.
export const slotJadwal = (tanggal) => all('SELECT * FROM slot WHERE hari = ? ORDER BY jam_mulai', hariDari(tanggal));
// Libur yang berlaku pada tanggal tersebut (atau null).
export const liburPada = async (tanggal) =>
  (await one('SELECT id, jenis, mulai, selesai, alasan FROM libur WHERE ? BETWEEN mulai AND selesai ORDER BY jenis DESC LIMIT 1', tanggal)) ?? null;
// Pada hari libur tidak ada sesi: tidak ada scan, tidak ada alpa, tidak ada honor sesi.
export const slotHari = async (tanggal) => ((await liburPada(tanggal)) ? [] : slotJadwal(tanggal));
export const semuaKelas = () => all('SELECT id, nama, urutan FROM kelas ORDER BY urutan, id');
export const ambilSlot = (id) => one('SELECT * FROM slot WHERE id = ?', id);

// 'nanti' = jendela scan belum dibuka, 'buka' = sedang bisa scan, 'selesai' = sudah ditutup.
export function statusSlot(slot, tanggal, d = now()) {
  const hariIni = tglStr(d);
  if (tanggal < hariIni) return 'selesai';
  if (tanggal > hariIni) return 'nanti';
  const m = menitNow(d);
  if (m < menit(slot.scan_mulai)) return 'nanti';
  if (m <= menit(slot.scan_selesai)) return 'buka';
  return 'selesai';
}

export function statusScan(slot, jam) {
  if (slot.mode === 'konfirmasi') return 'hadir';
  return menit(jam) > menit(slot.jam_mulai) + slot.toleransi_menit ? 'terlambat' : 'hadir';
}

// Tanggal terdekat (mulai hari ini) yang punya slot.
export async function tanggalAktif(dari = tglStr(now())) {
  for (let i = 0; i < 7; i++) {
    const t = tambahHari(dari, i);
    if ((await slotJadwal(t)).length) return t;
  }
  return dari;
}

// Tugas seseorang pada tanggal + slot: penugasan harian (pengganti/pindah) menimpa jadwal tetap.
export async function tugasPengguna(penggunaId, tanggal, slot) {
  if (hariDari(tanggal) !== slot.hari) return null;
  const h = await one(
    `SELECT t.*, k.nama AS kelas_nama FROM tugas_harian t JOIN kelas k ON k.id = t.kelas_id
     WHERE t.pengguna_id = ? AND t.tanggal = ? AND t.slot_id = ?`,
    penggunaId, tanggal, slot.id,
  );
  if (h) {
    return {
      kelas_id: h.kelas_id, kelas_nama: h.kelas_nama, peran: h.peran, jenis: h.jenis,
      tugas_id: h.id, menggantikan_id: h.menggantikan_id, dari_kelas_id: h.dari_kelas_id,
    };
  }
  const p = await one(
    `SELECT p.*, k.nama AS kelas_nama FROM penugasan p JOIN kelas k ON k.id = p.kelas_id
     JOIN pengguna u ON u.id = p.pengguna_id
     WHERE p.pengguna_id = ? AND p.slot_id = ? AND p.mulai <= ? AND u.aktif = 1 AND u.is_pengajar = 1`,
    penggunaId, slot.id, tanggal,
  );
  return p ? { kelas_id: p.kelas_id, kelas_nama: p.kelas_nama, peran: p.peran, jenis: 'tetap' } : null;
}

// Semua tugas pada tanggal + slot sekaligus (Map pengguna_id -> tugas), untuk daftar calon pengganti.
async function petaTugas(tanggal, slot) {
  const peta = new Map();
  if (hariDari(tanggal) !== slot.hari) return peta;
  const [harian, tetap] = await Promise.all([
    all(
      `SELECT t.*, k.nama AS kelas_nama FROM tugas_harian t JOIN kelas k ON k.id = t.kelas_id
       WHERE t.tanggal = ? AND t.slot_id = ?`,
      tanggal, slot.id,
    ),
    all(
      `SELECT p.*, k.nama AS kelas_nama FROM penugasan p JOIN kelas k ON k.id = p.kelas_id
       JOIN pengguna u ON u.id = p.pengguna_id
       WHERE p.slot_id = ? AND p.mulai <= ? AND u.aktif = 1 AND u.is_pengajar = 1`,
      slot.id, tanggal,
    ),
  ]);
  for (const p of tetap) peta.set(p.pengguna_id, { kelas_id: p.kelas_id, kelas_nama: p.kelas_nama, peran: p.peran, jenis: 'tetap' });
  for (const h of harian) {
    peta.set(h.pengguna_id, {
      kelas_id: h.kelas_id, kelas_nama: h.kelas_nama, peran: h.peran, jenis: h.jenis,
      tugas_id: h.id, menggantikan_id: h.menggantikan_id, dari_kelas_id: h.dari_kelas_id,
    });
  }
  return peta;
}

// Daftar lengkap pengajar per kelas untuk satu tanggal + slot, beserta status kehadirannya.
export async function daftarSlot(tanggal, slot) {
  if (hariDari(tanggal) !== slot.hari) return null;
  const st = statusSlot(slot, tanggal);
  const [kelas, tetap, harian, absenRows, izinRows, siswaRows, jumlahMurid, materiRows] = await Promise.all([
    semuaKelas(),
    all(
      `SELECT p.pengguna_id, p.kelas_id, p.peran, u.nama FROM penugasan p JOIN pengguna u ON u.id = p.pengguna_id
       WHERE p.slot_id = ? AND p.mulai <= ? AND u.aktif = 1 AND u.is_pengajar = 1`,
      slot.id, tanggal,
    ),
    all(
      `SELECT t.*, u.nama, g.nama AS diganti_nama FROM tugas_harian t
       JOIN pengguna u ON u.id = t.pengguna_id LEFT JOIN pengguna g ON g.id = t.menggantikan_id
       WHERE t.slot_id = ? AND t.tanggal = ?`,
      slot.id, tanggal,
    ),
    all(
      `SELECT a.*, u.nama AS nama_pengguna FROM absensi a JOIN pengguna u ON u.id = a.pengguna_id
       WHERE a.slot_id = ? AND a.tanggal = ?`,
      slot.id, tanggal,
    ),
    all("SELECT * FROM izin WHERE slot_id = ? AND tanggal = ? AND status != 'ditolak'", slot.id, tanggal),
    all(
      `SELECT kelas_id, COUNT(*)::int AS tercatat, SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END)::int AS hadir
       FROM absensi_murid WHERE tanggal = ? AND slot_id = ? GROUP BY kelas_id`,
      tanggal, slot.id,
    ),
    all('SELECT kelas_id, COUNT(*)::int AS n FROM murid WHERE aktif = 1 GROUP BY kelas_id'),
    all('SELECT kelas_id, isi FROM materi WHERE tanggal = ? AND slot_id = ?', tanggal, slot.id),
  ]);
  const namaKelas = new Map(kelas.map((k) => [k.id, k.nama]));
  const absen = new Map(absenRows.map((a) => [a.pengguna_id, a]));
  const izin = new Map(izinRows.map((i) => [i.pengguna_id, i]));
  const harianBy = new Map(harian.map((h) => [h.pengguna_id, h]));
  const per = new Map(kelas.map((k) => [k.id, { id: k.id, nama: k.nama, catatan: [], anggota: [] }]));

  const status = (pid) => {
    const a = absen.get(pid);
    if (a) return { status: a.status, jam: a.jam_scan };
    const iz = izin.get(pid);
    if (iz?.status === 'disetujui') return { status: 'izin', izin_jenis: iz.jenis };
    return { status: st === 'selesai' ? 'alpa' : st === 'buka' ? 'belum' : 'nanti', izin_menunggu: iz?.status === 'menunggu' };
  };

  for (const t of tetap) {
    const h = harianBy.get(t.pengguna_id);
    if (h) {
      if (h.kelas_id !== t.kelas_id) {
        const kata = h.jenis === 'pindah' ? 'dipindah' : h.jenis === 'tambahan' ? 'menjadi pembina tambahan' : 'menjadi pengganti';
        per.get(t.kelas_id)?.catatan.push(`${t.nama} ${kata} ke ${namaKelas.get(h.kelas_id)}`);
      }
      continue;
    }
    per.get(t.kelas_id)?.anggota.push({ pengguna_id: t.pengguna_id, nama: t.nama, peran: t.peran, jenis: 'tetap', keterangan: '', ...status(t.pengguna_id) });
  }
  for (const h of harian) {
    const keterangan = h.jenis === 'pengganti'
      ? `Pengganti${h.diganti_nama ? ' ' + h.diganti_nama : ''}`
      : h.jenis === 'tambahan'
        ? 'Pembina kedua'
        : `Pindahan dari ${namaKelas.get(h.dari_kelas_id) ?? '-'}`;
    per.get(h.kelas_id)?.anggota.push({ pengguna_id: h.pengguna_id, nama: h.nama, peran: h.peran, jenis: h.jenis, tugas_id: h.id, keterangan, ...status(h.pengguna_id) });
  }
  // Absensi lama tetap tampil walau jadwal tetapnya sudah diubah atau dihapus sesudahnya.
  const tercantum = new Set([...per.values()].flatMap((k) => k.anggota.map((a) => a.pengguna_id)));
  for (const a of absenRows) {
    if (tercantum.has(a.pengguna_id)) continue;
    per.get(a.kelas_id)?.anggota.push({
      pengguna_id: a.pengguna_id, nama: a.nama_pengguna ?? '-', peran: a.peran, jenis: a.jenis_tugas,
      keterangan: a.jenis_tugas === 'pengganti' ? 'Pengganti' : a.jenis_tugas === 'tambahan' ? 'Pembina kedua' : a.jenis_tugas === 'pindah' ? 'Pindahan' : '',
      status: a.status, jam: a.jam_scan,
    });
  }

  const siswaBy = new Map(siswaRows.map((r) => [r.kelas_id, r]));
  const muridBy = new Map(jumlahMurid.map((r) => [r.kelas_id, r.n]));
  const materiBy = new Map(materiRows.map((r) => [r.kelas_id, r.isi]));
  for (const k of per.values()) {
    const s = siswaBy.get(k.id);
    k.siswa = { total: muridBy.get(k.id) ?? 0, tercatat: s?.tercatat ?? 0, hadir: s?.hadir ?? 0 };
    k.materi = materiBy.get(k.id) ?? null;
  }

  const urutPeran = { guru: 0, asisten: 1 };
  const daftar = [...per.values()].filter((k) => k.anggota.length || k.catatan.length);
  const ringkasan = { hadir: 0, terlambat: 0, izin: 0, belum: 0, alpa: 0, nanti: 0 };
  for (const k of daftar) {
    k.anggota.sort((a, b) => urutPeran[a.peran] - urutPeran[b.peran] || a.nama.localeCompare(b.nama));
    for (const a of k.anggota) ringkasan[a.status]++;
  }
  return { status_slot: st, kelas: daftar, ringkasan };
}

// Riwayat satu pengajar dalam satu bulan (YYYY-MM), sampai hari ini.
export async function riwayatPengguna(pengguna, bulan) {
  const hariIni = tglStr(now());
  const akhir = akhirBulan(bulan);
  const kerja = [];
  for (let t = `${bulan}-01`; t <= akhir && t <= hariIni; t = tambahHari(t, 1)) {
    if (t < pengguna.dibuat) continue;
    kerja.push(t);
  }
  const perHari = await Promise.all(
    kerja.map(async (t) => {
      const hasil = [];
      for (const slot of await slotHari(t)) hasil.push({ t, slot, d: await daftarSlot(t, slot) });
      return hasil;
    }),
  );
  const baris = [];
  for (const { t, slot, d } of perHari.flat()) {
    for (const k of d.kelas) {
      const a = k.anggota.find((x) => x.pengguna_id === pengguna.id);
      if (a) {
        baris.push({
          tanggal: t, slot_id: slot.id, slot_nama: slot.nama, mode: slot.mode,
          kelas_nama: k.nama, peran: a.peran, jenis: a.jenis, keterangan: a.keterangan,
          status: a.status, jam: a.jam ?? null,
        });
      }
    }
  }
  baris.reverse();
  const ringkasan = { hadir: 0, terlambat: 0, izin: 0, alpa: 0 };
  for (const b of baris) if (b.status in ringkasan) ringkasan[b.status]++;
  const total = ringkasan.hadir + ringkasan.terlambat + ringkasan.izin + ringkasan.alpa;
  const persen = total ? Math.round(((ringkasan.hadir + ringkasan.terlambat) / total) * 100) : null;
  return { baris, ringkasan, persen };
}

// Calon pengganti untuk kelas + peran tertentu, dikelompokkan, plus yang tidak tersedia beserta alasannya.
export async function kandidatPengganti(tanggal, slot, kelasId, peran, menggantikanId) {
  const hasil = { kelas_ini: [], cadangan: [], lain: [], tidak_tersedia: [] };
  const [pengguna, kaliRows, izinRows, jadwalRows, tugas] = await Promise.all([
    all('SELECT * FROM pengguna WHERE aktif = 1 AND is_pengajar = 1 ORDER BY nama'),
    all("SELECT pengguna_id, COUNT(*)::int AS n FROM tugas_harian WHERE jenis = 'pengganti' GROUP BY pengguna_id"),
    all("SELECT pengguna_id, status FROM izin WHERE tanggal = ? AND slot_id = ? AND status != 'ditolak'", tanggal, slot.id),
    all(
      `SELECT p.pengguna_id, k.nama AS kelas, s.nama AS slot, p.peran FROM penugasan p
       JOIN kelas k ON k.id = p.kelas_id JOIN slot s ON s.id = p.slot_id ORDER BY s.hari, s.jam_mulai`,
    ),
    petaTugas(tanggal, slot),
  ]);
  const kali = new Map(kaliRows.map((r) => [r.pengguna_id, r.n]));
  const izin = new Map(izinRows.map((r) => [r.pengguna_id, r.status]));
  const jadwal = new Map();
  for (const j of jadwalRows) {
    if (!jadwal.has(j.pengguna_id)) jadwal.set(j.pengguna_id, []);
    jadwal.get(j.pengguna_id).push(`${j.peran === 'guru' ? 'Pembina' : 'Asisten'} ${j.kelas} (${j.slot})`);
  }
  for (const u of pengguna) {
    if (u.id === menggantikanId) continue;
    const dasar = { pengguna_id: u.id, nama: u.nama, level: u.level, tipe: u.tipe, kali_pengganti: kali.get(u.id) ?? 0 };
    const iz = izin.get(u.id);
    if (iz) {
      hasil.tidak_tersedia.push({ ...dasar, alasan: iz === 'disetujui' ? 'Izin di sesi ini' : 'Sedang mengajukan izin di sesi ini' });
      continue;
    }
    const t = tugas.get(u.id);
    if (t) {
      if (peran === 'guru' && t.kelas_id === kelasId && t.peran === 'asisten' && t.jenis !== 'pengganti') {
        hasil.kelas_ini.push({ ...dasar, info: `Asisten ${t.kelas_nama}${t.jenis === 'pindah' ? ' (pindahan)' : ''} · bisa naik jadi pembina` });
      } else {
        const label = t.peran === 'guru' ? 'Pembina' : 'Asisten';
        hasil.tidak_tersedia.push({ ...dasar, alasan: `Bertugas sebagai ${label} ${t.kelas_nama} di slot ${slot.nama}` });
      }
      continue;
    }
    const info = (jadwal.get(u.id) ?? []).join(' · ') || 'Belum punya kelas tetap';
    if (u.tipe === 'cadangan') hasil.cadangan.push({ ...dasar, info: `Cadangan level ${u.level === 'guru' ? 'Pembina' : 'Asisten'}` });
    else hasil.lain.push({ ...dasar, info });
  }
  return hasil;
}

export async function izinMenunggu(dariTanggal) {
  const rows = await all(
    `SELECT i.id, i.tanggal, i.jenis, i.alasan, i.slot_id, s.nama AS slot_nama, u.id AS pengguna_id, u.nama
     FROM izin i JOIN pengguna u ON u.id = i.pengguna_id JOIN slot s ON s.id = i.slot_id
     WHERE i.status = 'menunggu' AND i.tanggal >= ? ORDER BY i.tanggal, s.jam_mulai`,
    dariTanggal,
  );
  return Promise.all(
    rows.map(async (i) => {
      const t = await tugasPengguna(i.pengguna_id, i.tanggal, await ambilSlot(i.slot_id));
      return { ...i, kelas_nama: t?.kelas_nama ?? '-', peran: t?.peran ?? null };
    }),
  );
}

// Pembina yang izinnya sudah disetujui tetapi kelasnya belum punya pengganti.
export async function butuhPengganti(dariTanggal) {
  const hasil = [];
  const rows = await all(
    `SELECT i.*, u.nama FROM izin i JOIN pengguna u ON u.id = i.pengguna_id
     WHERE i.status = 'disetujui' AND i.tanggal >= ? ORDER BY i.tanggal`,
    dariTanggal,
  );
  for (const r of rows) {
    const slot = await ambilSlot(r.slot_id);
    if (!slot || statusSlot(slot, r.tanggal) === 'selesai') continue;
    const t = await tugasPengguna(r.pengguna_id, r.tanggal, slot);
    if (!t || t.peran !== 'guru') continue;
    const ada = await one('SELECT id FROM tugas_harian WHERE tanggal = ? AND slot_id = ? AND menggantikan_id = ?', r.tanggal, slot.id, r.pengguna_id);
    if (ada) continue;
    hasil.push({
      tanggal: r.tanggal, slot_id: slot.id, slot_nama: slot.nama, kelas_id: t.kelas_id, kelas_nama: t.kelas_nama,
      peran: 'guru', pengguna_id: r.pengguna_id, nama: r.nama, jenis: r.jenis,
    });
  }
  return hasil;
}

export const namaHari = (tgl) => ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dariTgl(tgl).getUTCDay()];
