import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kq_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
      if (isDemoMode) {
        console.warn('[KisanQ API] 401 Unauthorized — VITE_DEMO_MODE active, skipping hard redirect.');
      } else {
        localStorage.removeItem('kq_token');
        localStorage.removeItem('kq_user');
        window.location.href = '/farmer-login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
