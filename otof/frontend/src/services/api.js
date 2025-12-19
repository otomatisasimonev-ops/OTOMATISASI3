import axios from 'axios';

// In-memory token storage
let accessToken = null;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true // WAJIB untuk mengirim cookie refresh token
});

// Request Interceptor: inject access token ke setiap request
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response Interceptor: auto-refresh token saat 401/403
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Jika error 401/403 dan belum pernah retry, coba refresh token
    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Request refresh token (cookie otomatis dikirim karena withCredentials: true)
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        // Simpan access token baru ke memory
        accessToken = data.accessToken;
        
        // Inject token baru ke request yang gagal dan retry
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token gagal/expired, logout user
        accessToken = null;
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Export fungsi untuk set/clear token dari komponen lain
export const setAccessToken = (token) => {
  accessToken = token;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export const getAccessToken = () => {
  return accessToken;
};

export default api;
