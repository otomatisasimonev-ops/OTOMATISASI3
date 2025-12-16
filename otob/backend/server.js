import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import {db} from "./src/models/index.js";

import authRoutes from "./src/routes/authRoutes.js";
import configRoutes from "./src/routes/configRoutes.js";
import badanPublikRoutes from "./src/routes/badanPublikRoutes.js";
import emailRoutes from "./src/routes/emailRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import assignmentRoutes from "./src/routes/assignmentRoutes.js";
import quotaRoutes from "./src/routes/quotaRoutes.js";
import holidayRoutes from "./src/routes/holidayRoutes.js";
import newsRoutes from "./src/routes/newsRoutes.js";
import ujiAksesReportRoutes from "./src/routes/ujiAksesReportRoutes.js";
import adminUjiAksesReportRoutes from "./src/routes/adminUjiAksesReportRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// __dirname replacement untuk ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(cookieParser());
// Catatan: untuk cookie auth, biasanya perlu konfigurasi cors lebih spesifik (origin + credentials).
app.use(cors());
app.use(
  express.json({
    limit: "25mb", // naikkan limit agar lampiran base64 tidak ditolak
  })
);

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/", (req, res) => {
  res.json({
    message: "Otomatisasi API is running",
    time: new Date().toString(),
  });
});

app.use("/auth", authRoutes);
app.use("/config", configRoutes);
app.use("/badan-publik", badanPublikRoutes);
app.use("/email", emailRoutes);
app.use("/users", userRoutes);
app.use("/assignments", assignmentRoutes);
app.use("/quota", quotaRoutes);
app.use("/holidays", holidayRoutes);
app.use("/news", newsRoutes);

// Static files untuk bukti dukung laporan uji akses
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Modul Laporan Uji Akses
app.use("/api/reports", ujiAksesReportRoutes);
app.use("/api/admin/reports", adminUjiAksesReportRoutes);

// Bootstrapping server + koneksi database
const startServer = async () => {
  try {
    await db.authenticate();
    // Gunakan alter agar kolom baru (message_id, attachments) otomatis ditambahkan
    await db.sync({ alter: true });

    app.listen(PORT, () => {
      console.log(`Server berjalan pada port ${PORT}`);
    });
  } catch (err) {
    console.error("Gagal konek database", err);
    process.exit(1);
  }
};

startServer();
