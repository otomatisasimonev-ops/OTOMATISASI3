import { Sequelize } from "sequelize";
import db from "../config/database.js";

const SmtpConfig = db.define("SmtpConfig", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: "Users",
      key: "id",
    },
    onDelete: "CASCADE",
  },
  email_address: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  app_password: {
    type: Sequelize.STRING,
    allowNull: false,
  },
}, {
  tableName: "SmtpConfigs",
});

export default SmtpConfig;