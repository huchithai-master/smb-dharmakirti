import { now, nowMs, tglStr } from '../waktu.js';
import { gagal, bulat } from '../http.js';
import { kunciPetugas, WINDOW_MS } from '../qr.js';
import { slotHari, semuaKelas, ambilSlot, statusSlot, daftarSlot, liburPada } from '../jadwal.js';

export default [
  {
    method: 'GET', path: '/api/petugas/sesi', akses: 'petugas',
    handler: async ({ user }) => {
      const d = now();
      const hariIni = tglStr(d);
      const [slots, kelas, libur, kunci] = await Promise.all([
        slotHari(hariIni), semuaKelas(), liburPada(hariIni), kunciPetugas(user.id, hariIni),
      ]);
      return {
        tanggal: hariIni,
        libur,
        server_ms: nowMs(),
        window_ms: WINDOW_MS,
        petugas_id: user.id,
        kunci: kunci.toString('base64url'),
        slots: slots.map((s) => ({ ...s, status_slot: statusSlot(s, hariIni, d) })),
        kelas,
      };
    },
  },
  {
    method: 'GET', path: '/api/petugas/progres', akses: 'petugas',
    handler: async ({ query }) => {
      const slot = await ambilSlot(bulat(query.slot_id, 'Slot'));
      if (!slot) gagal(404, 'Slot tidak ditemukan.');
      const hariIni = tglStr(now());
      const d = await daftarSlot(hariIni, slot);
      if (!d) return { kelas: [], ringkasan: null };
      return {
        status_slot: d.status_slot,
        ringkasan: d.ringkasan,
        kelas: d.kelas.map((k) => ({
          id: k.id, nama: k.nama, catatan: k.catatan,
          anggota: k.anggota.map((a) => ({ nama: a.nama, peran: a.peran, keterangan: a.keterangan, status: a.status, jam: a.jam ?? null })),
        })),
      };
    },
  },
];
