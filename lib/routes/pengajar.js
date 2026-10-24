import { one, all, run } from '../db.js';
import { gagal, teks, tanggal as cekTanggal, pilihan, bulat } from '../http.js';
import { now, nowMs, tglStr, jamStr, tambahHari } from '../waktu.js';
import { bacaToken, tokenSah, WINDOW_MS } from '../qr.js';
import { pemegangKunci } from './siswa.js';
import {
  slotHari, ambilSlot, statusSlot, statusPulang, punyaPulang, statusScan, tugasPengguna, daftarSlot, riwayatPengguna, liburPada, pembinaUtamaId,
} from '../jadwal.js';

// Sesi milik pengguna pada satu tanggal, lengkap dengan rekan sekelas dan status.
async function sesiPada(user, tanggal) {
  const hasil = [];
  for (const slot of await slotHari(tanggal)) {
    const d = await daftarSlot(tanggal, slot);
    for (const k of d.kelas) {
      const saya = k.anggota.find((a) => a.pengguna_id === user.id);
      if (!saya) continue;
      const kunci = slot.raya ? null : await pemegangKunci(tanggal, slot.id, k.gabung?.induk_id ?? k.id);
      // Kelas gabungan: ringkasan siswa dihitung dari semua kelas dalam kelompok.
      const kel = k.gabung ? d.kelas.filter((x) => k.gabung.ids.includes(x.id)) : [k];
      const siswa = kel.reduce((n, x) => ({ total: n.total + x.siswa.total, tercatat: n.tercatat + x.siswa.tercatat, hadir: n.hadir + x.siswa.hadir }), { total: 0, tercatat: 0, hadir: 0 });
      hasil.push({
        tanggal, kelas_id: k.id, siswa, materi: k.materi,
        slot_id: slot.id, slot_nama: slot.nama, jam_mulai: slot.jam_mulai, jam_selesai: slot.jam_selesai,
        mode: slot.mode, scan_mulai: slot.scan_mulai, scan_selesai: slot.scan_selesai, toleransi_menit: slot.toleransi_menit,
        status_slot: d.status_slot, pulang_mulai: slot.pulang_mulai, pulang_selesai: slot.pulang_selesai, ada_pulang: punyaPulang(slot),
        status_pulang: d.status_pulang, jam_pulang: saya.jam_pulang ?? null, kelas_nama: k.nama, peran: saya.peran, jenis: saya.jenis, keterangan: saya.keterangan,
        status: saya.status, jam: saya.jam ?? null, izin_menunggu: !!saya.izin_menunggu,
        bisa_absen_murid: !slot.raya, raya: !!slot.raya,
        gabung: k.gabung ? { induk_id: k.gabung.induk_id, nama: k.gabung.nama, jumlah_murid: siswa.total } : null,
        absen_dikunci_oleh: kunci && kunci.pengguna_id !== user.id ? kunci.nama : null,
        rekan: slot.raya ? [] : k.anggota.filter((a) => a.pengguna_id !== user.id).map((a) => ({ nama: a.nama, peran: a.peran })),
      });
    }
  }
  return hasil;
}

// Scan QR pulang: hanya untuk yang sudah tercatat masuk di sesi itu, dan hanya pada jam pulang yang diatur di slot.
async function scanPulang({ user, slot, tugas, tok, hariIni, d }) {
  if (!punyaPulang(slot)) gagal(400, `Slot ${slot.nama} tidak memakai absen pulang.`);
  if (tok.kelas_id) gagal(400, 'QR ini bukan QR absen pulang.');
  const sp = statusPulang(slot, hariIni, d);
  if (sp === 'nanti') gagal(400, `Absen pulang Slot ${slot.nama} baru dibuka pukul ${slot.pulang_mulai}.`);
  if (sp === 'selesai') gagal(400, `Waktu absen pulang Slot ${slot.nama} sudah ditutup pukul ${slot.pulang_selesai}.`);
  const a = await one('SELECT * FROM absensi WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ?', user.id, hariIni, slot.id);
  if (!a) gagal(400, 'Anda belum tercatat absen masuk di sesi ini, jadi absen pulang belum bisa dicatat.');
  const ringkas = (x) => ({
    tanggal: hariIni, slot_nama: slot.nama, mode: slot.mode, kelas_nama: tugas.kelas_nama, peran: tugas.peran, jenis: tugas.jenis,
    jam: x.jam_scan, status: x.status, pulang: true, jam_pulang: x.jam_pulang,
  });
  if (a.jam_pulang) return { ok: true, sudah: true, absensi: ringkas(a) };
  const jam = jamStr(d);
  await run('UPDATE absensi SET jam_pulang = ?, petugas_pulang_id = ? WHERE id = ? AND jam_pulang IS NULL', jam, tok.petugas_id, a.id);
  return { ok: true, absensi: ringkas({ ...a, jam_pulang: jam }) };
}

export default [
  {
    method: 'GET', path: '/api/beranda', akses: 'pengajar',
    handler: async ({ user }) => {
      const hariIni = tglStr(now());
      const [sesi, ke14] = await Promise.all([
        sesiPada(user, hariIni),
        Promise.all(Array.from({ length: 14 }, (_, i) => {
          const t = tambahHari(hariIni, i + 1);
          return sesiPada(user, t).then((s) => ({ t, s }));
        })),
      ]);
      const sel = ke14.find((x) => x.s.length);
      const berikutnya = sel ? { tanggal: sel.t, sesi: sel.s } : null;
      const bulan = hariIni.slice(0, 7);
      const { ringkasan, persen } = await riwayatPengguna(user, bulan);
      return { tanggal: hariIni, sesi, berikutnya, libur: await liburPada(hariIni), bulan: { bulan, ringkasan, persen } };
    },
  },
  {
    method: 'GET', path: '/api/riwayat', akses: 'pengajar',
    handler: async ({ user, query }) => {
      const bulan = /^\d{4}-\d{2}$/.test(query.bulan ?? '') ? query.bulan : tglStr(now()).slice(0, 7);
      return { bulan, ...(await riwayatPengguna(user, bulan)) };
    },
  },
  {
    method: 'GET', path: '/api/izin', akses: 'pengajar',
    handler: async ({ user, query }) => {
      const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.bulan ?? '') ? query.bulan : tglStr(now()).slice(0, 7);
      const [y, m] = bulan.split('-').map(Number);
      const akhir = tglStr(new Date(Date.UTC(y, m, 0)));
      return {
        bulan,
        izin: await all(
          `SELECT i.id, i.tanggal, i.jenis, i.alasan, i.status, s.nama AS slot_nama FROM izin i
           JOIN slot s ON s.id = i.slot_id WHERE i.pengguna_id = ? AND i.tanggal >= ? AND i.tanggal <= ?
           ORDER BY i.tanggal DESC, s.jam_mulai`,
          user.id, bulan + '-01', akhir,
        ),
        hari_ini: tglStr(now()),
      };
    },
  },
  {
    method: 'GET', path: '/api/izin/opsi', akses: 'pengajar',
    handler: async ({ user, query }) => {
      const t = cekTanggal(query.tanggal);
      const opsi = [];
      for (const slot of await slotHari(t)) {
        const tugas = await tugasPengguna(user.id, t, slot);
        if (!tugas) continue;
        const sudah = await one("SELECT status FROM izin WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ? AND status != 'ditolak'", user.id, t, slot.id);
        opsi.push({
          slot_id: slot.id, slot_nama: slot.nama, jam_mulai: slot.jam_mulai, jam_selesai: slot.jam_selesai,
          kelas_nama: tugas.kelas_nama, peran: tugas.peran, sudah_diajukan: sudah?.status ?? null,
          ditutup: statusSlot(slot, t) === 'selesai',
        });
      }
      return { tanggal: t, opsi };
    },
  },
  {
    method: 'POST', path: '/api/izin', akses: 'pengajar',
    handler: async ({ user, body }) => {
      const t = cekTanggal(body.tanggal);
      if (t < tglStr(now())) gagal(400, 'Izin tidak bisa diajukan untuk tanggal yang sudah lewat.');
      const libur = await liburPada(t);
      if (libur && libur.jenis !== 'raya') gagal(400, `Tanggal tersebut libur: ${libur.alasan}.`);
      const jenis = pilihan(body.jenis, ['sakit', 'izin', 'tugas'], 'Jenis izin');
      const alasan = teks(body.alasan, { maks: 300, label: 'Alasan' });
      const slotIds = Array.isArray(body.slot_ids) ? body.slot_ids.map((x) => bulat(x, 'Sesi')) : [];
      if (!slotIds.length) gagal(400, 'Pilih minimal satu sesi.');
      for (const id of slotIds) {
        const slot = await ambilSlot(id, t);
        if (!slot || !(await tugasPengguna(user.id, t, slot))) gagal(400, 'Anda tidak punya tugas di salah satu sesi yang dipilih.');
        if (statusSlot(slot, t) === 'selesai') gagal(400, `Sesi ${slot.nama} sudah selesai.`);
        if (await one('SELECT id FROM absensi WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ?', user.id, t, id)) {
          gagal(400, `Anda sudah tercatat hadir di sesi ${slot.nama}.`);
        }
      }
      for (const id of slotIds) {
        await run(
          `INSERT INTO izin (pengguna_id, tanggal, slot_id, jenis, alasan) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (pengguna_id, tanggal, slot_id) DO UPDATE SET jenis = excluded.jenis, alasan = excluded.alasan,
           status = 'menunggu', diputus_oleh = NULL, dibuat = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`,
          user.id, t, id, jenis, alasan || null,
        );
      }
      return { ok: true };
    },
  },
  {
    method: 'DELETE', path: '/api/izin/:id', akses: 'pengajar',
    handler: async ({ user, params }) => {
      const r = await run("DELETE FROM izin WHERE id = ? AND pengguna_id = ? AND status = 'menunggu'", bulat(params.id), user.id);
      if (!r.changes) gagal(400, 'Izin ini tidak bisa dibatalkan.');
      return { ok: true };
    },
  },
  {
    method: 'POST', path: '/api/scan', akses: 'pengajar',
    handler: async ({ user, body }) => {
      const tok = bacaToken(body.token);
      if (!tok) gagal(400, 'QR tidak dikenali. Pastikan memindai QR dari aplikasi SMB Dharmakirti.');
      const d = now();
      const hariIni = tglStr(d);
      if (tok.tanggal !== hariIni) gagal(400, 'QR ini bukan untuk hari ini.');
      if (tok.petugas_id === user.id) gagal(400, 'Tidak bisa memindai QR dari akun Anda sendiri.');
      const petugas = await one('SELECT id FROM pengguna WHERE id = ? AND aktif = 1 AND is_petugas = 1', tok.petugas_id);
      if (!petugas || !(await tokenSah(tok))) gagal(400, 'QR tidak sah.');
      const jendela = Math.floor(nowMs() / WINDOW_MS);
      if (tok.jendela !== jendela && tok.jendela !== jendela - 1) {
        gagal(400, 'QR sudah kedaluwarsa. Scan QR terbaru di layar petugas.');
      }
      const slot = await ambilSlot(tok.slot_id, hariIni);
      if (!slot) gagal(400, 'QR tidak sah.');
      const libur = await liburPada(hariIni);
      if (libur && !(libur.jenis === 'raya' && slot.raya)) gagal(400, `Hari ini libur: ${libur.alasan}.`);
      const st = statusSlot(slot, hariIni, d);
      if (tok.jenis !== 'pulang') {
        if (st === 'nanti') gagal(400, `Scan Slot ${slot.nama} baru dibuka pukul ${slot.scan_mulai}.`);
        if (st === 'selesai') gagal(400, `Waktu scan Slot ${slot.nama} sudah ditutup.`);
      }

      const tugas = await tugasPengguna(user.id, hariIni, slot);
      if (!tugas) gagal(400, `Anda tidak punya tugas mengajar di Slot ${slot.nama} hari ini.`);
      if (tok.jenis === 'pulang') return scanPulang({ user, slot, tugas, tok, hariIni, d });

      const ringkas = (a) => ({
        tanggal: hariIni, slot_nama: slot.nama, mode: slot.mode, kelas_nama: tugas.kelas_nama,
        peran: tugas.peran, jenis: tugas.jenis, jam: a.jam_scan, status: a.status,
      });
      const sudah = await one('SELECT * FROM absensi WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ?', user.id, hariIni, slot.id);
      if (sudah) return { ok: true, sudah: true, absensi: ringkas(sudah) };

      if (await one("SELECT id FROM izin WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ? AND status = 'disetujui'", user.id, hariIni, slot.id)) {
        gagal(400, 'Anda tercatat izin di sesi ini. Hubungi Kepala SMB jika ternyata hadir.');
      }
      if (slot.mode === 'konfirmasi') {
        if (!tok.kelas_id) gagal(400, 'QR ini bukan QR kelas.');
        if (tok.kelas_id !== tugas.kelas_id) {
          const k = await one('SELECT nama FROM kelas WHERE id = ?', tok.kelas_id);
          gagal(400, `QR ini untuk kelas ${k?.nama ?? '-'}. Tugas Anda hari ini di kelas ${tugas.kelas_nama}.`);
        }
      } else if (tok.kelas_id) {
        gagal(400, 'QR ini bukan QR absen masuk.');
      }

      const jam = jamStr(d);
      const a = { jam_scan: jam, status: statusScan(slot, jam) };
      const r = await run(
        `INSERT INTO absensi (tanggal, slot_id, pengguna_id, kelas_id, peran, jenis_tugas, jam_scan, waktu_scan, status, petugas_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (tanggal, slot_id, pengguna_id) DO NOTHING`,
        hariIni, slot.id, user.id, tugas.kelas_id, tugas.peran, tugas.jenis, jam, new Date().toISOString(), a.status, tok.petugas_id,
      );
      if (!r.changes) {
        // Scan ganda berbarengan: pakai catatan yang sudah ada.
        const ada = await one('SELECT * FROM absensi WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ?', user.id, hariIni, slot.id);
        return { ok: true, sudah: true, absensi: ringkas(ada) };
      }
      // Pengajar ternyata hadir: izin yang belum diputus tidak relevan lagi.
      await run("DELETE FROM izin WHERE pengguna_id = ? AND tanggal = ? AND slot_id = ? AND status = 'menunggu'", user.id, hariIni, slot.id);
      return { ok: true, absensi: ringkas(a) };
    },
  },
];
