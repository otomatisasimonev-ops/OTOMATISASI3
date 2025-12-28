import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

import {db} from "./src/models/index.js";
import {User} from "./src/models/index.js";

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
import ujiAksesQuestionRoutes from "./src/routes/ujiAksesQuestionRoutes.js";
import { seedUjiAksesQuestionsIfEmpty } from "./src/utils/seedUjiAksesQuestions.js";
import helmet from "helmet";
import { sanitizeMiddleware, sanitizeQueryParams } from "./src/middleware/sanitization.js";
import logger from "./src/config/logger.js";
import { requestLogger, errorLogger } from "./src/middleware/requestLogger.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// Render sits behind a proxy; enable trusted proxy for rate-limit to read X-Forwarded-For.
app.set("trust proxy", 1);
// __dirname replacement untuk ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Catatan: untuk cookie auth, biasanya perlu konfigurasi cors lebih spesifik (origin + credentials).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CLIENT_URL || 'http://localhost:5173'], // Allow SSE from frontend
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // URL frontend Vite
  credentials: true // WAJIB untuk cookie
}));
app.use(
  express.json({
    limit: "25mb", // naikkan limit agar lampiran base64 tidak ditolak
  })
);
app.use(cookieParser());
// log setiap request
app.use(requestLogger);

// SANITIZE SEMUA INPUT
app.use(sanitizeMiddleware);
app.use(sanitizeQueryParams);
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
app.use("/uji-akses/questions", ujiAksesQuestionRoutes);
// Middleware untuk log error
app.use(errorLogger);

// Error handler terakhir
app.use((err, req, res, next) => {
  // Error sudah di-log oleh errorLogger middleware
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
});


async function ensureDefaultAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin*#';
  const existing = await User.findOne({ where: { username } });
  if (!existing) {
    const hash = await bcrypt.hash(password, 10);
    await User.create({ username, password: hash, role: 'admin' });
    console.log(`[seed] User admin '${username}' dibuat saat startup.`);
  }
}

// Bootstrapping server + koneksi database
const startServer = async () => {
  try {
    await db.sync();
    await seedUjiAksesQuestionsIfEmpty();
    await ensureDefaultAdmin();
    logger.info('Database connection successful');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to connect to database', { error: err.message, stack: err.stack });
    process.exit(1);
  }
};

startServer();
