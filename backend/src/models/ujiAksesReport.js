import { Sequelize } from "sequelize";
import db from "../config/database.js";

const UjiAksesReport = db.define("UjiAksesReport", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  badan_publik_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  status: {
    type: Sequelize.ENUM("draft", "submitted"),
    allowNull: false,
    defaultValue: "draft",
  },
  total_skor: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  answers: {
    type: Sequelize.JSON,
    allowNull: false,
    defaultValue: {},
  },
  evidences: {
    type: Sequelize.JSON,
    allowNull: false,
    defaultValue: {},
  },
  submitted_at: {
    type: Sequelize.DATE,
    allowNull: true,
  },
}, {
  tableName: "uji_akses_reports",
  indexes: [
    { fields: ["user_id"] },
    { fields: ["badan_publik_id"] },
    { fields: ["status"] },
  ],
});
export default UjiAksesReport;
