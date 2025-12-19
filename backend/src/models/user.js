import { Sequelize } from "sequelize";
import db from "../config/database.js";

const User = db.define(
  "User",
  {
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
    group: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    nomer_hp: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: true,
      validate: {
        isEmail: {
          args: true,
          msg: "Email tidak valid",
        },
      },
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
    refresh_token_hash: {
      type: Sequelize.STRING(128),
      allowNull: true,
    },
    refresh_expires_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    refresh_rotated_at: {
      type: Sequelize.DATE,
      allowNull: true,
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
  },
  {
    tableName: "Users",
  }
);

export default User;
