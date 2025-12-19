import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { User, Assignment, AssignmentHistory, SmtpConfig, EmailLog, QuotaRequest } from '../models/index.js';

const SALT_ROUNDS = 10;

const normalizeValue = (value) => String(value ?? '').trim();
const normalizeEmail = (value) => {
  const email = normalizeValue(value);
  return email ? email.toLowerCase() : '';
};
const isValidEmail = (val) => {
  if (!val) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
};

// REGISTER //baru nambahin pasword dan bcrypt
const createUser = async (req, res) => {
  try {
    const payload = req.body || {};
    const username = normalizeValue(payload.username);
    const password = payload.password;
    const role = payload.role === 'admin' ? 'admin' : 'user';
    const group = normalizeValue(payload.group);
    const nomerHp = normalizeValue(payload.nomer_hp);
    const email = normalizeEmail(payload.email);

    if (!username) {
      return res.status(400).json({ message: 'Username wajib diisi' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password wajib diisi' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ message: 'Email tidak valid' });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(400).json({ message: 'Username sudah terdaftar' });
    }

    const encryptPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await User.create({
      username,
      password: encryptPassword,
      role,
      daily_quota: 20,
      group: group || null,
      nomer_hp: nomerHp || null,
      email: email || null
    });
    return res.status(201).json({ message: 'User berhasil dibuat' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Gagal membuat user' });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const newPassword = normalizeValue(payload.password || payload.newPassword);
    if (!newPassword) {
      return res.status(400).json({ message: 'Password baru wajib diisi' });
    }
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.update({ password: hashedPassword });
    return res.json({ message: 'Password berhasil direset' });
  }
  catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mereset password' });
  }
};

const importUsers = async (req, res) => {
  try {
    const { records } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Data kosong' });
    }

    const cleaned = records.map((record) => {
      const group = normalizeValue(record.group ?? record.Group ?? record.grup ?? record.kelompok ?? '');
      const nomerHp = normalizeValue(
        record.nomer_hp ??
          record['nomer hp'] ??
          record['nomor hp'] ??
          record.no_hp ??
          record.hp ??
          record.phone ??
          record.telepon ??
          record.telp ??
          ''
      );
      const email = normalizeEmail(record.email ?? record.Email ?? '');
      const username = normalizeValue(record.username ?? record.Username ?? '') || email || nomerHp;
      return {
        group,
        nomer_hp: nomerHp,
        email,
        username
      };
    });

    const validRows = cleaned.filter(
      (row) => row.username && row.group && row.nomer_hp && row.email && isValidEmail(row.email)
    );

    if (!validRows.length) {
      return res.status(400).json({ message: 'Tidak ada baris valid (username, group, nomor hp, email wajib).' });
    }

    const uniqueMap = new Map();
    validRows.forEach((row) => {
      const key = row.username.toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, row);
      }
    });
    const uniqueRows = Array.from(uniqueMap.values());

    const existing = uniqueRows.length
      ? await User.findAll({
          where: { username: { [Op.in]: uniqueRows.map((row) => row.username) } },
          attributes: ['username']
        })
      : [];
    const existingSet = new Set(existing.map((u) => u.username.toLowerCase()));
    const finalRows = uniqueRows.filter((row) => !existingSet.has(row.username.toLowerCase()));

    if (!finalRows.length) {
      return res.status(400).json({ message: 'Semua username sudah terdaftar.' });
    }

    const hashedPasswords = await Promise.all(
      finalRows.map((row) => bcrypt.hash(row.nomer_hp, SALT_ROUNDS))
    );

    const payload = finalRows.map((row, idx) => ({
      username: row.username,
      password: hashedPasswords[idx],
      role: 'user',
      daily_quota: 20,
      group: row.group,
      nomer_hp: row.nomer_hp,
      email: row.email || null
    }));

    await User.bulkCreate(payload);

    const skippedInvalid = cleaned.length - validRows.length;
    const skippedDuplicateFile = validRows.length - uniqueRows.length;
    const skippedExisting = uniqueRows.length - finalRows.length;

    return res.json({
      message: `Import berhasil: ${payload.length} masuk. Lewat: ${skippedInvalid} invalid, ${skippedDuplicateFile} duplikat file, ${skippedExisting} sudah ada.`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal import user' });
  }
};


// List users (admin)
const listUsers = async (_req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'role', 'daily_quota', 'group', 'nomer_hp', 'email'],
      include: [{ model: SmtpConfig, as: 'smtpConfig', attributes: ['id'] }],
      order: [['id', 'ASC']]
    });
    const mapped = users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      daily_quota: u.daily_quota,
      group: u.group,
      nomer_hp: u.nomer_hp,
      email: u.email,
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
      attributes: [
        'id',
        'username',
        'role',
        'daily_quota',
        'used_today',
        'last_reset_date',
        'group',
        'nomer_hp',
        'email'
      ]
    });
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil profil' });
  }
};

const updateMyPassword = async (req, res) => {
  try {
    const payload = req.body || {};
    const currentPassword = normalizeValue(payload.currentPassword);
    const newPassword = normalizeValue(payload.newPassword);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Password lama dan baru wajib diisi' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(400).json({ message: 'Password lama salah' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.update({ password: hashedPassword });
    return res.json({ message: 'Password berhasil diperbarui' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memperbarui password' });
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

const deleteUser = async (req, res) => {
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
  };

export {
  createUser,
  listUsers,
  getMe,
  updateMyPassword,
  updateRole,
  deleteUser,
  resetUserPassword,
  importUsers
}
  
