
/**
 * Helper untuk log dengan context user
 */
export const logWithUser = (level, message, user, meta = {}) => {
  logger[level](message, {
    userId: user?.id,
    username: user?.username,
    role: user?.role,
    ...meta,
  });
};

/**
 * Helper untuk log operasi database
 */
export const logDbOperation = (operation, model, user, meta = {}) => {
  logger.info(`Database operation: ${operation}`, {
    model,
    userId: user?.id,
    username: user?.username,
    ...meta,
  });
};

/**
 * Helper untuk log keamanan
 */
export const logSecurity = (event, user, meta = {}) => {
  logger.warn(`Security event: ${event}`, {
    userId: user?.id,
    username: user?.username,
    ip: meta.ip,
    ...meta,
  });
};

/**
 * Helper untuk log business logic
 */
export const logBusiness = (action, user, meta = {}) => {
  logger.info(`Business action: ${action}`, {
    userId: user?.id,
    username: user?.username,
    ...meta,
  });
};

export default {
  logWithUser,
  logDbOperation,
  logSecurity,
  logBusiness,
};