import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <main className="flex flex-col min-h-screen bg-surface font-jakarta overflow-hidden relative">

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary/10 via-surface to-surface px-4 pt-10 pb-8 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 bg-primary-container px-3.5 py-1.5 rounded-full mb-6 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
          <span className="text-xs font-black text-on-primary uppercase tracking-widest">SIH26032 • National e-Mandi Platform</span>
        </div>

        <div className="w-20 h-20 rounded-3xl bg-primary text-on-primary flex items-center justify-center text-4xl font-black shadow-xl shadow-primary/20 mb-5">
          KQ
        </div>

        <h1 className="text-3xl font-black text-on-surface tracking-tight leading-none mb-2">
          Kisan<span className="text-primary">Q</span>
        </h1>
        <p className="text-sm font-extrabold text-secondary uppercase tracking-widest mb-4">
          डिजिटल मंडी कतार व टोकन प्रणाली
        </p>

        <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed mb-8">
          किसान भाइयों के लिए बिना कतार के सीधे मंडी प्रवेश, पारदर्शी तौल और सुरक्षित टोकन आरक्षण।
        </p>

        {/* Action Gateways */}
        <div className="w-full max-w-sm flex flex-col gap-3">
          <button
            onClick={() => navigate(ROUTES.FARMER_LOGIN)}
            className="w-full h-16 bg-primary text-on-primary font-bold text-base rounded-2xl shadow-xl shadow-primary/25 flex items-center justify-between px-5 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌾</span>
              <div className="text-left">
                <span className="block text-sm font-bold leading-tight">किसान पोर्टल / Farmer Portal</span>
                <span className="block text-[11px] font-normal opacity-80">स्लॉट बुक करें व टोकन देखें</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-2xl">arrow_forward</span>
          </button>

          <button
            onClick={() => navigate(ROUTES.STAFF_LOGIN)}
            className="w-full h-14 bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-bold text-sm rounded-2xl shadow-md flex items-center justify-between px-5 active:scale-[0.98] transition-all hover:bg-surface-container-low"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🛡️</span>
              <span className="text-sm font-bold">मंडी कर्मचारी पोर्टल / Staff Login</span>
            </div>
            <span className="material-symbols-outlined text-xl text-on-surface-variant">admin_panel_settings</span>
          </button>
        </div>
      </div>

      {/* Feature Badges */}
      <div className="px-4 max-w-sm mx-auto w-full pb-10 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => navigate(ROUTES.GUARD_TERMINAL)}
            className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-outline-variant/10"
          >
            <span className="text-2xl block mb-1">🚪</span>
            <span className="text-xs font-extrabold text-on-surface block">द्वारपाल टर्मिनल</span>
            <span className="text-[10px] text-on-surface-variant block">Gate Check-in &amp; QR</span>
          </div>

          <div
            onClick={() => navigate(ROUTES.SUPERVISOR_EXCEPTIONS)}
            className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-outline-variant/10"
          >
            <span className="text-2xl block mb-1">👨‍💼</span>
            <span className="text-xs font-extrabold text-on-surface block">पर्यवेक्षक कंसोल</span>
            <span className="text-[10px] text-on-surface-variant block">Exceptions &amp; Dispute</span>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-2xl">support_agent</span>
            <div>
              <span className="block text-xs font-extrabold text-on-surface">24x7 किसान हेल्पलाइन</span>
              <span className="block text-xs text-on-surface-variant">Toll-Free Assistance</span>
            </div>
          </div>
          <a href="tel:18001801551" className="text-xs font-extrabold text-primary bg-surface-container-lowest px-3 py-1.5 rounded-xl shadow-sm">
            1800-180-1551
          </a>
        </div>
      </div>

    </main>
  );
}
