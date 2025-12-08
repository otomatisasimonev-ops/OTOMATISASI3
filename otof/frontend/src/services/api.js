import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000'
});

api.interceptors.request.use((config) => {
  const userRaw = localStorage.getItem('user');
  if (userRaw) {
    try {
      const user = JSON.parse(userRaw);
      if (user?.id) {
        config.headers['x-user-id'] = user.id;
      }
      if (user?.username) {
        config.headers['x-username'] = user.username;
      }
    } catch (err) {
      // ignore parse error
    }
  }
  return config;
});

export default api;
