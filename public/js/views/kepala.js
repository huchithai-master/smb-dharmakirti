import { api } from '../api.js';
import { esc, ikon, fmtTanggal, fmtBulan, peranLabel, toast, inisial, JENIS_IZIN, JABATAN } from '../ui.js';
import { blokHonorLaporan, pasangLaporan, menuItem } from './admin-data.js';

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '')).toString();

// Sub-menu Kepala SMB: Beranda (izin & penggantian), Atur Tugas, Lainnya (honor & rekap).
export function subNavKepala(aktif, wakil = false) {
  const dasar = wakil ? '#/wakil' : '#/kepala';
  const item = [['beranda', dasar, 'Beranda'], ...(wakil ? [['dashboard', '#/wakil/dashboard', 'Dashboard']] : []), ['tugas', dasar + '/tugas', 'Atur Tugas'], ...(wakil ? [] : [['lainnya', '#/kepala/lainnya', 'Lainnya']])];
  return `<nav class="seg tab-abu" aria-label="Menu Kepala SMB">${item
    .map(([k, href, label]) => `<a href="${href}" class="btn btn-kecil" style="min-height:40px;${k === aktif ? 'background:#fff;color:var(--utama);box-shadow:0 1px 3px rgba(17,24,39,.12)' : 'background:transparent;color:var(--abu)'}" ${k === aktif ? 'aria-current="page"' : ''}>${label}</a>`)
    .join('')}</nav>`;
}

// ---- Beranda Kepala SMB: izin yang menunggu keputusan dan kelas yang butuh pembina pengganti ----
let bulanIzin = null; // bulan yang sedang dilihat di rekap izin (null = bulan berjalan)
const geserBulanIzin = (b, n) => {
  const [y, m] = b.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
};

// Rekap izin sebulan: per orang, jumlah sakit/izin/tugas lain, lalu rincian tanggalnya.
function rekapIzinHtml(r) {
  const orang = new Map();
  for (const i of r.izin) {
    if (!orang.has(i.pengguna_id)) orang.set(i.pengguna_id, { nama: i.nama, baris: [] });
    orang.get(i.pengguna_id).baris.push(i);
  }
  const hitung = (baris, j) => baris.filter((i) => i.jenis === j && i.status !== 'ditolak').length;
  return [...orang.values()].map((o) => `
    <div class="kartu rapat">
      <div class="baris-antara"><span class="tebal">${esc(o.nama)}</span>
        <span class="kecil muted">${Object.entries(JENIS_IZIN).map(([k, v]) => `${v} ${hitung(o.baris, k)}`).join(' · ')}</span></div>
      ${o.baris.map((i) => `<div class="baris-antara sedang"><span>${esc(fmtTanggal(i.tanggal, 'pendek'))} · ${JENIS_IZIN[i.jenis]} · Slot ${esc(i.slot_nama)}${i.kelas_nama ? ' · ' + esc(i.kelas_nama) : ''}${i.alasan ? `<br><span class="kecil muted">"${esc(i.alasan)}"</span>` : ''}</span>
        <span class="chip chip-${i.status === 'disetujui' ? 'izin' : i.status === 'ditolak' ? 'alpa' : 'abu'}">${i.status === 'menunggu' ? 'Menunggu' : i.status === 'disetujui' ? 'Disetujui' : 'Ditolak'}</span></div>`).join('')}
    </div>`).join('') || '<div class="kosong" style="padding:12px">Tidak ada izin, sakit, atau tugas lain di bulan ini.</div>';
}

export async function beranda(el, { ctx }) {
  const wakil = !ctx.me.is_kepala;
  const P = wakil ? 'wakil' : 'kepala';
  const [d, rekap] = await Promise.all([
    api(`/api/${P}/ringkasan`),
    api(`/api/${P}/izin-bulan${bulanIzin ? '?bulan=' + bulanIzin : ''}`),
  ]);
  bulanIzin = rekap.bulan;
  const tindakan = d.izin_menunggu.length + d.butuh_pengganti.length;

  el.innerHTML = `
    <div class="hdr" style="padding-bottom:36px">
      <div class="hdr-atas">
        <div class="merek"><img class="merek-logo" src="/icons/logo-smb.png" alt="" width="26" height="31"> SMB Dharmakirti <span class="lencana">${wakil ? 'Wakil Kurikulum' : 'Kepala SMB'}</span></div>
        <a class="btn-ikon-terang" href="#/akun" aria-label="Akun saya">${ikon.orang()}</a>
      </div>
      <div class="sapaan">
        <div class="avatar">${esc(inisial(ctx.me.nama))}</div>
        <div class="tumpuk">
          <span class="sub">Namo Buddhaya,</span>
          <span style="font-size:19px;font-weight:700">${esc(ctx.me.nama)}</span>
          <span class="kecil" style="opacity:.92;font-weight:700">${esc(JABATAN[ctx.me.jabatan] ?? 'Kepala SMB')}</span>
          <span class="kecil" style="opacity:.92">${esc(fmtTanggal(d.hari_ini))}</span>
        </div>
      </div>
    </div>
    <div class="isi">
      ${subNavKepala('beranda', wakil)}
      ${d.butuh_pengganti.length ? `
      <div class="kartu" style="background:var(--oranye-bg);border-color:var(--oranye-garis)">
        <span class="label-kecil" style="color:var(--oranye)">Butuh pengganti</span>
        ${d.butuh_pengganti.map((b) => `
          <div class="baris-antara"><div class="tumpuk"><span class="tebal">Kelas ${esc(b.kelas_nama)} butuh pembina pengganti</span>
            <span class="kecil muted">${esc(fmtTanggal(b.tanggal, 'pendek'))} · Slot ${esc(b.slot_nama)} · ${esc(b.nama)} ${JENIS_IZIN[b.jenis].toLowerCase()}</span></div>
            <a class="btn btn-kecil btn-garis" style="width:auto;color:var(--oranye);border-color:var(--oranye)" href="#/${P}/tugas?${qs({ tanggal: b.tanggal, slot: b.slot_id, kelas: b.kelas_id, peran: 'guru', ganti: b.pengguna_id })}">Tunjuk</a></div>`).join('')}
      </div>` : ''}
      <h2 class="judul-seksi" id="izin">Izin menunggu persetujuan (${d.izin_menunggu.length})</h2>
      ${d.izin_menunggu.map((i) => `
        <div class="kartu rapat">
          <div class="tumpuk"><span class="tebal">${esc(i.nama)} · ${JENIS_IZIN[i.jenis]}</span>
            <span class="kecil muted">${esc(fmtTanggal(i.tanggal, 'pendek'))} · Slot ${esc(i.slot_nama)} · ${i.peran ? peranLabel(i.peran) + ' ' : ''}${esc(i.kelas_nama)}</span>
            ${i.alasan ? `<span class="kecil">"${esc(i.alasan)}"</span>` : ''}</div>
          <div class="dua-tombol">
            <button class="btn btn-netral btn-kecil" data-izin="${i.id}" data-putus="ditolak">Tolak</button>
            <button class="btn btn-utama btn-kecil" data-izin="${i.id}" data-putus="disetujui">Setujui</button>
          </div>
        </div>`).join('') || `<div class="kosong" style="padding:12px">${tindakan ? 'Tidak ada izin yang menunggu.' : 'Tidak ada izin atau penggantian yang perlu diputuskan.'}</div>`}
      <h2 class="judul-seksi">Rekap izin bulanan</h2>
      <div class="baris-antara" style="gap:8px">
        <button type="button" class="btn-kembali" data-bln="-1" aria-label="Bulan sebelumnya">${ikon.kiri()}</button>
        <span class="tebal">${fmtBulan(rekap.bulan)}</span>
        <button type="button" class="btn-kembali" data-bln="1" aria-label="Bulan berikutnya">${ikon.kanan()}</button>
      </div>
      ${rekapIzinHtml(rekap)}
    </div>`;

  el.addEventListener('click', async (e) => {
    const n = e.target.closest('[data-bln]');
    if (n) {
      bulanIzin = geserBulanIzin(bulanIzin, Number(n.dataset.bln));
      return ctx.muatUlang();
    }
    const b = e.target.closest('[data-izin]');
    if (!b) return;
    b.disabled = true;
    try {
      await api(`/api/${P}/izin/${b.dataset.izin}`, { method: 'POST', body: { keputusan: b.dataset.putus } });
      toast(b.dataset.putus === 'disetujui' ? 'Izin disetujui.' : 'Izin ditolak.');
      ctx.muatUlang();
    } catch (err) {
      toast(err.message, 'galat');
      b.disabled = false;
    }
  });
  // Pengajuan baru muncul sendiri: cek tiap 5 detik, dan segera saat aplikasi dibuka kembali.
  const segarkan = () => document.visibilityState === 'visible' && ctx.muatUlangDiam();
  const segar = setInterval(segarkan, 5000);
  document.addEventListener('visibilitychange', segarkan);
  return () => { clearInterval(segar); document.removeEventListener('visibilitychange', segarkan); };
}

// ---- Lainnya: honor & pengajuan, rekap absensi bulanan ----
export async function lainnya(el, { ctx }) {
  const bulanIni = ctx.waktu.tanggal.slice(0, 7);
  el.innerHTML = `
    <div class="hdr-putih"><div class="baris"><h1>Kepala SMB</h1></div></div>
    <div class="isi">
      ${subNavKepala('lainnya')}
      <span class="label-kecil">Murid</span>
      <div class="menu-grup">${menuItem('#/admin/murid', ikon.orang2(), 'Data Murid', 'Daftar semua murid di semua kelas')}</div>
      ${blokHonorLaporan(menuItem, bulanIni)}
    </div>`;
  pasangLaporan(el);
}
