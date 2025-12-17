import nodemailer from 'nodemailer';
import { BadanPublik, EmailLog, SmtpConfig, User, Assignment } from '../models/index.js';
import emailEventBus from '../utils/eventBus.js';

const ATTACHMENT_LIMIT_BYTES = 2 * 1024 * 1024;

const formatBytes = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const getAttachmentSize = (att) => {
  if (att?.encoding === 'base64' && typeof att.content === 'string') {
    return Math.floor((att.content.length * 3) / 4);
  }
  return 0;
};

const isValidEmail = (val) => {
  if (!val) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
};

const emitLog = async (logId) => {
  try {
    const log = await EmailLog.findByPk(logId, {
      attributes: { exclude: ['attachments_data'] },
      include: [
        { model: User, as: 'user', attributes: ['username'] },
        { model: BadanPublik, as: 'badanPublik', attributes: ['nama_badan_publik'] }
      ]
    });
    if (log) {
      emailEventBus.emit('log', log.toJSON ? log.toJSON() : log);
    }
  } catch (err) {
    console.error('Gagal broadcast log', err);
  }
};

// Mengirim email ke daftar badan publik menggunakan SMTP milik user (mendukung template + lampiran)
const sendBulkEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      badan_publik_ids,
      subject,
      body,
      subject_template,
      body_template,
      meta,
      attachments
    } = req.body;

    if (!Array.isArray(badan_publik_ids) || badan_publik_ids.length === 0) {
      return res.status(400).json({ message: 'Pilih minimal satu badan publik' });
    }

    if (!(subject || subject_template) || !(body || body_template)) {
      return res.status(400).json({ message: 'Subjek dan isi email wajib diisi' });
    }

    const smtpConfig = await SmtpConfig.findOne({ where: { user_id: userId } });

    if (!smtpConfig) {
      return res.status(400).json({ message: 'Konfigurasi SMTP belum tersedia' });
    }

    // Quota check
    const user = await User.findByPk(userId);
    if (!user) return res.status(400).json({ message: 'User tidak ditemukan' });
    const today = new Date().toISOString().slice(0, 10);
    if (user.last_reset_date !== today) {
      user.used_today = 0;
      user.last_reset_date = today;
      await user.save();
    }
    const remaining = Math.max(user.daily_quota - user.used_today, 0);
    if (badan_publik_ids.length > remaining) {
      return res
        .status(400)
        .json({ message: `Kuota harian tersisa ${remaining}. Kurangi penerima atau ajukan kuota.` });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpConfig.email_address,
        pass: smtpConfig.app_password
      }
    });
    try {
      await transporter.verify();
    } catch (err) {
      return res.status(400).json({
        message:
          'Login SMTP gagal. Periksa email + App Password Gmail, pastikan 2FA aktif dan IMAP diaktifkan.',
        detail: err.message
      });
    }

    const results = [];
    const safeAttachments = Array.isArray(attachments)
      ? attachments
          .filter((a) => a?.filename && a?.content)
          .map((a) => ({
            filename: a.filename,
            content: a.content,
            encoding: a.encoding || 'base64',
            contentType: a.contentType
          }))
      : [];

    const attachmentsMeta = safeAttachments.map((att) => {
      const size = getAttachmentSize(att);
      return {
        filename: att.filename,
        contentType: att.contentType,
        size,
        readableSize: formatBytes(size)
      };
    });

    const totalAttachmentBytes = safeAttachments.reduce(
      (acc, att) => acc + getAttachmentSize(att),
      0
    );

    if (totalAttachmentBytes > ATTACHMENT_LIMIT_BYTES) {
      return res
        .status(400)
        .json({ message: 'Lampiran terlalu besar (>2MB). Kompres atau perkecil file KTP.' });
    }

    const safeMeta = meta || {};
    const escapeHtml = (val) =>
      String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const toHtml = (val) => {
      if (val == null) return '';
      return escapeHtml(val).replace(/\n/g, '<br/>');
    };

    const buildReplacements = (target) => {
      const base = {
        nama_badan_publik: target?.nama_badan_publik || '',
        kategori: target?.kategori || '',
        email: target?.email || '',
        pertanyaan: toHtml(target?.pertanyaan || ''),
        pemohon: toHtml(safeMeta.pemohon),
        tujuan: toHtml(safeMeta.tujuan),
        tanggal: toHtml(safeMeta.tanggal || new Date().toLocaleDateString('id-ID')),
        asal_kampus: toHtml(safeMeta.asal_kampus),
        prodi: toHtml(safeMeta.prodi),
        nama_media: toHtml(safeMeta.nama_media),
        deadline: toHtml(safeMeta.deadline)
      };
      const customFields = safeMeta.custom_fields || {};
      Object.entries(customFields).forEach(([key, val]) => {
        base[key] = toHtml(val);
      });
      Object.entries(safeMeta).forEach(([key, val]) => {
        if (['pemohon', 'tujuan', 'tanggal', 'custom_fields'].includes(key)) return;
        if (base[key] === undefined) {
          base[key] = toHtml(val);
        }
      });
      return base;
    };

    const renderTemplate = (tpl, target, isBody = false) => {
      if (!tpl) return '';
      const replacements = buildReplacements(target);
      let output = tpl.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) =>
        replacements[key] != null ? replacements[key] : ''
      );
      return isBody ? output.replace(/\n/g, '<br/>') : output;
    };

    let allowedIds = null;
    if (req.user.role !== 'admin') {
      const assignments = await Assignment.findAll({
        where: { user_id: userId },
        attributes: ['badan_publik_id']
      });
      allowedIds = new Set(assignments.map((a) => a.badan_publik_id));
    }

    for (const targetId of badan_publik_ids) {
      if (allowedIds && !allowedIds.has(targetId)) {
        results.push({ id: targetId, status: 'failed', reason: 'Tidak punya akses ke badan publik ini' });
        continue;
      }

      const target = await BadanPublik.findByPk(targetId);

      if (!target) {
        results.push({ id: targetId, status: 'failed', reason: 'Data tidak ditemukan' });
        continue;
      }

      if (!isValidEmail(target.email)) {
        const failedLog = await EmailLog.create({
          user_id: userId,
          badan_publik_id: target.id,
          subject: subject || subject_template || '(tidak ada subjek)',
          body: body || body_template || '',
          status: 'failed',
          message_id: null,
          attachments_meta: attachmentsMeta,
          attachments_data: safeAttachments,
          error_message: 'Email tujuan kosong/invalid',
          sent_at: new Date()
        });
        emitLog(failedLog.id);
        results.push({ id: target.id, status: 'failed', reason: 'Email tujuan kosong/invalid' });
        continue;
      }

      const finalSubject = renderTemplate(subject_template || subject, target);
      const finalBody = renderTemplate(body_template || body, target, true);

      try {
        const info = await transporter.sendMail({
          from: smtpConfig.email_address,
          to: target.email,
          subject: finalSubject,
          html: finalBody,
          text: finalBody,
          attachments: safeAttachments
        });

        await target.update({
          sent_count: target.sent_count + 1,
          status: 'sent'
        });

        const newLog = await EmailLog.create({
          user_id: userId,
          badan_publik_id: target.id,
          subject: finalSubject,
          body: finalBody,
          status: 'success',
          message_id: info?.messageId || null,
          attachments_meta: attachmentsMeta,
          attachments_data: safeAttachments,
          sent_at: new Date()
        });

        emitLog(newLog.id);
        results.push({ id: target.id, status: 'success' });
        user.used_today += 1;
      } catch (err) {
        console.error(err);
        if (err?.code === 'EAUTH' || err?.responseCode === 535) {
          return res.status(400).json({
            message:
              'Login SMTP gagal. Periksa email + App Password Gmail, pastikan 2FA aktif dan IMAP diaktifkan.',
            detail: err.message,
            results
          });
        }
        const failedLog = await EmailLog.create({
          user_id: userId,
          badan_publik_id: target.id,
          subject: finalSubject,
          body: finalBody,
          status: 'failed',
          message_id: null,
          attachments_meta: attachmentsMeta,
          attachments_data: safeAttachments,
          error_message: err.message,
          sent_at: new Date()
        });
        emitLog(failedLog.id);
        results.push({
          id: target.id,
          status: 'failed',
          reason: `Gagal mengirim email: ${err.message || 'unknown'}`
        });
      }
    }

    // simpan pemakaian kuota jika ada sukses
    await user.save();

    return res.json({ message: 'Proses pengiriman selesai', results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengirim email' });
  }
};

// Mengambil riwayat pengiriman email (user hanya melihat log sendiri)
const getEmailLogs = async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { user_id: req.user.id };
    const logs = await EmailLog.findAll({
      where,
      attributes: { exclude: ['attachments_data'] },
      include: [
        { model: User, as: 'user', attributes: ['username'] },
        { model: BadanPublik, as: 'badanPublik', attributes: ['nama_badan_publik'] }
      ],
      order: [['sent_at', 'DESC']]
    });

    return res.json(logs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil riwayat email' });
  }
};

// SSE stream agar front-end dapat update realtime
const streamEmailLogs = async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders?.();

  // Ping untuk menjaga koneksi tetap hidup
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 25000);

  const listener = (log) => {
    if (!log) return;
    if (req.user.role !== 'admin' && log.user_id !== req.user.id) return;
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  };

  emailEventBus.on('log', listener);

  req.on('close', () => {
    clearInterval(heartbeat);
    emailEventBus.removeListener('log', listener);
    res.end();
  });
};

// Mengulang pengiriman email berdasarkan log tertentu
const retryEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await EmailLog.findByPk(id);
    if (!log) return res.status(404).json({ message: 'Log tidak ditemukan' });
    if (req.user.role !== 'admin' && log.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Tidak boleh retry log user lain' });
    }
    const smtpConfig = await SmtpConfig.findOne({ where: { user_id: log.user_id } });
    if (!smtpConfig) return res.status(400).json({ message: 'User belum memiliki SMTP' });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpConfig.email_address,
        pass: smtpConfig.app_password
      }
    });

    try {
      await transporter.verify();
    } catch (err) {
      return res.status(400).json({ message: 'SMTP tidak valid saat retry', detail: err.message });
    }

    const badan = await BadanPublik.findByPk(log.badan_publik_id);
    if (!badan || !isValidEmail(badan.email)) {
      return res.status(400).json({ message: 'Email tujuan tidak valid untuk retry' });
    }

    const safeAttachments = Array.isArray(log.attachments_data) ? log.attachments_data : [];
    const attachmentsMeta = safeAttachments.map((att) => {
      const size = getAttachmentSize(att);
      return {
        filename: att.filename,
        contentType: att.contentType,
        size,
        readableSize: formatBytes(size)
      };
    });

    const info = await transporter.sendMail({
      from: smtpConfig.email_address,
      to: badan.email,
      subject: log.subject,
      html: log.body,
      text: log.body,
      attachments: safeAttachments
    });

    const newLog = await EmailLog.create({
      user_id: log.user_id,
      badan_publik_id: log.badan_publik_id,
      subject: log.subject,
      body: log.body,
      status: 'success',
      message_id: info?.messageId || null,
      attachments_meta: attachmentsMeta,
      attachments_data: safeAttachments,
      retry_of_id: log.id,
      sent_at: new Date()
    });
    emitLog(newLog.id);
    return res.json({ message: 'Retry berhasil dikirim', log: newLog });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal retry email' });
  }
};

export {
  sendBulkEmail,
  getEmailLogs,
  streamEmailLogs,
  retryEmail
};
