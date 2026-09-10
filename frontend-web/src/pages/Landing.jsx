import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <main className="flex flex-col min-h-screen bg-surface items-center justify-center px-4 font-jakarta">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-xl">
            <span className="text-on-primary font-black text-3xl">KQ</span>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black text-primary tracking-tight">KisanQ</h1>
            <p className="text-sm text-on-surface-variant mt-1">किसान डिजिटल मंडी पोर्टल</p>
          </div>
        </div>

        {/* Role picker */}
        <div className="w-full flex flex-col gap-3">
          <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest text-center mb-1">
            आप कौन हैं? / Who are you?
          </p>

          <button
            id="landing-farmer-btn"
            onClick={() => navigate('/farmer-login')}
            className="btn-primary"
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>agriculture</span>
            <div className="text-left">
              <span className="block text-base font-black">किसान / Farmer</span>
              <span className="block text-xs opacity-80">स्लॉट बुक करें, टोकन देखें</span>
            </div>
          </button>

          <button
            id="landing-staff-btn"
            onClick={() => navigate('/staff-login')}
            className="w-full h-14 bg-surface-container-lowest text-on-surface rounded-xl font-bold text-base flex items-center gap-4 px-5 shadow-md transition-transform active:scale-95 border border-outline-variant"
          >
            <span className="material-symbols-outlined text-2xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
            <div className="text-left">
              <span className="block text-base font-black">स्टाफ / Staff</span>
              <span className="block text-xs text-on-surface-variant">गेट, तौल, पर्यवेक्षक, अधिकारी</span>
            </div>
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-on-surface-variant text-center">
          महाराष्ट्र कृषि उपज मंडी समिति
        </p>
      </div>
    </main>
  );
}
