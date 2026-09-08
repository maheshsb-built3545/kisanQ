import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const MOCK_EXCEPTIONS = [
  {
    _id: 'exc-001', booking: { tokenNumber: 'KQ-108', farmer: 'रामचंद्र पाटील' }, type: 'quality_dispute',
    severity: 'high', description: 'Farmer disputes Grade C classification for 12 quintals – claims improper sampling.',
    status: 'pending_review', createdAt: new Date(Date.now() - 5 * 60 * 1000), centre: 'लासलगांव APMC',
  },
  {
    _id: 'exc-002', booking: { tokenNumber: 'KQ-095', farmer: 'विजय निंबकर' }, type: 'grace_expired',
    severity: 'medium', description: 'Grace period of 30 min elapsed – farmer not arrived.',
    status: 'pending_review', createdAt: new Date(Date.now() - 23 * 60 * 1000), centre: 'लासलगांव APMC',
  },
  {
    _id: 'exc-003', booking: { tokenNumber: 'KQ-072', farmer: 'सुनीता देशमुख' }, type: 'weighing_discrepancy',
    severity: 'low', description: 'Digital vs Physical weighing variance > 2%.',
    status: 'resolved', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), centre: 'निफाड उप-मंडी',
    resolution: 'Re-weighed and corrected. Accepted.',
  },
];

const SEV_CFG = {
  high:   { cls: 'bg-error-container text-on-error-container', icon: 'error',   label: 'High' },
  medium: { cls: 'bg-tertiary-fixed text-on-tertiary-fixed',   icon: 'warning', label: 'Medium' },
  low:    { cls: 'bg-surface-container text-on-surface',       icon: 'info',    label: 'Low' },
};

const TYPE_LABELS = {
  quality_dispute: { icon: '🔬', label: 'गुणवत्ता विवाद / Quality Dispute' },
  grace_expired:   { icon: '⏰', label: 'ग्रेस पीरियड समाप्त / Grace Expired' },
  weighing_discrepancy: { icon: '⚖️', label: 'तौल विसंगति / Weighing Discrepancy' },
};

export default function SupervisorExceptions() {
  const navigate = useNavigate();
  const [exceptions, setExceptions] = useState(MOCK_EXCEPTIONS);
  const [statusFilter, setStatusFilter] = useState('all');
  const [resolveModal, setResolveModal] = useState(null);
  const [resolution, setResolution] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/exceptions').then(({ data }) => {
      if (data?.data?.length) setExceptions(data.data);
    }).catch(() => {});
  }, []);

  const handleResolve = async () => {
    if (!resolution.trim()) return;
    setSubmitting(true);
    try {
      await api.patch(`/exceptions/${resolveModal._id}/resolve`, { resolution });
    } catch {}
    setExceptions(prev => prev.map(e => e._id === resolveModal._id ? { ...e, status: 'resolved', resolution } : e));
    setSubmitting(false);
    setResolveModal(null);
    setResolution('');
  };

  const visible = statusFilter === 'all' ? exceptions : exceptions.filter(e => e.status === statusFilter);
  const pending = exceptions.filter(e => e.status === 'pending_review').length;
  const resolved = exceptions.filter(e => e.status === 'resolved').length;

  const fmtTime = (d) => {
    const mins = Math.floor((Date.now() - new Date(d)) / 60000);
    return mins < 60 ? `${mins} मिनट पहले` : `${Math.floor(mins / 60)} घंटे पहले`;
  };

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-4 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="bg-primary rounded-xl p-4 shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-on-primary/70 text-xs font-extrabold uppercase tracking-wider block">
                <span className="material-symbols-outlined text-base align-middle">admin_panel_settings</span> Supervisor Dashboard
              </span>
              <h1 className="text-xl font-bold text-on-primary">एक्सेप्शन प्रबंधन</h1>
              <p className="text-sm text-on-primary/80">Exception Management Console</p>
            </div>
            <div className="text-right">
              <span className="block text-on-primary text-2xl font-black">{pending}</span>
              <span className="block text-on-primary/70 text-xs">लंबित / Pending</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[['Total', exceptions.length, 'bg-on-primary/20'], ['Pending', pending, 'bg-error/20'], ['Resolved', resolved, 'bg-secondary-fixed/40']].map(([l, v, cls]) => (
              <div key={l} className={`${cls} rounded-lg p-2 text-center`}>
                <span className="block text-xl font-black text-on-primary">{v}</span>
                <span className="block text-xs text-on-primary/70">{l}</span>
              </div>
            ))}
          </div>
        </header>

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[['all', `सभी (${exceptions.length})`], ['pending_review', `लंबित (${pending})`], ['resolved', `हल (${resolved})`]].map(([f, label]) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`filter-chip ${statusFilter === f ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}
            >{label}</button>
          ))}
        </div>

        {/* Exception cards */}
        <div className="flex flex-col gap-4">
          {visible.map((ex) => {
            const sev = SEV_CFG[ex.severity] || SEV_CFG.low;
            const typ = TYPE_LABELS[ex.type] || { icon: '⚠️', label: ex.type };
            return (
              <div key={ex._id} className="bg-surface-container-lowest rounded-xl shadow-md overflow-hidden">
                <div className={`flex items-center justify-between px-4 py-2 ${sev.cls}`}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{sev.icon}</span>
                    <span className="text-xs font-extrabold uppercase">{sev.label} Priority</span>
                  </div>
                  {ex.status === 'pending_review'
                    ? <span className="text-xs font-extrabold bg-on-error/20 px-2 py-0.5 rounded-full animate-pulse">लंबित समीक्षा</span>
                    : <span className="text-xs font-extrabold">✅ हल</span>
                  }
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="block text-base font-bold text-on-surface">{typ.icon} {typ.label}</span>
                      <span className="block text-sm text-on-surface-variant">{ex.booking?.tokenNumber} • {ex.booking?.farmer}</span>
                      <span className="block text-xs text-on-surface-variant mt-0.5">{ex.centre} • {fmtTime(ex.createdAt)}</span>
                    </div>
                  </div>

                  <div className="bg-surface-container-low rounded-lg p-3">
                    <span className="block text-xs font-extrabold text-on-surface-variant uppercase mb-1">विवरण / Description</span>
                    <p className="text-sm text-on-surface leading-relaxed">{ex.description}</p>
                  </div>

                  {ex.resolution && (
                    <div className="bg-primary-fixed rounded-lg p-3">
                      <span className="block text-xs font-extrabold text-on-primary-fixed-variant uppercase mb-1">निर्णय / Resolution</span>
                      <p className="text-sm text-on-primary-fixed leading-relaxed">{ex.resolution}</p>
                    </div>
                  )}

                  {ex.status === 'pending_review' && (
                    <div className="flex gap-2">
                      <button onClick={() => { setResolveModal(ex); setResolution(''); }} className="flex-1 h-11 bg-primary text-on-primary rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                        <span className="material-symbols-outlined text-base">gavel</span>
                        निर्णय दें / Override
                      </button>
                      <button className="h-11 px-4 bg-surface-container-high rounded-xl text-on-surface text-sm font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base">call</span>
                        संपर्क
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Notification section */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-extrabold text-on-surface-variant uppercase mb-3">हाल की सूचनाएं / Recent Notifications</h2>
          <div className="space-y-2">
            {[
              { icon: 'sms', label: 'SMS Alert', body: 'KQ-108 को मंडी आगमन रिमाइंडर भेजा गया।', time: '08:30 AM', cls: 'text-secondary' },
              { icon: 'push_pin', label: 'Push Alert', body: 'KQ-095: ग्रेस पीरियड 5 मिनट में समाप्त।', time: '09:15 AM', cls: 'text-tertiary' },
              { icon: 'campaign', label: 'Announcement', body: 'Lane B Weighbridge W3 – KQ-107 Ready for Weighing.', time: '10:42 AM', cls: 'text-primary' },
            ].map((n) => (
              <div key={n.label} className="flex items-start gap-3 py-2 border-b border-outline-variant/20">
                <span className={`material-symbols-outlined text-xl ${n.cls}`}>{n.icon}</span>
                <div className="flex-1">
                  <span className="block text-xs font-extrabold text-on-surface-variant uppercase">{n.label}</span>
                  <span className="block text-sm text-on-surface">{n.body}</span>
                </div>
                <span className="text-xs text-on-surface-variant shrink-0">{n.time}</span>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Resolve modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-on-surface/60 z-50 flex items-end justify-center p-4" onClick={(e) => e.target === e.currentTarget && setResolveModal(null)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-on-surface">निर्णय दर्ज करें</h2>
            <p className="text-sm text-on-surface-variant">{resolveModal.booking?.tokenNumber} – {resolveModal.booking?.farmer}</p>
            <textarea
              className="w-full h-28 p-3 bg-surface-container-low rounded-xl text-sm text-on-surface resize-none focus:outline-none"
              placeholder="Supervisor override reasoning..."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setResolveModal(null)} className="flex-1 h-12 bg-surface-container rounded-xl text-on-surface text-sm font-bold">रद्द</button>
              <button onClick={handleResolve} disabled={submitting} className="flex-1 h-12 bg-primary text-on-primary rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                {submitting ? <span className="material-symbols-outlined animate-spin">autorenew</span> : <span className="material-symbols-outlined">gavel</span>}
                निर्णय पक्का करें
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
