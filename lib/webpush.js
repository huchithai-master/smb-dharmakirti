// Web Push tanpa dependensi: VAPID (RFC 8292) + enkripsi pesan aes128gcm (RFC 8188 / RFC 8291), memakai modul crypto bawaan Node.
import { generateKeyPairSync, createPrivateKey, createECDH, createCipheriv, createSign, randomBytes, hkdfSync } from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const dariB64u = (s) => Buffer.from(String(s), 'base64url');

export function buatKunciVapid() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const publik = Buffer.concat([Buffer.from([4]), dariB64u(jwk.x), dariB64u(jwk.y)]);
  return { publicKey: b64u(publik), privateJwk: jwk };
}

function tandaiVapid(endpoint, vapid, subjek) {
  const jwt = (obj) => b64u(JSON.stringify(obj));
  const badan = `${jwt({ typ: 'JWT', alg: 'ES256' })}.${jwt({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subjek,
  })}`;
  const tanda = createSign('SHA256').update(badan).sign({ key: createPrivateKey({ key: vapid.privateJwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${badan}.${b64u(tanda)}, k=${vapid.publicKey}`;
}

// Enkripsi satu pesan untuk satu langganan (kunci p256dh dan auth dari browser).
export function enkripsiPesan(teks, p256dh, auth) {
  const uaPublik = dariB64u(p256dh);
  const rahasiaAuth = dariB64u(auth);
  const as = createECDH('prime256v1');
  as.generateKeys();
  const asPublik = as.getPublicKey();
  const bersama = as.computeSecret(uaPublik);
  const ikm = Buffer.from(hkdfSync('sha256', bersama, rahasiaAuth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublik, asPublik]), 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const isi = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(teks, 'utf8'), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublik.length]), asPublik, isi]);
}

export async function kirimPush(langganan, teks, vapid, { subjek, ttl = 86400, timeout = 8000 } = {}) {
  const res = await fetch(langganan.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
      Authorization: tandaiVapid(langganan.endpoint, vapid, subjek),
    },
    body: enkripsiPesan(teks, langganan.p256dh, langganan.auth),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    const e = new Error(`Push ditolak (${res.status})`);
    e.statusCode = res.status;
    throw e;
  }
}

