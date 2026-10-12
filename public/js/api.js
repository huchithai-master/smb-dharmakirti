export async function api(path, { method = 'GET', body } = {}) {
  const opsi = { method, credentials: 'same-origin', headers: {} };
  if (method !== 'GET') {
    opsi.headers['Content-Type'] = 'application/json';
    opsi.body = JSON.stringify(body ?? {});
  }
  let res;
  try {
    res = await fetch(path, opsi);
  } catch {
    throw new Error('Tidak bisa terhubung ke server. Periksa koneksi internet.');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // respons bukan JSON
  }
  if (!res.ok) {
    const e = new Error(data?.error || 'Terjadi kesalahan. Coba lagi.');
    e.status = res.status;
    if (res.status === 401 && path !== '/api/login') window.dispatchEvent(new Event('sesi-habis'));
    throw e;
  }
  return data;
}
