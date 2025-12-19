# OTOF Frontend

Antarmuka React + Vite untuk mengotomasi pengiriman permohonan informasi publik. Fokus utama aplikasi adalah manajemen daftar badan publik, pemilihan penerima secara massal, dan pemantauan tenggat jawaban berbasis hari kerja.

## Daftar Isi
1. [Fitur Utama](#fitur-utama)
2. [Teknologi & Dependensi](#teknologi--dependensi)
3. [Arsitektur & Alur Data](#arsitektur--alur-data)
4. [Struktur Direktori](#struktur-direktori)
5. [Instalasi & Menjalankan Aplikasi](#instalasi--menjalankan-aplikasi)
6. [Skrip NPM](#skrip-npm)
7. [Variabel Lingkungan](#variabel-lingkungan)
8. [Detail Komponen](#detail-komponen)
9. [Utilitas Hari Kerja](#utilitas-hari-kerja)
10. [Tampilan Aplikasi](#tampilan-aplikasi)
11. [Testing & Kualitas Kode](#testing--kualitas-kode)
12. [Tips Pengembangan](#tips-pengembangan)
13. [Rencana Pengembangan Selanjutnya](#rencana-pengembangan-selanjutnya)

## Fitur Utama
- **Tabel dinamis**: `RecipientTable` menampilkan nama badan, kategori, email, pertanyaan, jumlah pengiriman, dan tenggat.
- **Filter multi-kriteria**: pencarian teks bebas, filter kategori, dan filter status pengiriman.
- **Seleksi massal**: tombol “Pilih sesuai filter”, “Hapus pilihan”, dan “Pilih semua” yang otomatis menonaktifkan penerima dengan email tidak valid.
- **Pemantauan tenggat**: tanggal kirim dan jatuh tempo dihitung otomatis berdasarkan hari kerja dengan penyesuaian hari libur serta opsi tambahan hari.
- **Validasi email inline**: email kosong atau tidak valid ditandai dengan gaya visual berbeda dan tidak dapat dicentang.
- **Fondasi ekspor**: dependensi `xlsx` dan `jspdf` siap dipakai untuk ekspor Excel/PDF dari data tabel.
- **Styling konsisten**: TailwindCSS + PostCSS untuk tema warna primary dan slate yang rapi.

## Teknologi & Dependensi
- **Runtime & bundler**: Node.js 18+, Vite 7 (Fast Refresh, strict port 5173).
- **UI**: React 19, React Router DOM 7, TailwindCSS 3.
- **HTTP & data**: Axios untuk request API, `xlsx` & `jspdf` untuk ekspor data.
- **Quality gate**: ESLint 9 dengan plugin React Hooks dan React Refresh.

## Arsitektur & Alur Data
1. **Data badan publik** diambil dari backend berdasarkan `VITE_API_URL`.
2. **State filter dan selection** dikelola di komponen induk dashboard lalu dioper ke `RecipientTable` melalui props.
3. **`monitoringMap`** menyimpan metadata per badan (tanggal kirim, flag hari ekstra).
4. **Utility `workdays.js`** menghitung tanggal jatuh tempo berdasarkan `startDate`, jumlah hari dasar (10), tambahan hari (jika ada), dan daftar hari libur.
5. **Render tabel** menampilkan status terkini, menonaktifkan baris dengan email invalid, serta memberikan highlight merah pada tenggat yang lewat.
6. **Ekspor (opsional)** dapat memanfaatkan data `badan` yang sama untuk menghasilkan file XLSX/PDF di masa depan.

## Struktur Direktori
```
otof/frontend/
├── public/                      # aset statis & ikon
├── src/
│   ├── components/
│   │   └── dashboard/
│   │       └── RecipientTable.jsx
│   ├── utils/
│   │   └── workdays.js
│   ├── App.jsx, main.jsx        # entry React
│   ├── styles/                  # konfigurasi Tailwind bila diperlukan
│   └── assets/                  # gambar tambahan
├── .env.example
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## Instalasi & Menjalankan Aplikasi
1. `cd otof/frontend`
2. Salin variabel lingkungan: `cp .env.example .env`
3. Ubah `VITE_API_URL` pada `.env` sesuai alamat backend
4. `npm install`
5. Jalankan dev server: `npm run dev` lalu buka `http://localhost:5173`
6. Build produksi: `npm run build` (output `dist/`)
7. Preview hasil build: `npm run preview`

## Skrip NPM
| Perintah        | Deskripsi                                              |
|-----------------|--------------------------------------------------------|
| `npm run dev`   | Menjalankan Vite HMR di port 5173 (strict).            |
| `npm run start` | Alias ke `dev`.                                        |
| `npm run build` | Build produksi ke `dist/`.                             |
| `npm run preview` | Preview server untuk hasil build.                   |
| `npm run lint`  | Menjalankan ESLint pada seluruh source.                |

## Variabel Lingkungan
| Nama           | Deskripsi                                   | Default                 |
|----------------|---------------------------------------------|-------------------------|
| `VITE_API_URL` | Base URL API backend yang digunakan Axios.  | `http://localhost:5000` |

## Detail Komponen
### `RecipientTable.jsx`
- **Props inti**: `badan`, `selectedIds`, `toggleAll`, `toggleSelect`, `selectFiltered`, `clearSelection`, `filterText`, `filterKategori`, `filterStatus`, `categories`, `statuses`, `holidays`, `monitoringMap`, `onUpdateMonitoring`.
- **Validasi email**: fungsi `isValidEmail` memastikan checkbox dan interaksi hanya aktif untuk email valid.
- **Filter**: input teks dan dua dropdown (kategori/status) disusun dalam grid responsif (`grid-cols-1 md:grid-cols-3`).
- **Aksi seleksi**: tiga tombol aksi memanggil handler yang dikirim dari komponen induk, sehingga logika pemilihan tetap terpusat.
- **Kolom tenggat**: menampilkan tanggal kirim, tanggal jatuh tempo (`dueDateLabel`), dan jumlah hari tersisa (`daysLeft`). Warna teks berubah menjadi merah (`text-rose-600`) ketika `dueInfo.overdue === true`.
- **Truncate pertanyaan**: helper `truncateQuestion` menjaga kolom pertanyaan tetap rapi dengan batas 64 karakter.

Contoh logika tenggat:
```js
const dueInfo = computeDueInfo({
  startDate,
  baseDays: 10,
  extraDays: monitor.extraDays ? 7 : 0,
  holidays: holidayList
});

return (
  <span className={dueInfo.overdue ? 'text-rose-600' : 'text-slate-600'}>
    {dueInfo.dueDateLabel || '-'} ({dueInfo.daysLeft ?? '-'} hari)
  </span>
);
```

### Tombol Aksi & Validasi
- `selectFiltered`: memilih semua baris yang lolos filter aktif.
- `clearSelection`: menghapus seluruh pilihan.
- `toggleAll`: memilih semua baris valid atau membatalkan pilihan sekaligus.
- Checkbox disabled ketika `isValidEmail(item.email)` bernilai false agar tidak ada pengiriman ke alamat kosong/tidak valid.

## Utilitas Hari Kerja
`src/utils/workdays.js`
- `toISODate(date)`: mengubah objek `Date` menjadi string `YYYY-MM-DD`.
- `addBusinessDays(startDate, days, holidays)`: menambahkan hari kerja dengan melewati akhir pekan dan tanggal libur (format `{ date: 'YYYY-MM-DD' }`).
- `computeDueInfo({ startDate, baseDays, extraDays, holidays })`: menghasilkan objek `{ dueDate, dueDateLabel, daysLeft, overdue }` yang digunakan oleh UI.

## Tampilan Aplikasi
![Dashboard Preview](public/dashboard-preview.png)

> Simpan tangkapan layar UI terbaru di `public/dashboard-preview.png`. Contoh konten screenshot:
> - Baris filter dengan input pencarian dan dropdown kategori/status.
> - Tabel penerima dengan kolom checkbox, Nama, Kategori, Email, Pertanyaan, Sent, dan Tenggat.
> - Panel tenggat di kolom kanan menampilkan tanggal kirim, jatuh tempo, dan jumlah hari tersisa (merah jika overdue).
>
> Jika belum ada screenshot:
> 1. Jalankan `npm run dev`.
> 2. Siapkan data contoh pada backend.
> 3. Ambil screenshot dashboard di browser lalu simpan sebagai `public/dashboard-preview.png`.

## Testing & Kualitas Kode
- Jalankan `npm run lint` sebelum commit untuk memastikan aturan React Hooks/Refresh terpenuhi.
- Pengujian manual yang disarankan:
  - Filter teks/kategori/status mengubah daftar sesuai harapan.
  - Checkbox hanya muncul aktif pada email valid.
  - Kolom tenggat memperbarui `daysLeft` ketika tanggal kirim berubah.
  - Pastikan tidak ada error peringatan React di console browser.

## Tips Pengembangan
- Tambahkan daftar hari libur nasional/regional ke prop `holidays` agar tenggat akurat.
- Simpan definisi kategori/status di konstanta terpusat (`src/constants`) bila variasinya semakin banyak.
- Manfaatkan `truncateQuestion` atau utility serupa saat menambah kolom teks panjang untuk menjaga layout tabel.
- Dokumentasikan endpoint backend (mis. `/api/badan`) di repo server agar kontrak data jelas bagi semua kontributor.

## Rencana Pengembangan Selanjutnya
1. **Ringkasan monitoring** di atas tabel (jumlah overdue, due soon, selesai).
2. **Tombol ekspor** langsung di UI memanfaatkan `xlsx`/`jspdf`.
3. **Pagination atau virtualized list** untuk menangani data besar.
4. **Integrasi notifikasi** (email/SMS) berdasarkan status `monitoringMap`.
