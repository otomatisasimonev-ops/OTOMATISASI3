import { Sequelize } from "sequelize";
import db from "../config/database.js";

const EmailLog = db.define("EmailLog", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: "Users",
      key: "id",
    },
    onDelete: "CASCADE",
  },
  badan_publik_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: "BadanPublik",
      key: "id",
    },
    onDelete: "CASCADE",
  },
  subject: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  body: {
    type: Sequelize.TEXT("long"),
    allowNull: true,
  },
  status: {
    type: Sequelize.ENUM("success", "failed"),
    allowNull: false,
  },
  message_id: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  attachments_meta: {
    type: Sequelize.JSON,
    allowNull: true,
  },
  attachments_data: {
    // Menyimpan attachments base64 agar bisa di-retry
    type: Sequelize.JSON,
    allowNull: true,
  },
  retry_of_id: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: "EmailLogs",
      key: "id",
    },
    onDelete: "SET NULL",
  },
  error_message: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  sent_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
}, {
  tableName: "EmailLogs",
  updatedAt: false,
});
export default EmailLog;