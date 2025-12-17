import { Sequelize } from "sequelize";
import db from "../config/database.js";

const User = db.define("User", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  role: {
    type: Sequelize.ENUM("admin", "user"),
    allowNull: false,
    defaultValue: "user",
  },
  daily_quota: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 20,
  },
  used_today: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  last_reset_date: {
    type: Sequelize.DATEONLY,
    allowNull: true,
  },
  refresh_token: { type: Sequelize.TEXT, allowNull: true },
}, {
  tableName: "Users",
});

export default User;
