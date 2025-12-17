export const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    // Pastikan user sudah diverifikasi oleh verifyToken
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized - No user data'
      });
    }

    // Cek apakah role user ada di allowedRoles
    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden - Insufficient permissions'
      });
    }

    next();
  };
};
