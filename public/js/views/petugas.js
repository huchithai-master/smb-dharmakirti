import { api } from '../api.js';
import { esc, ikon, fmtJam, fmtTanggal, peranLabel, muatSkrip, warnaStatus } from '../ui.js';

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dariB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function petugas(el, { ctx, query }) {
  if (!window.isSecureContext || !crypto.subtle) {
    el.innerHTML = `<div class="isi"><div class="galat">Layar QR hanya bisa dibuka lewat koneksi aman (HTTPS atau localhost).</div></div>`;
    return;
  }
  const [sesi] = await Promise.all([api('/api/petugas/sesi'), muatSkrip('/vendor/qrcode.js')]);
  const offset = sesi.server_ms - Date.now();
  const kunci = await crypto.subtle.importKey('raw', dariB64url(sesi.kunci), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  if (!sesi.slots.length) {
    el.innerHTML = `
      <div class="hdr-putih"><div class="baris"><h1>Petugas QR</h1></div></div>
      <div class="isi"><div class="kartu"><div class="kosong">${sesi.libur ? `Hari ini libur: ${esc(sesi.libur.alasan)} (${esc(fmtTanggal(sesi.tanggal))}).` : `Tidak ada sesi Sekolah Minggu hari ini (${esc(fmtTanggal(sesi.tanggal))}).`}</div></div></div>`;
    return;
  }

  const slotAwal = sesi.slots.find((s) => s.id === Number(query.slot)) ?? sesi.slots.find((s) => s.status_slot === 'buka')
    ?? sesi.slots.find((s) => s.status_slot === 'nanti') ?? sesi.slots[sesi.slots.length - 1];
  const st = { slot: slotAwal, kelasId: null, jendela: null, progres: null, offline: false };
  let wakeLock = null;
  let detik = null;
  let segar = null;

  el.innerHTML = `
    <div class="hdr" style="padding-bottom:56px;gap:6px">
      <div class="baris-antara">
        <span class="kecil tebal" style="letter-spacing:.5px;opacity:.92">PETUGAS QR · ${esc(ctx.me.nama.toUpperCase())}</span>
        <span class="kecil tebal" id="mode-badge" style="background:rgba(255,255,255,.18);padding:4px 10px;border-radius:999px"></span>
      </div>
      <span style="font-size:20px;font-weight:800" id="judul"></span>
      <span class="sedang" style="opacity:.92" id="subjudul"></span>
    </div>
    <div class="isi" style="padding-top:0">
      <div class="kartu bayang" style="margin-top:-40px;align-items:center" id="kartu-qr"></div>
      ${sesi.slots.length > 1 ? `<div class="seg tab-abu" role="tablist" aria-label="Pilih slot" id="tab-slot">
        ${sesi.slots.map((s) => `<button role="tab" data-slot="${s.id}">Slot ${esc(s.nama)}</button>`).join('')}</div>` : ''}
      <div id="progres" class="tumpuk" style="gap:10px"></div>
    </div>`;

  const kartuQr = el.querySelector('#kartu-qr');
  const progresEl = el.querySelector('#progres');

  function batasJam(s) {
    if (s.mode === 'konfirmasi') return `Jendela scan ${fmtJam(s.scan_mulai)}–${fmtJam(s.scan_selesai)}`;
    const [h, m] = s.jam_mulai.split(':').map(Number);
    const t = h * 60 + m + s.toleransi_menit;
    return `Tepat waktu s.d. ${String(Math.floor(t / 60)).padStart(2, '0')}.${String(t % 60).padStart(2, '0')} · ditutup ${fmtJam(s.scan_selesai)}`;
  }

  function statusSlotSekarang(s) {
    const d = new Date(Date.now() + offset);
    const m = d.getHours() * 60 + d.getMinutes();
    const mnt = (j) => Number(j.slice(0, 2)) * 60 + Number(j.slice(3));
    if (m < mnt(s.scan_mulai)) return 'nanti';
    if (m <= mnt(s.scan_selesai)) return 'buka';
    return 'selesai';
  }

  function header() {
    const s = st.slot;
    el.querySelector('#mode-badge').textContent = s.mode === 'konfirmasi' ? 'Mode Keliling' : 'Absen Masuk';
    el.querySelector('#judul').textContent = `Slot ${s.nama} · ${s.mode === 'konfirmasi' ? 'Konfirmasi' : fmtJam(s.jam_mulai) + '–' + fmtJam(s.jam_selesai)}`;
    el.querySelector('#subjudul').textContent = `${fmtTanggal(sesi.tanggal, 'pendek')} · ${batasJam(s)}`;
    for (const b of el.querySelectorAll('#tab-slot [data-slot]')) b.setAttribute('aria-selected', String(Number(b.dataset.slot) === s.id));
  }

  async function buatQr(jendela) {
    const kelas = st.slot.mode === 'konfirmasi' ? st.kelasId ?? 0 : 0;
    const payload = `${st.slot.id}.${sesi.tanggal}.${kelas}.${sesi.petugas_id}.${jendela}`;
    const sig = b64url(await crypto.subtle.sign('HMAC', kunci, new TextEncoder().encode(payload))).slice(0, 22);
    const qr = window.qrcode(0, 'M');
    qr.addData(`SMBH1.${payload}.${sig}`);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'Kode QR absensi' });
  }

  function kartuQrHtml() {
    const s = st.slot;
    const status = statusSlotSekarang(s);
    if (status !== 'buka') {
      return `<div class="kosong" style="padding:20px 8px">${status === 'nanti'
        ? `QR akan muncul pukul <b>${fmtJam(s.scan_mulai)}</b>.<br>Biarkan halaman ini terbuka.`
        : `Waktu scan Slot ${esc(s.nama)} sudah ditutup pukul ${fmtJam(s.scan_selesai)}.`}</div>`;
    }
    if (s.mode === 'konfirmasi' && !st.kelasId) {
      return `<div class="kosong" style="padding:20px 8px">Pilih kelas yang sedang Anda datangi di daftar <b>Rute kelas</b> di bawah.</div>`;
    }
    const kelas = st.progres?.kelas.find((k) => k.id === st.kelasId);
    const ditunggu = s.mode === 'konfirmasi' && kelas
      ? `<div class="info info-utama" style="align-self:stretch;flex-direction:column;gap:6px">
          <span class="kecil tebal">SEDANG DI KELAS ${esc(kelas.nama.toUpperCase())}</span>
          ${kelas.anggota.map((a) => `<div class="baris-antara sedang" style="width:100%"><span><b>${esc(a.nama)}</b> <span class="muted">· ${peranLabel(a.peran)}${a.keterangan ? ' · ' + esc(a.keterangan) : ''}</span></span>
            <span class="tebal" style="color:${warnaStatus(a.status)}">${a.status === 'hadir' || a.status === 'terlambat' ? 'Sudah scan' : a.status === 'izin' ? 'Izin' : 'Menunggu'}</span></div>`).join('')}
        </div>`
      : '';
    return `
      <span class="tebal">${s.mode === 'konfirmasi' ? 'Tunjukkan ke pengajar di kelas ini' : 'Tunjukkan ke pengajar yang datang'}</span>
      <div class="qr-wadah" id="qr"></div>
      <div style="align-self:stretch" class="tumpuk">
        <div class="baris-antara sedang"><span class="muted">QR berganti dalam</span><b style="color:var(--utama)" id="hitung">–</b></div>
        <div class="batang" style="height:6px;margin-top:6px"><div id="batang-hitung" style="width:100%;transition:none"></div></div>
      </div>
      ${ditunggu}
      <span class="kecil muted" style="text-align:center">Layar dijaga tetap menyala selama halaman ini terbuka${st.offline ? ' · offline: daftar mungkin belum terbaru' : ''}</span>`;
  }

  function progresHtml() {
    const p = st.progres;
    if (!p) return '<div class="kosong">Memuat daftar…</div>';
    if (!p.kelas.length) return '<div class="kosong">Belum ada pengajar terjadwal di slot ini.</div>';
    const butuh = (k) => k.anggota.filter((a) => a.status !== 'izin');
    const sudah = (k) => butuh(k).filter((a) => a.status === 'hadir' || a.status === 'terlambat').length;
    const total = p.kelas.reduce((n, k) => n + butuh(k).length, 0);
    const selesai = p.kelas.reduce((n, k) => n + sudah(k), 0);
    if (st.slot.mode === 'konfirmasi') {
      return `
        <div class="baris-antara"><h2 class="judul-seksi" style="margin:0">Rute kelas</h2><span class="sedang tebal" style="color:var(--utama)">${selesai} / ${total} terkonfirmasi</span></div>
        ${p.kelas.map((k) => {
          const n = sudah(k), t = butuh(k).length, lengkap = n === t, pilih = k.id === st.kelasId;
          const belum = butuh(k).filter((a) => a.status !== 'hadir' && a.status !== 'terlambat').map((a) => a.nama);
          const catatan = [...k.catatan, ...k.anggota.filter((a) => a.status === 'izin').map((a) => `${a.nama} izin`)];
          return `<button class="opsi rute-kelas" data-kelas="${k.id}" aria-pressed="${pilih}">
            <span class="mark ${lengkap ? 'lengkap' : ''}">${lengkap ? '✓' : t - n}</span>
            <span class="tumpuk"><span class="nama">${esc(k.nama)}</span>
              <span class="kecil muted">${pilih ? 'Sedang di sini' : lengkap ? 'Lengkap' : 'Belum: ' + esc(belum.join(', '))}${catatan.length ? ' · ' + esc(catatan.join(', ')) : ''}</span></span>
            <span class="sedang tebal" style="color:${lengkap ? 'var(--hijau-teks)' : 'var(--abu)'}">${n}/${t}</span>
          </button>`;
        }).join('')}`;
    }
    const semua = p.kelas.flatMap((k) => k.anggota.map((a) => ({ ...a, kelas: k.nama })));
    return `
      <div class="kartu">
        <div class="baris-antara"><span class="tebal">Sudah scan</span><span style="font-size:20px;font-weight:800">${selesai}<span class="sedang muted"> / ${total} pengajar</span></span></div>
        <div class="batang"><div style="width:${total ? Math.round((selesai / total) * 100) : 0}%"></div></div>
        ${semua.map((a) => `<div class="baris-antara sedang"><span><b>${esc(a.nama)}</b> <span class="muted">· ${peranLabel(a.peran)} · ${esc(a.kelas)}</span></span>
          <span class="tebal" style="color:${warnaStatus(a.status)}">${a.jam ? fmtJam(a.jam) + (a.status === 'terlambat' ? ' (terlambat)' : '') : a.status === 'izin' ? 'Izin' : 'Menunggu'}</span></div>`).join('')}
      </div>`;
  }

  async function gambarQr(paksa = false) {
    const target = el.querySelector('#qr');
    if (!target) return;
    const sekarang = Date.now() + offset;
    const jendela = Math.floor(sekarang / sesi.window_ms);
    if (paksa || jendela !== st.jendela) {
      st.jendela = jendela;
      target.innerHTML = await buatQr(jendela);
    }
    const sisa = Math.ceil((sesi.window_ms - (sekarang % sesi.window_ms)) / 1000);
    el.querySelector('#hitung').textContent = `0:${String(sisa % 60).padStart(2, '0')}`.replace('0:00', '1:00');
    el.querySelector('#batang-hitung').style.width = `${(sisa / (sesi.window_ms / 1000)) * 100}%`;
  }

  let statusTerakhir = null;
  function gambarKartu() {
    statusTerakhir = statusSlotSekarang(st.slot);
    kartuQr.innerHTML = kartuQrHtml();
    st.jendela = null;
    gambarQr(true);
  }

  async function muatProgres() {
    try {
      st.progres = await api(`/api/petugas/progres?slot_id=${st.slot.id}`);
      st.offline = false;
      if (st.slot.mode === 'konfirmasi' && !st.kelasId) {
        st.kelasId = st.progres.kelas.find((k) => k.anggota.some((a) => a.status === 'belum'))?.id ?? st.progres.kelas[0]?.id ?? null;
      }
    } catch {
      st.offline = true;
    }
    progresEl.innerHTML = progresHtml();
    gambarKartu();
  }

  function gantiSlot(slot) {
    st.slot = slot;
    st.kelasId = null;
    st.progres = null;
    header();
    progresEl.innerHTML = progresHtml();
    gambarKartu();
    muatProgres();
  }

  el.addEventListener('click', (e) => {
    const k = e.target.closest('[data-kelas]');
    if (k) {
      st.kelasId = Number(k.dataset.kelas);
      progresEl.innerHTML = progresHtml();
      gambarKartu();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const s = e.target.closest('[data-slot]');
    if (s) gantiSlot(sesi.slots.find((x) => x.id === Number(s.dataset.slot)));
  });

  async function jagaLayar() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      // tidak didukung atau ditolak
    }
  }
  document.addEventListener('visibilitychange', jagaLayar);
  jagaLayar();

  header();
  progresEl.innerHTML = progresHtml();
  gambarKartu();
  muatProgres();
  detik = setInterval(() => {
    if (statusSlotSekarang(st.slot) !== statusTerakhir) gambarKartu();
    else gambarQr();
  }, 1000);
  segar = setInterval(muatProgres, 10000);

  return () => {
    clearInterval(detik);
    clearInterval(segar);
    document.removeEventListener('visibilitychange', jagaLayar);
    wakeLock?.release().catch(() => {});
  };
}
