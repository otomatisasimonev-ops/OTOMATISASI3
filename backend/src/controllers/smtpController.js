import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { SmtpConfig } from "../models/index.js";

// Constants
const GMAIL_SMTP_CONFIG = {
  service: "gmail",
};

const GMAIL_IMAP_CONFIG = {
  host: "imap.gmail.com",
  port: 993,
  secure: true,
};

const ERROR_MESSAGES = {
  MISSING_CREDENTIALS: "Email dan App Password wajib diisi",
  NO_CONFIG: "SMTP belum disetel. Isi email + App Password dulu.",
  SMTP_INVALID:
    "SMTP tidak valid. Periksa email + App Password Gmail, pastikan 2FA aktif dan IMAP diaktifkan.",
  IMAP_INVALID:
    "IMAP gagal diverifikasi. Pastikan IMAP diaktifkan dan App Password benar.",
};

// Helper functions
const createSmtpTransporter = (email, password) => {
  return nodemailer.createTransport({
    ...GMAIL_SMTP_CONFIG,
    auth: { user: email, pass: password },
  });
};

const createImapClient = (email, password) => {
  return new ImapFlow({
    ...GMAIL_IMAP_CONFIG,
    auth: { user: email, pass: password },
  });
};

const getStoredCredentials = async (userId) => {
  const config = await SmtpConfig.findOne({ where: { user_id: userId } });
  if (!config) return null;

  return {
    email: config.email_address,
    password: config.app_password,
  };
};

// Simpan atau perbarui SMTP per user
const saveSmtpConfig = async (req, res) => {
  try {
    const { email_address, app_password } = req.body;

    if (!email_address || !app_password) {
      return res
        .status(400)
        .json({ message: ERROR_MESSAGES.MISSING_CREDENTIALS });
    }

    await SmtpConfig.upsert({
      user_id: req.user.id,
      email_address,
      app_password,
    });

    return res.json({ message: "Konfigurasi SMTP tersimpan" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal menyimpan SMTP" });
  }
};

// Mengecek apakah user sudah punya SMTP
const checkSmtpConfig = async (req, res) => {
  try {
    const config = await SmtpConfig.findOne({
      where: { user_id: req.user.id },
    });

    return res.json({ hasConfig: Boolean(config) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengecek SMTP" });
  }
};

// Verifikasi kredensial SMTP
const verifySmtpConfig = async (req, res) => {
  try {
    const { email_address, app_password } = req.body;
    let email = email_address;
    let password = app_password;

    // Gunakan kredensial tersimpan jika tidak ada di body
    if (!email || !password) {
      const stored = await getStoredCredentials(req.user.id);

      if (!stored) {
        return res.status(400).json({ message: ERROR_MESSAGES.NO_CONFIG });
      }

      email = stored.email;
      password = stored.password;
    }

    const transporter = createSmtpTransporter(email, password);

    try {
      await transporter.verify();
      return res.json({
        message: "SMTP valid. Siap digunakan untuk mengirim email.",
      });
    } catch (err) {
      console.error("SMTP verify failed", err);
      return res.status(400).json({
        message: ERROR_MESSAGES.SMTP_INVALID,
        detail: err.message,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal memverifikasi SMTP" });
  }
};

// Verifikasi IMAP Gmail
const verifyImapConfig = async (req, res) => {
  try {
    const { email_address, app_password } = req.body;

    if (!email_address || !app_password) {
      return res
        .status(400)
        .json({ message: ERROR_MESSAGES.MISSING_CREDENTIALS });
    }

    const client = createImapClient(email_address, app_password);

    try {
      await client.connect();
      await client.logout();
      return res.json({ message: "IMAP aktif dan kredensial valid." });
    } catch (err) {
      console.error("IMAP verify failed", err);
      return res.status(400).json({
        message: err?.response || err?.message || ERROR_MESSAGES.IMAP_INVALID,
      });
    } finally {
      client.close?.();
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal memverifikasi IMAP" });
  }
};

export { saveSmtpConfig, checkSmtpConfig, verifySmtpConfig, verifyImapConfig };
