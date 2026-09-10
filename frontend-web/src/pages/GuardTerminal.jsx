import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';

const API_BASE      = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const POLL_INTERVAL = 10_000;

const STATUS_META = {
  BOOKED:                   { label: 'बुक हुआ',          badge: 'bg-surface-container text-on-surface-variant',    dot: 'bg-outline' },
  CONFIRMED:                { label: 'पुष्टि हुई',        badge: 'bg-primary-fixed text-on-primary-fixed',          dot: 'bg-primary' },
  CHECKED_IN:               { label: 'चेक-इन',           badge: 'bg-secondary-fixed text-on-secondary-fixed',       dot: 'bg-secondary animate-ping' },
  INSPECTED:                { label: 'निरीक्षण हुआ',      badge: 'bg-tertiary-fixed text-on-tertiary-fixed',         dot: 'bg-tertiary' },
  WEIGHED_READY_FOR_AUCTION:{ label: 'Weighed — Ready',  badge: 'bg-primary text-on-primary',                       dot: 'bg-primary' },
  ELIGIBLE_FOR_RELEASE:     { label: 'रिलीज़ योग्य',      badge: 'bg-tertiary-container text-on-tertiary-container', dot: 'bg-tertiary animate-ping' },
  RELEASED:                 { label: 'रिलीज़ हुआ',        badge: 'bg-surface-container-high text-on-surface',        dot: 'bg-on-surface-variant' },
  CANCELLED:                { label: 'रद्द',              badge: 'bg-error-container text-on-error-container',        dot: 'bg-error' },
  COMPLETED:                { label: 'पूर्ण',             badge: 'bg-secondary-container text-on-secondary-container',dot: 'bg-secondary' },
};

function getUser() {
  try { return JSON.parse(localStorage.getItem('kq_user') || '{}'); } catch { return {}; }
}

function BookingCard({ entry, onCheckin, onMarkEligible, onRelease, actionLoading, actionError }) {
  const isOverdue = entry.gracePeriodEnd && new Date(entry.gracePeriodEnd) < Date.now() && entry.status === 'CONFIRMED';
  const meta    = STATUS_META[entry.status] || STATUS_META.BOOKED;
  const canCi   = ['BOOKED','CONFIRMED'].includes(entry.status);
  const canME   = entry.status === 'CONFIRMED';
  const canRel  = entry.status === 'ELIGIBLE_FOR_RELEASE';
  const myLoad  = actionLoading === entry._id;

  return (
    <div className={`card p-4 space-y-3 transition-all ${isOverdue ? 'border-2 border-error bg-error-container/10 shadow-md' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-12 h-12 rounded-xl text-on-primary flex items-center justify-center text-sm font-black shadow-sm ${isOverdue ? 'bg-error' : 'bg-primary'}`}>
              {entry.tokenNumber?.split('-').pop() || '—'}
            </div>
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${isOverdue ? 'bg-error animate-ping' : meta.dot}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold text-on-surface">{entry.tokenNumber}</p>
              {isOverdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-error text-on-error animate-pulse shadow-sm">
                  <span className="material-symbols-outlined text-[13px]">warning</span>
                  Grace period expired
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant">{entry.farmerId?.name || entry.farmerName || '—'}</p>
          </div>
        </div>
        <span className={`status-pill ${meta.badge}`}>{meta.label}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['उपज', entry.crop],
          ['मात्रा', entry.quantityBand],
          ['चैनल', entry.channel],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface-container-low p-2 rounded-lg">
            <span className="text-xs text-on-surface-variant block">{k}</span>
            <span className="text-sm font-bold">{v || '—'}</span>
          </div>
        ))}
      </div>

      {myLoad && (
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-base">autorenew</span>
          क्रिया हो रही है...
        </div>
      )}

      {actionError && actionError.id === entry._id && (
        <div className="error-banner text-xs" role="alert">
          <span className="material-symbols-outlined text-base">error</span>
          {actionError.msg}
        </div>
      )}

      <div className="flex gap-2">
        {canCi && (
          <button
            id={`checkin-btn-${entry._id}`}
            onClick={() => onCheckin(entry._id)}
            disabled={myLoad}
            className="flex-1 h-11 bg-secondary text-on-secondary rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 hover:opacity-90 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            चेक-इन
          </button>
        )}
        {canME && (
          <button
            id={`mark-eligible-btn-${entry._id}`}
            onClick={() => onMarkEligible(entry._id)}
            disabled={myLoad}
            className={`flex-1 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-95 transition-all ${
              isOverdue
                ? 'bg-error-container text-on-error-container border-2 border-error font-extrabold shadow-sm'
                : 'bg-tertiary-container text-on-tertiary-container'
            }`}
          >
            <span className="material-symbols-outlined text-base">timer_off</span>
            No-Show Mark
          </button>
        )}
        {canRel && (
          <button
            id={`release-btn-${entry._id}`}
            onClick={() => onRelease(entry._id)}
            disabled={myLoad}
            className="flex-1 h-11 bg-error text-on-error rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 hover:opacity-90 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">door_back</span>
            स्लॉट रिलीज़
          </button>
        )}
      </div>
    </div>
  );
}

export default function GuardTerminal() {
  const navigate      = useNavigate();
  const user          = getUser();
  const centreId      = user.centreId?._id || user.centreId || '';

  const [queue, setQueue]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [filter, setFilter]           = useState('all');
  const [tokenInput, setTokenInput]   = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError]   = useState('');
  const [actionLoading, setActionLoading] = useState(null); // bookingId being actioned
  const [actionError, setActionError]     = useState(null); // { id, msg }
  const scanRef   = useRef(null);
  const pollRef   = useRef(null);

  // ── Load queue ─────────────────────────────────────────────────────────
  const loadQueue = useCallback(() => {
    if (!centreId) return;
    // GET /queue/live/:centreId — public, no auth needed for read
    api.get(`/queue/live/${centreId}`)
      .then(({ data }) => {
        const entries = Array.isArray(data.data)
          ? data.data
          : (Array.isArray(data.data?.entries) ? data.data.entries : []);
        setQueue(entries);
        setLoadError('');
      })
      .catch((err) => {
        setLoadError(err.response?.data?.message || err.message || 'कतार लोड नहीं हो सकी।');
      })
      .finally(() => setLoading(false));
  }, [centreId]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  // ── Socket.IO + fallback (same pattern as LiveToken) ─────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(loadQueue, POLL_INTERVAL);
  }, [loadQueue]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

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
    socket.on('queue:update', (data) => {
      if (!data) return;
      // If the payload is a full queue array, replace directly
      if (Array.isArray(data)) { setQueue(data); return; }
      if (Array.isArray(data.entries)) { setQueue(data.entries); return; }
      // Otherwise patch the single booking that changed
      if (data.bookingId) {
        setQueue((prev) =>
          prev.map((b) =>
            (b._id === data.bookingId || b.id === data.bookingId)
              ? { ...b, ...data }
              : b
          )
        );
      }
    });

    return () => { stopPolling(); socket.disconnect(); };
  }, [centreId, startPolling, stopPolling]);

  // ── Token lookup ─────────────────────────────────────────────────────────
  const handleLookup = () => {
    const q = tokenInput.trim().toUpperCase();
    if (!q) return;
    setLookupError('');
    const found = queue.find(
      (b) => b.tokenNumber?.toUpperCase() === q ||
             b.tokenNumber?.toUpperCase().endsWith(`-${q}`)
    );
    if (found) { setLookupResult(found); setLookupError(''); }
    else { setLookupResult(null); setLookupError(`टोकन "${q}" कतार में नहीं मिला।`); }
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const doAction = async (bookingId, endpoint, errorLabel) => {
    setActionLoading(bookingId);
    setActionError(null);
    try {
      await api.post(`/queue/${bookingId}/${endpoint}`);
      // Optimistically update status
      const nextStatus = {
        'check-in':        'CHECKED_IN',
        'mark-eligible':   'ELIGIBLE_FOR_RELEASE',
        'release':         'RELEASED',
      }[endpoint];
      setQueue((prev) =>
        prev.map((b) => b._id === bookingId ? { ...b, status: nextStatus } : b)
      );
      if (lookupResult?._id === bookingId) {
        setLookupResult((prev) => prev ? { ...prev, status: nextStatus } : prev);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || `${errorLabel} विफल।`;
      setActionError({ id: bookingId, msg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckin     = (id) => doAction(id, 'check-in',      'चेक-इन');
  const handleMarkEligible= (id) => doAction(id, 'mark-eligible', 'Mark Eligible');
  const handleRelease     = (id) => doAction(id, 'release',       'Release');

  const visible = (filter === 'all'
    ? queue
    : queue.filter((b) => b.status === filter)
  ).sort((a, b) => {
    const aOverdue = a.gracePeriodEnd && new Date(a.gracePeriodEnd) < Date.now() && a.status === 'CONFIRMED' ? 1 : 0;
    const bOverdue = b.gracePeriodEnd && new Date(b.gracePeriodEnd) < Date.now() && b.status === 'CONFIRMED' ? 1 : 0;
    return bOverdue - aOverdue;
  });

  const counts = {
    total:    queue.length,
    booked:   queue.filter((b) => ['BOOKED','CONFIRMED'].includes(b.status)).length,
    checkedIn:queue.filter((b) => b.status === 'CHECKED_IN').length,
    eligible: queue.filter((b) => b.status === 'ELIGIBLE_FOR_RELEASE').length,
  };

  const handleLogout = () => {
    localStorage.removeItem('kq_token');
    localStorage.removeItem('kq_user');
    navigate('/staff-login', { replace: true });
  };

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-8 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="card p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-secondary uppercase tracking-wider mb-1">
                <span className="material-symbols-outlined text-base">lock</span>
                Staff Gate Terminal
              </div>
              <h1 className="text-lg font-bold text-on-surface">
                {typeof user.centreId === 'object' ? user.centreId?.name : 'मंडी'} — {user.role}
              </h1>
              <p className="text-xs text-on-surface-variant">{user.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full ${wsConnected ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container text-on-surface-variant'}`}>
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-secondary block' : 'bg-on-surface-variant block'}`} />
                {wsConnected ? 'Live' : 'Poll'}
              </div>
              <button onClick={handleLogout} className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-1 rounded-xl">
                <span className="material-symbols-outlined text-base align-middle">logout</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              ['कुल', counts.total, 'confirmation_number'],
              ['प्रतीक्षा', counts.booked, 'hourglass_empty'],
              ['चेक-इन', counts.checkedIn, 'check_circle'],
              ['रिलीज़ योग्य', counts.eligible, 'timer_off'],
            ].map(([label, val, icon]) => (
              <div key={label} className="bg-surface-container-low rounded-lg p-2 text-center">
                <span className="material-symbols-outlined text-lg text-primary block">{icon}</span>
                <span className="block text-xs text-on-surface-variant">{label}</span>
                <span className="block text-xl font-bold text-on-surface">{val}</span>
              </div>
            ))}
          </div>
        </header>

        {!centreId && (
          <div className="error-banner" role="alert">
            <span className="material-symbols-outlined text-lg">error</span>
            आपके खाते में centreId नहीं है। कृपया व्यवस्थापक से संपर्क करें।
          </div>
        )}

        {loadError && (
          <div className="error-banner" role="alert">
            <span className="material-symbols-outlined text-lg">error</span>
            {loadError}
          </div>
        )}

        {/* Token lookup */}
        <div className="bg-primary-fixed rounded-xl p-4">
          <h2 className="text-base font-bold text-on-primary-fixed mb-2">टोकन देखें / Token Lookup</h2>
          <div className="flex gap-2">
            <input
              ref={scanRef}
              id="guard-token-input"
              className="flex-1 h-12 px-3 rounded-xl bg-surface-container-lowest text-on-surface text-sm font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder='Token ID (e.g. KQ-108 या "108")'
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            />
            <button
              id="guard-lookup-btn"
              onClick={handleLookup}
              className="h-12 px-4 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform"
            >
              खोजें
            </button>
          </div>
          {lookupError && <p className="mt-2 text-sm text-error bg-error-container/80 px-3 py-1.5 rounded-lg">{lookupError}</p>}
        </div>

        {/* Looked up token result */}
        {lookupResult && (
          <div className="ring-2 ring-primary rounded-xl">
            <div className="bg-gradient-to-r from-primary to-primary-container px-4 py-2 rounded-t-xl">
              <span className="text-on-primary/70 text-xs font-extrabold uppercase">स्कैन किया गया</span>
              <span className="text-on-primary text-lg font-bold ml-2">{lookupResult.tokenNumber}</span>
            </div>
            <BookingCard
              entry={lookupResult}
              onCheckin={handleCheckin}
              onMarkEligible={handleMarkEligible}
              onRelease={handleRelease}
              actionLoading={actionLoading}
              actionError={actionError}
            />
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            ['all', 'सभी'],
            ['BOOKED', 'बुक हुए'],
            ['CONFIRMED', 'पुष्टि'],
            ['CHECKED_IN', 'चेक-इन'],
            ['ELIGIBLE_FOR_RELEASE', 'रिलीज़ योग्य'],
            ['RELEASED', 'रिलीज़'],
          ].map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-chip ${filter === f ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Queue list */}
        {loading && (
          <div className="flex items-center justify-center h-24 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin mr-2">autorenew</span>
            कतार लोड हो रही है...
          </div>
        )}
        {!loading && visible.length === 0 && !loadError && (
          <div className="card p-6 flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">queue</span>
            <p className="text-sm text-on-surface-variant">इस फ़िल्टर में कोई एंट्री नहीं।</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {visible.map((entry) => (
            <BookingCard
              key={entry._id || entry.tokenNumber}
              entry={entry}
              onCheckin={handleCheckin}
              onMarkEligible={handleMarkEligible}
              onRelease={handleRelease}
              actionLoading={actionLoading}
              actionError={actionError}
            />
          ))}
        </div>

        {/* Staff nav */}
        <nav className="flex gap-2 mt-2">
          {user.role === 'operator' || user.role === 'staff' || user.role === 'supervisor' ? (
            <>
              <button onClick={() => navigate('/weighmaster-desk')} className="flex-1 h-12 bg-surface-container-lowest rounded-xl text-sm font-bold flex items-center justify-center gap-1 shadow-sm">
                <span className="material-symbols-outlined text-base">scale</span>तौल डेस्क
              </button>
              {user.role === 'supervisor' && (
                <button onClick={() => navigate('/supervisor-exceptions')} className="flex-1 h-12 bg-surface-container-lowest rounded-xl text-sm font-bold flex items-center justify-center gap-1 shadow-sm">
                  <span className="material-symbols-outlined text-base">report</span>अपवाद
                </button>
              )}
            </>
          ) : null}
          {['district_admin','auditor'].includes(user.role) && (
            <button onClick={() => navigate('/admin-dashboard')} className="flex-1 h-12 bg-surface-container-lowest rounded-xl text-sm font-bold flex items-center justify-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-base">dashboard</span>Admin
            </button>
          )}
        </nav>
      </div>
    </main>
  );
}
