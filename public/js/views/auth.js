import { api } from '../api.js';
import { esc, ikon } from '../ui.js';

const LOGO = '/icons/logo-smb.png';
const ALT_LOGO = 'Logo Sekolah Minggu Buddha Vihara Dharmakirti Palembang';
const KUNCI_SELAMAT_DATANG = 'smb_selamat_datang';

// Pola stupa berulang untuk latar biru navy (tiga salinan per ubin supaya tersusun selang-seling).
const POLA_STUPA = `
  <svg class="auth-pola" aria-hidden="true" focusable="false">
    <defs>
      <g id="smb-stupa" fill="none" stroke="#fff" stroke-opacity="0.15" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-27 78H27V70H-27Z"/>
        <path d="M-22 70H22V62H-22Z"/>
        <path d="M-18 62C-18 42 -10 33 0 33C10 33 18 42 18 62"/>
        <path d="M-4.5 62V55A4.5 4.5 0 0 1 4.5 55V62"/>
        <path d="M-7 33V26H7V33"/>
        <path d="M-5.5 26L-2.2 10M5.5 26L2.2 10"/>
        <path d="M-5 22H5M-4 18H4M-3.2 14H3.2"/>
        <path d="M0 10V3"/>
        <circle cx="0" cy="1.6" r="1.3"/>
      </g>
      <pattern id="smb-pola" width="120" height="108" patternUnits="userSpaceOnUse" patternTransform="translate(-6 -10)">
        <use href="#smb-stupa" transform="translate(30 14) scale(0.9)"/>
        <use href="#smb-stupa" transform="translate(90 68) scale(0.9)"/>
        <use href="#smb-stupa" transform="translate(90 -40) scale(0.9)"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#smb-pola)"/>
  </svg>`;

const GELOMBANG = `
  <svg class="auth-gelombang" viewBox="0 0 390 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d="M0,58 C70,4 150,0 220,32 C284,62 340,92 390,64 L390,101 L0,101Z" fill="#fff"/>
  </svg>`;

const hero = (ukuran, isi) => `<div class="auth-hero ${ukuran}">${POLA_STUPA}${isi}${GELOMBANG}</div>`;

const ikonSvg = (isi) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${isi}</svg>`;
const IKON_HP = ikonSvg('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>');
const IKON_PIN = ikonSvg('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>');
const IKON_MATA = ikonSvg('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
const IKON_MATA_TUTUP = ikonSvg('<path d="M3 3l18 18"/><path d="M10.6 5.7A10.7 10.7 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.2 4M6.5 7.2A16.6 16.6 0 0 0 2 12s3.6 6.5 10 6.5c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>');
const IKON_PANAH = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';

const kolomPin = (id, label, autocomplete) => `
  <div class="field">
    <label for="${id}">${label}</label>
    <input class="input pin-input" id="${id}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6"
      autocomplete="${autocomplete}" required>
  </div>`;

function sudahLihatSelamatDatang() {
  try { return sessionStorage.getItem(KUNCI_SELAMAT_DATANG) === '1'; } catch { return false; }
}
function tandaiSelamatDatang() {
  try { sessionStorage.setItem(KUNCI_SELAMAT_DATANG, '1'); } catch { /* penyimpanan diblokir: tidak masalah */ }
}

export async function login(el, { ctx }) {
  if (sudahLihatSelamatDatang()) return formMasuk(el, ctx);
  el.innerHTML = `
    <div class="auth">
      ${hero('besar', `<img class="auth-logo-besar" src="${LOGO}" alt="${ALT_LOGO}">`)}
      <div class="auth-isi auth-selamat">
        <h1 class="auth-judul">Selamat Datang</h1>
        <p class="auth-teks">Absensi pembina, asisten, dan siswa Sekolah Minggu Buddhis Dharmakirti.</p>
        <button class="auth-lanjut" type="button" id="lanjut" aria-label="Lanjut ke halaman masuk">
          <span>Lanjut</span><span class="auth-panah">${IKON_PANAH}</span>
        </button>
      </div>
    </div>`;
  el.querySelector('#lanjut').addEventListener('click', () => {
    tandaiSelamatDatang();
    formMasuk(el, ctx);
  });
}

function formMasuk(el, ctx) {
  el.innerHTML = `
    <div class="auth">
      ${hero('kecil', `
        <div class="auth-merek">
          <img class="auth-logo-kecil" src="${LOGO}" alt="${ALT_LOGO}">
          <div class="tumpuk" style="gap:4px">
            <span class="auth-nama">SMB Dharmakirti</span>
            <span class="auth-sub">Absensi pengajar</span>
          </div>
        </div>`)}
      <div class="auth-isi">
        <form id="form-login" novalidate>
          <div class="auth-judul-baris">
            <h1 class="auth-judul">Masuk</h1>
            <span class="auth-garis" aria-hidden="true"></span>
          </div>
          <div class="galat" id="galat" role="alert"></div>
          <div class="u-field">
            <label for="hp">No. HP</label>
            <div class="u-baris">
              ${IKON_HP}
              <input id="hp" type="tel" inputmode="tel" autocomplete="username" placeholder="08xxxxxxxxxx" required>
            </div>
          </div>
          <div class="u-field">
            <label for="pin">PIN (6 angka)</label>
            <div class="u-baris">
              ${IKON_PIN}
              <input id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" required>
              <button class="u-mata" type="button" id="mata" aria-label="Tampilkan PIN" aria-pressed="false">${IKON_MATA}</button>
            </div>
          </div>
          <div class="u-sela">
            <label class="u-cek"><input type="checkbox" id="ingat" checked> Ingat saya</label>
            <button class="u-lupa" type="button" id="lupa" aria-expanded="false" aria-controls="info-lupa">Lupa PIN?</button>
          </div>
          <div class="info info-abu" id="info-lupa" hidden>${ikon.info()}<span>Minta admin mengirim link undangan baru lewat WhatsApp untuk membuat PIN baru.</span></div>
          <button class="auth-tombol" type="submit" id="tombol">Masuk</button>
        </form>
        <p class="auth-kaki">Belum punya PIN? Buka link undangan dari admin lewat WhatsApp.</p>
      </div>
    </div>`;

  const form = el.querySelector('#form-login');
  const galat = el.querySelector('#galat');
  const pinEl = el.querySelector('#pin');
  const mata = el.querySelector('#mata');
  const lupa = el.querySelector('#lupa');
  const infoLupa = el.querySelector('#info-lupa');

  mata.addEventListener('click', () => {
    const tampil = pinEl.type === 'password';
    pinEl.type = tampil ? 'text' : 'password';
    mata.innerHTML = tampil ? IKON_MATA_TUTUP : IKON_MATA;
    mata.setAttribute('aria-pressed', String(tampil));
    mata.setAttribute('aria-label', tampil ? 'Sembunyikan PIN' : 'Tampilkan PIN');
  });
  lupa.addEventListener('click', () => {
    infoLupa.hidden = !infoLupa.hidden;
    lupa.setAttribute('aria-expanded', String(!infoLupa.hidden));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    galat.textContent = '';
    const hp = form.hp.value.trim();
    const pin = form.pin.value.trim();
    if (!hp || !/^\d{6}$/.test(pin)) {
      galat.textContent = 'Isi No. HP dan PIN 6 angka.';
      return;
    }
    const tombol = form.querySelector('#tombol');
    tombol.disabled = true;
    tombol.textContent = 'Memeriksa…';
    try {
      await api('/api/login', { method: 'POST', body: { hp, pin, ingat: form.ingat.checked } });
      await ctx.segarkanMe();
      location.hash = '/';
    } catch (err) {
      galat.textContent = err.message;
      form.pin.value = '';
      form.pin.focus();
    } finally {
      tombol.disabled = false;
      tombol.textContent = 'Masuk';
    }
  });
}

const heroAktivasi = (isi) => `
  ${hero('kecil', `<div class="auth-merek"><img class="auth-logo-kecil" src="${LOGO}" alt="${ALT_LOGO}">${isi}</div>`)}`;

export async function aktivasi(el, { ctx, query }) {
  const kode = query.kode ?? '';
  let info;
  try {
    info = await api(`/api/aktivasi/${encodeURIComponent(kode)}`);
  } catch (e) {
    el.innerHTML = `
      <div class="auth">
        ${heroAktivasi('<div class="tumpuk"><span class="auth-nama">Aktivasi Akun</span></div>')}
        <div class="auth-isi">
          <div class="galat" role="alert">${esc(e.message)}</div>
          <a class="btn btn-garis" href="#/login">Ke halaman masuk</a>
        </div>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="auth">
      ${heroAktivasi(`
        <div class="tumpuk" style="gap:4px">
          <span class="auth-sub">Namo Buddhaya,</span>
          <span class="auth-nama">${esc(info.nama)}</span>
          <span class="auth-sub">${info.sudah_punya_pin ? 'Buat PIN baru untuk akun Anda.' : 'Buat PIN untuk masuk ke SMB Dharmakirti.'}</span>
        </div>`)}
      <div class="auth-isi">
        <form class="auth-aktivasi" id="form" novalidate>
          <div class="galat" id="galat" role="alert"></div>
          <div class="field">
            <label for="hp">Konfirmasi No. HP Anda</label>
            <input class="input" id="hp" type="tel" inputmode="tel" autocomplete="username" placeholder="08xxxxxxx${esc(info.hp_akhir)}" required>
            <span class="kecil muted">Nomor yang berakhiran …${esc(info.hp_akhir)}</span>
          </div>
          ${kolomPin('pin', 'PIN baru (6 angka)', 'new-password')}
          ${kolomPin('pin2', 'Ulangi PIN', 'new-password')}
          <div class="info info-abu">${ikon.info()}<span>Jangan pakai angka yang sama semua atau berurutan. PIN hanya Anda yang tahu, admin pun tidak bisa melihatnya.</span></div>
          <button class="auth-tombol" type="submit" id="tombol">Simpan PIN &amp; Masuk</button>
        </form>
      </div>
    </div>`;

  const form = el.querySelector('#form');
  const galat = el.querySelector('#galat');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    galat.textContent = '';
    const pin = form.pin.value.trim();
    if (!/^\d{6}$/.test(pin)) return (galat.textContent = 'PIN harus 6 angka.');
    if (pin !== form.pin2.value.trim()) return (galat.textContent = 'Kedua PIN tidak sama.');
    const tombol = form.querySelector('#tombol');
    tombol.disabled = true;
    try {
      await api('/api/aktivasi', { method: 'POST', body: { kode, hp: form.hp.value, pin } });
      await ctx.segarkanMe();
      location.hash = '/';
    } catch (err) {
      galat.textContent = err.message;
    } finally {
      tombol.disabled = false;
    }
  });
}
