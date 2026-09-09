import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ACTIVE_TOKEN = {
  token: 'KQ-108',
  crop: '🧅 प्याज / Red Onion',
  qty: '50 क्विंटल',
  mandi: 'लासलगांव कृषि उपज मंडी',
  slot: 'आज • 08:00 – 10:00 AM',
  position: 14,
  wait: '22 मिनट',
  lane: 'Gate 2 → Lane B → W3',
  status: 'queued',
};

const MANDIS = [
  { name: 'लासलगांव कृषि उपज मंडी', status: 'green', slots: 42, wait: '15-20 मि.' },
  { name: 'पिंपलगांव बसवंत APMC',  status: 'amber', slots: 18, wait: '45-60 मि.' },
  { name: 'नासिक मुख्य मंडी',      status: 'red',   slots: 6,  wait: '90+ मि.' },
];

const ALERTS = [
  { icon: 'warning',      cls: 'text-tertiary',  msg: 'KQ-095: Grace period expired.', time: '09:15 AM' },
  { icon: 'info',         cls: 'text-primary',   msg: 'Lane B – प्रणाली अपडेट सफल।',  time: '10:42 AM' },
  { icon: 'check_circle', cls: 'text-secondary', msg: 'लासलगांव – सभी सेवाएं सुचारु।', time: '11:00 AM' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');

  return (
    <main className="flex flex-col min-h-screen bg-surface font-jakarta pb-24">

      {/* ── Top App Bar ── */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-on-primary text-base font-black shadow-md">KQ</div>
          <div>
            <h1 className="text-base font-bold text-primary leading-none">KisanQ</h1>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">e-Mandi Gateway</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/mandi-selection')}
            className="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>volume_up</span>
          </button>
          <button
            onClick={() => navigate('/live-token')}
            className="w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface flex items-center justify-center shadow-sm relative active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-error border-2 border-surface" />
          </button>
        </div>
      </header>

      <div className="flex flex-col w-full max-w-md mx-auto px-4 gap-5 pt-4">

        {/* ── Greeting banner ── */}
        <div className="bg-gradient-to-br from-primary via-primary to-primary-container rounded-3xl p-5 shadow-2xl shadow-primary/20 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-on-primary/5" />
          <div className="absolute bottom-0 right-4 text-7xl opacity-10 select-none">🌾</div>
          <p className="text-xs text-on-primary/60 font-extrabold uppercase tracking-widest mb-1">किसान पोर्टल • Nashik District</p>
          <h2 className="text-2xl font-black text-on-primary">नमस्ते, किसान! 🙏</h2>
          <p className="text-on-primary/70 text-sm mt-1">आपकी मंडी यात्रा को आसान बनाने के लिए KisanQ तैयार है।</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-on-primary/10 rounded-xl px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-ping block" />
            <span className="text-sm font-bold text-on-primary">लासलगांव मंडी – आज 42 स्लॉट उपलब्ध</span>
          </div>
        </div>

        {/* ── ACTIVE TOKEN — Primary Focus ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-on-surface uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping block" />
              मेरा सक्रिय टोकन / My Active Token
            </h2>
            <button onClick={() => navigate('/live-token')} className="text-xs text-primary font-bold flex items-center gap-0.5">
              विवरण <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>

          <div
            onClick={() => navigate('/live-token')}
            className="bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all ring-2 ring-primary/20"
          >
            {/* Token stripe */}
            <div className="bg-gradient-to-r from-primary to-primary-container px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-on-primary/60 text-xs font-extrabold uppercase tracking-wider block">लासलगांव कृषि उपज मंडी</span>
                <span className="text-on-primary text-xl font-black">{ACTIVE_TOKEN.token}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-secondary-fixed text-on-secondary-fixed text-xs font-extrabold px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping block" />
                  लाइव
                </span>
              </div>
            </div>

            {/* Token body */}
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[['उपज', ACTIVE_TOKEN.crop], ['मात्रा', ACTIVE_TOKEN.qty], ['आगमन', ACTIVE_TOKEN.slot], ['लेन', ACTIVE_TOKEN.lane]].map(([k, v]) => (
                  <div key={k} className="bg-surface-container-low rounded-xl p-2.5">
                    <span className="block text-xs text-on-surface-variant">{k}</span>
                    <span className="block text-sm font-bold text-on-surface leading-tight truncate">{v}</span>
                  </div>
                ))}
              </div>

              {/* Queue position bar */}
              <div className="flex items-center gap-3 bg-primary-fixed/30 rounded-xl px-3 py-2.5">
                <div className="text-center">
                  <span className="block text-3xl font-black text-primary leading-none">{ACTIVE_TOKEN.position}</span>
                  <span className="block text-[10px] text-on-surface-variant">कतार में</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm font-bold text-on-surface">≈ {ACTIVE_TOKEN.wait} शेष</span>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(8)].map((_, i) => (
                      <span key={i} className={`flex-1 h-2 rounded-full ${i < ACTIVE_TOKEN.position - 6 ? 'bg-error/40' : 'bg-primary/20'}`} />
                    ))}
                  </div>
                </div>
                <span className="material-symbols-outlined text-primary text-2xl">arrow_forward</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Quick Actions ── */}
        <section>
          <h2 className="text-sm font-extrabold text-on-surface-variant uppercase tracking-wider mb-3">त्वरित कार्य / Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: 'confirmation_number', label: 'मंडी टोकन बुक करें', sub: 'Slot booking',  path: '/mandi-selection', cls: 'bg-primary text-on-primary' },
              { icon: 'traffic',             label: 'लाइव कतार देखें',   sub: 'Queue status', path: '/live-token',       cls: 'bg-secondary text-on-secondary' },
              { icon: 'gavel',               label: 'नीलामी बोर्ड',      sub: 'Live auction', path: '/auction-board',    cls: 'bg-tertiary-container text-on-tertiary-fixed' },
              { icon: 'lock_person',         label: 'Staff Login',        sub: 'Gate Terminal',path: '/staff-login',      cls: 'bg-surface-container-high text-on-surface' },
            ].map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.path)}
                className={`flex flex-col items-start p-4 rounded-2xl shadow-sm transition-all active:scale-95 ${a.cls}`}
              >
                <span className="material-symbols-outlined text-3xl mb-2 block" style={{ fontVariationSettings: "'FILL' 1" }}>{a.icon}</span>
                <span className="text-sm font-bold leading-tight">{a.label}</span>
                <span className="text-xs opacity-60 mt-0.5">{a.sub}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Mandi Status ── */}
        <section>
          <h2 className="text-sm font-extrabold text-on-surface-variant uppercase tracking-wider mb-3">मंडी स्थिति / Market Status</h2>
          <div className="space-y-2">
            {MANDIS.map((m) => (
              <div key={m.name} className="bg-surface-container-lowest rounded-2xl p-3 shadow-sm flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full shrink-0 ${m.status === 'green' ? 'bg-secondary animate-pulse' : m.status === 'amber' ? 'bg-tertiary-container' : 'bg-error animate-pulse'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{m.name}</p>
                  <p className="text-xs text-on-surface-variant">{m.slots} स्लॉट • {m.wait}</p>
                </div>
                <button
                  onClick={() => navigate('/mandi-selection')}
                  className="h-9 px-3 bg-primary text-on-primary rounded-xl text-xs font-bold shrink-0 active:scale-95 transition-transform"
                >
                  बुक करें
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── Live Alerts ── */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low">
            <h2 className="text-sm font-extrabold text-on-surface">लाइव अलर्ट</h2>
            <span className="flex items-center gap-1.5 text-xs font-bold text-secondary">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />लाइव
            </span>
          </div>
          {ALERTS.map((a, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-outline-variant/20 last:border-0">
              <span className={`material-symbols-outlined text-xl ${a.cls} shrink-0 mt-0.5`} style={{ fontVariationSettings: "'FILL' 1" }}>{a.icon}</span>
              <div className="flex-1">
                <p className="text-sm text-on-surface">{a.msg}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{a.time}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── Zero Data Footer ── */}
        <div className="bg-surface-container-low rounded-2xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-secondary text-xl shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
          <div>
            <p className="text-sm font-bold text-on-surface">शून्य डेटा नीति / Zero Data Policy</p>
            <p className="text-xs text-on-surface-variant mt-0.5">KisanQ कोई आधार, बैंक खाता या संवेदनशील जानकारी संग्रहीत नहीं करता।</p>
          </div>
        </div>

      </div>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-container-lowest/95 backdrop-blur-md shadow-xl px-4 py-2 flex items-center justify-around z-50 rounded-t-2xl border-t border-outline-variant/20">
        {[
          { icon: 'home', label: 'होम', path: '/dashboard' },
          { icon: 'storefront', label: 'मंडी', path: '/mandi-selection' },
          { icon: 'confirmation_number', label: 'टोकन', path: '/live-token' },
          { icon: 'gavel', label: 'नीलामी', path: '/auction-board' },
          { icon: 'admin_panel_settings', label: 'Staff', path: '/staff-login' },
        ].map(({ icon, label, path }) => {
          const active = path === '/dashboard';
          return (
            <button key={label} onClick={() => navigate(path)} className={`flex flex-col items-center flex-1 py-1 transition-colors ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
              <div className={active ? 'bg-primary-fixed px-3 py-1 rounded-full mb-0.5' : 'py-1 mb-0.5'}>
                <span className="material-symbols-outlined text-xl" style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
              </div>
              <span className="text-[10px] font-extrabold">{label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}
