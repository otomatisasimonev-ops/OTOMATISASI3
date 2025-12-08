const { BadanPublik } = require('../models');

const listBadanPublik = async (req, res) => {
  try {
    const data = await BadanPublik.findAll({ order: [['created_at', 'DESC']] });
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

module.exports = {
  listBadanPublik,
  getBadanPublik,
  createBadanPublik,
  updateBadanPublik,
  deleteBadanPublik
};
