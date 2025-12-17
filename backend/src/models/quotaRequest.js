import { Sequelize } from "sequelize";
import db from "../config/database.js";

const QuotaRequest = db.define("QuotaRequest", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  requested_quota: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  reason: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  status: {
    type: Sequelize.ENUM("pending", "approved", "rejected"),
    allowNull: false,
    defaultValue: "pending"
  },
  admin_note: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  responded_at: {
    type: Sequelize.DATE,
    allowNull: true
  },
  response_minutes: {
    type: Sequelize.INTEGER,
    allowNull: true
  }
}, {
  tableName: "QuotaRequests"
});
export default QuotaRequest;
