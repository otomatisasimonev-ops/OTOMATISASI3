const { User } = require('../models');

// Middleware tanpa JWT: ambil user berdasarkan header atau default ke user pertama
module.exports = async (req, res, next) => {
  try {
    const headerUserId = req.headers['x-user-id'];
    const headerUsername = req.headers['x-username'];
    const queryUserId = req.query?.user_id || req.query?.userId;
    const queryUsername = req.query?.username;
    const defaultUserId = process.env.DEFAULT_USER_ID;

    let user = null;

    if (headerUserId) {
      user = await User.findByPk(headerUserId);
    }

    if (!user && queryUserId) {
      user = await User.findByPk(queryUserId);
    }

    if (!user && headerUsername) {
      user = await User.findOne({ where: { username: headerUsername } });
    }

    if (!user && queryUsername) {
      user = await User.findOne({ where: { username: queryUsername } });
    }

    if (!user && defaultUserId) {
      user = await User.findByPk(defaultUserId);
    }

    if (!user) {
      user = await User.findOne();
    }

    if (!user) {
      return res.status(401).json({ message: 'User tidak ditemukan. Isi tabel Users terlebih dulu.' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memuat user' });
  }
};
