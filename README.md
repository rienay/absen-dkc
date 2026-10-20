# ⚜️ BANGKIT WIJAYAKUSUMA — Sistem Keanggotaan & Presensi DKC Cilacap

Aplikasi web modern untuk manajemen keanggotaan dan presensi kehadiran sanggar bakti **Dewan Kerja Pramuka Penegak dan Pandega Kwartir Cabang Cilacap**.

Sistem ini telah dimodernisasi total dengan:
- 🟢 **Database Real-Time Google Sheets**: Menggunakan Google Apps Script API tanpa biaya server.
- ⚡ **Siap Deploy ke Vercel**: Dilengkapi konfigurasi `vercel.json` dan API serverless.
- 📸 **Kamera Selfie Langsung**: Viewfinder kamera depan/belakang dan kompresi otomatis foto kehadiran.
- 🏆 **Leaderboard & Rekap Bulanan**: Peringkat keaktifan kehadiran anggota secara otomatis dengan medali emas, perak, dan perunggu.
- 🔒 **Akses Administrator Aman**: Perlindungan menu Data Anggota dan Pengaturan dengan PIN (Default: `1101`).
- 📱 **Desain Responsif & Cepat**: Optimal diakses melalui smartphone Android/iOS maupun desktop.

---

## 🚀 Cara Menjalankan di Komputer Lokal

Pastikan [Node.js](https://nodejs.org) sudah terpasang di komputer Anda.

```bash
# 1. Masuk ke direktori proyek
cd "d:\dkcc\absen dkc"

# 2. Jalankan server development
npm run dev
```

Buka browser dan akses alamat: `http://localhost:3000`

---

## 📊 Langkah Menghubungkan Google Sheets sebagai Database (3 Menit)

1. Buka [Google Sheets](https://sheets.google.com) dan buat spreadsheet baru.
   - Beri nama misalnya: `Database Presensi DKC Cilacap`.
2. Klik menu **Ekstensi (Extensions)** ➔ **Apps Script**.
3. Hapus seluruh isi kode bawaan di editor.
4. Buka file [`google-apps-script.js`](./google-apps-script.js) di folder proyek ini, lalu salin (copy) dan tempel (paste) seluruh kodenya ke editor Apps Script.
5. Klik ikon **Simpan (Save)** (ikon disket).
6. Klik tombol biru **Terapkan (Deploy)** di pojok kanan atas ➔ pilih **Penerapan baru (New deployment)**.
7. Pilih jenis: **Aplikasi Web (Web App)** (ikon gerigi di sebelah kiri).
8. Konfigurasi:
   - **Deskripsi**: `API Presensi DKC Cilacap v2`
   - **Jalankan sebagai (Execute as)**: `Saya (akun Google Anda)`
   - **Siapa yang memiliki akses (Who has access)**: **`Siapa saja (Anyone)`** *(Wajib agar aplikasi dapat mengirim dan membaca data)*
9. Klik tombol **Terapkan (Deploy)**.
10. Setujui izin akses akun Google Anda (*Authorize access*).
11. Salin **URL Aplikasi Web (Web App URL)** yang berakhiran `/exec`.
12. Buka aplikasi web Presensi DKC ➔ masuk ke menu **🔒 Database & Sheets** ➔ tempelkan URL tersebut ke kolom **URL Web App Google Apps Script** ➔ klik **Simpan & Hubungkan**.

> ✨ **Catatan:** Lembar kerja `Anggota` dan `Presensi` beserta judul kolom akan otomatis dibuatkan oleh script di Google Spreadsheet Anda!

---

## ☁️ Cara Deploy ke Vercel

### Metode 1: Menggunakan Vercel Dashboard (Rekomendasi)
1. Unggah (push) folder proyek ini ke repositori akun GitHub Anda:
   ```bash
   git init
   git add .
   git commit -m "feat: Sistem Presensi DKC Cilacap Real-Time"
   git branch -M main
   git remote add origin https://github.com/<username-anda>/<nama-repo>.git
   git push -u origin main
   ```
2. Buka [vercel.com](https://vercel.com) dan login.
3. Klik **Add New Project** ➔ pilih repositori GitHub Anda.
4. Vercel akan otomatis mendeteksi konfigurasi Vite (`npm run build`, output `dist`).
5. Klik tombol **Deploy**.
6. Selesai! Web aplikasi Anda sudah online dan dapat diakses publik oleh seluruh anggota DKC melalui tautan Vercel.

### Metode 2: Menggunakan Vercel CLI
```bash
# Pasang Vercel CLI jika belum ada
npm i -g vercel

# Deploy langsung dari terminal
vercel
```

---

## 🗂️ Struktur File Proyek

```
absen dkc/
├── api/
│   └── sheets.js              # Vercel Serverless Function Proxy
├── assets/
│   └── logo.png               # Logo resmi DKC Cilacap
├── css/
│   └── style.css              # Sistem desain, warna Pramuka, dan layout responsif
├── js/
│   ├── analytics.js           # Perhitungan metrik, kuota, dan peringkat leaderboard
│   ├── app.js                 # Kontroler utama aplikasi, validasi form, dan UI
│   ├── camera.js              # Pengelola kamera live dan kompresi canvas JPEG
│   ├── sheets.js              # Klien integrasi dua arah Google Sheets API
│   └── storage.js             # Pengelola penyimpanan lokal & data awal (seed)
├── google-apps-script.js      # Backend script untuk Google Spreadsheet
├── index.html                 # Halaman utama aplikasi web
├── package.json               # Konfigurasi dependensi dan script npm
├── vercel.json                # Konfigurasi deployment Vercel
├── vite.config.js             # Konfigurasi bundler Vite
└── README.md                  # Dokumentasi proyek
```

---

## 🔐 Akun & Hak Akses
- **Password Default Admin**: `1101`
- Digunakan untuk membuka tab **Data Anggota** dan **Pengaturan & Database**.
- Password dapat diubah sewaktu-waktu melalui tombol **Ubah Password Admin** di menu Pengaturan.

---
*Kwartir Cabang Gerakan Pramuka Cilacap · Dewan Kerja Pramuka Penegak dan Pandega*
