// Centralised API client – points to the backend
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT ────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kq_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 Unauthorized globally ─────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('kq_token');
      localStorage.removeItem('kq_user');
      const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
      if (isDemoMode) {
        console.warn('[KisanQ] 401 Unauthorized — VITE_DEMO_MODE active, skipping redirect.');
      } else {
        window.location.href = '/farmer-login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
