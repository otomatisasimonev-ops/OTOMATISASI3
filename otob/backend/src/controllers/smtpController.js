import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { SmtpConfig } from '../models';

// Simpan atau perbarui SMTP per user
const saveSmtpConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email_address, app_password } = req.body;

    if (!email_address || !app_password) {
      return res.status(400).json({ message: 'Email dan App Password wajib diisi' });
    }

    await SmtpConfig.upsert({
      user_id: userId,
      email_address,
      app_password
    });

    return res.json({ message: 'Konfigurasi SMTP tersimpan' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal menyimpan SMTP' });
  }
};

// Mengecek apakah user sudah punya SMTP
const checkSmtpConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const config = await SmtpConfig.findOne({ where: { user_id: userId } });

    return res.json({ hasConfig: Boolean(config) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengecek SMTP' });
  }
};

// Verifikasi kredensial SMTP (tanpa menyimpan) untuk memastikan bisa login ke Gmail SMTP
const verifySmtpConfig = async (req, res) => {
  try {
    const { email_address, app_password } = req.body || {};
    let userEmail = email_address;
    let userPass = app_password;

    // Jika body kosong, gunakan kredensial tersimpan milik user
    if (!userEmail || !userPass) {
      const stored = await SmtpConfig.findOne({ where: { user_id: req.user.id } });
      if (!stored) {
        return res.status(400).json({ message: 'SMTP belum disetel. Isi email + App Password dulu.' });
      }
      userEmail = stored.email_address;
      userPass = stored.app_password;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: userEmail,
        pass: userPass
      }
    });

    try {
      await transporter.verify();
      return res.json({ message: 'SMTP valid. Siap digunakan untuk mengirim email.' });
    } catch (err) {
      console.error('SMTP verify failed', err);
      return res.status(400).json({
        message:
          'SMTP tidak valid. Periksa email + App Password Gmail, pastikan 2FA aktif dan IMAP diaktifkan.',
        detail: err.message
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memverifikasi SMTP' });
  }
};

// Verifikasi IMAP Gmail
const verifyImapConfig = async (req, res) => {
  try {
    const { email_address, app_password } = req.body || {};
    if (!email_address || !app_password) {
      return res.status(400).json({ message: 'Email dan App Password wajib diisi' });
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: email_address,
        pass: app_password
      }
    });

    try {
      await client.connect();
      await client.logout();
      return res.json({ message: 'IMAP aktif dan kredensial valid.' });
    } catch (err) {
      console.error('IMAP verify failed', err);
      return res.status(400).json({
        message:
          err?.response || err?.message || 'IMAP gagal diverifikasi. Pastikan IMAP diaktifkan dan App Password benar.'
      });
    } finally {
      client.close?.();
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memverifikasi IMAP' });
  }
};

export {
  saveSmtpConfig,
  checkSmtpConfig,
  verifySmtpConfig,
  verifyImapConfig
};
