import { api } from './api.js';
import { esc, ikon, fmtTanggal, fmtJam } from './ui.js';
import * as auth from './views/auth.js';
import * as pengajar from './views/pengajar.js';
import * as scan from './views/scan.js';
import * as petugas from './views/petugas.js';
import * as admin from './views/admin.js';
import * as data from './views/admin-data.js';
import * as honor from './views/honor.js';
import * as laporan from './views/laporan.js';
import * as siswa from './views/siswa.js';

export const ctx = {
  me: null,
  waktu: null,
  vihara: '',
  dimuat: 0,
  installPrompt: null,
  muatUlang: () => render(),
  pergi: (path) => {
    if (location.hash === '#' + path) render();
    else location.hash = path;
  },
  segarkanMe: muatMe,
};

const RUTE = [
  { path: '/login', view: auth.login, publik: true, polos: true },
  { path: '/aktivasi', view: auth.aktivasi, publik: true, polos: true },
  { path: '/', view: pengajar.beranda, perlu: 'is_pengajar', nav: 'beranda' },
  { path: '/scan', view: scan.scan, perlu: 'is_pengajar', polos: true },
  { path: '/siswa', view: siswa.absenSiswa, perlu: 'is_pengajar', nav: 'beranda' },
  { path: '/riwayat', view: pengajar.riwayat, perlu: 'is_pengajar', nav: 'riwayat' },
  { path: '/izin', view: pengajar.izin, perlu: 'is_pengajar', nav: 'izin' },
  { path: '/akun', view: pengajar.akun, perlu: 'login', nav: 'akun' },
  { path: '/petugas', view: petugas.petugas, perlu: 'is_petugas', nav: 'petugas' },
  { path: '/admin', view: admin.dashboard, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/tugas', view: admin.tugas, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/lainnya', view: data.lainnya, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/pengguna', view: data.daftarPengguna, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/pengguna/:id', view: data.formPengguna, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/murid', view: siswa.daftarMurid, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/murid/:id', view: siswa.formMurid, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/libur', view: siswa.libur, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/kelas', view: data.kelas, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/slot', view: data.slot, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/honor', view: honor.honor, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/honor/pengaturan', view: honor.pengaturan, perlu: 'is_admin', nav: 'admin' },
  { path: '/admin/honor/cetak', view: honor.cetak, perlu: 'is_admin', polos: true, lebar: true },
  { path: '/admin/rekap/cetak', view: laporan.rekapCetak, perlu: 'is_admin', polos: true, lebar: true },
  { path: '/admin/rekap-murid/cetak', view: laporan.rekapMuridCetak, perlu: 'is_admin', polos: true, lebar: true },
].map((r) => {
  const nama = [];
  const pola = new RegExp('^' + r.path.replace(/:(\w+)/g, (_, n) => (nama.push(n), '([^/]+)')) + '$');
  return { ...r, pola, nama };
});

function bacaHash() {
  const h = location.hash.slice(1) || '/';
  const [path, q] = h.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(q || '')) };
}

export function rumah() {
  const m = ctx.me;
  if (!m) return '/login';
  if (m.is_pengajar) return '/';
  if (m.is_admin) return '/admin';
  if (m.is_petugas) return '/petugas';
  return '/akun';
}

async function muatMe() {
  const r = await api('/api/me');
  ctx.me = r.pengguna;
  ctx.waktu = r.waktu;
  ctx.vihara = r.nama_vihara;
  ctx.dimuat = Date.now();
}

// Perkiraan waktu server saat ini (termasuk simulasi waktu demo).
export function waktuServer() {
  return new Date(ctx.waktu.server_ms + (Date.now() - ctx.dimuat));
}

function navBawah(aktif) {
  const m = ctx.me;
  const item = [];
  if (m.is_pengajar) {
    item.push(['beranda', '#/', ikon.rumah(), 'Beranda']);
    item.push(['riwayat', '#/riwayat', ikon.jam(), 'Riwayat']);
    item.push(['izin', '#/izin', ikon.dokumen(), 'Izin']);
  }
  if (m.is_petugas) item.push(['petugas', '#/petugas', ikon.qr(), 'Petugas QR']);
  if (m.is_admin) item.push(['admin', '#/admin', ikon.grafik(), 'Admin']);
  item.push(['akun', '#/akun', ikon.orang(), 'Akun']);
  return `<nav class="nav-bawah" aria-label="Menu utama">${item
    .map(([k, href, ik, label]) => `<a href="${href}" ${k === aktif ? 'aria-current="page"' : ''}>${ik}${label}</a>`)
    .join('')}</nav>`;
}

function barDemo() {
  if (!ctx.waktu?.demo) return '';
  const d = waktuServer();
  const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const j = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const ubah = ctx.me?.is_admin ? '<a href="#/admin/waktu">Ubah</a>' : '';
  return `<div class="demo-bar"><span>Mode demo · waktu simulasi ${esc(fmtTanggal(t, 'pendek'))} ${fmtJam(j)}</span>${ubah}</div>`;
}

let bersihkan = null;
let nomorRender = 0;

async function render() {
  const nomor = ++nomorRender;
  const { path, query } = bacaHash();
  let rute = RUTE.find((r) => r.pola.test(path));
  if (!rute) return ctx.pergi(rumah());
  if (!rute.publik && !ctx.me) return ctx.pergi('/login');
  if (rute.path === '/login' && ctx.me) return ctx.pergi(rumah());
  if (rute.perlu && rute.perlu !== 'login' && !ctx.me[rute.perlu]) return ctx.pergi(rumah());

  if (bersihkan) {
    try { bersihkan(); } catch { /* abaikan */ }
    bersihkan = null;
  }
  const cocok = rute.pola.exec(path);
  const params = Object.fromEntries(rute.nama.map((n, i) => [n, decodeURIComponent(cocok[i + 1])]));
  const app = document.getElementById('app');
  app.classList.toggle('lebar', !!rute.lebar);
  app.innerHTML = `${rute.polos ? '' : barDemo()}<main id="view" class="${rute.polos ? 'polos' : ''}"><div class="memuat">Memuat…</div></main>${
    rute.nav && ctx.me ? navBawah(rute.nav) : ''
  }`;
  const el = app.querySelector('#view');
  window.scrollTo(0, 0);
  try {
    const hasil = await rute.view(el, { query, params, ctx });
    if (nomor === nomorRender) bersihkan = hasil || null;
    else if (typeof hasil === 'function') hasil();
  } catch (e) {
    if (nomor === nomorRender && e.status !== 401) {
      el.innerHTML = `<div class="isi"><div class="galat">${esc(e.message)}</div><button class="btn btn-garis" id="coba-lagi">Coba lagi</button></div>`;
      el.querySelector('#coba-lagi').onclick = () => render();
    }
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('sesi-habis', () => {
  ctx.me = null;
  ctx.pergi('/login');
});
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ctx.installPrompt = e;
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

(async function mulai() {
  try {
    await muatMe();
  } catch (e) {
    document.getElementById('app').innerHTML = `<div class="isi"><div class="galat">${esc(e.message)}</div></div>`;
    return;
  }
  render();
})();
