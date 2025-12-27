import { Op } from "sequelize";
import bcrypt from "bcrypt";
import { db, BadanPublik, Assignment, EmailLog, UjiAksesReport, User } from "../models/index.js";

// Helper functions
const isValidEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const normalizeValue = (val) => String(val ?? "").trim();

const normalizeStatus = (status) => {
  const normalized = normalizeValue(status).toLowerCase();
  if (!normalized || ["pending", "sent"].includes(normalized)) {
    return "belum dibalas";
  }
  if (["belum dibalas", "dibalas", "selesai"].includes(normalized)) {
    return normalized;
  }
  return "belum dibalas";
};

const SALT_ROUNDS = 10;

const listBadanPublik = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const data = await BadanPublik.findAll({
        order: [["createdAt", "DESC"]],
      });
      return res.json(data);
    }

    const assignments = await Assignment.findAll({
      where: { user_id: req.user.id },
      attributes: ["badan_publik_id"],
    });

    const allowedIds = assignments.map((a) => a.badan_publik_id);
    if (!allowedIds.length) {
      return res.json([]);
    }

    const data = await BadanPublik.findAll({
      where: { id: allowedIds },
      order: [["createdAt", "DESC"]],
    });

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Gagal mengambil data badan publik" });
  }
};

const getBadanPublik = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await BadanPublik.findByPk(id);

    if (!data) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Gagal mengambil data badan publik" });
  }
};

const createBadanPublik = async (req, res) => {
  try {
    const {
      nama_badan_publik,
      kategori,
      email,
      website,
      pertanyaan,
      status,
      sent_count,
    } = req.body;

    if (!nama_badan_publik || !kategori) {
      return res.status(400).json({ message: "Nama dan kategori wajib diisi" });
    }

    const trimmedEmail = email?.trim() || null;

    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      return res.status(400).json({ message: "Email tidak valid" });
    }

    if (trimmedEmail) {
      const existing = await BadanPublik.findOne({
        where: { email: trimmedEmail },
      });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Email sudah terdaftar, hindari duplikasi" });
      }
    }

    const newData = await BadanPublik.create({
      nama_badan_publik,
      kategori,
      email: trimmedEmail,
      website: website || null,
      pertanyaan: pertanyaan || null,
      status: normalizeStatus(status),
      sent_count: sent_count || 0,
    });

    return res.status(201).json(newData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal membuat data badan publik" });
  }
};

const updateBadanPublik = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await BadanPublik.findByPk(id);

    if (!data) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    const isAdmin = req.user.role === "admin";

    // Check assignment for non-admin users
    if (!isAdmin) {
      const assigned = await Assignment.findOne({
        where: { user_id: req.user.id, badan_publik_id: id },
      });

      if (!assigned) {
        return res.status(403).json({
          message: "Akses ditolak: data ini tidak ditugaskan ke Anda.",
        });
      }
    }

    // Validate and process email
    let nextEmail = data.email;
    if (req.body.email !== undefined) {
      const trimmed = req.body.email?.trim() || null;
      nextEmail = trimmed;

      if (nextEmail && !isValidEmail(nextEmail)) {
        return res.status(400).json({ message: "Email tidak valid" });
      }

      if (nextEmail && nextEmail !== data.email) {
        const existing = await BadanPublik.findOne({
          where: {
            email: nextEmail,
            id: { [Op.ne]: data.id },
          },
        });

        if (existing) {
          return res.status(400).json({
            message: "Email sudah terdaftar, hindari duplikasi",
          });
        }
      }
    }

    // Validate status
    const nextStatus =
      req.body.status !== undefined
        ? normalizeStatus(req.body.status)
        : data.status;

    if (!isAdmin && req.body.status !== undefined && nextStatus === "selesai") {
      return res.status(400).json({ message: "Status tidak valid untuk user" });
    }

    // Build update payload based on role
    const updatePayload = isAdmin
      ? {
          nama_badan_publik:
            req.body.nama_badan_publik ?? data.nama_badan_publik,
          kategori: req.body.kategori ?? data.kategori,
          email: nextEmail,
          website: req.body.website ?? data.website,
          pertanyaan: req.body.pertanyaan ?? data.pertanyaan,
          status: nextStatus,
          sent_count: req.body.sent_count ?? data.sent_count,
        }
      : {
          email: nextEmail,
          website: req.body.website ?? data.website,
          pertanyaan: req.body.pertanyaan ?? data.pertanyaan,
          ...(req.body.status !== undefined && { status: nextStatus }),
        };

    await data.update(updatePayload);
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Gagal memperbarui data badan publik" });
  }
};

const deleteBadanPublik = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await BadanPublik.findByPk(id);

    if (!data) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    const force = String(req.query?.force || "").toLowerCase() === "true";
    if (force) {
      await db.transaction(async (transaction) => {
        await EmailLog.destroy({ where: { badan_publik_id: data.id }, transaction });
        await Assignment.destroy({ where: { badan_publik_id: data.id }, transaction });
        await UjiAksesReport.destroy({ where: { badan_publik_id: data.id }, transaction });
        try {
          await db.query(
            "DELETE FROM AssignmentHistories WHERE badan_publik_id IN (:ids)",
            { replacements: { ids: [data.id] }, transaction }
          );
        } catch (err) {
          console.error("Gagal hapus AssignmentHistories", err?.message || err);
        }
        await data.destroy({ transaction });
      });
      return res.json({ message: "Data berhasil dihapus (force delete)." });
    }

    await data.destroy();
    return res.json({ message: "Data berhasil dihapus" });
  } catch (err) {
    console.error(err);
    if (err?.name === "SequelizeForeignKeyConstraintError") {
      return res.status(409).json({
        message:
          "Gagal menghapus: badan publik ini masih punya data yang terhubung (riwayat penugasan atau log). Hapus data terkait dulu, lalu coba lagi.",
      });
    }
    return res
      .status(500)
      .json({ message: "Gagal menghapus data badan publik" });
  }
};

const deleteBadanPublikBulk = async (req, res) => {
  try {
    const { ids, force } = req.body;

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

    if (force) {
      await db.transaction(async (transaction) => {
        await EmailLog.destroy({ where: { badan_publik_id: uniqueIds }, transaction });
        await Assignment.destroy({ where: { badan_publik_id: uniqueIds }, transaction });
        await UjiAksesReport.destroy({ where: { badan_publik_id: uniqueIds }, transaction });
        try {
          await db.query(
            "DELETE FROM AssignmentHistories WHERE badan_publik_id IN (:ids)",
            { replacements: { ids: uniqueIds }, transaction }
          );
        } catch (err) {
          console.error("Gagal hapus AssignmentHistories", err?.message || err);
        }
        await BadanPublik.destroy({ where: { id: uniqueIds }, transaction });
      });

      return res.json({
        message: `Berhasil menghapus ${uniqueIds.length} data (force delete).`,
        deleted: uniqueIds.length,
      });
    }

    const deleted = await BadanPublik.destroy({
      where: { id: uniqueIds },
    });

    return res.json({
      message: `Berhasil menghapus ${deleted} data.`,
      deleted,
    });
  } catch (err) {
    console.error(err);
    if (err?.name === "SequelizeForeignKeyConstraintError") {
      return res.status(409).json({
        message:
          "Gagal menghapus: badan publik ini masih punya data yang terhubung (riwayat penugasan atau log). Hapus data terkait dulu, lalu coba lagi.",
      });
    }
    return res.status(500).json({ message: "Gagal menghapus data terpilih" });
  }
};

const importBadanPublik = async (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ message: "Data kosong" });
    }

    // Normalize and filter valid records
    const cleaned = records
      .map((r) => {
        const rawEmail = r.email || r.Email || "";
        return {
          nama_badan_publik: normalizeValue(
            r.nama_badan_publik || r.Nama || r.nama
          ),
          kategori: normalizeValue(r.kategori || r.Kategori),
          email: isValidEmail(rawEmail) ? rawEmail : null,
          website: normalizeValue(r.website || r.Website) || null,
          pertanyaan: normalizeValue(r.pertanyaan || r.Pertanyaan) || null,
          status: normalizeStatus(r.status || r.Status),
          thread_id: r.thread_id || r["Thread Id"] || r.ThreadId || null,
          sent_count: 0,
        };
      })
      .filter((r) => r.nama_badan_publik && r.kategori);

    // Deduplicate by email (case-insensitive)
    const withEmail = cleaned.filter((r) => r.email);
    const withoutEmail = cleaned.filter((r) => !r.email);

    const emailMap = new Map();
    withEmail.forEach((row) => {
      const key = row.email.toLowerCase();
      if (!emailMap.has(key)) {
        emailMap.set(key, row);
      }
    });

    const uniqueEmailRows = Array.from(emailMap.values());

    // Exclude existing emails
    const existingEmails = uniqueEmailRows.length
      ? await BadanPublik.findAll({
          where: { email: uniqueEmailRows.map((r) => r.email) },
          attributes: ["email"],
        })
      : [];

    const existingSet = new Set(
      existingEmails.map((e) => e.email.toLowerCase())
    );
    const finalWithEmail = uniqueEmailRows.filter(
      (r) => !existingSet.has(r.email.toLowerCase())
    );

    const finalRows = [...withoutEmail, ...finalWithEmail];

    if (!finalRows.length) {
      return res.status(400).json({
        message:
          "Tidak ada baris valid (nama & kategori wajib). Email boleh kosong.",
      });
    }

    await BadanPublik.bulkCreate(finalRows);

    return res.json({
      message: `Import berhasil: ${finalRows.length} masuk, ${
        withEmail.length - finalWithEmail.length
      } duplikat email dilewati`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal import badan publik" });
  }
};

const importBadanPublikWithAssignment = async (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ message: "Data kosong" });
    }

    // Normalize records
    const cleaned = records
      .map((r) => {
        const emailRaw = normalizeValue(r.email || r.Email);
        const emailPengujiRaw = normalizeValue(
          r.email_penguji || r.emailPenguji || r.email_penguji_akses
        );

        return {
          nama_badan_publik: normalizeValue(
            r.nama_badan_publik || r.nama || r.nama_badan
          ),
          kategori: normalizeValue(r.kategori || r.Kategori),
          website: normalizeValue(r.website || r.Website) || null,
          email: isValidEmail(emailRaw) ? emailRaw : null,
          pertanyaan: normalizeValue(r.pertanyaan || r.Pertanyaan) || null,
          lembaga: normalizeValue(r.lembaga || r.LEMBAGA) || null,
          nama_penguji:
            normalizeValue(
              r.nama_penguji || r.namaPenguji || r.nama_penguji_akses
            ) || null,
          email_penguji: isValidEmail(emailPengujiRaw) ? emailPengujiRaw : null,
          no_hp_penguji:
            normalizeValue(
              r.no_hp_penguji || r.noHpPenguji || r.no_hp || r.nomer_hp
            ) || null,
        };
      })
      .filter((r) => r.nama_badan_publik && r.kategori);

    if (!cleaned.length) {
      return res.status(400).json({
        message: "Tidak ada baris valid (nama dan kategori wajib).",
      });
    }

    // Deduplicate by email in file
    const seenEmail = new Set();
    const deduped = [];
    let skippedDuplicateFile = 0;

    cleaned.forEach((row) => {
      if (row.email) {
        const key = row.email.toLowerCase();
        if (seenEmail.has(key)) {
          skippedDuplicateFile++;
          return;
        }
        seenEmail.add(key);
      }
      deduped.push(row);
    });

    // Check existing badan publik
    const emailList = deduped.filter((r) => r.email).map((r) => r.email);
    const existing = emailList.length
      ? await BadanPublik.findAll({
          where: { email: emailList },
          attributes: ["id", "email"],
        })
      : [];

    const existingMap = new Map(
      existing.map((b) => [b.email.toLowerCase(), b])
    );

    // Fetch existing users
    const namesPenguji = deduped.map((r) => r.nama_penguji).filter(Boolean);
    const users = namesPenguji.length
      ? await User.findAll({
          where: { username: namesPenguji },
          attributes: ["id", "email", "username", "nomer_hp"],
        })
      : [];

    const userByUsername = new Map(
      users.map((u) => [u.username.toLowerCase(), u])
    );
    const takenUsernames = new Set(users.map((u) => u.username.toLowerCase()));

    // Prepare new users
    const userCandidates = new Map();
    deduped.forEach((row) => {
      const { nama_penguji, no_hp_penguji, email_penguji, lembaga } = row;
      if (!nama_penguji || !no_hp_penguji) return;

      const key = nama_penguji.toLowerCase();
      if (
        userByUsername.has(key) ||
        takenUsernames.has(key) ||
        userCandidates.has(key)
      ) {
        return;
      }

      userCandidates.set(key, {
        username: nama_penguji,
        phone: no_hp_penguji,
        email: email_penguji,
        group: lembaga,
      });
    });

    let createdUsersCount = 0;

    // Create new users
    if (userCandidates.size) {
      const candidates = Array.from(userCandidates.values());
      const hashed = await Promise.all(
        candidates.map((c) => bcrypt.hash(c.phone, SALT_ROUNDS))
      );

      const userPayload = candidates.map((c, idx) => ({
        username: c.username,
        password: hashed[idx],
        role: "user",
        daily_quota: 20,
        group: c.group,
        nomer_hp: c.phone,
        email: c.email,
      }));

      const createdUsers = await User.bulkCreate(userPayload);
      createdUsersCount = createdUsers.length;

      createdUsers.forEach((u) => {
        userByUsername.set(u.username.toLowerCase(), u);
        takenUsernames.add(u.username.toLowerCase());
      });
    }

    // Process badan publik
    const badanCreatePayload = [];
    const badanCreateRows = [];
    const existingRows = [];
    let skippedExisting = 0;

    for (const row of deduped) {
      if (row.email && existingMap.has(row.email.toLowerCase())) {
        skippedExisting++;
        existingRows.push({
          row,
          badan: existingMap.get(row.email.toLowerCase()),
        });
        continue;
      }

      badanCreatePayload.push({
        nama_badan_publik: row.nama_badan_publik,
        kategori: row.kategori,
        email: row.email,
        website: row.website,
        pertanyaan: row.pertanyaan,
        status: normalizeStatus("pending"),
        sent_count: 0,
      });
      badanCreateRows.push(row);
    }

    const createdRows = [];
    let createdCount = 0;

    if (badanCreatePayload.length) {
      const createdList = await BadanPublik.bulkCreate(badanCreatePayload);
      createdCount = createdList.length;
      createdList.forEach((badan, idx) => {
        createdRows.push({ row: badanCreateRows[idx], badan });
      });
    }

    // Process assignments
    const allBadan = [...createdRows, ...existingRows];
    const badanIds = allBadan.map((x) => x.badan.id);

    const assignments = badanIds.length
      ? await Assignment.findAll({
          where: { badan_publik_id: badanIds },
          attributes: ["badan_publik_id"],
        })
      : [];

    const assignedSet = new Set(assignments.map((a) => a.badan_publik_id));

    const assignmentsPayload = [];
    let assignedCount = 0;
    let skippedAssigned = 0;
    let skippedNoUser = 0;

    for (const item of allBadan) {
      const { row, badan } = item;

      if (!row.nama_penguji) {
        skippedNoUser++;
        continue;
      }

      const user = userByUsername.get(row.nama_penguji.toLowerCase());
      if (!user) {
        skippedNoUser++;
        continue;
      }

      if (assignedSet.has(badan.id)) {
        skippedAssigned++;
        continue;
      }

      assignmentsPayload.push({
        user_id: user.id,
        badan_publik_id: badan.id,
      });
      assignedSet.add(badan.id);
      assignedCount++;
    }

    if (assignmentsPayload.length) {
      await Assignment.bulkCreate(assignmentsPayload);
    }

    return res.json({
      message: `Import selesai. ${createdCount} badan publik dibuat, ${skippedExisting} sudah ada. User dibuat: ${createdUsersCount}. Penugasan: ${assignedCount} berhasil, ${skippedAssigned} sudah ditugaskan, ${skippedNoUser} tanpa penguji.`,
      stats: {
        created: createdCount,
        skippedExisting,
        skippedDuplicateFile,
        createdUsers: createdUsersCount,
        assigned: assignedCount,
        skippedAssigned,
        skippedNoUser,
      },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Gagal import dan penugasan badan publik" });
  }
};

export {
  listBadanPublik,
  getBadanPublik,
  createBadanPublik,
  updateBadanPublik,
  deleteBadanPublik,
  deleteBadanPublikBulk,
  importBadanPublik,
  importBadanPublikWithAssignment,
};
