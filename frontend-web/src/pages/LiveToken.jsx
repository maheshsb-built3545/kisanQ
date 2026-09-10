import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';

const API_BASE       = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const POLL_INTERVAL  = 10_000; // 10s HTTP fallback when WS disconnected

const STATUS_META = {
  BOOKED:                   { label: 'बुक हुआ',          cls: 'bg-surface-container text-on-surface-variant' },
  CONFIRMED:                { label: 'पुष्टि हुई',        cls: 'bg-primary-fixed text-on-primary-fixed' },
  CHECKED_IN:               { label: 'चेक-इन',           cls: 'bg-secondary-fixed text-on-secondary-fixed' },
  INSPECTED:                { label: 'निरीक्षण हुआ',      cls: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  WEIGHED_READY_FOR_AUCTION:{ label: 'Weighed — Ready',  cls: 'bg-primary text-on-primary' },
  ELIGIBLE_FOR_RELEASE:     { label: 'रिलीज़ योग्य',      cls: 'bg-tertiary-container text-on-tertiary-container' },
  RELEASED:                 { label: 'रिलीज़ हुआ',        cls: 'bg-surface-container-high text-on-surface' },
  CANCELLED:                { label: 'रद्द',              cls: 'bg-error-container text-on-error-container' },
  COMPLETED:                { label: 'पूर्ण',             cls: 'bg-secondary-container text-on-secondary-container' },
};

export default function LiveToken() {
  const navigate    = useNavigate();
  const { state }   = useLocation();
  const initBooking = state?.booking;

  const [booking, setBooking]       = useState(initBooking || null);
  const [position, setPosition]     = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loadError, setLoadError]   = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError]     = useState('');
  const pollRef = useRef(null);

  // ── Initial load: GET /bookings/:id ─────────────────────────────────────
  useEffect(() => {
    if (!initBooking?._id) {
      navigate('/dashboard', { replace: true });
      return;
    }
    api.get(`/bookings/${initBooking._id}`)
      .then(({ data }) => {
        const b = data.data || data;
        setBooking(b);
      })
      .catch((err) => {
        setLoadError(err.response?.data?.message || err.message || 'बुकिंग विवरण लोड नहीं हो सका।');
      });
  }, [initBooking, navigate]);

  const centreId = booking?.centreId?._id || booking?.centreId || null;

  // ── HTTP polling fallback ─────────────────────────────────────────────────
  const pollPosition = useCallback(async () => {
    if (!booking?._id || !centreId) return;
    try {
      const { data } = await api.get(`/queue/${centreId}/position/${booking._id}`);
      if (data?.data) setPosition(data.data);
    } catch {
      // Network error during poll — silently retry next tick (this is acceptable:
      // poll failures don't need to surface since the user can see stale position data)
    }
  }, [booking, centreId]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollPosition();
    pollRef.current = setInterval(pollPosition, POLL_INTERVAL);
  }, [pollPosition]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // ── Socket.IO + fallback ─────────────────────────────────────────────────
  useEffect(() => {
    if (!centreId) return;

    const socket = io(API_BASE, {
      auth: { token: localStorage.getItem('kq_token') },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      setWsConnected(true);
      stopPolling();
      socket.emit('join_centre_queue', centreId);
    });

    socket.on('disconnect', () => {
      setWsConnected(false);
      startPolling();
    });

    socket.on('connect_error', () => {
      setWsConnected(false);
      startPolling();
    });

    // queue:update may carry full booking data or position data
    socket.on('queue:update', (data) => {
      if (!data) return;
      // If the update is for our booking, merge into booking state
      if (data.bookingId && data.bookingId !== booking?._id?.toString()) return;
      if (data.status)        setBooking((prev) => prev ? { ...prev, ...data } : prev);
      if (data.position !== undefined) setPosition((prev) => ({ ...prev, ...data }));
    });

    return () => {
      stopPolling();
      socket.disconnect();
    };
  }, [centreId, booking?._id, startPolling, stopPolling]);

  // ── Cancel ───────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!window.confirm('क्या आप वाकई यह बुकिंग रद्द करना चाहते हैं?')) return;
    setCancelError('');
    setCancelLoading(true);
    try {
      // POST /bookings/:id/cancel
      await api.post(`/bookings/${booking._id}/cancel`, { reason: 'Farmer initiated cancellation' });
      setBooking((prev) => prev ? { ...prev, status: 'CANCELLED' } : prev);
    } catch (err) {
      setCancelError(err.response?.data?.message || err.message || 'रद्द करने में समस्या हुई।');
    } finally {
      setCancelLoading(false);
    }
  };

  const fmtWindow = (start, end) => {
    const opts = { hour: '2-digit', minute: '2-digit', hour12: true };
    const s = start ? new Date(start).toLocaleTimeString('en-IN', opts) : '—';
    const e = end   ? new Date(end).toLocaleTimeString('en-IN', opts)   : '—';
    return `${s} – ${e}`;
  };

  if (!booking && !loadError) {
    return (
      <main className="flex flex-col min-h-screen bg-surface items-center justify-center font-jakarta">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">autorenew</span>
      </main>
    );
  }

  const meta = STATUS_META[booking?.status] || STATUS_META.BOOKED;

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
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-extrabold ${wsConnected ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container text-on-surface-variant'}`}>
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-secondary animate-ping' : 'bg-on-surface-variant'}`} />
              {wsConnected ? 'Live' : 'Polling'}
            </div>
            <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
          </div>
        </header>

        {loadError && (
          <div className="error-banner" role="alert">
            <span className="material-symbols-outlined text-lg">error</span>
            {loadError}
          </div>
        )}

        {booking && (
          <>
            {/* Gate Pass card */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden">
              {/* Banner */}
              <div className="bg-gradient-to-r from-primary to-primary-container px-5 py-4 flex items-center justify-between">
                <div>
                  <span className="text-on-primary/70 text-xs font-extrabold uppercase tracking-wider block">
                    {typeof booking.centreId === 'object' ? booking.centreId?.name : 'मंडी'}
                  </span>
                  <span className="text-on-primary text-xl font-bold block">डिजिटल गेट पास</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  <div className="text-right">
                    <span className="text-on-primary/70 text-xs block">Token ID</span>
                    <span className="text-on-primary font-extrabold text-lg tracking-wider">{booking.tokenNumber}</span>
                  </div>
                </div>
              </div>

              {/* Dashed divider */}
              <div className="flex items-center justify-between px-4 py-2">
                <div className="w-6 h-6 rounded-full bg-surface -ml-8 shadow-inner" />
                <div className="flex-1 border-dashed border-t border-outline-variant mx-4" />
                <div className="w-6 h-6 rounded-full bg-surface -mr-8 shadow-inner" />
              </div>

              {/* Token number */}
              <div className="px-5 pt-2 pb-4 flex items-center justify-between">
                <div className="text-center">
                  <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">टोकन क्रमांक</p>
                  <p className="text-6xl font-black text-primary leading-none">
                    {booking.tokenNumber?.split('-').pop() || booking.tokenNumber}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">{booking.tokenNumber}</p>
                </div>
                {booking.qrCode ? (
                  <img src={booking.qrCode} alt="QR" className="w-28 h-28 rounded-xl" />
                ) : (
                  <div className="w-28 h-28 bg-on-surface rounded-xl flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-4xl text-surface-container-low">qr_code</span>
                  </div>
                )}
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2 mx-4 mb-4">
                {[
                  ['उपज / Crop',   booking.crop || '—'],
                  ['मात्रा / Qty', booking.quantityBand || '—'],
                  ['आगमन विंडो',   fmtWindow(booking.arrivalWindowStart, booking.arrivalWindowEnd)],
                  ['चैनल',         booking.channel || 'app'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-surface-container-low rounded-xl p-3">
                    <span className="block text-xs text-on-surface-variant">{k}</span>
                    <span className="block text-sm font-bold text-on-surface leading-snug">{v}</span>
                  </div>
                ))}
              </div>

              {/* Inspection / weight data if available */}
              {(booking.grade || booking.grossWeight) && (
                <>
                  <div className="flex items-center justify-between px-4 mb-2">
                    <div className="w-6 h-6 rounded-full bg-surface -ml-8 shadow-inner" />
                    <div className="flex-1 border-dashed border-t border-outline-variant mx-4" />
                    <div className="w-6 h-6 rounded-full bg-surface -mr-8 shadow-inner" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mx-4 mb-4">
                    {booking.grade && (
                      <div className="bg-surface-container-low rounded-xl p-3">
                        <span className="block text-xs text-on-surface-variant">ग्रेड</span>
                        <span className="block text-sm font-black text-on-surface">{booking.grade}</span>
                      </div>
                    )}
                    {booking.grossWeight != null && (
                      <div className="bg-surface-container-low rounded-xl p-3">
                        <span className="block text-xs text-on-surface-variant">सकल भार</span>
                        <span className="block text-sm font-black text-on-surface">{booking.grossWeight} Q</span>
                      </div>
                    )}
                    {booking.netWeight != null && (
                      <div className="bg-surface-container-low rounded-xl p-3">
                        <span className="block text-xs text-on-surface-variant">शुद्ध भार</span>
                        <span className="block text-sm font-black text-on-surface">{booking.netWeight} Q</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Live position (from queue:update or poll) */}
              {position?.position != null && (
                <div className="mx-4 mb-4 bg-surface-container p-3 rounded-xl flex items-center gap-3">
                  <div className="text-center min-w-[3.5rem] bg-primary-fixed rounded-lg p-2">
                    <span className="block text-3xl font-black text-primary leading-none">{position.position}</span>
                    <span className="block text-[10px] text-on-primary-fixed-variant">कतार में</span>
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-on-surface">आपकी कतार स्थिति</span>
                    {position.estimatedWait != null && (
                      <span className="block text-xs text-on-surface-variant mt-0.5">
                        अनुमानित प्रतीक्षा: {position.estimatedWait} मिनट
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {cancelError && (
              <div className="error-banner" role="alert">
                <span className="material-symbols-outlined text-lg">error</span>
                {cancelError}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/mandi-selection')}
                className="h-14 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-xl text-primary">store</span>
                <span className="text-xs font-bold">दूसरी मंडी</span>
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="h-14 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-xl text-secondary">dashboard</span>
                <span className="text-xs font-bold">डैशबोर्ड</span>
              </button>
              {['BOOKED','CONFIRMED'].includes(booking.status) && (
                <button
                  id="live-token-cancel-btn"
                  onClick={handleCancel}
                  disabled={cancelLoading}
                  className="h-14 col-span-2 bg-error-container text-on-error-container rounded-xl flex items-center justify-center gap-2 font-bold text-sm disabled:opacity-60"
                >
                  {cancelLoading
                    ? <><span className="material-symbols-outlined animate-spin">autorenew</span>रद्द हो रहा है...</>
                    : <><span className="material-symbols-outlined">cancel</span>बुकिंग रद्द करें</>
                  }
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-container-lowest shadow-xl px-4 py-2 flex items-center justify-around z-50 rounded-t-2xl">
        {[
          ['storefront', 'मंडी', '/mandi-selection', false],
          ['confirmation_number', 'मेरा टोकन', '/live-token', true],
          ['dashboard', 'डैशबोर्ड', '/dashboard', false],
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
