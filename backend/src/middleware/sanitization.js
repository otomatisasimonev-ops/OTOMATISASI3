import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import validator from 'validator';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Sanitize single input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Remove all HTML tags
  let cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  
  // Escape HTML entities
  cleaned = validator.escape(cleaned);
  
  return cleaned.trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Express middleware untuk sanitize request body
 */
export const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

/**
 * Sanitize khusus untuk query parameters
 */
export const sanitizeQueryParams = (req, res, next) => {
  const dangerous = ['<script', 'javascript:', 'onerror=', 'onload=', '<iframe'];
  
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      
      for (const danger of dangerous) {
        if (lowerValue.includes(danger)) {
          return res.status(400).json({
            success: false,
            message: 'Malicious input detected',
          });
        }
      }
      
      req.query[key] = sanitizeInput(value);
    }
  }
  
  next();
};