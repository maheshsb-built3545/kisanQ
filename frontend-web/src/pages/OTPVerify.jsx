import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

const OTP_LENGTH = 6;

export default function OTPVerify() {
  const navigate      = useNavigate();
  const { state }     = useLocation();
  const phone         = state?.phone || '';
  const name          = state?.name  || '';
  const initialDevOtp = state?.devOtp ? String(state.devOtp) : '';

  const [devOtp, setDevOtp]   = useState(initialDevOtp);
  const [digits, setDigits]   = useState(() => {
    if (initialDevOtp && initialDevOtp.length === OTP_LENGTH) {
      return initialDevOtp.split('');
    }
    return Array(OTP_LENGTH).fill('');
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [resendCd, setResendCd] = useState(30);
  const inputRefs               = useRef([]);

  // Auto-fill digits if devOtp arrives or changes
  useEffect(() => {
    if (devOtp && devOtp.length === OTP_LENGTH) {
      setDigits(devOtp.split(''));
    }
  }, [devOtp]);

  // Redirect if landed without phone in state
  useEffect(() => {
    if (!phone) navigate('/farmer-login', { replace: true });
  }, [phone, navigate]);

  // Resend countdown
  useEffect(() => {
    if (resendCd <= 0) return;
    const t = setTimeout(() => setResendCd((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCd]);

  const otp = digits.join('');

  const handleChange = (i, val) => {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted.length === OTP_LENGTH) {
      setDigits(pasted.split(''));
      inputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    setError('');
    if (otp.length < OTP_LENGTH) {
      setError('कृपया 6 अंकों का OTP दर्ज करें।');
      return;
    }
    setLoading(true);
    try {
      // POST /auth/farmer/verify-otp
      const { data } = await api.post('/auth/farmer/verify-otp', {
        phone,
        otp,
        name,
        preferredLanguage: 'mr',
        registeredVia: 'app',
      });
      const { token, user } = data.data || data;
      localStorage.setItem('kq_token', token);
      localStorage.setItem('kq_user', JSON.stringify(user));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'OTP गलत है या समय सीमा समाप्त हो गई।');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResendCd(30);
    try {
      const { data } = await api.post('/auth/farmer/request-otp', { phone, name, preferredLanguage: 'mr', registeredVia: 'app' });
      const newDevOtp = data?.data?.devOtp || data?.devOtp;
      if (newDevOtp) {
        setDevOtp(String(newDevOtp));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'OTP पुनः भेजने में समस्या हुई।');
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-surface items-center justify-center px-4 font-jakarta">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>sms</span>
          </div>
          <h1 className="text-2xl font-black text-on-surface">OTP सत्यापन</h1>
          <p className="text-sm text-on-surface-variant">
            <span className="font-bold text-on-surface">+91 {phone}</span> पर भेजा गया
          </p>
        </div>

        {/* Dev Mode Auto-fill Banner */}
        {devOtp && (
          <div className="bg-tertiary-container text-on-tertiary-container px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border border-tertiary/30 shadow-sm" role="status">
            <span className="material-symbols-outlined text-base text-tertiary">developer_mode</span>
            <span>Dev mode: OTP auto-filled — <strong className="font-mono font-black text-sm tracking-wider">{devOtp}</strong></span>
          </div>
        )}

        {/* OTP inputs */}
        <div className="flex gap-2" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              id={`otp-box-${i}`}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              className="otp-box"
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        <button
          id="otp-verify-btn"
          onClick={handleVerify}
          disabled={loading || otp.length < OTP_LENGTH}
          className="btn-primary disabled:opacity-60"
        >
          {loading
            ? <><span className="material-symbols-outlined animate-spin">autorenew</span><span>सत्यापित हो रहा है...</span></>
            : <><span className="material-symbols-outlined">verified</span><span>OTP सत्यापित करें</span></>
          }
        </button>

        {/* Resend */}
        <div className="text-center">
          {resendCd > 0 ? (
            <p className="text-sm text-on-surface-variant">
              OTP पुनः भेजें <span className="font-bold text-on-surface">{resendCd}s</span> में
            </p>
          ) : (
            <button
              id="otp-resend-btn"
              onClick={handleResend}
              className="text-sm font-bold text-primary underline"
            >
              OTP पुनः भेजें
            </button>
          )}
        </div>

        <button
          onClick={() => navigate('/farmer-login')}
          className="flex items-center justify-center gap-1 text-sm text-on-surface-variant font-bold"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          नंबर बदलें
        </button>
      </div>
    </main>
  );
}
