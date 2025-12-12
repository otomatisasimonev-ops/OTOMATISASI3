# Dokumentasi Proyek OTOF

Repositori ini menyimpan kode sumber otomasi permohonan informasi publik. Saat ini fokus utamanya adalah aplikasi frontend berbasis React + Vite, namun struktur disiapkan agar modul lain (backend, automations) bisa ditambahkan kemudian.

## Ikhtisar
- **Tujuan**: memberikan antarmuka pengelolaan badan publik, pemilihan penerima permohonan secara massal, dan pemantauan tenggat jawaban berdasarkan hari kerja.
- **Teknologi inti**: React 19, Vite 7, TailwindCSS 3, Axios, serta utilitas perhitungan hari kerja kustom.
- **Status**: modul frontend sudah tersedia penuh; modul lain masih placeholder.

## Struktur Direktori
```
otof/
├── frontend/        # Aplikasi React + Vite (lihat README khusus di folder ini)
├── docs/            # Dokumentasi tingkat proyek (folder ini)
└── README.root.md   # (opsional) catatan tambahan bila dibutuhkan
```

### Rincian Folder
- `frontend/`: sumber kode UI (komponen, utilitas, konfigurasi build). Panduan lengkap ada di `frontend/README.md`.
- `docs/`: tempat dokumentasi tingkat proyek, diagram, roadmap lintas modul.

## Menjalankan Proyek
1. Pastikan Node.js ≥ 18 dan npm ≥ 10 terpasang.
2. Masuk ke modul yang ingin dijalankan. Untuk frontend:
   ```bash
   cd frontend
   cp .env.example .env   # isi VITE_API_URL sesuai backend
   npm install
   npm run dev
   ```
3. Jalankan perintah lain (build, lint, preview) sesuai petunjuk di README modul masing-masing.

## Dependensi Lintas Modul
- **Frontend**: React, React Router DOM, Axios, TailwindCSS, ESLint.
- **Rencana backend/otomasi**: belum tersedia di repo ini, namun README ini menyiapkan ruang untuk dokumentasi jika modul baru ditambahkan.

## Diagram Alur (Konseptual)
```
Pengguna → Frontend (React) → Axios → Backend API → Database/Service lain
                                  ↓
                         Workdays utils
                         (hitung tenggat)
```

## Tampilan
![Dashboard Preview](../frontend/public/dashboard-preview.png)

> Simpan tangkapan layar terbaru UI di `frontend/public/dashboard-preview.png`. Jika file belum ada, ikuti langkah pada README frontend untuk membuatnya sehingga gambar dapat tampil juga di dokumentasi tingkat proyek ini.

## Kaitan dengan README Frontend
README detail di `frontend/README.md` mencakup:
- Penjelasan mendalam `RecipientTable`, logika filter, dan utilitas hari kerja.
- Instruksi build, lint, preview, serta tips pengembangan.
- Rencana pengembangan lanjutan khusus UI.

Pastikan selalu merujuk ke README tersebut ketika mengerjakan modul frontend.

## Roadmap Tingkat Proyek
1. **Tambahkan backend** (mis. folder `backend/`) untuk menangani API pengiriman permohonan.
2. **Integrasi otomasi** pengiriman email/SMS berbasis scheduler.
3. **Sinkronisasi dokumentasi** antara README ini, README frontend, dan dokumentasi backend.
4. **CI/CD**: tambahkan pipeline lint/build/test otomatis ketika modul backend tersedia.

## Kontribusi & Catatan
- Ikuti standar penamaan branch/commit internal.
- Jalankan lint/test sesuai modul sebelum push.
- Dokumentasikan setiap modul baru di dalam folder `docs/` ini agar arsitektur tetap jelas.
