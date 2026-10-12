import { api } from '../api.js';
import { esc, ikon } from '../ui.js';

const kolomPin = (id, label, autocomplete) => `
  <div class="field">
    <label for="${id}">${label}</label>
    <input class="input pin-input" id="${id}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6"
      autocomplete="${autocomplete}" required>
  </div>`;

export async function login(el, { ctx }) {
  el.innerHTML = `
    <div class="hdr login-hdr">
      <div class="logo">${ikon.teratai(32)}</div>
      <div class="tumpuk" style="gap:6px">
        <h1>SMB Dharmakirti</h1>
        <span class="sub">Absensi pengajar ${esc(ctx.vihara)}</span>
      </div>
    </div>
    <div class="isi angkat">
      <form class="kartu bayang" id="form-login" novalidate>
        <h2 style="font-size:18px;font-weight:800">Masuk</h2>
        <div class="galat" id="galat" role="alert"></div>
        <div class="field">
          <label for="hp">No. HP</label>
          <input class="input" id="hp" type="tel" inputmode="tel" autocomplete="username" placeholder="08xxxxxxxxxx" required>
        </div>
        ${kolomPin('pin', 'PIN (6 angka)', 'current-password')}
        <button class="btn btn-utama" type="submit" id="tombol">Masuk</button>
      </form>
      <div class="info info-abu">${ikon.info()}<span>Belum punya PIN? Buka link undangan yang dikirim admin lewat WhatsApp. Lupa PIN? Minta admin mengirim undangan baru.</span></div>
    </div>`;

  const form = el.querySelector('#form-login');
  const galat = el.querySelector('#galat');
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
      await api('/api/login', { method: 'POST', body: { hp, pin } });
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

export async function aktivasi(el, { ctx, query }) {
  const kode = query.kode ?? '';
  let info;
  try {
    info = await api(`/api/aktivasi/${encodeURIComponent(kode)}`);
  } catch (e) {
    el.innerHTML = `
      <div class="hdr login-hdr"><div class="logo">${ikon.teratai(32)}</div><h1>Aktivasi Akun</h1></div>
      <div class="isi angkat"><div class="kartu bayang"><div class="galat">${esc(e.message)}</div>
      <a class="btn btn-garis" href="#/login">Ke halaman masuk</a></div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="hdr login-hdr">
      <div class="logo">${ikon.teratai(32)}</div>
      <div class="tumpuk" style="gap:6px">
        <span class="sub">Namo Buddhaya,</span>
        <h1>${esc(info.nama)}</h1>
        <span class="sub">${info.sudah_punya_pin ? 'Buat PIN baru untuk akun Anda.' : 'Buat PIN untuk masuk ke SMB Dharmakirti.'}</span>
      </div>
    </div>
    <div class="isi angkat">
      <form class="kartu bayang" id="form" novalidate>
        <div class="galat" id="galat" role="alert"></div>
        <div class="field">
          <label for="hp">Konfirmasi No. HP Anda</label>
          <input class="input" id="hp" type="tel" inputmode="tel" autocomplete="username" placeholder="08xxxxxxx${esc(info.hp_akhir)}" required>
          <span class="kecil muted">Nomor yang berakhiran …${esc(info.hp_akhir)}</span>
        </div>
        ${kolomPin('pin', 'PIN baru (6 angka)', 'new-password')}
        ${kolomPin('pin2', 'Ulangi PIN', 'new-password')}
        <div class="info info-abu">${ikon.info()}<span>Jangan pakai angka yang sama semua atau berurutan. PIN hanya Anda yang tahu, admin pun tidak bisa melihatnya.</span></div>
        <button class="btn btn-utama" type="submit" id="tombol">Simpan PIN &amp; Masuk</button>
      </form>
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
