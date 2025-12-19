const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-formal',
    name: 'Formal',
    description: 'Permohonan informasi resmi (baku)',
    subject: 'Permohonan Informasi - {{nama_badan_publik}}',
    body: `Kepada
Yth. Pejabat Pengelola Data dan Informasi (PPID)
{{nama_badan_publik}}

Dengan hormat,
Saya {{pemohon}} bermaksud mengajukan permohonan informasi berikut ini:
{{pertanyaan}}

Informasi tersebut saya butuhkan untuk {{tujuan}}.
Bukti identitas berupa kartu tanda penduduk (KTP) saya lampirkan dalam email ini.

Demikian permohonan informasi ini saya ajukan, atas perhatian dan kerjasamanya saya ucapkan terima kasih.

{{tanggal}}
Salam hormat,
{{pemohon}}`
  },
  {
    id: 'tpl-akademik',
    name: 'Akademik',
    description: 'Meminta data untuk riset kampus',
    subject: 'Permintaan Data Akademik - {{nama_badan_publik}}',
    body: `Halo PPID {{nama_badan_publik}},

Perkenalkan saya {{pemohon}} dari {{asal_kampus}} prodi {{prodi}}.
Saya sedang mengerjakan riset dengan topik: {{tujuan}}.
Mohon dapat diberikan informasi berikut:
{{pertanyaan}}

Data tersebut akan digunakan untuk keperluan akademik dan tidak dipublikasikan tanpa persetujuan.
Terima kasih atas bantuannya.

{{tanggal}}
Salam hormat,
{{pemohon}}`
  },
  {
    id: 'tpl-media',
    name: 'Media',
    description: 'Klarifikasi/permintaan data untuk media',
    subject: 'Permintaan Klarifikasi - {{nama_badan_publik}}',
    body: `Yth. Humas {{nama_badan_publik}},

Saya {{pemohon}} dari {{nama_media}} sedang menyiapkan artikel terkait: {{tujuan}}.
Mohon klarifikasi atas pertanyaan berikut:
{{pertanyaan}}

Deadline klarifikasi: {{deadline}}.
Atas kerjasama dan waktunya saya ucapkan terima kasih.

{{tanggal}}
Hormat kami,
{{pemohon}}`
  }
];

export default DEFAULT_TEMPLATES;

