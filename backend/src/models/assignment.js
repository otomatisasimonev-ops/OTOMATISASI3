import { Sequelize } from "sequelize";
import db from "../config/database.js";

const Assignment = db.define("Assignment", {
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
  }
}, {
  tableName: "Assignments",
  indexes: [
    {
      unique: true,
      fields: ["user_id", "badan_publik_id"]
    }, 
    // Index bantu untuk pencarian tapi tidak memaksa unik (data lama bisa duplikat)
    { fields: ["badan_publik_id"] }
  ]
});
export default Assignment;