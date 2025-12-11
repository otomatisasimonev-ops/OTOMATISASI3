const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, Assignment, AssignmentHistory, SmtpConfig, EmailLog, QuotaRequest } = require('../models');

// Admin-only: create user with role default "user"
const createUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password wajib diisi' });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(400).json({ message: 'Username sudah terpakai' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashed,
      role: 'user'
    });

    return res.status(201).json({
      message: 'User berhasil dibuat',
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal membuat user' });
  }
};

// List users (admin)
const listUsers = async (_req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'role'],
      order: [['id', 'ASC']]
    });
    return res.json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil user' });
  }
};

// User info self
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'role', 'daily_quota', 'used_today', 'last_reset_date']
    });
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil profil' });
  }
};

module.exports = {
  createUser,
  listUsers,
  getMe,
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = Number(id);

      if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ message: 'ID user tidak valid' });
      }

      if (userId === req.user.id) {
        return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User tidak ditemukan' });
      }

      // Hapus penugasan dan histori terkait user ini
      await Assignment.destroy({ where: { user_id: userId } });
      await AssignmentHistory.destroy({
        where: {
          [Op.or]: [{ user_id: userId }, { actor_id: userId }]
        }
      });

      // Hapus konfigurasi/kuota/log terkait user ini agar FK tidak menolak
      await SmtpConfig.destroy({ where: { user_id: userId } });
      await QuotaRequest.destroy({ where: { user_id: userId } });
      await EmailLog.destroy({ where: { user_id: userId } });

      await user.destroy();

      return res.json({ message: 'User dihapus. Penugasan di-reset dan email log terkait dihapus.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Gagal menghapus user' });
    }
  }
};
