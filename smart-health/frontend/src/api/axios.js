import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const requestPath = err.config?.url || '';
    const isAuthRequest =
      requestPath.includes('/auth/login') ||
      requestPath.includes('/auth/signup');

    if (err.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');

      const path = window.location.pathname;

      if (path.startsWith('/main-admin')) {
        window.location.href = '/main-admin/login';
      } else if (path.startsWith('/hospital-admin')) {
        window.location.href = '/hospital-admin/login';
      } else {
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default api;
