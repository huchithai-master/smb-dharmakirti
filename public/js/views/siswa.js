import { api } from '../api.js';
import { esc, ikon, toast, fmtTanggal, fmtJam, inisial } from '../ui.js';

const hdrKembali = (judul, ke, sub = '') =>
  `<div class="hdr-putih"><div class="baris"><a class="btn-kembali" href="${ke}" aria-label="Kembali">${ikon.kembali()}</a>
    <div class="tumpuk"><h1>${esc(judul)}</h1>${sub ? `<span class="kecil muted">${esc(sub)}</span>` : ''}</div></div></div>`;

const STATUS = [['hadir', 'Hadir'], ['izin', 'Izin'], ['sakit', 'Sakit'], ['alpa', 'Alpa']];

// ---- Pembina: absensi siswa kelasnya, lalu materi yang diajarkan ----
export async function absenSiswa(el, { query, ctx }) {
  const d = await api(`/api/siswa?slot_id=${encodeURIComponent(query.slot ?? '')}`);
  const status = new Map(d.murid.map((m) => [m.id, m.status ?? 'hadir']));
  let tersimpan = d.absensi_tersimpan || d.murid.length === 0;

  el.innerHTML = `
    ${hdrKembali('Absensi Siswa', '#/', `Kelas ${d.kelas_nama} · Slot ${d.slot_nama} · ${fmtTanggal(d.tanggal, 'pendek')}`)}
    <div class="isi" style="padding-bottom:24px">
      <div class="galat" id="galat" role="alert"></div>
      ${d.murid.length ? `
      <section class="kartu">
        <div class="baris-antara"><span class="label-kecil">1. Daftar siswa</span><span class="kecil muted" id="ringkas"></span></div>
        <button class="btn btn-netral btn-kecil" type="button" id="semua-hadir">Tandai semua hadir</button>
        <div class="tumpuk" style="gap:12px" id="daftar">
          ${d.murid.map((m) => `
            <div class="tumpuk" style="gap:6px">
              <div style="display:flex;align-items:center;gap:10px"><span class="avatar kecil">${esc(inisial(m.nama))}</span><span class="tebal">${esc(m.nama)}</span></div>
              <div class="seg" data-murid="${m.id}" role="group" aria-label="Status ${esc(m.nama)}">
                ${STATUS.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="false">${l}</button>`).join('')}
              </div>
            </div>`).join('')}
        </div>
        <button class="btn btn-utama" type="button" id="simpan-absen">Simpan absensi</button>
      </section>` : `
      <div class="info info-abu">${ikon.info()}<span>Belum ada siswa terdaftar di kelas ${esc(d.kelas_nama)}. Minta admin menambahkan di Data Murid.</span></div>`}
      <section class="kartu" id="bagian-materi">
        <span class="label-kecil">${d.murid.length ? '2. ' : ''}Materi hari ini</span>
        <div class="info info-abu" id="kunci">${ikon.info()}<span>Simpan absensi siswa dulu, lalu isi materi yang diajarkan.</span></div>
        <div class="field"><label for="materi">Materi yang diajarkan</label>
          <textarea class="input" id="materi" maxlength="1000" placeholder="Contoh: Kisah Buddha dan Angulimala, nilai kasih sayang">${esc(d.materi)}</textarea></div>
        <button class="btn btn-utama" type="button" id="simpan-materi">Simpan materi</button>
      </section>
    </div>`;

  const $ = (id) => el.querySelector('#' + id);
  const galat = $('galat');

  function gambar() {
    for (const grup of el.querySelectorAll('[data-murid]')) {
      const aktif = status.get(Number(grup.dataset.murid));
      for (const b of grup.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === aktif));
    }
    const hitung = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
    for (const s of status.values()) hitung[s]++;
    if ($('ringkas')) $('ringkas').textContent = `${hitung.hadir} hadir · ${hitung.izin} izin · ${hitung.sakit} sakit · ${hitung.alpa} alpa`;
    $('materi').disabled = !tersimpan;
    $('simpan-materi').disabled = !tersimpan;
    $('kunci').hidden = tersimpan;
  }

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-murid] [data-v]');
    if (b) {
      status.set(Number(b.parentElement.dataset.murid), b.dataset.v);
      tersimpan = d.murid.length === 0 ? true : false;
      gambar();
      return;
    }
    if (e.target.closest('#semua-hadir')) {
      for (const k of status.keys()) status.set(k, 'hadir');
      tersimpan = false;
      gambar();
      return;
    }
    if (e.target.closest('#simpan-absen')) {
      galat.textContent = '';
      const tombol = $('simpan-absen');
      tombol.disabled = true;
      try {
        const r = await api('/api/siswa/absensi', {
          method: 'PUT',
          body: { slot_id: d.slot_id, absen: [...status].map(([murid_id, st]) => ({ murid_id, status: st })) },
        });
        tersimpan = true;
        gambar();
        toast(`Absensi tersimpan: ${r.hadir} dari ${r.total} siswa hadir.`);
        $('bagian-materi').scrollIntoView({ behavior: 'smooth' });
        $('materi').focus({ preventScroll: true });
      } catch (err) {
        galat.textContent = err.message;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } finally {
        tombol.disabled = false;
      }
      return;
    }
    if (e.target.closest('#simpan-materi')) {
      galat.textContent = '';
      const tombol = $('simpan-materi');
      tombol.disabled = true;
      try {
        await api('/api/siswa/materi', { method: 'PUT', body: { slot_id: d.slot_id, isi: $('materi').value } });
        toast('Materi tersimpan. Terima kasih!');
        ctx.pergi('/');
      } catch (err) {
        galat.textContent = err.message;
        tombol.disabled = false;
      }
    }
  });
  gambar();
}

// ---- Admin: data murid ----
export async function daftarMurid(el) {
  const { murid, kelas } = await api('/api/admin/murid');
  let cari = '';
  let filter = 0;

  el.innerHTML = `
    <div class="hdr-putih">
      <div class="baris"><a class="btn-kembali" href="#/admin/lainnya" aria-label="Kembali">${ikon.kembali()}</a><h1>Data Murid</h1></div>
      <div style="padding:0 4px"><label class="sr-only" for="cari">Cari</label>
        <input class="input" id="cari" type="search" placeholder="Cari nama atau NIK" style="background:#f7f8f9"></div>
      <div class="chips" id="filter" style="padding:0 4px">
        <button data-k="0" aria-pressed="true">Semua (${murid.length})</button>
        ${kelas.map((k) => `<button data-k="${k.id}" aria-pressed="false">${esc(k.nama)} (${murid.filter((m) => m.kelas_id === k.id).length})</button>`).join('')}
      </div>
    </div>
    <div class="isi" id="daftar" style="padding-bottom:96px"></div>
    <a class="fab" href="#/admin/murid/baru">${ikon.tambah()} Tambah</a>`;

  const daftar = el.querySelector('#daftar');
  const tampil = () => {
    const q = cari.toLowerCase();
    const rows = murid.filter((m) => (!filter || m.kelas_id === filter) && (!q || m.nama.toLowerCase().includes(q) || m.nik.includes(q)));
    daftar.innerHTML = rows.length
      ? rows.map((m) => `
        <a class="item-link" href="#/admin/murid/${m.id}" style="${m.aktif ? '' : 'opacity:.6'}">
          <span class="avatar kecil">${esc(inisial(m.nama))}</span>
          <span class="tumpuk"><span class="tebal">${esc(m.nama)}</span>
            <span class="kecil muted">${esc(m.asal_sekolah)} · Ortu: ${esc(m.nama_ortu)}</span></span>
          <span class="chip ${m.aktif ? 'chip-hadir' : 'chip-abu'}">${m.aktif ? esc(m.kelas_nama) : 'Nonaktif'}</span>
        </a>`).join('')
      : '<div class="kosong">Belum ada data murid.</div>';
  };
  tampil();
  el.querySelector('#cari').addEventListener('input', (e) => {
    cari = e.target.value.trim();
    tampil();
  });
  el.querySelector('#filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    filter = Number(b.dataset.k);
    for (const x of el.querySelectorAll('#filter button')) x.setAttribute('aria-pressed', String(x === b));
    tampil();
  });
}

export async function formMurid(el, { params, ctx }) {
  const baru = params.id === 'baru';
  const r = baru ? { kelas: (await api('/api/admin/murid')).kelas, murid: null } : await api(`/api/admin/murid/${encodeURIComponent(params.id)}`);
  const m = r.murid ?? {
    nik: '', nama: '', kelas_id: r.kelas[0]?.id, tempat_lahir: '', tanggal_lahir: '', hp: '', nama_ortu: '', hp_ortu: '', asal_sekolah: '', aktif: true,
  };

  el.innerHTML = `
    ${hdrKembali(baru ? 'Tambah Murid' : 'Edit Data Murid', '#/admin/murid')}
    <form class="isi" id="form" novalidate style="padding-bottom:0">
      <div class="galat" id="galat" role="alert"></div>
      <section class="kartu">
        <span class="label-kecil">Data siswa</span>
        <div class="field"><label for="nik">NIK</label>
          <input class="input" id="nik" inputmode="numeric" maxlength="16" pattern="[0-9]*" value="${esc(m.nik)}" placeholder="16 digit angka" required>
          <span class="kecil muted">Hanya angka, 16 digit.</span></div>
        <div class="field"><label for="nama">Nama lengkap siswa</label><input class="input" id="nama" maxlength="80" value="${esc(m.nama)}" required></div>
        <div class="field"><label for="kelas">Kelas</label>
          <select class="input" id="kelas">${r.kelas.map((k) => `<option value="${k.id}" ${k.id === m.kelas_id ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select></div>
        <div class="grid2">
          <div class="field"><label for="tempat">Tempat lahir</label><input class="input" id="tempat" maxlength="60" value="${esc(m.tempat_lahir)}" required></div>
          <div class="field"><label for="lahir">Tanggal lahir</label><input class="input" type="date" id="lahir" value="${esc(m.tanggal_lahir)}" required></div>
        </div>
        <div class="field"><label for="hp">No. HP siswa <span class="muted" style="font-weight:500">(opsional)</span></label>
          <input class="input" id="hp" type="tel" inputmode="tel" value="${esc(m.hp ?? '')}" placeholder="08xxxxxxxxxx"></div>
        <div class="field"><label for="asal">Asal sekolah</label><input class="input" id="asal" maxlength="80" value="${esc(m.asal_sekolah)}" placeholder="Belum sekolah bila belum bersekolah" required></div>
      </section>
      <section class="kartu">
        <span class="label-kecil">Orang tua / wali</span>
        <div class="field"><label for="ortu">Nama orang tua</label><input class="input" id="ortu" maxlength="80" value="${esc(m.nama_ortu)}" required></div>
        <div class="field"><label for="hportu">No. HP orang tua</label>
          <input class="input" id="hportu" type="tel" inputmode="tel" value="${esc(m.hp_ortu)}" placeholder="08xxxxxxxxxx" required></div>
      </section>
      ${baru ? '' : `
      <section class="kartu">
        <label class="cek"><input type="checkbox" id="aktif" ${m.aktif ? 'checked' : ''}><span class="tumpuk"><span class="tebal">Siswa aktif</span><span class="kecil muted">Nonaktifkan bila sudah tidak mengikuti Sekolah Minggu. Riwayat absensi tetap tersimpan.</span></span></label>
      </section>`}
      <div class="bar-bawah" style="margin:0 -16px"><button class="btn btn-utama" type="submit" id="simpan">Simpan</button></div>
    </form>`;

  const $ = (id) => el.querySelector('#' + id);
  $('nik').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16);
  });
  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('galat').textContent = '';
    const body = {
      nik: $('nik').value, nama: $('nama').value, kelas_id: Number($('kelas').value), tempat_lahir: $('tempat').value,
      tanggal_lahir: $('lahir').value, hp: $('hp').value, nama_ortu: $('ortu').value, hp_ortu: $('hportu').value,
      asal_sekolah: $('asal').value, aktif: baru ? true : $('aktif').checked,
    };
    const tombol = $('simpan');
    tombol.disabled = true;
    try {
      if (baru) await api('/api/admin/murid', { method: 'POST', body });
      else await api(`/api/admin/murid/${m.id}`, { method: 'PUT', body });
      toast('Data murid tersimpan.');
      ctx.pergi('/admin/murid');
    } catch (err) {
      $('galat').textContent = err.message;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      tombol.disabled = false;
    }
  });
}

// ---- Admin: hari libur ----
export async function libur(el, { ctx }) {
  const d = await api('/api/admin/libur');
  let jenis = 'harian';
  const akan = d.libur.filter((l) => l.selesai >= d.hari_ini).sort((a, b) => a.mulai.localeCompare(b.mulai));
  const lalu = d.libur.filter((l) => l.selesai < d.hari_ini);
  const rentang = (l) => (l.mulai === l.selesai ? fmtTanggal(l.mulai) : `${fmtTanggal(l.mulai, 'tanpa-hari')} – ${fmtTanggal(l.selesai, 'tanpa-hari')}`);
  const baris = (l, bisaHapus) => `
    <div class="kartu rapat"><div class="baris-antara">
      <div class="tumpuk"><span class="tebal">${esc(l.alasan)}</span>
        <span class="kecil muted">${l.jenis === 'semester' ? 'Libur semester' : 'Libur harian'} · ${esc(rentang(l))}</span></div>
      ${bisaHapus ? `<button class="btn btn-bahaya btn-kecil" style="width:auto" data-hapus="${l.id}">Hapus</button>` : ''}
    </div></div>`;

  el.innerHTML = `
    ${hdrKembali('Hari Libur', '#/admin/lainnya')}
    <div class="isi">
      <div class="info info-abu">${ikon.info()}<span>Pada hari libur tidak ada sesi: pengajar tidak perlu scan, tidak dihitung alpa, dan tidak ada honor sesi.</span></div>
      <form class="kartu" id="form" novalidate>
        <span class="label-kecil">Tambah libur</span>
        <div class="galat" id="galat" role="alert"></div>
        <div class="seg" id="jenis">
          <button type="button" data-j="harian" aria-pressed="true">Libur harian</button>
          <button type="button" data-j="semester" aria-pressed="false">Libur semester</button>
        </div>
        <div class="grid2">
          <div class="field"><label for="mulai" id="l-mulai">Tanggal</label><input class="input" type="date" id="mulai" min="${d.hari_ini}" required></div>
          <div class="field" id="bagian-selesai" hidden><label for="selesai">Sampai tanggal</label><input class="input" type="date" id="selesai" min="${d.hari_ini}"></div>
        </div>
        <div class="field"><label for="alasan" id="l-alasan">Alasan libur</label>
          <input class="input" id="alasan" maxlength="120" placeholder="Contoh: Hari Waisak"></div>
        <button class="btn btn-utama" type="submit">Simpan libur</button>
      </form>
      <h2 class="judul-seksi">Akan datang (${akan.length})</h2>
      ${akan.map((l) => baris(l, true)).join('') || '<div class="kosong" style="padding:12px">Belum ada libur terjadwal.</div>'}
      ${lalu.length ? `<h2 class="judul-seksi">Sudah lewat</h2>${lalu.map((l) => baris(l, false)).join('')}` : ''}
    </div>`;

  const $ = (id) => el.querySelector('#' + id);
  function sinkron() {
    for (const b of el.querySelectorAll('#jenis [data-j]')) b.setAttribute('aria-pressed', String(b.dataset.j === jenis));
    $('bagian-selesai').hidden = jenis !== 'semester';
    $('l-mulai').textContent = jenis === 'semester' ? 'Mulai tanggal' : 'Tanggal';
    $('l-alasan').textContent = jenis === 'semester' ? 'Nama libur (opsional)' : 'Alasan libur';
    $('alasan').placeholder = jenis === 'semester' ? 'Libur Semester Ganjil' : 'Contoh: Hari Waisak';
  }
  el.addEventListener('click', async (e) => {
    const j = e.target.closest('#jenis [data-j]');
    if (j) {
      jenis = j.dataset.j;
      sinkron();
      return;
    }
    const h = e.target.closest('[data-hapus]');
    if (h && confirm('Hapus libur ini? Sesi pada tanggal tersebut kembali berjalan normal.')) {
      try {
        await api(`/api/admin/libur/${h.dataset.hapus}`, { method: 'DELETE' });
        toast('Libur dihapus.');
        ctx.muatUlang();
      } catch (err) {
        toast(err.message, 'galat');
      }
    }
  });
  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('galat').textContent = '';
    try {
      await api('/api/admin/libur', {
        method: 'POST',
        body: { jenis, mulai: $('mulai').value, selesai: jenis === 'semester' ? $('selesai').value : null, alasan: $('alasan').value },
      });
      toast('Libur tersimpan.');
      ctx.muatUlang();
    } catch (err) {
      $('galat').textContent = err.message;
    }
  });
  sinkron();
}
