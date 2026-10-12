// Semua perhitungan hari/jam memakai WIB (UTC+7) di mana pun server berjalan.
// Date "dinding" WIB: field UTC-nya berisi tanggal dan jam WIB, jadi selalu dibaca dengan getUTC*.
const WIB_MS = 7 * 3600_000;

// Waktu nyata (ms sejak epoch), dipakai untuk jendela QR dan token.
export const nowMs = () => Date.now();

// Date "dinding" WIB saat ini.
export const now = () => new Date(Date.now() + WIB_MS);

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
  return { tanggal: tglStr(d), jam: jamStr(d), server_ms: nowMs(), demo: false };
}
