import { Sequelize } from "sequelize";
import db from "../config/database.js";

const BadanPublik = db.define("BadanPublik", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nama_badan_publik: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  kategori: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: null,
    validate: {
      isEmail: {
        args: true,
        msg: "Email tidak valid",
      },
    },
  },
  website: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  pertanyaan: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  status: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: "pending",
  },
  thread_id: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  sent_count: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: "BadanPublik",
});
export default BadanPublik;
