const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BadanPublik = sequelize.define(
    'BadanPublik',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      nama_badan_publik: {
        type: DataTypes.STRING,
        allowNull: false
      },
      kategori: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true
        }
      },
      website: {
        type: DataTypes.STRING,
        allowNull: true
      },
      pertanyaan: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending'
      },
      sent_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    },
    {
      tableName: 'BadanPublik'
    }
  );

  return BadanPublik;
};
