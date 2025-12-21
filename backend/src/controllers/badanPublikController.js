import { Op } from 'sequelize';
import bcrypt from 'bcrypt';
import { BadanPublik, Assignment, User } from '../models/index.js';

const isValidEmail = (val) => {
  if (!val) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
};

const normalizeValue = (val) => String(val ?? '').trim();
const SALT_ROUNDS = 10;

const listBadanPublik = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const dataAdmin = await BadanPublik.findAll({ order: [['createdAt', 'DESC']] });
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
      order: [['createdAt', 'DESC']]
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

const normalizeStatus = (val) => {
  const raw = String(val || '').trim().toLowerCase();
  if (!raw) return 'belum dibalas';
  if (['pending', 'sent'].includes(raw)) return 'belum dibalas';
  if (['belum dibalas', 'dibalas', 'selesai'].includes(raw)) return raw;
  return 'belum dibalas';
};

const createBadanPublik = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.nama_badan_publik || !payload.kategori) {
      return res.status(400).json({ message: 'Nama dan kategori wajib diisi' });
    }
    const email = payload.email ? String(payload.email).trim() : null;
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ message: 'Email tidak valid' });
    }
    if (email) {
      const existing = await BadanPublik.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: 'Email sudah terdaftar, hindari duplikasi' });
      }
    }
    const newData = await BadanPublik.create({
      nama_badan_publik: payload.nama_badan_publik,
      kategori: payload.kategori,
      email,
      website: payload.website,
      pertanyaan: payload.pertanyaan,
      status: normalizeStatus(payload.status),
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

    // Non-admin hanya boleh mengubah data yang ditugaskan kepadanya, dan hanya kolom tertentu
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin) {
      const assigned = await Assignment.findOne({
        where: { user_id: req.user.id, badan_publik_id: id }
      });
      if (!assigned) {
        return res.status(403).json({ message: 'Akses ditolak: data ini tidak ditugaskan ke Anda.' });
      }
    }

    let nextEmail = data.email;
    if (payload.email !== undefined) {
      const trimmed = String(payload.email || '').trim();
      nextEmail = trimmed ? trimmed : null;
      if (nextEmail && !isValidEmail(nextEmail)) {
        return res.status(400).json({ message: 'Email tidak valid' });
      }
      if (nextEmail && nextEmail !== data.email) {
        const existing = await BadanPublik.findOne({
          where: { email: nextEmail, id: { [Op.ne]: data.id } }
        });
        if (existing) {
          return res.status(400).json({ message: 'Email sudah terdaftar, hindari duplikasi' });
        }
      }
    }

    const nextStatus =
      payload.status !== undefined ? normalizeStatus(payload.status) : data.status;
    if (!isAdmin && payload.status !== undefined && nextStatus === 'selesai') {
      return res.status(400).json({ message: 'Status tidak valid untuk user' });
    }

    // Build update payload berdasarkan role
    const updatePayload = isAdmin
      ? {
          nama_badan_publik: payload.nama_badan_publik ?? data.nama_badan_publik,
          kategori: payload.kategori ?? data.kategori,
          email: nextEmail,
          website: payload.website ?? data.website,
          pertanyaan: payload.pertanyaan ?? data.pertanyaan,
          status: nextStatus,
          sent_count: payload.sent_count ?? data.sent_count
        }
      : {
          // user hanya boleh koreksi email/website/pertanyaan
          email: nextEmail,
          website: payload.website ?? data.website,
          pertanyaan: payload.pertanyaan ?? data.pertanyaan,
          ...(payload.status !== undefined ? { status: nextStatus } : {})
        };

    await data.update(updatePayload);

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

const deleteBadanPublikBulk = async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'IDs wajib diisi' });
    }
    const uniqueIds = Array.from(new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))));
    if (uniqueIds.length === 0) {
      return res.status(400).json({ message: 'IDs tidak valid' });
    }
    const deleted = await BadanPublik.destroy({ where: { id: { [Op.in]: uniqueIds } } });
    return res.json({ message: `Berhasil menghapus ${deleted} data.`, deleted });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal menghapus data terpilih' });
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
          status: normalizeStatus(r.status || r.Status),
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

const importBadanPublikWithAssignment = async (req, res) => {
  try {
    const { records } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Data kosong' });
    }

    const cleaned = records
      .map((r) => {
        const nama = normalizeValue(r.nama_badan_publik || r.nama || r.nama_badan || '');
        const kategori = normalizeValue(r.kategori || r.Kategori || '');
        const website = normalizeValue(r.website || r.Website || '');
        const emailRaw = normalizeValue(r.email || r.Email || '');
        const email = isValidEmail(emailRaw) ? emailRaw : null;
        const pertanyaan = normalizeValue(r.pertanyaan || r.Pertanyaan || '');
        const lembaga = normalizeValue(r.lembaga || r.LEMBAGA || '');
        const namaPenguji = normalizeValue(r.nama_penguji || r.namaPenguji || r.nama_penguji_akses || '');
        const emailPengujiRaw = normalizeValue(r.email_penguji || r.emailPenguji || r.email_penguji_akses || '');
        const emailPenguji = isValidEmail(emailPengujiRaw) ? emailPengujiRaw : '';
        const noHpPenguji = normalizeValue(r.no_hp_penguji || r.noHpPenguji || r.no_hp || r.nomer_hp || '');
        return {
          nama_badan_publik: nama,
          kategori,
          website: website || null,
          email,
          pertanyaan: pertanyaan || null,
          lembaga: lembaga || null,
          nama_penguji: namaPenguji || null,
          email_penguji: emailPenguji || null,
          no_hp_penguji: noHpPenguji || null
        };
      })
      .filter((r) => r.nama_badan_publik && r.kategori);

    if (!cleaned.length) {
      return res.status(400).json({ message: 'Tidak ada baris valid (nama dan kategori wajib).' });
    }

    const seenEmail = new Set();
    const deduped = [];
    let skippedDuplicateFile = 0;
    cleaned.forEach((row) => {
      if (row.email) {
        const key = row.email.toLowerCase();
        if (seenEmail.has(key)) {
          skippedDuplicateFile += 1;
          return;
        }
        seenEmail.add(key);
      }
      deduped.push(row);
    });

    const emailList = deduped.filter((r) => r.email).map((r) => r.email);
    const existing = emailList.length
      ? await BadanPublik.findAll({
          where: { email: { [Op.in]: emailList } },
          attributes: ['id', 'email']
        })
      : [];
    const existingMap = new Map(existing.map((b) => [b.email.toLowerCase(), b]));

    const namesPenguji = deduped.map((r) => r.nama_penguji).filter(Boolean);

    const userWhere = [];
    if (namesPenguji.length) userWhere.push({ username: { [Op.in]: namesPenguji } });

    const users = userWhere.length
      ? await User.findAll({
          where: { [Op.or]: userWhere },
          attributes: ['id', 'email', 'username', 'nomer_hp']
        })
      : [];

    const userByUsername = new Map(users.map((u) => [u.username.toLowerCase(), u]));
    const takenUsernames = new Set(users.map((u) => u.username.toLowerCase()));

    let createdCount = 0;
    let createdUsersCount = 0;
    let skippedExisting = 0;
    let assignedCount = 0;
    let skippedAssigned = 0;
    let skippedNoUser = 0;

    const createdRows = [];
    const existingRows = [];

    const userCandidates = new Map();
    deduped.forEach((row) => {
      const username = row.nama_penguji;
      const phone = row.no_hp_penguji;
      if (!username || !phone) return;
      if (userByUsername.has(username.toLowerCase())) return;
      if (takenUsernames.has(username.toLowerCase())) return;
      if (userCandidates.has(username.toLowerCase())) return;
      userCandidates.set(username.toLowerCase(), {
        username,
        phone,
        email: row.email_penguji || null,
        group: row.lembaga || null
      });
    });

    if (userCandidates.size) {
      const candidates = Array.from(userCandidates.values());
      const hashed = await Promise.all(candidates.map((c) => bcrypt.hash(c.phone, SALT_ROUNDS)));
      const payload = candidates.map((c, idx) => ({
        username: c.username,
        password: hashed[idx],
        role: 'user',
        daily_quota: 20,
        group: c.group,
        nomer_hp: c.phone,
        email: c.email
      }));
      const createdUsers = await User.bulkCreate(payload);
      createdUsersCount += createdUsers.length;
      createdUsers.forEach((u) => {
        userByUsername.set(u.username.toLowerCase(), u);
        takenUsernames.add(u.username.toLowerCase());
      });
    }

    const badanCreatePayload = [];
    const badanCreateRows = [];
    for (const row of deduped) {
      if (row.email && existingMap.has(row.email.toLowerCase())) {
        skippedExisting += 1;
        existingRows.push({ row, badan: existingMap.get(row.email.toLowerCase()) });
        continue;
      }
      badanCreatePayload.push({
        nama_badan_publik: row.nama_badan_publik,
        kategori: row.kategori,
        email: row.email,
        website: row.website,
        pertanyaan: row.pertanyaan,
        status: normalizeStatus('pending'),
        sent_count: 0
      });
      badanCreateRows.push(row);
    }

    if (badanCreatePayload.length) {
      const createdList = await BadanPublik.bulkCreate(badanCreatePayload);
      createdCount += createdList.length;
      createdList.forEach((badan, idx) => {
        createdRows.push({ row: badanCreateRows[idx], badan });
      });
    }

    const allBadan = [...createdRows, ...existingRows];
    const badanIds = allBadan.map((x) => x.badan.id);
    const assignments = badanIds.length
      ? await Assignment.findAll({
          where: { badan_publik_id: { [Op.in]: badanIds } },
          attributes: ['badan_publik_id']
        })
      : [];
    const assignedSet = new Set(assignments.map((a) => a.badan_publik_id));

    const assignmentsPayload = [];
    for (const item of allBadan) {
      const row = item.row;
      const badan = item.badan;
      if (!row.nama_penguji) {
        skippedNoUser += 1;
        continue;
      }

      let user = null;
      user = userByUsername.get(row.nama_penguji.toLowerCase()) || null;

      if (!user) {
        skippedNoUser += 1;
        continue;
      }
      if (assignedSet.has(badan.id)) {
        skippedAssigned += 1;
        continue;
      }

      assignmentsPayload.push({ user_id: user.id, badan_publik_id: badan.id });
      assignedSet.add(badan.id);
      assignedCount += 1;
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
        skippedNoUser
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal import dan penugasan badan publik' });
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
  importBadanPublikWithAssignment
};
