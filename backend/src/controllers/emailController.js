import nodemailer from "nodemailer";
import { Op } from "sequelize";
import {
  BadanPublik,
  EmailLog,
  SmtpConfig,
  User,
  Assignment,
} from "../models/index.js";
import emailEventBus from "../utils/eventBus.js";

// Constants
const ATTACHMENT_LIMIT_BYTES = 2 * 1024 * 1024;
const SSE_HEARTBEAT_INTERVAL = 25000;

// Helper functions
const isValidEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const formatBytes = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    sizes.length - 1
  );
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const getAttachmentSize = (attachment) => {
  if (
    attachment?.encoding === "base64" &&
    typeof attachment.content === "string"
  ) {
    return Math.floor((attachment.content.length * 3) / 4);
  }
  return 0;
};

const escapeHtml = (val) =>
  String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toHtml = (val) => {
  if (val == null) return "";
  return escapeHtml(val).replace(/\n/g, "<br/>");
};

const normalizeAttachments = (attachments) => {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .filter((a) => a?.filename && a?.content)
    .map((a) => ({
      filename: a.filename,
      content: a.content,
      encoding: a.encoding || "base64",
      contentType: a.contentType,
    }));
};

const getAttachmentsMeta = (attachments) => {
  return attachments.map((att) => {
    const size = getAttachmentSize(att);
    return {
      filename: att.filename,
      contentType: att.contentType,
      size,
      readableSize: formatBytes(size),
    };
  });
};

const buildReplacements = (target, meta = {}) => {
  const base = {
    nama_badan_publik: target?.nama_badan_publik || "",
    kategori: target?.kategori || "",
    email: target?.email || "",
    pertanyaan: toHtml(target?.pertanyaan),
    pemohon: toHtml(meta.pemohon),
    tujuan: toHtml(meta.tujuan),
    tanggal: toHtml(meta.tanggal || new Date().toLocaleDateString("id-ID")),
    asal_kampus: toHtml(meta.asal_kampus),
    prodi: toHtml(meta.prodi),
    nama_media: toHtml(meta.nama_media),
    deadline: toHtml(meta.deadline),
  };

  // Add custom fields
  const customFields = meta.custom_fields || {};
  Object.entries(customFields).forEach(([key, val]) => {
    base[key] = toHtml(val);
  });

  // Add remaining meta fields
  Object.entries(meta).forEach(([key, val]) => {
    if (["pemohon", "tujuan", "tanggal", "custom_fields"].includes(key)) return;
    if (base[key] === undefined) {
      base[key] = toHtml(val);
    }
  });

  return base;
};

const renderTemplate = (template, target, meta, isBody = false) => {
  if (!template) return "";

  const replacements = buildReplacements(target, meta);
  let output = template.replace(
    /{{\s*([\w.]+)\s*}}/g,
    (_, key) => replacements[key] ?? ""
  );

  return isBody ? output.replace(/\n/g, "<br/>") : output;
};

const emitLog = async (logId) => {
  try {
    const log = await EmailLog.findByPk(logId, {
      attributes: { exclude: ["attachments_data"] },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "email", "nomer_hp"],
        },
        {
          model: BadanPublik,
          as: "badanPublik",
          attributes: ["id", "nama_badan_publik", "kategori", "status"],
        },
      ],
    });

    if (log) {
      emailEventBus.emit("log", log.toJSON ? log.toJSON() : log);
    }
  } catch (err) {
    console.error("Gagal broadcast log", err);
  }
};

const createTransporter = (smtpConfig) => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 0);
  const smtpSecureEnv = process.env.SMTP_SECURE;
  const smtpService = process.env.SMTP_SERVICE;

  if (smtpHost) {
    const secure = smtpSecureEnv
      ? smtpSecureEnv === "true"
      : smtpPort === 465;
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort || 2525,
      secure,
      auth: {
        user: smtpConfig.email_address,
        pass: smtpConfig.app_password,
      },
    });
  }

  return nodemailer.createTransport({
    service: smtpService || "gmail",
    auth: {
      user: smtpConfig.email_address,
      pass: smtpConfig.app_password,
    },
  });
};

const verifySmtpConnection = async (transporter) => {
  try {
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      message:
        "Login SMTP gagal. Periksa kredensial SMTP dan pastikan akses SMTP diaktifkan.",
      detail: err.message,
    };
  }
};

const checkUserQuota = async (user, requiredQuota) => {
  const today = new Date().toISOString().slice(0, 10);

  if (user.last_reset_date !== today) {
    user.used_today = 0;
    user.last_reset_date = today;
    await user.save();
  }

  const remaining = Math.max(user.daily_quota - user.used_today, 0);

  if (requiredQuota > remaining) {
    return {
      valid: false,
      message: `Kuota harian tersisa ${remaining}. Kurangi penerima atau ajukan kuota.`,
    };
  }

  return { valid: true, remaining };
};

const createEmailLog = async (data) => {
  const log = await EmailLog.create(data);
  await emitLog(log.id);
  return log;
};

// Mengirim email ke daftar badan publik
const sendBulkEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      badan_publik_ids,
      subject,
      body,
      subject_template,
      body_template,
      meta = {},
      attachments,
    } = req.body;

    // Validasi input
    if (!Array.isArray(badan_publik_ids) || !badan_publik_ids.length) {
      return res
        .status(400)
        .json({ message: "Pilih minimal satu badan publik" });
    }

    if (!(subject || subject_template) || !(body || body_template)) {
      return res
        .status(400)
        .json({ message: "Subjek dan isi email wajib diisi" });
    }

    // Get SMTP config
    const smtpConfig = await SmtpConfig.findOne({ where: { user_id: userId } });
    if (!smtpConfig) {
      return res
        .status(400)
        .json({ message: "Konfigurasi SMTP belum tersedia" });
    }

    // Check quota
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(400).json({ message: "User tidak ditemukan" });
    }

    const quotaCheck = await checkUserQuota(user, badan_publik_ids.length);
    if (!quotaCheck.valid) {
      return res.status(400).json({ message: quotaCheck.message });
    }

    // Verify SMTP
    const transporter = createTransporter(smtpConfig);
    const smtpVerification = await verifySmtpConnection(transporter);
    if (!smtpVerification.success) {
      return res.status(400).json({
        message: smtpVerification.message,
        detail: smtpVerification.detail,
      });
    }

    // Process attachments
    const safeAttachments = normalizeAttachments(attachments);
    const attachmentsMeta = getAttachmentsMeta(safeAttachments);

    const totalAttachmentBytes = safeAttachments.reduce(
      (acc, att) => acc + getAttachmentSize(att),
      0
    );

    if (totalAttachmentBytes > ATTACHMENT_LIMIT_BYTES) {
      return res.status(400).json({
        message:
          "Lampiran terlalu besar (>2MB). Kompres atau perkecil file KTP.",
      });
    }

    // Get allowed IDs for non-admin users
    let allowedIds = null;
    if (req.user.role !== "admin") {
      const assignments = await Assignment.findAll({
        where: { user_id: userId },
        attributes: ["badan_publik_id"],
      });
      allowedIds = new Set(assignments.map((a) => a.badan_publik_id));
    }

    // Process each recipient
    const results = [];
    for (const targetId of badan_publik_ids) {
      // Check access
      if (allowedIds && !allowedIds.has(targetId)) {
        results.push({
          id: targetId,
          status: "failed",
          reason: "Tidak punya akses ke badan publik ini",
        });
        continue;
      }

      const target = await BadanPublik.findByPk(targetId);
      if (!target) {
        results.push({
          id: targetId,
          status: "failed",
          reason: "Data tidak ditemukan",
        });
        continue;
      }

      // Validate email
      if (!isValidEmail(target.email)) {
        await createEmailLog({
          user_id: userId,
          badan_publik_id: target.id,
          subject: subject || subject_template || "(tidak ada subjek)",
          body: body || body_template || "",
          status: "failed",
          message_id: null,
          attachments_meta: attachmentsMeta,
          attachments_data: safeAttachments,
          error_message: "Email tujuan kosong/invalid",
          sent_at: new Date(),
        });

        results.push({
          id: target.id,
          status: "failed",
          reason: "Email tujuan kosong/invalid",
        });
        continue;
      }

      // Render templates
      const finalSubject = renderTemplate(
        subject_template || subject,
        target,
        meta
      );
      const finalBody = renderTemplate(
        body_template || body,
        target,
        meta,
        true
      );

      try {
        const info = await transporter.sendMail({
          from: smtpConfig.email_address,
          to: target.email,
          subject: finalSubject,
          html: finalBody,
          text: finalBody,
          attachments: safeAttachments,
        });

        await target.update({
          sent_count: target.sent_count + 1,
          status: target.status === "selesai" ? "selesai" : "belum dibalas",
        });

        await createEmailLog({
          user_id: userId,
          badan_publik_id: target.id,
          subject: finalSubject,
          body: finalBody,
          status: "success",
          message_id: info?.messageId || null,
          attachments_meta: attachmentsMeta,
          attachments_data: safeAttachments,
          sent_at: new Date(),
        });

        results.push({ id: target.id, status: "success" });
        user.used_today += 1;
      } catch (err) {
        console.error(err);

        if (err?.code === "EAUTH" || err?.responseCode === 535) {
          return res.status(400).json({
            message:
              "Login SMTP gagal. Periksa email + App Password Gmail, pastikan 2FA aktif dan IMAP diaktifkan.",
            detail: err.message,
            results,
          });
        }

        await createEmailLog({
          user_id: userId,
          badan_publik_id: target.id,
          subject: finalSubject,
          body: finalBody,
          status: "failed",
          message_id: null,
          attachments_meta: attachmentsMeta,
          attachments_data: safeAttachments,
          error_message: err.message,
          sent_at: new Date(),
        });

        results.push({
          id: target.id,
          status: "failed",
          reason: `Gagal mengirim email: ${err.message || "unknown"}`,
        });
      }
    }

    await user.save();
    return res.json({ message: "Proses pengiriman selesai", results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengirim email" });
  }
};

// Mengambil riwayat pengiriman email
const getEmailLogs = async (req, res) => {
  try {
    const where = req.user.role === "admin" ? {} : { user_id: req.user.id };

    const logs = await EmailLog.findAll({
      where,
      attributes: { exclude: ["attachments_data"] },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "email", "nomer_hp"],
        },
        {
          model: BadanPublik,
          as: "badanPublik",
          attributes: ["id", "nama_badan_publik", "kategori", "status"],
        },
      ],
      order: [["sent_at", "DESC"]],
    });

    return res.json(logs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil riwayat email" });
  }
};

// SSE stream untuk update realtime
const streamEmailLogs = async (req, res) => {
  // Set SSE headers dengan CORS untuk cross-origin streaming
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
    "Access-Control-Allow-Origin": process.env.CLIENT_URL || 'http://localhost:5173',
    "Access-Control-Allow-Credentials": "true",
  });
  
  // Disable timeout untuk SSE
  req.socket.setKeepAlive(true);
  req.socket.setTimeout(0);
  
  res.flushHeaders?.();

  // Send initial connection message
  res.write(`: connected\n\n`);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": keep-alive\n\n");
    }
  }, SSE_HEARTBEAT_INTERVAL);

  const listener = (log) => {
    if (!log) return;
    if (req.user.role !== "admin" && log.user_id !== req.user.id) return;
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    }
  };

  emailEventBus.on("log", listener);

  const cleanup = () => {
    clearInterval(heartbeat);
    emailEventBus.removeListener("log", listener);
    if (!res.writableEnded) {
      res.end();
    }
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
  res.on("error", cleanup);
};

// Menghapus log email (bulk)
const deleteEmailLogsBulk = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "IDs wajib diisi" });
    }

    const uniqueIds = [
      ...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))),
    ];

    if (!uniqueIds.length) {
      return res.status(400).json({ message: "IDs tidak valid" });
    }

    const where = req.user.role === "admin"
      ? { id: { [Op.in]: uniqueIds } }
      : { id: { [Op.in]: uniqueIds }, user_id: req.user.id };

    const deleted = await EmailLog.destroy({ where });

    return res.json({
      message: `Berhasil menghapus ${deleted} log.`,
      deleted,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal menghapus log terpilih" });
  }
};

// Mengulang pengiriman email
const retryEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await EmailLog.findByPk(id);
    if (!log) {
      return res.status(404).json({ message: "Log tidak ditemukan" });
    }

    if (req.user.role !== "admin" && log.user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Tidak boleh retry log user lain" });
    }

    const smtpConfig = await SmtpConfig.findOne({
      where: { user_id: log.user_id },
    });
    if (!smtpConfig) {
      return res.status(400).json({ message: "User belum memiliki SMTP" });
    }

    const transporter = createTransporter(smtpConfig);
    const smtpVerification = await verifySmtpConnection(transporter);
    if (!smtpVerification.success) {
      return res.status(400).json({
        message: "SMTP tidak valid saat retry",
        detail: smtpVerification.detail,
      });
    }

    const badan = await BadanPublik.findByPk(log.badan_publik_id);
    if (!badan || !isValidEmail(badan.email)) {
      return res
        .status(400)
        .json({ message: "Email tujuan tidak valid untuk retry" });
    }

    const safeAttachments = normalizeAttachments(log.attachments_data);
    const attachmentsMeta = getAttachmentsMeta(safeAttachments);

    const info = await transporter.sendMail({
      from: smtpConfig.email_address,
      to: badan.email,
      subject: log.subject,
      html: log.body,
      text: log.body,
      attachments: safeAttachments,
    });

    const newLog = await createEmailLog({
      user_id: log.user_id,
      badan_publik_id: log.badan_publik_id,
      subject: log.subject,
      body: log.body,
      status: "success",
      message_id: info?.messageId || null,
      attachments_meta: attachmentsMeta,
      attachments_data: safeAttachments,
      retry_of_id: log.id,
      sent_at: new Date(),
    });

    return res.json({ message: "Retry berhasil dikirim", log: newLog });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal retry email" });
  }
};

export { sendBulkEmail, getEmailLogs, streamEmailLogs, deleteEmailLogsBulk, retryEmail };
