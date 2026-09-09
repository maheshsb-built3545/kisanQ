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
// DEMO MODE: 401 redirect disabled. In production, uncomment the redirect.
// During the hackathon, mock API calls return 401 without a real JWT — we
// console.warn instead of crashing the entire app back to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('kq_token');
      // ── Production: uncomment the line below ──
      // window.location.href = '/';
      console.warn('[KisanQ] 401 Unauthorized — demo mode, skipping redirect.');
    }
    return Promise.reject(error);
  }
);

export default api;
