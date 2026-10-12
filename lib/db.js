// Lapisan database PostgreSQL.
//  - Produksi (Vercel): DATABASE_URL = connection string Supabase (pooler, mode transaction).
//  - Lokal tanpa DATABASE_URL: PGlite (Postgres bawaan WASM) tersimpan di folder data/.
// Semua fungsi async. Placeholder "?" otomatis diubah menjadi $1, $2, ...
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Ekspresi SQL untuk waktu UTC saat ini sebagai teks (pengganti datetime('now')).
export const NOW_SQL = "to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')";

const als = new AsyncLocalStorage();
let koneksi = null;
let siap = null;

function ubahPlaceholder(sql) {
  let n = 0;
  let hasil = '';
  let kutip = false;
  for (const c of sql) {
    if (c === "'") kutip = !kutip;
    if (c === '?' && !kutip) hasil += `$${++n}`;
    else hasil += c;
  }
  return hasil;
}

async function buatKoneksi() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: pg } = await import('pg');
    pg.types.setTypeParser(20, (v) => Number(v)); // bigint -> number
    const pool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.DB_POOL_MAX || 4),
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
      idleTimeoutMillis: 10_000,
    });
    return {
      jenis: 'pg',
      query: async (sql, params) => {
        const r = await pool.query(sql, params);
        return { rows: r.rows, changes: r.rowCount ?? 0 };
      },
      exec: (sql) => pool.query(sql),
      transaksi: async (fn) => {
        const klien = await pool.connect();
        try {
          await klien.query('BEGIN');
          const hasil = await fn({
            query: async (sql, params) => {
              const r = await klien.query(sql, params);
              return { rows: r.rows, changes: r.rowCount ?? 0 };
            },
          });
          await klien.query('COMMIT');
          return hasil;
        } catch (e) {
          await klien.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          klien.release();
        }
      },
    };
  }
  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL belum diatur di Vercel (Settings > Environment Variables).');
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.DATA_DIR || path.join(ROOT, 'data', 'pglite');
  mkdirSync(path.dirname(dir), { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  const bungkus = (q) => async (sql, params) => {
    const r = await q.query(sql, params);
    return { rows: r.rows, changes: r.affectedRows ?? 0 };
  };
  return {
    jenis: 'pglite',
    query: bungkus(db),
    exec: (sql) => db.exec(sql),
    transaksi: (fn) => db.transaction((t) => fn({ query: bungkus(t) })),
  };
}

// Menyiapkan koneksi dan skema satu kali per proses.
export function siapkan() {
  if (!siap) {
    siap = (async () => {
      koneksi = await buatKoneksi();
      const skema = readFileSync(path.join(ROOT, 'sql', 'schema.sql'), 'utf8');
      const ada = await koneksi.query("SELECT to_regclass('public.pengguna') AS t", []);
      if (!ada.rows[0].t) await koneksi.exec(skema);
      else await koneksi.exec(skema); // idempoten; menambah tabel/kolom baru bila ada
      await bootstrapAdmin();
    })().catch((e) => {
      siap = null;
      throw e;
    });
  }
  return siap;
}

async function jalankan(sql, params = []) {
  await siapkan();
  const t = als.getStore();
  return (t ?? koneksi).query(ubahPlaceholder(sql), params);
}

export const one = async (sql, ...params) => (await jalankan(sql, params)).rows[0];
export const all = async (sql, ...params) => (await jalankan(sql, params)).rows;
export const run = async (sql, ...params) => {
  const r = await jalankan(sql, params);
  return { changes: r.changes, rows: r.rows };
};

export async function tx(fn) {
  await siapkan();
  if (als.getStore()) return fn(); // sudah di dalam transaksi
  return koneksi.transaksi((t) => als.run(t, fn));
}

export async function getSetting(kunci) {
  return (await one('SELECT nilai FROM pengaturan WHERE kunci = ?', kunci))?.nilai ?? null;
}

export async function setSetting(kunci, nilai) {
  if (nilai === null) await run('DELETE FROM pengaturan WHERE kunci = ?', kunci);
  else {
    await run(
      'INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?) ON CONFLICT (kunci) DO UPDATE SET nilai = excluded.nilai',
      kunci, String(nilai),
    );
  }
}

// Akun admin pertama. Hanya dibuat bila belum ada pengguna sama sekali, dari variabel lingkungan:
//   ADMIN_NAMA, ADMIN_HP, ADMIN_PIN  (PIN tidak disimpan di kode, hanya hash-nya di database)
async function bootstrapAdmin() {
  const { ADMIN_NAMA, ADMIN_HP, ADMIN_PIN } = process.env;
  if (!ADMIN_NAMA || !ADMIN_HP || !ADMIN_PIN) return;
  const ada = await koneksi.query('SELECT id FROM pengguna LIMIT 1', []);
  if (ada.rows.length) return;
  const { hashPin, normalHp } = await import('./auth.js');
  await koneksi.query(
    `INSERT INTO pengguna (nama, hp, is_pengajar, is_admin, is_petugas, pin_hash, jabatan)
     VALUES ($1, $2, 0, 1, 0, $3, NULL)`,
    [ADMIN_NAMA, normalHp(ADMIN_HP), hashPin(String(ADMIN_PIN))],
  );
}
