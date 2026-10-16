import { api } from '../api.js';
import { esc, ikon, fmtJam, fmtTanggal, peranLabel, muatSkrip } from '../ui.js';

const STATUS_TEKS = { hadir: 'Hadir', terlambat: 'Terlambat' };

export async function scan(el) {
  let stream = null;
  let timer = null;
  let selesai = false;

  const berhenti = () => {
    clearTimeout(timer);
    timer = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  function layarKamera(pesan = '') {
    el.innerHTML = `
      <div class="layar-gelap">
        <div style="display:flex;align-items:center;gap:8px;padding:16px 12px">
          <a class="btn-kembali" href="#/" aria-label="Kembali ke Beranda">${ikon.kembali()}</a>
          <span style="font-size:17px;font-weight:700">Scan QR Absensi</span>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:0 24px">
          <div class="kamera">
            <video id="video" playsinline muted></video>
            <div class="sudut s1"></div><div class="sudut s2"></div><div class="sudut s3"></div><div class="sudut s4"></div>
            <div class="garis-scan"></div>
          </div>
          <div style="text-align:center;display:flex;flex-direction:column;gap:6px">
            <span style="font-size:17px;font-weight:700">Arahkan kamera ke QR petugas</span>
            <span class="sedang muted-gelap" id="status" style="line-height:1.5">${esc(pesan || 'QR berganti otomatis setiap 30 detik. Pastikan QR terlihat utuh di dalam kotak.')}</span>
          </div>
        </div>
        <div style="padding:16px 16px 28px">
          <div class="info" style="color:#b8c4bd;padding:0">${ikon.info()}<span>Kehadiran hanya bisa dicatat lewat scan QR. Tidak ada input manual oleh admin.</span></div>
        </div>
      </div>`;
  }

  function layarHasil(ok, judul, isi, tombol) {
    el.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;min-height:100vh;min-height:100dvh">
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:64px 16px 0;gap:20px">
          <div class="lingkar-sukses ${ok ? '' : 'gagal'}"><div style="color:#fff">${ok ? ikon.centang() : ikon.silang()}</div></div>
          <div style="text-align:center;display:flex;flex-direction:column;gap:6px">
            <h1 style="font-size:24px;font-weight:800">${esc(judul)}</h1>
          </div>
          ${isi}
        </div>
        <div class="tumpuk" style="padding:16px 16px 28px;gap:10px">${tombol}</div>
      </div>`;
  }

  async function kirim(token) {
    selesai = true;
    berhenti();
    const status = el.querySelector('#status');
    if (status) status.textContent = 'Memproses…';
    try {
      const r = await api('/api/scan', { method: 'POST', body: { token } });
      const a = r.absensi;
      const label = a.mode === 'konfirmasi' ? 'Hadir · terkonfirmasi' : STATUS_TEKS[a.status];
      layarHasil(
        true,
        r.sudah ? 'Sudah tercatat' : 'Absen berhasil',
        `<span class="sedang muted" style="margin-top:-12px">${r.sudah ? 'Anda sudah scan untuk sesi ini.' : 'Anumodana, selamat mengajar hari ini.'}</span>
         <div class="tabel-detail" style="align-self:stretch">
           <div><span>Tanggal</span><span>${esc(fmtTanggal(a.tanggal, 'pendek'))}</span></div>
           <div><span>Sesi</span><span>Slot ${esc(a.slot_nama)}</span></div>
           <div><span>Kelas</span><span>${esc(a.kelas_nama)}</span></div>
           <div><span>Peran</span><span>${peranLabel(a.peran)}${a.jenis === 'pengganti' ? ' pengganti' : a.jenis === 'tambahan' ? ' (kedua)' : a.jenis === 'pindah' ? ' (pindahan)' : ''}</span></div>
           <div><span>Jam scan</span><span>${fmtJam(a.jam)}</span></div>
           <div><span>Status</span><span><span class="chip chip-${a.status}">${esc(label)}</span></span></div>
         </div>`,
        `<a class="btn btn-utama" href="#/">Kembali ke Beranda</a><a class="btn btn-garis" href="#/riwayat">Lihat Riwayat</a>`,
      );
    } catch (e) {
      layarHasil(
        false,
        'Absen belum tercatat',
        `<div class="galat" style="align-self:stretch;text-align:center">${esc(e.message)}</div>`,
        `<button class="btn btn-utama" id="ulang">Scan ulang</button><a class="btn btn-garis" href="#/">Kembali ke Beranda</a>`,
      );
      el.querySelector('#ulang').addEventListener('click', mulai);
    }
  }

  async function mulai() {
    selesai = false;
    layarKamera();
    const status = el.querySelector('#status');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'Kamera hanya bisa dipakai lewat koneksi aman (HTTPS). Buka aplikasi dari alamat https://.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (e) {
      status.textContent = e.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser, lalu muat ulang.'
        : 'Kamera tidak bisa dibuka. Tutup aplikasi lain yang memakai kamera lalu coba lagi.';
      return;
    }
    if (selesai) return berhenti();
    const video = el.querySelector('#video');
    video.srcObject = stream;
    await video.play().catch(() => {});

    let deteksi;
    if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats?.())?.includes('qr_code')) {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      deteksi = async () => (await detector.detect(video))[0]?.rawValue ?? null;
    } else {
      await muatSkrip('/vendor/jsQR.js');
      const kanvas = document.createElement('canvas');
      const c2d = kanvas.getContext('2d', { willReadFrequently: true });
      deteksi = async () => {
        if (!video.videoWidth) return null;
        const skala = Math.min(1, 640 / video.videoWidth);
        kanvas.width = Math.round(video.videoWidth * skala);
        kanvas.height = Math.round(video.videoHeight * skala);
        c2d.drawImage(video, 0, 0, kanvas.width, kanvas.height);
        const img = c2d.getImageData(0, 0, kanvas.width, kanvas.height);
        return window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
      };
    }

    const putar = async () => {
      if (selesai || !stream) return;
      try {
        const hasil = await deteksi();
        if (hasil && hasil.startsWith('SMBH1.')) return kirim(hasil);
        if (hasil) el.querySelector('#status').textContent = 'Itu bukan QR SMB Dharmakirti. Arahkan ke QR di HP petugas.';
      } catch {
        // frame belum siap, coba lagi
      }
      timer = setTimeout(putar, 200);
    };
    putar();
  }

  await mulai();
  return () => {
    selesai = true;
    berhenti();
  };
}
