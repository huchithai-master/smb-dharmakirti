import { api } from '../api.js';
import { esc, ikon, toast, fmtBulan, fmtTanggal } from '../ui.js';

const rp = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const hdrKembali = (judul, ke) =>
  `<div class="hdr-putih"><div class="baris"><a class="btn-kembali" href="${ke}" aria-label="Kembali">${ikon.kembali()}</a><h1>${esc(judul)}</h1></div></div>`;

function rincianSesi(r) {
  const b = [];
  if (r.sesi_guru) b.push(`${r.sesi_guru} sesi pembina`);
  if (r.sesi_gantikan) b.push(`${r.sesi_gantikan} sesi gantikan pembina`);
  if (r.sesi_asisten) b.push(`${r.sesi_asisten} sesi asisten`);
  if (r.hari_mengajar) b.push(`${r.hari_mengajar} hari`);
  return b.join(' · ') || 'Tidak mengajar bulan ini';
}

export async function honor(el, { query, ctx }) {
  const bulan = query.bulan || ctx.waktu.tanggal.slice(0, 7);
  const d = await api(`/api/admin/honor?bulan=${encodeURIComponent(bulan)}`);
  const berjalan = d.bulan === d.hari_ini.slice(0, 7);

  el.innerHTML = `
    ${hdrKembali('Honor & Pengajuan', '#/admin/lainnya')}
    <div class="isi">
      <div class="field"><label for="bulan">Periode</label><input class="input" type="month" id="bulan" value="${d.bulan}"></div>
      ${berjalan ? `<div class="info info-oranye">${ikon.info()}<span>Bulan ${esc(fmtBulan(d.bulan))} masih berjalan, angka bisa bertambah sampai akhir bulan.</span></div>` : ''}
      <div class="kartu" style="background:var(--utama);border:none;color:#fff">
        <span class="sedang" style="opacity:.9">Total pengajuan ${esc(fmtBulan(d.bulan))}</span>
        <span style="font-size:28px;font-weight:800">${rp(d.total.semua)}</span>
        <span class="kecil" style="opacity:.9">${esc(d.terbilang)}</span>
        <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:4px">
          <div class="tumpuk"><span class="kecil" style="opacity:.85">Operasional</span><b class="sedang">${rp(d.total.operasional)}</b></div>
          <div class="tumpuk"><span class="kecil" style="opacity:.85">Transport</span><b class="sedang">${rp(d.total.transport)}</b></div>
          <div class="tumpuk"><span class="kecil" style="opacity:.85">Jabatan</span><b class="sedang">${rp(d.total.tunjangan)}</b></div>
        </div>
      </div>
      ${d.surat ? `<div class="info info-utama">${ikon.dokumen(16)}<span>Surat sudah dibuat: <b>${esc(d.surat.nomor)}</b> (${esc(fmtTanggal(d.surat.tanggal_surat, 'tanpa-hari'))}). Cetak ulang memakai nomor yang sama dengan angka terbaru.</span></div>` : ''}
      ${!d.kepala ? `<div class="info info-oranye">${ikon.info()}<span>Belum ada pengguna dengan jabatan <b>Kepala SMB</b>. Atur di Data Pengajar agar nama penanda tangan muncul di surat.</span></div>` : ''}
      ${d.baris.length
        ? `<a class="btn btn-utama" href="#/admin/honor/cetak?bulan=${d.bulan}">${ikon.dokumen(20)} ${d.surat ? 'Cetak ulang surat permohonan' : 'Buat surat permohonan (PDF)'}</a>`
        : ''}
      <a class="btn btn-garis btn-kecil" href="#/admin/honor/pengaturan">Atur tarif &amp; kop surat</a>
      <h2 class="judul-seksi">Rincian per orang (${d.baris.length})</h2>
      ${d.baris.map((r) => `
        <div class="kartu rapat">
          <div class="baris-antara"><div class="tumpuk"><span class="tebal">${esc(r.nama)}</span>
            <span class="kecil muted">${esc(r.keterangan)} · ${esc(rincianSesi(r))}</span></div>
            <b>${rp(r.total)}</b></div>
          <div class="kecil muted" style="display:flex;gap:12px;flex-wrap:wrap">
            ${r.operasional ? `<span>Operasional ${rp(r.operasional)}</span>` : ''}
            ${r.transport ? `<span>Transport ${rp(r.transport)}</span>` : ''}
            ${r.tunjangan ? `<span>Jabatan ${rp(r.tunjangan)}</span>` : ''}
          </div>
          ${r.memenuhi === false ? `<div class="info info-oranye">${ikon.info()}<span>Baru hadir <b>${r.hari_mengajar} hari</b>, minimal ${d.min_hadir} hari. Honor ${rp(r.ditahan)} belum dibayarkan.</span></div>` : ''}
        </div>`).join('') || '<div class="kosong">Belum ada honor untuk periode ini.</div>'}
      <div class="info info-abu">${ikon.info()}<span>Dihitung otomatis dari absensi: hanya sesi Hadir/Terlambat yang dibayar. Izin dan alpa tidak dihitung.</span></div>
    </div>`;

  el.querySelector('#bulan').addEventListener('change', (e) => e.target.value && ctx.pergi(`/admin/honor?bulan=${e.target.value}`));
}

const KOLOM_TARIF = [
  ['op_guru', 'Operasional pembina per sesi'],
  ['transport_guru', 'Transport pembina per hari mengajar'],
  ['op_asisten', 'Operasional asisten per sesi'],
  ['op_asisten_gantikan_guru', 'Operasional asisten yang menggantikan pembina, per sesi'],
  ['min_hadir_pembina', 'Minimal hadir pembina per bulan agar honor dibayar (hari)'],
  ['tunjangan_jabatan', 'Operasional tetap jabatan per bulan'],
  ['transport_jabatan', 'Transport jabatan per hari mengajar'],
];
const KOLOM_KOP = [
  ['nama_sekolah', 'Nama sekolah (kop surat)'],
  ['alamat', 'Alamat'],
  ['kontak', 'Kontak (telepon/email)'],
  ['kota', 'Kota (untuk tanggal surat)'],
  ['kode_surat', 'Kode nomor surat, mis. SMB-DK'],
  ['kepada', 'Surat ditujukan kepada'],
];

export async function pengaturan(el, { ctx }) {
  const { pengaturan: p } = await api('/api/admin/honor/pengaturan');
  el.innerHTML = `
    ${hdrKembali('Tarif & Kop Surat', '#/admin/honor')}
    <form class="isi" id="form" novalidate>
      <div class="galat" id="galat" role="alert"></div>
      <section class="kartu">
        <span class="label-kecil">Tarif honor (Rupiah)</span>
        ${KOLOM_TARIF.map(([k, l]) => `<div class="field"><label for="${k}">${l}</label>
          <input class="input" type="number" inputmode="numeric" min="0" step="${k === 'min_hadir_pembina' ? 1 : 1000}" id="${k}" name="${k}" value="${p[k]}"></div>`).join('')}
        <div class="info info-abu">${ikon.info()}<span>Pembina yang mengajar 2 sesi di hari yang sama mendapat 2× operasional dan 1× transport. Pembina yang hadir kurang dari batas minimal dalam sebulan tidak mendapat honor bulan itu (jabatan dan asisten tidak terkena aturan ini). Jabatan (Kepala, Wakil, Bendahara, Sekretaris) mendapat operasional tetap bulanan, dan bila mengajar hanya transport sekali per hari.</span></div>
      </section>
      <section class="kartu">
        <span class="label-kecil">Kop &amp; surat</span>
        ${KOLOM_KOP.map(([k, l]) => `<div class="field"><label for="${k}">${l}</label>
          <input class="input" id="${k}" name="${k}" maxlength="160" value="${esc(p[k])}"></div>`).join('')}
      </section>
      <div class="bar-bawah" style="margin:0 -16px"><button class="btn btn-utama" type="submit">Simpan</button></div>
    </form>`;
  el.querySelector('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    for (const [k] of KOLOM_TARIF) body[k] = Number(body[k]);
    try {
      await api('/api/admin/honor/pengaturan', { method: 'PUT', body });
      toast('Pengaturan honor disimpan.');
      ctx.pergi('/admin/honor');
    } catch (err) {
      el.querySelector('#galat').textContent = err.message;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

// Logo resmi SMB Dharmakirti untuk kop surat dan rekap (nama LOGO_CONTOH dipertahankan agar impor lama tetap jalan).
export const LOGO_CONTOH = `<img class="logo-kop" src="/icons/logo.png" alt="Logo SMB Dharmakirti">`;

export async function cetak(el, { query, ctx }) {
  const bulan = /^\d{4}-\d{2}$/.test(query.bulan ?? '') ? query.bulan : ctx.waktu.tanggal.slice(0, 7);
  const surat = await api('/api/admin/honor/surat', { method: 'POST', body: { bulan } });
  const d = await api(`/api/admin/honor?bulan=${bulan}`);
  const p = d.pengaturan;
  const [y, m] = bulan.split('-').map(Number);
  const akhir = new Date(y, m, 0).getDate();
  const kepala = d.kepala?.nama ?? '(nama Kepala SMB)';

  el.innerHTML = `
    <div class="no-print alat-cetak">
      <a class="btn btn-netral btn-kecil" href="#/admin/honor?bulan=${bulan}" style="width:auto">${ikon.kembali(18)} Kembali</a>
      <button class="btn btn-utama btn-kecil" id="cetak" style="width:auto">${ikon.unduh(18)} Cetak / Simpan PDF</button>
    </div>
    <article class="surat">
      <header class="kop">
        ${LOGO_CONTOH}
        <div class="kop-teks">
          <div class="kop-nama">${esc(p.nama_sekolah)}</div>
          <div class="kop-vihara">${esc(d.nama_vihara)}</div>
          <div>${esc(p.alamat)}</div>
          <div>${esc(p.kontak)}</div>
        </div>
      </header>

      <p class="kanan">${esc(p.kota)}, ${esc(fmtTanggal(surat.tanggal_surat).split(', ')[1])}</p>
      <table class="meta">
        <tr><td>Nomor</td><td>:</td><td>${esc(surat.nomor)}</td></tr>
        <tr><td>Lampiran</td><td>:</td><td>–</td></tr>
        <tr><td>Perihal</td><td>:</td><td><b>Permohonan Pencairan Dana Operasional Pengajar Bulan ${esc(fmtBulan(bulan))}</b></td></tr>
      </table>

      <p>Kepada Yth.<br><b>${esc(p.kepada)}</b><br>${esc(d.nama_vihara)}<br>di Tempat</p>

      <p>Namo Buddhaya,</p>
      <p>Dengan hormat,<br>Berdasarkan rekap absensi pengajar ${esc(p.nama_sekolah)} periode 1–${akhir} ${esc(fmtBulan(bulan))},
      bersama ini kami mengajukan permohonan pencairan dana operasional pengajar dengan rincian sebagai berikut:</p>

      <table class="rincian">
        <thead><tr>
          <th>No</th><th>Nama</th><th>Keterangan</th><th>Hari / Sesi</th><th>Operasional</th><th>Transport</th><th>Jabatan</th><th>Jumlah</th>
        </tr></thead>
        <tbody>
          ${d.baris.filter((r) => r.total > 0).map((r, i) => `<tr>
            <td class="tengah">${i + 1}</td><td>${esc(r.nama)}</td><td>${esc(r.keterangan)}</td>
            <td class="tengah">${r.hari_mengajar ? `${r.hari_mengajar} / ${r.sesi_guru + r.sesi_asisten + r.sesi_gantikan}` : '–'}</td>
            <td class="angka">${r.operasional ? rp(r.operasional) : '–'}</td>
            <td class="angka">${r.transport ? rp(r.transport) : '–'}</td>
            <td class="angka">${r.tunjangan ? rp(r.tunjangan) : '–'}</td>
            <td class="angka"><b>${rp(r.total)}</b></td></tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <td colspan="4" class="kanan"><b>Total</b></td>
          <td class="angka"><b>${rp(d.total.operasional)}</b></td><td class="angka"><b>${rp(d.total.transport)}</b></td>
          <td class="angka"><b>${rp(d.total.tunjangan)}</b></td><td class="angka"><b>${rp(d.total.semua)}</b></td>
        </tr></tfoot>
      </table>

      <p>Total dana yang diajukan sebesar <b>${rp(d.total.semua)}</b> (<i>${esc(d.terbilang)}</i>), dan mohon dapat diberikan secara <b>tunai</b>.</p>
      <p>Demikian permohonan ini kami sampaikan. Atas perhatian dan dukungan Bapak/Ibu, kami mengucapkan terima kasih. Anumodana.</p>
      <p><i>Sabbe Satta Bhavantu Sukhitatta.</i></p>

      <div class="ttd">
        <div>Hormat kami,<br>Kepala ${esc(p.nama_sekolah.replace(/^Sekolah Minggu Buddhis/i, 'SMB'))}</div>
        <div class="ttd-ruang"></div>
        <div class="ttd-nama">${esc(kepala)}</div>
      </div>

      <footer class="catatan">
        <b>Dasar perhitungan:</b> operasional pembina ${rp(p.op_guru)}/sesi dan transport ${rp(p.transport_guru)}/hari mengajar;
        operasional asisten ${rp(p.op_asisten)}/sesi; asisten yang menggantikan pembina ${rp(p.op_asisten_gantikan_guru)}/sesi;
        jabatan (Kepala, Wakil Kepala, Bendahara, Sekretaris) ${rp(p.tunjangan_jabatan)}/bulan dan ${rp(p.transport_jabatan)}/hari bila mengajar.
        Honor pembina dibayarkan bila hadir minimal ${p.min_hadir_pembina} hari dalam sebulan.
        Hanya kehadiran yang tercatat lewat scan QR (hadir/terlambat) yang dihitung.
      </footer>
    </article>`;

  el.querySelector('#cetak').addEventListener('click', () => window.print());
  const judulAsli = document.title;
  document.title = `Permohonan Honor ${fmtBulan(bulan)} - ${surat.nomor.replace(/\//g, '-')}`;
  return () => {
    document.title = judulAsli;
  };
}
