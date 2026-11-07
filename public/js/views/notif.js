import { api } from '../api.js';
import { esc, ikon, toast } from '../ui.js';

const IKON = { izin: 'dokumen', sakit: 'info', tugas: 'orang', keputusan: 'centang', pengganti: 'tukar', pengumuman: 'megafon' };
const WARNA = { izin: 'i-oranye', sakit: 'i-merah', tugas: 'i-biru', keputusan: 'i-hijau', pengganti: 'i-hijau', pengumuman: 'i-biru' };

function waktuLalu(s) {
  const t = new Date(`${s.replace(' ', 'T')}Z`).getTime();
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
}

const dukungPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
const iOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const terpasang = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function kunciKeBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function aktifkanPush() {
  if (!dukungPush()) throw new Error('Browser ini belum mendukung notifikasi layar kunci.');
  const izin = await Notification.requestPermission();
  if (izin !== 'granted') throw new Error('Izin notifikasi ditolak. Aktifkan lewat pengaturan browser untuk situs ini.');
  const reg = await navigator.serviceWorker.ready;
  const { kunci } = await api('/api/push/kunci');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunciKeBytes(kunci) });
  await api('/api/push/langganan', { method: 'POST', body: sub.toJSON() });
}

export async function matikanPush() {
  if (dukungPush()) {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api('/api/push/berhenti', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  }
}

function bukaRincian(n) {
  document.getElementById('rincian-notif')?.remove();
  const latar = document.createElement('div');
  latar.id = 'rincian-notif';
  latar.className = 'modal-latar';
  latar.innerHTML = `
    <div class="modal-notif" role="dialog" aria-modal="true" aria-label="${esc(n.judul)}">
      <div class="mn-judul">${esc(n.judul)}</div>
      <div class="mn-waktu">${waktuLalu(n.dibuat)}</div>
      ${n.isi ? `<div class="mn-isi">${esc(n.isi)}</div>` : ''}
      <button type="button" class="btn btn-utama" id="tutup-rincian">Tutup</button>
    </div>`;
  const tutup = () => { latar.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = (e) => { if (e.key === 'Escape') tutup(); };
  latar.addEventListener('click', (e) => { if (e.target === latar) tutup(); });
  latar.querySelector('#tutup-rincian').addEventListener('click', tutup);
  document.addEventListener('keydown', esc_);
  document.body.appendChild(latar);
}

export async function notifikasi(el, { ctx, query }) {
  const d = await api('/api/notif');
  let aktifDiPerangkat = false;
  if (dukungPush() && Notification.permission === 'granted') {
    try { aktifDiPerangkat = !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()); } catch { /* abaikan */ }
  }

  const kartuPush = () => {
    if (!dukungPush()) {
      return iOS() && !terpasang()
        ? `<div class="info info-oranye">${ikon.info()}<span>Untuk menerima notifikasi di layar kunci iPhone, pasang aplikasi dulu: tombol Bagikan lalu "Tambah ke Layar Utama", buka dari ikon itu.</span></div>`
        : '';
    }
    return aktifDiPerangkat
      ? `<div class="kartu" style="flex-direction:row;align-items:center;gap:10px"><span class="tumpuk" style="flex:1"><span class="tebal">Notifikasi layar kunci aktif</span><span class="kecil muted">Di HP ini</span></span><button class="btn btn-netral btn-kecil" style="width:auto" id="push-mati">Matikan</button></div>`
      : `<div class="kartu"><span class="tebal">Aktifkan notifikasi layar kunci</span><span class="kecil muted">Izin, pengganti, dan pengumuman muncul di HP walau aplikasi tertutup.</span><button class="btn btn-utama" id="push-nyala">Aktifkan di HP ini</button></div>`;
  };

  const gambar = () => {
    const baru = d.daftar.filter((n) => !n.dibaca);
    const lama = d.daftar.filter((n) => n.dibaca);
    const baris = (n) => `
      <div class="notif-n ${n.dibaca ? '' : 'baru'}" data-id="${n.id}">
        ${n.dibaca ? '' : '<span class="notif-titik"></span>'}
        <div class="notif-ic ${WARNA[n.jenis] ?? 'i-biru'}">${ikon[IKON[n.jenis] ?? 'info'](20)}</div>
        <div class="tumpuk" style="gap:3px;min-width:0">
          <span class="tebal" style="font-size:15px;line-height:1.3">${esc(n.judul)}</span>
          <span class="kecil muted">${waktuLalu(n.dibuat)}</span>
        </div>
        ${ikon.kanan(16)}
      </div>`;
    el.innerHTML = `
      <div class="hdr-putih"><div class="baris">
        <button type="button" class="btn-kembali" id="kembali" aria-label="Kembali">${ikon.kembali()}</button>
        <h1 style="flex:1">Notifikasi</h1>
        ${baru.length ? '<button class="btn-teks" id="semua-baca" style="margin-right:8px">Tandai semua dibaca</button>' : ''}
      </div></div>
      <div class="isi">
        ${kartuPush()}
        ${baru.length ? `<span class="label-kecil">Baru</span>${baru.map(baris).join('')}` : ''}
        ${lama.length ? `<span class="label-kecil">Sebelumnya</span>${lama.map(baris).join('')}` : ''}
        ${d.daftar.length ? '' : '<div class="kartu"><div class="kosong" style="padding:16px">Belum ada notifikasi.</div></div>'}
      </div>`;
    el.querySelector('#kembali').addEventListener('click', () => ctx.pergi('/'));
    el.querySelector('#semua-baca')?.addEventListener('click', async () => {
      await api('/api/notif/baca', { method: 'POST', body: {} });
      d.daftar.forEach((n) => (n.dibaca = 1));
      window.dispatchEvent(new Event('notif-berubah'));
      gambar();
    });
    el.querySelectorAll('.notif-n').forEach((n) => n.addEventListener('click', async () => {
      const item = d.daftar.find((x) => x.id === Number(n.dataset.id));
      if (!item) return;
      bukaRincian(item);
      if (!item.dibaca) {
        item.dibaca = 1;
        await api('/api/notif/baca', { method: 'POST', body: { id: item.id } }).catch(() => {});
        window.dispatchEvent(new Event('notif-berubah'));
        gambar();
      }
    }));
    el.querySelector('#push-nyala')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        await aktifkanPush();
        aktifDiPerangkat = true;
        toast('Notifikasi layar kunci aktif.');
      } catch (err) {
        toast(err.message);
      }
      gambar();
    });
    el.querySelector('#push-mati')?.addEventListener('click', async () => {
      await matikanPush();
      aktifDiPerangkat = false;
      toast('Notifikasi layar kunci dimatikan di HP ini.');
      gambar();
    });
  };
  gambar();
  // Dari layar kunci: ?buka=<id> langsung membuka popup notifikasi itu.
  const idBuka = Number(query?.buka);
  if (idBuka) {
    history.replaceState(null, '', '#/notifikasi');
    const item = d.daftar.find((x) => x.id === idBuka);
    if (item) {
      bukaRincian(item);
      if (!item.dibaca) {
        item.dibaca = 1;
        api('/api/notif/baca', { method: 'POST', body: { id: item.id } }).catch(() => {}).then(() => window.dispatchEvent(new Event('notif-berubah')));
        gambar();
      }
    }
  }
}
