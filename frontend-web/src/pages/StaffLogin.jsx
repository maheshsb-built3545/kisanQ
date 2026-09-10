import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STAFF_ROLES = ['operator', 'staff', 'supervisor', 'district_admin', 'auditor'];

function roleToRoute(role) {
  if (['district_admin', 'auditor'].includes(role)) return '/admin-dashboard';
  // operator, staff, supervisor all go to guard terminal first
  return '/guard-terminal';
}

export default function StaffLogin() {
  const navigate      = useNavigate();
  const [name, setName]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim())     { setError('कृपया नाम दर्ज करें।');   return; }
    if (!password.trim()) { setError('कृपया पासवर्ड दर्ज करें।'); return; }
    setLoading(true);
    try {
      // POST /auth/staff/login — fields: name, password ONLY (no role)
      const { data } = await api.post('/auth/staff/login', {
        name: name.trim(),
        password,
      });
      const { token, user } = data.data || data;
      if (!STAFF_ROLES.includes(user?.role)) {
        throw new Error(`अज्ञात भूमिका: ${user?.role}. कृपया व्यवस्थापक से संपर्क करें।`);
      }
      localStorage.setItem('kq_token', token);
      localStorage.setItem('kq_user', JSON.stringify(user));
      navigate(roleToRoute(user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'लॉगिन विफल। नाम या पासवर्ड गलत है।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-surface items-center justify-center px-4 font-jakarta">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
          </div>
          <h1 className="text-2xl font-black text-on-surface">स्टाफ लॉगिन</h1>
          <p className="text-sm text-on-surface-variant">Staff Login — Gate / Weighmaster / Supervisor / Admin</p>
        </div>

        {/* Note about role */}
        <div className="bg-primary-fixed text-on-primary-fixed rounded-xl px-4 py-3 text-xs font-bold flex items-start gap-2">
          <span className="material-symbols-outlined text-base mt-0.5">info</span>
          <span>आपकी भूमिका लॉगिन के बाद स्वचालित रूप से पता चलेगी। आपको यहाँ भूमिका चुनने की आवश्यकता नहीं है।</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
              नाम / Name
            </label>
            <input
              id="staff-name-input"
              type="text"
              className="input-field"
              placeholder="आपका नाम"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
              पासवर्ड / Password
            </label>
            <div className="relative">
              <input
                id="staff-password-input"
                type={showPwd ? 'text' : 'password'}
                className="input-field pr-12"
                placeholder="पासवर्ड"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-xl">{showPwd ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          <button
            id="staff-login-btn"
            type="submit"
            disabled={loading}
            className="btn-primary bg-secondary disabled:opacity-60"
          >
            {loading
              ? <><span className="material-symbols-outlined animate-spin">autorenew</span><span>लॉगिन हो रहा है...</span></>
              : <><span className="material-symbols-outlined">login</span><span>लॉगिन करें</span></>
            }
          </button>
        </form>

        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center gap-1 text-sm text-on-surface-variant font-bold"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          मुख्य पृष्ठ
        </button>
      </div>
    </main>
  );
}
