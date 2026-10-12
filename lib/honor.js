import { one, all, getSetting, setSetting } from './db.js';
import { now, tglStr } from './waktu.js';

export const JABATAN = {
  kepala: 'Kepala SMB',
  wakil: 'Wakil Kepala SMB',
  bendahara: 'Bendahara',
  sekretaris: 'Sekretaris',
};

export const BAWAAN = {
  op_guru: 20000, // operasional pembina per sesi
  transport_guru: 50000, // transport pembina, sekali per hari mengajar
  op_asisten: 15000, // operasional asisten per sesi
  op_asisten_gantikan_guru: 35000, // asisten yang menggantikan pembina, per sesi
  min_hadir_pembina: 3, // honor pembina hanya dibayar bila hadir minimal sekian hari dalam sebulan
  tunjangan_jabatan: 200000, // operasional tetap jabatan per bulan
  transport_jabatan: 50000, // jabatan yang mengajar, sekali per hari (tanpa honor sesi)
  nama_sekolah: 'Sekolah Minggu Buddhis Dharmakirti',
  alamat: 'Jl. [Alamat Vihara] No. [..], [Kota]',
  kontak: 'Telp. [No. Telepon] · [Email]',
  kota: '[Kota]',
  kode_surat: 'SMB-DK',
  kepada: 'Ketua Pengurus Vihara',
};

export async function pengaturanHonor() {
  let tersimpan = {};
  try {
    tersimpan = JSON.parse((await getSetting('honor')) || '{}');
  } catch {
    // abaikan data rusak, pakai bawaan
  }
  return { ...BAWAAN, ...tersimpan };
}

export async function simpanPengaturanHonor(data) {
  await setSetting('honor', JSON.stringify(data));
}

// Rincian honor satu bulan (YYYY-MM). Hanya absensi Hadir/Terlambat yang dihitung (tabel absensi
// memang hanya berisi hasil scan), izin dan alpa tidak dibayar.
export async function hitungHonor(bulan) {
  const p = await pengaturanHonor();
  const [absen, daftarPengguna] = await Promise.all([
    all('SELECT a.tanggal, a.peran, a.pengguna_id FROM absensi a WHERE substr(a.tanggal, 1, 7) = ? ORDER BY a.tanggal', bulan),
    all('SELECT id, nama, nama_dharma, level, tipe, jabatan, aktif, is_pengajar FROM pengguna'),
  ]);
  const pengguna = new Map(daftarPengguna.map((u) => [u.id, u]));

  const per = new Map();
  const ambil = (u) => {
    if (!per.has(u.id)) {
      per.set(u.id, {
        pengguna_id: u.id, nama: u.nama, jabatan: u.jabatan, level: u.level,
        sesi_guru: 0, sesi_asisten: 0, sesi_gantikan: 0, hari_mengajar: 0,
        operasional: 0, transport: 0, tunjangan: 0, total: 0, ditahan: 0, memenuhi: true,
      });
    }
    return per.get(u.id);
  };

  // Kelompokkan per orang per hari
  const harian = new Map();
  for (const a of absen) {
    const k = `${a.pengguna_id}|${a.tanggal}`;
    if (!harian.has(k)) harian.set(k, []);
    harian.get(k).push(a);
  }

  for (const [k, sesi] of harian) {
    const u = pengguna.get(Number(k.split('|')[0]));
    if (!u) continue;
    const r = ambil(u);
    r.hari_mengajar++;
    for (const s of sesi) {
      if (s.peran === 'asisten') r.sesi_asisten++;
      else if (u.level === 'asisten') r.sesi_gantikan++;
      else r.sesi_guru++;
    }
    if (u.jabatan) {
      // Jabatan: hanya transport sekali per hari mengajar, tanpa honor sesi.
      r.transport += p.transport_jabatan;
      continue;
    }
    for (const s of sesi) {
      if (s.peran === 'asisten') r.operasional += p.op_asisten;
      else if (u.level === 'asisten') r.operasional += p.op_asisten_gantikan_guru;
      else r.operasional += p.op_guru;
    }
    if (u.level === 'guru') r.transport += p.transport_guru;
  }

  // Honor pembina (non-jabatan) hanya dibayar bila hadir minimal N hari dalam sebulan.
  for (const r of per.values()) {
    if (r.jabatan || r.level !== 'guru' || r.hari_mengajar >= p.min_hadir_pembina) continue;
    r.memenuhi = false;
    r.ditahan = r.operasional + r.transport;
    r.operasional = 0;
    r.transport = 0;
  }

  for (const u of pengguna.values()) {
    if (u.jabatan && u.aktif) ambil(u).tunjangan = p.tunjangan_jabatan;
  }

  const urutJabatan = Object.keys(JABATAN);
  const baris = [...per.values()]
    .map((r) => ({ ...r, total: r.operasional + r.transport + r.tunjangan }))
    .filter((r) => r.total > 0 || r.ditahan > 0)
    .sort((a, b) => (a.jabatan ? 0 : 1) - (b.jabatan ? 0 : 1) || urutJabatan.indexOf(a.jabatan) - urutJabatan.indexOf(b.jabatan) || a.nama.localeCompare(b.nama))
    .map((r) => ({
      ...r,
      keterangan: r.jabatan ? JABATAN[r.jabatan] : r.level === 'guru' ? 'Pembina' : 'Asisten',
    }));

  const total = {
    operasional: baris.reduce((n, r) => n + r.operasional, 0),
    transport: baris.reduce((n, r) => n + r.transport, 0),
    tunjangan: baris.reduce((n, r) => n + r.tunjangan, 0),
  };
  total.semua = total.operasional + total.transport + total.tunjangan;
  return { bulan, pengaturan: p, min_hadir: p.min_hadir_pembina, baris, total, terbilang: terbilang(total.semua) };
}

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Nomor surat dibuat sekali per bulan pengajuan; urut berulang dari 1 setiap tahun.
export async function nomorSurat(bulan, penggunaId) {
  const ada = await one('SELECT * FROM pengajuan_honor WHERE bulan = ?', bulan);
  if (ada) return ada;
  const d = now();
  const tahun = d.getUTCFullYear();
  const urut = ((await one('SELECT MAX(urut) AS m FROM pengajuan_honor WHERE tahun = ?', tahun)).m ?? 0) + 1;
  const kode = (await pengaturanHonor()).kode_surat || 'SMB';
  const nomor = `${String(urut).padStart(3, '0')}/${kode}/${ROMAWI[d.getUTCMonth()]}/${tahun}`;
  const tanggal = tglStr(d);
  await one(
    `INSERT INTO pengajuan_honor (bulan, tahun, urut, nomor, tanggal_surat, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (bulan) DO NOTHING RETURNING id`,
    bulan, tahun, urut, nomor, tanggal, penggunaId,
  );
  return one('SELECT * FROM pengajuan_honor WHERE bulan = ?', bulan);
}

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function kata(n) {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${kata(n - 10)} belas`;
  if (n < 100) return `${kata(Math.floor(n / 10))} puluh ${kata(n % 10)}`;
  if (n < 200) return `seratus ${kata(n - 100)}`;
  if (n < 1000) return `${kata(Math.floor(n / 100))} ratus ${kata(n % 100)}`;
  if (n < 2000) return `seribu ${kata(n - 1000)}`;
  if (n < 1e6) return `${kata(Math.floor(n / 1000))} ribu ${kata(n % 1000)}`;
  if (n < 1e9) return `${kata(Math.floor(n / 1e6))} juta ${kata(n % 1e6)}`;
  return `${kata(Math.floor(n / 1e9))} miliar ${kata(n % 1e9)}`;
}

export function terbilang(n) {
  if (!n) return 'Nol rupiah';
  const s = `${kata(n)} rupiah`.replace(/\s+/g, ' ').trim();
  return s[0].toUpperCase() + s.slice(1);
}
