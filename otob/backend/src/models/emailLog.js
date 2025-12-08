const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmailLog = sequelize.define(
    'EmailLog',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      badan_publik_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'BadanPublik',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false
      },
      body: {
        type: DataTypes.TEXT('long'),
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('success', 'failed'),
        allowNull: false
      },
      message_id: {
        type: DataTypes.STRING,
        allowNull: true
      },
      attachments_meta: {
        type: DataTypes.JSON,
        allowNull: true
      },
      attachments_data: {
        // Menyimpan attachments base64 agar bisa di-retry
        type: DataTypes.JSON,
        allowNull: true
      },
      retry_of_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'EmailLogs',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'EmailLogs',
      updatedAt: false
    }
  );

  return EmailLog;
};
