import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <main className="flex flex-col min-h-screen bg-surface font-jakarta overflow-hidden relative">

      {/* Background decorative circles */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary opacity-5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-secondary opacity-5 blur-3xl pointer-events-none" />

      <div className="flex flex-col w-full max-w-md mx-auto px-6 py-8 gap-6 min-h-screen relative z-10">

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 pt-8">
          {/* Logo mark */}
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30">
              <span className="text-on-primary text-4xl font-black tracking-tight">KQ</span>
            </div>
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-secondary-fixed flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-on-secondary-fixed text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </span>
          </div>

          <div>
            <h1 className="text-4xl font-black text-primary tracking-tight">KisanQ</h1>
            <p className="text-sm font-extrabold text-secondary uppercase tracking-widest mt-1">e-Mandi Digital Gateway</p>
            <p className="text-xs text-on-surface-variant mt-2">SIH 2026 • नासिक कृषि उपज मंडी</p>
          </div>

          {/* Trust strip */}
          <div className="flex items-center gap-4 bg-surface-container-low px-5 py-3 rounded-2xl shadow-sm">
            {[['shield', 'Govt. Backed'], ['lock', 'Zero Aadhaar'], ['support_agent', '24x7 Help']].map(([icon, label]) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-secondary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wide text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Role Selection */}
        <div className="flex flex-col gap-4 pb-8">
          <p className="text-center text-sm font-bold text-on-surface-variant uppercase tracking-widest">आप कौन हैं? / Select Your Role</p>

          {/* Farmer CTA — primary, full width, large */}
          <button
            id="landing-farmer-btn"
            onClick={() => navigate('/farmer-login')}
            className="w-full bg-primary text-on-primary rounded-2xl p-6 flex items-center gap-5 shadow-xl shadow-primary/25 active:scale-95 transition-all text-left"
          >
            <div className="w-16 h-16 rounded-2xl bg-on-primary/10 flex items-center justify-center shrink-0">
              <span className="text-4xl">👨‍🌾</span>
            </div>
            <div className="flex-1">
              <span className="block text-xl font-black">मैं एक किसान हूँ</span>
              <span className="block text-sm text-on-primary/70 mt-0.5">I am a Farmer</span>
              <span className="block text-xs text-on-primary/50 mt-1.5">टोकन बुक करें • कतार देखें • भुगतान पाएं</span>
            </div>
            <span className="material-symbols-outlined text-on-primary/50 text-3xl">arrow_forward_ios</span>
          </button>

          {/* Staff CTA — secondary */}
          <button
            id="landing-staff-btn"
            onClick={() => navigate('/staff-login')}
            className="w-full bg-surface-container-lowest text-on-surface rounded-2xl p-5 flex items-center gap-4 shadow-md border border-outline-variant/30 active:scale-95 transition-all text-left"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center shrink-0">
              <span className="text-3xl">🏛️</span>
            </div>
            <div className="flex-1">
              <span className="block text-lg font-bold text-on-surface">मंडी अधिकारी</span>
              <span className="block text-sm text-on-surface-variant">Mandi Staff / Admin</span>
              <span className="block text-xs text-on-surface-variant/60 mt-1">Gate Guard • Supervisor • Auctioneer</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-2xl">arrow_forward_ios</span>
          </button>

          {/* Footer */}
          <div className="text-center pt-2">
            <p className="text-xs text-on-surface-variant">
              समस्या? <a href="tel:18001801551" className="text-primary font-bold">1800-180-1551</a> (Toll Free • 24x7)
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
