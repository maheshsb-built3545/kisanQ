import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STAFF_ROLES = [
  { id: 'gate_guard',    emoji: '🛡️', label: 'Gate Guard / द्वारपाल',         sub: 'Gate check-in & Queue management',    route: '/guard-terminal' },
  { id: 'weighmaster',  emoji: '⚖️', label: 'Weighmaster / तौलिया',           sub: 'Weighbridge & Grade verification',    route: '/weighmaster-desk' },
  { id: 'auctioneer',   emoji: '🔨', label: 'Auctioneer / नीलामकर्ता',        sub: 'Live auction & Hammer operations',    route: '/auction-board' },
  { id: 'supervisor',   emoji: '👨‍💼', label: 'Supervisor / पर्यवेक्षक',        sub: 'Full access – Exceptions & Overrides', route: '/supervisor-exceptions' },
  { id: 'district_admin', emoji: '🏛️', label: 'District Admin / जिला अधिकारी', sub: 'Multi-mandi oversight & Reports',    route: '/admin-dashboard' },
];

export default function StaffLogin() {
  const navigate = useNavigate();
  const [role, setRole] = useState('supervisor');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!employeeId || !password) { setError('कृपया सभी फ़ील्ड भरें।'); return; }
    setError(''); setLoading(true);
    const ROLE_PAYLOAD_MAP = {
      gate_guard: 'operator',
      weighmaster: 'staff',
      auctioneer: 'operator',
      supervisor: 'supervisor',
      district_admin: 'district_admin',
    };
    try {
      const backendRole = ROLE_PAYLOAD_MAP[role] || 'supervisor';
      const { data } = await api.post('/auth/staff/login', {
        name: employeeId,
        password,
        role: backendRole,
      });
      if (data?.data?.token) {
        localStorage.setItem('kq_token', data.data.token);
        if (data?.data?.user) {
          localStorage.setItem('kq_user', JSON.stringify(data.data.user));
        }
      }
    } catch (err) {
      console.warn('Backend staff login notice (demo fallback active):', err?.response?.data?.message || err?.message);
      localStorage.setItem('kq_token', 'mock_staff_token');
    }
    // Route based on selected role
    const dest = STAFF_ROLES.find((r) => r.id === role)?.route || '/guard-terminal';
    navigate(dest);
    setLoading(false);
  };

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <div className="bg-primary-container rounded-xl p-4 shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center text-2xl font-black shadow-sm">KQ</div>
            <div>
              <span className="block text-on-primary-container text-xl font-bold">KisanQ</span>
              <span className="block text-on-primary-container/70 text-xs uppercase tracking-wider font-extrabold">Staff Management Portal</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-on-primary-container text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
              <span className="text-sm font-bold text-on-primary-container">Staff Access Only / केवल कर्मचारी</span>
            </div>
            <span className="px-2 py-1 bg-primary text-on-primary text-xs font-extrabold rounded-full">SIH26032</span>
          </div>
        </div>

        {/* Role selector */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-extrabold text-on-surface-variant uppercase mb-3">अपनी भूमिका चुनें / Select Your Role</h2>
          <div className="space-y-2">
            {STAFF_ROLES.map((r) => (
              <label key={r.id} className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${role === r.id ? 'bg-primary-fixed' : 'bg-surface-container-low hover:bg-surface-container'}`}>
                <input type="radio" name="role" checked={role === r.id} onChange={() => setRole(r.id)} className="w-5 h-5 text-primary" />
                <span className="text-2xl">{r.emoji}</span>
                <div>
                  <span className={`block text-sm font-bold ${role === r.id ? 'text-on-primary-fixed' : 'text-on-surface'}`}>{r.label}</span>
                  <span className={`block text-xs ${role === r.id ? 'text-on-primary-fixed-variant' : 'text-on-surface-variant'}`}>{r.sub}</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Credentials */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-extrabold text-on-surface-variant uppercase">लॉगिन विवरण / Login Credentials</h2>

          <div className="space-y-1">
            <label className="text-sm font-bold text-on-surface">Employee ID / कर्मचारी आईडी</label>
            <div className="flex items-center gap-2 h-14 bg-surface-container-low rounded-xl px-3">
              <span className="material-symbols-outlined text-on-surface-variant">badge</span>
              <input
                className="flex-1 text-sm font-bold text-on-surface placeholder:text-outline bg-transparent outline-none"
                placeholder="KQS-2024-001"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-on-surface">पासवर्ड / Password</label>
            <div className="flex items-center gap-2 h-14 bg-surface-container-low rounded-xl px-3">
              <span className="material-symbols-outlined text-on-surface-variant">lock</span>
              <input
                className="flex-1 text-sm font-bold text-on-surface placeholder:text-outline bg-transparent outline-none"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button onClick={() => setShowPw(!showPw)}>
                <span className="material-symbols-outlined text-on-surface-variant">{showPw ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          {/* Biometric */}
          <div className="flex items-center gap-2 bg-secondary-fixed text-on-secondary-fixed rounded-xl p-3 cursor-pointer">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>fingerprint</span>
            <div>
              <span className="block text-sm font-bold">Biometric Login Available</span>
              <span className="block text-xs">Fingerprint / Face ID – Touch to authenticate</span>
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded-lg">{error}</p>}

        <button className="btn-primary" onClick={handleLogin} disabled={loading}>
          {loading
            ? <><span className="material-symbols-outlined animate-spin">autorenew</span><span>लॉगिन हो रहा है...</span></>
            : <><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span><span>Staff Login / कर्मचारी लॉगिन</span></>
          }
        </button>

        {/* Security notice */}
        <div className="bg-error-container/30 rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-xl shrink-0 mt-0.5">security</span>
          <p className="text-xs text-on-error-container leading-relaxed">
            यह पोर्टल केवल अधिकृत मंडी कर्मचारियों के लिए है। अनधिकृत पहुंच IPC धारा 66 के अंतर्गत दंडनीय है।
            <br />
            <em>This portal is for authorised Mandi staff only.</em>
          </p>
        </div>

        {/* Farmer link */}
        <div className="text-center">
          <p className="text-sm text-on-surface-variant">किसान हैं? <button onClick={() => navigate('/farmer-login')} className="text-primary font-bold">किसान पोर्टल पर जाएं →</button></p>
        </div>

      </div>
    </main>
  );
}
