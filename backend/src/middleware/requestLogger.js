import logger from '../config/logger.js';

/**
 * Middleware untuk log setiap HTTP request
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Ambil informasi user jika ada
  const userId = req.user?.id || 'anonymous';
  const username = req.user?.username || 'anonymous';
  
  // Log request yang masuk
  logger.http('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId,
    username,
    userAgent: req.get('user-agent'),
  });

  // Override res.json untuk log response
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.http('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId,
      username,
    });

    return originalJson(data);
  };

  // Tangkap error jika ada
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode >= 400) {
      logger.warn('Request failed', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId,
        username,
      });
    }
  });

  next();
};

/**
 * Middleware untuk log error
 */
export const errorLogger = (err, req, res, next) => {
  const userId = req.user?.id || 'anonymous';
  const username = req.user?.username || 'anonymous';

  logger.error('Error occurred', {
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
    userId,
    username,
    ip: req.ip,
  });

  next(err);
};