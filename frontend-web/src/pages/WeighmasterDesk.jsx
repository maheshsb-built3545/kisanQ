import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

/**
 * WeighmasterDesk
 *
 * Both POST /procurement/inspection and POST /procurement/weight write DIRECTLY to
 * the Booking document (confirmed in procurementService.js). Neither touches
 * ProcurementRecord.stages[].
 *
 * Inspection payload: { bookingId, grade, moisturePercentage, inspectorNotes }
 *   → sets Booking.status = 'INSPECTED'
 *
 * Weight payload: { bookingId, grossWeight, tareWeight, netWeight, weighbridgeId }
 *   → netWeight = gross - tare (calculated client-side, sent explicitly)
 *   → sets Booking.status = 'WEIGHED_READY_FOR_AUCTION' (displayed as "Weighed — Ready")
 *
 * SECURITY FLAG: These routes have no auth middleware on the backend.
 * The frontend calls them as-is today; this is a backend issue to fix separately.
 */

const GRADES = ['Grade A', 'Grade B', 'Grade C'];

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function WeighmasterDesk() {
  const navigate = useNavigate();
  const [tab, setTab]       = useState('inspection'); // 'inspection' | 'weight'

  // Shared
  const [bookingId, setBookingId] = useState('');

  // Inspection form
  const [grade, setGrade]               = useState('Grade A');
  const [moisture, setMoisture]         = useState('');
  const [inspectorNotes, setNotes]      = useState('');
  const [inspResult, setInspResult]     = useState(null);
  const [inspLoading, setInspLoading]   = useState(false);
  const [inspError, setInspError]       = useState('');

  // Weight form
  const [grossWeight, setGross]         = useState('');
  const [tareWeight, setTare]           = useState('');
  const [weighbridgeId, setWbId]        = useState('');
  const [wtResult, setWtResult]         = useState(null);
  const [wtLoading, setWtLoading]       = useState(false);
  const [wtError, setWtError]           = useState('');

  const handleInspection = async (e) => {
    e.preventDefault();
    setInspError('');
    setInspResult(null);
    if (!bookingId.trim()) { setInspError('Booking ID आवश्यक है।'); return; }
    setInspLoading(true);
    try {
      // POST /procurement/inspection — writes to Booking directly
      const { data } = await api.post('/procurement/inspection', {
        bookingId:          bookingId.trim(),
        grade,
        moisturePercentage: moisture ? Number(moisture) : undefined,
        inspectorNotes:     inspectorNotes.trim() || undefined,
      });
      setInspResult(data.data || data);
    } catch (err) {
      setInspError(err.response?.data?.message || err.message || 'निरीक्षण रिकॉर्ड नहीं हो सका।');
    } finally {
      setInspLoading(false);
    }
  };

  const handleWeight = async (e) => {
    e.preventDefault();
    setWtError('');
    setWtResult(null);
    if (!bookingId.trim()) { setWtError('Booking ID आवश्यक है।'); return; }
    const gross = Number(grossWeight);
    const tare  = Number(tareWeight);
    if (!gross || gross <= 0) { setWtError('सकल भार (gross) सही दर्ज करें।'); return; }
    if (tare < 0)              { setWtError('पेकेजिंग भार (tare) ऋणात्मक नहीं हो सकता।'); return; }
    const net = gross - tare;
    setWtLoading(true);
    try {
      // POST /procurement/weight — writes to Booking directly
      const { data } = await api.post('/procurement/weight', {
        bookingId:    bookingId.trim(),
        grossWeight:  gross,
        tareWeight:   tare,
        netWeight:    net,
        weighbridgeId:weighbridgeId.trim() || undefined,
      });
      setWtResult(data.data || data);
    } catch (err) {
      setWtError(err.response?.data?.message || err.message || 'भार रिकॉर्ड नहीं हो सका।');
    } finally {
      setWtLoading(false);
    }
  };

  const ResultCard = ({ result, statusLabel }) => (
    <div className="bg-secondary-fixed text-on-secondary-fixed rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 font-extrabold text-sm">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        सफलतापूर्वक दर्ज — {statusLabel}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mt-1">
        <div><span className="block opacity-70">Token</span><span className="font-bold">{result.tokenNumber}</span></div>
        <div><span className="block opacity-70">Status</span><span className="font-bold">{result.status}</span></div>
        {result.grade && <div><span className="block opacity-70">Grade</span><span className="font-bold">{result.grade}</span></div>}
        {result.grossWeight != null && <div><span className="block opacity-70">Gross</span><span className="font-bold">{result.grossWeight} Q</span></div>}
        {result.netWeight != null && <div><span className="block opacity-70">Net</span><span className="font-bold">{result.netWeight} Q</span></div>}
      </div>
    </div>
  );

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-8 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="flex items-center gap-2 py-1">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-on-surface">तौल डेस्क</h1>
            <p className="text-xs text-on-surface-variant">Weighmaster Desk — Inspection & Weighbridge</p>
          </div>
        </header>

        {/* Booking ID (shared between tabs) */}
        <Field label="Booking ID">
          <input
            id="wm-booking-id"
            type="text"
            className="input-field"
            placeholder="MongoDB Booking _id या Token Number"
            value={bookingId}
            onChange={(e) => { setBookingId(e.target.value); setInspResult(null); setWtResult(null); }}
          />
        </Field>

        {/* Tabs */}
        <div className="flex gap-2">
          {[['inspection', 'निरीक्षण', 'search'], ['weight', 'तौल', 'scale']].map(([t, label, icon]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors
                ${tab === t ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-lowest text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-base">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ── INSPECTION TAB ── */}
        {tab === 'inspection' && (
          <form onSubmit={handleInspection} className="flex flex-col gap-4">
            <Field label="ग्रेड / Grade">
              <div className="grid grid-cols-3 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={`py-3 rounded-xl text-sm font-bold ${grade === g ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="नमी % / Moisture Percentage">
              <input
                id="wm-moisture"
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="input-field"
                placeholder="जैसे 12.5"
                value={moisture}
                onChange={(e) => setMoisture(e.target.value)}
              />
            </Field>

            <Field label="निरीक्षक नोट / Inspector Notes">
              <textarea
                id="wm-notes"
                className="input-field h-24 py-3 resize-none"
                placeholder="गुणवत्ता टिप्पणी..."
                value={inspectorNotes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            {inspError && (
              <div className="error-banner" role="alert">
                <span className="material-symbols-outlined text-lg">error</span>
                {inspError}
              </div>
            )}

            {inspResult && <ResultCard result={inspResult} statusLabel="INSPECTED" />}

            <button
              id="wm-inspection-submit"
              type="submit"
              disabled={inspLoading}
              className="btn-primary disabled:opacity-60"
            >
              {inspLoading
                ? <><span className="material-symbols-outlined animate-spin">autorenew</span><span>दर्ज हो रहा है...</span></>
                : <><span className="material-symbols-outlined">search</span><span>निरीक्षण दर्ज करें</span></>
              }
            </button>
          </form>
        )}

        {/* ── WEIGHT TAB ── */}
        {tab === 'weight' && (
          <form onSubmit={handleWeight} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="सकल भार / Gross (Qtl)">
                <input
                  id="wm-gross"
                  type="number"
                  step="0.5"
                  min="0"
                  className="input-field"
                  placeholder="जैसे 50"
                  value={grossWeight}
                  onChange={(e) => setGross(e.target.value)}
                />
              </Field>

              <Field label="पेकेजिंग / Tare (Qtl)">
                <input
                  id="wm-tare"
                  type="number"
                  step="0.5"
                  min="0"
                  className="input-field"
                  placeholder="जैसे 2.5"
                  value={tareWeight}
                  onChange={(e) => setTare(e.target.value)}
                />
              </Field>
            </div>

            {/* Net weight preview */}
            {grossWeight && tareWeight !== '' && (
              <div className="bg-primary-fixed text-on-primary-fixed rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-bold">शुद्ध भार / Net Weight</span>
                <span className="text-xl font-black">
                  {Math.max(0, Number(grossWeight) - Number(tareWeight)).toFixed(2)} Qtl
                </span>
              </div>
            )}

            <Field label="वेब्रिज ID / Weighbridge ID">
              <input
                id="wm-wb-id"
                type="text"
                className="input-field"
                placeholder="जैसे WB-01"
                value={weighbridgeId}
                onChange={(e) => setWbId(e.target.value)}
              />
            </Field>

            {wtError && (
              <div className="error-banner" role="alert">
                <span className="material-symbols-outlined text-lg">error</span>
                {wtError}
              </div>
            )}

            {wtResult && <ResultCard result={wtResult} statusLabel="Weighed — Ready" />}

            <button
              id="wm-weight-submit"
              type="submit"
              disabled={wtLoading}
              className="btn-primary disabled:opacity-60"
            >
              {wtLoading
                ? <><span className="material-symbols-outlined animate-spin">autorenew</span><span>दर्ज हो रहा है...</span></>
                : <><span className="material-symbols-outlined">scale</span><span>भार दर्ज करें</span></>
              }
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
