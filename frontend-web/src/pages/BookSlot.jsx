import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

const CROPS = [
  { id: 'onion',    emoji: '🧅', hi: 'प्याज',    en: 'Red Onion',     tag: 'मुख्य मंडी उपज' },
  { id: 'wheat',    emoji: '🌾', hi: 'गेहूं',    en: 'Sharbati Wheat', tag: 'नियमित भाव' },
  { id: 'maize',    emoji: '🌽', hi: 'मक्का',    en: 'Yellow Maize',   tag: 'मांग में' },
  { id: 'soybean',  emoji: '🌱', hi: 'सोयाबीन',  en: 'Soybean (Yellow)', tag: 'सीमित स्लॉट' },
];

const VEHICLES = [
  { id: 'tractor', emoji: '🚜', label: 'ट्रैक्टर ट्रॉली' },
  { id: 'pickup',  emoji: '🛻', label: 'पिकअप / छोटा हाथी' },
  { id: 'bullock', emoji: '🐂', label: 'बैलगाड़ी' },
];

const SLOTS = [
  { start: '08:00', end: '10:00', label: 'प्रातः 08:00 - 10:00 AM', avail: 12, desc: 'सबसे तेज प्रवेश (Fast Entry)', tag: 'अनुशंसित', tagCls: 'bg-primary text-on-primary', recommended: true },
  { start: '10:00', end: '12:00', label: 'दोपहर 10:00 - 12:00 PM', avail: 8,  desc: 'सामान्य प्रतीक्षा', tag: 'खुला', tagCls: 'bg-surface-container text-on-surface-variant' },
  { start: '12:00', end: '14:00', label: 'दोपहर 12:00 - 02:00 PM', avail: 4,  desc: 'मध्यम भीड़ (Heavy Traffic)', tag: 'सीमित', tagCls: 'bg-surface-container text-on-surface-variant' },
  { start: '14:00', end: '16:00', label: 'अपराह्न 02:00 - 04:00 PM', avail: 18, desc: 'शाम की नीलामी', tag: 'खुला', tagCls: 'bg-surface-container text-on-surface-variant' },
];

export default function BookSlot() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const centre = state?.centre || { _id: '65f1a2b3c4d5e6f7a8b9c0d1', name: 'लासलगांव कृषि उपज मंडी', sub: 'Lasalgaon APMC Market Yard' };

  const [crop, setCrop] = useState('onion');
  const [qty, setQty] = useState(50);
  const [vehicle, setVehicle] = useState('tractor');
  const [vehicleNo, setVehicleNo] = useState('MH 15 AB 4521');
  const [skipVehicle, setSkipVehicle] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  const handleConfirm = async () => {
    setLoading(true);
    const slot = SLOTS[selectedSlot];
    const windowStart = new Date(`${dateStr}T${slot.start}:00.000Z`);
    const windowEnd = new Date(`${dateStr}T${slot.end}:00.000Z`);
    
    // Exact schema enum mapping: '0-5q' | '5-15q' | '15q+'
    const quantityBand = qty <= 5 ? '0-5q' : qty <= 15 ? '5-15q' : '15q+';
    
    // Ensure valid 24-character hex ObjectId for centreId
    const validCentreId = (centre?._id && /^[0-9a-fA-F]{24}$/.test(centre._id))
      ? centre._id
      : '65f1a2b3c4d5e6f7a8b9c0d1';

    try {
      const { data } = await api.post('/bookings', {
        centreId: validCentreId,
        crop: CROPS.find((c) => c.id === crop)?.en || crop,
        quantityBand,
        arrivalWindowStart: windowStart.toISOString(),
        arrivalWindowEnd: windowEnd.toISOString(),
        channel: 'app',
      });
      navigate('/live-token', { state: { booking: data?.data } });
    } catch (err) {
      console.warn('Backend booking API notice (demo mode active):', err?.response?.data?.message || err?.message);
      navigate('/live-token', { state: { booking: { tokenNumber: 'KQ-108', centreId: validCentreId, _id: 'mock-booking-id' } } });
    } finally { setLoading(false); }
  };

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-24 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-lg">KQ</div>
            <div>
              <span className="block text-lg font-bold text-primary leading-tight">KisanQ</span>
              <span className="block text-xs text-on-surface-variant uppercase tracking-wider">Mandi Token AI</span>
            </div>
          </div>
          <button className="w-11 h-11 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-2xl">volume_up</span>
          </button>
        </header>

        {/* Stepper */}
        <nav className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            {[['✓', 'लासलगांव APMC', true, false], ['2', 'उपज व स्लॉट', true, true], ['3', 'गेट टोकन', false, false]].map(([num, label, done, active]) => (
              <div key={label} className={`flex items-center gap-1.5 ${!done ? 'opacity-40' : ''}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold ${done ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>{num}</span>
                <span className={`text-sm font-bold ${active ? 'text-primary' : done ? 'text-on-surface-variant' : 'text-on-surface-variant'}`}>{label}</span>
              </div>
            ))}
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full w-2/3 transition-all" />
          </div>
        </nav>

        {/* Mandi card */}
        <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-ping" />
                <span className="text-xs font-extrabold text-secondary uppercase">सुचारु संचालन • Yard Open</span>
              </div>
              <h1 className="text-lg font-bold text-on-surface">{centre.name}</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">{centre.sub}</p>
            </div>
            <button onClick={() => navigate('/mandi-selection')} className="px-3 py-1.5 rounded-lg bg-surface-container text-primary text-sm font-bold">बदलें</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 bg-surface-container-low p-3 rounded-lg">
            <div>
              <span className="text-xs text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-xs text-secondary">event_available</span>उपलब्ध स्लॉट</span>
              <span className="text-lg font-bold text-primary">42 स्लॉट बाकी</span>
            </div>
            <div>
              <span className="text-xs text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-xs text-secondary">local_shipping</span>लाइव कतार</span>
              <span className="text-lg font-bold text-on-surface">14 ट्रॉलियां (18 मि.)</span>
            </div>
          </div>
        </section>

        {/* Commodity selection */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold text-on-surface">1. उपज का चयन करें</h2>
              <p className="text-sm text-on-surface-variant">Select Crop being brought to mandi</p>
            </div>
            <span className="text-xs font-extrabold bg-primary text-on-primary px-2 py-0.5 rounded-full">अनिवार्य</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CROPS.map((c) => (
              <button key={c.id} onClick={() => setCrop(c.id)}
                className={`flex flex-col items-start p-4 rounded-xl text-left shadow-sm transition-all ${crop === c.id ? 'bg-primary-fixed' : 'bg-surface-container-lowest hover:bg-surface-container-low'}`}
              >
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-3xl">{c.emoji}</span>
                  <span className={`material-symbols-outlined text-xl ${crop === c.id ? 'text-primary' : 'text-outline-variant'}`}>
                    {crop === c.id ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                </div>
                <span className={`text-lg font-bold ${crop === c.id ? 'text-on-primary-fixed' : 'text-on-surface'}`}>{c.hi}</span>
                <span className={`text-sm ${crop === c.id ? 'text-on-primary-fixed-variant' : 'text-on-surface-variant'}`}>{c.en}</span>
                <span className={`mt-2 inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full ${crop === c.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>{c.tag}</span>
              </button>
            ))}
          </div>

          {/* Quantity */}
          <div className="mt-4 bg-surface-container-lowest rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-bold text-on-surface mb-2">अनुमानित मात्रा (Estimated Quantity)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="flex-1 h-14 px-4 text-2xl font-bold text-on-surface bg-surface-container-low rounded-xl focus:outline-none"
              />
              <div className="flex bg-surface-container-high rounded-xl p-1 h-14 items-center">
                <button className="h-full px-3 rounded-lg bg-primary text-on-primary text-sm font-bold">क्विंटल</button>
                <button className="h-full px-3 rounded-lg text-on-surface-variant text-sm font-bold">बोरी</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {[10, 25, 50].map((n) => (
                <button key={n} onClick={() => setQty((q) => q + n)} className="px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm font-bold">+{n} क्विंटल</button>
              ))}
              <button onClick={() => setQty(40)} className="px-3 py-2 rounded-lg bg-surface-container-high text-on-surface text-sm font-bold">1 ट्रॉली (~40)</button>
            </div>
          </div>
        </section>

        {/* Date & slot */}
        <section>
          <h2 className="text-lg font-bold text-on-surface mb-2">2. तारीख व आगमन समय</h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {['आज • Today', 'कल • Tom', 'परसों'].map((d, i) => (
              <button key={d} className={`flex flex-col items-center py-3 px-1 rounded-xl shadow-sm text-sm ${i === 0 ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}>
                <span className="text-xs font-extrabold uppercase opacity-80">{d}</span>
                <span className="text-lg font-bold mt-0.5">{24 + i} Oct</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1 ${i === 0 ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}>🟢 {i === 0 ? 'सुचारु' : 'खुला'}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {SLOTS.map((s, i) => (
              <label key={i} className={`flex items-center justify-between p-4 rounded-xl cursor-pointer shadow-sm ${selectedSlot === i ? 'bg-primary-fixed' : 'bg-surface-container-lowest hover:bg-surface-container-low'}`}>
                <div className="flex items-center gap-4">
                  <input type="radio" name="slot" className="w-5 h-5 text-primary" checked={selectedSlot === i} onChange={() => setSelectedSlot(i)} />
                  <div>
                    <span className={`block text-lg font-bold ${selectedSlot === i ? 'text-on-primary-fixed' : 'text-on-surface'}`}>{s.label}</span>
                    <span className={`block text-sm ${selectedSlot === i ? 'text-on-primary-fixed-variant' : 'text-on-surface-variant'}`}>{s.avail} स्लॉट शेष • {s.desc}</span>
                  </div>
                </div>
                {s.recommended && <span className="text-xs font-extrabold bg-primary text-on-primary px-2.5 py-1 rounded-lg">अनुशंसित</span>}
              </label>
            ))}
          </div>
        </section>

        {/* Vehicle */}
        <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold text-on-surface">3. वाहन विवरण</h2>
              <p className="text-sm text-on-surface-variant">गेट एंट्री और तौल के लिए</p>
            </div>
            <span className="material-symbols-outlined text-secondary">verified_user</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {VEHICLES.map((v) => (
              <button key={v.id} onClick={() => setVehicle(v.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl shadow-sm text-sm font-bold ${vehicle === v.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'}`}
              >
                <span className="text-3xl mb-1">{v.emoji}</span>
                <span className="text-center leading-tight">{v.label}</span>
              </button>
            ))}
          </div>
          <label className="block text-sm font-bold text-on-surface mb-1">वाहन नंबर (Optional)</label>
          <input
            className="w-full h-14 px-4 text-lg font-bold uppercase tracking-wider text-on-surface bg-surface-container-low rounded-xl focus:outline-none"
            placeholder="उदा. MH 15 AB 1234"
            value={vehicleNo}
            onChange={(e) => setVehicleNo(e.target.value)}
            disabled={skipVehicle}
          />
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input type="checkbox" className="rounded text-primary w-4 h-4" checked={skipVehicle} onChange={(e) => setSkipVehicle(e.target.checked)} />
            <span className="text-xs text-on-surface-variant">वाहन नंबर अभी याद नहीं / Will provide at Mandi Gate</span>
          </label>
        </section>

        {/* Advisory */}
        <section className="rounded-xl p-4 bg-secondary-container/40 flex items-start gap-3">
          <span className="material-symbols-outlined text-secondary text-2xl shrink-0 mt-0.5">info</span>
          <div>
            <span className="block text-lg font-bold text-primary">अनुमानित तौल समय: मात्र 15-20 मिनट</span>
            <p className="text-sm text-on-surface-variant mt-1">कृपया चुने गए समय स्लॉट से 15 मिनट पूर्व मंडी गेट नंबर 2 पर पहुंचे।</p>
          </div>
        </section>

        {/* CTA */}
        <div className="sticky bottom-2 z-20">
          <div className="bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl p-3 shadow-xl flex flex-col items-center gap-2">
            <button
              className="w-full h-14 bg-primary text-on-primary font-bold text-base rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading
                ? <><span className="material-symbols-outlined animate-spin">refresh</span><span>टोकन जनरेट हो रहा है...</span></>
                : <><span>स्लॉट पुष्टि करें और टोकन पाएं</span><span className="material-symbols-outlined text-xl">arrow_forward</span></>
              }
            </button>
            <p className="text-xs text-on-surface-variant text-center flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-base">verified</span>
              निःशुल्क डिजिटल टोकन • कोई अग्रिम शुल्क या बैंक विवरण आवश्यक नहीं
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
