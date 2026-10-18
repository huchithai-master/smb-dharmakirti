// Impor data murid dari Excel (.xlsx): unduh template, unggah, periksa, lalu simpan sekaligus.
// File .xlsx dibaca dan dibuat langsung di HP/komputer memakai JSZip (tanpa mengirim file ke server).
import { api } from '../api.js';
import { esc, ikon, muatSkrip, toast } from '../ui.js';

const KOLOM = [
  { k: 'nama', judul: 'Nama lengkap', wajib: true, lebar: 28, cocok: ['namalengkap', 'nama', 'namasiswa', 'namamurid'] },
  { k: 'kelas', judul: 'Kelas', wajib: true, lebar: 12, cocok: ['kelas'] },
  { k: 'tempat_lahir', judul: 'Tempat lahir', wajib: true, lebar: 18, cocok: ['tempatlahir', 'tempat'] },
  { k: 'tanggal_lahir', judul: 'Tanggal lahir', wajib: true, lebar: 16, cocok: ['tanggallahir', 'tgllahir', 'lahir'] },
  { k: 'alamat', judul: 'Alamat', wajib: true, lebar: 36, cocok: ['alamat', 'alamatsiswa'] },
  { k: 'asal_sekolah', judul: 'Asal sekolah', wajib: true, lebar: 24, cocok: ['asalsekolah', 'sekolah'] },
  { k: 'nama_ortu', judul: 'Nama orang tua', wajib: true, lebar: 24, cocok: ['namaorangtua', 'namaortu', 'orangtua', 'ortu', 'namawali'] },
  { k: 'hp_ortu', judul: 'No. HP orang tua', wajib: true, lebar: 18, cocok: ['nohporangtua', 'hporangtua', 'hportu', 'nohportu'] },
  { k: 'hp', judul: 'No. HP siswa', wajib: false, lebar: 18, cocok: ['nohpsiswa', 'hpsiswa', 'hp', 'nohp'] },
  { k: 'nik', judul: 'NIK', wajib: false, lebar: 20, cocok: ['nik'] },
];
const BATAS_BARIS = 500;
const TANDA_CONTOH = '(CONTOH)';

const JSZIP = '/vendor/jszip.min.js';
const xmlEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hurufKolom = (i) => String.fromCharCode(65 + i);
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- Template ----------
async function buatTemplate(kelasNama) {
  await muatSkrip(JSZIP);
  const z = new window.JSZip();
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Murid" sheetId="1" r:id="rId1"/><sheet name="Petunjuk" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  // Gaya: 0 biasa, 1 judul kolom (tebal, latar navy, teks putih), 2 teks (format Text agar angka nol di depan tidak hilang), 3 contoh (miring abu-abu), 4 judul tebal
  z.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><i/><sz val="11"/><color rgb="FF7A8194"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B2B63"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"><alignment vertical="center"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`);

  const contoh = { nama: `${TANDA_CONTOH} Budi Santoso`, kelas: kelasNama[0] ?? '1 SD', tempat_lahir: 'Palembang', tanggal_lahir: '2018-05-20', alamat: 'Jl. Contoh No. 1, Palembang', asal_sekolah: 'SD Contoh', nama_ortu: 'Hendra Santoso', hp_ortu: '081234567890', hp: '', nik: '' };
  const sel = (ref, v, s) => `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  const kolomXml = KOLOM.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.lebar}" customWidth="1" style="2"/>`).join('');
  const judul = KOLOM.map((c, i) => sel(`${hurufKolom(i)}1`, c.judul + (c.wajib ? ' *' : ''), 1)).join('');
  const baris2 = KOLOM.map((c, i) => sel(`${hurufKolom(i)}2`, contoh[c.k], 3)).join('');
  const kolKelas = hurufKolom(KOLOM.findIndex((c) => c.k === 'kelas'));
  const akhirKelas = Math.max(2, kelasNama.length + 1);
  z.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${kolomXml}</cols><sheetData><row r="1" ht="22" customHeight="1">${judul}</row><row r="2">${baris2}</row></sheetData><dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Kelas" error="Pilih kelas dari daftar." sqref="${kolKelas}2:${kolKelas}${BATAS_BARIS + 1}"><formula1>Petunjuk!$A$12:$A$${11 + akhirKelas - 1}</formula1></dataValidation></dataValidations></worksheet>`);

  const petunjuk = [
    ['Cara mengisi template impor murid', 4],
    ['1. Isi data murid di sheet "Murid", satu murid satu baris, mulai dari baris ke-2.', 0],
    ['2. Baris contoh berawalan (CONTOH) diabaikan saat impor. Boleh dihapus atau ditimpa.', 0],
    ['3. Kolom bertanda * wajib diisi. No. HP siswa dan NIK boleh dikosongkan.', 0],
    ['4. Kelas dipilih dari daftar di bawah (kolom Kelas punya pilihan daftar).', 0],
    ['5. Tanggal lahir ditulis 2018-05-20 atau 20/05/2018.', 0],
    ['6. No. HP ditulis 08..., NIK 16 digit angka. Kolom sudah berformat Teks agar angka 0 di depan tidak hilang. Jangan ubah formatnya.', 0],
    ['7. Simpan sebagai .xlsx, lalu unggah lewat menu Impor Excel di aplikasi. Maksimal ' + BATAS_BARIS + ' murid per impor.', 0],
    ['8. NIK yang sudah tersimpan tidak ditampilkan lagi di aplikasi demi kerahasiaan.', 0],
    ['', 0],
    ['Daftar kelas yang boleh dipakai', 4],
    ...kelasNama.map((n) => [n, 2]),
  ];
  const barisPet = petunjuk.map(([t, s], i) => (t ? `<row r="${i + 1}">${sel(`A${i + 1}`, t, s)}</row>` : '')).join('');
  z.file('xl/worksheets/sheet2.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="110" customWidth="1"/></cols><sheetData>${barisPet}</sheetData></worksheet>`);

  const blob = await z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Template-Impor-Murid.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------- Baca file .xlsx ----------
const indeksKolom = (ref) => {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};
const parseXml = (t) => new DOMParser().parseFromString(t, 'application/xml');

async function bacaXlsx(file) {
  await muatSkrip(JSZIP);
  let z;
  try {
    z = await window.JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error('File tidak bisa dibaca. Pastikan formatnya .xlsx (Excel), bukan .xls atau .csv.');
  }
  const teks = async (p) => (z.file(p) ? z.file(p).async('string') : null);
  const wb = await teks('xl/workbook.xml');
  if (!wb) throw new Error('File bukan Excel (.xlsx) yang valid.');
  const sheets = [...parseXml(wb).getElementsByTagName('sheet')];
  const rels = await teks('xl/_rels/workbook.xml.rels');
  const peta = new Map([...parseXml(rels).getElementsByTagName('Relationship')].map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const pilih = sheets.find((s) => norm(s.getAttribute('name')) === 'murid') ?? sheets[0];
  const rid = pilih.getAttribute('r:id') ?? pilih.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  let target = peta.get(rid) ?? 'worksheets/sheet1.xml';
  target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
  const xmlSheet = await teks(target);
  if (!xmlSheet) throw new Error('Sheet data tidak ditemukan di file ini.');

  const bersama = [];
  const ss = await teks('xl/sharedStrings.xml');
  if (ss) for (const si of parseXml(ss).getElementsByTagName('si')) bersama.push([...si.getElementsByTagName('t')].map((t) => t.textContent).join(''));

  const baris = [];
  for (const r of parseXml(xmlSheet).getElementsByTagName('row')) {
    const arr = [];
    for (const c of r.getElementsByTagName('c')) {
      const i = indeksKolom(c.getAttribute('r') ?? 'A1');
      const t = c.getAttribute('t');
      let v = '';
      if (t === 's') v = bersama[Number(c.getElementsByTagName('v')[0]?.textContent)] ?? '';
      else if (t === 'inlineStr') v = [...c.getElementsByTagName('t')].map((x) => x.textContent).join('');
      else v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      arr[i] = { v: String(v).trim(), angka: !t || t === 'n' };
    }
    baris.push({ no: Number(r.getAttribute('r')), sel: arr });
  }
  return baris;
}

const serialKeTanggal = (n) => {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return d.toISOString().slice(0, 10);
};
function normTanggal(sel) {
  if (!sel || !sel.v) return '';
  const v = sel.v;
  if (sel.angka && /^\d+(\.\d+)?$/.test(v) && Number(v) > 1000) return serialKeTanggal(Number(v));
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return v;
}

function ubahKeMurid(baris) {
  const judul = baris.find((b) => b.sel.some((s) => s?.v));
  if (!judul) throw new Error('Sheet kosong.');
  const peta = {};
  judul.sel.forEach((s, i) => {
    const n = norm((s?.v ?? '').replace(/\*/g, ''));
    const kol = KOLOM.find((c) => c.cocok.includes(n));
    if (kol && peta[kol.k] === undefined) peta[kol.k] = i;
  });
  const hilang = KOLOM.filter((c) => c.wajib && peta[c.k] === undefined).map((c) => c.judul);
  if (hilang.length) throw new Error(`Judul kolom tidak ditemukan: ${hilang.join(', ')}. Gunakan template dari aplikasi.`);
  const hasil = [];
  for (const b of baris) {
    if (b.no <= judul.no) continue;
    const sel = (k) => b.sel[peta[k]];
    const nilai = (k) => String(sel(k)?.v ?? '').trim();
    if (!KOLOM.some((c) => nilai(c.k))) continue; // baris kosong
    if (nilai('nama').toUpperCase().startsWith(TANDA_CONTOH)) continue;
    let nik = nilai('nik');
    let galatNik = '';
    if (nik && /^\d+([.,]\d+)?[eE][+-]?\d+$/.test(nik)) {
      galatNik = 'NIK rusak oleh Excel (terbaca sebagai angka). Ubah kolom NIK menjadi format Teks lalu isi ulang.';
      nik = '';
    } else if (nik) nik = nik.replace(/\D/g, '');
    hasil.push({
      baris: b.no, nama: nilai('nama'), kelas: nilai('kelas'), tempat_lahir: nilai('tempat_lahir'), tanggal_lahir: normTanggal(sel('tanggal_lahir')),
      alamat: nilai('alamat'), asal_sekolah: nilai('asal_sekolah'), nama_ortu: nilai('nama_ortu'), hp_ortu: nilai('hp_ortu'),
      hp: peta.hp !== undefined ? nilai('hp') : '', nik, galat_awal: galatNik,
    });
  }
  return hasil;
}

// ---------- Layar impor ----------
export async function imporMurid(el, { ctx }) {
  const admin = ctx.me.is_admin || ctx.me.is_kepala;
  const dasar = admin ? '/api/admin/murid' : '/api/pembina/murid';
  const kembali = admin ? '#/admin/murid' : '#/murid';
  const info = await api(dasar);
  const kelasNama = info.kelas.map((k) => k.nama);
  let data = null;
  let hasil = null;

  el.innerHTML = `
    <div class="hdr-putih"><div class="baris"><a class="btn-kembali" href="${kembali}" aria-label="Kembali">${ikon.kembali()}</a><h1>Impor Murid dari Excel</h1></div></div>
    <div class="isi">
      <section class="kartu">
        <span class="label-kecil">Langkah 1</span>
        <span class="tebal">Unduh template</span>
        <span class="kecil muted">Isi data murid di template ini. Kelas yang boleh dipakai: ${esc(kelasNama.join(', ') || '-')}.</span>
        <button class="btn btn-netral" type="button" id="unduh">${ikon.unduh()} Unduh template (.xlsx)</button>
      </section>
      <section class="kartu">
        <span class="label-kecil">Langkah 2</span>
        <span class="tebal">Unggah file yang sudah diisi</span>
        <label class="btn btn-utama" for="berkas" style="cursor:pointer">Pilih file Excel</label>
        <input id="berkas" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none">
        <span class="kecil muted" id="nama-berkas">Belum ada file dipilih. Maksimal ${BATAS_BARIS} murid per impor.</span>
        <div class="galat" id="galat" role="alert"></div>
      </section>
      <div id="hasil"></div>
    </div>`;

  const $ = (id) => el.querySelector('#' + id);
  const tombolUnduh = $('unduh');
  tombolUnduh.addEventListener('click', async () => {
    tombolUnduh.disabled = true;
    try { await buatTemplate(kelasNama); } catch (err) { toast(err.message, 'galat'); }
    tombolUnduh.disabled = false;
  });

  const kirim = (simpan) => api(`${dasar}/impor`, { method: 'POST', body: { simpan, murid: data.filter((m) => !(simpan && m.galat_awal)).map(({ galat_awal, ...m }) => m) } });

  function tampil() {
    const ok = hasil.baris.filter((b) => !b.pesan);
    const gagal = hasil.baris.filter((b) => b.pesan);
    $('hasil').innerHTML = `
      <section class="kartu">
        <span class="label-kecil">Langkah 3</span>
        <span class="tebal">Periksa hasil</span>
        <div class="grid2">
          <div class="info info-utama" style="flex-direction:column;gap:2px"><span class="kecil">Siap diimpor</span><b style="font-size:22px">${ok.length}</b></div>
          <div class="info ${gagal.length ? 'info-abu' : 'info-utama'}" style="flex-direction:column;gap:2px"><span class="kecil">Perlu diperbaiki</span><b style="font-size:22px">${gagal.length}</b></div>
        </div>
        ${gagal.length ? `<div class="tumpuk" style="gap:6px">${gagal.slice(0, 50).map((b) => `<div class="kecil"><b>Baris ${b.baris}${b.nama ? ' · ' + esc(b.nama) : ''}:</b> <span class="muted">${esc(b.pesan)}</span></div>`).join('')}${gagal.length > 50 ? `<span class="kecil muted">…dan ${gagal.length - 50} baris lain.</span>` : ''}</div>
          <span class="kecil muted">Perbaiki baris tersebut di Excel lalu unggah ulang, atau impor yang sudah benar dulu dan tambahkan sisanya nanti.</span>` : ''}
        <button class="btn btn-utama" type="button" id="simpan" ${ok.length ? '' : 'disabled'}>Impor ${ok.length} murid</button>
      </section>`;
    const tombolSimpan = $('simpan');
    tombolSimpan?.addEventListener('click', async () => {
      tombolSimpan.disabled = true;
      tombolSimpan.textContent = 'Menyimpan…';
      try {
        const r = await kirim(true);
        toast(`${r.tersimpan} murid berhasil diimpor.`);
        ctx.pergi(admin ? '/admin/murid' : '/murid');
      } catch (err) {
        $('galat').textContent = err.message;
        tampil();
      }
    });
  }

  $('berkas').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    $('galat').textContent = '';
    $('hasil').innerHTML = '';
    $('nama-berkas').textContent = f.name;
    try {
      data = ubahKeMurid(await bacaXlsx(f));
      if (!data.length) throw new Error('Tidak ada data murid di file ini. Isi mulai dari baris ke-2 (baris contoh diabaikan).');
      if (data.length > BATAS_BARIS) throw new Error(`Terlalu banyak baris (${data.length}). Maksimal ${BATAS_BARIS} murid per impor.`);
      hasil = await kirim(false);
      for (const b of hasil.baris) {
        const awal = data.find((d) => d.baris === b.baris)?.galat_awal;
        if (awal && !b.pesan) b.pesan = awal;
      }
      tampil();
    } catch (err) {
      $('galat').textContent = err.message;
    } finally {
      e.target.value = '';
    }
  });
}
