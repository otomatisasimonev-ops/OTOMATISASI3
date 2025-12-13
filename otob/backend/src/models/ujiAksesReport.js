const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UjiAksesReport = sequelize.define(
    'UjiAksesReport',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      badan_publik_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('draft', 'submitted'),
        allowNull: false,
        defaultValue: 'draft'
      },
      total_skor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      answers: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
      },
      evidences: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      tableName: 'uji_akses_reports',
      indexes: [{ fields: ['user_id'] }, { fields: ['badan_publik_id'] }, { fields: ['status'] }]
    }
  );

  return UjiAksesReport;
};

