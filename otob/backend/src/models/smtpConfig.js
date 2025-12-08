const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SmtpConfig = sequelize.define(
    'SmtpConfig',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      email_address: {
        type: DataTypes.STRING,
        allowNull: false
      },
      app_password: {
        type: DataTypes.STRING,
        allowNull: false
      }
    },
    {
      tableName: 'SmtpConfigs'
    }
  );

  return SmtpConfig;
};
