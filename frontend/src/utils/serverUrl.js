import api from '../services/api';

export const getServerBaseUrl = () => {
  const url = api.defaults?.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
  return String(url).replace(/\/$/, '');
};

export const buildServerFileUrl = (filePath) => {
  if (!filePath) return '';
  const base = getServerBaseUrl();
  const cleaned = String(filePath).startsWith('/') ? String(filePath) : `/${filePath}`;
  return `${base}${cleaned}`;
};

