export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const NAMA_HARI = HARI;

export function fmtTanggal(t, gaya = 'panjang') {
  const [y, m, d] = t.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (gaya === 'pendek') return `${HARI[dt.getDay()].slice(0, 3)}, ${d} ${BULAN[m - 1].slice(0, 3)}`;
  if (gaya === 'tanpa-hari') return `${d} ${BULAN[m - 1].slice(0, 3)} ${y}`;
  return `${HARI[dt.getDay()]}, ${d} ${BULAN[m - 1]} ${y}`;
}
export const fmtBulan = (b) => {
  const [y, m] = b.split('-').map(Number);
  return `${BULAN[m - 1]} ${y}`;
};
export const bulanSingkat = (t) => BULAN[Number(t.slice(5, 7)) - 1].slice(0, 3);
export const fmtJam = (j) => (j ? j.replace(':', '.') : '');
export const peranLabel = (p) => (p === 'guru' ? 'Pembina' : 'Asisten');
export const JABATAN = {
  kepala: 'Kepala SMB',
  wakil_pgtksd: 'Wakil Kurikulum PG TK SD',
  wakil_smpsma: 'Wakil Kurikulum SMP SMA',
  wakil_sarpras: 'Wakil Sarana Prasarana',
  bendahara: 'Bendahara',
  sekretaris: 'Sekretaris',
};
export const JENIS_IZIN = { sakit: 'Sakit', izin: 'Izin', tugas: 'Tugas lain' };

export function inisial(nama) {
  const k = String(nama).trim().split(/\s+/);
  return ((k[0]?.[0] ?? '') + (k[1]?.[0] ?? '')).toUpperCase();
}

const STATUS = {
  hadir: ['Hadir', 'hadir'],
  terlambat: ['Terlambat', 'terlambat'],
  izin: ['Izin', 'izin'],
  belum: ['Belum scan', 'abu'],
  alpa: ['Alpa', 'alpa'],
  nanti: ['Belum dibuka', 'abu'],
  menunggu: ['Menunggu', 'kuning'],
  disetujui: ['Disetujui', 'hadir'],
  ditolak: ['Ditolak', 'alpa'],
};
export function chip(status, label) {
  const [l, c] = STATUS[status] ?? [status, 'abu'];
  return `<span class="chip chip-${c}">${esc(label ?? l)}</span>`;
}
export const warnaStatus = (s) => ({ hadir: 'var(--hijau-teks)', terlambat: 'var(--oranye)', izin: 'var(--ungu)', alpa: 'var(--merah)' })[s] ?? 'var(--abu)';

let timerToast;
export function toast(pesan, jenis = 'info') {
  const el = document.getElementById('toast');
  el.textContent = pesan;
  el.className = `tampil ${jenis === 'galat' ? 'galat' : ''}`;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => (el.className = ''), 3200);
}

const skrip = new Map();
export function muatSkrip(src) {
  if (!skrip.has(src)) {
    skrip.set(src, new Promise((ok, gagal) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => {
        skrip.delete(src);
        gagal(new Error('Gagal memuat komponen. Periksa koneksi.'));
      };
      document.head.appendChild(s);
    }));
  }
  return skrip.get(src);
}

export const pesanGalat = (e) => `<div class="isi"><div class="galat">${esc(e.message)}</div></div>`;

// Ikon garis (stroke) sederhana
const svg = (d, ukuran = 22, lebar = 2) =>
  `<svg width="${ukuran}" height="${ukuran}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${lebar}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ikon = {
  teratai: (u = 26) => svg('<path d="M12 4c2 2.5 2 6 0 9-2-3-2-6.5 0-9z"/><path d="M12 13c-3-.5-6-2.5-7-5 3 0 5.5 1.5 7 5zM12 13c3-.5 6-2.5 7-5-3 0-5.5 1.5-7 5z"/><path d="M5 16c2.5 2 11.5 2 14 0"/>', u, 1.8),
  rumah: (u) => svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', u),
  jam: (u) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', u),
  dokumen: (u) => svg('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>', u),
  qr: (u) => svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 17v4h-4"/>', u),
  grafik: (u) => svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', u),
  orang: (u) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', u),
  orang2: (u) => svg('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7"/>', u),
  tukar: (u) => svg('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>', u),
  menu: (u) => svg('<path d="M4 6h16M4 12h16M4 18h16"/>', u),
  kembali: (u) => svg('<path d="M15 18 9 12l6-6"/>', u),
  kanan: (u = 18) => svg('<path d="m9 6 6 6-6 6"/>', u, 2.4),
  kiri: (u = 18) => svg('<path d="M15 18 9 12l6-6"/>', u, 2.4),
  centang: (u = 42) => svg('<path d="M5 12.5 10 17l9-10"/>', u, 2.6),
  silang: (u = 42) => svg('<path d="M6 6l12 12M18 6 6 18"/>', u, 2.6),
  info: (u = 16) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.01"/>', u),
  kalender: (u) => svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', u),
  buku: (u) => svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>', u),
  tambah: (u = 20) => svg('<path d="M12 5v14M5 12h14"/>', u, 2.4),
  unduh: (u) => svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', u),
  keluar: (u) => svg('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>', u),
  panah: (u = 18) => svg('<path d="M5 12h14M13 6l6 6-6 6"/>', u, 2.4),
  bangunan: (u) => svg('<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/>', u),
  hapus: (u = 18) => svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', u),
};

// Tombol pilihan sederhana: setiap tombol dengan data-nilai di dalam wadah [data-pilih] bersifat eksklusif.
export function pasangPilihan(wadah, onUbah) {
  wadah.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nilai]');
    if (!b || !wadah.contains(b)) return;
    for (const x of wadah.querySelectorAll('[data-nilai]')) x.setAttribute('aria-pressed', String(x === b));
    onUbah?.(b.dataset.nilai);
  });
}
