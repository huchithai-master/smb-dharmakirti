import { api } from '../api.js';
import { esc, ikon, fmtJam, peranLabel, inisial, toast, NAMA_HARI, fmtTanggal } from '../ui.js';
import { subNav } from './admin.js';
import { waktuServer } from '../app.js';

const hdrKembali = (judul, ke) =>
  `<div class="hdr-putih"><div class="baris"><a class="btn-kembali" href="${ke}" aria-label="Kembali">${ikon.kembali()}</a><h1>${esc(judul)}</h1></div></div>`;

export async function lainnya(el, { ctx }) {
  const bulanIni = ctx.waktu.tanggal.slice(0, 7);
  const item = (href, ik, judul, sub) => `
    <a href="${href}"><span class="ikon-kotak">${ik}</span>
      <span class="tumpuk"><span class="tebal" style="font-size:15px">${judul}</span><span class="kecil muted">${sub}</span></span>
      <span class="muted">${ikon.kanan()}</span></a>`;
  el.innerHTML = `
    <div class="hdr-putih"><div class="baris"><h1>Admin</h1></div></div>
    <div class="isi">
      ${subNav('lainnya')}
      <span class="label-kecil">Data master</span>
      <div class="menu-grup">
        ${item('#/admin/pengguna', ikon.orang2(), 'Data Pembina &amp; Asisten', 'Pembina, asisten, cadangan, petugas & admin')}
        ${item('#/admin/murid', ikon.orang(), 'Data Murid', 'NIK, kelas, orang tua, dan asal sekolah')}
        ${item('#/admin/libur', ikon.kalender(), 'Hari Libur', 'Libur harian dengan alasan dan libur semester')}
        ${item('#/admin/kelas', ikon.buku(), 'Kelas', 'Daftar kelas Sekolah Minggu')}
        ${item('#/admin/slot', ikon.jam(), 'Slot &amp; Mode Absen', 'Jam sesi, jendela scan, konfirmasi atau absen masuk')}
      </div>
      <span class="label-kecil">Honor</span>
      <div class="menu-grup">
        ${item('#/admin/honor', ikon.dokumen(), 'Honor &amp; Pengajuan', 'Rekap honor dari absensi dan surat permohonan pencairan ke Vihara')}
      </div>
      <span class="label-kecil">Laporan</span>
      <div class="kartu">
        <span class="tebal">Rekap absensi bulanan</span>
        <div class="field"><label for="bulan">Bulan</label><input class="input" type="month" id="bulan" value="${bulanIni}"></div>
        <a class="btn btn-utama" id="rekap-pdf" href="#/admin/rekap/cetak?bulan=${bulanIni}">${ikon.dokumen(20)} Rekap PDF (dengan jam absen)</a>
        <a class="btn btn-garis btn-kecil" id="unduh" href="/api/admin/laporan.csv?bulan=${bulanIni}" download>${ikon.unduh(18)} Unduh ringkasan Excel (CSV)</a>
        <span class="kecil muted">PDF siap dicetak/dibagikan; CSV bisa dibuka di Excel atau Google Sheets.</span>
      </div>
      <div class="kartu">
        <span class="tebal">Rekap absensi murid &amp; materi</span>
        <div class="field"><label for="bulan-murid">Bulan</label><input class="input" type="month" id="bulan-murid" value="${bulanIni}"></div>
        <a class="btn btn-utama" id="rekap-murid" href="#/admin/rekap-murid/cetak?bulan=${bulanIni}">${ikon.dokumen(20)} Rekap Murid PDF (dengan materi)</a>
        <span class="kecil muted">Absensi tiap siswa per kelas, plus materi yang diajarkan pada setiap pertemuan.</span>
      </div>
      <span class="label-kecil">Pengaturan</span>
      <form class="kartu" id="form-vihara">
        <div class="field"><label for="vihara">Nama vihara</label><input class="input" id="vihara" maxlength="80" value="${esc(ctx.vihara)}"></div>
        <button class="btn btn-netral btn-kecil" type="submit">Simpan nama</button>
      </form>
    </div>`;

  el.querySelector('#bulan').addEventListener('change', (e) => {
    el.querySelector('#unduh').href = `/api/admin/laporan.csv?bulan=${e.target.value}`;
    el.querySelector('#rekap-pdf').href = `#/admin/rekap/cetak?bulan=${e.target.value}`;
  });
  el.querySelector('#bulan-murid').addEventListener('change', (e) => {
    el.querySelector('#rekap-murid').href = `#/admin/rekap-murid/cetak?bulan=${e.target.value}`;
  });
  el.querySelector('#form-vihara').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/vihara', { method: 'PUT', body: { nama: el.querySelector('#vihara').value } });
      await ctx.segarkanMe();
      toast('Nama vihara disimpan.');
    } catch (err) {
      toast(err.message, 'galat');
    }
  });
}

export async function daftarPengguna(el) {
  const { pengguna } = await api('/api/admin/pengguna');
  const kategori = {
    semua: () => true,
    guru: (u) => u.is_pengajar && u.level === 'guru' && u.tipe === 'tetap',
    asisten: (u) => u.is_pengajar && u.level === 'asisten' && u.tipe === 'tetap',
    cadangan: (u) => u.is_pengajar && u.tipe === 'cadangan',
    lain: (u) => !u.is_pengajar,
  };
  const label = { semua: 'Semua', guru: 'Pembina', asisten: 'Asisten', cadangan: 'Cadangan', lain: 'Petugas/Admin' };
  let filter = 'semua';
  let cari = '';

  el.innerHTML = `
    <div class="hdr-putih">
      <div class="baris"><a class="btn-kembali" href="#/admin/lainnya" aria-label="Kembali">${ikon.kembali()}</a><h1>Data Pembina &amp; Asisten</h1></div>
      <div style="padding:0 4px"><label class="sr-only" for="cari">Cari</label>
        <input class="input" id="cari" type="search" placeholder="Cari nama, NIPSMB, atau no. HP" style="background:#f7f8f9"></div>
      <div class="chips" id="filter" style="padding:0 4px">
        ${Object.keys(kategori).map((k) => `<button data-f="${k}" aria-pressed="${k === filter}">${label[k]} (${pengguna.filter(kategori[k]).length})</button>`).join('')}
      </div>
    </div>
    <div class="isi" id="daftar" style="padding-bottom:96px"></div>
    <a class="fab" href="#/admin/pengguna/baru">${ikon.tambah()} Tambah</a>`;

  const daftar = el.querySelector('#daftar');
  const lencana = (u) => {
    if (!u.aktif) return '<span class="chip chip-abu">Nonaktif</span>';
    if (!u.sudah_aktivasi) return '<span class="chip chip-kuning">Belum aktivasi</span>';
    if (u.jabatan) return `<span class="chip chip-izin">${{ kepala: 'Kepala SMB', wakil: 'Wakil Kepala', bendahara: 'Bendahara', sekretaris: 'Sekretaris' }[u.jabatan]}</span>`;
    if (!u.is_pengajar) return `<span class="chip chip-abu">${u.is_admin ? 'Admin' : 'Petugas'}</span>`;
    if (u.tipe === 'cadangan') return '<span class="chip chip-abu">Cadangan</span>';
    return `<span class="chip ${u.level === 'guru' ? 'chip-hadir' : 'chip-izin'}">${peranLabel(u.level)}</span>`;
  };
  const tampil = () => {
    const q = cari.toLowerCase();
    const rows = pengguna.filter(kategori[filter]).filter((u) => !q || u.nama.toLowerCase().includes(q) || (u.nip ?? '').includes(q) || u.hp.includes(q.replace(/\D/g, '') || '~'));
    daftar.innerHTML = rows.length
      ? rows.map((u) => `
        <a class="item-link" href="#/admin/pengguna/${u.id}" style="${u.aktif ? '' : 'opacity:.6'}">
          <span class="avatar kecil">${esc(inisial(u.nama))}</span>
          <span class="tumpuk"><span class="tebal">${esc(u.nama)}</span>
            <span class="kecil muted">${esc(u.jadwal.join(' · ') || (u.is_pengajar ? (u.tipe === 'cadangan' ? `Cadangan level ${peranLabel(u.level)}` : 'Belum ada jadwal') : [u.is_admin && 'Admin', u.is_petugas && 'Petugas QR'].filter(Boolean).join(' · ')))}</span></span>
          ${lencana(u)}
        </a>`).join('')
      : '<div class="kosong">Tidak ada data.</div>';
  };
  tampil();
  el.querySelector('#cari').addEventListener('input', (e) => {
    cari = e.target.value.trim();
    tampil();
  });
  el.querySelector('#filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    for (const x of el.querySelectorAll('#filter button')) x.setAttribute('aria-pressed', String(x === b));
    tampil();
  });
}

function panelUndangan(nama, hp, undangan) {
  const link = `${location.origin}/#/aktivasi?kode=${encodeURIComponent(undangan.kode)}`;
  const pesan = `Namo Buddhaya ${nama}, silakan buat PIN untuk aplikasi absensi Sekolah Minggu lewat link berikut (berlaku 7 hari): ${link}`;
  const wa = `https://wa.me/62${hp.replace(/^0/, '')}?text=${encodeURIComponent(pesan)}`;
  return `
    <div class="kartu" style="border-color:var(--utama)">
      <span class="tebal">Link undangan untuk ${esc(nama)}</span>
      <span class="sedang muted">Kirim link ini ke yang bersangkutan. Ia akan membuat PIN sendiri. Berlaku sampai ${esc(fmtTanggal(undangan.kedaluwarsa.slice(0, 10), 'tanpa-hari'))}.</span>
      <div class="tautan-undangan" id="link">${esc(link)}</div>
      <div class="dua-tombol">
        <button class="btn btn-netral btn-kecil" type="button" data-salin="${esc(link)}">Salin link</button>
        <a class="btn btn-utama btn-kecil" href="${esc(wa)}" target="_blank" rel="noopener">Kirim via WhatsApp</a>
      </div>
    </div>`;
}

export async function formPengguna(el, { params, ctx }) {
  const baru = params.id === 'baru';
  const [{ kelas, slot }, { pembina }, data] = await Promise.all([
    api('/api/admin/kelas'),
    api('/api/admin/pembina-kelas'),
    baru ? Promise.resolve(null) : api(`/api/admin/pengguna/${encodeURIComponent(params.id)}`),
  ]);
  const u = data?.pengguna ?? { nip: '', nama: '', hp: '', is_pengajar: true, level: 'guru', tipe: 'tetap', is_admin: false, is_petugas: false, aktif: true };
  const tugasAwal = new Map((data?.penugasan ?? []).map((p) => [p.slot_id, p]));
  const st = { level: u.level ?? 'guru', tipe: u.tipe ?? 'tetap' };

  el.innerHTML = `
    ${hdrKembali(baru ? 'Tambah Pembina / Asisten' : 'Edit Data', '#/admin/pengguna')}
    <form class="isi" id="form" novalidate style="padding-bottom:0">
      <div class="galat" id="galat" role="alert"></div>
      <div id="undangan">${u.undangan ? panelUndangan(u.nama, u.hp, u.undangan) : ''}</div>
      <section class="kartu">
        <span class="label-kecil">Data diri</span>
        <div class="field"><label for="nip">NIPSMB</label>
          <input class="input" id="nip" inputmode="numeric" maxlength="20" pattern="[0-9]*" value="${esc(u.nip ?? '')}" placeholder="Hanya angka">
          <span class="kecil muted" id="nip-info"></span></div>
        <div class="field"><label for="nama">Nama lengkap</label><input class="input" id="nama" maxlength="80" value="${esc(u.nama)}" required></div>
        <div class="field"><label for="hp">No. HP / WhatsApp</label><input class="input" id="hp" type="tel" inputmode="tel" value="${esc(u.hp)}" placeholder="08xxxxxxxxxx" required>
          <span class="kecil muted">Dipakai untuk login dan menerima link undangan.</span></div>
      </section>
      <section class="kartu">
        <span class="label-kecil">Akses</span>
        <label class="cek"><input type="checkbox" id="is_pengajar" ${u.is_pengajar ? 'checked' : ''}><span class="tumpuk"><span class="tebal">Pembina / Asisten</span><span class="kecil muted">Mengajar dan absen lewat scan QR</span></span></label>
        <label class="cek"><input type="checkbox" id="is_petugas" ${u.is_petugas ? 'checked' : ''}><span class="tumpuk"><span class="tebal">Petugas QR</span><span class="kecil muted">Boleh menampilkan QR absensi dari HP-nya</span></span></label>
        <label class="cek"><input type="checkbox" id="is_admin" ${u.is_admin ? 'checked' : ''}><span class="tumpuk"><span class="tebal">Admin</span><span class="kecil muted">Kelola data, izin, pengganti & laporan</span></span></label>
        <div class="field"><label for="jabatan">Jabatan pengurus</label>
          <select class="input" id="jabatan">
            ${[['', 'Tidak ada'], ['kepala', 'Kepala SMB'], ['wakil', 'Wakil Kepala SMB'], ['bendahara', 'Bendahara'], ['sekretaris', 'Sekretaris']]
              .map(([v, l]) => `<option value="${v}" ${(u.jabatan ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <span class="kecil muted">Jabatan mendapat operasional tetap bulanan; bila mengajar hanya mendapat transport per hari.</span></div>
      </section>
      <section class="kartu" id="bagian-pengajar">
        <span class="label-kecil">Peran mengajar</span>
        <div class="field"><span class="label">Level</span><div class="seg" id="level">
          <button type="button" data-nilai="guru">Pembina</button><button type="button" data-nilai="asisten">Asisten</button></div></div>
        <div class="field"><span class="label">Tipe</span><div class="seg" id="tipe">
          <button type="button" data-nilai="tetap">Tetap</button><button type="button" data-nilai="cadangan">Cadangan</button></div></div>
        <div id="jadwal"></div>
      </section>
      ${baru ? '' : `
      <section class="kartu">
        <span class="label-kecil">Akun</span>
        <label class="cek"><input type="checkbox" id="aktif" ${u.aktif ? 'checked' : ''}><span class="tumpuk"><span class="tebal">Status aktif</span><span class="kecil muted">Nonaktifkan jika sudah tidak bertugas</span></span></label>
        <span class="sedang muted">${u.sudah_aktivasi ? 'Sudah membuat PIN.' : 'Belum membuat PIN.'} PIN dibuat sendiri oleh pemilik akun, admin tidak bisa melihatnya.</span>
        <button class="btn btn-garis btn-kecil" type="button" id="btn-undangan">${u.sudah_aktivasi ? 'Reset PIN & buat link undangan baru' : 'Buat link undangan baru'}</button>
      </section>`}
      <div class="bar-bawah" style="margin:0 -16px"><button class="btn btn-utama" type="submit" id="simpan">Simpan</button></div>
    </form>`;

  const form = el.querySelector('#form');
  const galat = el.querySelector('#galat');
  const $ = (id) => el.querySelector('#' + id);

  function gambarJadwal() {
    const wadah = $('jadwal');
    if (st.tipe === 'cadangan') {
      wadah.innerHTML = `<div class="info info-abu">${ikon.info()}<span>Cadangan tidak punya kelas tetap. Ia muncul sebagai calon saat admin menunjuk pengganti.</span></div>`;
      return;
    }
    wadah.innerHTML = `
      <div class="field"><span class="label">Jadwal tetap</span>
        <span class="kecil muted">Satu slot hanya bisa satu kelas. Satu kelas boleh punya 2 pembina, pembina kedua perlu persetujuan admin.</span></div>
      <div class="tumpuk" style="gap:10px;margin-top:8px">
      ${slot.map((s) => {
        const t = tugasAwal.get(s.id);
        return `<div class="kotak-cek tumpuk" style="gap:8px">
          <span class="tebal sedang">Slot ${esc(s.nama)} · ${NAMA_HARI[s.hari]} ${fmtJam(s.jam_mulai)}–${fmtJam(s.jam_selesai)}</span>
          <div class="grid2" style="gap:8px">
            <div class="field"><label class="sr-only" for="k-${s.id}">Kelas slot ${esc(s.nama)}</label>
              <select class="input" id="k-${s.id}" data-slot-kelas="${s.id}"><option value="">Tidak mengajar</option>
              ${kelas.map((k) => `<option value="${k.id}" ${t?.kelas_id === k.id ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select></div>
            <div class="field"><label class="sr-only" for="p-${s.id}">Peran slot ${esc(s.nama)}</label>
              <select class="input" id="p-${s.id}" data-slot-peran="${s.id}">
                <option value="guru" ${(t?.peran ?? st.level) === 'guru' ? 'selected' : ''}>Pembina</option>
                <option value="asisten" ${(t?.peran ?? st.level) === 'asisten' ? 'selected' : ''}>Asisten</option></select></div>
          </div></div>`;
      }).join('')}</div>`;
  }

  function sinkron() {
    $('bagian-pengajar').hidden = !$('is_pengajar').checked;
    $('nip-info').textContent = $('is_pengajar').checked && st.level === 'asisten'
      ? 'Nomor induk SMB, hanya angka. Untuk asisten boleh dikosongkan.'
      : 'Nomor induk pembina SMB, hanya angka. Wajib untuk pembina.';
    for (const [grup, nilai] of [['level', st.level], ['tipe', st.tipe]]) {
      for (const b of el.querySelectorAll(`#${grup} [data-nilai]`)) b.setAttribute('aria-pressed', String(b.dataset.nilai === nilai));
    }
  }

  // Simpan pilihan jadwal yang sedang diisi sebelum menggambar ulang
  function bacaJadwal() {
    for (const s of slot) {
      const k = el.querySelector(`[data-slot-kelas="${s.id}"]`);
      if (!k) continue;
      if (k.value) tugasAwal.set(s.id, { slot_id: s.id, kelas_id: Number(k.value), peran: el.querySelector(`[data-slot-peran="${s.id}"]`).value });
      else tugasAwal.delete(s.id);
    }
  }

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('#level [data-nilai], #tipe [data-nilai]');
    if (b) {
      bacaJadwal();
      const grup = b.parentElement.id;
      st[grup] = b.dataset.nilai;
      if (grup === 'level') for (const [k, v] of tugasAwal) tugasAwal.set(k, { ...v, peran: st.level });
      sinkron();
      gambarJadwal();
      return;
    }
    const salin = e.target.closest('[data-salin]');
    if (salin) {
      try {
        await navigator.clipboard.writeText(salin.dataset.salin);
        toast('Link disalin.');
      } catch {
        toast('Gagal menyalin. Tekan lama pada link untuk menyalin.', 'galat');
      }
      return;
    }
    if (e.target.closest('#btn-undangan')) {
      const reset = u.sudah_aktivasi;
      if (reset && !confirm(`Reset PIN ${u.nama}? Ia akan keluar dari semua perangkat dan harus membuat PIN baru lewat link undangan.`)) return;
      try {
        const r = await api(`/api/admin/pengguna/${u.id}/undangan`, { method: 'POST', body: { reset_pin: reset } });
        $('undangan').innerHTML = panelUndangan(u.nama, u.hp, r.undangan);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        toast(err.message, 'galat');
      }
    }
  });
  $('is_pengajar').addEventListener('change', sinkron);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    galat.textContent = '';
    bacaJadwal();
    const body = {
      nip: $('nip').value, nama: $('nama').value, hp: $('hp').value,
      is_pengajar: $('is_pengajar').checked, is_petugas: $('is_petugas').checked, is_admin: $('is_admin').checked,
      level: st.level, tipe: st.tipe, aktif: baru ? true : $('aktif').checked, jabatan: $('jabatan').value || null,
      penugasan: st.tipe === 'tetap' ? [...tugasAwal.values()] : [],
    };
    const sama = (p, t) => p.kelas_id === t.kelas_id && p.slot_id === t.slot_id;
    const kedua = body.penugasan.filter((t) => t.peran === 'guru' && pembina.some((p) => sama(p, t) && p.pengguna_id !== u.id));
    if (kedua.length) {
      const baruKedua = kedua.filter((t) => !pembina.some((p) => sama(p, t) && p.pengguna_id === u.id));
      if (baruKedua.length) {
        const t = baruKedua[0];
        const lain = pembina.find((p) => sama(p, t));
        const namaKelas = kelas.find((k) => k.id === t.kelas_id)?.nama;
        const namaSlot = slot.find((s) => s.id === t.slot_id)?.nama;
        if (!confirm(`Kelas ${namaKelas} (${namaSlot}) sudah punya pembina: ${lain.nama}.\n\nTambahkan sebagai pembina kedua? Ini perlu persetujuan admin.`)) return;
      }
      body.setuju_pembina_kedua = true;
    }
    const tombol = $('simpan');
    tombol.disabled = true;
    try {
      if (baru) {
        const r = await api('/api/admin/pengguna', { method: 'POST', body });
        toast('Data tersimpan. Kirim link undangan agar ia bisa membuat PIN.');
        location.hash = `/admin/pengguna/${r.id}`;
      } else {
        await api(`/api/admin/pengguna/${u.id}`, { method: 'PUT', body });
        if (u.id === ctx.me.id) await ctx.segarkanMe();
        toast('Perubahan disimpan.');
        location.hash = '/admin/pengguna';
      }
    } catch (err) {
      galat.textContent = err.message;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      tombol.disabled = false;
    }
  });

  sinkron();
  gambarJadwal();
}

export async function kelas(el, { ctx }) {
  const { kelas: daftar } = await api('/api/admin/kelas');
  el.innerHTML = `
    ${hdrKembali('Kelas', '#/admin/lainnya')}
    <div class="isi">
      ${daftar.map((k) => `
        <form class="kartu rapat" data-kelas="${k.id}" style="flex-direction:row;align-items:center">
          <label class="sr-only" for="kelas-${k.id}">Nama kelas</label>
          <input class="input" id="kelas-${k.id}" value="${esc(k.nama)}" maxlength="40" style="flex:1">
          <button class="btn btn-netral btn-kecil" style="width:auto" type="submit">Simpan</button>
        </form>`).join('')}
      <form class="kartu" id="tambah">
        <div class="field"><label for="baru">Tambah kelas baru</label><input class="input" id="baru" maxlength="40" placeholder="Contoh: Pra-Remaja"></div>
        <button class="btn btn-garis btn-kecil" type="submit">${ikon.tambah(18)} Tambah kelas</button>
      </form>
    </div>`;
  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      if (f.id === 'tambah') {
        await api('/api/admin/kelas', { method: 'POST', body: { nama: f.querySelector('#baru').value } });
        toast('Kelas ditambahkan.');
        ctx.muatUlang();
      } else {
        await api(`/api/admin/kelas/${f.dataset.kelas}`, { method: 'PUT', body: { nama: f.querySelector('input').value } });
        toast('Nama kelas disimpan.');
      }
    } catch (err) {
      toast(err.message, 'galat');
    }
  });
}

export async function slot(el, { ctx }) {
  const { slot: daftar } = await api('/api/admin/kelas');
  const hariIni = waktuServer().getDay();
  el.innerHTML = `
    ${hdrKembali('Slot & Mode Absen', '#/admin/lainnya')}
    <div class="isi">
      <div class="info info-abu">${ikon.info()}<span><b>Konfirmasi</b>: petugas keliling ke kelas di jendela scan, tidak ada status terlambat. <b>Absen masuk</b>: petugas di pintu masuk, scan setelah jam mulai + toleransi tercatat terlambat.</span></div>
      ${daftar.length ? '' : `<div class="info info-oranye">${ikon.info()}<span>Belum ada slot. Tambahkan slot pertama di bawah (mis. Pagi dan Siang) supaya jadwal, scan QR, dan absensi bisa berjalan.</span></div>`}
      ${daftar.map((s) => `
        <form class="kartu" data-slot="${s.id}">
          <div class="grid2">
            <div class="field"><label for="n-${s.id}">Nama slot</label><input class="input" id="n-${s.id}" name="nama" value="${esc(s.nama)}" maxlength="30"></div>
            <div class="field"><label for="h-${s.id}">Hari</label><select class="input" id="h-${s.id}" name="hari">
              ${NAMA_HARI.map((h, i) => `<option value="${i}" ${i === s.hari ? 'selected' : ''}>${h}</option>`).join('')}</select></div>
            <div class="field"><label for="jm-${s.id}">Jam mulai</label><input class="input" type="time" id="jm-${s.id}" name="jam_mulai" value="${s.jam_mulai}"></div>
            <div class="field"><label for="js-${s.id}">Jam selesai</label><input class="input" type="time" id="js-${s.id}" name="jam_selesai" value="${s.jam_selesai}"></div>
          </div>
          <div class="field"><label for="m-${s.id}">Mode absen</label><select class="input" id="m-${s.id}" name="mode">
            <option value="konfirmasi" ${s.mode === 'konfirmasi' ? 'selected' : ''}>Konfirmasi (petugas keliling)</option>
            <option value="masuk" ${s.mode === 'masuk' ? 'selected' : ''}>Absen masuk (di pintu)</option></select></div>
          <div class="grid2">
            <div class="field"><label for="sm-${s.id}">Scan dibuka</label><input class="input" type="time" id="sm-${s.id}" name="scan_mulai" value="${s.scan_mulai}"></div>
            <div class="field"><label for="ss-${s.id}">Scan ditutup</label><input class="input" type="time" id="ss-${s.id}" name="scan_selesai" value="${s.scan_selesai}"></div>
          </div>
          <div class="field"><label for="t-${s.id}">Toleransi terlambat (menit, untuk absen masuk)</label>
            <input class="input" type="number" min="0" max="120" id="t-${s.id}" name="toleransi_menit" value="${s.toleransi_menit}"></div>
          <button class="btn btn-utama btn-kecil" type="submit">Simpan Slot ${esc(s.nama)}</button>
        </form>`).join('')}
      <form class="kartu" data-slot="baru" style="border-style:dashed">
        <span class="label-kecil">Tambah slot baru</span>
        <div class="grid2">
          <div class="field"><label for="n-baru">Nama slot</label><input class="input" id="n-baru" name="nama" value="" maxlength="30" placeholder="Pagi"></div>
          <div class="field"><label for="h-baru">Hari</label><select class="input" id="h-baru" name="hari">
            ${NAMA_HARI.map((h, i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${h}</option>`).join('')}</select></div>
          <div class="field"><label for="jm-baru">Jam mulai</label><input class="input" type="time" id="jm-baru" name="jam_mulai" value="08:00"></div>
          <div class="field"><label for="js-baru">Jam selesai</label><input class="input" type="time" id="js-baru" name="jam_selesai" value="10:00"></div>
        </div>
        <div class="field"><label for="m-baru">Mode absen</label><select class="input" id="m-baru" name="mode">
          <option value="konfirmasi">Konfirmasi (petugas keliling)</option>
          <option value="masuk">Absen masuk (di pintu)</option></select></div>
        <div class="grid2">
          <div class="field"><label for="sm-baru">Scan dibuka</label><input class="input" type="time" id="sm-baru" name="scan_mulai" value="09:30"></div>
          <div class="field"><label for="ss-baru">Scan ditutup</label><input class="input" type="time" id="ss-baru" name="scan_selesai" value="10:00"></div>
        </div>
        <div class="field"><label for="t-baru">Toleransi terlambat (menit, untuk absen masuk)</label>
          <input class="input" type="number" min="0" max="120" id="t-baru" name="toleransi_menit" value="10"></div>
        <button class="btn btn-garis btn-kecil" type="submit">${ikon.tambah(18)} Tambah slot</button>
      </form>
    </div>`;
  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = Object.fromEntries(new FormData(f));
    body.hari = Number(body.hari);
    body.toleransi_menit = Number(body.toleransi_menit);
    try {
      if (f.dataset.slot === 'baru') await api('/api/admin/slot', { method: 'POST', body });
      else await api(`/api/admin/slot/${f.dataset.slot}`, { method: 'PUT', body });
      toast(f.dataset.slot === 'baru' ? 'Slot ditambahkan.' : 'Slot disimpan.');
      ctx.muatUlang();
    } catch (err) {
      toast(err.message, 'galat');
    }
  });
}

export async function waktu(el, { ctx }) {
  const d = waktuServer();
  const p = (n) => String(n).padStart(2, '0');
  const nilai = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  el.innerHTML = `
    ${hdrKembali('Simulasi Waktu', '#/admin/lainnya')}
    <div class="isi">
      <div class="info info-oranye">${ikon.info()}<span>Hanya untuk mencoba prototipe di luar hari Minggu. Mengubah waktu berlaku untuk <b>semua pengguna</b>. Matikan sebelum dipakai sungguhan.</span></div>
      <form class="kartu" id="form">
        <span class="sedang muted">Status: <b>${ctx.waktu.demo ? 'waktu disimulasikan' : 'memakai waktu asli'}</b></span>
        <div class="field"><label for="w">Atur waktu server menjadi</label><input class="input" type="datetime-local" id="w" value="${nilai}"></div>
        <button class="btn btn-utama" type="submit">Terapkan</button>
        <div class="dua-tombol">
          <button class="btn btn-netral btn-kecil" type="button" data-cepat="09:35">Minggu 09.35 (pagi)</button>
          <button class="btn btn-netral btn-kecil" type="button" data-cepat="13:05">Minggu 13.05 (siang)</button>
        </div>
        ${ctx.waktu.demo ? '<button class="btn btn-bahaya" type="button" id="asli">Kembali ke waktu asli</button>' : ''}
      </form>
    </div>`;

  async function terapkan(w) {
    try {
      await api('/api/admin/waktu', { method: 'PUT', body: { waktu: w } });
      await ctx.segarkanMe();
      toast(w ? 'Waktu simulasi diterapkan.' : 'Kembali ke waktu asli.');
      ctx.muatUlang();
    } catch (err) {
      toast(err.message, 'galat');
    }
  }
  el.querySelector('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    terapkan(el.querySelector('#w').value);
  });
  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cepat]');
    if (c) {
      const t = new Date(d);
      t.setDate(t.getDate() + ((7 - t.getDay()) % 7));
      terapkan(`${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${c.dataset.cepat}`);
    }
    if (e.target.closest('#asli')) terapkan(null);
  });
}
