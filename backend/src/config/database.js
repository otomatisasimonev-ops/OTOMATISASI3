import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const DB_NAME = process.env.DB_NAME || 'oto2_db'
const DB_USERNAME = process.env.DB_USERNAME || 'root'
const DB_PASSWORD = process.env.DB_PASSWORD || ''
const DB_HOST = process.env.DB_HOST || 'localhost'
console.log("DB_HOST:", DB_HOST);

const db = new Sequelize(DB_NAME,DB_USERNAME,DB_PASSWORD,{
    host: DB_HOST,
    dialect:'mysql',
    //logging: (msg) => console.log("[SQL]", msg)
    logging: false
})


export default db;
