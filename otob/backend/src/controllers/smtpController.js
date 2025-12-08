const { SmtpConfig } = require('../models');

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

module.exports = {
  saveSmtpConfig,
  checkSmtpConfig
};
