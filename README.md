# OTOMATISASI3 Monorepo

Platform otomasi permohonan informasi publik yang menggabungkan layanan backend Express + MySQL dan dashboard frontend React + Vite. Repositori ini menyajikan seluruh kode sumber, konfigurasi, dan dokumentasi lintas modul untuk mengelola badan publik, mengirim permohonan melalui email massal, serta melacak tenggat jawabannya.

## Daftar Isi
1. [Peta Repositori](#peta-repositori)
2. [Teknologi Utama](#teknologi-utama)
3. [Prasyarat & Setup Umum](#prasyarat--setup-umum)
4. [Backend `otob`](#backend-otob)
5. [Frontend `otof`](#frontend-otof)
6. [Arsitektur & Alur Data](#arsitektur--alur-data)
7. [Testing & Workflow Pengembangan](#testing--workflow-pengembangan)
8. [Dokumentasi & Artefak Tambahan](#dokumentasi--artefak-tambahan)
9. [Roadmap](#roadmap)

## Peta Repositori
```
OTOMATISASI3/
├── otob/
│   ├── backend/             # Layanan Express + Sequelize + Nodemailer
│   └── server.js            # Entry singkat agar `node server.js` tetap jalan
├── otof/
│   ├── frontend/            # Aplikasi React + Vite
│   └── docs/                # Dokumentasi spesifik frontend
├── .vscode/settings.json    # Preferensi editor
└── README.md                # Dokumen yang sedang Anda baca
```

## Teknologi Utama
| Modul    | Stack                                                   |
|----------|---------------------------------------------------------|
| Backend  | Node.js, Express, Sequelize (MySQL), Nodemailer, RSS Parser |
| Frontend | React 19, React Router DOM 7, Vite 7, TailwindCSS 3, Axios |
| Umum     | npm workstyle manual (masing-masing modul memiliki `package.json` sendiri) |

## Prasyarat & Setup Umum
- Node.js 18+ dan npm 10+.
- MySQL 8 (atau kompatibel) berjalan lokal/remote.
- Git, serta akses ke editor (VS Code disarankan).
- Akses SMTP valid untuk pengiriman email (diatur via endpoint `/config/smtp`).

### Langkah Global
1. Clone repositori ini.
2. Siapkan database MySQL dengan kredensial sesuai yang akan diisi di `.env` backend.
3. Jalankan setup masing-masing modul mengikuti bagian berikut.

## Backend `otob`
Folder: `otob/backend`

### Fitur
- **Autentikasi**: endpoint `POST /auth/login` (controller `authController`).
- **Konfigurasi SMTP**: simpan, verifikasi, dan cek status (`smtpController`, routes `/config`).
- **Manajemen badan publik**: CRUD + impor data + monitoring pengiriman (`badanPublikController`).
- **Pengiriman email**: buat template, kirim massal, simpan log beserta lampiran (`emailController`).
- **Penugasan**: assignment antar user ke badan publik + histori (`assignmentController` + `assignmentHistory` model).
- **Permintaan kuota**: ajukan/approve penambahan kuota email harian (`quotaController`).
- **Libur nasional**: CRUD daftar hari libur (`holidayController`) agar sinkron dengan kalkulasi frontend.
- **Berita/pengetahuan**: konsumsi RSS untuk menampilkan feed pada dashboard (`newsController`).

### Struktur Folder Inti
```
otob/backend/src
├── config/database.js       # Koneksi Sequelize
├── controllers/             # Logika bisnis per domain
├── middleware/              # auth & role guard
├── models/                  # Definisi Sequelize + relasi (User, BadanPublik, dll.)
├── routes/                  # Router Express per domain
├── utils/eventBus.js        # EventEmitter untuk broadcast log email (SSE)
├── seedAdmin.js             # Script pembuatan user awal
└── server.js                # Bootstrap Express
```

### Skrip npm
| Perintah     | Deskripsi                               |
|--------------|-----------------------------------------|
| `npm run dev`| Menjalankan server dengan Nodemon.       |
| `npm start`  | Menjalankan server produksi (Node).      |
| `npm run seed` | Membuat user admin default (`src/seedAdmin.js`). |

### Variabel Lingkungan (`otob/backend/.env`)
| Nama          | Deskripsi                            | Contoh        |
|---------------|--------------------------------------|---------------|
| `PORT`        | Port HTTP server                     | `5000`        |
| `DB_HOST`     | Host MySQL                           | `localhost`   |
| `DB_PORT`     | Port MySQL                           | `3306`        |
| `DB_USER`     | User database                        | `root`        |
| `DB_PASS`     | Password database                    | `secret`      |
| `DB_NAME`     | Nama database                        | `oto2_db`     |
| `DEFAULT_USER_ID` | Digunakan script seeding         | `1`           |

### Ringkasan Endpoint
| HTTP | Route                 | Controller                  | Catatan                         |
|------|-----------------------|-----------------------------|---------------------------------|
| POST | `/auth/login`         | `authController.login`      | Autentikasi dasar.              |
| POST | `/config/smtp`        | `smtpController.saveSmtpConfig` | Simpan kredensial SMTP.   |
| POST | `/config/smtp/verify` | `smtpController.verifySmtpConfig` | Uji koneksi SMTP.        |
| GET  | `/config/check`       | `smtpController.checkSmtpConfig` | Status konfigurasi user. |
| CRUD | `/badan-publik`       | `badanPublikController`     | Manajemen badan publik.        |
| POST | `/email/send`         | `emailController.sendEmails` | Kirim email massal + lampiran. |
| GET  | `/email/logs`         | `emailController.listLogs`  | Riwayat pengiriman.            |
| CRUD | `/users`              | `userController`            | Manajemen akun internal.       |
| CRUD | `/assignments`        | `assignmentController`      | Penugasan badan publik.        |
| CRUD | `/quota`              | `quotaController`           | Permintaan kuota kirim.        |
| CRUD | `/holidays`           | `holidayController`         | Daftar hari libur nasional.    |
| GET  | `/news`               | `newsController`            | Ambil feed RSS eksternal.      |

### Modul Baru: Laporan Uji Akses
Backend menyimpan laporan uji akses (6 pertanyaan rubrik 2025) lengkap dengan skor per pertanyaan + total, serta bukti dukung (gambar/pdf).

**Endpoint**
| HTTP | Route | Catatan |
|------|-------|---------|
| POST | `/api/reports` | Buat laporan (draft/submitted). |
| GET | `/api/reports/me` | List laporan milik user login. |
| GET | `/api/reports/:id` | Detail laporan (user hanya miliknya; admin boleh semua). |
| PATCH | `/api/reports/:id` | Update draft (jawaban + total otomatis). |
| PATCH | `/api/reports/:id/submit` | Submit laporan (lock: read-only). |
| POST | `/api/reports/:id/upload` | Upload bukti per pertanyaan (multipart). |
| GET | `/api/admin/reports` | List semua laporan (admin-only, filter/sort/search). |
| GET | `/api/admin/reports/:id` | Detail laporan (admin-only). |

**Contoh payload create (draft)**
```json
{
  "badanPublikId": 1,
  "status": "draft",
  "answers": {
    "q1": { "optionKey": "form_online_tanpa_registrasi", "catatan": "" },
    "q2": { "optionKey": "tanpa_syarat_tambahan", "catatan": "" },
    "q3": { "optionKey": "1x24_jam", "catatan": "" },
    "q4": { "optionKey": "1_10_hari_kerja", "catatan": "" },
    "q5": { "optionKey": "diberikan_lengkap_sesuai", "catatan": "" },
    "q6": { "optionKey": "ya", "catatan": "" }
  }
}
```

**Upload bukti (multipart)**
- Field: `questionKey` (mis. `q1`) dan `files` (bisa multiple), `accept`: `image/*` atau `application/pdf`.
- File akan dapat diakses via URL `GET /uploads/...`.

**Membuat tabel (opsional)**
- Project saat ini memakai `sequelize.sync({ alter: true })` sehingga tabel baru otomatis dibuat saat server start.
- Jika ingin membuat tabel via script: `cd otob/backend && npm run migrate:uji-akses`.

> Detail implementasi setiap controller dapat dilihat pada `otob/backend/src/controllers/*.js`.

## Frontend `otof`
Folder: `otof/frontend`

### Fitur
- **Dashboard utama** (`src/pages/Dashboard.jsx`): metrik pengiriman, filter global, log aktivitas.
- **Daftar badan publik** (`BadanPublik.jsx`): CRUD, impor, pencarian lanjutan.
- **Penugasan petugas** (`Penugasan.jsx`): mapping user ↔ badan publik.
- **Template editor** (`TemplateEditor.jsx`): menyusun konten email dan lampiran.
- **Riwayat & kuota** (`HistoryLog.jsx`, `AddUser.jsx`, `Settings.jsx`) termasuk pengaturan SMTP melalui `SmtpModal`.
- **Kalender hari libur** (`HolidayCalendar.jsx`): sinkron dengan data backend.
- **Komponen `RecipientTable`** (`src/components/dashboard/RecipientTable.jsx`): seleksi massal, filter, indikator tenggat dengan utilitas `workdays.js`.

### Struktur Folder Inti
```
otof/frontend/src
├── components/
│   ├── Layout.jsx, Navbar.jsx, Sidebar.jsx, ProtectedRoute.jsx
│   └── dashboard/RecipientTable.jsx
├── pages/                  # Halaman dashboard, login, settings, dsb.
├── services/               # Wrapper Axios untuk API backend
├── utils/                  # workdays.js, helper lainnya
├── context/                # Auth/context global
├── constants/              # Pilihan dropdown, dsb.
├── App.jsx & main.jsx      # Entry React Router
└── assets/ & styles        # CSS/Tailwind
```

### Skrip npm
| Perintah        | Deskripsi                                    |
|-----------------|----------------------------------------------|
| `npm run dev`   | Menyalakan Vite dev server di port 5173.     |
| `npm run start` | Alias ke `npm run dev`.                      |
| `npm run build` | Build produksi ke folder `dist/`.            |
| `npm run preview` | Preview hasil build lokal.                |
| `npm run lint`  | ESLint dengan aturan React Hooks/Refresh.    |

### Variabel Lingkungan (`otof/frontend/.env`)
| Nama           | Deskripsi                         | Contoh                  |
|----------------|-----------------------------------|--------------------------|
| `VITE_API_URL` | Base URL API backend (HTTP/HTTPS) | `http://localhost:5000` |

### Tampilan
Sertakan tangkapan layar dashboard pada `otof/frontend/public/dashboard-preview.png`. Berkas tersebut otomatis digunakan di README frontend (`otof/frontend/README.md`) dan dapat pula direferensikan dalam dokumentasi lain.

## Arsitektur & Alur Data
```
Pengguna
  ↓ (browser)
Frontend React (Vite, Tailwind, Axios)
  ↓ REST API (Bearer token)
Backend Express (auth, pengiriman email, assignment, quota, holiday, news)
  ↓
MySQL (Sequelize models) ── Nodemailer ── SMTP Provider
  ↓
Event Bus (SSE/log)  ──> Dashboard Monitoring
```

- Frontend mengandalkan context auth + ProtectedRoute untuk menjaga akses.
- Semua perhitungan tenggat dilakukan konsisten antara frontend (`workdays.js`) dan data libur backend (`holidayController`).
- Email massal memanfaatkan limit 25 MB payload JSON (lihat `express.json({ limit: '25mb' })` pada backend).

## Testing & Workflow Pengembangan
1. **Linting frontend**: jalankan `npm run lint` sebelum commit.
2. **Backend**: saat ini belum ada suite test otomatis; disarankan menambah Jest/Supertest untuk controller penting.
3. **Environment parity**: gunakan `.env.example` di kedua modul sebagai baseline.
4. **Menjalankan keduanya sekaligus**:
   ```bash
   # Terminal 1
   cd otob/backend && npm run dev
   # Terminal 2
   cd otof/frontend && npm run dev
   ```
5. **Seed data**: gunakan `npm run seed` di backend untuk membuat admin awal lalu login melalui frontend `Login.jsx`.

## Dokumentasi & Artefak Tambahan
- `otof/frontend/README.md`: manual lengkap UI, logika `RecipientTable`, dan tips styling.
- `otof/docs/README.md`: dokumentasi tingkat proyek frontend (struktur, alur kerja).
- Tambahkan dokumentasi backend spesifik (mis. ERD, diagram sequence) di `otob/` atau `docs/` sesuai kebutuhan.

## Roadmap
1. Tambahkan README khusus backend yang memuat detail endpoint, contoh payload, dan ER diagram.
2. Menulis automated test (Jest/Supertest untuk backend, React Testing Library untuk frontend).
3. Mengimplementasikan pagination/virtual scroll di `RecipientTable` guna menangani data besar.
4. Menambah modul scheduler di backend untuk pengiriman otomatis berbasis jadwal.
5. Menyusun pipeline CI/CD (lint + build + test) untuk kedua modul.
6. Dokumentasikan proses deployment (Docker/PM2 untuk backend, static hosting untuk frontend).
