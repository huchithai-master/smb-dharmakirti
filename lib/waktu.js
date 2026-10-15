// Semua perhitungan hari/jam memakai WIB (UTC+7) di mana pun server berjalan.
// Date "dinding" WIB: field UTC-nya berisi tanggal dan jam WIB, jadi selalu dibaca dengan getUTC*.
const WIB_MS = 7 * 3600_000;

// Simulasi waktu untuk mencoba aplikasi di tanggal lain. Hanya aktif di server lokal (scripts/dev.js)
// dan tidak pernah aktif di Vercel. Disimpan di memori, jadi kembali ke waktu asli saat server dimulai ulang.
let selisihMs = 0;
let demoAktif = false;

export const simulasiTersedia = () => process.env.IZINKAN_SIMULASI_WAKTU === '1' && !process.env.VERCEL;

// wib: 'YYYY-MM-DDTHH:MM' dalam WIB, atau kosong untuk kembali ke waktu asli.
export function aturWaktuDemo(wib) {
  if (!wib) {
    selisihMs = 0;
    demoAktif = false;
    return;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(wib));
  if (!m) throw new Error('Format waktu tidak valid.');
  const [, y, mo, d, h, mi] = m.map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi) - WIB_MS;
  if (Number.isNaN(target)) throw new Error('Format waktu tidak valid.');
  selisihMs = target - Date.now();
  demoAktif = true;
}

// Waktu nyata (ms sejak epoch), dipakai untuk jendela QR dan token.
export const nowMs = () => Date.now() + selisihMs;

// Date "dinding" WIB saat ini.
export const now = () => new Date(nowMs() + WIB_MS);

export const pad = (n) => String(n).padStart(2, '0');
export const tglStr = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const jamStr = (d) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

export function menit(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export const menitNow = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();

export function dariTgl(tgl) {
  const [y, m, d] = tgl.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export const hariDari = (tgl) => dariTgl(tgl).getUTCDay();

export function tambahHari(tgl, n) {
  const d = dariTgl(tgl);
  d.setUTCDate(d.getUTCDate() + n);
  return tglStr(d);
}

// Tanggal terakhir bulan "YYYY-MM".
export function akhirBulan(bulan) {
  const [y, m] = bulan.split('-').map(Number);
  return tglStr(new Date(Date.UTC(y, m, 0)));
}

export function infoWaktu() {
  const d = now();
  return { tanggal: tglStr(d), jam: jamStr(d), server_ms: nowMs(), demo: demoAktif, demo_tersedia: simulasiTersedia() };
}
