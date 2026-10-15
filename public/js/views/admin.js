import { api } from '../api.js';
import { esc, ikon, chip, fmtTanggal, fmtJam, peranLabel, toast, JENIS_IZIN } from '../ui.js';

export function subNav(aktif) {
  const item = [['dashboard', '#/admin', 'Dashboard'], ['tugas', '#/admin/tugas', 'Atur Tugas'], ['lainnya', '#/admin/lainnya', 'Lainnya']];
  return `<nav class="seg tab-abu" aria-label="Menu admin">${item
    .map(([k, href, label]) => `<a href="${href}" class="btn btn-kecil" style="min-height:40px;${k === aktif ? 'background:#fff;color:var(--utama);box-shadow:0 1px 3px rgba(17,24,39,.12)' : 'background:transparent;color:var(--abu)'}" ${k === aktif ? 'aria-current="page"' : ''}>${label}</a>`)
    .join('')}</nav>`;
}

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '')).toString();

function tabSlot(slots, slotId) {
  return `<div class="seg tab-slot" role="tablist" aria-label="Pilih slot">${slots
    .map((s) => `<button role="tab" data-slot="${s.id}" aria-selected="${s.id === slotId}">
      <span>${esc(s.nama)}</span><small>${s.mode === 'konfirmasi' ? 'Konfirmasi ' + fmtJam(s.scan_mulai) : 'Absen masuk ' + fmtJam(s.jam_mulai)}</small></button>`)
    .join('')}</div>`;
}

export async function dashboard(el, { query, ctx }) {
  const d = await api(`/api/admin/dashboard?${qs({ tanggal: query.tanggal, slot_id: query.slot })}`);
  const slot = d.slots.find((s) => s.id === d.slot_id);
  const r = d.data?.ringkasan;
  const stat = !r ? [] : slot.mode === 'konfirmasi'
    ? [['Hadir', r.hadir, 'var(--hijau-teks)'], ['Izin', r.izin, 'var(--ungu)'], [d.data.status_slot === 'nanti' ? 'Terjadwal' : 'Belum', r.belum + r.nanti, 'var(--abu)'], ['Alpa', r.alpa, 'var(--merah)']]
    : [['Hadir', r.hadir, 'var(--hijau-teks)'], ['Terlambat', r.terlambat, 'var(--oranye)'], ['Izin', r.izin, 'var(--ungu)'], [r.alpa ? 'Alpa' : d.data.status_slot === 'nanti' ? 'Terjadwal' : 'Belum', r.alpa || r.belum + r.nanti, r.alpa ? 'var(--merah)' : 'var(--abu)']];
  const tindakan = d.izin_menunggu.length + d.butuh_pengganti.length;

  el.innerHTML = `
    <div class="hdr" style="padding-bottom:60px">
      <div class="hdr-atas">
        <div class="merek"><img class="merek-logo" src="/icons/logo-smb.png" alt="" width="26" height="31"> SMB Dharmakirti <span class="lencana">Admin</span></div>
        <a class="btn-ikon-terang" href="#/petugas" aria-label="Buka layar Petugas QR">${ikon.qr()}</a>
      </div>
      <div class="baris-antara" style="align-items:flex-end">
        <div class="tumpuk"><span class="sub">${esc(fmtTanggal(d.tanggal))}</span>
          <h1>${d.tanggal === d.hari_ini ? 'Kehadiran Hari Ini' : 'Kehadiran'}</h1></div>
        <label class="sr-only" for="tgl">Pilih tanggal</label>
        <input type="date" id="tgl" value="${d.tanggal}" class="input" style="width:auto;height:40px;font-size:13px;border:none;color:var(--teks);padding:0 10px">
      </div>
    </div>
    <div class="angkat">${d.slots.length ? tabSlot(d.slots, d.slot_id) : (d.libur ? `<div class="kartu bayang" style="border-color:var(--oranye-garis)"><span class="tebal" style="color:var(--oranye)">Libur: ${esc(d.libur.alasan)}</span><span class="kecil muted">${d.libur.jenis === 'semester' ? 'Libur semester' : 'Libur harian'} · tidak ada sesi dan tidak ada alpa.</span></div>` : '<div class="kartu bayang"><span class="muted">Tidak ada sesi di tanggal ini.</span></div>')}</div>
    <div class="isi">
      ${subNav('dashboard')}
      ${r ? `<div class="stat-grid">${stat.map(([l, n, w]) => `<div class="stat"><b>${n}</b><span style="color:${w}">${l}</span></div>`).join('')}</div>` : ''}
      ${tindakan ? `
      <div class="kartu" style="background:var(--oranye-bg);border-color:var(--oranye-garis)">
        <span class="label-kecil" style="color:var(--oranye)">Perlu tindakan</span>
        ${d.butuh_pengganti.map((b) => `
          <div class="baris-antara"><div class="tumpuk"><span class="tebal">Kelas ${esc(b.kelas_nama)} butuh pembina pengganti</span>
            <span class="kecil muted">${esc(fmtTanggal(b.tanggal, 'pendek'))} · Slot ${esc(b.slot_nama)} · ${esc(b.nama)} ${JENIS_IZIN[b.jenis].toLowerCase()}</span></div>
            <a class="btn btn-kecil btn-garis" style="width:auto;color:var(--oranye);border-color:var(--oranye)" href="#/admin/tugas?${qs({ tanggal: b.tanggal, slot: b.slot_id, kelas: b.kelas_id, peran: 'guru', ganti: b.pengguna_id })}">Tunjuk</a></div>`).join('')}
        ${d.izin_menunggu.length ? `<button class="btn-teks sedang" style="color:var(--oranye);text-align:left;padding:0" data-gulir="izin">${d.izin_menunggu.length} izin menunggu persetujuan ↓</button>` : ''}
      </div>` : ''}
      ${d.data ? `<h2 class="judul-seksi">Status per kelas</h2>
        ${d.data.kelas.map((k) => {
          const perlu = k.anggota.filter((a) => a.status !== 'izin');
          const hadir = perlu.filter((a) => a.status === 'hadir' || a.status === 'terlambat').length;
          const lengkap = perlu.length && hadir === perlu.length;
          return `<div class="kartu rapat">
            <div class="baris-antara"><span style="font-size:15px;font-weight:800">${esc(k.nama)}</span>
              <span class="kecil tebal" style="color:${lengkap ? 'var(--hijau-teks)' : 'var(--oranye)'}">${lengkap ? 'Lengkap' : `${hadir}/${perlu.length} hadir`}</span></div>
            ${k.catatan.map((c) => `<span class="info info-ungu" style="padding:5px 10px">${esc(c)}</span>`).join('')}
            ${k.siswa?.total ? `<span class="kecil muted">Siswa: ${k.siswa.tercatat ? `${k.siswa.hadir} dari ${k.siswa.total} hadir` : 'absensi belum diisi'}${k.materi ? ' · Materi: ' + esc(k.materi) : ''}</span>` : ''}
            ${k.anggota.map((a) => `<div class="baris-orang"><div class="tumpuk"><span class="nama">${esc(a.nama)}</span>
              <span class="kecil muted">${peranLabel(a.peran)}${a.keterangan ? ' · ' + esc(a.keterangan) : ''} · ${a.jam ? 'scan ' + fmtJam(a.jam) : a.izin_menunggu ? 'izin menunggu' : 'belum ada scan'}</span></div>
              ${chip(a.status)}</div>`).join('')}
          </div>`;
        }).join('') || '<div class="kosong">Belum ada pengajar terjadwal di slot ini.</div>'}` : ''}
      <h2 class="judul-seksi" id="izin">Izin menunggu persetujuan</h2>
      ${d.izin_menunggu.map((i) => `
        <div class="kartu rapat">
          <div class="tumpuk"><span class="tebal">${esc(i.nama)} · ${JENIS_IZIN[i.jenis]}</span>
            <span class="kecil muted">${esc(fmtTanggal(i.tanggal, 'pendek'))} · Slot ${esc(i.slot_nama)} · ${i.peran ? peranLabel(i.peran) + ' ' : ''}${esc(i.kelas_nama)}</span>
            ${i.alasan ? `<span class="kecil">"${esc(i.alasan)}"</span>` : ''}</div>
          <div class="dua-tombol">
            <button class="btn btn-netral btn-kecil" data-izin="${i.id}" data-putus="ditolak">Tolak</button>
            <button class="btn btn-utama btn-kecil" data-izin="${i.id}" data-putus="disetujui">Setujui</button>
          </div>
        </div>`).join('') || '<div class="kosong" style="padding:12px">Tidak ada izin yang menunggu.</div>'}
    </div>`;

  const ke = (o) => ctx.pergi(`/admin?${qs({ tanggal: d.tanggal, slot: d.slot_id, ...o })}`);
  el.querySelector('#tgl').addEventListener('change', (e) => e.target.value && ke({ tanggal: e.target.value, slot: null }));
  el.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-slot]');
    if (s) return ke({ slot: s.dataset.slot });
    const g = e.target.closest('[data-gulir]');
    if (g) return document.getElementById(g.dataset.gulir)?.scrollIntoView({ behavior: 'smooth' });
    const b = e.target.closest('[data-izin]');
    if (!b) return;
    b.disabled = true;
    try {
      await api(`/api/admin/izin/${b.dataset.izin}`, { method: 'POST', body: { keputusan: b.dataset.putus } });
      toast(b.dataset.putus === 'disetujui' ? 'Izin disetujui.' : 'Izin ditolak.');
      ctx.muatUlang();
    } catch (err) {
      toast(err.message, 'galat');
      b.disabled = false;
    }
  });

  const segar = setInterval(() => document.visibilityState === 'visible' && !el.querySelector(':focus') && ctx.muatUlang(), 30000);
  return () => clearInterval(segar);
}

export async function tugas(el, { query, ctx }) {
  const mode = ['pindah', 'kedua'].includes(query.mode) ? query.mode : 'pengganti';
  const d = await api(`/api/admin/tugas?${qs({ tanggal: query.tanggal, slot_id: query.slot })}`);
  const slot = d.slots.find((s) => s.id === d.slot_id);
  const ke = (o) => ctx.pergi(`/admin/tugas?${qs({ mode, tanggal: d.tanggal, slot: d.slot_id, ...o })}`);
  const tertutup = d.status_slot === 'selesai';

  const daftarTugas = d.tugas.filter((t) => t.jenis === (mode === 'kedua' ? 'tambahan' : mode));
  const htmlTugas = daftarTugas.length
    ? daftarTugas.map((t) => `
      <div class="kartu rapat"><div class="baris-antara">
        <div class="tumpuk"><span class="tebal">${esc(t.nama)} → ${esc(t.kelas_nama)}</span>
          <span class="kecil muted">${t.jenis === 'pengganti' ? `${peranLabel(t.peran)} pengganti${t.diganti_nama ? ' untuk ' + esc(t.diganti_nama) : ''}` : t.jenis === 'tambahan' ? 'Pembina kedua, hanya pada tanggal ini' : `Asisten dari ${esc(t.dari_kelas_nama ?? '-')}`}${t.sudah_scan ? ' · sudah scan' : ''}</span></div>
        ${t.sudah_scan || tertutup ? '' : `<button class="btn btn-bahaya btn-kecil" style="width:auto" data-hapus="${t.id}">Batalkan</button>`}
      </div></div>`).join('')
    : `<div class="kosong" style="padding:12px">Belum ada ${mode === 'pengganti' ? 'pengganti' : mode === 'kedua' ? 'pembina kedua harian' : 'asisten yang dipindah'} untuk sesi ini.</div>`;

  el.innerHTML = `
    <div class="hdr-putih">
      <div class="baris"><a class="btn-kembali" href="#/admin" aria-label="Kembali ke Dashboard">${ikon.kembali()}</a><h1>Atur Tugas</h1></div>
      <div class="seg tab-abu" role="tablist" style="margin:0 4px">
        <button role="tab" data-mode="pengganti" aria-selected="${mode === 'pengganti'}">Pengganti</button>
        <button role="tab" data-mode="kedua" aria-selected="${mode === 'kedua'}">Pembina 2</button>
        <button role="tab" data-mode="pindah" aria-selected="${mode === 'pindah'}">Pindah Asisten</button>
      </div>
    </div>
    <div class="isi">
      <div class="grid2 kolom-hp">
        <div class="field"><label for="tgl">Tanggal</label><input class="input" type="date" id="tgl" value="${d.tanggal}"></div>
        <div class="field"><label for="slot">Slot</label><select class="input" id="slot">
          ${d.slots.map((s) => `<option value="${s.id}" ${s.id === d.slot_id ? 'selected' : ''}>${esc(s.nama)} ${fmtJam(s.jam_mulai)}</option>`).join('') || '<option>Tidak ada sesi</option>'}
        </select></div>
      </div>
      ${!slot ? '<div class="kosong">Tidak ada sesi Sekolah Minggu di tanggal ini.</div>'
        : tertutup ? `<div class="info info-abu">${ikon.info()}<span>Sesi ini sudah selesai, penugasan tidak bisa diubah lagi.</span></div>`
        : '<div id="form-tugas" class="tumpuk" style="gap:12px"></div>'}
      ${slot && mode === 'kedua' ? ringkasPembina(d) : ''}
      ${slot ? `<h2 class="judul-seksi">${mode === 'pengganti' ? 'Pengganti' : mode === 'kedua' ? 'Pembina kedua (harian)' : 'Pindahan'} di sesi ini</h2><div class="tumpuk" style="gap:10px" id="daftar">${htmlTugas}</div>` : ''}
      <div class="info info-abu">${ikon.info()}<span>${mode === 'pengganti'
        ? 'Penugasan bukan input kehadiran. Pengganti tetap harus scan QR pada hari H.'
        : mode === 'kedua'
        ? 'Satu kelas boleh punya sampai 2 pembina, dan hanya admin yang bisa menetapkan pembina kedua. Pembina kedua tetap harus scan QR dan ikut mendapat honor pembina.'
        : 'Hanya admin yang bisa memindahkan asisten. Hari itu asisten hanya bisa scan di kelas tujuan.'}</span></div>
    </div>`;

  el.querySelector('#tgl').addEventListener('change', (e) => e.target.value && ke({ tanggal: e.target.value, slot: null, kelas: null, ganti: null }));
  el.querySelector('#slot').addEventListener('change', (e) => ke({ slot: e.target.value, kelas: null, ganti: null }));
  el.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) return ctx.pergi(`/admin/tugas?${qs({ mode: m.dataset.mode, tanggal: d.tanggal, slot: d.slot_id })}`);
    const h = e.target.closest('[data-hapus]');
    if (h && confirm('Batalkan penugasan ini?')) {
      try {
        await api(`/api/admin/tugas/${h.dataset.hapus}`, { method: 'DELETE' });
        toast('Penugasan dibatalkan.');
        ctx.muatUlang();
      } catch (err) {
        toast(err.message, 'galat');
      }
    }
  });

  const wadah = el.querySelector('#form-tugas');
  if (!wadah) return;
  if (mode === 'pengganti') await formPengganti(wadah, d, query, ctx);
  else if (mode === 'kedua') await formKedua(wadah, d, query, ctx);
  else formPindah(wadah, d, query, ctx);
}

// Ringkasan pembina per kelas pada tanggal + sesi yang dipilih.
function ringkasPembina(d) {
  const label = { tetap: 'Tetap', pengganti: 'Pengganti', tambahan: 'Tambahan', pindah: 'Pindahan' };
  return `
    <div class="kartu rapat">
      <span class="label-kecil">Pembina per kelas di sesi ini</span>
      ${d.kelas.map((k) => {
        const p = d.kelas_pembina?.[k.id] ?? [];
        const aktif = p.filter((x) => x.status !== 'izin').length;
        return `<div class="baris-antara" style="align-items:flex-start">
          <span class="tebal">${esc(k.nama)}</span>
          <span class="kecil" style="text-align:right">${p.length
            ? p.map((x) => `${esc(x.nama)} <span class="muted">(${label[x.jenis] ?? x.jenis}${x.status === 'izin' ? ', izin' : ''})</span>`).join('<br>')
            : '<span class="muted">Belum ada pembina</span>'}${aktif >= 2 ? '<br><b style="color:var(--hijau-teks)">Lengkap, 2 pembina</b>' : ''}</span>
        </div>`;
      }).join('')}
    </div>`;
}

async function formKedua(wadah, d, query, ctx) {
  const dengan1 = d.kelas.filter((k) => (d.kelas_pembina?.[k.id] ?? []).filter((x) => x.status !== 'izin').length === 1);
  if (!dengan1.length) {
    wadah.innerHTML = '<div class="info info-abu">' + ikon.info() + '<span>Tidak ada kelas yang bisa ditambah pembina kedua di sesi ini: semua kelas belum punya pembina atau sudah punya 2 pembina.</span></div>';
    return;
  }
  let kelasId = dengan1.some((k) => k.id === Number(query.kelas)) ? Number(query.kelas) : dengan1[0].id;
  let tetap = false;
  let pilihan = null;

  wadah.innerHTML = `
    <div class="kartu">
      <div class="field"><label for="kelas">Kelas</label><select class="input" id="kelas">
        ${dengan1.map((k) => `<option value="${k.id}" ${k.id === kelasId ? 'selected' : ''}>${esc(k.nama)} · pembina: ${esc((d.kelas_pembina[k.id] ?? []).filter((x) => x.status !== 'izin').map((x) => x.nama).join(', '))}</option>`).join('')}</select></div>
      <div class="field"><span class="label">Berlaku</span><div class="seg" id="lingkup">
        <button type="button" data-t="0" aria-pressed="true">Tanggal ini saja</button>
        <button type="button" data-t="1" aria-pressed="false">Tetap setiap Minggu</button></div>
        <span class="kecil muted" id="ket-lingkup"></span></div>
    </div>
    <div id="kandidat" class="tumpuk" style="gap:8px"><div class="kosong">Memuat calon…</div></div>
    <button class="btn btn-utama" id="setujui" disabled>Pilih pembina dulu</button>`;

  const kandidatEl = wadah.querySelector('#kandidat');
  const tombol = wadah.querySelector('#setujui');
  const ket = wadah.querySelector('#ket-lingkup');
  const sinkronKet = () => {
    ket.textContent = tetap
      ? 'Menjadi pembina kedua di kelas ini setiap Minggu mulai tanggal tersebut. Hanya untuk pengajar bertipe Tetap.'
      : 'Hanya pada tanggal dan sesi yang dipilih di atas.';
  };

  async function muat() {
    pilihan = null;
    tombol.disabled = true;
    tombol.textContent = 'Pilih pembina dulu';
    kandidatEl.innerHTML = '<div class="kosong">Memuat calon…</div>';
    const k = await api(`/api/admin/kandidat?${qs({ tanggal: d.tanggal, slot_id: d.slot_id, kelas_id: kelasId, peran: 'guru' })}`);
    const sala = (c) => !tetap || c.tipe === 'tetap';
    const grup = (judul, list) => {
      const l = list.filter(sala);
      return l.length ? `<span class="label-kecil" style="margin-top:6px">${judul}</span>${l.map((c) => `
        <button class="opsi" data-calon="${c.pengguna_id}" data-nama="${esc(c.nama)}" aria-pressed="false">
          <span class="radio"></span>
          <span class="tumpuk"><span class="nama">${esc(c.nama)}</span><span class="kecil muted">${esc(c.info)}</span></span>
        </button>`).join('')}` : '';
    };
    const tersedia = grup('Asisten di kelas ini (naik jadi pembina)', k.kelas_ini) + grup('Cadangan', k.cadangan) + grup('Pengajar lain yang tersedia', k.lain);
    kandidatEl.innerHTML = tersedia || '<div class="kosong">Tidak ada pengajar yang tersedia di sesi ini.</div>';
  }

  wadah.querySelector('#kelas').addEventListener('change', (e) => {
    kelasId = Number(e.target.value);
    muat();
  });
  wadah.addEventListener('click', (e) => {
    const l = e.target.closest('[data-t]');
    if (l) {
      tetap = l.dataset.t === '1';
      for (const x of wadah.querySelectorAll('[data-t]')) x.setAttribute('aria-pressed', String(x === l));
      sinkronKet();
      return muat();
    }
    const c = e.target.closest('[data-calon]');
    if (c) {
      pilihan = Number(c.dataset.calon);
      for (const x of wadah.querySelectorAll('[data-calon]')) x.setAttribute('aria-pressed', String(x === c));
      tombol.disabled = false;
      tombol.textContent = `Setujui ${c.dataset.nama} sebagai pembina kedua`;
    }
  });
  tombol.addEventListener('click', async () => {
    const nama = kelasId && d.kelas.find((k) => k.id === kelasId)?.nama;
    if (!confirm(`Setujui pembina kedua untuk kelas ${nama}?\n${tetap ? 'Berlaku tetap setiap Minggu.' : 'Hanya pada tanggal ini.'}`)) return;
    tombol.disabled = true;
    try {
      await api('/api/admin/pembina-kedua', {
        method: 'POST',
        body: { tanggal: d.tanggal, slot_id: d.slot_id, kelas_id: kelasId, pengguna_id: pilihan, tetap },
      });
      toast('Pembina kedua disetujui.');
      ctx.pergi(`/admin/tugas?${qs({ mode: 'kedua', tanggal: d.tanggal, slot: d.slot_id })}`);
    } catch (err) {
      toast(err.message, 'galat');
      tombol.disabled = false;
    }
  });
  sinkronKet();
  await muat();
}

async function formPengganti(wadah, d, query, ctx) {
  let kelasId = Number(query.kelas) || d.kelas[0]?.id;
  let peran = query.peran === 'asisten' ? 'asisten' : 'guru';
  const ganti = query.ganti ? Number(query.ganti) : null;
  let pilihan = null;

  wadah.innerHTML = `
    <div class="kartu">
      <div class="grid2 kolom-hp">
        <div class="field"><label for="kelas">Kelas</label><select class="input" id="kelas">
          ${d.kelas.map((k) => `<option value="${k.id}" ${k.id === kelasId ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select></div>
        <div class="field"><span class="label">Posisi</span><div class="seg" id="peran">
          <button type="button" data-p="guru" aria-pressed="${peran === 'guru'}">Pembina</button>
          <button type="button" data-p="asisten" aria-pressed="${peran === 'asisten'}">Asisten</button></div></div>
      </div>
      ${ganti ? `<div class="info info-ungu">${ikon.info()}<span>Menggantikan pengajar yang izin di kelas ini.</span></div>` : ''}
    </div>
    <div id="kandidat" class="tumpuk" style="gap:8px"><div class="kosong">Memuat calon…</div></div>
    <button class="btn btn-utama" id="tugaskan" disabled>Pilih pengganti dulu</button>`;

  const kandidatEl = wadah.querySelector('#kandidat');
  const tombol = wadah.querySelector('#tugaskan');

  async function muat() {
    pilihan = null;
    tombol.disabled = true;
    tombol.textContent = 'Pilih pengganti dulu';
    kandidatEl.innerHTML = '<div class="kosong">Memuat calon…</div>';
    const k = await api(`/api/admin/kandidat?${qs({ tanggal: d.tanggal, slot_id: d.slot_id, kelas_id: kelasId, peran, menggantikan_id: ganti })}`);
    const grup = (judul, list) => list.length ? `<span class="label-kecil" style="margin-top:6px">${judul}</span>${list.map((c) => `
      <button class="opsi" data-calon="${c.pengguna_id}" data-nama="${esc(c.nama)}" aria-pressed="false">
        <span class="radio"></span>
        <span class="tumpuk"><span class="nama">${esc(c.nama)}</span><span class="kecil muted">${esc(c.info)}${c.kali_pengganti ? ` · ${c.kali_pengganti}x pengganti` : ''}</span></span>
      </button>`).join('')}` : '';
    const tersedia = grup(peran === 'guru' ? 'Asisten di kelas ini' : '', k.kelas_ini) + grup('Cadangan', k.cadangan) + grup('Pengajar lain yang tersedia', k.lain);
    kandidatEl.innerHTML = (tersedia || '<div class="kosong">Tidak ada pengajar yang tersedia di sesi ini.</div>') +
      (k.tidak_tersedia.length ? `<span class="label-kecil" style="margin-top:6px">Tidak tersedia</span>${k.tidak_tersedia.map((c) => `
        <div class="opsi mati"><span class="tumpuk"><span class="nama">${esc(c.nama)}</span><span class="kecil">${esc(c.alasan)}</span></span></div>`).join('')}` : '');
  }

  wadah.querySelector('#kelas').addEventListener('change', (e) => {
    kelasId = Number(e.target.value);
    muat();
  });
  wadah.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-p]');
    if (p) {
      peran = p.dataset.p;
      for (const x of wadah.querySelectorAll('[data-p]')) x.setAttribute('aria-pressed', String(x === p));
      return muat();
    }
    const c = e.target.closest('[data-calon]');
    if (c) {
      pilihan = Number(c.dataset.calon);
      for (const x of wadah.querySelectorAll('[data-calon]')) x.setAttribute('aria-pressed', String(x === c));
      tombol.disabled = false;
      tombol.textContent = `Tugaskan ${c.dataset.nama}`;
    }
  });
  tombol.addEventListener('click', async () => {
    tombol.disabled = true;
    try {
      await api('/api/admin/pengganti', {
        method: 'POST',
        body: { tanggal: d.tanggal, slot_id: d.slot_id, kelas_id: kelasId, peran, pengguna_id: pilihan, menggantikan_id: ganti },
      });
      toast('Pengganti ditugaskan.');
      ctx.pergi(`/admin/tugas?${qs({ mode: 'pengganti', tanggal: d.tanggal, slot: d.slot_id })}`);
    } catch (err) {
      toast(err.message, 'galat');
      tombol.disabled = false;
    }
  });
  await muat();
}

function formPindah(wadah, d, query, ctx) {
  if (!d.asisten.length) {
    wadah.innerHTML = '<div class="kosong">Tidak ada asisten dengan kelas tetap di slot ini.</div>';
    return;
  }
  let asisten = d.asisten[0];
  let ke = null;

  function gambar() {
    const tujuan = d.kelas.filter((k) => k.id !== asisten.kelas_id);
    if (!tujuan.some((k) => k.id === ke)) ke = asisten.tugas_kelas_id !== asisten.kelas_id ? asisten.tugas_kelas_id : tujuan[0]?.id;
    const namaKe = d.kelas.find((k) => k.id === ke)?.nama ?? '-';
    wadah.innerHTML = `
      <span class="label-kecil">1. Pilih asisten</span>
      <div class="grid2" style="gap:8px">
        ${d.asisten.map((a) => `<button class="opsi" style="flex-direction:column;align-items:flex-start;gap:2px" data-asisten="${a.pengguna_id}" aria-pressed="${a.pengguna_id === asisten.pengguna_id}">
          <span class="nama">${esc(a.nama)}</span><span class="kecil muted">Tetap: ${esc(a.kelas_nama)}${a.tugas_jenis === 'pindah' ? ' · sedang dipindah' : ''}</span></button>`).join('')}
      </div>
      <span class="label-kecil" style="margin-top:6px">2. Pindahkan ke kelas</span>
      ${tujuan.map((k) => `<button class="opsi" data-ke="${k.id}" aria-pressed="${k.id === ke}"><span class="radio"></span><span class="tumpuk"><span class="nama">${esc(k.nama)}</span></span></button>`).join('')}
      <div class="kartu rapat" style="flex-direction:row;align-items:center;justify-content:space-between;border-style:dashed">
        <b>${esc(asisten.nama)}</b><span class="muted">${esc(asisten.kelas_nama)}</span><span style="color:var(--utama)">${ikon.panah()}</span><b style="color:var(--utama)">${esc(namaKe)}</b>
      </div>
      <button class="btn btn-utama" id="pindahkan">Pindahkan ${esc(asisten.nama)} ke ${esc(namaKe)}</button>
      ${asisten.tugas_jenis === 'pindah' ? `<button class="btn btn-netral" id="kembalikan">Kembalikan ke ${esc(asisten.kelas_nama)}</button>` : ''}`;
  }

  async function kirim(keKelas) {
    try {
      await api('/api/admin/pindah', { method: 'POST', body: { tanggal: d.tanggal, slot_id: d.slot_id, pengguna_id: asisten.pengguna_id, ke_kelas_id: keKelas } });
      toast(keKelas === asisten.kelas_id ? 'Asisten dikembalikan ke kelas tetapnya.' : 'Asisten dipindahkan.');
      ctx.muatUlang();
    } catch (err) {
      toast(err.message, 'galat');
    }
  }

  wadah.addEventListener('click', (e) => {
    const a = e.target.closest('[data-asisten]');
    if (a) {
      asisten = d.asisten.find((x) => x.pengguna_id === Number(a.dataset.asisten));
      ke = null;
      return gambar();
    }
    const k = e.target.closest('[data-ke]');
    if (k) {
      ke = Number(k.dataset.ke);
      return gambar();
    }
    if (e.target.closest('#pindahkan')) return kirim(ke);
    if (e.target.closest('#kembalikan')) return kirim(asisten.kelas_id);
  });
  gambar();
}
