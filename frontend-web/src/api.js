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
      const userRaw = localStorage.getItem('kq_user');
      localStorage.removeItem('kq_user');
      // Route to the correct login page based on the stored user role
      try {
        const user = userRaw ? JSON.parse(userRaw) : null;
        const staffRoles = ['operator', 'staff', 'supervisor', 'district_admin', 'auditor'];
        if (user?.role && staffRoles.includes(user.role)) {
          window.location.href = '/staff-login';
        } else {
          window.location.href = '/farmer-login';
        }
      } catch {
        window.location.href = '/farmer-login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
