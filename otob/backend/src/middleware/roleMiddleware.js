// Middleware untuk membatasi akses hanya untuk admin
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Akses ditolak: admin saja' });
  }

  next();
};

module.exports = {
  requireAdmin
};
