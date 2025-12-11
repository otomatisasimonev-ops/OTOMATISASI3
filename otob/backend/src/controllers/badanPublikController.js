const { BadanPublik, Assignment } = require('../models');

const isValidEmail = (val) => {
  if (!val) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
};

const listBadanPublik = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const dataAdmin = await BadanPublik.findAll({ order: [['created_at', 'DESC']] });
      return res.json(dataAdmin);
    }

    const assignments = await Assignment.findAll({
      where: { user_id: req.user.id },
      attributes: ['badan_publik_id']
    });
    const allowedIds = assignments.map((a) => a.badan_publik_id);

    if (allowedIds.length === 0) {
      return res.json([]);
    }

    const data = await BadanPublik.findAll({
      where: { id: allowedIds },
      order: [['created_at', 'DESC']]
    });

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil data badan publik' });
  }
};

const getBadanPublik = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await BadanPublik.findByPk(id);

    if (!data) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil data badan publik' });
  }
};

const createBadanPublik = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.nama_badan_publik || !payload.kategori || !payload.email) {
      return res.status(400).json({ message: 'Nama, kategori, dan email wajib diisi' });
    }
    if (!isValidEmail(payload.email)) {
      return res.status(400).json({ message: 'Email tidak valid' });
    }
    const existing = await BadanPublik.findOne({ where: { email: payload.email } });
    if (existing) {
      return res.status(400).json({ message: 'Email sudah terdaftar, hindari duplikasi' });
    }
    const newData = await BadanPublik.create({
      nama_badan_publik: payload.nama_badan_publik,
      kategori: payload.kategori,
      email: payload.email,
      website: payload.website,
      pertanyaan: payload.pertanyaan,
      status: payload.status || 'pending',
      sent_count: payload.sent_count || 0
    });

    return res.status(201).json(newData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal membuat data badan publik' });
  }
};

const updateBadanPublik = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const data = await BadanPublik.findByPk(id);

    if (!data) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    await data.update({
      nama_badan_publik: payload.nama_badan_publik ?? data.nama_badan_publik,
      kategori: payload.kategori ?? data.kategori,
      email: payload.email ?? data.email,
      website: payload.website ?? data.website,
      pertanyaan: payload.pertanyaan ?? data.pertanyaan,
      status: payload.status ?? data.status,
      sent_count: payload.sent_count ?? data.sent_count
    });

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memperbarui data badan publik' });
  }
};

const deleteBadanPublik = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await BadanPublik.findByPk(id);

    if (!data) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    await data.destroy();
    return res.json({ message: 'Data berhasil dihapus' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal menghapus data badan publik' });
  }
};

// Bulk import badan publik
const importBadanPublik = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Data kosong' });
    }

    // normalisasi dan filter invalid
    const cleaned = records
      .map((r) => {
        const rawEmail = r.email || r.Email || '';
        const email = isValidEmail(rawEmail) ? rawEmail : null;
        return {
          nama_badan_publik: (r.nama_badan_publik || r.Nama || r.nama || '').trim(),
          kategori: (r.kategori || r.Kategori || '').trim(),
          email,
          website: (r.website || r.Website || '').trim() || null,
          pertanyaan: (r.pertanyaan || r.Pertanyaan || '').trim() || null,
          status: (r.status || r.Status || 'pending').trim() || 'pending',
          thread_id: r.thread_id || r['Thread Id'] || r.ThreadId || null,
          sent_count: 0
        };
      })
      .filter((r) => r.nama_badan_publik && r.kategori);

    // deduplikasi by email (case-insensitive)
    const withEmail = cleaned.filter((r) => r.email);
    const withoutEmail = cleaned.filter((r) => !r.email);
    const uniqueMap = new Map();
    withEmail.forEach((row) => {
      const key = row.email.toLowerCase();
      if (!uniqueMap.has(key)) uniqueMap.set(key, row);
    });
    const uniqueEmailRows = Array.from(uniqueMap.values());

    // exclude existing emails in DB
    const { Op } = require('sequelize');
    const existing = uniqueEmailRows.length
      ? await BadanPublik.findAll({
          where: { email: { [Op.in]: uniqueEmailRows.map((r) => r.email) } },
          attributes: ['email']
        })
      : [];
    const existingSet = new Set(existing.map((e) => e.email.toLowerCase()));
    const finalWithEmail = uniqueEmailRows.filter((r) => !existingSet.has(r.email.toLowerCase()));
    const finalRows = [...withoutEmail, ...finalWithEmail];

    if (finalRows.length === 0) {
      return res.status(400).json({ message: 'Tidak ada baris valid (nama & kategori wajib). Email boleh kosong.' });
    }

    await BadanPublik.bulkCreate(finalRows);
    return res.json({
      message: `Import berhasil: ${finalRows.length} masuk, ${withEmail.length - finalWithEmail.length} duplikat email dilewati`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal import badan publik' });
  }
};

module.exports = {
  listBadanPublik,
  getBadanPublik,
  createBadanPublik,
  updateBadanPublik,
  deleteBadanPublik,
  importBadanPublik
};
