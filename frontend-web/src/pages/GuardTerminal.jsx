import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const MOCK_QUEUE = [
  { token: 'KQ-105', farmer: 'विजय पाटील', qty: '45 क्विंटल', vehicle: 'MH 15 AB 1234', status: 'called', wait: 0, crop: '🧅 प्याज' },
  { token: 'KQ-106', farmer: 'रामदास शिंदे', qty: '30 क्विंटल', vehicle: 'MH 09 CD 5678', status: 'queued', wait: 8, crop: '🌾 गेहूं' },
  { token: 'KQ-107', farmer: 'सुरेश जाधव', qty: '55 क्विंटल', vehicle: 'MH 15 GH 9012', status: 'queued', wait: 16, crop: '🌽 मक्का' },
  { token: 'KQ-108', farmer: '(आप / You)', qty: '50 क्विंटल', vehicle: 'MH 15 AB 4521', status: 'queued', wait: 22, crop: '🧅 प्याज', isMe: true },
  { token: 'KQ-109', farmer: 'रमेश निकम', qty: '25 क्विंटल', vehicle: 'MH 15 JK 3456', status: 'queued', wait: 30, crop: '🌱 सोयाबीन' },
  { token: 'KQ-110', farmer: 'सुनील वाघ', qty: '38 क्विंटल', vehicle: 'MH 26 MN 7890', status: 'queued', wait: 38, crop: '🧅 प्याज' },
];

const STATUS_CFG = {
  called:  { dot: 'bg-secondary animate-ping', lbl: 'बुलाया जा रहा / Being Called', badge: 'bg-secondary-fixed text-on-secondary-fixed' },
  queued:  { dot: 'bg-primary-container',      lbl: 'प्रतीक्षारत / Waiting',         badge: 'bg-surface-container text-on-surface-variant' },
  arrived: { dot: 'bg-primary',                lbl: 'पहुंच गए / Arrived',             badge: 'bg-primary-fixed text-on-primary-fixed' },
};

export default function GuardTerminal() {
  const navigate = useNavigate();
  const [queue, setQueue]               = useState(MOCK_QUEUE);
  const [activeFilter, setActiveFilter] = useState('all');
  // QR scanner state
  const [scanInput, setScanInput]       = useState('');
  const [scannedEntry, setScannedEntry] = useState(null);
  const [scanError, setScanError]       = useState('');
  // Big CTA state
  const [entryLoading, setEntryLoading] = useState(false);
  const [entrySuccess, setEntrySuccess] = useState(false);
  const scanRef = useRef(null);

  useEffect(() => {
    api.get('/queue').then(({ data }) => {
      if (data?.data?.length) setQueue(data.data);
    }).catch(() => {});

    const socket = io(API_BASE, { auth: { token: localStorage.getItem('kq_token') } });
    socket.on('queue:update', (entries) => setQueue(entries));
    return () => socket.disconnect();
  }, []);

  const visible = activeFilter === 'all' ? queue : queue.filter((q) => q.status === activeFilter);

  const handleCheckin = async (token) => {
    try { await api.patch(`/queue/${token}/checkin`); } catch { /* optimistic */ }
    setQueue((q) => q.map((e) => e.token === token ? { ...e, status: 'arrived' } : e));
    if (scannedEntry?.token === token) setScannedEntry((p) => p ? { ...p, status: 'arrived' } : p);
  };

  // ── QR / manual token lookup ──────────────────────────────────────────────
  const handleScan = () => {
    const id = scanInput.trim().toUpperCase();
    if (!id) return;
    const norm = id.startsWith('KQ-') ? id : id.startsWith('KQ') ? `KQ-${id.slice(2)}` : `KQ-${id}`;
    const found = queue.find((e) => e.token === norm);
    if (found) { setScannedEntry(found); setScanError(''); }
    else { setScannedEntry(null); setScanError(`टोकन "${norm}" कतार में नहीं मिला।`); }
  };

  // ── Big "ALLOW ENTRY" CTA ─────────────────────────────────────────────────
  const handleAllowEntry = async () => {
    if (!scannedEntry) return;
    setEntryLoading(true);
    try { await api.post(`/queue/${scannedEntry.token}/check-in`); } catch { /* optimistic */ }
    setQueue((q) => q.map((e) => e.token === scannedEntry.token ? { ...e, status: 'arrived' } : e));
    setEntryLoading(false);
    setEntrySuccess(true);
  };

  const resetScan = () => {
    setScanInput(''); setScannedEntry(null);
    setScanError(''); setEntrySuccess(false);
    setTimeout(() => scanRef.current?.focus(), 50);
  };

  // ── Full-screen success screen ──────────────────────────────────────────
  if (entrySuccess && scannedEntry) {
    return (
      <main className="flex flex-col min-h-screen bg-surface items-center justify-center px-4 font-jakarta">
        <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
          <div className="w-28 h-28 rounded-full bg-secondary-fixed flex items-center justify-center shadow-xl">
            <span className="material-symbols-outlined text-6xl text-on-secondary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          </div>
          <div>
            <p className="text-xs font-extrabold text-secondary uppercase tracking-widest mb-1">प्रवेश पूर्ण / Entry Complete</p>
            <h1 className="text-3xl font-black text-primary">Gate Open!</h1>
            <p className="text-sm text-on-surface-variant mt-1">Farmer has been granted entry.</p>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-5 w-full shadow-md text-left space-y-2.5">
            <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/30">
              <div className="w-14 h-14 rounded-xl bg-primary text-on-primary flex items-center justify-center text-2xl font-black shadow-sm">
                {scannedEntry.token.split('-')[1]}
              </div>
              <div>
                <p className="text-lg font-bold text-on-surface">{scannedEntry.token}</p>
                <p className="text-sm text-on-surface-variant">{scannedEntry.farmer}</p>
              </div>
            </div>
            {[['उपज', scannedEntry.crop], ['मात्रा', scannedEntry.qty], ['वाहन', scannedEntry.vehicle], ['गेट', 'Gate No. 2 → Lane B → W3']].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-sm text-on-surface-variant">{k}</span>
                <span className="text-sm font-bold text-on-surface">{v}</span>
              </div>
            ))}
            <div className="mt-1 bg-secondary-fixed/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-base">schedule</span>
              <span className="text-sm font-bold text-secondary">
                {new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })} — Entry logged
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button onClick={resetScan} className="h-14 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
              अगला स्कैन
            </button>
            <button onClick={() => navigate(-1)} className="h-14 bg-surface-container-lowest text-on-surface rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-xl">list</span>
              वापस जाएं
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-4 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="bg-surface-container-lowest rounded-xl shadow-sm p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-secondary uppercase tracking-wider mb-1">
                <span className="material-symbols-outlined text-base">lock</span>
                Staff Gate Terminal
              </div>
              <h1 className="text-lg font-bold text-on-surface">लासलगांव मंडी – गेट नं. 2</h1>
              <p className="text-sm text-on-surface-variant">Gate Entry & Queue Display Dashboard</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold bg-secondary-fixed text-on-secondary-fixed px-2 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-secondary block" />
                लाइव
              </div>
              <span className="material-symbols-outlined text-on-surface text-2xl">account_circle</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[['confirmation_number', 'कुल टोकन', queue.length], ['call_to_action', 'वर्तमान कतार', queue.filter(q => q.status === 'queued').length], ['check_circle', 'चेक-इन', queue.filter(q => q.status === 'arrived').length]].map(([icon, label, val]) => (
              <div key={label} className="bg-surface-container-low rounded-lg p-2 text-center">
                <span className="material-symbols-outlined text-xl text-primary block">{icon}</span>
                <span className="block text-xs text-on-surface-variant">{label}</span>
                <span className="block text-xl font-bold text-on-surface">{val}</span>
              </div>
            ))}
          </div>
        </header>

        {/* Scan banner */}
        <div className="bg-primary-fixed rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold text-on-primary-fixed-variant uppercase">QR SCANNER ACTIVE</span>
              <h2 className="text-xl font-bold text-on-primary-fixed">QR कोड स्कैन करें</h2>
              <p className="text-sm text-on-primary-fixed-variant">Hold farmer's token under scanner or enter manually</p>
            </div>
            <div className="w-16 h-16 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-4xl text-primary">qr_code_scanner</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <input
              ref={scanRef}
              id="guard-scan-input"
              className="flex-1 h-12 px-3 rounded-xl bg-surface-container-lowest text-on-surface text-sm font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder='Token ID: KQ-108 या सिर्फ "108"'
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            />
            <button
              id="guard-verify-btn"
              onClick={handleScan}
              className="h-12 px-4 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform"
            >Verify</button>
          </div>
          {scanError && <p className="mt-2 text-sm text-error bg-error-container/80 px-3 py-1.5 rounded-lg">{scanError}</p>}
        </div>

        {/* Scanned token panel + BIG CTA */}
        {scannedEntry && (
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden ring-2 ring-primary">
            <div className="bg-gradient-to-r from-primary to-primary-container px-5 py-3 flex items-center justify-between">
              <div>
                <span className="text-on-primary/70 text-xs font-extrabold uppercase tracking-wider block">स्कैन किया गया टोकन</span>
                <span className="text-on-primary text-xl font-bold">{scannedEntry.token}</span>
              </div>
              <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold ${STATUS_CFG[scannedEntry.status]?.badge}`}>
                {STATUS_CFG[scannedEntry.status]?.lbl}
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[['किसान', scannedEntry.farmer], ['उपज', scannedEntry.crop], ['मात्रा', scannedEntry.qty], ['वाहन', scannedEntry.vehicle]].map(([k, v]) => (
                  <div key={k} className="bg-surface-container-low rounded-xl p-2.5">
                    <span className="block text-xs text-on-surface-variant">{k}</span>
                    <span className="block text-sm font-bold text-on-surface leading-snug">{v}</span>
                  </div>
                ))}
              </div>
              <div className="bg-secondary-fixed/20 rounded-xl p-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-xl">fork_right</span>
                <div>
                  <span className="block text-xs text-on-surface-variant">निर्देशित मार्ग</span>
                  <span className="block text-sm font-bold text-on-surface">Gate No. 2 → Lane B → Weighbridge W3</span>
                </div>
              </div>
              {scannedEntry.status === 'arrived' ? (
                <div className="w-full h-16 bg-secondary-fixed text-on-secondary-fixed rounded-xl flex items-center justify-center gap-3 text-base font-bold">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  प्रवेश पूर्ण / Entry Already Done
                </div>
              ) : (
                <button
                  id="guard-allow-entry-btn"
                  onClick={handleAllowEntry}
                  disabled={entryLoading}
                  className="w-full h-16 bg-primary text-on-primary rounded-xl flex items-center justify-center gap-3 text-base font-bold shadow-xl active:scale-95 transition-all disabled:opacity-70"
                >
                  {entryLoading
                    ? <><span className="material-symbols-outlined text-2xl animate-spin">autorenew</span><span>प्रवेश दर्ज हो रहा है...</span></>
                    : <><span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>door_open</span><span>ALLOW ENTRY &amp; PRINT SLIP</span></>
                  }
                </button>
              )}
              <button onClick={resetScan} className="w-full h-10 bg-surface-container text-on-surface-variant rounded-xl text-sm font-bold">रद्द करें / Clear Scan</button>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[['all', 'सभी'], ['called', 'बुलाए गए'], ['queued', 'प्रतीक्षारत'], ['arrived', 'पहुंचे']].map(([f, label]) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`filter-chip ${activeFilter === f ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}
            >{label}</button>
          ))}
        </div>

        {/* Queue list */}
        <div className="flex flex-col gap-3">
          {visible.map((entry) => {
            const cfg = STATUS_CFG[entry.status] || STATUS_CFG.queued;
            return (
              <div key={entry.token} className={`bg-surface-container-lowest rounded-xl p-4 shadow-sm ${entry.isMe ? 'ring-2 ring-primary' : ''}`}>
                {entry.isMe && (
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-primary mb-2">
                    <span className="material-symbols-outlined text-base">person</span>
                    आपका टोकन / Your Token
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black ${entry.isMe ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'}`}>
                        {entry.token.split('-')[1]}
                      </div>
                      <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${cfg.dot}`} />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-on-surface">{entry.token}</p>
                      <p className="text-sm text-on-surface-variant">{entry.farmer}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-extrabold px-2 py-1 rounded-lg ${cfg.badge}`}>{cfg.lbl}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="bg-surface-container-low p-2 rounded-lg">
                    <span className="text-xs text-on-surface-variant block">उपज</span>
                    <span className="text-sm font-bold">{entry.crop}</span>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded-lg">
                    <span className="text-xs text-on-surface-variant block">मात्रा</span>
                    <span className="text-sm font-bold">{entry.qty}</span>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded-lg">
                    <span className="text-xs text-on-surface-variant block">वाहन</span>
                    <span className="text-sm font-bold truncate">{entry.vehicle}</span>
                  </div>
                </div>

                {entry.status === 'queued' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleCheckin(entry.token)} className="flex-1 h-11 bg-secondary text-on-secondary rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      चेक-इन करें
                    </button>
                    <button className="flex-1 h-11 bg-surface-container-high text-on-surface rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-lg">call</span>
                      बुलाएं
                    </button>
                  </div>
                )}
                {entry.status === 'called' && (
                  <div className="mt-3 bg-secondary-fixed text-on-secondary-fixed px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold">
                    <span className="material-symbols-outlined text-lg">campaign</span>
                    अनाउंसमेंट जारी / Announcement Active
                  </div>
                )}
                {entry.status === 'arrived' && (
                  <div className="mt-3 bg-primary-fixed text-on-primary-fixed px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-bold">
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    प्रवेश पूर्ण / Entry Complete
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
