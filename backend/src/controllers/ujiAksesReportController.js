import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';
import { UjiAksesReport, BadanPublik, User, Assignment } from '../models/index.js';
import { computeAnswersAndTotal, validateSubmittedAnswers, QUESTIONS, normalizeMaybeJson} from '../utils/ujiAksesRubric.js';

const ensureUploadsDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    // ignore
  }
};

const userCanAccessBadanPublik = async (user, badanPublikId) => {
  if (user?.role === 'admin') return true;
  const found = await Assignment.findOne({
    where: { user_id: user.id, badan_publik_id: badanPublikId },
    attributes: ['id']
  });
  return Boolean(found);
};

const getReportOr403 = async (req, res, reportId) => {
  const report = await UjiAksesReport.findByPk(reportId, {
    include: [
      { model: BadanPublik, as: 'badanPublik' },
      { model: User, as: 'user', attributes: ['id', 'username', 'role'] }
    ]
  });

  if (!report) {
    res.status(404).json({ message: 'Report tidak ditemukan' });
    return null;
  }

  if (req.user.role !== 'admin' && report.user_id !== req.user.id) {
    res.status(403).json({ message: 'Akses ditolak' });
    return null;
  }

  return report;
};

const createReport = async (req, res) => {
  try {
    const payload = req.body || {};
    const badanPublikId = Number(payload.badanPublikId ?? payload.badan_publik_id);
    if (!badanPublikId) {
      return res.status(400).json({ message: 'badanPublikId wajib diisi' });
    }

    const badanPublik = await BadanPublik.findByPk(badanPublikId, { attributes: ['id'] });
    if (!badanPublik) {
      return res.status(404).json({ message: 'Badan publik tidak ditemukan' });
    }

    const can = await userCanAccessBadanPublik(req.user, badanPublikId);
    if (!can) {
      return res.status(403).json({ message: 'Badan publik tidak termasuk penugasan Anda' });
    }

    const status = payload.status === 'submitted' ? 'submitted' : 'draft';
    const computed = computeAnswersAndTotal(payload.answers || {});

    if (status === 'submitted') {
      const missing = validateSubmittedAnswers(computed.answers);
      if (missing.length) {
        return res.status(400).json({ message: `Jawaban belum lengkap: ${missing.join(', ')}` });
      }
    }

    const report = await UjiAksesReport.create({
      user_id: req.user.id,
      badan_publik_id: badanPublikId,
      status,
      total_skor: computed.totalSkor,
      answers: computed.answers,
      evidences: {},
      submitted_at: status === 'submitted' ? new Date() : null
    });

    return res.status(201).json(toPlainReport(report));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal membuat report' });
  }
};

const updateDraftReport = async (req, res) => {
  try {
    const report = await getReportOr403(req, res, req.params.id);
    if (!report) return;

    if (report.status === 'submitted') {
      return res.status(400).json({ message: 'Report sudah submitted dan tidak bisa diubah' });
    }

    const computed = computeAnswersAndTotal(req.body?.answers || {});
    await report.update({
      answers: computed.answers,
      total_skor: computed.totalSkor
    });

    return res.json(toPlainReport(report));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal menyimpan draft' });
  }
};

const listMyReports = async (req, res) => {
  try {
    const data = await UjiAksesReport.findAll({
      where: { user_id: req.user.id },
      include: [{ model: BadanPublik, as: 'badanPublik' }],
      order: [['created_at', 'DESC']]
    });
    return res.json(data.map(toPlainReport));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil laporan' });
  }
};

const getReportDetail = async (req, res) => {
  try {
    const report = await getReportOr403(req, res, req.params.id);
    if (!report) return;
    return res.json({ report: toPlainReport(report), rubric: QUESTIONS });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil detail laporan' });
  }
};

const submitReport = async (req, res) => {
  try {
    const report = await getReportOr403(req, res, req.params.id);
    if (!report) return;

    if (report.status === 'submitted') {
      return res.json(report);
    }

    const computed = computeAnswersAndTotal(report.answers || {});
    const missing = validateSubmittedAnswers(computed.answers);
    if (missing.length) {
      return res.status(400).json({ message: `Jawaban belum lengkap: ${missing.join(', ')}` });
    }

    await report.update({
      status: 'submitted',
      answers: computed.answers,
      total_skor: computed.totalSkor,
      submitted_at: new Date()
    });

    return res.json(toPlainReport(report));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal submit laporan' });
  }
};

const adminListReports = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const badanPublikId = req.query.badanPublikId ? Number(req.query.badanPublikId) : null;
    const status = req.query.status ? String(req.query.status) : '';
    const sortBy = ['total_skor', 'created_at'].includes(String(req.query.sortBy)) ? String(req.query.sortBy) : 'created_at';
    const sortDir = String(req.query.sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const where = {};
    if (badanPublikId) where.badan_publik_id = badanPublikId;
    if (status === 'draft' || status === 'submitted') where.status = status;

    const include = [
      { model: BadanPublik, as: 'badanPublik' },
      { model: User, as: 'user', attributes: ['id', 'username', 'role'] }
    ];

    if (q) {
      include[0].where = {
        [Op.or]: [{ nama_badan_publik: { [Op.like]: `%${q}%` } }, { kategori: { [Op.like]: `%${q}%` } }]
      };
      include[0].required = true;
    }

    const data = await UjiAksesReport.findAll({
      where,
      include,
      order: [[sortBy, sortDir]]
    });

    return res.json(data.map(toPlainReport));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil laporan admin' });
  }
};

const uploadEvidence = async (req, res) => {
  try {
    const report = await getReportOr403(req, res, req.params.id);
    if (!report) return;

    if (report.status === 'submitted') {
      return res.status(400).json({ message: 'Report sudah submitted dan tidak bisa upload bukti' });
    }

    const questionKey = String(req.body?.questionKey || req.query?.questionKey || '').trim();
    if (!QUESTIONS.some((q) => q.key === questionKey)) {
      return res.status(400).json({ message: 'questionKey tidak valid' });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: 'File bukti tidak ditemukan' });
    }

    const currentEvidences = normalizeMaybeJson(report.evidences);
    const next = { ...currentEvidences };
    const list = Array.isArray(next[questionKey]) ? next[questionKey].slice() : [];
    for (const f of files) {
      list.push({
        path: f.path.replace(/\\/g, '/').replace(/^.*?(\/uploads\/)/, '/uploads/'),
        filename: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        uploadedAt: new Date().toISOString()
      });
    }
    next[questionKey] = list;

    await report.update({ evidences: next });
    report.evidences = next;
    return res.json({ evidences: next });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal upload bukti' });
  }
};

const getMulterStoragePath = (reportId, questionKey) =>
  path.join(__dirname, '..', '..', 'uploads', 'uji-akses-reports', String(reportId), String(questionKey));

const ensureReportUploadDir = (reportId, questionKey) => {
  const dir = getMulterStoragePath(reportId, questionKey);
  ensureUploadsDir(dir);
  return dir;
};

export {
  createReport,
  updateDraftReport,
  listMyReports,
  getReportDetail,
  submitReport,
  adminListReports,
  uploadEvidence,
  ensureReportUploadDir,
  getMulterStoragePath
};
const toPlainReport = (reportInstance) => {
  if (!reportInstance) return null;
  const plain =
    typeof reportInstance.toJSON === 'function' ? reportInstance.toJSON() : { ...reportInstance };
  plain.answers = normalizeMaybeJson(plain.answers);
  plain.evidences = normalizeMaybeJson(plain.evidences);
  return plain;
};
