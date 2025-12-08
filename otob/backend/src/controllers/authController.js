const bcrypt = require('bcrypt');
const { User } = require('../models');

// Login tanpa JWT: hanya verifikasi kredensial lalu kembalikan profil user
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password wajib diisi' });
    }

    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({ message: 'Kredensial salah' });
    }

    // Izinkan password plain atau bcrypt-hash
    let passwordMatch = user.password === password;
    if (!passwordMatch) {
      try {
        passwordMatch = await bcrypt.compare(password, user.password);
      } catch (err) {
        passwordMatch = false;
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Kredensial salah' });
    }

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Terjadi kesalahan saat login' });
  }
};

module.exports = {
  login
};
