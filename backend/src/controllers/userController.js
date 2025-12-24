import bcrypt from "bcrypt";
import {
  User,
  Assignment,
  SmtpConfig,
  EmailLog,
  QuotaRequest,
} from "../models/index.js";

// Constants
const SALT_ROUNDS = 10;
const DEFAULT_DAILY_QUOTA = 20;
const VALID_ROLES = ["user", "admin"];

// Helper functions
const normalizeValue = (value) => String(value ?? "").trim();

const normalizeEmail = (value) => {
  const email = normalizeValue(value);
  return email ? email.toLowerCase() : "";
};

const isValidEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const deleteUserRelatedData = async (userIds) => {
  const ids = Array.isArray(userIds) ? userIds : [userIds];

  await Promise.all([
    Assignment.destroy({ where: { user_id: ids } }),
    SmtpConfig.destroy({ where: { user_id: ids } }),
    QuotaRequest.destroy({ where: { user_id: ids } }),
    EmailLog.destroy({ where: { user_id: ids } }),
  ]);
};

// Create user (register)
const createUser = async (req, res) => {
  try {
    const { username, password, role, group, nomer_hp, email } = req.body;
    const trimmedUsername = normalizeValue(username);
    const trimmedGroup = normalizeValue(group);
    const trimmedNomerHp = normalizeValue(nomer_hp);
    const normalizedEmail = normalizeEmail(email);

    if (!trimmedUsername) {
      return res.status(400).json({ message: "Username wajib diisi" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password wajib diisi" });
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Email tidak valid" });
    }

    const existing = await User.findOne({
      where: { username: trimmedUsername },
    });
    if (existing) {
      return res.status(400).json({ message: "Username sudah terdaftar" });
    }

    const hashedPassword = await hashPassword(password);

    await User.create({
      username: trimmedUsername,
      password: hashedPassword,
      role: role === "admin" ? "admin" : "user",
      daily_quota: DEFAULT_DAILY_QUOTA,
      group: trimmedGroup || null,
      nomer_hp: trimmedNomerHp || null,
      email: normalizedEmail || null,
    });

    return res.status(201).json({ message: "User berhasil dibuat" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal membuat user" });
  }
};

// Reset user password (admin)
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password, newPassword } = req.body;
    const passwordToSet = normalizeValue(password || newPassword);

    if (!passwordToSet) {
      return res.status(400).json({ message: "Password baru wajib diisi" });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const hashedPassword = await hashPassword(passwordToSet);
    await user.update({ password: hashedPassword });

    return res.json({ message: "Password berhasil direset" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mereset password" });
  }
};

// Import users from CSV/Excel
const importUsers = async (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ message: "Data kosong" });
    }

    // Normalize records
    const cleaned = records.map((record) => {
      const group = normalizeValue(
        record.group ?? record.Group ?? record.grup ?? record.kelompok
      );
      const nomerHp = normalizeValue(
        record.nomer_hp ??
          record["nomer hp"] ??
          record["nomor hp"] ??
          record.no_hp ??
          record.hp ??
          record.phone ??
          record.telepon ??
          record.telp
      );
      const email = normalizeEmail(record.email ?? record.Email);
      const username =
        normalizeValue(record.username ?? record.Username) || email || nomerHp;

      return { group, nomer_hp: nomerHp, email, username };
    });

    // Filter valid rows
    const validRows = cleaned.filter(
      (row) =>
        row.username &&
        row.group &&
        row.nomer_hp &&
        row.email &&
        isValidEmail(row.email)
    );

    if (!validRows.length) {
      return res.status(400).json({
        message:
          "Tidak ada baris valid (username, group, nomor hp, email wajib).",
      });
    }

    // Deduplicate by username (case-insensitive)
    const uniqueMap = new Map();
    validRows.forEach((row) => {
      const key = row.username.toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, row);
      }
    });
    const uniqueRows = Array.from(uniqueMap.values());

    // Check existing users
    const existing = uniqueRows.length
      ? await User.findAll({
          where: { username: uniqueRows.map((row) => row.username) },
          attributes: ["username"],
        })
      : [];

    const existingSet = new Set(existing.map((u) => u.username.toLowerCase()));
    const finalRows = uniqueRows.filter(
      (row) => !existingSet.has(row.username.toLowerCase())
    );

    if (!finalRows.length) {
      return res
        .status(400)
        .json({ message: "Semua username sudah terdaftar." });
    }

    // Hash passwords in parallel
    const hashedPasswords = await Promise.all(
      finalRows.map((row) => hashPassword(row.nomer_hp))
    );

    // Create users
    const userPayload = finalRows.map((row, idx) => ({
      username: row.username,
      password: hashedPasswords[idx],
      role: "user",
      daily_quota: DEFAULT_DAILY_QUOTA,
      group: row.group,
      nomer_hp: row.nomer_hp,
      email: row.email || null,
    }));

    await User.bulkCreate(userPayload);

    const stats = {
      imported: userPayload.length,
      skippedInvalid: cleaned.length - validRows.length,
      skippedDuplicateFile: validRows.length - uniqueRows.length,
      skippedExisting: uniqueRows.length - finalRows.length,
    };

    return res.json({
      message: `Import berhasil: ${stats.imported} masuk. Lewat: ${stats.skippedInvalid} invalid, ${stats.skippedDuplicateFile} duplikat file, ${stats.skippedExisting} sudah ada.`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal import user" });
  }
};

// List all users (admin)
const listUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        "id",
        "username",
        "role",
        "daily_quota",
        "group",
        "nomer_hp",
        "email",
      ],
      include: [{ model: SmtpConfig, as: "smtpConfig", attributes: ["id"] }],
      order: [["id", "ASC"]],
    });

    const mapped = users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      daily_quota: u.daily_quota,
      group: u.group,
      nomer_hp: u.nomer_hp,
      email: u.email,
      hasSmtp: Boolean(u.smtpConfig),
    }));

    return res.json(mapped);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil user" });
  }
};

// Get current user info
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        "id",
        "username",
        "role",
        "daily_quota",
        "used_today",
        "last_reset_date",
        "group",
        "nomer_hp",
        "email",
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil profil" });
  }
};

// Update own password
const updateMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const trimmedCurrentPassword = normalizeValue(currentPassword);
    const trimmedNewPassword = normalizeValue(newPassword);

    if (!trimmedCurrentPassword || !trimmedNewPassword) {
      return res
        .status(400)
        .json({ message: "Password lama dan baru wajib diisi" });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const isPasswordValid = await bcrypt.compare(
      trimmedCurrentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Password lama salah" });
    }

    const hashedPassword = await hashPassword(trimmedNewPassword);
    await user.update({ password: hashedPassword });

    return res.json({ message: "Password berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal memperbarui password" });
  }
};

// Update user role (admin)
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: "Role harus user/admin" });
    }

    if (Number(id) === req.user.id) {
      return res
        .status(400)
        .json({ message: "Tidak boleh mengganti role diri sendiri" });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    await user.update({ role });

    return res.json({
      message: "Role diperbarui",
      user: { id: user.id, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal memperbarui role" });
  }
};

// Delete single user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = Number(id);

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "ID user tidak valid" });
    }

    if (userId === req.user.id) {
      return res
        .status(400)
        .json({ message: "Tidak bisa menghapus akun sendiri" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    await deleteUserRelatedData(userId);
    await user.destroy();

    return res.json({
      message:
        "User dihapus. Penugasan di-reset dan email log terkait dihapus.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal menghapus user" });
  }
};

// Delete multiple users
const deleteUsersBulk = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "IDs wajib diisi" });
    }

    const uniqueIds = [
      ...new Set(
        ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      ),
    ];

    if (!uniqueIds.length) {
      return res.status(400).json({ message: "IDs tidak valid" });
    }

    const users = await User.findAll({
      where: { id: uniqueIds },
      attributes: ["id", "role"],
    });

    const deletableIds = users
      .filter((u) => u.role !== "admin" && u.id !== req.user.id)
      .map((u) => u.id);

    if (!deletableIds.length) {
      return res
        .status(400)
        .json({ message: "Tidak ada user yang bisa dihapus" });
    }

    await deleteUserRelatedData(deletableIds);
    const deleted = await User.destroy({ where: { id: deletableIds } });

    return res.json({
      message: `Berhasil menghapus ${deleted} user.`,
      deleted,
      skipped: uniqueIds.length - deletableIds.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal menghapus user terpilih" });
  }
};

export {
  createUser,
  listUsers,
  getMe,
  updateMyPassword,
  updateRole,
  deleteUser,
  deleteUsersBulk,
  resetUserPassword,
  importUsers,
};
