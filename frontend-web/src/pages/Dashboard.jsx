import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STATUS_META = {
  BOOKED:                   { label: 'बुक हुआ',           cls: 'bg-surface-container text-on-surface-variant' },
  CONFIRMED:                { label: 'पुष्टि हुई',         cls: 'bg-primary-fixed text-on-primary-fixed' },
  CHECKED_IN:               { label: 'चेक-इन',            cls: 'bg-secondary-fixed text-on-secondary-fixed' },
  INSPECTED:                { label: 'निरीक्षण हुआ',       cls: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  WEIGHED_READY_FOR_AUCTION:{ label: 'Weighed — Ready',   cls: 'bg-primary text-on-primary' },
  ELIGIBLE_FOR_RELEASE:     { label: 'रिलीज़ योग्य',       cls: 'bg-tertiary-container text-on-tertiary-container' },
  RELEASED:                 { label: 'रिलीज़ हुआ',         cls: 'bg-surface-container-high text-on-surface' },
  CANCELLED:                { label: 'रद्द',               cls: 'bg-error-container text-on-error-container' },
  COMPLETED:                { label: 'पूर्ण',              cls: 'bg-secondary-container text-on-secondary-container' },
};

function formatWindow(start, end) {
  const opts = { hour: '2-digit', minute: '2-digit', hour12: true };
  const s = start ? new Date(start).toLocaleTimeString('en-IN', opts) : '—';
  const e = end   ? new Date(end).toLocaleTimeString('en-IN', opts)   : '—';
  return `${s} – ${e}`;
}

export default function Dashboard() {
  const navigate          = useNavigate();
  const [bookings, setBookings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [cancelId, setCancelId]   = useState(null);
  const [cancelErr, setCancelErr] = useState('');

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('kq_user') || '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    // GET /bookings/my
    api.get('/bookings/my')
      .then(({ data }) => {
        setBookings(Array.isArray(data.data) ? data.data : []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || 'बुकिंग लोड करने में समस्या हुई।');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async (id) => {
    setCancelErr('');
    setCancelId(id);
    try {
      // POST /bookings/:id/cancel
      await api.post(`/bookings/${id}/cancel`, { reason: 'Farmer initiated cancellation' });
      setBookings((prev) =>
        prev.map((b) => b._id === id ? { ...b, status: 'CANCELLED' } : b)
      );
    } catch (err) {
      setCancelErr(err.response?.data?.message || err.message || 'रद्द करने में समस्या हुई।');
    } finally {
      setCancelId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kq_token');
    localStorage.removeItem('kq_user');
    navigate('/', { replace: true });
  };

  const active   = bookings.filter((b) => !['CANCELLED','COMPLETED','RELEASED'].includes(b.status));
  const archived = bookings.filter((b) =>  ['CANCELLED','COMPLETED','RELEASED'].includes(b.status));

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-28 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="flex items-center justify-between py-1">
          <div>
            <p className="text-xs text-on-surface-variant">नमस्ते 🌾</p>
            <h1 className="text-xl font-black text-on-surface">{user.name || 'किसान'}</h1>
          </div>
          <button
            id="dashboard-logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-on-surface-variant font-bold bg-surface-container px-3 py-1.5 rounded-xl"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            लॉगआउट
          </button>
        </header>

        {/* New booking CTA */}
        <button
          id="dashboard-new-booking-btn"
          onClick={() => navigate('/mandi-selection')}
          className="btn-primary"
        >
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
          <div className="text-left">
            <span className="block font-black">नई बुकिंग करें</span>
            <span className="block text-xs opacity-80">मंडी चुनें और स्लॉट बुक करें</span>
          </div>
        </button>

        {cancelErr && (
          <div className="error-banner" role="alert">
            <span className="material-symbols-outlined text-lg">error</span>
            {cancelErr}
          </div>
        )}

        {/* Active bookings */}
        <section>
          <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-2">
            सक्रिय बुकिंग / Active Bookings
          </p>
          {loading && (
            <div className="flex items-center justify-center h-24 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin mr-2">autorenew</span>
              लोड हो रहा है...
            </div>
          )}
          {!loading && error && (
            <div className="error-banner" role="alert">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}
          {!loading && !error && active.length === 0 && (
            <div className="card p-6 flex flex-col items-center gap-2 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">inbox</span>
              <p className="text-sm text-on-surface-variant">कोई सक्रिय बुकिंग नहीं है।</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {active.map((b) => {
              const meta = STATUS_META[b.status] || STATUS_META.BOOKED;
              const cancellable = ['BOOKED','CONFIRMED'].includes(b.status);
              return (
                <div key={b._id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-on-surface-variant">टोकन</p>
                      <p className="text-lg font-black text-primary">{b.tokenNumber}</p>
                    </div>
                    <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['उपज / Crop', b.crop],
                      ['मात्रा / Qty', b.quantityBand],
                      ['आगमन विंडो', formatWindow(b.arrivalWindowStart, b.arrivalWindowEnd)],
                      ['चैनल', b.channel],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-surface-container-low rounded-xl p-2.5">
                        <span className="block text-xs text-on-surface-variant">{k}</span>
                        <span className="block text-sm font-bold text-on-surface">{v || '—'}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      id={`view-token-btn-${b._id}`}
                      onClick={() => navigate('/live-token', { state: { booking: b } })}
                      className="flex-1 h-11 bg-primary text-on-primary rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">confirmation_number</span>
                      टोकन देखें
                    </button>
                    {cancellable && (
                      <button
                        id={`cancel-booking-btn-${b._id}`}
                        onClick={() => handleCancel(b._id)}
                        disabled={cancelId === b._id}
                        className="flex-1 h-11 bg-error-container text-on-error-container rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        {cancelId === b._id
                          ? <span className="material-symbols-outlined animate-spin text-base">autorenew</span>
                          : <><span className="material-symbols-outlined text-base">cancel</span>रद्द करें</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Archived */}
        {archived.length > 0 && (
          <section>
            <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-2">
              पुरानी बुकिंग / History
            </p>
            <div className="flex flex-col gap-2">
              {archived.map((b) => {
                const meta = STATUS_META[b.status] || STATUS_META.CANCELLED;
                return (
                  <div key={b._id} className="bg-surface-container-low rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-on-surface">{b.tokenNumber}</p>
                      <p className="text-xs text-on-surface-variant">{b.crop} · {b.quantityBand}</p>
                    </div>
                    <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-container-lowest shadow-xl px-4 py-2 flex items-center justify-around z-50 rounded-t-2xl">
        {[
          ['dashboard', 'डैशबोर्ड', '/dashboard', true],
          ['storefront', 'मंडी', '/mandi-selection', false],
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
