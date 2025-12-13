const QUESTIONS = [
  {
    key: 'q1',
    section: 'A. Kemudahan Cara',
    text: 'Apakah badan publik menyediakan form permohonan informasi dan keberatan secara online di website?',
    options: [
      { key: 'form_online_tanpa_registrasi', label: 'Form online tanpa registrasi', score: 15 },
      { key: 'fitur_digital_selain_form', label: 'Fitur digital selain form (email/WA/dsb)', score: 10 },
      { key: 'form_online_harus_registrasi', label: 'Form online harus registrasi', score: 7 },
      { key: 'harus_unduh_form_permohonan', label: 'Harus unduh form permohonan', score: 5 },
      { key: 'tidak_ada_permohonan_online', label: 'Tidak ada/tidak melayani permohonan online', score: 0 }
    ]
  },
  {
    key: 'q2',
    section: 'A. Kemudahan Cara',
    text: 'Apakah Badan publik memberlakukan syarat permohonan informasi sesuai regulasi: 1) Nama pemohon 2) Bukti identitas (KTP/Akta Badan Hukum) 3) Tujuan permohonan informasi.',
    options: [
      { key: 'tanpa_syarat_tambahan', label: 'Tanpa syarat tambahan', score: 15 },
      { key: 'tambah_1_syarat', label: 'Tambah 1 syarat', score: 10 },
      { key: 'tambah_2_syarat', label: 'Tambah 2 syarat', score: 5 },
      { key: 'tambah_lebih_2_syarat', label: 'Tambah >2 syarat', score: 1 }
    ]
  },
  {
    key: 'q3',
    section: 'B. Ketepatan Waktu',
    text: 'Apakah badan publik memberi respons awal atas permohonan informasi',
    options: [
      { key: '1x24_jam', label: '1x24 jam', score: 7 },
      { key: '2x24_jam', label: '2x24 jam', score: 5 },
      { key: '3x24_jam', label: '3x24 jam', score: 3 },
      { key: '4x24_jam', label: '4x24 jam', score: 2 },
      { key: '5x24_jam_lebih', label: '5x24 jam/lebih', score: 1 },
      { key: 'tidak_merespon', label: 'Tidak merespon', score: 0 }
    ]
  },
  {
    key: 'q4',
    section: 'B. Ketepatan Waktu',
    text: 'Apakah informasi diberikan tidak lebih dari 10 hari kerja + 7 hari kerja?',
    options: [
      { key: '1_10_hari_kerja', label: '1–10 hari kerja', score: 20 },
      { key: '11_17_hari_kerja', label: '11–17 hari kerja', score: 10 },
      { key: '18_hari_lebih_atau_tidak_diberikan', label: '18 hari kerja/lebih atau tidak diberikan', score: 0 }
    ]
  },
  {
    key: 'q5',
    section: 'C. Akurasi & Kelengkapan',
    text: 'Apakah Informasi yang diberikan lengkap dan sesuai yang diminta oleh pemohon?',
    options: [
      { key: 'diberikan_lengkap_sesuai', label: 'Informasi diberikan: lengkap & sesuai', score: 30 },
      { key: 'diberikan_sesuai_tidak_lengkap', label: 'Informasi diberikan: sesuai tapi tidak lengkap', score: 15 },
      { key: 'diberikan_tidak_sesuai', label: 'Informasi diberikan: tidak sesuai', score: 0 },
      {
        key: 'tidak_diberikan_tidak_dikuasai_ada_bukti_dan_mengarahkan',
        label: 'Informasi tidak diberikan karena alasan tidak dikuasai: Ada bukti “tidak dikuasai” DAN mengarahkan ke BP yang menguasai',
        score: 30
      },
      {
        key: 'tidak_diberikan_tidak_dikuasai_tidak_ada_bukti_tapi_mengarahkan',
        label: 'Informasi tidak diberikan karena alasan tidak dikuasai: Tidak ada bukti “tidak dikuasai” TAPI mengarahkan',
        score: 15
      },
      {
        key: 'tidak_diberikan_tidak_dikuasai_ada_bukti_tapi_tidak_mengarahkan',
        label: 'Informasi tidak diberikan karena alasan tidak dikuasai: Ada bukti “tidak dikuasai” TAPI tidak mengarahkan',
        score: 15
      },
      {
        key: 'tidak_diberikan_tidak_dikuasai_tidak_ada_bukti_dan_tidak_mengarahkan',
        label: 'Informasi tidak diberikan karena alasan tidak dikuasai: Tidak ada bukti dan tidak mengarahkan',
        score: 0
      },
      {
        key: 'tidak_diberikan_dikecualikan_sk_dik_berlaku_update',
        label: 'Informasi tidak diberikan karena alasan dikecualikan: Melampirkan SK DIK berlaku & update',
        score: 30
      },
      {
        key: 'tidak_diberikan_dikecualikan_sk_dik_expired',
        label: 'Informasi tidak diberikan karena alasan dikecualikan: Melampirkan SK DIK expired',
        score: 10
      },
      {
        key: 'tidak_diberikan_dikecualikan_tanpa_sk_dik',
        label: 'Informasi tidak diberikan karena alasan dikecualikan: Tidak diberikan tanpa SK DIK',
        score: 0
      },
      {
        key: 'tidak_diberikan_tanpa_alasan',
        label: 'Informasi tidak diberikan tanpa alasan/ alasan lain',
        score: 0
      }
    ]
  },
  {
    key: 'q6',
    section: 'D. Keramahan',
    text: 'Apakah layanan badan publik menerapkan prinsip keramahan?',
    options: [
      { key: 'ya', label: 'Ya', score: 7 },
      { key: 'tidak', label: 'Tidak', score: 0 }
    ]
  },
  {
    key: 'q7',
    section: 'Mekanisme Feedback',
    text: 'Apakah badan publik menyediakan fasilitas penilaian atas layanan informasi yang diberikan?',
    options: [
      { key: 'tersedia_hasil_diumumkan', label: 'Tersedia & hasilnya diumumkan', score: 6 },
      { key: 'tersedia_hasil_tidak_diumumkan', label: 'Tersedia, hasil tidak diumumkan', score: 3 },
      { key: 'tidak_tersedia', label: 'Tidak tersedia', score: 0 }
    ]
  }
];

const buildOptionScoreMap = () => {
  const map = new Map();
  for (const q of QUESTIONS) {
    const qMap = new Map();
    for (const opt of q.options) qMap.set(opt.key, opt.score);
    map.set(q.key, qMap);
  }
  return map;
};

const OPTION_SCORE_MAP = buildOptionScoreMap();

const looksLikeCharMap = (val) => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const keys = Object.keys(val);
  if (keys.length === 0) return false;
  return keys.every((key, idx) => key === String(idx) && typeof val[key] === 'string' && val[key].length === 1);
};

const decodeCharMap = (val) => {
  try {
    const sortedKeys = Object.keys(val)
      .map((k) => Number(k))
      .sort((a, b) => a - b);
    const combined = sortedKeys.map((k) => val[String(k)]).join('');
    const parsed = JSON.parse(combined);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
};

const normalizeMaybeJson = (val) => {
  if (!val) return {};
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }
  if (typeof val === 'object') {
    if (looksLikeCharMap(val)) {
      return decodeCharMap(val);
    }
    return val;
  }
  return {};
};

const computeAnswersAndTotal = (inputAnswers = {}) => {
  const normalizedInput = normalizeMaybeJson(inputAnswers);
  const computedAnswers = {};
  let total = 0;

  for (const q of QUESTIONS) {
    const raw = normalizedInput?.[q.key] || {};
    const optionKey = raw.optionKey || raw.option_key || null;
    const note = raw.catatan ?? raw.note ?? null;
    const score = optionKey && OPTION_SCORE_MAP.get(q.key)?.has(optionKey) ? OPTION_SCORE_MAP.get(q.key).get(optionKey) : 0;

    computedAnswers[q.key] = {
      optionKey: optionKey || null,
      score,
      catatan: note ? String(note).slice(0, 2000) : null
    };
    total += score;
  }

  return { answers: computedAnswers, totalSkor: total };
};

const validateSubmittedAnswers = (answers = {}) => {
  const normalized = normalizeMaybeJson(answers);
  const missing = [];
  for (const q of QUESTIONS) {
    const opt = normalized?.[q.key]?.optionKey;
    if (!opt) missing.push(q.key);
  }
  return missing;
};

module.exports = {
  QUESTIONS,
  computeAnswersAndTotal,
  validateSubmittedAnswers,
  normalizeMaybeJson
};
