import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function getUser() {
  try { return JSON.parse(localStorage.getItem('kq_user') || '{}'); } catch { return {}; }
}

const STATUS_COLOR = {
  Red:   { dot: 'bg-error',     badge: 'bg-error-container text-on-error-container' },
  Amber: { dot: 'bg-tertiary',  badge: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  Green: { dot: 'bg-secondary', badge: 'bg-secondary-fixed text-on-secondary-fixed' },
};

const HEALTH_META = {
  OPTIMAL:           { cls: 'bg-secondary-fixed text-on-secondary-fixed', label: 'Optimal ✓' },
  HIGH_LOAD_ALERT:   { cls: 'bg-tertiary-fixed text-on-tertiary-fixed',   label: 'High Load ⚠' },
  CRITICAL_OVERLOAD: { cls: 'bg-error-container text-on-error-container', label: 'Critical ✕' },
};

function KpiCard({ icon, label, value, highlight }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl py-4 px-3 shadow-sm ${highlight ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest'}`}>
      <span className={`material-symbols-outlined text-2xl mb-1 ${highlight ? 'text-on-primary' : 'text-primary'}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <span className={`text-2xl font-black leading-none ${highlight ? 'text-on-primary' : 'text-on-surface'}`}>{value ?? '—'}</span>
      <span className={`text-[10px] font-extrabold uppercase tracking-wider text-center mt-1 ${highlight ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>{label}</span>
    </div>
  );
}

function CapacityBar({ active, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((active / total) * 100)) : 0;
  const barCls = pct >= 85 ? 'bg-error' : pct >= 65 ? 'bg-tertiary' : 'bg-secondary';
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs font-bold text-on-surface-variant mb-1">
        <span>Active: {active?.toLocaleString()}</span>
        <span>Capacity: {total?.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-xs font-extrabold text-on-surface-variant mt-0.5">{pct}% utilized</div>
    </div>
  );
}

function MandiCard({ mandi }) {
  const sc = STATUS_COLOR[mandi.currentStatus] || STATUS_COLOR.Green;
  const pct = mandi.utilizationPercent ?? 0;
  const barCls = pct >= 85 ? 'bg-error' : pct >= 65 ? 'bg-tertiary' : 'bg-secondary';
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot}`} />
            <p className="text-sm font-black text-on-surface leading-snug">{mandi.name}</p>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5 pl-[18px]">{mandi.locationName || mandi.code}</p>
        </div>
        <span className={`status-pill flex-shrink-0 ${sc.badge}`}>{mandi.currentStatus}</span>
      </div>

      {/* Utilisation bar */}
      <div>
        <div className="flex justify-between text-xs font-bold text-on-surface-variant mb-1">
          <span>Queue: {mandi.activeQueueCount}</span>
          <span>Cap: {mandi.totalCapacity}</span>
        </div>
        <div className="h-2 bg-surface-container rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-right text-[10px] font-extrabold text-on-surface-variant mt-0.5">{pct}% utilized</div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          ['Tokens Today', mandi.tokensIssuedToday],
          ['Lanes', mandi.activeLanes],
          ['Crops', (mandi.cropsHandled || []).length],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface-container-low rounded-lg p-1.5 text-center">
            <span className="block text-xs font-black text-on-surface">{v ?? '—'}</span>
            <span className="block text-[9px] text-on-surface-variant uppercase tracking-wide">{k}</span>
          </div>
        ))}
      </div>

      {/* Crops chips */}
      {mandi.cropsHandled?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mandi.cropsHandled.map((crop) => (
            <span key={crop} className="px-2 py-0.5 bg-surface-container text-on-surface text-[10px] font-bold rounded-md">
              {crop}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user     = getUser();
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    // GET /admin/dashboard-stats
    api.get('/admin/dashboard-stats')
      .then(({ data }) => setStats(data.data || data))
      .catch((err) => setError(err.response?.data?.message || err.message || 'डैशबोर्ड लोड नहीं हो सका।'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('kq_token');
    localStorage.removeItem('kq_user');
    navigate('/staff-login', { replace: true });
  };

  const kpis   = stats?.kpis           || {};
  const summary = stats?.districtSummary || {};
  const mandis  = stats?.mandis          || [];
  const health  = HEALTH_META[summary.overallHealth] || HEALTH_META.OPTIMAL;
  const ts = stats?.timestamp ? new Date(stats.timestamp).toLocaleString('en-IN', { hour12: true }) : null;

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-8 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* ── Header ── */}
        <header className="flex items-start justify-between py-1 gap-2">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-secondary uppercase tracking-wider">{user.role}</p>
            <h1 className="text-lg font-black text-on-surface leading-tight truncate">
              {stats?.districtName || 'Admin Dashboard'}
            </h1>
            {ts && <p className="text-[10px] text-on-surface-variant mt-0.5">Updated: {ts}</p>}
          </div>
          <button
            id="admin-logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs font-bold text-on-surface-variant bg-surface-container px-2.5 py-1.5 rounded-xl flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Logout
          </button>
        </header>

        {/* ── Quick links for supervisor role ── */}
        {['supervisor', 'operator', 'staff'].includes(user.role) && (
          <div className="flex gap-2">
            <button onClick={() => navigate('/guard-terminal')} className="flex-1 h-11 bg-surface-container-lowest rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm">
              <span className="material-symbols-outlined text-base">lock</span>Gate
            </button>
            {user.role === 'supervisor' && (
              <>
                <button onClick={() => navigate('/supervisor-exceptions')} className="flex-1 h-11 bg-surface-container-lowest rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm">
                  <span className="material-symbols-outlined text-base">report</span>Exceptions
                </button>
                <button onClick={() => navigate('/weighmaster-desk')} className="flex-1 h-11 bg-surface-container-lowest rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm">
                  <span className="material-symbols-outlined text-base">scale</span>Weighmaster
                </button>
              </>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-40 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-3xl mr-2">autorenew</span>
            Loading district stats...
          </div>
        )}

        {!loading && error && (
          <div className="error-banner" role="alert">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {!loading && stats && (
          <>
            {/* ── KPI Strip ── */}
            <section>
              <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-2">
                आज की KPIs / Today's KPIs
              </p>
              <div className="grid grid-cols-3 gap-2">
                <KpiCard icon="confirmation_number" label="Tokens Today"     value={kpis.totalTokensToday}  highlight />
                <KpiCard icon="directions_car"      label="Active Vehicles"  value={kpis.activeVehicles} />
                <KpiCard icon="gavel"               label="Overrides"        value={kpis.overridesTriggered} />
                <KpiCard icon="storefront"          label="Total Mandis"     value={kpis.totalMandis} />
                <KpiCard icon="warning"             label="Red Alert Mandis" value={kpis.redAlertMandis} highlight={kpis.redAlertMandis > 0} />
              </div>
            </section>

            {/* ── District Summary Banner ── */}
            <section className="card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-on-surface">District Health</p>
                <span className={`status-pill text-xs font-extrabold ${health.cls}`}>
                  {health.label}
                </span>
              </div>

              {/* Mandi status counters */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['🟢', 'Green', summary.greenCount, 'bg-secondary-fixed text-on-secondary-fixed'],
                  ['🟡', 'Amber', summary.amberCount, 'bg-tertiary-fixed text-on-tertiary-fixed'],
                  ['🔴', 'Red',   summary.redCount,   'bg-error-container text-on-error-container'],
                ].map(([emoji, label, count, cls]) => (
                  <div key={label} className={`rounded-xl px-3 py-2.5 text-center ${cls}`}>
                    <span className="block text-lg leading-none">{emoji}</span>
                    <span className="block text-xl font-black">{count ?? 0}</span>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider">{label}</span>
                  </div>
                ))}
              </div>

              {/* District-wide capacity bar */}
              <CapacityBar
                active={summary.activeQueueDistrict}
                total={summary.totalCapacityDistrict}
              />
            </section>

            {/* ── Mandi Cards ── */}
            {mandis.length > 0 && (
              <section>
                <p className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-2">
                  मंडी स्थिति / Centre Status ({mandis.length})
                </p>
                <div className="flex flex-col gap-3">
                  {mandis.map((m) => (
                    <MandiCard key={m._id} mandi={m} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
