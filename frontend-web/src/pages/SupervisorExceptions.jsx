import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

/**
 * SupervisorExceptions
 *
 * There is NO global "list all exceptions" endpoint in the backend.
 * (GET /exceptions/booking/:bookingId requires a specific bookingId;
 *  there is no GET /exceptions route.)
 *
 * This page is a LOOKUP page: supervisor enters a bookingId (or token to
 * resolve to bookingId), then sees exceptions for that specific booking.
 *
 * If a global feed is needed for production, a new backend route is required.
 */

const EXCEPTION_TYPES = [
  { value: 'quality_dispute',   label: 'गुणवत्ता विवाद / Quality Dispute' },
  { value: 'partial_accept',    label: 'आंशिक स्वीकृति / Partial Accept' },
  { value: 'rejected',          label: 'अस्वीकृत / Rejected' },
  { value: 'document_mismatch', label: 'दस्तावेज़ मेल नहीं / Document Mismatch' },
];

function ExceptionCard({ ex, onOverride, overrideLoading }) {
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [outcome, setOutcome]               = useState('');
  const [err, setErr]                       = useState('');

  const handleSubmit = async () => {
    setErr('');
    if (!overrideReason.trim()) { setErr('Override reason आवश्यक है।'); return; }
    await onOverride(ex._id, { overrideReason: overrideReason.trim(), outcome: outcome.trim() });
    setShowOverride(false);
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-on-surface-variant">Exception ID</p>
          <p className="text-sm font-bold text-on-surface font-mono">{ex._id}</p>
        </div>
        <span className={`status-pill ${ex.supervisorOverride ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-error-container text-on-error-container'}`}>
          {ex.supervisorOverride ? 'Override लागू' : 'Pending'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ['प्रकार / Type', EXCEPTION_TYPES.find((t) => t.value === ex.type)?.label || ex.type],
          ['Reason Code',  ex.reasonCode],
          ['उठाया गया',    ex.raisedBy?.name || ex.raisedBy || '—'],
          ['Outcome',      ex.outcome || '—'],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface-container-low rounded-xl p-2.5">
            <span className="block text-xs text-on-surface-variant">{k}</span>
            <span className="block text-sm font-bold text-on-surface leading-snug">{v}</span>
          </div>
        ))}
      </div>

      {ex.overrideReason && (
        <div className="bg-primary-fixed text-on-primary-fixed rounded-xl px-3 py-2 text-xs">
          <span className="font-extrabold block">Override Reason</span>
          {ex.overrideReason}
        </div>
      )}

      {!ex.supervisorOverride && (
        <>
          {!showOverride ? (
            <button
              id={`override-open-btn-${ex._id}`}
              onClick={() => setShowOverride(true)}
              className="w-full h-11 bg-tertiary-container text-on-tertiary-container rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">gavel</span>
              Supervisor Override लगाएं
            </button>
          ) : (
            <div className="space-y-3 border-t border-outline-variant/30 pt-3">
              <p className="text-xs font-extrabold text-on-surface-variant uppercase">Override Details</p>
              <input
                type="text"
                className="input-field"
                placeholder="Override Reason (आवश्यक)"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
              <input
                type="text"
                className="input-field"
                placeholder="Outcome (वैकल्पिक)"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
              {err && (
                <div className="error-banner text-xs" role="alert">
                  <span className="material-symbols-outlined text-base">error</span>
                  {err}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  id={`override-submit-btn-${ex._id}`}
                  onClick={handleSubmit}
                  disabled={overrideLoading === ex._id}
                  className="flex-1 h-11 bg-primary text-on-primary rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {overrideLoading === ex._id
                    ? <span className="material-symbols-outlined animate-spin">autorenew</span>
                    : 'लागू करें'
                  }
                </button>
                <button onClick={() => setShowOverride(false)} className="flex-1 h-11 bg-surface-container text-on-surface rounded-xl text-sm font-bold">
                  रद्द करें
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SupervisorExceptions() {
  const navigate = useNavigate();

  // Lookup state
  const [bookingId, setBookingId]   = useState('');
  const [exceptions, setExceptions] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError]     = useState('');
  const [looked, setLooked]               = useState(false);

  // Raise new exception
  const [showRaise, setShowRaise]   = useState(false);
  const [exType, setExType]         = useState('quality_dispute');
  const [reasonCode, setReasonCode] = useState('');
  const [raiseLoading, setRaiseLoading] = useState(false);
  const [raiseError, setRaiseError]     = useState('');
  const [raiseSuccess, setRaiseSuccess] = useState(false);

  // Override
  const [overrideLoading, setOverrideLoading] = useState(null);
  const [overrideError, setOverrideError]     = useState('');

  const handleLookup = async () => {
    setLookupError('');
    setExceptions([]);
    setLooked(false);
    if (!bookingId.trim()) { setLookupError('Booking ID दर्ज करें।'); return; }
    setLookupLoading(true);
    try {
      // GET /exceptions/booking/:bookingId
      const { data } = await api.get(`/exceptions/booking/${bookingId.trim()}`);
      setExceptions(Array.isArray(data.data) ? data.data : []);
      setLooked(true);
    } catch (err) {
      setLookupError(err.response?.data?.message || err.message || 'अपवाद लोड नहीं हो सके।');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleRaise = async (e) => {
    e.preventDefault();
    setRaiseError('');
    setRaiseSuccess(false);
    if (!bookingId.trim()) { setRaiseError('Booking ID आवश्यक है।'); return; }
    if (!reasonCode.trim()) { setRaiseError('Reason Code आवश्यक है।'); return; }
    setRaiseLoading(true);
    try {
      // POST /exceptions
      const { data } = await api.post('/exceptions', {
        bookingId: bookingId.trim(),
        type:      exType,
        reasonCode: reasonCode.trim(),
      });
      const newEx = data.data || data;
      setExceptions((prev) => [...prev, newEx]);
      setRaiseSuccess(true);
      setReasonCode('');
      setShowRaise(false);
    } catch (err) {
      setRaiseError(err.response?.data?.message || err.message || 'अपवाद दर्ज नहीं हो सका।');
    } finally {
      setRaiseLoading(false);
    }
  };

  const handleOverride = async (exId, { overrideReason, outcome }) => {
    setOverrideError('');
    setOverrideLoading(exId);
    try {
      // POST /exceptions/:id/override
      const { data } = await api.post(`/exceptions/${exId}/override`, { overrideReason, outcome });
      const updated = data.data || data;
      setExceptions((prev) => prev.map((e) => e._id === exId ? updated : e));
    } catch (err) {
      setOverrideError(err.response?.data?.message || err.message || 'Override लागू नहीं हो सका।');
    } finally {
      setOverrideLoading(null);
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-8 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="flex items-center gap-2 py-1">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-on-surface">अपवाद प्रबंधन</h1>
            <p className="text-xs text-on-surface-variant">Supervisor Exceptions — Lookup by Booking ID</p>
          </div>
        </header>

        {/* No global feed note */}
        <div className="bg-tertiary-fixed text-on-tertiary-fixed rounded-xl px-4 py-3 text-xs font-bold flex items-start gap-2">
          <span className="material-symbols-outlined text-base mt-0.5">info</span>
          <span>
            Booking ID दर्ज करें और उस बुकिंग के सभी अपवाद देखें।
            (कोई global list endpoint नहीं है — यह lookup-based है।)
          </span>
        </div>

        {/* Lookup */}
        <div className="flex gap-2">
          <input
            id="ex-booking-id-input"
            type="text"
            className="input-field flex-1"
            placeholder="Booking ID दर्ज करें"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
          <button
            id="ex-lookup-btn"
            onClick={handleLookup}
            disabled={lookupLoading}
            className="h-14 px-4 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-sm active:scale-95 disabled:opacity-60"
          >
            {lookupLoading
              ? <span className="material-symbols-outlined animate-spin">autorenew</span>
              : 'खोजें'
            }
          </button>
        </div>

        {lookupError && (
          <div className="error-banner" role="alert">
            <span className="material-symbols-outlined text-lg">error</span>
            {lookupError}
          </div>
        )}

        {overrideError && (
          <div className="error-banner" role="alert">
            <span className="material-symbols-outlined text-lg">error</span>
            {overrideError}
          </div>
        )}

        {raiseSuccess && (
          <div className="bg-secondary-fixed text-on-secondary-fixed rounded-xl px-4 py-3 text-sm font-bold flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            अपवाद सफलतापूर्वक दर्ज हुआ।
          </div>
        )}

        {/* Exceptions list */}
        {looked && exceptions.length === 0 && !lookupError && (
          <div className="card p-6 flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">verified</span>
            <p className="text-sm text-on-surface-variant">इस बुकिंग के लिए कोई अपवाद नहीं मिला।</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {exceptions.map((ex) => (
            <ExceptionCard
              key={ex._id}
              ex={ex}
              onOverride={handleOverride}
              overrideLoading={overrideLoading}
            />
          ))}
        </div>

        {/* Raise exception */}
        {looked && (
          <>
            {!showRaise ? (
              <button
                id="raise-exception-btn"
                onClick={() => setShowRaise(true)}
                className="btn-primary bg-error"
              >
                <span className="material-symbols-outlined">report</span>
                नया अपवाद दर्ज करें
              </button>
            ) : (
              <form onSubmit={handleRaise} className="card p-4 space-y-3">
                <p className="text-sm font-extrabold text-on-surface">नया अपवाद दर्ज करें</p>

                <div>
                  <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    अपवाद प्रकार / Exception Type
                  </label>
                  <div className="flex flex-col gap-2">
                    {EXCEPTION_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setExType(t.value)}
                        className={`py-2.5 px-3 rounded-xl text-sm font-bold text-left ${exType === t.value ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Reason Code
                  </label>
                  <input
                    id="ex-reason-code"
                    type="text"
                    className="input-field"
                    placeholder="कारण संक्षेप में"
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                  />
                </div>

                {raiseError && (
                  <div className="error-banner text-xs" role="alert">
                    <span className="material-symbols-outlined text-base">error</span>
                    {raiseError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    id="raise-submit-btn"
                    type="submit"
                    disabled={raiseLoading}
                    className="flex-1 h-11 bg-error text-on-error rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {raiseLoading
                      ? <span className="material-symbols-outlined animate-spin">autorenew</span>
                      : 'दर्ज करें'
                    }
                  </button>
                  <button type="button" onClick={() => setShowRaise(false)} className="flex-1 h-11 bg-surface-container text-on-surface rounded-xl text-sm font-bold">
                    रद्द करें
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
