import { Op } from "sequelize";
import { Assignment, User, BadanPublik } from "../models/index.js";

// User (or admin) fetch own assignments
const listMyAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.findAll({
      where: { user_id: req.user.id },
    });

    if (!assignments.length) {
      return res.json([]);
    }

    const badanIds = assignments.map((a) => a.badan_publik_id);
    const badanList = await BadanPublik.findAll({
      where: { id: badanIds },
      attributes: ["id", "nama_badan_publik", "kategori", "email"],
    });

    const badanMap = new Map(badanList.map((b) => [b.id, b]));
    const data = assignments.map((a) => ({
      id: a.id,
      badan_publik_id: a.badan_publik_id,
      badanPublik: badanMap.get(a.badan_publik_id),
    }));

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil penugasan" });
  }
};

// Admin assigns list of badan_publik to a user (replace existing)
const assignToUser = async (req, res) => {
  try {
    const { user_id, badan_publik_ids } = req.body;

    if (!user_id || !Array.isArray(badan_publik_ids)) {
      return res.status(400).json({
        message: "user_id dan badan_publik_ids wajib diisi (array)",
      });
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const uniqueIds = [...new Set(badan_publik_ids)];

    // Remove existing assignments for this user and these badan publik
    const whereClause = uniqueIds.length
      ? { [Op.or]: [{ user_id }, { badan_publik_id: uniqueIds }] }
      : { user_id };

    await Assignment.destroy({ where: whereClause });

    // Create new assignments
    if (uniqueIds.length > 0) {
      const newAssignments = uniqueIds.map((badan_publik_id) => ({
        user_id,
        badan_publik_id,
      }));
      await Assignment.bulkCreate(newAssignments);
    }

    return res.json({
      message: "Penugasan diperbarui",
      total: uniqueIds.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal menyimpan penugasan" });
  }
};

// List all assignments (admin) - one per badan_publik
const listAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.findAll({
      order: [
        ["updatedAt", "DESC"],
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    // Get unique assignments per badan_publik_id (most recent)
    const uniqueAssignments = [];
    const seenBadanIds = new Set();

    for (const assignment of assignments) {
      if (!seenBadanIds.has(assignment.badan_publik_id)) {
        seenBadanIds.add(assignment.badan_publik_id);
        uniqueAssignments.push(assignment);
      }
    }

    if (!uniqueAssignments.length) {
      return res.json([]);
    }

    const userIds = [...new Set(uniqueAssignments.map((a) => a.user_id))];
    const badanIds = [
      ...new Set(uniqueAssignments.map((a) => a.badan_publik_id)),
    ];

    const [users, badanList] = await Promise.all([
      User.findAll({
        where: { id: userIds },
        attributes: ["id", "username", "role"],
      }),
      BadanPublik.findAll({
        where: { id: badanIds },
        attributes: ["id", "nama_badan_publik", "kategori"],
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const badanMap = new Map(badanList.map((b) => [b.id, b]));

    const data = uniqueAssignments.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      badan_publik_id: a.badan_publik_id,
      user: userMap.get(a.user_id),
      badanPublik: badanMap.get(a.badan_publik_id),
    }));

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil penugasan" });
  }
};

// Get assignments for one user (admin)
const listAssignmentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const assignments = await Assignment.findAll({
      where: { user_id: userId },
    });

    if (!assignments.length) {
      return res.json([]);
    }

    const badanIds = assignments.map((a) => a.badan_publik_id);
    const badanList = await BadanPublik.findAll({
      where: { id: badanIds },
      attributes: ["id", "nama_badan_publik", "kategori"],
    });

    const badanMap = new Map(badanList.map((b) => [b.id, b]));
    const data = assignments.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      badan_publik_id: a.badan_publik_id,
      badanPublik: badanMap.get(a.badan_publik_id),
    }));

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil penugasan user" });
  }
};

export {
  assignToUser,
  listAssignments,
  listAssignmentsByUser,
  listMyAssignments,
};
