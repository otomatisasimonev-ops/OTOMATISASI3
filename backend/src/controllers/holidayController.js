import { Op } from "sequelize";
import { Holiday } from "../models/index.js";

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const listHolidays = async (req, res) => {
  try {
    const today = getTodayDate();

    // Hapus libur yang sudah lewat
    await Holiday.destroy({
      where: { date: { [Op.lt]: today } },
    });

    const holidays = await Holiday.findAll({
      order: [["date", "ASC"]],
    });

    return res.json(holidays);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal memuat daftar libur" });
  }
};

const createHoliday = async (req, res) => {
  try {
    const { date, name } = req.body;

    if (!date || !name) {
      return res.status(400).json({ message: "Tanggal dan nama wajib diisi" });
    }

    const today = getTodayDate();
    if (date < today) {
      return res
        .status(400)
        .json({ message: "Tanggal libur tidak boleh di masa lalu" });
    }

    const existing = await Holiday.findOne({ where: { date } });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Tanggal ini sudah terdaftar sebagai libur" });
    }

    const holiday = await Holiday.create({ date, name });
    return res.status(201).json(holiday);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal menambah libur" });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Holiday.destroy({ where: { id } });

    if (!deleted) {
      return res.status(404).json({ message: "Libur tidak ditemukan" });
    }

    return res.json({ message: "Libur dihapus" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal menghapus libur" });
  }
};

export { listHolidays, createHoliday, deleteHoliday };
