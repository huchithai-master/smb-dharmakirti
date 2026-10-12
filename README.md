# SMB Dharmakirti

Aplikasi absensi pembina, asisten, dan siswa Sekolah Minggu Buddhis. PWA untuk HP.

- **Frontend:** statis di `public/` (tanpa build step)
- **API:** fungsi serverless di `api/` dengan kode di `lib/`
- **Database:** PostgreSQL di Supabase (skema di `sql/schema.sql`)

## Memasang di Vercel lewat GitHub

1. **Upload folder ini ke repositori GitHub** (tanpa `node_modules` dan `data`; keduanya sudah masuk `.gitignore`).
2. Di Vercel: **Add New › Project › Import** repositori tersebut.
   - Framework Preset: **Other**
   - Build Command, Output Directory, dan Install Command biarkan sesuai `vercel.json` (tidak perlu diubah).
3. Di **Settings › Environment Variables** tambahkan:

   | Nama | Isi |
   |---|---|
   | `DATABASE_URL` | Connection string Supabase **Transaction pooler** (port 6543), sudah berisi password database |

   Ambil di Supabase: tombol **Connect › Transaction pooler**. Bentuknya
   `postgresql://postgres.<ref-project>:<password>@<host>.pooler.supabase.com:6543/postgres`.
4. **Deploy.** Setelah env var ditambahkan, lakukan *Redeploy* bila deployment pertama sudah berjalan sebelum env var diisi.

## Akun admin pertama

Tabel pengguna yang kosong membuat aplikasi bisa membuat admin pertama sendiri saat startup, dari tiga env var tambahan:

| Nama | Contoh |
|---|---|
| `ADMIN_NAMA` | `Lukito Hutomo` |
| `ADMIN_HP` | `081275662834` |
| `ADMIN_PIN` | PIN 6 angka (tidak boleh berurutan atau kembar) |

PIN hanya disimpan sebagai hash. Setelah admin terbentuk dan bisa login, ketiga env var ini boleh dihapus.

Alternatif tanpa menaruh PIN di Vercel: buat baris admin langsung di Supabase (tabel `pengguna`, `is_admin = 1`, `undangan_kode` acak, `undangan_kedaluwarsa` diisi), lalu buka `https://<domain>/#/aktivasi?kode=<kode>` untuk membuat PIN sendiri.

## Menjalankan di komputer sendiri

```bash
npm install
npm run dev     # http://localhost:3000
```

Tanpa `DATABASE_URL`, data disimpan lokal di `data/pglite` (Postgres bawaan, tanpa instalasi). Skema dibuat otomatis.

## Catatan

- Semua jam memakai WIB (UTC+7) di server mana pun.
- Aplikasi tidak membawa data contoh. Urutan mengisi data setelah login: kelas, slot (Pagi/Siang), pembina dan asisten, lalu murid.
- Region fungsi diatur ke `icn1` (Seoul) di `vercel.json`, dekat dengan database. Ubah bila project Supabase Anda di region lain.
- Supabase free plan menjeda project yang tidak aktif selama seminggu.
