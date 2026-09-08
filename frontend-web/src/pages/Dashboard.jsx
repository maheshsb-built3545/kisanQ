import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const NAV_LINKS = [
  { icon: 'storefront', label: 'मंडी', path: '/mandi-selection' },
  { icon: 'confirmation_number', label: 'टोकन', path: '/live-token' },
  { icon: 'gavel', label: 'नीलामी', path: '/auction-board' },
  { icon: 'admin_panel_settings', label: 'Staff', path: '/staff-login' },
];

const STATS = [
  { icon: 'storefront', label: 'सक्रिय मंडियां', val: '4', sub: 'नासिक ज़िला', cls: 'bg-primary text-on-primary' },
  { icon: 'confirmation_number', label: 'आज के टोकन', val: '247', sub: 'बुक किए गए', cls: 'bg-secondary text-on-secondary' },
  { icon: 'gavel', label: 'नीलाम लॉट', val: '89', sub: 'आज पूर्ण', cls: 'bg-tertiary-container text-on-tertiary-fixed' },
  { icon: 'payments', label: 'कुल भुगतान', val: '₹18.2L', sub: 'आज', cls: 'bg-primary-container text-on-primary' },
];

const ALERTS = [
  { type: 'warning', icon: 'warning', msg: 'KQ-095: Grace period expired. Action required.', time: '09:15 AM' },
  { type: 'info', icon: 'info', msg: 'Lane B Weighbridge W3 – प्रणाली अपडेट सफल।', time: '10:42 AM' },
  { type: 'success', icon: 'check_circle', msg: 'लासलगांव मंडी – सभी सेवाएं सुचारु।', time: '11:00 AM' },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-28 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Top bar */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center text-xl font-black shadow-md">KQ</div>
            <div>
              <h1 className="text-xl font-bold text-primary">KisanQ</h1>
              <p className="text-xs text-on-surface-variant">e-Mandi Gateway • SIH 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-11 h-11 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-xl">volume_up</span>
            </button>
            <button className="w-11 h-11 rounded-full bg-surface-container-lowest text-on-surface flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-xl">notifications</span>
            </button>
          </div>
        </header>

        {/* Greeting */}
        <div className="bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-2xl p-5 shadow-lg">
          <p className="text-xs text-on-primary/70 font-extrabold uppercase tracking-wider mb-1">किसान पोर्टल • Nashik District</p>
          <h2 className="text-2xl font-black">नमस्ते, किसान! 🙏</h2>
          <p className="text-on-primary/80 text-sm mt-1">आपकी मंडी यात्रा को आसान बनाने के लिए KisanQ तैयार है।</p>
          <div className="mt-3 flex items-center gap-2 bg-on-primary/10 rounded-xl px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-secondary-fixed block animate-ping" />
            <span className="text-sm font-bold text-on-primary">लासलगांव मंडी – आज 42 स्लॉट उपलब्ध</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {STATS.map((s) => (
            <div key={s.label} className={`${s.cls} rounded-xl p-4 shadow-sm`}>
              <span className="material-symbols-outlined text-2xl mb-1 block" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
              <p className="text-2xl font-black">{s.val}</p>
              <p className="text-xs opacity-80">{s.sub}</p>
              <p className="text-sm font-bold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <section>
          <h2 className="text-sm font-extrabold text-on-surface-variant uppercase mb-2">त्वरित कार्य / Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: 'confirmation_number', label: 'मंडी टोकन बुक करें', sub: 'Slot booking', path: '/mandi-selection', cls: 'bg-primary text-on-primary' },
              { icon: 'traffic', label: 'लाइव कतार देखें', sub: 'Queue status', path: '/live-token', cls: 'bg-secondary text-on-secondary' },
              { icon: 'gavel', label: 'नीलामी बोर्ड', sub: 'Live auction', path: '/auction-board', cls: 'bg-tertiary-container text-on-tertiary-fixed' },
              { icon: 'lock_person', label: 'Staff Login', sub: 'Gate Terminal', path: '/staff-login', cls: 'bg-surface-container text-on-surface' },
            ].map((a) => (
              <button key={a.label} onClick={() => navigate(a.path)} className={`flex flex-col items-start p-4 rounded-xl shadow-sm transition-all active:scale-95 ${a.cls}`}>
                <span className="material-symbols-outlined text-3xl mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>{a.icon}</span>
                <span className="text-base font-bold">{a.label}</span>
                <span className="text-xs opacity-70">{a.sub}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Live alerts */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low">
            <h2 className="text-sm font-extrabold text-on-surface">लाइव अलर्ट / Live Alerts</h2>
            <span className="flex items-center gap-1.5 text-xs font-bold text-secondary">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />लाइव
            </span>
          </div>
          {ALERTS.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 border-b border-outline-variant/20 last:border-0`}>
              <span className={`material-symbols-outlined text-xl ${a.type === 'warning' ? 'text-tertiary' : a.type === 'success' ? 'text-secondary' : 'text-primary'}`} style={{ fontVariationSettings: "'FILL' 1" }}>{a.icon}</span>
              <div className="flex-1">
                <p className="text-sm text-on-surface">{a.msg}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{a.time}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Recent markets */}
        <section>
          <h2 className="text-sm font-extrabold text-on-surface-variant uppercase mb-2">मंडी स्थिति / Market Status</h2>
          <div className="space-y-2">
            {[
              { name: 'लासलगांव कृषि उपज मंडी', status: 'green', slots: 42, wait: '15-20 मि.' },
              { name: 'पिंपलगांव बसवंत APMC', status: 'amber', slots: 18, wait: '45-60 मि.' },
              { name: 'नासिक मुख्य मंडी', status: 'red', slots: 6, wait: '90+ मि.' },
            ].map((m) => (
              <div key={m.name} className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${m.status === 'green' ? 'bg-secondary animate-pulse' : m.status === 'amber' ? 'bg-tertiary-container' : 'bg-error animate-pulse'}`} />
                  <div>
                    <p className="text-sm font-bold text-on-surface">{m.name}</p>
                    <p className="text-xs text-on-surface-variant">{m.slots} स्लॉट • {m.wait}</p>
                  </div>
                </div>
                <button onClick={() => navigate('/mandi-selection')} className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold">बुक करें</button>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy footer */}
        <div className="bg-surface-container-low rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-secondary text-xl shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
          <div>
            <p className="text-sm font-bold text-on-surface">शून्य डेटा नीति / Zero Data Policy</p>
            <p className="text-xs text-on-surface-variant mt-0.5">KisanQ कोई आधार, बैंक खाता या संवेदनशील जानकारी संग्रहीत नहीं करता।</p>
          </div>
        </div>

      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-container-lowest shadow-xl px-4 py-2 flex items-center justify-around z-50 rounded-t-2xl">
        {NAV_LINKS.map(({ icon, label, path }) => {
          const active = path === '/dashboard';
          return (
            <button key={label} onClick={() => navigate(path)} className={`flex flex-col items-center flex-1 py-1 ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
              <div className={active ? 'bg-primary-fixed px-3 py-1 rounded-full mb-0.5' : 'py-1 mb-0.5'}>
                <span className="material-symbols-outlined text-xl" style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
              </div>
              <span className="text-xs font-extrabold">{label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}
