const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const { sequelize, User } = require('./models');

dotenv.config();

// Seeder ringan untuk membuat akun admin dan user demo
const seed = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const defaults = [
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'user', password: 'user123', role: 'user' }
    ];

    for (const entry of defaults) {
      const existing = await User.findOne({ where: { username: entry.username } });
      if (!existing) {
        const hashed = await bcrypt.hash(entry.password, 10);
        await User.create({
          username: entry.username,
          password: hashed,
          role: entry.role
        });
        console.log(`Akun ${entry.username} dibuat (pwd: ${entry.password})`);
      }
    }

    console.log('Seeding selesai');
  } catch (err) {
    console.error('Gagal seed', err);
  } finally {
    process.exit(0);
  }
};

seed();
