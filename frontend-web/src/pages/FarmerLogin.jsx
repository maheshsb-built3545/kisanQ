import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function FarmerLogin() {
  const navigate = useNavigate();
  const [phone, setPhone]     = useState('');
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleaned = phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      setError('कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।');
      return;
    }
    if (!name.trim()) {
      setError('कृपया अपना नाम दर्ज करें।');
      return;
    }
    setLoading(true);
    try {
      // POST /auth/farmer/request-otp
      const { data } = await api.post('/auth/farmer/request-otp', {
        phone: cleaned,
        name: name.trim(),
        preferredLanguage: 'mr',
        registeredVia: 'app',
      });
      const devOtp = data?.data?.devOtp || data?.devOtp;
      navigate('/verify', { state: { phone: cleaned, name: name.trim(), devOtp } });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'OTP भेजने में समस्या हुई। कृपया पुनः प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-surface items-center justify-center px-4 font-jakarta">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-on-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>agriculture</span>
          </div>
          <h1 className="text-2xl font-black text-on-surface">किसान लॉगिन</h1>
          <p className="text-sm text-on-surface-variant">Farmer Login — OTP द्वारा</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
              नाम / Name
            </label>
            <input
              id="farmer-name-input"
              type="text"
              className="input-field"
              placeholder="आपका नाम"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
              मोबाइल नंबर / Phone
            </label>
            <div className="flex gap-2">
              <div className="h-14 px-4 rounded-xl bg-surface-container-low flex items-center text-on-surface font-bold text-sm select-none">
                +91
              </div>
              <input
                id="farmer-phone-input"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                className="input-field flex-1"
                placeholder="10 अंकों का नंबर"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                autoComplete="tel"
              />
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          <button
            id="farmer-otp-btn"
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-60"
          >
            {loading
              ? <><span className="material-symbols-outlined animate-spin">autorenew</span><span>OTP भेजा जा रहा है...</span></>
              : <><span className="material-symbols-outlined">sms</span><span>OTP प्राप्त करें</span></>
            }
          </button>
        </form>

        {/* Back to landing */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center gap-1 text-sm text-on-surface-variant font-bold"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          मुख्य पृष्ठ पर जाएं
        </button>
      </div>
    </main>
  );
}
