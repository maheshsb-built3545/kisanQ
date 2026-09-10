import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STATUS_COLOR = {
  Green: 'bg-secondary-fixed text-on-secondary-fixed',
  Amber: 'bg-tertiary-fixed text-on-tertiary-fixed',
  Red:   'bg-error-container text-on-error-container',
};

export default function MandiSelection() {
  const navigate = useNavigate();
  const [centres, setCentres]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [cropFilter, setCropFilter] = useState('all');

  useEffect(() => {
    // GET /centres
    api.get('/centres')
      .then(({ data }) => {
        setCentres(Array.isArray(data.data) ? data.data : []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || 'मंडी सूची लोड नहीं हो सकी।');
      })
      .finally(() => setLoading(false));
  }, []);

  const allCrops = [...new Set(centres.flatMap((c) => c.cropsHandled || []))].sort();

  const visible = cropFilter === 'all'
    ? centres
    : centres.filter((c) => c.cropsHandled?.includes(cropFilter));

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-8 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="flex items-center gap-2 py-1">
          <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-on-surface">मंडी चुनें</h1>
            <p className="text-xs text-on-surface-variant">अपने नजदीकी उपज केंद्र को चुनें</p>
          </div>
        </header>

        {/* Crop filter chips */}
        {allCrops.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCropFilter('all')}
              className={`filter-chip ${cropFilter === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}
            >
              सभी
            </button>
            {allCrops.map((crop) => (
              <button
                key={crop}
                onClick={() => setCropFilter(crop)}
                className={`filter-chip ${cropFilter === crop ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}
              >
                {crop}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-32 text-on-surface-variant">
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

        {!loading && !error && visible.length === 0 && (
          <div className="card p-6 flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">store_mall_directory</span>
            <p className="text-sm text-on-surface-variant">कोई मंडी उपलब्ध नहीं है।</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {visible.map((centre) => {
            const statusCls = STATUS_COLOR[centre.currentStatus] || STATUS_COLOR.Green;
            return (
              <button
                key={centre._id}
                id={`centre-card-${centre._id}`}
                onClick={() => navigate('/book-slot', { state: { centre } })}
                className="card p-4 text-left space-y-3 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-black text-on-surface">{centre.name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {centre.workingHours?.start || '08:00'} – {centre.workingHours?.end || '18:00'}
                    </p>
                  </div>
                  <span className={`status-pill ${statusCls}`}>
                    {centre.currentStatus || 'Green'}
                  </span>
                </div>

                {/* Crops handled */}
                <div className="flex flex-wrap gap-1.5">
                  {(centre.cropsHandled || []).map((crop) => (
                    <span key={crop} className="px-2.5 py-1 bg-surface-container-low text-on-surface text-xs font-bold rounded-lg">
                      {crop}
                    </span>
                  ))}
                </div>

                {/* Capacity summary */}
                {centre.capacityConfig?.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-base">directions_car</span>
                    <span>
                      {centre.capacityConfig[0].lanes} lanes ·{' '}
                      {centre.capacityConfig[0].maxDailySlots} slots/day ·{' '}
                      {centre.capacityConfig[0].durationMinutes}min windows
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
