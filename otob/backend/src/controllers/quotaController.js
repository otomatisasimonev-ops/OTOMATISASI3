import { User, QuotaRequest } from '../models';
import { Op } from 'sequelize';

const resetIfNeeded = async (user) => {
  const today = new Date().toISOString().slice(0, 10);
  if (user.last_reset_date !== today) {
    user.used_today = 0;
    user.last_reset_date = today;
    await user.save();
  }
};

const getMeQuota = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    await resetIfNeeded(user);
    return res.json({
      daily_quota: user.daily_quota,
      used_today: user.used_today,
      remaining: Math.max(user.daily_quota - user.used_today, 0)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil kuota' });
  }
};

// Admin set quota
const setUserQuota = async (req, res) => {
  try {
    const { userId } = req.params;
    const { daily_quota } = req.body;
    if (!daily_quota || daily_quota < 1) {
      return res.status(400).json({ message: 'daily_quota harus > 0' });
    }
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    user.daily_quota = daily_quota;
    await user.save();
    return res.json({ message: 'Kuota diperbarui', daily_quota });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengubah kuota' });
  }
};

// User create request
const createQuotaRequest = async (req, res) => {
  try {
    const { requested_quota, reason } = req.body;
    if (!requested_quota || requested_quota < 1) {
      return res.status(400).json({ message: 'requested_quota harus > 0' });
    }
    const existing = await QuotaRequest.findOne({
      where: { user_id: req.user.id, status: 'pending' }
    });
    if (existing) {
      return res.status(400).json({ message: 'Masih ada permintaan kuota yang pending. Tunggu keputusan admin.' });
    }
    const qr = await QuotaRequest.create({
      user_id: req.user.id,
      requested_quota,
      reason,
      status: 'pending'
    });
    return res.status(201).json({ message: 'Permintaan kuota dikirim', request: qr });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal membuat permintaan kuota' });
  }
};

// Admin list
const listQuotaRequests = async (_req, res) => {
  try {
    const reqs = await QuotaRequest.findAll({
      where: { status: { [Op.not]: null } },
      include: [{ model: User, as: 'user', attributes: ['username', 'role'] }],
      order: [['created_at', 'DESC']]
    });
    return res.json(reqs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil permintaan kuota' });
  }
};

// User list own requests
const listMyQuotaRequests = async (req, res) => {
  try {
    const reqs = await QuotaRequest.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']]
    });
    return res.json(reqs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil permintaan kuota' });
  }
};

// Admin approve/reject
const updateQuotaRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status harus approved/rejected' });
    }
    const qr = await QuotaRequest.findByPk(id);
    if (!qr) return res.status(404).json({ message: 'Request tidak ditemukan' });
    qr.status = status;
    qr.admin_note = admin_note;
    qr.responded_at = new Date();
    if (qr.createdAt) {
      const diffMs = new Date(qr.responded_at) - new Date(qr.createdAt);
      qr.response_minutes = Math.max(0, Math.round(diffMs / 60000));
    }
    await qr.save();

    if (status === 'approved') {
      const user = await User.findByPk(qr.user_id);
      if (user) {
        await resetIfNeeded(user);
        user.daily_quota = user.daily_quota + qr.requested_quota; // tambahkan, bukan ganti
        user.used_today = Math.max(0, user.used_today - qr.requested_quota); // beri ruang tambahan hari ini
        await user.save();
      }
    }

    return res.json({ message: 'Permintaan diperbarui', request: qr });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memperbarui permintaan' });
  }
};

export {
  getMeQuota,
  setUserQuota,
  createQuotaRequest,
  listQuotaRequests,
  updateQuotaRequest,
  listMyQuotaRequests
};
