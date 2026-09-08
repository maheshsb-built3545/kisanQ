import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STATUS_CONFIG = {
  green: { label: '🟢 सुचारु / Green', cls: 'bg-primary-fixed text-on-primary-fixed', dot: 'bg-secondary animate-pulse' },
  amber: { label: '🟡 मध्यम / Amber', cls: 'bg-tertiary-fixed text-on-tertiary-fixed', dot: 'bg-tertiary-container' },
  red:   { label: '🔴 व्यस्त / Red',   cls: 'bg-error-container text-on-error-container', dot: 'bg-error animate-pulse' },
};

const SEED_MANDIS = [
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d1', name: 'लासलगांव कृषि उपज मंडी', sub: 'Lasalgaon APMC Market Yard',
    tag: 'एशिया की सबसे बड़ी मंडी', status: 'green', wait: '15-20 मिनट', dist: '8.5', time: '20',
    slots: 42, queue: 14, crops: 'प्याज, गेहूं, मक्का', search: 'lasalgaon 422306'
  },
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d2', name: 'पिंपलगांव बसवंत मंडी', sub: 'Pimpalgaon Baswant APMC',
    tag: 'प्रमुख टमाटर मंडी', status: 'amber', wait: '45-60 मिनट', dist: '14.2', time: '35',
    slots: 18, queue: 38, crops: 'टमाटर, अंगूर, सोयाबीन', search: 'pimpalgaon 422209'
  },
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d3', name: 'नासिक मुख्य मंडी (पंचवटी)', sub: 'Nashik Main APMC Yard',
    tag: 'भारी भीड़ / High Rush', status: 'red', wait: '90+ मिनट', dist: '22.0', time: '50',
    slots: 6, queue: 72, crops: 'गेहूं, मक्का, सोयाबीन', search: 'nashik 422003'
  },
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d4', name: 'निफाड उप-मंडी केंद्र', sub: 'Niphad Sub-Mandi Yard',
    tag: 'त्वरित तौल सुविधा', status: 'green', wait: '10-15 मिनट', dist: '19.5', time: '40',
    slots: 55, queue: 6, crops: 'प्याज, गेहूं, मक्का', search: 'niphad 422303'
  },
];

export default function MandiSelection() {
  const navigate = useNavigate();
  const [mandis, setMandis] = useState(SEED_MANDIS);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/centres').then(({ data }) => {
      if (data?.data?.length) setMandis(data.data);
    }).catch(() => {});
  }, []);

  const visible = mandis.filter((m) => {
    const matchFilter = filter === 'all' || m.status === filter;
    const matchSearch = !query || m.name.toLowerCase().includes(query.toLowerCase()) || (m.search || '').includes(query.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-28 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Brand bar */}
        <div className="flex items-center justify-between bg-surface-container-lowest p-3 rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-lg">KQ</div>
            <div>
              <span className="block text-lg font-bold text-primary leading-tight">KisanQ</span>
              <span className="block text-xs font-extrabold text-secondary uppercase tracking-wider">डिजिटल मंडी टोकन</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface-container-low px-3 py-1 rounded-full text-primary text-xs font-bold">
              <span className="material-symbols-outlined text-sm mr-1">translate</span>
              हिन्दी
            </div>
            <button className="w-11 h-11 bg-primary-fixed text-on-primary-fixed rounded-xl flex items-center justify-center" onClick={() => alert('ऑडियो गाइड: लासलगांव मंडी में अभी सबसे कम प्रतीक्षा समय है।')}>
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>volume_up</span>
            </button>
          </div>
        </div>

        {/* Location bar */}
        <div className="flex items-center justify-between bg-surface-container-low px-4 py-3 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
            <div>
              <p className="text-sm font-bold text-on-surface">📍 नासिक ज़िला / Nashik District</p>
              <p className="text-xs text-on-surface-variant">महाराष्ट्र • {mandis.length} पंजीकृत मंडियां</p>
            </div>
          </div>
          <button className="text-sm font-bold text-primary bg-surface-container-lowest px-3 py-1.5 rounded-lg">बदलें</button>
        </div>

        {/* Search */}
        <div className="relative flex items-center w-full">
          <span className="material-symbols-outlined absolute left-4 text-on-surface-variant text-2xl pointer-events-none">search</span>
          <input
            className="w-full h-14 pl-12 pr-14 bg-surface-container-lowest rounded-xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-low shadow-sm"
            placeholder="मंडी का नाम या पिनकोड खोजें / Search APMC..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="absolute right-2 w-11 h-11 bg-secondary-fixed text-on-secondary-fixed rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-on-surface">कतार स्थिति फ़िल्टर</span>
            <span className="flex items-center text-xs font-extrabold text-secondary">
              <span className="w-2 h-2 rounded-full bg-secondary mr-1 animate-ping" />
              लाइव अपडेट
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[['all', `सभी (${mandis.length})`], ['green', 'सुचारु 🟢'], ['amber', 'मध्यम 🟡'], ['red', 'व्यस्त 🔴']].map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`filter-chip ${filter === f ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-surface-container p-3 rounded-xl space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-on-surface uppercase tracking-wide">कतार संकेत / Wait Times Guide</span>
            <span className="text-xs text-on-surface-variant">अभी-अभी</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {[
              ['bg-primary-fixed text-on-primary-fixed', '🟢 0-20 मिनट', 'कम भीड़ / Fast'],
              ['bg-tertiary-fixed text-on-tertiary-fixed', '🟡 30-60 मिनट', 'मध्यम / Normal'],
              ['bg-error-container text-on-error-container', '🔴 90+ मिनट', 'Rush'],
            ].map(([cls, top, bot]) => (
              <div key={top} className={`${cls} px-2 py-1 rounded-lg`}>
                <p className="text-xs font-extrabold">{top}</p>
                <p className="text-[10px] leading-tight">{bot}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mandi cards */}
        <div className="flex flex-col gap-4">
          {visible.map((m) => {
            const st = STATUS_CONFIG[m.status] || STATUS_CONFIG.green;
            return (
              <div key={m._id} className="mandi-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-xs font-extrabold text-secondary uppercase tracking-wider mb-1">
                      <span className="material-symbols-outlined text-base">store</span>
                      {m.tag}
                    </div>
                    <h2 className="text-lg font-bold text-on-surface leading-snug">{m.name}</h2>
                    <p className="text-sm text-on-surface-variant">{m.sub}</p>
                  </div>
                  <div className={`flex-shrink-0 ${st.cls} px-2.5 py-1.5 rounded-lg text-right`}>
                    <div className="flex items-center gap-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                      <span className="text-xs font-extrabold">{st.label}</span>
                    </div>
                    <span className="text-[11px] block mt-0.5">प्रतीक्षा: {m.wait}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-surface-container-low px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-1"><span className="material-symbols-outlined text-primary text-base">near_me</span><span className="text-sm font-bold">{m.dist} किमी</span></div>
                  <span className="text-outline text-xs">•</span>
                  <div className="flex items-center gap-1"><span className="material-symbols-outlined text-primary text-base">schedule</span><span className="text-sm">{m.time} मिनट की दूरी</span></div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-surface-container-low p-2 rounded-lg">
                    <span className="text-xs text-on-surface-variant block">उपलब्ध टोकन आज</span>
                    <span className={`text-lg font-bold ${m.status === 'green' ? 'text-secondary' : m.status === 'amber' ? 'text-tertiary' : 'text-error'}`}>{m.slots} स्लॉट बाकी</span>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded-lg">
                    <span className="text-xs text-on-surface-variant block">वर्तमान कतार</span>
                    <span className="text-lg font-bold text-on-surface">{m.queue} ट्रॉलियां</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                  <span className="material-symbols-outlined text-base">psychiatry</span>
                  <span>मुख्य उपज: <b>{m.crops}</b></span>
                </div>

                {m.status === 'red'
                  ? <button className="w-full h-14 bg-surface-container-high text-on-surface rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-xl">event</span>
                      कल के लिए बुक करें / Book for Tomorrow
                    </button>
                  : <button
                      className="w-full h-14 bg-primary text-on-primary rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md"
                      onClick={() => navigate('/book-slot', { state: { centre: m } })}
                    >
                      <span>स्लॉट बुक करें / Book Slot</span>
                      <span className="material-symbols-outlined text-xl">arrow_forward</span>
                    </button>
                }
              </div>
            );
          })}
        </div>

        {/* Privacy footer */}
        <div className="bg-surface-container-low p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
            <span className="text-sm font-bold text-on-surface">सुरक्षित एवं सरल किसान सेवा</span>
          </div>
          <p className="text-xs text-on-surface-variant">✓ कोई आधार कार्ड या बैंक खाता विवरण आवश्यक नहीं है।</p>
          <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">support_agent</span>
              <span className="text-sm text-on-surface">किसान सहायता हेल्पलाइन (24x7):</span>
            </div>
            <a href="tel:18001801551" className="text-sm font-bold text-primary">1800-180-1551</a>
          </div>
        </div>

      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-container-lowest shadow-xl px-4 py-2 flex items-center justify-around z-50 rounded-t-2xl">
        {[
          ['storefront', 'मंडी केंद्र', '/mandi-selection', true],
          ['confirmation_number', 'मेरे टोकन', '/live-token', false],
          ['traffic', 'कतार', '/live-token', false],
          ['help_outline', 'सहायता', '/', false],
        ].map(([icon, label, path, active]) => (
          <button key={label} onClick={() => navigate(path)} className={`flex flex-col items-center flex-1 py-1 ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
            <div className={active ? 'bg-primary-fixed px-3 py-1 rounded-full mb-0.5' : 'py-1 mb-0.5'}>
              <span className="material-symbols-outlined text-xl" style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
            </div>
            <span className="text-xs font-extrabold">{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
