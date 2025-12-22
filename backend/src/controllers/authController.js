import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { generateRefreshToken, hashRefreshToken } from "../utils/tokens.js";
import {setRefreshCookie, clearRefreshCookie, setAccessCookie, clearAccessCookie} from "../utils/cookies.js";

//Nambah fungsi buat login handler
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res
        .status(400)
        .json({ status: "Failed", message: "Username atau password salah" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res
        .status(400)
        .json({ status: "Failed", message: "Username atau password salah" });
    }

    // Safe user payload for access token (hindari field sensitif)
    const userPlain = user.toJSON();
    const {
      password: _p,
      refresh_token: _rt,
      refresh_token_hash: _rh,
      refresh_expires_at: _re,
      ...safeUserData
    } = userPlain;

    // 1) Access token pendek
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, username: user.username }, // payload minimal (lebih baik)
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    // 2) Refresh token opaque + hash untuk DB
    const refreshToken = generateRefreshToken();
    const refreshHash = hashRefreshToken(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

    // 3) Single-device: overwrite session lama
    await user.update({
      refresh_token_hash: refreshHash,
      refresh_expires_at: refreshExpiresAt,
      refresh_rotated_at: new Date(),
    });

    // 4) Set cookie refresh (HttpOnly)
    setRefreshCookie(res, refreshToken);
    setAccessCookie(res, accessToken);

    return res.status(200).json({
      status: "Success",
      message: "Login berhasil",
      user: safeUserData,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

//nambah logout
const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    // Selalu clear cookie (idempotent)
    clearRefreshCookie(res);
    clearAccessCookie(res);

    if (!refreshToken) {
      return res.status(200).json({ msg: "Logged out successfully1" });
    }

    const refreshHash = hashRefreshToken(refreshToken);
    // Single-device: revoke session untuk user ini
    await User.update(
      {
        refresh_token_hash: null,
        refresh_expires_at: null,
        refresh_rotated_at: new Date(),
      },
      {
        where: {
          refresh_token_hash: refreshHash,
        },
      }
    );

    return res.status(200).json({ msg: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
};

export { login, logout };
