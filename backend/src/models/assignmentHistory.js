import { Sequelize } from "sequelize";
import db from "../config/database.js";

const AssignmentHistory = db.define("AssignmentHistory", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  badan_publik_id: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  actor_id: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  action: {
    type: Sequelize.STRING,
    allowNull: false
  },
  note: {
    type: Sequelize.TEXT,
    allowNull: true
  }
}, {
  tableName: "AssignmentHistories"
});
export default AssignmentHistory;
