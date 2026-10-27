import { api } from '../api.js';
import { esc, ikon, chip, fmtTanggal, fmtJam, peranLabel, toast, JENIS_IZIN } from '../ui.js';
import { subNavKepala } from './kepala.js';

export function subNav(aktif) {
  const item = [['dashboard', '#/admin', 'Dashboard'], ['lainnya', '#/admin/lainnya', 'Lainnya']];
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

export const dashboard = (el, a) => tampilDashboard(el, a, {
  api: '/api/admin/dashboard', base: '/admin', lencana: 'Admin', subnav: () => subNav('dashboard'),
  atas: `<a class="btn-ikon-terang" href="#/petugas" aria-label="Buka layar Petugas QR">${ikon.qr()}</a>`,
});

// Dashboard Kepala SMB: semua kelas dan semua sesi hari itu, bisa melihat hari sebelumnya.
export const dashboardKepala = (el, a) => tampilDashboard(el, a, {
  api: '/api/kepala/dashboard', base: '/kepala/dashboard', lencana: 'Kepala SMB', subnav: () => subNavKepala('dashboard', false), atas: '', tanggal: true,
});

// Dashboard Wakil Kurikulum: tampilan sama dengan admin, hanya kelas di jenjangnya.
export const dashboardWakil = (el, a) => tampilDashboard(el, a, {
  api: '/api/wakil/dashboard', base: '/wakil/dashboard', lencana: 'Wakil Kurikulum', subnav: () => subNavKepala('dashboard', true), atas: '', tanggal: true,
});

function blokSlot(data, slot, libur) {
  const r = data?.ringkasan;
  // Ringkasan kehadiran: pembina, asisten, dan murid (dihitung dari semua kelas di slot ini).
  const orang = (data?.kelas ?? []).flatMap((k) => k.anggota);
  const hitungPengajar = (peran) => {
    const a = orang.filter((x) => x.peran === peran);
    return { total: a.length, hadir: a.filter((x) => x.status === 'hadir' || x.status === 'terlambat').length, izin: a.filter((x) => x.status === 'izin').length };
  };
  const pembina = hitungPengajar('guru');
  const asisten = hitungPengajar('asisten');
  const semuaMurid = (data?.kelas ?? []).flatMap((k) => k.murid ?? []);
  const muridHadir = semuaMurid.filter((m) => m.status === 'hadir').length;
  const stat = !r ? [] : [
    ['Pembina hadir', `${pembina.hadir}/${pembina.total}`, pembina.izin ? `${pembina.izin} izin` : ''],
    ['Asisten hadir', `${asisten.hadir}/${asisten.total}`, asisten.izin ? `${asisten.izin} izin` : ''],
    ...(data?.raya ? [] : [['Murid hadir', `${muridHadir}/${semuaMurid.length}`, semuaMurid.some((m) => m.status) ? '' : 'belum diabsen']]),
  ];
  const STATUS_MURID = [['hadir', 'Hadir'], ['izin', 'Izin'], ['sakit', 'Sakit'], ['alpa', 'Alpa'], [null, 'Belum diabsen']];
  const detailMurid = (k) => {
    const m = k.murid ?? [];
    if (!m.length) return '';
    const hadir = m.filter((x) => x.status === 'hadir').length;
    const tercatat = m.some((x) => x.status);
    return `<details class="detail-murid"><summary><span>Murid</span><span class="kecil tebal">${tercatat ? `${hadir} dari ${m.length} hadir` : `${m.length} murid · belum diabsen`}</span></summary>
      ${STATUS_MURID.map(([st, label]) => {
        const grup = m.filter((x) => x.status === st);
        return grup.length ? `<div class="grup-murid"><span class="kecil muted">${label} (${grup.length})</span><span>${grup.map((x) => esc(x.nama)).join(', ')}</span></div>` : '';
      }).join('')}
    </details>`;
  };

  return `
      ${data?.raya ? `<div class="info info-oranye">${ikon.info()}<span><b>${esc(libur?.alasan ?? 'Hari Raya')}</b> · semua pembina dan asisten absen kedatangan satu kali (${fmtJam(slot.scan_mulai)}–${fmtJam(slot.scan_selesai)}).</span></div>` : ''}
      ${r ? `<div class="stat-grid ${data?.raya ? 'dua' : 'tiga'}">${stat.map(([l, n, ket]) => `<div class="stat"><b>${n}</b><span style="color:var(--utama)">${l}</span>${ket ? `<small class="muted">${ket}</small>` : ''}</div>`).join('')}</div>` : ''}
      ${data ? `<h2 class="judul-seksi">Status per kelas</h2>
        ${data.kelas.map((k) => {
          const perlu = k.anggota.filter((a) => a.status !== 'izin');
          const hadir = perlu.filter((a) => a.status === 'hadir' || a.status === 'terlambat').length;
          const lengkap = perlu.length && hadir === perlu.length;
          return `<div class="kartu rapat">
            <div class="baris-antara"><span style="font-size:15px;font-weight:800">${esc(k.nama)}${k.jumlah_murid !== undefined ? ` <span class="kecil muted" style="font-weight:600">· ${k.jumlah_murid} murid</span>` : ''}</span>
              <span class="kecil tebal" style="color:${lengkap ? 'var(--hijau-teks)' : 'var(--oranye)'}">${lengkap ? 'Lengkap' : `${hadir}/${perlu.length} hadir`}</span></div>
            ${k.catatan.map((c) => `<span class="info info-ungu" style="padding:5px 10px">${esc(c)}</span>`).join('')}
            ${detailMurid(k)}
            ${k.materi ? `<span class="kecil muted">Materi: ${esc(k.materi)}</span>` : ''}
            ${k.anggota.map((a) => `<div class="baris-orang"><div class="tumpuk"><span class="nama">${esc(a.nama)}</span>
              <span class="kecil muted">${peranLabel(a.peran)}${a.keterangan ? ' · ' + esc(a.keterangan) : ''} · ${a.jam ? 'scan ' + fmtJam(a.jam) : a.izin_menunggu ? 'izin menunggu' : 'belum ada scan'}</span></div>
              ${chip(a.status)}</div>`).join('')}
          </div>`;
        }).join('') || '<div class="kosong">Belum ada pengajar terjadwal di slot ini.</div>'}` : ''}
  `;
}

async function tampilDashboard(el, { query, ctx }, o) {
  const d = await api(`${o.api}?${qs({ slot_id: query.slot, tanggal: o.tanggal ? query.tanggal : null })}`);
  const geserHari = (n) => { const t = new Date(d.tanggal + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const hariIni = d.tanggal === d.hari_ini;
  const barTanggal = !o.tanggal ? '' : `<div class="bar-tanggal">
    <button type="button" class="geser" data-hari="-1" aria-label="Hari sebelumnya">${ikon.kiri()}</button>
    <label class="pilih-tanggal">
      <span class="tumpuk"><span class="kecil muted">${hariIni ? 'Hari ini' : 'Melihat tanggal'}</span><span class="tebal">${esc(fmtTanggal(d.tanggal))}</span></span>
      <span class="ikon-kal">${ikon.kalender ? ikon.kalender() : ''}</span>
      <input type="date" id="tgl-dash" value="${d.tanggal}" max="${d.hari_ini}" aria-label="Pilih tanggal">
    </label>
    <button type="button" class="geser" data-hari="1" aria-label="Hari berikutnya" ${hariIni ? 'disabled' : ''}>${ikon.kanan()}</button>
  </div>${hariIni ? '' : '<button type="button" class="btn btn-kecil btn-netral kembali-hari-ini" data-hari="hari-ini">Kembali ke hari ini</button>'}`;
  const slot = d.slots?.find((s) => s.id === d.slot_id);
  el.innerHTML = `
    <div class="hdr" style="padding-bottom:60px">
      <div class="hdr-atas">
        <div class="merek"><img class="merek-logo" src="/icons/logo-smb.png" alt="" width="26" height="31"> SMB Dharmakirti <span class="lencana">${o.lencana}</span></div>
        ${o.atas}
      </div>
      <div class="baris-antara" style="align-items:flex-end">
        <div class="tumpuk"><span class="sub">${esc(fmtTanggal(d.tanggal))}</span>
          <h1>${d.tanggal === d.hari_ini ? 'Kehadiran Hari Ini' : 'Kehadiran'}</h1></div>
      </div>
    </div>
    <div class="angkat">${d.bagian ? (d.bagian.length ? '' : '<div class="kartu bayang"><span class="muted">Tidak ada sesi di tanggal ini.</span></div>') + `<div style="margin-top:${d.bagian.length ? '0' : '12px'}">${o.subnav()}</div>` : d.slots.length ? tabSlot(d.slots, d.slot_id) : (d.libur ? `<div class="kartu bayang" style="border-color:var(--oranye-garis)"><span class="tebal" style="color:var(--oranye)">Libur: ${esc(d.libur.alasan)}</span><span class="kecil muted">${d.libur.jenis === 'semester' ? 'Libur semester' : 'Libur harian'} · tidak ada sesi dan tidak ada alpa.</span></div>` : '<div class="kartu bayang"><span class="muted">Tidak ada sesi di tanggal ini.</span></div>')}</div>
    <div class="isi">
      ${d.bagian ? barTanggal : o.subnav()}
      ${d.libur && d.bagian ? `<div class="kartu bayang" style="border-color:var(--oranye-garis)"><span class="tebal" style="color:var(--oranye)">Libur: ${esc(d.libur.alasan)}</span></div>` : ''}
      ${d.bagian
        ? d.bagian.map((b) => `<h2 class="judul-seksi" style="margin-top:8px">Slot ${esc(b.slot.nama)} · ${b.slot.mode === 'konfirmasi' ? 'Konfirmasi ' + fmtJam(b.slot.scan_mulai) : 'Absen masuk ' + fmtJam(b.slot.jam_mulai)}</h2>${blokSlot(b.data, b.slot, d.libur)}`).join('')
        : blokSlot(d.data, slot, d.libur)}
    </div>`;

  const ke = (x) => ctx.pergi(`${o.base}?${qs({ slot: d.slot_id, ...x })}`);
  el.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-slot]');
    if (s) return ke({ slot: s.dataset.slot });
    const h = e.target.closest('[data-hari]');
    if (h && !h.disabled) {
      const v = h.dataset.hari;
      return ctx.pergi(`${o.base}?${qs({ tanggal: v === 'hari-ini' ? null : geserHari(Number(v)) })}`);
    }
  });
  el.querySelector('#tgl-dash')?.addEventListener('click', (e) => { try { e.target.showPicker?.(); } catch { /* browser lama: abaikan */ } });
  el.querySelector('#tgl-dash')?.addEventListener('change', (e) => e.target.value && ctx.pergi(`${o.base}?${qs({ tanggal: e.target.value === d.hari_ini ? null : e.target.value })}`));

  // Pengajuan baru muncul sendiri: cek tiap 5 detik, dan segera saat aplikasi dibuka kembali.
  const segarkan = () => document.visibilityState === 'visible' && !el.querySelector(':focus') && ctx.muatUlangDiam();
  const segar = setInterval(segarkan, 5000);
  document.addEventListener('visibilitychange', segarkan);
  return () => { clearInterval(segar); document.removeEventListener('visibilitychange', segarkan); };
}

let P = 'kepala'; // 'kepala' atau 'wakil' (Wakil Kurikulum: hanya kelas jenjangnya)
export async function tugas(el, { query, ctx }) {
  P = ctx.me.is_kepala ? 'kepala' : 'wakil';
  const mode = ['pindah', 'kedua'].includes(query.mode) || (query.mode === 'gabung' && P === 'kepala') ? query.mode : 'pengganti';
  const d = await api(`/api/${P}/tugas?${qs({ tanggal: query.tanggal, slot_id: query.slot })}`);
  const slot = d.slots.find((s) => s.id === d.slot_id);
  const ke = (o) => ctx.pergi(`/${P}/tugas?${qs({ mode, tanggal: d.tanggal, slot: d.slot_id, ...o })}`);
  const tertutup = d.status_slot === 'selesai';

  const namaKelas = (id) => d.kelas.find((k) => k.id === id)?.nama ?? '-';
  const htmlGabung = (d.gabungan ?? []).length
    ? d.gabungan.map((g) => `
      <div class="kartu rapat"><div class="baris-antara">
        <div class="tumpuk"><span class="tebal">${esc([g.induk_id, ...g.anak_ids].map(namaKelas).join(' + '))}</span>
          <span class="kecil muted">Diajar tim kelas ${esc(namaKelas(g.induk_id))}${tertutup ? '' : ` · <a href="#/${P}/tugas?${qs({ mode: 'pengganti', tanggal: d.tanggal, slot: d.slot_id, kelas: g.induk_id })}">atur pengajar</a>`}</span></div>
        ${tertutup ? '' : `<button class="btn btn-bahaya btn-kecil" style="width:auto" data-batal-gabung="${g.induk_id}">Batalkan</button>`}
      </div></div>`).join('')
    : '<div class="kosong" style="padding:12px">Belum ada kelas yang digabung di sesi ini.</div>';
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
      <div class="baris"><a class="btn-kembali" href="#/${P}" aria-label="Kembali ke Beranda">${ikon.kembali()}</a><h1>Atur Tugas</h1></div>
      <div class="seg tab-abu" role="tablist" style="margin:0 4px">
        <button role="tab" data-mode="pengganti" aria-selected="${mode === 'pengganti'}">Pengganti</button>
        <button role="tab" data-mode="kedua" aria-selected="${mode === 'kedua'}">Pembina 2</button>
        <button role="tab" data-mode="pindah" aria-selected="${mode === 'pindah'}">Pindah</button>
        ${P === 'kepala' ? `<button role="tab" data-mode="gabung" aria-selected="${mode === 'gabung'}">Gabung</button>` : ''}
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
      ${slot ? (mode === 'gabung'
        ? `<h2 class="judul-seksi">Gabungan di sesi ini</h2><div class="tumpuk" style="gap:10px" id="daftar">${htmlGabung}</div>`
        : `<h2 class="judul-seksi">${mode === 'pengganti' ? 'Pengganti' : mode === 'kedua' ? 'Pembina kedua (harian)' : 'Pindahan'} di sesi ini</h2><div class="tumpuk" style="gap:10px" id="daftar">${htmlTugas}</div>`) : ''}
      <div class="info info-abu">${ikon.info()}<span>${mode === 'pengganti'
        ? 'Penugasan bukan input kehadiran. Pengganti tetap harus scan QR pada hari H.'
        : mode === 'gabung'
        ? 'Kelas yang digabung diajar tim kelas induk (atau pengganti yang ditunjuk di tab Pengganti). Absensi siswa dan materi diisi sekali, tetap tersimpan per kelas. Pembina kelas yang digabung tetap tercatat izin, bukan alpa. Honor pengajar dihitung satu sesi seperti biasa. Hanya berlaku pada tanggal dan sesi ini.'
        : mode === 'kedua'
        ? 'Satu kelas boleh punya sampai 2 pembina, dan hanya Kepala SMB atau Wakil Kurikulum yang bisa menetapkan pembina kedua. Pembina kedua tetap harus scan QR dan ikut mendapat honor pembina.'
        : 'Hanya Kepala SMB atau Wakil Kurikulum yang bisa memindahkan asisten. Hari itu asisten hanya bisa scan di kelas tujuan.'}</span></div>
    </div>`;

  el.querySelector('#tgl').addEventListener('change', (e) => e.target.value && ke({ tanggal: e.target.value, slot: null, kelas: null, ganti: null }));
  el.querySelector('#slot').addEventListener('change', (e) => ke({ slot: e.target.value, kelas: null, ganti: null }));
  el.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) return ctx.pergi(`/${P}/tugas?${qs({ mode: m.dataset.mode, tanggal: d.tanggal, slot: d.slot_id })}`);
    const bg = e.target.closest('[data-batal-gabung]');
    if (bg && confirm('Batalkan gabungan kelas ini? Setiap kelas kembali diajar tim masing-masing.')) {
      try {
        await api(`/api/gabung?${qs({ tanggal: d.tanggal, slot_id: d.slot_id, induk_id: bg.dataset.batalGabung })}`, { method: 'DELETE' });
        toast('Gabungan dibatalkan.');
        ctx.muatUlang();
      } catch (err) {
        toast(err.message, 'galat');
      }
      return;
    }
    const h = e.target.closest('[data-hapus]');
    if (h && confirm('Batalkan penugasan ini?')) {
      try {
        await api(`/api/${P}/tugas/${h.dataset.hapus}`, { method: 'DELETE' });
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
  else if (mode === 'gabung') formGabung(wadah, d, query, ctx);
  else formPindah(wadah, d, query, ctx);
}

// Gabung kelas (hanya Kepala SMB): pilih kelas induk lalu kelas-kelas yang ikut bergabung di sesi ini.
function formGabung(wadah, d, query, ctx) {
  const terpakai = new Set((d.gabungan ?? []).flatMap((g) => [g.induk_id, ...g.anak_ids]));
  const bebas = d.kelas.filter((k) => !terpakai.has(k.id));
  if (bebas.length < 2) {
    wadah.innerHTML = `<div class="info info-abu">${ikon.info()}<span>Belum ada dua kelas yang bisa digabung di sesi ini. Kelas yang sudah masuk gabungan lain tidak ditampilkan.</span></div>`;
    return;
  }
  let induk = bebas.some((k) => k.id === Number(query.kelas)) ? Number(query.kelas) : bebas[0].id;
  const dipilih = new Set();
  const murid = (id) => d.jumlah_murid?.[id] ?? 0;
  const pembina = (id) => {
    const p = d.kelas_pembina?.[id] ?? [];
    const lab = { izin: 'izin', hadir: 'hadir', terlambat: 'terlambat', belum: 'belum scan', nanti: 'terjadwal', alpa: 'alpa' };
    return p.length ? p.map((x) => `${esc(x.nama)} (${lab[x.status] ?? x.status})`).join(', ') : 'belum ada pembina';
  };

  const gambar = () => {
    for (const id of [...dipilih]) if (id === induk) dipilih.delete(id);
    wadah.querySelector('#anak').innerHTML = bebas.filter((k) => k.id !== induk).map((k) => `
      <button type="button" class="pilih-kelas" data-anak="${k.id}" aria-pressed="${dipilih.has(k.id)}">
        <span class="kotak"></span>
        <span class="tumpuk"><span class="nama">${esc(k.nama)}</span><span class="kecil muted">Pembina: ${pembina(k.id)} · ${murid(k.id)} murid</span></span>
      </button>`).join('');
    const total = murid(induk) + [...dipilih].reduce((n, id) => n + murid(id), 0);
    wadah.querySelector('#total').textContent = dipilih.size
      ? `Total murid: ${[induk, ...dipilih].map(murid).join(' + ')} = ${total} murid dalam kelas gabungan.`
      : 'Centang kelas yang ikut bergabung.';
    wadah.querySelector('#induk-info').textContent = `Pembina ${d.kelas.find((k) => k.id === induk)?.nama ?? ''}: ` + pembina(induk).replace(/<[^>]+>/g, '');
    const tombol = wadah.querySelector('#gabungkan');
    tombol.disabled = !dipilih.size;
    tombol.textContent = dipilih.size ? 'Gabungkan kelas' : 'Pilih kelas yang digabung';
  };

  wadah.innerHTML = `
    <div class="kartu">
      <span class="label-kecil">Gabungkan kelas</span>
      <div class="field"><label for="induk">Kelas induk (tempat berkumpul)</label><select class="input" id="induk">
        ${bebas.map((k) => `<option value="${k.id}" ${k.id === induk ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select>
        <span class="kecil muted" id="induk-info"></span></div>
      <div class="field"><span class="label">Kelas yang digabung ke kelas induk</span><div class="tumpuk" style="gap:8px" id="anak"></div></div>
      <div class="info info-hijau" id="total-kotak">${ikon.info()}<span id="total"></span></div>
      <button class="btn btn-utama" id="gabungkan" disabled>Pilih kelas yang digabung</button>
    </div>`;

  wadah.querySelector('#induk').addEventListener('change', (e) => { induk = Number(e.target.value); gambar(); });
  wadah.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-anak]');
    if (a) {
      const id = Number(a.dataset.anak);
      if (dipilih.has(id)) dipilih.delete(id); else dipilih.add(id);
      return gambar();
    }
    if (!e.target.closest('#gabungkan')) return;
    const nama = [induk, ...dipilih].map((id) => d.kelas.find((k) => k.id === id)?.nama).join(' + ');
    if (!confirm(`Gabungkan ${nama} pada sesi ini?`)) return;
    e.target.closest('#gabungkan').disabled = true;
    try {
      await api('/api/gabung', { method: 'POST', body: { tanggal: d.tanggal, slot_id: d.slot_id, induk_id: induk, anak_ids: [...dipilih] } });
      toast('Kelas digabung. Pastikan kelas induk punya pengajar.');
      ctx.pergi(`/${P}/tugas?${qs({ mode: 'gabung', tanggal: d.tanggal, slot: d.slot_id })}`);
    } catch (err) {
      toast(err.message, 'galat');
      e.target.closest('#gabungkan').disabled = false;
    }
  });
  gambar();
}

// Siapa yang bertugas di satu kelas pada sesi ini: pembina (baris rapi, dengan status) dan asisten (ringkas).
function timKelas(d, kelasId, { ganti = null, kapasitas = false } = {}) {
  const tim = d.kelas_tim?.[kelasId] ?? [];
  const nama = d.kelas.find((k) => k.id === kelasId)?.nama ?? '';
  const JENIS = { tetap: 'Pembina tetap', tambahan: 'Pembina kedua', pengganti: 'Pengganti', pindah: 'Pindahan' };
  const STAT = { izin: ['Izin', 'izin'], hadir: ['Hadir', 'hadir'], terlambat: ['Terlambat', 'kuning'], belum: ['Belum scan', 'abu'], nanti: ['Terjadwal', 'abu'], alpa: ['Alpa', 'alpa'] };
  const pembina = tim.filter((a) => a.peran === 'guru');
  const asisten = tim.filter((a) => a.peran === 'asisten');
  const aktif = pembina.filter((a) => a.status !== 'izin').length;
  const baris = (a) => {
    const [label, warna] = STAT[a.status] ?? ['-', 'abu'];
    const diganti = ganti && a.pengguna_id === ganti;
    return `<div class="orang${diganti ? ' diganti' : ''}">
      <span class="avatar kecil">${esc(a.nama.split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase())}</span>
      <div class="tumpuk"><span class="nama">${esc(a.nama)}</span>
        <span class="kecil muted">${diganti ? 'Perlu pengganti · ' : ''}${JENIS[a.jenis] ?? 'Pembina'}</span></div>
      <span class="chip chip-${warna}">${label}</span></div>`;
  };
  const kap = kapasitas
    ? `<span class="chip ${aktif >= 2 ? 'chip-hadir' : 'chip-kuning'}">${aktif >= 2 ? 'Lengkap' : `${aktif} dari 2 pembina`}</span>` : '';
  return `<section class="kartu tim-kelas" aria-label="Pembina kelas ${esc(nama)}">
    <div class="baris-antara"><span class="label-kecil">Pembina kelas ${esc(nama)} saat ini</span>${kap}</div>
    ${pembina.length ? pembina.map(baris).join('') : '<div class="kosong" style="padding:10px">Kelas ini belum punya pembina.</div>'}
    ${asisten.length ? `<div class="asisten-ringkas"><span class="label-kecil">Asisten (${asisten.length})</span>
      <span class="kecil">${asisten.map((a) => esc(a.nama) + (a.status === 'izin' ? ' <span class="muted">(izin)</span>' : '')).join(', ')}</span></div>` : ''}
  </section>`;
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
        ${dengan1.map((k) => `<option value="${k.id}" ${k.id === kelasId ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select></div>
    </div>
    <div id="tim-kelas">${timKelas(d, kelasId, { kapasitas: true })}</div>
    <div class="kartu">
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
    const k = await api(`/api/${P}/kandidat?${qs({ tanggal: d.tanggal, slot_id: d.slot_id, kelas_id: kelasId, peran: 'guru' })}`);
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
    wadah.querySelector('#tim-kelas').innerHTML = timKelas(d, kelasId, { kapasitas: true });
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
      await api(`/api/${P}/pembina-kedua`, {
        method: 'POST',
        body: { tanggal: d.tanggal, slot_id: d.slot_id, kelas_id: kelasId, pengguna_id: pilihan, tetap },
      });
      toast('Pembina kedua disetujui.');
      ctx.pergi(`/${P}/tugas?${qs({ mode: 'kedua', tanggal: d.tanggal, slot: d.slot_id })}`);
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
    <div id="tim-kelas">${timKelas(d, kelasId, { ganti })}</div>
    <div id="kandidat" class="tumpuk" style="gap:8px"><div class="kosong">Memuat calon…</div></div>
    <button class="btn btn-utama" id="tugaskan" disabled>Pilih pengganti dulu</button>`;

  const kandidatEl = wadah.querySelector('#kandidat');
  const tombol = wadah.querySelector('#tugaskan');

  async function muat() {
    pilihan = null;
    tombol.disabled = true;
    tombol.textContent = 'Pilih pengganti dulu';
    kandidatEl.innerHTML = '<div class="kosong">Memuat calon…</div>';
    const k = await api(`/api/${P}/kandidat?${qs({ tanggal: d.tanggal, slot_id: d.slot_id, kelas_id: kelasId, peran, menggantikan_id: ganti })}`);
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
    wadah.querySelector('#tim-kelas').innerHTML = timKelas(d, kelasId, { ganti });
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
      await api(`/api/${P}/pengganti`, {
        method: 'POST',
        body: { tanggal: d.tanggal, slot_id: d.slot_id, kelas_id: kelasId, peran, pengguna_id: pilihan, menggantikan_id: ganti },
      });
      toast('Pengganti ditugaskan.');
      ctx.pergi(`/${P}/tugas?${qs({ mode: 'pengganti', tanggal: d.tanggal, slot: d.slot_id })}`);
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
      await api(`/api/${P}/pindah`, { method: 'POST', body: { tanggal: d.tanggal, slot_id: d.slot_id, pengguna_id: asisten.pengguna_id, ke_kelas_id: keKelas } });
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
