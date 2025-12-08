const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sequelize } = require('./models');
const authRoutes = require('./routes/authRoutes');
const configRoutes = require('./routes/configRoutes');
const badanPublikRoutes = require('./routes/badanPublikRoutes');
const emailRoutes = require('./routes/emailRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(
  express.json({
    limit: '25mb' // naikkan limit agar lampiran base64 tidak ditolak
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/config', configRoutes);
app.use('/badan-publik', badanPublikRoutes);
app.use('/email', emailRoutes);

// Bootstrapping server + koneksi database
const startServer = async () => {
  try {
    await sequelize.authenticate();
    // Gunakan alter agar kolom baru (message_id, attachments) otomatis ditambahkan
    await sequelize.sync({ alter: true });
    app.listen(PORT, () => {
      console.log(`Server berjalan pada port ${PORT}`);
    });
  } catch (err) {
    console.error('Gagal konek database', err);
    process.exit(1);
  }
};

startServer();
