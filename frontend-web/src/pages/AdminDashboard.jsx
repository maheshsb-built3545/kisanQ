import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StaffHeader from '../components/navigation/StaffHeader';
import {
  LayoutDashboard, Building2, Users, Truck, ShieldAlert,
  Printer, RefreshCw, Activity, CheckCircle2, AlertTriangle,
  TrendingUp, MapPin, Flame, ArrowUpRight, Zap, ShieldCheck,
  Scale, FileText, Banknote, Database, Radio, Sparkles,
  ChevronRight, ArrowRight, Gauge, Check, Clock, Filter,
  ScanLine
} from 'lucide-react';
import {
  getSocket, joinAdminRoom, onNewBooking, onStageUpdated,
  onHardwareEvent, subscribeConnectionStatus, triggerHardwareSimulation
} from '../services/socketService';
import { MANDIS, STAGE_DEFINITIONS } from '../services/storageService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const CROPS = ['Wheat', 'Soybean', 'Onion', 'Cotton'];

export default function AdminDashboard() {
  const { user } = useAuth();

  // State
  const [tokens, setTokens] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState('ALL');
  const [selectedMandiId, setSelectedMandiId] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [recentEventToast, setRecentEventToast] = useState(null);
  const [hardwareState, setHardwareState] = useState({
    boomBarrier: 'CLOSED',
    weighScale: '0.00 MT',
    lastEvent: null
  });

  // Fetch tokens from live MongoDB backend
  const fetchLiveTokens = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('kq_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/tokens/all`, {
        headers,
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tokens)) {
          setTokens(data.tokens);
        }
      }
    } catch (err) {
      console.warn('[AdminDashboard] Falling back to local storage tokens:', err.message);
      try {
        const local = JSON.parse(localStorage.getItem('kisanq_active_tokens') || '[]');
        setTokens(local);
      } catch {
        setTokens([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Socket.IO Setup & Event Listeners
  useEffect(() => {
    fetchLiveTokens();
    joinAdminRoom();

    const unsubConn = subscribeConnectionStatus((connected) => {
      setSocketConnected(connected);
    });

    // 1. Listen for new slot bookings
    const unsubBooking = onNewBooking((data) => {
      console.log('⚡ [Admin Dashboard] Live NEW_BOOKING received:', data);
      const newToken = data.token || data;
      setTokens((prev) => {
        const key = newToken.id || newToken.tokenNumber;
        const exists = prev.some((t) => (t.id || t.tokenNumber) === key);
        if (exists) return prev;
        return [newToken, ...prev];
      });

      // Toast notification
      setRecentEventToast({
        title: 'New Arrival Slot Booked',
        desc: `${newToken.farmerName || 'Farmer'} booked ${newToken.quantity || 10} Quintals ${newToken.crop} at ${newToken.mandiName || 'APMC Mandi'}`,
        badge: newToken.tokenNumber || newToken.id,
        type: 'booking'
      });
      setTimeout(() => setRecentEventToast(null), 5000);
    });

    // 2. Listen for checkpoint stage progress updates
    const unsubStage = onStageUpdated((data) => {
      console.log('⚡ [Admin Dashboard] Live STAGE_UPDATED received:', data);
      const updatedToken = data.token;
      const tokenNum = data.tokenNumber || updatedToken?.tokenNumber || updatedToken?.id;

      setTokens((prev) =>
        prev.map((t) => {
          if ((t.tokenNumber || t.id) === tokenNum) {
            return updatedToken || { ...t, currentStageIndex: data.stageIndex || t.currentStageIndex + 1, status: data.status || 'In-Progress' };
          }
          return t;
        })
      );

      setRecentEventToast({
        title: 'Checkpoint Signed Off',
        desc: `Token ${tokenNum} marked ${data.stageTitle || 'Checkpoint'} by ${data.officerName || 'Officer'}`,
        badge: data.stageTitle || 'Approved',
        type: 'stage'
      });
      setTimeout(() => setRecentEventToast(null), 4500);
    });

    // 3. Listen for hardware events
    const unsubHardware = onHardwareEvent((data) => {
      console.log('⚡ [Admin Dashboard] Live HARDWARE_EVENT:', data);
      if (data.device === 'BOOM_BARRIER') {
        setHardwareState((prev) => ({ ...prev, boomBarrier: data.action, lastEvent: data }));
      } else if (data.device === 'LOAD_CELL') {
        setHardwareState((prev) => ({ ...prev, weighScale: data.value, lastEvent: data }));
      }
    });

    return () => {
      unsubConn();
      unsubBooking();
      unsubStage();
      unsubHardware();
    };
  }, [fetchLiveTokens]);

  // Handle Admin Quick Stage Action (Gate / QA / Scale / Procurement / Payout)
  const handleAdminAdvanceStage = async (token, stageDef, targetIndex) => {
    const tokenNumber = token.tokenNumber || token.id;
    setActionLoadingId(`${tokenNumber}-${stageDef.id}`);

    const now = new Date().toISOString();
    const sigId = `${stageDef.officerCode}-${Date.now().toString(36).toUpperCase()}`;
    const extras = {};
    if (stageDef.id === 'QUALITY_GRADING') extras.grade = 'Grade A (Moisture 11.2%)';
    if (stageDef.id === 'WEIGHBRIDGE') extras.weight = (token.quantity * 0.96).toFixed(2);

    try {
      const tokenAuth = localStorage.getItem('kq_token');
      const headers = { 'Content-Type': 'application/json' };
      if (tokenAuth) headers['Authorization'] = `Bearer ${tokenAuth}`;

      const res = await fetch(`${API_BASE}/tokens/${encodeURIComponent(tokenNumber)}/stage-progress`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          stageId: stageDef.id,
          stageIndex: targetIndex,
          officerName: stageDef.officer,
          officerSigId: sigId,
          status: 'Completed',
          ...extras
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setTokens((prev) =>
            prev.map((t) => ((t.tokenNumber || t.id) === tokenNumber ? data.token : t))
          );
        }
      }
    } catch (err) {
      console.error('Failed to advance stage from Admin:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Hardware Simulation Controls
  const toggleBoomBarrier = async () => {
    const nextAction = hardwareState.boomBarrier === 'OPEN' ? 'CLOSED' : 'OPEN';
    setHardwareState((prev) => ({ ...prev, boomBarrier: nextAction }));
    await triggerHardwareSimulation({
      mandiId: 'KPG-01',
      device: 'BOOM_BARRIER',
      action: nextAction
    });
  };

  const simulateScaleReading = async () => {
    const randWeight = (Math.random() * 8 + 15).toFixed(2) + ' MT';
    setHardwareState((prev) => ({ ...prev, weighScale: randWeight }));
    await triggerHardwareSimulation({
      mandiId: 'KPG-01',
      device: 'LOAD_CELL',
      action: 'WEIGHT_LOCKED',
      value: randWeight
    });
  };

  // Filter Tokens
  const filteredTokens = tokens.filter((t) => {
    if (selectedCrop !== 'ALL' && t.crop !== selectedCrop) return false;
    if (selectedMandiId !== 'ALL' && t.mandiId !== selectedMandiId) return false;
    return true;
  });

  // Calculate Metrics
  const activeCount = tokens.filter((t) => t.status !== 'Completed' && t.status !== 'COMPLETED').length;
  const completedCount = tokens.filter((t) => t.status === 'Completed' || t.status === 'COMPLETED').length;
  const totalQuintals = tokens.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <StaffHeader activeDesk="admin" currentCentreName="Maharashtra APMC Command Center" />

      {/* ── Real-Time Toast Notification ───────────────────────────────────── */}
      {recentEventToast && (
        <div className="fixed top-20 right-6 z-50 animate-bounce bg-emerald-950/90 border-2 border-emerald-500 text-white px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-md max-w-md flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                {recentEventToast.title}
              </h4>
              <span className="text-[10px] font-mono font-bold bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-200">
                {recentEventToast.badge}
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-1 leading-snug">{recentEventToast.desc}</p>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* ── Top Header & Status Bar ──────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                APMC Regional Procurement Command
              </h1>
              {/* Real-time Socket Indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{socketConnected ? 'Socket.IO Live Sync' : 'Reconnecting Sync...'}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Synchronized with MongoDB Atlas Cluster (`kisanq.tokens`)</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin-dashboard/desk"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all"
            >
              <ScanLine className="w-4 h-4" />
              <span>Open Staff Desk</span>
            </Link>
            <button
              type="button"
              onClick={fetchLiveTokens}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all shadow-sm text-slate-300 hover:text-white"
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span>Refresh Atlas Data</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Print District Report</span>
            </button>
          </div>
        </div>

        {/* ── High-Density Real-Time KPI Cards ──────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Active Vehicles in Queue</span>
              <Truck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white mt-2 font-mono">{activeCount}</div>
            <div className="text-[10px] text-emerald-400 mt-1">Live in APMC Network</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Completed Payouts</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400 mt-2 font-mono">{completedCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">Direct Bank Transfers cleared</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Total Volume Intake</span>
              <Scale className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-amber-300 mt-2 font-mono">{totalQuintals} <span className="text-sm font-sans font-normal text-slate-400">Qtl</span></div>
            <div className="text-[10px] text-slate-400 mt-1">Across 4 Regional Crops</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Telemetry Node Status</span>
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="text-3xl font-black text-emerald-300 mt-2 font-mono">100%</div>
            <div className="text-[10px] text-emerald-400 mt-1">5 Regional Mandis Online</div>
          </div>
        </div>

        {/* ── Hardware Simulation Bar ────────────────────────────────────────── */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-950/40 border border-emerald-500/30 mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Gauge className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">IoT Hardware Telemetry Bridge</h3>
              <p className="text-xs text-slate-300">
                Gate Boom Barrier: <strong className={hardwareState.boomBarrier === 'OPEN' ? 'text-emerald-400' : 'text-rose-400'}>{hardwareState.boomBarrier}</strong>
                {' · '}
                Weighbridge Digital Cell: <strong className="text-amber-300 font-mono">{hardwareState.weighScale}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleBoomBarrier}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white flex items-center gap-1.5 transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Toggle Barrier ({hardwareState.boomBarrier === 'OPEN' ? 'Close' : 'Open'})
            </button>
            <button
              type="button"
              onClick={simulateScaleReading}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition-all"
            >
              <Scale className="w-3.5 h-3.5" />
              Simulate Weigh Scale Reading
            </button>
          </div>
        </div>

        {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-emerald-400" /> Crop Queue:
            </span>
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {['ALL', ...CROPS].map((cr) => (
                <button
                  key={cr}
                  type="button"
                  onClick={() => setSelectedCrop(cr)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedCrop === cr
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cr}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mandi:</span>
            <select
              value={selectedMandiId}
              onChange={(e) => setSelectedMandiId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All APMC Centers (5 Hubs)</option>
              {MANDIS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Live Parallel Crop Queue Kanban ───────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
          {CROPS.map((cropName) => {
            const cropTokens = filteredTokens.filter((t) => t.crop === cropName);
            const cropTotalQtl = cropTokens.reduce((s, t) => s + (Number(t.quantity) || 0), 0);

            return (
              <div key={cropName} className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 flex flex-col">
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="font-black text-white text-sm uppercase tracking-wide">{cropName} Queue</h3>
                  </div>
                  <span className="text-xs font-mono font-bold bg-slate-800 px-2 py-0.5 rounded-md text-emerald-400">
                    {cropTokens.length} Tokens ({cropTotalQtl} Qt)
                  </span>
                </div>

                {/* Column Content */}
                <div className="space-y-3 flex-1 min-h-[220px]">
                  {cropTokens.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-600">
                      <p className="text-xs">No active {cropName} tokens</p>
                      <span className="text-[10px] mt-1 text-slate-500">Live tokens will appear here instantly</span>
                    </div>
                  ) : (
                    cropTokens.map((token) => {
                      const completedStages = (token.stages || []).filter(
                        (s) => s.status === 'Completed' || s.status === 'completed'
                      ).length;
                      const nextStage = (token.stages || STAGE_DEFINITIONS).find(
                        (s) => s.status !== 'Completed' && s.status !== 'completed'
                      ) || STAGE_DEFINITIONS[completedStages] || STAGE_DEFINITIONS[0];
                      const isComplete = completedStages >= 5;

                      return (
                        <div
                          key={token.tokenNumber || token.id}
                          className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-all shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="font-mono font-black text-sm text-emerald-400">
                                {token.tokenNumber || token.id}
                              </div>
                              <div className="text-xs font-bold text-white mt-0.5">
                                {token.farmerName || 'Farmer'}
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isComplete
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}>
                              {token.status || 'BOOKED'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 space-y-0.5 mb-3">
                            <p className="truncate">📍 {token.mandiName}</p>
                            <p>⚖️ {token.quantity || 10} Quintals · {token.slotTime || token.slotLabel || 'Morning'}</p>
                          </div>

                          {/* Progress bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                              <span>Checkpoints</span>
                              <span className="font-mono text-emerald-400">{completedStages}/5 Completed</span>
                            </div>
                            <div className="flex gap-1 h-1.5">
                              {[0, 1, 2, 3, 4].map((idx) => (
                                <div
                                  key={idx}
                                  className={`flex-1 rounded-full ${
                                    idx < completedStages ? 'bg-emerald-500' : 'bg-slate-800'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Admin Quick Action Button */}
                          {!isComplete ? (
                            <button
                              type="button"
                              disabled={actionLoadingId === `${token.tokenNumber || token.id}-${nextStage.id}`}
                              onClick={() => handleAdminAdvanceStage(token, nextStage, completedStages)}
                              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
                            >
                              {actionLoadingId === `${token.tokenNumber || token.id}-${nextStage.id}` ? (
                                <span>Broadcasting...</span>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Sign-off {nextStage.shortLabel || nextStage.label}</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="text-center py-1 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-[10px] font-bold text-emerald-400">
                              ✓ All 5 Stages Cleared & Paid
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Regional APMC Congestion Matrix ────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <span>Regional APMC Mandi Load Balancing Network</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">Live Telemetry Synchronized</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MANDIS.map((mandi) => {
              const mandiTokens = tokens.filter((t) => t.mandiId === mandi.id);
              return (
                <div key={mandi.id} className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-bold text-white text-base">{mandi.name}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {mandi.location}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-emerald-400">
                      {mandi.code}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400">Active Queue</span>
                      <p className="font-mono font-bold text-emerald-400 text-sm mt-0.5">{mandiTokens.length} Tokens</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400">Congestion Status</span>
                      <p className="font-bold text-slate-200 text-sm mt-0.5">{mandi.congestion}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
