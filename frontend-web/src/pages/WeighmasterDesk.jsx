import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const DEFAULT_CENTRE_ID = '65f1a2b3c4d5e6f7a8b9c0d1';

const MOCK_QUEUE = [
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d1',
    tokenNumber: 'KQ-108',
    farmerName: 'रामचंद्र पाटील',
    crop: 'Red Onion',
    quantityBand: '15q+',
    declaredQty: '50 क्विंटल',
    vehicleNo: 'MH 15 AB 4521',
    lane: 'Lane B - Weighbridge 3',
    status: 'CHECKED_IN'
  },
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d2',
    tokenNumber: 'KQ-107',
    farmerName: 'सुरेश जाधव',
    crop: 'Yellow Maize',
    quantityBand: '15q+',
    declaredQty: '55 क्विंटल',
    vehicleNo: 'MH 15 GH 9012',
    lane: 'Lane A - Weighbridge 1',
    status: 'INSPECTED',
    grade: 'Grade A',
    moisturePercentage: 11.5
  }
];

export default function WeighmasterDesk() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState(MOCK_QUEUE);
  const [selectedBooking, setSelectedBooking] = useState(MOCK_QUEUE[0]);
  
  // Inspection Form State
  const [grade, setGrade] = useState('Grade A');
  const [moisturePercentage, setMoisturePercentage] = useState(11.5);
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [inspectLoading, setInspectLoading] = useState(false);

  // Weighing Form State
  const [grossWeight, setGrossWeight] = useState(62.5);
  const [tareWeight, setTareWeight] = useState(12.5);
  const [weighbridgeId, setWeighbridgeId] = useState('WB-03');
  const [weightLoading, setWeightLoading] = useState(false);

  // Feedback Messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const netWeight = Math.max(0, Number(grossWeight || 0) - Number(tareWeight || 0));

  // 1. Fetch Queue & Socket.IO Auto-Refresh
  const fetchQueue = async () => {
    try {
      const { data } = await api.get(`/queue/live/${DEFAULT_CENTRE_ID}`);
      let list = [];
      if (Array.isArray(data?.data?.entries)) {
        list = data.data.entries;
      } else if (Array.isArray(data?.data)) {
        list = data.data;
      }
      
      if (list.length > 0) {
        // Filter list for vehicles needing inspection or weighing
        const activeProcurementQueue = list.filter((b) =>
          ['CHECKED_IN', 'INSPECTED'].includes(b.status)
        );
        if (activeProcurementQueue.length > 0) {
          setQueue(activeProcurementQueue);
          if (!selectedBooking || !activeProcurementQueue.find((b) => b._id === selectedBooking._id)) {
            setSelectedBooking(activeProcurementQueue[0]);
          }
        }
      }
    } catch (err) {
      console.warn('Queue fetch notice (demo fallback active):', err?.message);
    }
  };

  useEffect(() => {
    fetchQueue();

    const socket = io(API_BASE, { auth: { token: localStorage.getItem('kq_token') } });
    socket.on('connect', () => {
      socket.emit('join_centre_queue', DEFAULT_CENTRE_ID);
    });

    socket.on('queue:update', () => {
      fetchQueue();
    });

    return () => socket.disconnect();
  }, []);

  // 2. Submit Quality Inspection Form (POST /api/procurement/inspection)
  const handleInspectionSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedBooking) return;

    setInspectLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await api.post('/procurement/inspection', {
        bookingId: selectedBooking._id,
        grade,
        moisturePercentage: Number(moisturePercentage),
        inspectorNotes: inspectorNotes || 'Quality verified at inspection desk'
      });

      const updated = res.data?.data;
      setSuccessMsg(`निरीक्षण सफल! ${updated?.tokenNumber || selectedBooking.tokenNumber} -> Status: INSPECTED (${grade})`);
      
      // Update local state queue vehicle status to INSPECTED
      setQueue((prev) =>
        prev.map((b) =>
          b._id === selectedBooking._id
            ? { ...b, status: 'INSPECTED', grade, moisturePercentage }
            : b
        )
      );
      setSelectedBooking((prev) => ({ ...prev, status: 'INSPECTED', grade, moisturePercentage }));
      setInspectorNotes('');
    } catch (err) {
      console.warn('Inspection submit notice (demo fallback):', err?.response?.data?.message || err?.message);
      setSuccessMsg(`[Demo Mode] गुणवत्ता परीक्षण दर्ज! (${grade}, Moisture: ${moisturePercentage}%)`);
      setQueue((prev) =>
        prev.map((b) =>
          b._id === selectedBooking._id
            ? { ...b, status: 'INSPECTED', grade, moisturePercentage }
            : b
        )
      );
      setSelectedBooking((prev) => ({ ...prev, status: 'INSPECTED', grade, moisturePercentage }));
    } finally {
      setInspectLoading(false);
    }
  };

  // 3. Submit Weight Recording Form (POST /api/procurement/weight)
  const handleWeightSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedBooking) return;

    setWeightLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await api.post('/procurement/weight', {
        bookingId: selectedBooking._id,
        grossWeight: Number(grossWeight),
        tareWeight: Number(tareWeight),
        netWeight,
        weighbridgeId
      });

      const updated = res.data?.data;
      setSuccessMsg(`तौल दर्ज सफल! Net Weight: ${netWeight.toFixed(2)} क्विंटल (${selectedBooking.tokenNumber})`);
      
      // Clear vehicle from active weighbridge queue upon successful weight completion
      setQueue((prev) => prev.filter((b) => b._id !== selectedBooking._id));
      const remaining = queue.filter((b) => b._id !== selectedBooking._id);
      if (remaining.length > 0) {
        setSelectedBooking(remaining[0]);
      }
    } catch (err) {
      console.warn('Weight submit notice (demo fallback):', err?.response?.data?.message || err?.message);
      setSuccessMsg(`[Demo Mode] तौल रिकॉर्ड सम्पन्न! Net Weight: ${netWeight.toFixed(2)} क्विंटल`);
      setQueue((prev) => prev.filter((b) => b._id !== selectedBooking._id));
      const remaining = queue.filter((b) => b._id !== selectedBooking._id);
      if (remaining.length > 0) {
        setSelectedBooking(remaining[0]);
      }
    } finally {
      setWeightLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface font-jakarta text-on-surface p-4 md:p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* Header Bar */}
        <header className="bg-primary rounded-2xl p-5 shadow-md text-on-primary flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-widest text-on-primary/70 block">
                ⚖️ Mandi Procurement Terminal
              </span>
              <span className="px-2 py-0.5 rounded bg-on-primary/20 text-[10px] font-bold">
                SIH26032 Live Scale
              </span>
            </div>
            <h1 className="text-2xl font-black mt-1">तौलिया डेस्क / Weighmaster & Quality Terminal</h1>
            <p className="text-xs text-on-primary/80">Digital Quality Inspection, Moisture Testing & Gross/Tare Scale Operator</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-extrabold flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
              Scale Active
            </span>
            <button
              onClick={() => navigate('/staff-login')}
              className="px-4 py-2 bg-on-primary/10 hover:bg-on-primary/20 text-on-primary text-xs font-bold rounded-xl active:scale-95 transition-all"
            >
              लॉगआउट
            </button>
          </div>
        </header>

        {/* Alert Feedback */}
        {successMsg && (
          <div className="p-4 bg-secondary-fixed text-on-secondary-fixed rounded-2xl text-sm font-bold shadow-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">verified</span>
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-error-container text-on-error-container rounded-2xl text-sm font-bold shadow-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Grid Layout: Active Vehicles (Left) vs Forms (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Active Vehicle Queue */}
          <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 space-y-4 border border-outline-variant/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-extrabold text-on-surface-variant uppercase tracking-wider">
                  वजन एवं गुणवत्ता कतार / Scale Queue
                </h2>
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface text-xs font-bold">
                  {queue.length} Vehicles
                </span>
              </div>

              {queue.length === 0 ? (
                <div className="p-8 text-center bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant">check_circle</span>
                  <p className="text-sm font-bold text-on-surface mt-2">कतार खाली है / Queue Clear</p>
                  <p className="text-xs text-on-surface-variant">No vehicles waiting for inspection or weighing</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {queue.map((b) => {
                    const isSelected = selectedBooking?._id === b._id;
                    const isInspected = b.status === 'INSPECTED';

                    return (
                      <button
                        key={b._id}
                        onClick={() => {
                          setSelectedBooking(b);
                          setSuccessMsg('');
                          setErrorMsg('');
                        }}
                        className={`w-full p-4 rounded-xl text-left border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-primary bg-primary-fixed shadow-sm'
                            : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface-container'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-primary">{b.tokenNumber}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                isInspected
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isInspected ? 'INSPECTED' : 'CHECKED-IN'}
                            </span>
                          </div>
                          <span className="block text-sm font-bold text-on-surface mt-0.5">{b.farmerName || 'रामचंद्र पाटील'}</span>
                          <span className="block text-xs text-on-surface-variant">
                            {b.crop || 'Crop'} • {b.quantityBand || b.declaredQty || '15q+'}
                          </span>
                        </div>

                        <span className="material-symbols-outlined text-on-surface-variant">
                          {isSelected ? 'task_alt' : 'chevron_right'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedBooking && (
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/20 space-y-1.5 text-xs">
                <span className="font-extrabold text-on-surface-variant block uppercase">चयनित वाहन विवरण / Active Truck</span>
                <div className="flex justify-between font-bold text-on-surface">
                  <span>टोकन / Token:</span>
                  <span className="text-primary">{selectedBooking.tokenNumber}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>वाहन / Vehicle:</span>
                  <span>{selectedBooking.vehicleNo || 'MH 15 AB 4521'}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>स्कैल लेन / Lane:</span>
                  <span>{selectedBooking.lane || 'Lane B - Weighbridge 3'}</span>
                </div>
              </div>
            )}
          </section>

          {/* Right Column: Dynamic Form Panels (Inspection vs Weight) */}
          <div className="lg:col-span-2 space-y-6">

            {/* FORM 1: Quality Inspection Form (Required when status is CHECKED_IN) */}
            <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 space-y-5 border border-outline-variant/20">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                <div>
                  <span className="text-xs font-extrabold text-primary uppercase tracking-wider block">
                    चरण 1 / Step 1
                  </span>
                  <h2 className="text-lg font-bold text-on-surface">गुणवत्ता परीक्षण / Quality Inspection Form</h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-surface-container-high text-xs font-extrabold text-on-surface">
                  Status: {selectedBooking?.status || 'CHECKED_IN'}
                </span>
              </div>

              <form onSubmit={handleInspectionSubmit} className="space-y-4">

                {/* Grade Selector */}
                <div>
                  <label className="block text-xs font-extrabold text-on-surface-variant uppercase mb-2">
                    फसल गुणवत्ता ग्रेड / Crop Quality Grade
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['Grade A', 'Grade B', 'Grade C', 'Rejected'].map((g) => (
                      <button
                        type="button"
                        key={g}
                        onClick={() => setGrade(g)}
                        className={`py-3 px-3 rounded-xl text-xs font-black border transition-all ${
                          grade === g
                            ? g === 'Rejected'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                              : 'bg-primary text-on-primary border-primary shadow-sm'
                            : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Moisture Percentage */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      नमी का प्रतिशत / Moisture Percentage (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={moisturePercentage}
                        onChange={(e) => setMoisturePercentage(e.target.value)}
                        className="w-full h-12 px-3 bg-surface-container-low rounded-xl text-base font-extrabold text-on-surface outline-none border border-outline-variant/30"
                        placeholder="11.5"
                      />
                      <span className="absolute right-3 top-3 text-xs font-bold text-on-surface-variant">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      निरीक्षक टिप्पणी / Inspector Notes
                    </label>
                    <input
                      type="text"
                      value={inspectorNotes}
                      onChange={(e) => setInspectorNotes(e.target.value)}
                      className="w-full h-12 px-3 bg-surface-container-low rounded-xl text-sm font-bold text-on-surface outline-none border border-outline-variant/30"
                      placeholder="Passed quality grade verification"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={inspectLoading || !selectedBooking}
                  className="w-full h-13 bg-primary text-on-primary font-extrabold rounded-xl text-sm shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {inspectLoading ? (
                    <span className="material-symbols-outlined animate-spin text-lg">autorenew</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">verified</span>
                      <span>निरीक्षण दर्ज करें / Submit Inspection</span>
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* FORM 2: Weighbridge Weight Recording (Active when status is INSPECTED) */}
            <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 space-y-5 border border-outline-variant/20">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                <div>
                  <span className="text-xs font-extrabold text-secondary uppercase tracking-wider block">
                    चरण 2 / Step 2
                  </span>
                  <h2 className="text-lg font-bold text-on-surface">वेब्रिज भार दर्ज / Weighbridge Scale Recording</h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-extrabold">
                  {weighbridgeId}
                </span>
              </div>

              <form onSubmit={handleWeightSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Gross Weight */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      कुल भार / Gross Weight (Qtl)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={grossWeight}
                      onChange={(e) => setGrossWeight(e.target.value)}
                      className="w-full h-14 px-3 bg-surface-container-low rounded-xl text-xl font-black text-on-surface outline-none border border-outline-variant/30"
                      placeholder="62.5"
                    />
                  </div>

                  {/* Tare Weight */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      खाली वाहन भार / Tare Weight (Qtl)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tareWeight}
                      onChange={(e) => setTareWeight(e.target.value)}
                      className="w-full h-14 px-3 bg-surface-container-low rounded-xl text-xl font-black text-on-surface outline-none border border-outline-variant/30"
                      placeholder="12.5"
                    />
                  </div>
                </div>

                {/* Net Weight Display */}
                <div className="bg-primary-fixed rounded-2xl p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-xs font-extrabold text-on-primary-fixed-variant uppercase block">
                      शुद्ध वजन / Calculated Net Weight
                    </span>
                    <span className="text-3xl font-black text-on-primary-fixed">
                      {netWeight.toFixed(2)} क्विंटल (Qtl)
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-4xl text-primary">scale</span>
                </div>

                <button
                  type="submit"
                  disabled={weightLoading || !selectedBooking}
                  className="w-full h-14 bg-secondary text-on-secondary font-extrabold rounded-xl text-base shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {weightLoading ? (
                    <span className="material-symbols-outlined animate-spin text-lg">autorenew</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">print</span>
                      <span>तौल दर्ज करें व रसीद प्रिंट करें / Record Weight</span>
                    </>
                  )}
                </button>
              </form>
            </section>

          </div>

        </div>

      </div>
    </main>
  );
}
