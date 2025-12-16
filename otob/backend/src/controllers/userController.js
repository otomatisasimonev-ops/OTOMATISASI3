import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { User, Assignment, AssignmentHistory, SmtpConfig, EmailLog, QuotaRequest } from '../models';

// REGISTER //baru nambahin pasword dan bcrypt
const createUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    const encryptPassword = await bcrypt.hash(password, 5);
    await User.create({
      username: username,
      password: encryptPassword,
      role: "user",
      daily_quota: 20
    });
    res.status(201).json({ msg: "Register Berhasil" });
  } catch (error) {
    console.log(error.message);
  }
}

// List users (admin)
const listUsers = async (_req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'role', 'daily_quota'],
      include: [{ model: SmtpConfig, as: 'smtpConfig', attributes: ['id'] }],
      order: [['id', 'ASC']]
    });
    const mapped = users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      daily_quota: u.daily_quota,
      hasSmtp: Boolean(u.smtpConfig)
    }));
    return res.json(mapped);
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

// Admin update role
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role harus user/admin' });
    }
    if (Number(id) === req.user.id) {
      return res.status(400).json({ message: 'Tidak boleh mengganti role diri sendiri' });
    }
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }
    await user.update({ role });
    return res.json({ message: 'Role diperbarui', user: { id: user.id, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memperbarui role' });
  }
};

module.exports = {
  createUser,
  listUsers,
  getMe,
  updateRole,
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
  },
  resetPassword: async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      if (!password || password.length < 4) {
        return res.status(400).json({ message: 'Password baru wajib diisi' });
      }
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: 'User tidak ditemukan' });
      }
      const hashed = await bcrypt.hash(password, 10);
      await user.update({ password: hashed });
      return res.json({ message: 'Password berhasil direset' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Gagal reset password' });
    }
  }
};
