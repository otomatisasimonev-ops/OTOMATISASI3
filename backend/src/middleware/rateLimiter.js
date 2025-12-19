import rateLimit from 'express-rate-limit';

 //Rate limiter untuk endpoint login
 //Membatasi 5 percobaan login per 15 menit per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 5, // maksimal 5 percobaan login
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.'
  },
  standardHeaders: true, // Return rate limit info di `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip rate limiting untuk IP tertentu jika diperlukan
  skip: (req) => {
    // Bisa ditambahkan whitelist IP jika perlu
    // const whitelistedIPs = ['127.0.0.1'];
    // return whitelistedIPs.includes(req.ip);
    return false;
  },
});

 //Rate limiter untuk endpoint umum
 //Membatasi 100 request per 15 menit per IP
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100, // maksimal 100 request
  message: {
    success: false,
    message: 'Terlalu banyak request dari IP ini. Silakan coba lagi nanti.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
