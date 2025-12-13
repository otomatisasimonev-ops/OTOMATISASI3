import api from './api';

export const createUjiAksesReport = async (payload) => {
  const res = await api.post('/api/reports', payload);
  return res.data;
};

export const updateUjiAksesDraft = async (id, payload) => {
  const res = await api.patch(`/api/reports/${id}`, payload);
  return res.data;
};

export const submitUjiAksesReport = async (id) => {
  const res = await api.patch(`/api/reports/${id}/submit`);
  return res.data;
};

export const listMyUjiAksesReports = async () => {
  const res = await api.get('/api/reports/me');
  return res.data;
};

export const getUjiAksesReportDetail = async (id) => {
  const res = await api.get(`/api/reports/${id}`);
  return res.data;
};

export const adminListUjiAksesReports = async (params = {}) => {
  const res = await api.get('/api/admin/reports', { params });
  return res.data;
};

export const adminGetUjiAksesReportDetail = async (id) => {
  const res = await api.get(`/api/admin/reports/${id}`);
  return res.data;
};

export const uploadUjiAksesEvidence = async (id, questionKey, files = []) => {
  const form = new FormData();
  form.append('questionKey', questionKey);
  files.forEach((file) => form.append('files', file));
  const res = await api.post(`/api/reports/${id}/upload`, form, {
    params: { questionKey },
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

