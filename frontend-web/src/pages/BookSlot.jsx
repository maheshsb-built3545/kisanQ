import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

const QUANTITY_BANDS = ['0-5q', '5-15q', '15q+'];

function toISO(dateStr, timeStr) {
  // dateStr: 'YYYY-MM-DD', timeStr: 'HH:mm'
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

export default function BookSlot() {
  const navigate      = useNavigate();
  const { state }     = useLocation();
  const centre        = state?.centre;

  const [availability, setAvailability] = useState([]);
  const [avLoading, setAvLoading]       = useState(false);
  const [avError, setAvError]           = useState('');

  const [date, setDate]           = useState(() => new Date().toISOString().slice(0, 10));
  const [crop, setCrop]           = useState(centre?.cropsHandled?.[0] || '');
  const [qtyBand, setQtyBand]     = useState('0-5q');
  const [window_, setWindow]      = useState(null); // { start, end }
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Redirect if no centre in state
  useEffect(() => {
    if (!centre) navigate('/mandi-selection', { replace: true });
  }, [centre, navigate]);

  // GET /centres/:id/availability when date/crop changes
  useEffect(() => {
    if (!centre?._id || !date) return;
    setAvLoading(true);
    setAvError('');
    setWindow(null);
    api.get(`/centres/${centre._id}/availability`, { params: { date, crop } })
      .then(({ data }) => {
        const slots = Array.isArray(data.data) ? data.data : (Array.isArray(data.data?.slots) ? data.data.slots : []);
        setAvailability(slots);
      })
      .catch((err) => {
        setAvError(err.response?.data?.message || err.message || 'उपलब्धता लोड नहीं हो सकी।');
        setAvailability([]);
      })
      .finally(() => setAvLoading(false));
  }, [centre, date, crop]);

  const handleBook = async () => {
    setSubmitError('');
    if (!window_) { setSubmitError('कृपया एक आगमन विंडो चुनें।'); return; }
    if (!crop)    { setSubmitError('कृपया फसल चुनें।');            return; }
    setSubmitting(true);
    try {
      // POST /bookings with exact Booking schema fields
      const { data } = await api.post('/bookings', {
        centreId: centre._id,
        crop,
        quantityBand: qtyBand,
        arrivalWindowStart: window_.start,
        arrivalWindowEnd:   window_.end,
        channel: 'app',
      });
      const booking = data.data || data;
      navigate('/live-token', { state: { booking } });
    } catch (err) {
      setSubmitError(err.response?.data?.message || err.message || 'बुकिंग नहीं हो सकी। कृपया पुनः प्रयास करें।');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtTime = (iso) =>
    iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

  if (!centre) return null;

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-8 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="flex items-center gap-2 py-1">
          <button onClick={() => navigate('/mandi-selection')} className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-on-surface">स्लॉट बुक करें</h1>
            <p className="text-xs text-on-surface-variant">{centre.name}</p>
          </div>
        </header>

        {/* Date */}
        <div>
          <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
            तारीख / Date
          </label>
          <input
            id="book-date-input"
            type="date"
            className="input-field"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Crop */}
        <div>
          <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
            फसल / Crop
          </label>
          {centre.cropsHandled?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {centre.cropsHandled.map((c) => (
                <button
                  key={c}
                  onClick={() => setCrop(c)}
                  className={`filter-chip ${crop === c ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : (
            <input
              id="book-crop-input"
              type="text"
              className="input-field"
              placeholder="फसल का नाम"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
            />
          )}
        </div>

        {/* Quantity band */}
        <div>
          <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
            मात्रा / Quantity Band
          </label>
          <div className="grid grid-cols-3 gap-2">
            {QUANTITY_BANDS.map((b) => (
              <button
                key={b}
                onClick={() => setQtyBand(b)}
                className={`py-3 rounded-xl text-sm font-bold ${qtyBand === b ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface'}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Availability windows */}
        <div>
          <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
            आगमन विंडो / Arrival Window
          </label>
          {avLoading && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant py-4 justify-center">
              <span className="material-symbols-outlined animate-spin">autorenew</span>
              उपलब्धता देखी जा रही है...
            </div>
          )}
          {avError && (
            <div className="error-banner" role="alert">
              <span className="material-symbols-outlined text-lg">error</span>
              {avError}
            </div>
          )}
          {!avLoading && !avError && availability.length === 0 && (
            <div className="card p-4 text-center text-sm text-on-surface-variant">
              इस दिन कोई स्लॉट उपलब्ध नहीं है।
            </div>
          )}
          {!avLoading && availability.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {availability.map((slot, idx) => {
                const isSelected = window_?.start === slot.start;
                const isFull = slot.available === 0;
                return (
                  <button
                    key={idx}
                    disabled={isFull}
                    onClick={() => setWindow(slot)}
                    className={`py-3 px-3 rounded-xl text-sm font-bold text-left transition-all disabled:opacity-40
                      ${isSelected ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-low text-on-surface'}
                    `}
                  >
                    <span className="block">{fmtTime(slot.start)}</span>
                    <span className={`block text-xs mt-0.5 ${isSelected ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>
                      – {fmtTime(slot.end)}
                    </span>
                    {slot.available !== undefined && (
                      <span className={`block text-xs mt-1 font-extrabold ${isFull ? 'text-error' : isSelected ? 'text-on-primary/80' : 'text-secondary'}`}>
                        {isFull ? 'Full' : `${slot.available} उपलब्ध`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {submitError && (
          <div className="error-banner" role="alert">
            <span className="material-symbols-outlined text-lg">error</span>
            {submitError}
          </div>
        )}

        <button
          id="book-confirm-btn"
          onClick={handleBook}
          disabled={submitting || !window_}
          className="btn-primary disabled:opacity-60"
        >
          {submitting
            ? <><span className="material-symbols-outlined animate-spin">autorenew</span><span>बुकिंग हो रही है...</span></>
            : <><span className="material-symbols-outlined">confirmation_number</span><span>स्लॉट बुक करें</span></>
          }
        </button>
      </div>
    </main>
  );
}
