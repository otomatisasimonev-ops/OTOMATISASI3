const nodemailer = require('nodemailer');
const { BadanPublik, EmailLog, SmtpConfig, User } = require('../models');
const emailEventBus = require('../utils/eventBus');

const ATTACHMENT_LIMIT_BYTES = 7 * 1024 * 1024;

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

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpConfig.email_address,
        pass: smtpConfig.app_password
      }
    });

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
        .json({ message: 'Lampiran terlalu besar (>7MB). Kompres atau perkecil file KTP.' });
    }

    const toHtml = (val) => {
      if (!val) return '';
      return String(val).replace(/\n/g, '<br/>');
    };

    const renderTemplate = (tpl, target) => {
      if (!tpl) return '';
      const replacements = {
        '{{nama_badan_publik}}': target.nama_badan_publik || '',
        '{{kategori}}': target.kategori || '',
        '{{email}}': target.email || '',
        '{{pertanyaan}}': toHtml(target.pertanyaan),
        '{{pemohon}}': toHtml(meta?.pemohon),
        '{{tujuan}}': toHtml(meta?.tujuan),
        '{{tanggal}}': toHtml(meta?.tanggal || new Date().toLocaleDateString('id-ID'))
      };
      let output = tpl;
      Object.entries(replacements).forEach(([key, val]) => {
        output = output.replaceAll(key, val);
      });
      return output;
    };

    for (const targetId of badan_publik_ids) {
      const target = await BadanPublik.findByPk(targetId);

      if (!target) {
        results.push({ id: targetId, status: 'failed', reason: 'Data tidak ditemukan' });
        continue;
      }

      const finalSubject = renderTemplate(subject_template || subject, target);
      const finalBody = renderTemplate(body_template || body, target);

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
      } catch (err) {
        console.error(err);
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
        results.push({ id: target.id, status: 'failed', reason: 'Gagal mengirim email' });
      }
    }

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
    const requesterId = req.user.id;

    const log = await EmailLog.findByPk(id);

    if (!log) {
      return res.status(404).json({ message: 'Log tidak ditemukan' });
    }

    if (req.user.role !== 'admin' && log.user_id !== requesterId) {
      return res.status(403).json({ message: 'Akses ditolak untuk log ini' });
    }

    const target = await BadanPublik.findByPk(log.badan_publik_id);
    if (!target) {
      return res.status(404).json({ message: 'Data badan publik tidak ditemukan' });
    }

    const smtpConfig = await SmtpConfig.findOne({ where: { user_id: requesterId } });

    if (!smtpConfig) {
      return res.status(400).json({ message: 'Konfigurasi SMTP belum tersedia' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpConfig.email_address,
        pass: smtpConfig.app_password
      }
    });

    const attachmentsData = Array.isArray(log.attachments_data) ? log.attachments_data : [];
    const attachmentsMeta = Array.isArray(log.attachments_meta) ? log.attachments_meta : [];

    try {
      const info = await transporter.sendMail({
        from: smtpConfig.email_address,
        to: target.email,
        subject: log.subject,
        html: log.body,
        text: log.body,
        attachments: attachmentsData
      });

      await target.update({
        sent_count: target.sent_count + 1,
        status: 'sent'
      });

      const newLog = await EmailLog.create({
        user_id: requesterId,
        badan_publik_id: target.id,
        subject: log.subject,
        body: log.body,
        status: 'success',
        message_id: info?.messageId || null,
        attachments_meta: attachmentsMeta,
        attachments_data: attachmentsData,
        retry_of_id: log.id,
        sent_at: new Date()
      });
      emitLog(newLog.id);

      return res.json({ message: 'Email berhasil dikirim ulang', log_id: newLog.id });
    } catch (err) {
      console.error(err);
      const failedLog = await EmailLog.create({
        user_id: requesterId,
        badan_publik_id: target.id,
        subject: log.subject,
        body: log.body,
        status: 'failed',
        message_id: null,
        attachments_meta: attachmentsMeta,
        attachments_data: attachmentsData,
        retry_of_id: log.id,
        error_message: err.message,
        sent_at: new Date()
      });
      emitLog(failedLog.id);
      return res.status(500).json({ message: 'Gagal mengirim ulang email', detail: err.message });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengirim ulang email' });
  }
};

module.exports = {
  sendBulkEmail,
  getEmailLogs,
  streamEmailLogs,
  retryEmail
};
