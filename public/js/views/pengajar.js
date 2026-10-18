import { api } from '../api.js';
import {
  esc, ikon, chip, fmtTanggal, fmtBulan, fmtJam, bulanSingkat, peranLabel, inisial, toast, JENIS_IZIN, JABATAN, pasangPilihan,
} from '../ui.js';

function infoSesi(s) {
  if (s.mode === 'konfirmasi') {
    return `<b>Konfirmasi ${fmtJam(s.scan_mulai)}–${fmtJam(s.scan_selesai)}.</b> Petugas akan datang ke kelas. Tidak ada status terlambat.`;
  }
  const batas = (() => {
    const [h, m] = s.jam_mulai.split(':').map(Number);
    const t = h * 60 + m + s.toleransi_menit;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}.${String(t % 60).padStart(2, '0')}`;
  })();
  return `<b>Absen masuk.</b> Scan di petugas pintu masuk mulai ${fmtJam(s.scan_mulai)}, tepat waktu s.d. ${batas}.${s.ada_pulang ? ` <b>Absen pulang</b> scan lagi pukul ${fmtJam(s.pulang_mulai)}–${fmtJam(s.pulang_selesai)}.` : ''}`;
}

// Daftar tim kelas: pembina dulu, lalu asisten, dengan nama sendiri ditandai "Anda".
function daftarTim(s, namaSaya) {
  const anggota = [
    { nama: namaSaya, peran: s.peran, saya: true, ket: s.jenis === 'pengganti' ? 'pengganti' : s.jenis === 'tambahan' ? 'pembina kedua' : '' },
    ...s.rekan.map((r) => ({ nama: r.nama, peran: r.peran, saya: false, ket: '' })),
  ];
  const grup = (peran, judul) => {
    const isi = anggota.filter((a) => a.peran === peran).sort((a, b) => Number(b.saya) - Number(a.saya));
    return `<div class="tim-grup"><span class="tim-judul">${judul}</span>${isi.length
      ? isi.map((a) => `<span class="tim-nama${a.saya ? ' saya' : ''}">${esc(a.nama)}${a.saya ? ' <em>Anda</em>' : ''}${a.ket ? ` <small>(${a.ket})</small>` : ''}</span>`).join('')
      : '<span class="tim-nama kosong">Belum ada</span>'}</div>`;
  };
  return `<div class="tim">${grup('guru', 'Pembina')}${grup('asisten', 'Asisten')}</div>`;
}

function kartuSesi(s, bisaScan, namaSaya) {
  const ket = s.keterangan ? `<span class="info info-ungu">${ikon.info()}<span>${esc(s.keterangan)}</span></span>` : '';
  let aksi = '';
  if (s.status === 'hadir' || s.status === 'terlambat') {
    aksi = `<div class="info info-hijau">${ikon.centang(16)}<span>Tercatat ${s.status === 'terlambat' ? 'terlambat' : 'hadir'} pukul <b>${fmtJam(s.jam)}</b>.</span></div>`;
    if (s.ada_pulang) {
      if (s.jam_pulang) aksi += `<div class="info info-hijau">${ikon.centang(16)}<span>Pulang tercatat pukul <b>${fmtJam(s.jam_pulang)}</b>.</span></div>`;
      else if (bisaScan && s.status_pulang === 'buka') aksi += `<a class="btn btn-utama" href="#/scan">${ikon.qr(20)} Scan QR Pulang</a>`;
      else if (bisaScan && s.status_pulang === 'nanti') aksi += `<button class="btn btn-abu" disabled>Absen pulang dibuka pukul ${fmtJam(s.pulang_mulai)}</button>`;
      else if (bisaScan) aksi += `<div class="info info-abu">${ikon.info()}<span>Absen pulang sudah ditutup.</span></div>`;
    }
  } else if (s.status === 'izin') {
    aksi = `<div class="info info-ungu">${ikon.info()}<span>Izin Anda untuk sesi ini sudah disetujui.</span></div>`;
  } else if (s.status === 'alpa') {
    aksi = `<div class="info info-merah">${ikon.info()}<span>Sesi sudah ditutup tanpa scan.</span></div>`;
  } else if (bisaScan && s.status_slot === 'buka') {
    aksi = `<a class="btn btn-utama" href="#/scan">${ikon.qr(20)} Scan QR dari Petugas</a>`;
  } else if (bisaScan) {
    aksi = `<button class="btn btn-abu" disabled>Scan dibuka pukul ${fmtJam(s.scan_mulai)}</button>`;
  }
  let siswa = '';
  if (bisaScan && s.peran === 'guru' && s.bisa_absen_murid) {
    const sudahAbsen = s.status === 'hadir' || s.status === 'terlambat';
    const tercatat = s.siswa?.tercatat > 0;
    if (sudahAbsen) {
      if (tercatat) siswa += `<div class="info info-hijau">${ikon.centang(16)}<span>Absensi siswa: <b>${s.siswa.hadir} dari ${s.siswa.total}</b> hadir${s.materi ? ' · materi sudah dicatat' : ' · materi belum diisi'}.</span></div>`;
      siswa += `<a class="btn ${tercatat && s.materi ? 'btn-garis' : 'btn-utama'}" href="#/siswa?slot=${s.slot_id}">${ikon.orang2(20)} ${tercatat ? 'Ubah absensi siswa &amp; materi' : 'Absen Siswa'}</a>`;
    } else if (s.status === 'belum' || s.status === 'nanti') {
      siswa = `<button class="btn btn-abu" disabled>Absen Siswa terbuka setelah Anda absen</button>`;
    }
  }
  const izinMenunggu = s.izin_menunggu ? `<div class="info info-oranye">${ikon.info()}<span>Pengajuan izin Anda sedang menunggu keputusan Kepala SMB.</span></div>` : '';
  return `
    <div class="kartu">
      <div class="baris-antara" style="align-items:flex-start">
        <div class="tumpuk" style="gap:4px">
          <span class="slot-label ${s.status_slot === 'buka' ? '' : 'abu'}">Slot ${esc(s.slot_nama)} · ${fmtJam(s.jam_mulai)}–${fmtJam(s.jam_selesai)}</span>
          <span class="nama-kelas">Kelas ${esc(s.kelas_nama)}</span>
        </div>
        ${chip(s.status)}
      </div>
      ${daftarTim(s, namaSaya)}
      ${ket}
      <div class="info info-abu">${ikon.jam(16)}<span>${infoSesi(s)}</span></div>
      ${izinMenunggu}
      ${aksi}
      ${siswa}
    </div>`;
}

export async function beranda(el, { ctx }) {
  const d = await api('/api/beranda');
  const me = ctx.me;
  const { ringkasan: r, persen } = d.bulan;
  const sesiHariIni = d.sesi.length
    ? d.sesi.map((s) => kartuSesi(s, true, me.nama)).join('')
    : d.libur
      ? `<div class="info info-oranye">${ikon.info()}<span><b>Hari ini libur</b>: ${esc(d.libur.alasan)}. Tidak perlu scan QR.</span></div>`
      : `<div class="kartu"><div class="kosong" style="padding:16px">Tidak ada jadwal mengajar hari ini.</div></div>`;
  const berikut = d.berikutnya
    ? `<h2 class="judul-seksi">Jadwal berikutnya · ${esc(fmtTanggal(d.berikutnya.tanggal, 'pendek'))}</h2>${d.berikutnya.sesi.map((s) => kartuSesi(s, false, me.nama)).join('')}`
    : '';

  el.innerHTML = `
    <div class="hdr">
      <div class="hdr-atas">
        <div class="merek"><img class="merek-logo" src="/icons/logo-smb.png" alt="" width="26" height="31"> SMB Dharmakirti</div>
        <a class="btn-ikon-terang" href="#/akun" aria-label="Akun saya">${ikon.orang()}</a>
      </div>
      <div class="sapaan">
        <div class="avatar">${esc(inisial(me.nama))}</div>
        <div class="tumpuk">
          <span class="sub">Namo Buddhaya,</span>
          <span style="font-size:19px;font-weight:700">${esc(me.nama)}</span>
          ${me.jabatan && JABATAN[me.jabatan] ? `<span class="kecil" style="opacity:.92;font-weight:700">${esc(JABATAN[me.jabatan])}</span>` : ''}
          <span class="kecil" style="opacity:.92">${me.level ? peranLabel(me.level) : ''}${me.tipe === 'cadangan' ? ' cadangan' : ''}</span>
        </div>
      </div>
    </div>
    <div class="angkat">
      <div class="kartu bayang" style="flex-direction:row;align-items:center;gap:12px">
        <div class="ikon-kotak">${ikon.kalender()}</div>
        <div class="tumpuk" style="flex:1"><span class="kecil muted">Hari ini</span><span class="tebal">${esc(fmtTanggal(d.tanggal))}</span></div>
        <span class="chip chip-hadir">${d.sesi.length} sesi</span>
      </div>
    </div>
    <div class="isi">
      <h2 class="judul-seksi">Jadwal Mengajar Hari Ini <a href="#/riwayat">Lihat riwayat</a></h2>
      ${sesiHariIni}
      ${berikut}
      <h2 class="judul-seksi">Kehadiran ${esc(fmtBulan(d.bulan.bulan))}</h2>
      <div class="kartu">
        <div class="baris-antara"><span class="sedang muted">Persentase hadir</span>
          <span style="font-size:22px;font-weight:800;color:var(--utama)">${persen === null ? '–' : persen + '%'}</span></div>
        <div class="batang"><div style="width:${persen ?? 0}%"></div></div>
        <div class="stat-polos">
          <div><b>${r.hadir}</b><span style="color:var(--hijau-teks)">Hadir</span></div>
          <div><b>${r.terlambat}</b><span style="color:var(--oranye)">Terlambat</span></div>
          <div><b>${r.izin}</b><span style="color:var(--ungu)">Izin</span></div>
          <div><b>${r.alpa}</b><span style="color:var(--merah)">Alpa</span></div>
        </div>
      </div>
    </div>`;
}

export async function riwayat(el, { query }) {
  const d = await api(`/api/riwayat${query.bulan ? '?bulan=' + encodeURIComponent(query.bulan) : ''}`);
  const [y, m] = d.bulan.split('-').map(Number);
  const geser = (n) => {
    const t = new Date(y, m - 1 + n, 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
  };
  let filter = 'semua';

  el.innerHTML = `
    <div class="hdr-putih">
      <div class="baris" style="justify-content:space-between">
        <h1>Riwayat</h1>
        <div style="display:flex;align-items:center;white-space:nowrap">
          <a class="btn-kembali" href="#/riwayat?bulan=${geser(-1)}" aria-label="Bulan sebelumnya">${ikon.kiri()}</a>
          <span class="tebal sedang">${esc(fmtBulan(d.bulan))}</span>
          <a class="btn-kembali" href="#/riwayat?bulan=${geser(1)}" aria-label="Bulan berikutnya">${ikon.kanan()}</a>
        </div>
      </div>
      <div class="chips" id="filter" style="padding:0 4px">
        ${['semua', 'hadir', 'terlambat', 'izin', 'alpa']
          .map((f) => `<button data-f="${f}" aria-pressed="${f === 'semua'}">${f === 'semua' ? 'Semua' : f[0].toUpperCase() + f.slice(1)} (${f === 'semua' ? d.baris.filter((b) => b.status in d.ringkasan).length : d.ringkasan[f]})</button>`)
          .join('')}
      </div>
    </div>
    <div class="isi" id="daftar"></div>`;

  const daftar = el.querySelector('#daftar');
  const tampil = () => {
    // Sesi yang belum selesai (belum dibuka / belum scan) tidak masuk riwayat.
    const rows = d.baris.filter((b) => (filter === 'semua' ? b.status in d.ringkasan : b.status === filter));
    daftar.innerHTML = rows.length
      ? rows
          .map(
            (b) => `
        <div class="item-link">
          <div class="tanggal-kotak"><b>${Number(b.tanggal.slice(8))}</b><span>${bulanSingkat(b.tanggal)}</span></div>
          <div class="tumpuk">
            <span class="tebal">${esc(b.kelas_nama)} · ${peranLabel(b.peran)}${b.jenis === 'pengganti' ? ' Pengganti' : ''}</span>
            <span class="kecil muted">${esc(b.slot_nama)}${b.jam ? (b.mode === 'konfirmasi' ? ' · dikonfirmasi ' : ' · scan ') + fmtJam(b.jam) : ''}${b.jam_pulang ? ' · pulang ' + fmtJam(b.jam_pulang) : ''}${b.keterangan ? ' · ' + esc(b.keterangan) : ''}</span>
          </div>
          ${chip(b.status)}
        </div>`,
          )
          .join('')
      : `<div class="kosong">Belum ada data untuk filter ini.</div>`;
  };
  tampil();
  el.querySelector('#filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    for (const x of el.querySelectorAll('#filter button')) x.setAttribute('aria-pressed', String(x === b));
    tampil();
  });
}

export async function izin(el) {
  const d = await api('/api/izin');
  let jenis = 'izin';

  el.innerHTML = `
    <div class="hdr-putih"><div class="baris"><div class="tumpuk" style="padding-left:8px">
      <h1 style="padding-left:0">Ajukan Izin</h1>
      <span class="kecil muted">Ajukan sebelum hari mengajar agar Kepala SMB bisa menunjuk pengganti</span>
    </div></div></div>
    <div class="isi">
      <form class="kartu" id="form" novalidate>
        <div class="galat" id="galat" role="alert"></div>
        <div class="field"><span class="label">Jenis</span>
          <div class="seg" id="jenis">
            ${Object.entries(JENIS_IZIN).map(([k, v]) => `<button type="button" data-nilai="${k}" aria-pressed="${k === jenis}">${v}</button>`).join('')}
          </div>
        </div>
        <div class="field"><label for="tgl">Tanggal</label>
          <input class="input" type="date" id="tgl" min="${d.hari_ini}" required></div>
        <div class="field"><span class="label">Sesi yang ditinggalkan</span><div id="opsi" class="tumpuk" style="gap:8px">
          <span class="kecil muted">Pilih tanggal dulu.</span></div></div>
        <div class="field"><label for="alasan">Alasan</label>
          <textarea class="input" id="alasan" rows="3" maxlength="300" placeholder="Contoh: ada acara keluarga di luar kota"></textarea></div>
        <button class="btn btn-utama" type="submit" id="kirim">Kirim Pengajuan</button>
      </form>
      <h2 class="judul-seksi">Pengajuan saya</h2>
      <div id="daftar" class="tumpuk" style="gap:10px"></div>
    </div>`;

  const form = el.querySelector('#form');
  const galat = el.querySelector('#galat');
  const opsi = el.querySelector('#opsi');
  pasangPilihan(el.querySelector('#jenis'), (v) => (jenis = v));

  form.tgl.addEventListener('change', async () => {
    opsi.innerHTML = '<span class="kecil muted">Memuat…</span>';
    try {
      const r = await api(`/api/izin/opsi?tanggal=${form.tgl.value}`);
      opsi.innerHTML = r.opsi.length
        ? r.opsi
            .map((o) => {
              const mati = o.ditutup || o.sudah_diajukan;
              const ket = o.ditutup ? 'Sesi sudah selesai' : o.sudah_diajukan ? `Sudah diajukan (${o.sudah_diajukan})` : peranLabel(o.peran);
              return `<label class="cek kotak-cek"><input type="checkbox" name="slot" value="${o.slot_id}" ${mati ? 'disabled' : 'checked'}>
                <span class="tumpuk"><span class="tebal">${esc(o.slot_nama)} ${fmtJam(o.jam_mulai)}–${fmtJam(o.jam_selesai)} · ${esc(o.kelas_nama)}</span>
                <span class="kecil muted">${esc(ket)}</span></span></label>`;
            })
            .join('')
        : '<span class="kecil muted">Anda tidak punya jadwal mengajar di tanggal ini.</span>';
    } catch (e) {
      opsi.innerHTML = `<span class="galat">${esc(e.message)}</span>`;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    galat.textContent = '';
    const slot_ids = [...form.querySelectorAll('input[name=slot]:checked')].map((x) => Number(x.value));
    if (!form.tgl.value) return (galat.textContent = 'Pilih tanggal.');
    if (!slot_ids.length) return (galat.textContent = 'Pilih minimal satu sesi.');
    const tombol = form.querySelector('#kirim');
    tombol.disabled = true;
    try {
      await api('/api/izin', { method: 'POST', body: { tanggal: form.tgl.value, slot_ids, jenis, alasan: form.alasan.value } });
      toast('Pengajuan terkirim. Menunggu persetujuan Kepala SMB.');
      form.reset();
      opsi.innerHTML = '<span class="kecil muted">Pilih tanggal dulu.</span>';
      muatDaftar();
    } catch (err) {
      galat.textContent = err.message;
    } finally {
      tombol.disabled = false;
    }
  });

  const daftar = el.querySelector('#daftar');
  async function muatDaftar() {
    const r = await api('/api/izin');
    daftar.innerHTML = r.izin.length
      ? r.izin
          .map(
            (i) => `
        <div class="kartu rapat">
          <div class="baris-antara">
            <div class="tumpuk"><span class="tebal">${JENIS_IZIN[i.jenis]} · ${esc(fmtTanggal(i.tanggal, 'pendek'))}</span>
              <span class="kecil muted">${esc(i.slot_nama)}${i.alasan ? ' · ' + esc(i.alasan) : ''}</span></div>
            ${chip(i.status)}
          </div>
          ${i.status === 'menunggu' && i.tanggal >= r.hari_ini ? `<button class="btn btn-netral btn-kecil" data-batal="${i.id}">Batalkan pengajuan</button>` : ''}
        </div>`,
          )
          .join('')
      : '<div class="kosong">Belum ada pengajuan izin.</div>';
  }
  daftar.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-batal]');
    if (!b || !confirm('Batalkan pengajuan izin ini?')) return;
    try {
      await api(`/api/izin/${b.dataset.batal}`, { method: 'DELETE' });
      toast('Pengajuan dibatalkan.');
      muatDaftar();
    } catch (err) {
      toast(err.message, 'galat');
    }
  });
  muatDaftar();
}

export async function akun(el, { ctx }) {
  const m = ctx.me;
  const peran = [
    m.is_pengajar ? `${peranLabel(m.level)}${m.tipe === 'cadangan' ? ' (cadangan)' : ''}` : null,
    m.is_petugas ? 'Petugas QR' : null,
    m.is_admin ? 'Admin' : null,
  ].filter(Boolean);
  const bisaInstall = !!ctx.installPrompt;
  const sudahInstall = window.matchMedia('(display-mode: standalone)').matches;

  el.innerHTML = `
    <div class="hdr-putih"><div class="baris"><h1>Akun Saya</h1></div></div>
    <div class="isi">
      <div class="kartu" style="flex-direction:row;align-items:center;gap:14px">
        <div class="avatar kecil" style="width:52px;height:52px;font-size:18px">${esc(inisial(m.nama))}</div>
        <div class="tumpuk"><span class="tebal" style="font-size:17px">${esc(m.nama)}</span>
          <span class="sedang muted">${esc(m.hp)}</span>
          <span class="kecil muted">${esc(peran.join(' · '))}</span></div>
      </div>
      ${sudahInstall ? '' : `
      <div class="kartu">
        <span class="tebal">Pasang aplikasi di HP</span>
        <span class="sedang muted">${bisaInstall
          ? 'Tambahkan SMB Dharmakirti ke layar utama agar bisa dibuka seperti aplikasi biasa.'
          : 'Di Chrome: menu ⋮ › "Tambahkan ke layar utama". Di iPhone (Safari): tombol Bagikan › "Tambah ke Layar Utama".'}</span>
        ${bisaInstall ? '<button class="btn btn-garis" id="pasang">Pasang SMB Dharmakirti</button>' : ''}
      </div>`}
      <div class="info info-abu">${ikon.info()}<span>Lupa PIN atau ingin mengganti PIN? Minta admin mengirim link undangan baru.</span></div>
      <button class="btn btn-bahaya" id="keluar">${ikon.keluar(20)} Keluar</button>
    </div>`;

  el.querySelector('#pasang')?.addEventListener('click', async () => {
    ctx.installPrompt.prompt();
    await ctx.installPrompt.userChoice;
    ctx.installPrompt = null;
    ctx.muatUlang();
  });
  el.querySelector('#keluar').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    ctx.me = null;
    location.hash = '/login';
  });
}
