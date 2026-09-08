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
// If the server returns 401, the token is expired or invalid.
// Clear it and redirect to the login page so the farmer re-authenticates.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('kq_token');
      // Use window.location so the full React tree re-mounts cleanly
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
