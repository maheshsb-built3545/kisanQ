import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { exceptionsApi } from '../api/exceptions.api';
import { auditApi } from '../api/audit.api';
import StaffHeader from '../components/navigation/StaffHeader';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Filter,
  PlusCircle,
  FileText,
  User,
  History,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Input from '../components/common/Input';
import Spinner from '../components/common/Spinner';

export default function SupervisorExceptions() {
  const { user } = useAuth();

  const [exceptions, setExceptions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | PENDING | RESOLVED
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState(null);

  // Override Modal state
  const [selectedExceptionForOverride, setSelectedExceptionForOverride] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideOutcome, setOverrideOutcome] = useState('Admitted with 1.5% moisture deduction');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  // Raise Exception Modal state
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [raiseBookingId, setRaiseBookingId] = useState('65f1a2b3c4d5e6f7a8b9c0e3');
  const [raiseType, setRaiseType] = useState('quality_dispute');
  const [raiseReasonCode, setRaiseReasonCode] = useState('High moisture level above standard band');
  const [isRaising, setIsRaising] = useState(false);

  const fetchExceptionsAndAudit = async () => {
    try {
      setIsLoading(true);

      // Fetch exceptions
      const query =
        statusFilter === 'PENDING'
          ? { status: 'pending_review' }
          : statusFilter === 'RESOLVED'
          ? { status: 'resolved' }
          : {};

      const exRes = await exceptionsApi.getAllExceptions(query);
      const exList = Array.isArray(exRes.data) ? exRes.data : (Array.isArray(exRes) ? exRes : []);

      if (exList.length > 0) {
        setExceptions(exList);
      } else {
        // Mock fallback if DB empty
        setExceptions([
          {
            _id: '65f1a2b3c4d5e6f7a8b9c0f1',
            bookingId: {
              _id: '65f1a2b3c4d5e6f7a8b9c0e3',
              tokenNumber: 'TKN-LAS-1023',
              crop: 'Red Onion',
              status: 'CHECKED_IN',
            },
            type: 'quality_dispute',
            reasonCode: 'Moisture 14.5% exceeds APMC tolerance limit of 12.0%',
            raisedBy: { name: 'Operator Ramesh', role: 'operator' },
            supervisorOverride: false,
            overrideReason: null,
            outcome: null,
            createdAt: '2026-09-10T05:30:00.000Z',
          },
          {
            _id: '65f1a2b3c4d5e6f7a8b9c0f2',
            bookingId: {
              _id: '65f1a2b3c4d5e6f7a8b9c0e4',
              tokenNumber: 'TKN-LAS-1024',
              crop: 'Maize',
              status: 'CHECKED_IN',
            },
            type: 'document_mismatch',
            reasonCode: 'Vehicle registration plate does not match token reservation form',
            raisedBy: { name: 'Gate Operator Patil', role: 'operator' },
            supervisorOverride: true,
            overrideReason: 'Farmer provided valid RC book and Aadhaar identification on-site',
            outcome: 'Identity verified and approved for physical intake',
            createdAt: '2026-09-10T04:15:00.000Z',
          },
        ]);
      }

      // Fetch audit logs
      try {
        const auditRes = await auditApi.getAuditLogs();
        const logs = Array.isArray(auditRes.data) ? auditRes.data : (Array.isArray(auditRes) ? auditRes : []);
        setAuditLogs(logs);
      } catch (e) {
        setAuditLogs([
          {
            action: 'OVERRIDE_APPLIED',
            actorRole: 'supervisor',
            reason: 'Farmer provided valid RC book on-site',
            timestamp: new Date().toISOString(),
          },
          {
            action: 'CHECK_IN',
            actorRole: 'operator',
            reason: 'Farmer arrived and checked in at the centre',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.warn('[SupervisorDesk] Notice:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptionsAndAudit();
  }, [statusFilter]);

  // Handle Supervisor Override Application
  const handleApplyOverride = async (e) => {
    e.preventDefault();
    if (!selectedExceptionForOverride || !overrideReason.trim()) {
      alert('Override reason is mandatory for supervisor audits.');
      return;
    }

    try {
      setIsSubmittingOverride(true);
      await exceptionsApi.supervisorOverride(selectedExceptionForOverride._id, {
        overrideReason: overrideReason.trim(),
        outcome: overrideOutcome,
      });

      // Update local state
      setExceptions((prev) =>
        prev.map((ex) =>
          ex._id === selectedExceptionForOverride._id
            ? {
                ...ex,
                supervisorOverride: true,
                overrideReason: overrideReason.trim(),
                outcome: overrideOutcome,
              }
            : ex
        )
      );

      setActionNotice({
        type: 'success',
        message: `Supervisor override applied for dispute on ${
          selectedExceptionForOverride.bookingId?.tokenNumber || 'token'
        }. Logged to immutable audit trail.`,
      });
      setSelectedExceptionForOverride(null);
      setOverrideReason('');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Override failed');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Handle Raising an Exception
  const handleRaiseException = async (e) => {
    e.preventDefault();
    try {
      setIsRaising(true);
      await exceptionsApi.raiseException({
        bookingId: raiseBookingId,
        type: raiseType,
        reasonCode: raiseReasonCode,
        raisedBy: user?.id || '65f1a2b3c4d5e6f7a8b9c0d1',
      });

      setActionNotice({
        type: 'success',
        message: 'New exception logged and routed to Supervisor review lane.',
      });
      setShowRaiseModal(false);
      fetchExceptionsAndAudit();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to raise exception');
    } finally {
      setIsRaising(false);
    }
  };

  const pendingCount = exceptions.filter((ex) => !ex.supervisorOverride).length;
  const resolvedCount = exceptions.filter((ex) => ex.supervisorOverride).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <StaffHeader activeDesk="supervisor" currentCentreName="Lasalgaon APMC Hub" />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Banner Alert Notice */}
        {actionNotice && (
          <div
            className={`mb-6 p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm animate-fade-in ${
              actionNotice.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">{actionNotice.message}</span>
            </div>
            <button onClick={() => setActionNotice(null)} className="text-xs opacity-70 hover:opacity-100">
              Dismiss
            </button>
          </div>
        )}

        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Supervisor Dispute & Exception Desk</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-semibold">
                Authority Desk
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Review quality rejections, vehicle identity discrepancies, and apply audited executive overrides.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowRaiseModal(true)}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Raise Exception</span>
            </button>

            <button
              type="button"
              onClick={fetchExceptionsAndAudit}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
              title="Refresh exceptions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="glass-card p-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Disputes ({exceptions.length})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pending Review ({pendingCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('RESOLVED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === 'RESOLVED'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Overridden / Resolved ({resolvedCount})
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono hidden sm:block">
            Logged Supervisor: <strong className="text-slate-300">{user?.name || 'Supervisor Patil'}</strong>
          </div>
        </div>

        {/* Exceptions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-4">
            {isLoading ? (
              <div className="py-16 text-center glass-card">
                <Spinner size="lg" color="emerald" />
                <p className="text-xs text-slate-400 mt-3">Loading dispute logs...</p>
              </div>
            ) : exceptions.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-300">No active exceptions found</h3>
                <p className="text-xs text-slate-500 mt-1">All mandi yard operations running normally.</p>
              </div>
            ) : (
              exceptions.map((ex) => {
                const isOverridden = ex.supervisorOverride;
                const token = ex.bookingId?.tokenNumber || 'TKN-000';
                const crop = ex.bookingId?.crop || 'Commodity';

                return (
                  <div
                    key={ex._id}
                    className={`glass-card p-5 border transition-all ${
                      isOverridden ? 'border-purple-500/30 bg-purple-950/10' : 'border-amber-500/40 bg-amber-950/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-white text-base text-emerald-400">{token}</span>
                        <span className="text-xs font-semibold text-slate-300">({crop})</span>
                        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-amber-400">
                          {ex.type.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                            isOverridden
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                          }`}
                        >
                          {isOverridden ? '✓ Overridden' : 'Pending Supervisor Action'}
                        </span>
                      </div>
                    </div>

                    <div className="py-3">
                      <div className="text-xs text-slate-400 mb-1">Reason Code / Observation:</div>
                      <p className="text-sm font-semibold text-slate-200 bg-slate-950/70 p-3 rounded-xl border border-slate-800 font-mono">
                        {ex.reasonCode}
                      </p>
                    </div>

                    {isOverridden ? (
                      <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs space-y-1 mt-1">
                        <div className="font-bold text-purple-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-purple-400" />
                          <span>Executive Override Decision:</span>
                        </div>
                        <div className="text-slate-300 font-medium">
                          <strong>Reason:</strong> {ex.overrideReason}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          <strong>Outcome:</strong> {ex.outcome || 'Approved under supervisor authority'}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-2">
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          <span>Raised by: {ex.raisedBy?.name || 'Gate Staff'}</span>
                        </div>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setSelectedExceptionForOverride(ex)}
                          className="bg-amber-600 hover:bg-amber-500 shadow-amber-950/50"
                        >
                          Apply Supervisor Override
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Audit Trail Feed */}
          <div className="lg:col-span-1 glass-card p-5">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Immutable Audit Trail</span>
            </h2>

            <div className="space-y-3 text-xs">
              {auditLogs.slice(0, 5).map((log, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-400 text-[11px]">{log.action}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{log.actorRole}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] line-clamp-2">{log.reason || 'Action recorded'}</p>
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                    {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Supervisor Override Modal */}
      {selectedExceptionForOverride && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full p-6 border-amber-500/40 text-left">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Supervisor Dispute Override</h3>
            <p className="text-xs text-slate-400 mb-4">
              Applying an override for Token{' '}
              <strong className="text-emerald-400 font-mono">
                {selectedExceptionForOverride.bookingId?.tokenNumber || 'TKN-000'}
              </strong>{' '}
              will unblock intake into the weighbridge lane and log your credentials to the district audit ledger.
            </p>

            <form onSubmit={handleApplyOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Supervisor Override Rationale <span className="text-amber-400">* (Mandatory)</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why this dispute is being overridden (e.g. farmer provided secondary lab test, minor moisture deviation within acceptable APMC tolerance band)..."
                  className="glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Designated Settlement Outcome
                </label>
                <select
                  value={overrideOutcome}
                  onChange={(e) => setOverrideOutcome(e.target.value)}
                  className="glass-input text-xs bg-slate-900"
                >
                  <option value="Admitted with 1.5% moisture deduction">
                    Admitted with 1.5% moisture deduction
                  </option>
                  <option value="Re-graded to Grade B FAQ">Re-graded to Grade B FAQ</option>
                  <option value="Document mismatch resolved on-site via Aadhaar/RC">
                    Document mismatch resolved on-site via Aadhaar/RC
                  </option>
                  <option value="Special district procurement intake sanction">
                    Special district procurement intake sanction
                  </option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedExceptionForOverride(null)}
                  className="flex-1 btn-secondary py-2.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride || !overrideReason.trim()}
                  className="flex-1 btn-primary bg-amber-600 hover:bg-amber-500 py-2.5 text-xs font-bold"
                >
                  {isSubmittingOverride ? 'Submitting Override...' : 'Confirm Executive Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raise Exception Modal */}
      {showRaiseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 border-slate-800 text-left">
            <h3 className="text-base font-bold text-white mb-1">Raise Operational Exception</h3>
            <p className="text-xs text-slate-400 mb-4">
              Flag a booking for dispute resolution or quality hold.
            </p>

            <form onSubmit={handleRaiseException} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Booking ID</label>
                <input
                  type="text"
                  required
                  value={raiseBookingId}
                  onChange={(e) => setRaiseBookingId(e.target.value)}
                  className="glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Exception Category</label>
                <select
                  value={raiseType}
                  onChange={(e) => setRaiseType(e.target.value)}
                  className="glass-input text-xs bg-slate-900"
                >
                  <option value="quality_dispute">Quality Dispute (Moisture / Spoilage)</option>
                  <option value="document_mismatch">Document / Vehicle Mismatch</option>
                  <option value="partial_accept">Partial Acceptance</option>
                  <option value="rejected">Complete Rejection</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Reason Code Description</label>
                <input
                  type="text"
                  required
                  value={raiseReasonCode}
                  onChange={(e) => setRaiseReasonCode(e.target.value)}
                  className="glass-input text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  className="flex-1 btn-secondary py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRaising}
                  className="flex-1 btn-primary py-2 text-xs"
                >
                  {isRaising ? 'Logging...' : 'Log Exception'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
