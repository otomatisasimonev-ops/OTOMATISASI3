import { Sequelize } from "sequelize";
import db from "../config/database.js";

const Holiday = db.define("Holiday", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  date: {
    type: Sequelize.DATEONLY,
    allowNull: false,
    unique: true,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
}, {
  tableName: "Holidays",
});
export default Holiday;

