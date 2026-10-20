/**
 * ==============================================================================
 * CAMERA & SELFIE COMPRESSOR MODULE
 * ==============================================================================
 */

export class CameraManager {
  constructor(videoElement, previewElement, canvasElement = null) {
    this.video = videoElement;
    this.preview = previewElement;
    this.canvas = canvasElement || document.createElement('canvas');
    this.stream = null;
    this.facingMode = 'user'; // 'user' (depan) atau 'environment' (belakang)
    this.currentSelfieData = '';
  }

  // Mulai streaming kamera live
  async startCamera() {
    this.stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('getUserMedia tidak didukung oleh browser ini.');
      return false;
    }

    try {
      const constraints = {
        video: {
          facingMode: this.facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
        this.video.style.display = 'block';
        if (this.preview) this.preview.style.display = 'none';
        return true;
      }
    } catch (err) {
      console.warn('Gagal membuka kamera:', err.name, err.message);
      return false;
    }
    return false;
  }

  // Matikan stream kamera
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  // Ganti kamera depan / belakang
  async toggleFacingMode() {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    return await this.startCamera();
  }

  // Ambil foto snapshot dari video feed
  takeSnapshot() {
    if (!this.video || !this.stream) return null;

    const vw = this.video.videoWidth || 640;
    const vh = this.video.videoHeight || 480;

    // Tentukan ukuran maksimal agar file ringan untuk Google Sheets (~25KB)
    const maxDimension = 480;
    let targetWidth = vw;
    let targetHeight = vh;

    if (vw > maxDimension || vh > maxDimension) {
      if (vw > vh) {
        targetWidth = maxDimension;
        targetHeight = Math.round((vh / vw) * maxDimension);
      } else {
        targetHeight = maxDimension;
        targetWidth = Math.round((vw / vh) * maxDimension);
      }
    }

    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
    const ctx = this.canvas.getContext('2d');

    // Jika kamera depan, cerminkan kembali agar hasil foto natural
    if (this.facingMode === 'user') {
      ctx.translate(targetWidth, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(this.video, 0, 0, targetWidth, targetHeight);

    // Kompresi ke format JPEG 0.72 quality
    const compressedData = this.canvas.toDataURL('image/jpeg', 0.72);
    this.currentSelfieData = compressedData;

    // Tampilkan di preview dan matikan kamera untuk hemat baterai
    if (this.preview) {
      this.preview.src = compressedData;
      this.preview.style.display = 'block';
      this.video.style.display = 'none';
    }
    this.stopCamera();

    return compressedData;
  }

  // Kompres file gambar dari input file (fallback)
  compressFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('File bukan gambar'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 480;
          let w = img.width;
          let h = img.height;

          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h / w) * maxDim);
              w = maxDim;
            } else {
              w = Math.round((w / h) * maxDim);
              h = maxDim;
            }
          }

          this.canvas.width = w;
          this.canvas.height = h;
          const ctx = this.canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          const compressed = this.canvas.toDataURL('image/jpeg', 0.72);
          this.currentSelfieData = compressed;

          if (this.preview) {
            this.preview.src = compressed;
            this.preview.style.display = 'block';
            if (this.video) this.video.style.display = 'none';
          }
          this.stopCamera();

          resolve(compressed);
        };
        img.onerror = () => reject(new Error('Gagal memuat gambar'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsDataURL(file);
    });
  }

  // Reset selfie
  clear() {
    this.currentSelfieData = '';
    if (this.preview) {
      this.preview.src = '';
      this.preview.style.display = 'none';
    }
    this.stopCamera();
  }
}
