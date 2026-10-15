import { api } from '../api.js';
import { esc, ikon, fmtBulan, fmtTanggal, fmtJam, bulanSingkat, peranLabel } from '../ui.js';
import { LOGO_KOP } from './honor.js';

const LABEL = { hadir: 'Hadir', terlambat: 'Terlambat', izin: 'Izin', alpa: 'Alpa', belum: 'Belum scan' };

function isiSel(s) {
  if (!s) return '<td class="sel kosong-sel">–</td>';
  if (s.status === 'hadir') return `<td class="sel s-hadir">${fmtJam(s.jam)}</td>`;
  if (s.status === 'terlambat') return `<td class="sel s-terlambat">${fmtJam(s.jam)}<small>T</small></td>`;
  if (s.status === 'izin') return '<td class="sel s-izin">Izin</td>';
  if (s.status === 'alpa') return '<td class="sel s-alpa">Alpa</td>';
  return '<td class="sel kosong-sel">·</td>';
}

const HURUF = { hadir: 'H', izin: 'I', sakit: 'S', alpa: 'A' };

export async function rekapMuridCetak(el, { query, ctx }) {
  const bulan = /^\d{4}-\d{2}$/.test(query.bulan ?? '') ? query.bulan : ctx.waktu.tanggal.slice(0, 7);
  const kelasId = Number(query.kelas) || 0;
  const d = await api(`/api/admin/rekap-murid?bulan=${bulan}${kelasId ? '&kelas_id=' + kelasId : ''}`);
  const kop = d.kop;
  const [y, m] = bulan.split('-').map(Number);
  const akhir = new Date(y, m, 0).getDate();
  const berjalan = d.hari_ini.slice(0, 7) === bulan;
  const hasKelas = d.kelas.filter((k) => k.sesi.length || k.murid.length);

  const kopHtml = `
    <header class="kop">
      ${LOGO_KOP}
      <div class="kop-teks">
        <div class="kop-nama">${esc(kop.nama_sekolah)}</div>
        <div>${esc(kop.alamat)}</div>
        <div>${esc(kop.kontak)}</div>
      </div>
    </header>`;

  const bagianKelas = (k, i) => {
    const tot = k.murid.reduce((t, o) => {
      for (const s of Object.keys(t)) t[s] += o.ringkasan[s];
      return t;
    }, { hadir: 0, izin: 0, sakit: 0, alpa: 0 });
    const adaMateri = k.sesi.filter((s) => s.materi || s.total);
    return `
      <section class="kelas-rekap ${i ? 'halaman-baru' : ''}">
        <h2 class="judul-bagian">Kelas ${esc(k.nama)} <span class="sub-judul">${k.murid.length} siswa · ${k.sesi.length} sesi</span></h2>
        ${k.sesi.length && k.murid.length ? `
        <table class="matriks">
          <thead>
            <tr>
              <th rowspan="2" class="no">No</th><th rowspan="2" class="nama">Nama Siswa</th>
              ${k.sesi.map((s) => `<th class="sesi">${Number(s.tanggal.slice(8))} ${bulanSingkat(s.tanggal)}</th>`).join('')}
              <th rowspan="2">H</th><th rowspan="2">I</th><th rowspan="2">S</th><th rowspan="2">A</th><th rowspan="2">%</th>
            </tr>
            <tr>${k.sesi.map((s) => `<th class="sesi slot">${esc(s.slot_nama)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${k.murid.map((o, n) => `<tr>
              <td class="tengah">${n + 1}</td><td class="nama">${esc(o.nama)}${o.aktif ? '' : ' <small>(nonaktif)</small>'}</td>
              ${k.sesi.map((s) => {
                const st = o.sel[s.kunci];
                return st ? `<td class="sel s-${st === 'sakit' ? 'izin' : st}">${HURUF[st]}</td>` : '<td class="sel kosong-sel">·</td>';
              }).join('')}
              <td class="tengah">${o.ringkasan.hadir}</td><td class="tengah">${o.ringkasan.izin}</td>
              <td class="tengah">${o.ringkasan.sakit}</td><td class="tengah">${o.ringkasan.alpa}</td>
              <td class="tengah"><b>${o.persen === null ? '–' : o.persen + '%'}</b></td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="${k.sesi.length + 2}" class="kanan"><b>Jumlah</b></td>
            <td class="tengah"><b>${tot.hadir}</b></td><td class="tengah"><b>${tot.izin}</b></td>
            <td class="tengah"><b>${tot.sakit}</b></td><td class="tengah"><b>${tot.alpa}</b></td><td></td>
          </tr></tfoot>
        </table>` : '<p>Belum ada data siswa atau sesi untuk kelas ini pada periode tersebut.</p>'}

        ${adaMateri.length ? `
        <h3 class="judul-kecil">Materi yang diajarkan</h3>
        <table class="rincian detail">
          <thead><tr><th>No</th><th>Tanggal</th><th>Slot</th><th>Pembina</th><th>Hadir</th><th>Materi</th></tr></thead>
          <tbody>
            ${adaMateri.map((s, n) => `<tr>
              <td class="tengah">${n + 1}</td>
              <td>${esc(fmtTanggal(s.tanggal, 'tanpa-hari'))}</td>
              <td>${esc(s.slot_nama)}</td>
              <td>${esc(s.pembina.join(', ') || '–')}</td>
              <td class="tengah">${s.total ? `${s.hadir}/${s.total}` : '–'}</td>
              <td>${s.materi ? esc(s.materi) : '<i>Belum dicatat</i>'}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : ''}
      </section>`;
  };

  el.innerHTML = `
    <div class="no-print alat-cetak">
      <a class="btn btn-netral btn-kecil" href="#/admin/lainnya" style="width:auto">${ikon.kembali(18)} Kembali</a>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        <label class="sr-only" for="bulan">Bulan</label>
        <input class="input" type="month" id="bulan" value="${bulan}" style="height:40px;width:auto">
        <label class="sr-only" for="kelas">Kelas</label>
        <select class="input" id="kelas" style="height:40px;width:auto">
          <option value="0">Semua kelas</option>
          ${d.daftar_kelas.map((k) => `<option value="${k.id}" ${k.id === kelasId ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}
        </select>
        <button class="btn btn-utama btn-kecil" id="cetak" style="width:auto">${ikon.unduh(18)} Cetak / Simpan PDF</button>
      </div>
    </div>

    <article class="surat lanskap rekap">
      ${kopHtml}
      <h1 class="judul-rekap">Rekap Absensi Murid &amp; Materi</h1>
      <p class="sub-rekap">Periode 1–${akhir} ${esc(fmtBulan(bulan))}${berjalan ? ` · data sampai ${esc(fmtTanggal(d.hari_ini, 'tanpa-hari'))}` : ''}${kelasId ? '' : ' · semua kelas'}</p>
      ${hasKelas.map(bagianKelas).join('') || '<p>Tidak ada data pada periode ini.</p>'}
      <p class="legenda">
        <span><i class="kotak s-hadir"></i>H = hadir</span>
        <span><i class="kotak s-izin"></i>I = izin, S = sakit</span>
        <span><i class="kotak s-alpa"></i>A = alpa</span>
        <span>· = absensi belum diisi</span>
      </p>
      ${d.libur.length ? `<p class="kecil-cetak">Hari libur pada periode ini: ${d.libur.map((l) => `${esc(l.alasan)} (${esc(l.mulai === l.selesai ? fmtTanggal(l.mulai, 'tanpa-hari') : fmtTanggal(l.mulai, 'tanpa-hari') + ' – ' + fmtTanggal(l.selesai, 'tanpa-hari'))})`).join('; ')}.</p>` : ''}

      <div class="kaki-rekap">
        <div class="kecil-cetak">Dicetak dari aplikasi SMB Dharmakirti pada ${esc(fmtTanggal(d.hari_ini))}.<br>
          Absensi siswa dan materi diisi oleh pembina kelas setelah ia sendiri tercatat hadir lewat scan QR.</div>
        <div class="ttd" style="margin:0">
          <div>${esc(kop.kota)}, ${esc(fmtTanggal(d.hari_ini).split(', ')[1])}<br>Kepala SMB</div>
          <div class="ttd-ruang"></div>
          <div class="ttd-nama">${esc(d.kepala ?? '(nama Kepala SMB)')}</div>
        </div>
      </div>
    </article>`;

  const ke = () => ctx.pergi(`/admin/rekap-murid/cetak?bulan=${el.querySelector('#bulan').value}&kelas=${el.querySelector('#kelas').value}`);
  el.querySelector('#cetak').addEventListener('click', () => window.print());
  el.querySelector('#bulan').addEventListener('change', (e) => e.target.value && ke());
  el.querySelector('#kelas').addEventListener('change', ke);
  const judulAsli = document.title;
  document.title = `Rekap Absensi Murid ${fmtBulan(bulan)} - SMB Dharmakirti`;
  return () => {
    document.title = judulAsli;
  };
}

export async function rekapCetak(el, { query, ctx }) {
  const bulan = /^\d{4}-\d{2}$/.test(query.bulan ?? '') ? query.bulan : ctx.waktu.tanggal.slice(0, 7);
  const d = await api(`/api/admin/rekap?bulan=${bulan}`);
  const kop = d.kop;
  const [y, m] = bulan.split('-').map(Number);
  const akhir = new Date(y, m, 0).getDate();
  const berjalan = d.hari_ini.slice(0, 7) === bulan;
  const detail = d.detail.filter((r) => r.status !== 'nanti');
  const total = d.orang.reduce((t, o) => {
    for (const k of Object.keys(t)) t[k] += o.ringkasan[k];
    return t;
  }, { hadir: 0, terlambat: 0, izin: 0, alpa: 0 });

  const kopHtml = `
    <header class="kop">
      ${LOGO_KOP}
      <div class="kop-teks">
        <div class="kop-nama">${esc(kop.nama_sekolah)}</div>
        <div>${esc(kop.alamat)}</div>
        <div>${esc(kop.kontak)}</div>
      </div>
    </header>`;

  el.innerHTML = `
    <div class="no-print alat-cetak">
      <a class="btn btn-netral btn-kecil" href="#/admin/lainnya" style="width:auto">${ikon.kembali(18)} Kembali</a>
      <div style="display:flex;gap:8px;align-items:center">
        <label class="sr-only" for="bulan">Bulan</label>
        <input class="input" type="month" id="bulan" value="${bulan}" style="height:40px;width:auto">
        <button class="btn btn-utama btn-kecil" id="cetak" style="width:auto">${ikon.unduh(18)} Cetak / Simpan PDF</button>
      </div>
    </div>

    <article class="surat lanskap rekap">
      ${kopHtml}
      <h1 class="judul-rekap">Rekap Absensi Pengajar</h1>
      <p class="sub-rekap">Periode 1–${akhir} ${esc(fmtBulan(bulan))}${berjalan ? ` · data sampai ${esc(fmtTanggal(d.hari_ini, 'tanpa-hari'))}` : ''}</p>

      ${d.sesi.length ? `
      <table class="matriks">
        <thead>
          <tr>
            <th rowspan="2" class="no">No</th><th rowspan="2" class="nama">Nama</th>
            ${d.sesi.map((s) => `<th class="sesi">${Number(s.tanggal.slice(8))} ${bulanSingkat(s.tanggal)}</th>`).join('')}
            <th rowspan="2">Hadir</th><th rowspan="2">Terl.</th><th rowspan="2">Izin</th><th rowspan="2">Alpa</th><th rowspan="2">%</th>
          </tr>
          <tr>${d.sesi.map((s) => `<th class="sesi slot">${esc(s.slot_nama)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${d.orang.map((o, i) => `<tr>
            <td class="tengah">${i + 1}</td><td class="nama">${esc(o.nama)}</td>
            ${d.sesi.map((s) => isiSel(o.sel[s.kunci])).join('')}
            <td class="tengah">${o.ringkasan.hadir}</td><td class="tengah">${o.ringkasan.terlambat}</td>
            <td class="tengah">${o.ringkasan.izin}</td><td class="tengah">${o.ringkasan.alpa}</td>
            <td class="tengah"><b>${o.persen === null ? '–' : o.persen + '%'}</b></td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <td colspan="${d.sesi.length + 2}" class="kanan"><b>Jumlah</b></td>
          <td class="tengah"><b>${total.hadir}</b></td><td class="tengah"><b>${total.terlambat}</b></td>
          <td class="tengah"><b>${total.izin}</b></td><td class="tengah"><b>${total.alpa}</b></td><td></td>
        </tr></tfoot>
      </table>
      <p class="legenda">
        <span><i class="kotak s-hadir"></i>Jam = hadir (jam scan)</span>
        <span><i class="kotak s-terlambat"></i>T = terlambat</span>
        <span><i class="kotak s-izin"></i>Izin disetujui</span>
        <span><i class="kotak s-alpa"></i>Alpa (tidak scan &amp; tidak izin)</span>
        <span>– = tidak bertugas · · = sesi belum ditutup</span>
      </p>` : '<p>Tidak ada sesi Sekolah Minggu pada periode ini.</p>'}

      ${detail.length ? `
      <h2 class="judul-bagian">Daftar Absensi Lengkap</h2>
      <table class="rincian detail">
        <thead><tr><th>No</th><th>Tanggal</th><th>Slot</th><th>Nama</th><th>Kelas</th><th>Peran</th><th>Jam Absen</th><th>Status</th><th>Keterangan</th></tr></thead>
        <tbody>
          ${detail.map((r, i) => `<tr>
            <td class="tengah">${i + 1}</td>
            <td>${esc(fmtTanggal(r.tanggal, 'tanpa-hari'))}</td>
            <td>${esc(r.slot_nama)}</td>
            <td>${esc(r.nama)}</td>
            <td>${esc(r.kelas)}</td>
            <td>${peranLabel(r.peran)}</td>
            <td class="tengah"><b>${r.jam ? fmtJam(r.jam) : '–'}</b></td>
            <td class="tengah st-${r.status}">${LABEL[r.status] ?? r.status}</td>
            <td>${esc(r.keterangan)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : ''}

      <div class="kaki-rekap">
        <div class="kecil-cetak">Dicetak dari aplikasi SMB Dharmakirti pada ${esc(fmtTanggal(d.hari_ini))}.<br>
          Kehadiran hanya tercatat lewat scan QR oleh pengajar sendiri; jam yang tercantum adalah jam scan.</div>
        <div class="ttd" style="margin:0">
          <div>${esc(kop.kota)}, ${esc(fmtTanggal(d.hari_ini).split(', ')[1])}<br>Kepala SMB</div>
          <div class="ttd-ruang"></div>
          <div class="ttd-nama">${esc(d.kepala ?? '(nama Kepala SMB)')}</div>
        </div>
      </div>
    </article>`;

  el.querySelector('#cetak').addEventListener('click', () => window.print());
  el.querySelector('#bulan').addEventListener('change', (e) => e.target.value && ctx.pergi(`/admin/rekap/cetak?bulan=${e.target.value}`));
  const judulAsli = document.title;
  document.title = `Rekap Absensi ${fmtBulan(bulan)} - SMB Dharmakirti`;
  return () => {
    document.title = judulAsli;
  };
}
