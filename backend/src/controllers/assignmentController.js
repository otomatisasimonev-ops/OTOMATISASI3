import { Op } from 'sequelize';
import { Assignment, User, BadanPublik, AssignmentHistory } from '../models/index.js';

// User (or admin) fetch own assignments
const listMyAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.findAll({ where: { user_id: req.user.id } });
    const badanIds = assignments.map((a) => a.badan_publik_id);
    if (badanIds.length === 0) return res.json([]);

    const badan = await BadanPublik.findAll({
      where: { id: badanIds },
      attributes: ['id', 'nama_badan_publik', 'kategori', 'email']
    });
    const badanMap = Object.fromEntries(badan.map((b) => [b.id, b]));

    const data = assignments.map((a) => ({
      id: a.id,
      badan_publik_id: a.badan_publik_id,
      badanPublik: badanMap[a.badan_publik_id]
    }));

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil penugasan' });
  }
};

// Admin assigns list of badan_publik to a user (replace existing) - exclusive: 1 badan publik hanya untuk 1 user
const assignToUser = async (req, res) => {
  try {
    const { user_id, badan_publik_ids } = req.body;
    if (!user_id || !Array.isArray(badan_publik_ids)) {
      return res.status(400).json({ message: 'user_id dan badan_publik_ids wajib diisi (array)' });
    }

    const user = await User.findByPk(user_id);
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

    // Unique per badan publik: lepas dulu dari user manapun, lalu set hanya ke user ini
    const uniqueIds = [...new Set(badan_publik_ids)];
    const existingAssignments = await Assignment.findAll({
      where: uniqueIds.length
        ? { [Op.or]: [{ user_id }, { badan_publik_id: { [Op.in]: uniqueIds } }] }
        : { user_id }
    });

    if (uniqueIds.length > 0) {
      await Assignment.destroy({
        where: {
          [Op.or]: [{ user_id }, { badan_publik_id: { [Op.in]: uniqueIds } }]
        }
      });
    } else {
      await Assignment.destroy({ where: { user_id } });
    }

    const bulk = uniqueIds.map((bid) => ({ user_id, badan_publik_id: bid }));
    if (bulk.length > 0) {
      await Assignment.bulkCreate(bulk);
    }

    // catat history
    const actorId = req.user?.id;
    const historyRows = [];
    const removed = existingAssignments.filter((a) => !uniqueIds.includes(a.badan_publik_id));
    removed.forEach((a) => {
      historyRows.push({
        user_id: a.user_id,
        badan_publik_id: a.badan_publik_id,
        actor_id: actorId || a.user_id,
        action: 'unassign',
        note: 'Dilepas dari penugasan'
      });
    });
    bulk.forEach((b) => {
      historyRows.push({
        user_id: b.user_id,
        badan_publik_id: b.badan_publik_id,
        actor_id: actorId || b.user_id,
        action: 'assign',
        note: 'Ditugaskan'
      });
    });
    if (historyRows.length) {
      await AssignmentHistory.bulkCreate(historyRows);
    }

    return res.json({ message: 'Penugasan diperbarui', total: bulk.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal menyimpan penugasan' });
  }
};

// List all assignments (admin)
const listAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.findAll({
      order: [
        ['updatedAt', 'DESC'],
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ]
    });

    // Ambil hanya 1 assignment per badan_publik_id (yang terbaru)
    const uniqueAssignments = [];
    const taken = new Set();
    for (const a of assignments) {
      if (taken.has(a.badan_publik_id)) continue;
      taken.add(a.badan_publik_id);
      uniqueAssignments.push(a);
    }

    const userIds = [...new Set(uniqueAssignments.map((a) => a.user_id))];
    const badanIds = [...new Set(uniqueAssignments.map((a) => a.badan_publik_id))];

    const users = await User.findAll({
      where: userIds.length ? { id: userIds } : undefined,
      attributes: ['id', 'username', 'role']
    });
    const badan = await BadanPublik.findAll({
      where: badanIds.length ? { id: badanIds } : undefined,
      attributes: ['id', 'nama_badan_publik', 'kategori']
    });

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const badanMap = Object.fromEntries(badan.map((b) => [b.id, b]));

    const data = uniqueAssignments.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      badan_publik_id: a.badan_publik_id,
      user: userMap[a.user_id],
      badanPublik: badanMap[a.badan_publik_id]
    }));

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil penugasan' });
  }
};

// Get assignments for one user (admin)
const listAssignmentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const assignments = await Assignment.findAll({ where: { user_id: userId } });
    const badanIds = assignments.map((a) => a.badan_publik_id);
    const badan = await BadanPublik.findAll({
      where: badanIds.length ? { id: badanIds } : undefined,
      attributes: ['id', 'nama_badan_publik', 'kategori']
    });
    const badanMap = Object.fromEntries(badan.map((b) => [b.id, b]));
    const data = assignments.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      badan_publik_id: a.badan_publik_id,
      badanPublik: badanMap[a.badan_publik_id]
    }));
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil penugasan user' });
  }
};

// Histori perubahan penugasan
const listAssignmentHistory = async (_req, res) => {
  try {
    const history = await AssignmentHistory.findAll({
      limit: 100,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'actor', attributes: ['username'] },
        { model: User, as: 'assignee', attributes: ['username'] },
        { model: BadanPublik, as: 'badanPublik', attributes: ['nama_badan_publik'] }
      ]
    });
    return res.json(history);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil histori' });
  }
};

export {
  assignToUser,
  listAssignments,
  listAssignmentsByUser,
  listMyAssignments,
  listAssignmentHistory
};
