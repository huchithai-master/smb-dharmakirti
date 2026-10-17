// Membuat atau mereset akun admin di database LOKAL (data/pglite).
// Pemakaian: node scripts/admin-lokal.js <no_hp> <pin_6_angka> [nama]
// Hentikan server (npm run dev) dulu karena database lokal hanya bisa dibuka satu proses.
import { one, run, siapkan } from '../lib/db.js';
import { hashPin, normalHp, pinLemah } from '../lib/auth.js';

if (process.env.DATABASE_URL) {
  console.error('DATABASE_URL terisi. Skrip ini hanya untuk database lokal, jadi dihentikan agar database online tidak tersentuh.');
  process.exit(1);
}
const [hpMentah, pin, ...namaBagian] = process.argv.slice(2);
const hp = normalHp(hpMentah);
const nama = namaBagian.join(' ').trim() || 'Admin';
if (!/^08\d{7,12}$/.test(hp)) { console.error('No. HP tidak valid.'); process.exit(1); }
const lemah = pinLemah(String(pin ?? ''));
if (lemah) { console.error(lemah); process.exit(1); }

await siapkan();
const ada = await one('SELECT id FROM pengguna WHERE hp = ?', hp);
if (ada) {
  await run('UPDATE pengguna SET is_admin = 1, aktif = 1, pin_hash = ?, gagal_login = 0, kunci_sampai = NULL WHERE id = ?', hashPin(pin), ada.id);
  console.log(`Akun ${hp} sudah ada: dijadikan admin dan PIN diganti.`);
} else {
  await run('INSERT INTO pengguna (nama, hp, is_pengajar, is_admin, is_petugas, pin_hash, jabatan) VALUES (?, ?, 0, 1, 0, ?, NULL)', nama, hp, hashPin(pin));
  console.log(`Admin baru dibuat: ${nama} (${hp}).`);
}
console.log(`Login dengan No. HP ${hp} dan PIN ${pin}.`);
// Beri waktu database menulis ke disk sebelum proses ditutup.
setTimeout(() => process.exit(0), 1500);
