import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { generateRefreshToken, hashRefreshToken } from "../utils/tokens.js";
import {
  setRefreshCookie,
  clearRefreshCookie,
  setAccessCookie,
  clearAccessCookie,
} from "../utils/cookies.js";

export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.sendStatus(401);

    const refreshHash = hashRefreshToken(refreshToken);

    const user = await User.findOne({
      where: { refresh_token_hash: refreshHash },
    });
    clearRefreshCookie(res);
    clearAccessCookie(res);

    // Token tidak cocok / sudah di-rotate / login di device lain
    if (!user) {
      clearRefreshCookie(res);
      clearAccessCookie(res);
      return res.sendStatus(403);
    }

    // Cek expiry di DB (authoritative)
    if (
      !user.refresh_expires_at ||
      new Date(user.refresh_expires_at) <= new Date()
    ) {
      await user.update({
        refresh_token_hash: null,
        refresh_expires_at: null,
        refresh_rotated_at: new Date(),
      });
      clearRefreshCookie(res);
      clearAccessCookie(res);
      return res.sendStatus(403);
    }

    // Buat access token baru (pendek)
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    // ROTATION: buat refresh token baru + update hash di DB
    const newRefreshToken = generateRefreshToken();
    const newRefreshHash = hashRefreshToken(newRefreshToken);

    // Sliding expiration (opsional): perpanjang 7 hari dari sekarang
    const newRefreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await user.update({
      refresh_token_hash: newRefreshHash,
      refresh_expires_at: newRefreshExpiresAt,
      refresh_rotated_at: new Date(),
    });

    // Set cookie yang baru
    setRefreshCookie(res, newRefreshToken);
    setAccessCookie(res, accessToken);

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
};
