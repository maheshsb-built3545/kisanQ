import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const POLL_INTERVAL_MS = 10_000; // 10s HTTP fallback when WS disconnected

export default function LiveToken() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const booking = state?.booking;
  const [tokenData, setTokenData] = useState({
    token: booking?.tokenNumber || 'KQ-108',
    farmerId: 'FMR-MH-4521',
    crop: 'प्याज / Red Onion',
    qty: '50 क्विंटल',
    arrival: '08:00 AM - 10:00 AM',
    position: 14,
    estimatedWait: 22,
    status: 'queued',
    lane: 'Gate No. 2 → Lane B → Weighbridge W3',
    centreId: booking?.centreId || null,
  });
  const [timer, setTimer] = useState(tokenData.estimatedWait * 60);
  const [wsConnected, setWsConnected] = useState(false);
  const pollRef = useRef(null);

  // ── HTTP polling fallback ─────────────────────────────────────────────────
  const pollPosition = useCallback(async () => {
    if (!booking?._id || !tokenData.centreId) return;
    try {
      const { data } = await api.get(
        `/queue/${tokenData.centreId}/position/${booking._id}`
      );
      if (data?.data) {
        setTokenData((prev) => ({ ...prev, ...data.data }));
        setTimer((data.data.estimatedWait || 0) * 60);
      }
    } catch {
      // Network error during poll — silently retry next tick
    }
  }, [booking, tokenData.centreId]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return; // already running
    pollPosition(); // immediate fetch
    pollRef.current = setInterval(pollPosition, POLL_INTERVAL_MS);
  }, [pollPosition]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── Socket.IO with automatic fallback ────────────────────────────────────
  useEffect(() => {
    const timerInterval = setInterval(
      () => setTimer((t) => (t > 0 ? t - 1 : 0)),
      1000
    );

    const socket = io(API_BASE, {
      auth: { token: localStorage.getItem('kq_token') },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      setWsConnected(true);
      stopPolling(); // WS is live — stop HTTP polling
    });

    socket.on('disconnect', () => {
      setWsConnected(false);
      startPolling(); // WS dropped — fall back to HTTP polling
    });

    socket.on('connect_error', () => {
      setWsConnected(false);
      startPolling(); // Initial WS failure — fall back immediately
    });

    if (booking?._id) {
      socket.on(`queue:${booking._id}:update`, (data) => {
        setTokenData((prev) => ({ ...prev, ...data }));
        setTimer((data.estimatedWait || 0) * 60);
      });
    }

    return () => {
      clearInterval(timerInterval);
      stopPolling();
      socket.disconnect();
    };
  }, [booking, startPolling, stopPolling]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Action handlers ────────────────────────────────────────────────────────────────────────
  const shareToken = async () => {
    const text = `📍 KisanQ गेट पास
तोकन: ${tokenData.token}
उपज: ${tokenData.crop}
मात्रा: ${tokenData.qty}
लान: ${tokenData.lane}
जानकारी: http://localhost:5173/live-token`;
    if (navigator.share) {
      try { await navigator.share({ title: `KisanQ Token ${tokenData.token}`, text }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      // Show brief feedback via title flash
      document.title = '✅ Token Copied!';
      setTimeout(() => { document.title = 'KisanQ – किसान डिजिटल मंडी पोर्टल'; }, 2000);
    }
  };

  const printToken = () => window.print();

  const cancelToken = () => {
    if (window.confirm('क्या आप वाकई यह निवेदन रद्द करना चाहते हैं?')) {
      navigate('/mandi-selection');
    }
  };

  const STATUS_LABEL = {
    queued:    { label: 'कतार में • In Queue',     cls: 'bg-tertiary-fixed text-on-tertiary-fixed' },
    called:    { label: 'आपकी बारी • Your Turn!',  cls: 'bg-secondary-fixed text-on-secondary-fixed animate-bounce' },
    arrived:   { label: 'पहुंच गए • Arrived',       cls: 'bg-primary-fixed text-on-primary-fixed' },
    completed: { label: 'पूर्ण • Done',              cls: 'bg-surface-container text-on-surface' },
  };
  const st = STATUS_LABEL[tokenData.status] || STATUS_LABEL.queued;

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-28 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-lg">KQ</div>
            <div>
              <span className="block text-lg font-bold text-primary">KisanQ</span>
              <span className="block text-xs text-on-surface-variant">Digital Gate Token</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* WS connectivity indicator */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-extrabold ${wsConnected ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-secondary animate-ping' : 'bg-tertiary-container'}`} />
              {wsConnected ? 'Live' : 'Polling'}
            </div>
            <div className={`px-3 py-2 rounded-xl text-sm font-bold ${st.cls}`}>{st.label}</div>
          </div>
        </header>

        {/* GATE PASS */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden">
          {/* Top banner */}
          <div className="bg-gradient-to-r from-primary to-primary-container px-5 py-4 flex items-center justify-between">
            <div>
              <span className="text-on-primary/70 text-xs font-extrabold uppercase tracking-wider block">लासलगांव कृषि उपज मंडी</span>
              <span className="text-on-primary text-xl font-bold block">डिजिटल गेट पास</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-on-primary material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <div className="text-right">
                <span className="text-on-primary/70 text-xs block">Token ID</span>
                <span className="text-on-primary font-extrabold text-lg tracking-wider">{tokenData.token}</span>
              </div>
            </div>
          </div>

          {/* Dashed divider */}
          <div className="flex items-center justify-between px-4 py-2">
            <div className="w-6 h-6 rounded-full bg-surface -ml-8 shadow-inner" />
            <div className="flex-1 border-dashed border-t border-outline-variant mx-4" />
            <div className="w-6 h-6 rounded-full bg-surface -mr-8 shadow-inner" />
          </div>

          {/* Token number big */}
          <div className="px-5 pt-2 pb-4 flex items-center justify-between">
            <div className="text-center">
              <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">टोकन क्रमांक</p>
              <p className="text-6xl font-black text-primary leading-none">{tokenData.token.split('-')[1] || tokenData.token}</p>
              <p className="text-xs text-on-surface-variant mt-1">{tokenData.token}</p>
            </div>
            {/* QR placeholder */}
            <div className="w-28 h-28 bg-on-surface rounded-xl flex items-center justify-center overflow-hidden shadow-md">
              <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                {[0, 1, 2, 3, 4, 5, 6].map((r) =>
                  [0, 1, 2, 3, 4, 5, 6].map((c) => {
                    const p = [
                      [0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],
                      [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[6,6],
                      [1,0],[2,0],[3,0],[4,0],[5,0],[1,6],[2,6],[3,6],[4,6],[5,6],
                      [0,6],[6,6],[2,2],[3,2],[4,2],[2,3],[3,3],[4,3],[2,4],[3,4],[4,4],
                    ];
                    const on = p.some(([pr, pc]) => pr === r && pc === c) || Math.random() > 0.55;
                    return on ? (
                      <rect key={`${r}-${c}`} x={c * 13 + 4} y={r * 13 + 4} width="11" height="11" fill="#faf8ff" />
                    ) : null;
                  })
                )}
              </svg>
            </div>
          </div>

          {/* Farmer info */}
          <div className="grid grid-cols-2 gap-2 mx-4 mb-4">
            {[
              ['किसान ID', tokenData.farmerId],
              ['उपज', tokenData.crop],
              ['मात्रा', tokenData.qty],
              ['आगमन विंडो', tokenData.arrival],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface-container-low rounded-xl p-3">
                <span className="block text-xs text-on-surface-variant">{k}</span>
                <span className="block text-sm font-bold text-on-surface leading-snug">{v}</span>
              </div>
            ))}
          </div>

          {/* Dashed divider */}
          <div className="flex items-center justify-between px-4 mb-2">
            <div className="w-6 h-6 rounded-full bg-surface -ml-8 shadow-inner" />
            <div className="flex-1 border-dashed border-t border-outline-variant mx-4" />
            <div className="w-6 h-6 rounded-full bg-surface -mr-8 shadow-inner" />
          </div>

          {/* Live queue status */}
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-3 bg-surface-container p-3 rounded-xl">
              <div className="text-center min-w-[3.5rem] bg-primary-fixed rounded-lg p-2">
                <span className="block text-3xl font-black text-primary leading-none">{tokenData.position}</span>
                <span className="block text-[10px] text-on-primary-fixed-variant">कतार में</span>
              </div>
              <div className="flex-1">
                <span className="block text-sm font-bold text-on-surface">आपकी कतार स्थिति</span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {[...Array(Math.min(tokenData.position, 8))].map((_, i) => (
                    <span
                      key={i}
                      className={`flex-1 h-2 rounded-full transition-all ${i < Math.max(0, tokenData.position - 3) ? 'bg-error' : 'bg-tertiary-fixed'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Countdown */}
            <div className="flex items-center justify-between bg-surface-container-low p-3 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-xl">timer</span>
                <span className="text-sm font-bold text-on-surface">अनुमानित प्रतीक्षा:</span>
              </div>
              <div className="text-right">
                <span className="block text-xl font-black text-tertiary tabular-nums">{fmt(timer)}</span>
                <span className="block text-xs text-on-surface-variant">मिनट शेष</span>
              </div>
            </div>

            {/* Lane */}
            <div className="bg-surface-container p-3 rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-xl">fork_right</span>
              <div>
                <span className="block text-xs text-on-surface-variant">निर्देशित मार्ग</span>
                <span className="block text-sm font-bold text-on-surface">{tokenData.lane}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/mandi-selection')} className="h-14 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col items-center justify-center gap-1 text-on-surface">
            <span className="material-symbols-outlined text-xl text-primary">store</span>
            <span className="text-xs font-bold">दूसरी मंडी</span>
          </button>
          <button onClick={shareToken} className="h-14 bg-secondary-fixed rounded-xl flex flex-col items-center justify-center gap-1 text-on-secondary-fixed">
            <span className="material-symbols-outlined text-xl">share</span>
            <span className="text-xs font-bold">टोकन शेयर करें</span>
          </button>
          <button onClick={printToken} className="h-14 bg-tertiary-fixed rounded-xl flex flex-col items-center justify-center gap-1 text-on-tertiary-fixed">
            <span className="material-symbols-outlined text-xl">print</span>
            <span className="text-xs font-bold">प्रिंट / PDF</span>
          </button>
          <button onClick={cancelToken} className="h-14 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col items-center justify-center gap-1 text-on-surface">
            <span className="material-symbols-outlined text-xl text-error">cancel</span>
            <span className="text-xs font-bold">रद्द करें</span>
          </button>
        </div>

        {/* Help */}
        <div className="bg-surface-container-low rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-surface-container-lowest text-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-lg">support_agent</span>
            </div>
            <div>
              <span className="block text-xs text-on-surface-variant">किसान सहायता हेल्पलाइन (24x7)</span>
              <span className="block text-sm font-bold text-on-surface">1800-180-1551 (Toll Free)</span>
            </div>
          </div>
          <a href="tel:18001801551" className="h-10 px-4 bg-primary text-on-primary rounded-lg text-sm font-bold flex items-center gap-1 shadow-sm">
            <span className="material-symbols-outlined text-base">call</span>
            Call
          </a>
        </div>

      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-container-lowest shadow-xl px-4 py-2 flex items-center justify-around z-50 rounded-t-2xl">
        {[
          ['storefront', 'मंडी', '/mandi-selection', false],
          ['confirmation_number', 'मेरा टोकन', '/live-token', true],
          ['traffic', 'कतार', '/live-token', false],
          ['help_outline', 'सहायता', '/farmer-login', false],
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
