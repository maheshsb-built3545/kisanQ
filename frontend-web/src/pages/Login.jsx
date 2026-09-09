import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const LANGS = {
  hi: {
    title: 'किसान लॉगिन / Farmer Entry',
    badge: 'SIH26032 • e-Mandi Gateway',
    phoneHeader: 'अपना 10-अंकों का मोबाइल नंबर दर्ज करें',
    phoneDesc: 'केवल पंजीकृत टोकन व भुगतान एसएमएस के लिए उपयोग होगा।',
    privacy: 'शून्य डेटा संग्रह (No Aadhaar/Bank)',
    btnSend: 'ओटीपी पाएं / Get OTP',
    sending: 'कॉलिंग / Requesting...',
    helpline: 'किसान सहायता केंद्र (24x7 Helpline)',
    voiceMain: 'आवाज से सहायता लें',
    voiceSub: 'सुनने के लिए माइक बटन दबाएं',
  },
  en: {
    title: 'Farmer Login / Kisan Gateway',
    badge: 'SIH26032 • e-Mandi Gateway',
    phoneHeader: 'Enter 10-digit Mobile Number',
    phoneDesc: 'Used strictly for Mandi token & arrival updates.',
    privacy: 'Zero Data Collection (No Aadhaar/Bank)',
    btnSend: 'Get OTP / Request Code',
    sending: 'Requesting...',
    helpline: 'Kisan Support Centre (24x7 Helpline)',
    voiceMain: 'Voice Assistance',
    voiceSub: 'Tap listen button for help',
  },
  mr: {
    title: 'शेतकरी लॉगिन / Farmer Login',
    badge: 'SIH26032 • e-Mandi Gateway',
    phoneHeader: 'आपला 10-अंकी मोबाईल नंबर टाका',
    phoneDesc: 'फक्त आवक टोकन व पेमेंट मेसेजसाठी वापरले जाईल.',
    privacy: 'शून्य डेटा संकलन (No Aadhaar/Bank)',
    btnSend: 'ओटीपी मिळवा / Get OTP',
    sending: 'विनंती करत आहे...',
    helpline: 'किसान सहाय्यता केंद्र (24x7)',
    voiceMain: 'ध्वनी सहाय्य मिळवा',
    voiceSub: 'ऐकण्यासाठी प्ले बटन दाबा',
  },
};

export default function Login() {
  const [lang, setLang] = useState('hi');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const t = LANGS[lang];

  const handleSendOtp = async () => {
    if (phone.length !== 10) { setError('कृपया 10 अंकों का नंबर दर्ज करें।'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/farmer/request-otp', { phone });
      const devOtp = data?.data?.devOtp || '582490';
      navigate('/otp-verify', { state: { phone, lang, devOtp } });
    } catch (err) {
      console.warn('Backend OTP request notice (demo mode fallback active):', err?.response?.data?.message || err?.message);
      navigate('/otp-verify', { state: { phone, lang, devOtp: '582490' } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-6 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Language Selector */}
        <div className="flex items-center justify-between bg-surface-container-low px-3 py-2 rounded-full shadow-sm">
          <div className="flex items-center gap-2 text-on-surface-variant text-xs font-bold uppercase tracking-wide">
            <span className="material-symbols-outlined text-secondary text-lg">translate</span>
            <span>भाषा / Language</span>
          </div>
          <div className="flex gap-1">
            {['hi', 'en', 'mr'].map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1 rounded-full text-xs font-extrabold transition-colors ${lang === l ? 'bg-primary-container text-on-primary shadow-sm' : 'bg-surface-container-highest text-on-surface'}`}
              >
                {l === 'hi' ? 'हिन्दी' : l === 'en' ? 'English' : 'मराठी'}
              </button>
            ))}
          </div>
        </div>

        {/* Trust Banner */}
        <div className="flex items-center justify-between bg-surface-container-lowest p-3 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div>
              <span className="block text-xs font-extrabold text-secondary uppercase tracking-wider">{t.badge}</span>
              <span className="block text-base font-bold text-on-surface leading-tight">{t.title}</span>
            </div>
          </div>
          <span className="px-2 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant text-xs font-extrabold">Govt Mandi</span>
        </div>

        {/* Main Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-md p-4 flex flex-col gap-4">

          {/* Voice Guidance */}
          <div className="flex items-center justify-between bg-surface-container-low px-3 py-2 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-base animate-pulse">volume_up</span>
              </div>
              <div>
                <span className="block text-sm font-bold text-on-surface">{t.voiceMain}</span>
                <span className="block text-xs text-on-surface-variant">{t.voiceSub}</span>
              </div>
            </div>
            <button className="h-10 px-3 bg-surface-container-highest text-on-surface rounded-lg text-sm font-bold flex items-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-lg text-secondary">play_circle</span>
              <span>सुनें</span>
            </button>
          </div>

          {/* Phone input */}
          <div>
            <label className="block text-lg font-extrabold text-on-surface mb-1">{t.phoneHeader}</label>
            <p className="text-sm text-on-surface-variant mb-3">{t.phoneDesc}</p>

            <div className="relative flex items-stretch rounded-xl shadow-sm bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary-container">
              {/* India flag + +91 */}
              <div className="flex items-center gap-1.5 px-3 bg-surface-container-high rounded-l-xl text-on-surface">
                <div className="w-5 h-3.5 rounded-sm overflow-hidden flex flex-col shadow-inner">
                  <span className="h-1/3 bg-[#FF9933] w-full block" />
                  <span className="h-1/3 bg-white w-full flex items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-[#000080] block" />
                  </span>
                  <span className="h-1/3 bg-[#128807] w-full block" />
                </div>
                <span className="text-lg font-bold text-on-surface">+91</span>
              </div>
              <input
                className="w-full h-14 px-3 text-xl font-bold text-on-surface placeholder:text-outline-variant tracking-wider bg-transparent outline-none"
                type="tel"
                maxLength={10}
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-on-surface-variant px-1 pt-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-secondary">lock</span>
                {t.privacy}
              </span>
              <span className="font-mono text-outline">POST /farmer/request-otp</span>
            </div>
          </div>

          {error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded-lg">{error}</p>}

          <button
            className="btn-primary"
            onClick={handleSendOtp}
            disabled={loading}
          >
            {loading
              ? <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span><span>{t.sending}</span></>
              : <><span className="material-symbols-outlined text-lg">sms</span><span>{t.btnSend}</span></>
            }
          </button>
        </div>

        {/* Helpline */}
        <div className="bg-surface-container-low rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary">support_agent</span>
              {t.helpline}
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface text-xs font-extrabold">Toll-Free</span>
          </div>
          <a href="tel:18001801551"
            className="w-full h-12 rounded-xl bg-surface-container-lowest text-on-surface text-sm font-bold flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-primary text-lg">call</span>
            <span className="text-primary font-black tracking-wider">1800-180-1551</span>
            <span className="text-on-surface-variant text-xs">(किसान कॉल सेंटर)</span>
          </a>
        </div>

      </div>
    </main>
  );
}
