/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const ensureDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    // ignore
  }
};

const run = async () => {
  const qi = sequelize.getQueryInterface();
  const tables = await qi.showAllTables();
  const exists = (tables || []).some((t) => String(t).toLowerCase() === 'uji_akses_reports');
  if (exists) {
    console.log('Table uji_akses_reports already exists.');
    return;
  }

  await qi.createTable('uji_akses_reports', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    badan_publik_id: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM('draft', 'submitted'), allowNull: false, defaultValue: 'draft' },
    total_skor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    answers: { type: DataTypes.JSON, allowNull: false },
    evidences: { type: DataTypes.JSON, allowNull: false },
    submitted_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false }
  });

  console.log('Created table uji_akses_reports.');

  const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'uji-akses-reports');
  ensureDir(uploadsDir);
  console.log(`Ensured uploads dir: ${uploadsDir}`);
};

run()
  .then(() => sequelize.close())
  .catch((err) => {
    console.error(err);
    sequelize.close().finally(() => process.exit(1));
  });

