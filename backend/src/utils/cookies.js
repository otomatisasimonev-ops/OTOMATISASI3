export function setRefreshCookie(res, refreshToken) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,           // PROD wajib true (https)
    sameSite: isProd ? "strict" : "lax", // strict di production untuk keamanan maksimal
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    path: "/auth",   // PENTING: batasi scope cookie hanya untuk turunan /auth endpoint
  });
}

export function setAccessCookie(res, accessToken) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: 15 * 60 * 1000, // 15 menit (sama dengan expiry JWT)
    path: "/auth", 
  });
}

export function clearRefreshCookie(res) {
  const isProd = process.env.NODE_ENV === "production";

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/auth", // Harus sama dengan path saat set cookie
  });
}

export function clearAccessCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/auth",
  });
}