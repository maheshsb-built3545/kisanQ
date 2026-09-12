import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck, Scale, Leaf, Banknote, Building2,
  ScanLine, QrCode, Search, CheckCircle2, Clock,
  AlertTriangle, ArrowRight, RefreshCw, Printer,
  Radio, Database, Users, Truck, Check, ChevronRight,
  Sparkles, Lock, X, FileText, CheckCircle, ArrowUpRight,
  LogOut, Activity, Flame, BadgeCheck, DoorOpen, AlertOctagon,
  Receipt, ShieldAlert, UserPlus, Trash2, Plus, MapPin,
  ExternalLink, Layers, Camera, ArrowLeftRight, KeyRound,
  Shield, Cpu, CheckSquare, Zap, Hash, Sliders
} from 'lucide-react';
import GovHeader from '../components/common/GovHeader';
import { pricesApi, fastTrackApi } from '../api';
import {
  MANDIS, STAGE_DEFINITIONS, getTokens,
  updateTokenStageAsync, getTokensAsync, checkBackendHealth,
  approveGateExitApi, getFarmerProfileDuesApi,
  resetDataApi, getFarmersApi, createFarmerApi, saveTokenAsync
} from '../services/storageService';
import {
  getSocket, joinAdminRoom, joinMandiRoom, joinTokenRoom,
  onNewBooking, onStageUpdated, onHardwareEvent, onTokenCompleted,
  onGateExitRequested, onExitApproved, onTokenCancelled, onFarmerDuesUpdated,
  onFastTrackRequested, onFastTrackApproved, onFastTrackRejected,
  subscribeConnectionStatus, triggerHardwareSimulation
} from '../services/socketService';
import { TOKEN_STATUS, normalizeStatus, isTokenActive } from '../utils/statusEnums';

// ─── Desk Role & Terminal Definitions ────────────────────────────────────────
const DESK_CONFIGS = [
  {
    id: 'GATE_CHECKIN',
    stageIndex: 0,
    title: 'Desk 1: Security Gate Check-In & ANPR Yard Control',
    shortName: 'Gate Desk',
    officerDefault: 'Ramesh Shinde, Security Head',
    officerCode: 'SEC-D1-KPG',
    terminalLane: 'Gate 01 - North Boom Barrier',
    icon: ScanLine,
    color: 'blue',
    actionLabel: 'Authorize Entry & Open Boom Barrier',
  },
  {
    id: 'QUALITY_GRADING',
    stageIndex: 1,
    title: 'Desk 2: Quality Assaying & NIR Moisture Lab',
    shortName: 'Assaying Lab',
    officerDefault: 'S. Patil, Quality Assayer',
    officerCode: 'QA-SP-KPG',
    terminalLane: 'Assaying Lab #2 (Digital NIR Moisture Analyzer)',
    icon: Leaf,
    color: 'emerald',
    actionLabel: 'Certify Quality Grade & Issue SHA-256 Hash',
  },
  {
    id: 'WEIGHBRIDGE',
    stageIndex: 2,
    title: 'Desk 3: Electronic Pitless Weighbridge (Load-Cell HUD)',
    shortName: 'Weighbridge',
    officerDefault: 'Suresh Jadhav, Weighmaster',
    officerCode: 'WM-02-KPG',
    terminalLane: 'Pitless Weighbridge #1 (60 MT Calibrated)',
    icon: Scale,
    color: 'amber',
    actionLabel: 'Lock Calibrated Weight & State Ledger Sign',
  },
  {
    id: 'PROCUREMENT',
    stageIndex: 3,
    title: 'Desk 4: APMC Procurement & Purchase Order Bill',
    shortName: 'Procurement Desk',
    officerDefault: 'Secretary Deshmukh',
    officerCode: 'SEC-APMC-KPG',
    terminalLane: 'APMC Secretary Procurement Terminal',
    icon: FileText,
    color: 'orange',
    actionLabel: 'Authorize Purchase Order Bill',
  },
  {
    id: 'PAYOUT',
    stageIndex: 4,
    title: 'Desk 5: Treasury, Auto-Deduction & PFMS/DBT Settlement',
    shortName: 'Treasury & DBT',
    officerDefault: 'Treasurer Deshmukh',
    officerCode: 'TRY-DBT-KPG',
    terminalLane: 'Accounts & DBT Payout Desk',
    icon: Banknote,
    color: 'purple',
    actionLabel: 'Disburse DBT & Complete Token Lock',
  },
];

// ─── Maharashtra APMC Fair Average Quality (FAQ) Standards ───────────────────
const FAQ_COMMODITY_STANDARDS = {
  Soybean: {
    maxMoisture: 12.0,
    maxForeignMatter: 2.0,
    maxDamaged: 2.0,
    mspBaseRate: 4892,
    faqBand: 'Grade A FAQ (IS 6108:1971)',
    toleranceNote: 'Moisture ≤ 12.0%, Foreign Matter ≤ 2.0% for 100% Full MSP',
  },
  Wheat: {
    maxMoisture: 12.0,
    maxForeignMatter: 1.5,
    maxDamaged: 1.0,
    mspBaseRate: 2425,
    faqBand: 'Grade A FAQ (IS 1488:1969)',
    toleranceNote: 'Moisture ≤ 12.0%, Foreign Matter ≤ 1.5% for 100% Full MSP',
  },
  Onion: {
    maxMoisture: 14.0,
    maxForeignMatter: 3.0,
    maxDamaged: 3.0,
    mspBaseRate: 1950,
    faqBand: 'Grade A FAQ (AGMARK Export Band)',
    toleranceNote: 'Moisture ≤ 14.0%, Rot/Sprout ≤ 3.0%, Size ≥ 45mm',
  },
  Cotton: {
    maxMoisture: 8.5,
    maxForeignMatter: 3.0,
    maxDamaged: 2.5,
    mspBaseRate: 7122,
    faqBand: 'Grade A FAQ (CCI Medium-Long Staple)',
    toleranceNote: 'Moisture ≤ 8.5%, Trash Content ≤ 3.0%, Staple ≥ 28mm',
  },
};

export default function StaffDesk() {
  const navigate = useNavigate();
  const { user, logout, switchCenter } = useAuth();

  // Active Mandi State (Persisted in localStorage)
  const [activeMandiId, setActiveMandiId] = useState(() => {
    return localStorage.getItem('kisanq_active_mandi_id') || 'KPG-01';
  });

  const activeMandi = useMemo(() => {
    return MANDIS.find((m) => m.id === activeMandiId) || MANDIS[0];
  }, [activeMandiId]);

  // Retrieve stored staff session or fallback
  const [staffSession, setStaffSession] = useState(() => {
    try {
      const saved = localStorage.getItem('kisanq_staff_session');
      const base = saved ? JSON.parse(saved) : {};
      const mandiId = localStorage.getItem('kisanq_active_mandi_id') || base.mandiId || 'KPG-01';
      const mandiObj = MANDIS.find((m) => m.id === mandiId) || MANDIS[0];
      const dutyToken = base.dutyToken || `DUTY-${mandiObj.id.split('-')[0]}-SEC-0812`;
      return {
        name: base.name || user?.name || 'Ramesh Shinde, Security Head',
        role: base.role || user?.role || 'security_gate',
        roleLabel: base.roleLabel || 'Security Gate & Boom Barrier Desk',
        officerCode: base.officerCode || user?.officerCode || 'SEC-D1-KPG',
        deskName: base.deskName || 'Security Gate Check-In & ANPR Intake',
        terminalLane: base.terminalLane || 'Gate 01 - North Boom Barrier',
        dutyToken: dutyToken,
        mandiId: mandiObj.id,
        mandiName: mandiObj.name,
      };
    } catch {
      return {
        name: 'Ramesh Shinde, Security Head',
        role: 'security_gate',
        roleLabel: 'Security Gate & Boom Barrier Desk',
        officerCode: 'SEC-D1-KPG',
        deskName: 'Security Gate Check-In & ANPR Intake',
        terminalLane: 'Gate 01 - North Boom Barrier',
        dutyToken: 'DUTY-KPG-SEC-0812',
        mandiId: 'KPG-01',
        mandiName: 'APMC Kopargaon',
      };
    }
  });

  // Role-Based Access Mapping & Authorization Engine
  const officerRole = staffSession.role || user?.role || 'security_gate';
  const roleDeskMap = useMemo(() => ({
    security_gate: 0,
    quality_assayer: 1,
    weighmaster: 2,
    procurement: 3,
    accounts_settlement: 4,
  }), []);

  const isSupervisorOrAdmin = useMemo(() => {
    return ['supervisor', 'district_admin', 'operator', 'admin'].includes(officerRole);
  }, [officerRole]);

  const authorizedDeskIndex = useMemo(() => {
    return roleDeskMap[officerRole] !== undefined ? roleDeskMap[officerRole] : 0;
  }, [roleDeskMap, officerRole]);

  // Tokens & Queue State
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'EXITS' | 'COMPLETED'
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDeskTab, setActiveDeskTab] = useState(() => {
    return roleDeskMap[officerRole] !== undefined ? roleDeskMap[officerRole] : 0;
  }); // 0 to 4 (Desk 1 to 5)
  const isCurrentDeskAuthorized = isSupervisorOrAdmin || activeDeskTab === authorizedDeskIndex;

  const [socketConnected, setSocketConnected] = useState(false);
  const [dbStatus, setDbStatus] = useState({ online: false, database: 'disconnected' });
  const [actionSuccessToast, setActionSuccessToast] = useState(null);


  // Cross-Center Emergency Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Farmer Management & DB Reset Drawer State
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [farmerModalTab, setFarmerModalTab] = useState('list'); // 'list' | 'create' | 'reset'
  const [registeredFarmers, setRegisteredFarmers] = useState([]);
  const [farmerSearchQuery, setFarmerSearchQuery] = useState('');
  const [isFetchingFarmers, setIsFetchingFarmers] = useState(false);
  const [isResettingDb, setIsResettingDb] = useState(false);

  // Manual Farmer Form State
  const [newFarmerName, setNewFarmerName] = useState('');
  const [newFarmerPhone, setNewFarmerPhone] = useState('');
  const [newFarmerVillage, setNewFarmerVillage] = useState('Kopargaon');
  const [newFarmerCrop, setNewFarmerCrop] = useState('Soybean');
  const [newFarmerLandArea, setNewFarmerLandArea] = useState('3.5');
  const [isCreatingFarmer, setIsCreatingFarmer] = useState(false);

  // Exit Mediation State
  const [exitPenalty, setExitPenalty] = useState(150);
  const [exitOfficerReason, setExitOfficerReason] = useState('Produce rejection / Driver requested gate exit');
  const [isApprovingExit, setIsApprovingExit] = useState(false);

  // Farmer Dues State
  const [farmerPendingDues, setFarmerPendingDues] = useState(0);
  const [farmerDuesHistory, setFarmerDuesHistory] = useState([]);

  // ─── ROLE HUD 1: Security Gate (ANPR & Boom Barrier) ────────────────────────
  const [boomBarrierOpen, setBoomBarrierOpen] = useState(false);
  const [anprPlateInput, setAnprPlateInput] = useState('MH-17-BY-8821');
  const [isAnprScanning, setIsAnprScanning] = useState(false);

  // Fast-Track Priority Requests State
  const [fastTrackRequests, setFastTrackRequests] = useState([]);
  const [showFastTrackModal, setShowFastTrackModal] = useState(false);
  const [isFastTrackLoading, setIsFastTrackLoading] = useState(false);
  const [actioningFastTrackId, setActioningFastTrackId] = useState(null);

  // Live Unified Crop Prices & MSP Standards
  const [commodityStandards, setCommodityStandards] = useState(FAQ_COMMODITY_STANDARDS);

  useEffect(() => {
    let isMounted = true;
    const targetMandiId = activeMandi?.id || 'KPG-01';

    const fetchMandiPrices = async () => {
      try {
        const res = await pricesApi.getPricesByMandi(targetMandiId);
        const prices = Array.isArray(res) ? res : res?.data || [];
        
        // Request guard: Discard stale response if activeMandi has switched since request started
        if (isMounted && targetMandiId === activeMandi?.id && prices.length > 0) {
          setCommodityStandards((prev) => {
            const next = { ...prev };
            prices.forEach((item) => {
              if (item?.crop && next[item.crop]) {
                next[item.crop] = {
                  ...next[item.crop],
                  mspBaseRate: item.mspPrice ?? next[item.crop].mspBaseRate,
                  marketPriceToday: item.marketPriceToday ?? next[item.crop].marketPriceToday,
                  marketPriceYesterday: item.marketPriceYesterday ?? next[item.crop].marketPriceYesterday,
                };
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.debug('[StaffDesk] Live commodity standards sync notice:', err.message);
      }
    };
    fetchMandiPrices();
    return () => { isMounted = false; };
  }, [activeMandi?.id, activeMandiId]);

  // ─── ROLE HUD 2: Quality Assayer (FAQ Presets & Auto-Grading) ────────────────
  const [moisture, setMoisture] = useState(10.8);
  const [foreignMatter, setForeignMatter] = useState(1.2);
  const [damagedGrain, setDamagedGrain] = useState(0.8);

  // Get FAQ standard for the selected commodity
  const currentCrop = selectedToken?.crop || 'Soybean';
  const currentFaqSpec = commodityStandards?.[currentCrop] || commodityStandards?.['Soybean'] || { mspBaseRate: 2425, maxMoisture: 12, maxForeignMatter: 2 };

  // Real-Time Algorithmic Auto-Grading Engine
  const autoCalculatedGrade = useMemo(() => {
    const maxMoisture = currentFaqSpec?.maxMoisture ?? 12;
    const maxForeignMatter = currentFaqSpec?.maxForeignMatter ?? 2;
    const isGradeA = moisture <= maxMoisture && foreignMatter <= maxForeignMatter;
    if (isGradeA) {
      return {
        grade: 'Grade A FAQ',
        bonus: '100% Full MSP Rate',
        multiplier: 1.0,
        badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
        desc: 'Meets Fair Average Quality statutory export specifications',
      };
    }
    const isGradeB = moisture <= maxMoisture + 2.0 && foreignMatter <= maxForeignMatter + 2.0;
    if (isGradeB) {
      return {
        grade: 'Grade B (Commercial)',
        bonus: '96% Standard MSP Rate',
        multiplier: 0.96,
        badgeColor: 'bg-amber-100 text-amber-900 border-amber-400',
        desc: 'Commercial milling standard with minor allowable dockage',
      };
    }
    return {
      grade: 'Grade C (Feed/Distress)',
      bonus: '90% Base MSP Rate',
      multiplier: 0.90,
      badgeColor: 'bg-rose-100 text-rose-900 border-rose-400',
      desc: 'High moisture / foreign matter dockage applied under APMC rules',
    };
  }, [moisture, foreignMatter, currentFaqSpec]);

  // Dynamic Cryptographic Quality Certificate Hash
  const qaCertHash = useMemo(() => {
    const tok = selectedToken?.tokenNumber || selectedToken?.id || 'KQ-DEMO';
    const ts = Date.now().toString(36).toUpperCase();
    return `QA-SHA256-MH-${activeMandi.id.split('-')[0]}-${tok}-${ts}`;
  }, [selectedToken, activeMandi]);

  // ─── ROLE HUD 3: Weighmaster (Live Telemetry HUD & Fluctuation) ─────────────
  const [grossWeightMT, setGrossWeightMT] = useState(8.50);
  const [tareWeightMT, setTareWeightMT] = useState(3.40);
  const [isScaleFluctuating, setIsScaleFluctuating] = useState(true);
  const [simulatedFluctuatingKg, setSimulatedFluctuatingKg] = useState(8500);

  // Live Load Cell Fluctuation Simulator
  useEffect(() => {
    if (activeDeskTab === 2) {
      const baseKg = Math.round(grossWeightMT * 1000);
      setIsScaleFluctuating(true);
      const interval = setInterval(() => {
        const drift = Math.floor(Math.random() * 5 - 2) * 10; // -20, -10, 0, 10, 20 kg
        setSimulatedFluctuatingKg(baseKg + drift);
      }, 600);

      const stabilizeTimeout = setTimeout(() => {
        setIsScaleFluctuating(false);
        setSimulatedFluctuatingKg(baseKg);
      }, 3500);

      return () => {
        clearInterval(interval);
        clearTimeout(stabilizeTimeout);
      };
    }
  }, [activeDeskTab, grossWeightMT]);

  // Lock Gross & Tare direct from load cell
  const handleLockGrossFromScale = () => {
    const stabilizedMT = Number((simulatedFluctuatingKg / 1000).toFixed(2));
    setGrossWeightMT(stabilizedMT);
    setIsScaleFluctuating(false);
    setActionSuccessToast({
      title: 'Gross Weight Auto-Locked',
      message: `Direct Load Cell telemetry captured: ${stabilizedMT} MT (${stabilizedMT * 10} Qtl)`,
      tokenNumber: 'WB-LOCK-OK',
    });
    setTimeout(() => setActionSuccessToast(null), 3000);
  };

  const handleLockTareFromScale = () => {
    setTareWeightMT(3.40);
    setActionSuccessToast({
      title: 'Tare Weight Auto-Locked',
      message: 'Empty vehicle tare locked at 3.40 MT from tare pad',
      tokenNumber: 'TARE-OK',
    });
    setTimeout(() => setActionSuccessToast(null), 3000);
  };

  // Computed Net produce: (Gross - Tare) in MT and Quintals
  const netProduceMT = useMemo(() => {
    const net = Math.max(0.1, Number(grossWeightMT) - Number(tareWeightMT));
    return Number(net.toFixed(2));
  }, [grossWeightMT, tareWeightMT]);

  const netProduceQtl = useMemo(() => {
    return Number((netProduceMT * 10).toFixed(1));
  }, [netProduceMT]);

  // ─── ROLE HUD 4 & 5: Procurement PO Bill & Statutory Pricing ────────────────
  const cropPricePerQtl = useMemo(() => {
    const crop = selectedToken?.crop || 'Soybean';
    const baseRate = activeMandi?.rates?.today?.[crop] || currentFaqSpec?.mspBaseRate || 2425;
    return Math.round(baseRate * (autoCalculatedGrade?.multiplier || 1.0));
  }, [selectedToken, activeMandi, currentFaqSpec, autoCalculatedGrade]);

  const totalCalculatedAmount = useMemo(() => {
    const qty = netProduceQtl || Number(selectedToken?.quantity) || 25;
    return Math.round(qty * cropPricePerQtl);
  }, [netProduceQtl, selectedToken, cropPricePerQtl]);

  // ─── ROLE HUD 5: Treasury & Auto-Deduction DBT Engine ────────────────────────
  const netDbtPayout = useMemo(() => {
    return Math.max(0, totalCalculatedAmount - Number(farmerPendingDues || 0));
  }, [totalCalculatedAmount, farmerPendingDues]);

  // Yard Capacity & Live Lane Metering (Throttle Mode)
  const activeYardTrucksCount = useMemo(() => {
    const mandiTokens = tokens.filter((t) => {
      const matchMandi = t.mandiId === activeMandiId || t.mandiCode === activeMandiId.split('-')[0];
      return matchMandi && isTokenActive(t.status);
    });
    return mandiTokens.length + 14; // Simulation base load + live active tokens
  }, [tokens, activeMandiId]);

  const isYardThrottled = activeYardTrucksCount >= 18;

  // ─── Emergency Mandi Transfer ───────────────────────────────────────────────
  const handleExecuteEmergencyTransfer = async (targetMandiId) => {
    setActiveMandiId(targetMandiId);
    localStorage.setItem('kisanq_active_mandi_id', targetMandiId);
    const targetMandi = MANDIS.find((m) => m.id === targetMandiId) || MANDIS[0];
    const newDutyToken = `DUTY-${targetMandi.id.split('-')[0]}-${(staffSession.officerCode || 'SEC').split('-')[0]}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      if (switchCenter) {
        await switchCenter({ targetMandiId: targetMandi.id, targetMandiName: targetMandi.name });
      }
    } catch (e) {
      console.debug('Center switch notice:', e.message);
    }

    const updatedSession = {
      ...staffSession,
      mandiId: targetMandi.id,
      mandiName: targetMandi.name,
      assignedMandi: targetMandi.id,
      dutyToken: newDutyToken,
    };

    setStaffSession(updatedSession);
    localStorage.setItem('kisanq_staff_session', JSON.stringify(updatedSession));
    localStorage.setItem('kq_user', JSON.stringify({
      ...user,
      name: updatedSession.name,
      role: updatedSession.role,
      centreId: targetMandi.id,
      officerCode: updatedSession.officerCode,
      dutyToken: newDutyToken,
    }));

    joinMandiRoom(targetMandiId);
    setSelectedToken(null);
    setShowTransferModal(false);

    setActionSuccessToast({
      title: 'Duty Station Center Switched',
      message: `Shift duty transferred to ${targetMandi.name}. Socket.IO room re-scoped & token ${newDutyToken} bound.`,
      tokenNumber: newDutyToken,
    });
    setTimeout(() => setActionSuccessToast(null), 5000);
  };


  // 1. Fetch live tokens from backend API
  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      const health = await checkBackendHealth();
      setDbStatus(health);

      const res = await fetch('http://localhost:5000/api/tokens/all', {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tokens)) {
          setTokens(data.tokens);
          if (!selectedToken && data.tokens.length > 0) {
            const mandiTokens = data.tokens.filter((t) => t.mandiId === activeMandiId || t.mandiCode === activeMandiId.split('-')[0]);
            const firstActive = mandiTokens.find((t) => isTokenActive(t.status)) || mandiTokens[0] || data.tokens[0];
            setSelectedToken(firstActive);
          }
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // fallback to localStorage
    }

    const local = getTokens();
    setTokens(local);
    if (!selectedToken && local.length > 0) {
      const mandiTokens = local.filter((t) => t.mandiId === activeMandiId);
      setSelectedToken(mandiTokens.find((t) => isTokenActive(t.status)) || mandiTokens[0] || local[0]);
    }
    setIsLoading(false);
  }, [selectedToken, activeMandiId]);

  // Fetch Farmer Profile Dues
  const fetchDues = useCallback(async (phone) => {
    if (!phone) return;
    try {
      const data = await getFarmerProfileDuesApi(phone);
      if (data) {
        setFarmerPendingDues(Number(data.pendingDues || 0));
        setFarmerDuesHistory(data.cancellationHistory || []);
      }
    } catch (err) {
      console.debug('Error fetching dues:', err);
    }
  }, []);

  // Fetch Pending Fast-Track Requests
  const loadFastTrackRequests = useCallback(async () => {
    setIsFastTrackLoading(true);
    try {
      const res = await fastTrackApi.getPendingRequests(activeMandiId);
      if (res && res.success && Array.isArray(res.data)) {
        setFastTrackRequests(res.data);
      }
    } catch (err) {
      console.debug('[StaffDesk] Fast-Track pending requests fetch notice:', err.message);
    } finally {
      setIsFastTrackLoading(false);
    }
  }, [activeMandiId]);

  useEffect(() => {
    loadFastTrackRequests();
  }, [loadFastTrackRequests]);

  // Fetch Registered Farmers for the Management Modal
  const loadFarmers = useCallback(async () => {
    setIsFetchingFarmers(true);
    try {
      const farmers = await getFarmersApi();
      setRegisteredFarmers(farmers);
    } catch (err) {
      console.error('Failed to load farmers:', err);
    } finally {
      setIsFetchingFarmers(false);
    }
  }, []);

  useEffect(() => {
    if (showFarmerModal) {
      loadFarmers();
    }
  }, [showFarmerModal, loadFarmers]);

  // Sync dues when selected token changes
  useEffect(() => {
    const phone = selectedToken?.farmerPhone || selectedToken?.phone;
    if (phone) {
      fetchDues(phone);
    } else {
      setFarmerPendingDues(0);
      setFarmerDuesHistory([]);
    }
  }, [selectedToken, fetchDues]);

  // 2. Setup Socket.IO & Real-Time Listeners
  useEffect(() => {
    fetchTokens();
    joinAdminRoom();
    joinMandiRoom(activeMandiId);

    const unsubConn = subscribeConnectionStatus((connected) => {
      setSocketConnected(connected);
    });

    const unsubBooking = onNewBooking((data) => {
      const newToken = data.token || data;
      setTokens((prev) => {
        const key = newToken.id || newToken.tokenNumber;
        if (prev.some((t) => (t.id || t.tokenNumber) === key)) return prev;
        return [newToken, ...prev];
      });
    });

    const unsubStage = onStageUpdated((data) => {
      const updatedToken = data.token;
      const tokenNum = data.tokenNumber || updatedToken?.tokenNumber || updatedToken?.id;

      setTokens((prev) =>
        prev.map((t) => ((t.tokenNumber || t.id) === tokenNum ? (updatedToken || { ...t, ...data }) : t))
      );

      setSelectedToken((prev) => {
        if (prev && (prev.tokenNumber || prev.id) === tokenNum) {
          return updatedToken || { ...prev, ...data };
        }
        return prev;
      });
    });

    const unsubCompleted = onTokenCompleted((data) => {
      const updatedToken = data.token;
      const tokenNum = data.tokenNumber || updatedToken?.tokenNumber || updatedToken?.id;

      setTokens((prev) =>
        prev.map((t) => ((t.tokenNumber || t.id) === tokenNum ? { ...(updatedToken || t), status: TOKEN_STATUS.COMPLETED } : t))
      );

      setSelectedToken((prev) => {
        if (prev && (prev.tokenNumber || prev.id) === tokenNum) {
          return { ...(updatedToken || prev), status: TOKEN_STATUS.COMPLETED };
        }
        return prev;
      });
    });

    const unsubHardware = onHardwareEvent((data) => {
      if (data.device === 'BOOM_BARRIER') {
        setBoomBarrierOpen(data.action === 'OPEN');
      }
    });

    const unsubExitReq = onGateExitRequested((data) => {
      const tokNum = data.tokenNumber || data.id;
      setTokens((prev) =>
        prev.map((t) => ((t.tokenNumber || t.id) === tokNum ? { ...t, status: TOKEN_STATUS.GATE_EXIT_REQUESTED, cancellationReason: data.reason } : t))
      );
      setSelectedToken((prev) => {
        if (prev && (prev.tokenNumber || prev.id) === tokNum) {
          return { ...prev, status: TOKEN_STATUS.GATE_EXIT_REQUESTED, cancellationReason: data.reason };
        }
        return prev;
      });
      setActiveDeskTab(0);
      setActionSuccessToast({
        title: '🚨 GATE EXIT REQUEST',
        message: `Vehicle #${tokNum} (${data.farmerName || 'Farmer'}) requested yard exit clearance!`,
        tokenNumber: tokNum,
      });
    });

    const unsubExitApproved = onExitApproved((data) => {
      const tokNum = data.tokenNumber || data.id;
      setTokens((prev) =>
        prev.map((t) => ((t.tokenNumber || t.id) === tokNum ? { ...t, status: TOKEN_STATUS.CANCELLED, cancellationFee: data.penaltyAmount, gateExitApprovedBy: data.gateExitApprovedBy } : t))
      );
      setSelectedToken((prev) => {
        if (prev && (prev.tokenNumber || prev.id) === tokNum) {
          return { ...prev, status: TOKEN_STATUS.CANCELLED, cancellationFee: data.penaltyAmount, gateExitApprovedBy: data.gateExitApprovedBy };
        }
        return prev;
      });
    });

    const unsubCancelled = onTokenCancelled((data) => {
      const tokNum = data.tokenNumber || data.id;
      setTokens((prev) =>
        prev.map((t) => ((t.tokenNumber || t.id) === tokNum ? { ...t, status: TOKEN_STATUS.CANCELLED, cancellationFee: data.penaltyAmount } : t))
      );
      setSelectedToken((prev) => {
        if (prev && (prev.tokenNumber || prev.id) === tokNum) {
          return { ...prev, status: TOKEN_STATUS.CANCELLED, cancellationFee: data.penaltyAmount };
        }
        return prev;
      });
    });

    const unsubDuesUpdated = onFarmerDuesUpdated((data) => {
      const curPhone = selectedToken?.farmerPhone || selectedToken?.phone;
      if (data?.phone === curPhone) {
        setFarmerPendingDues(Number(data.pendingDues || 0));
        if (data.cancellationHistory) setFarmerDuesHistory(data.cancellationHistory);
      }
    });

    const unsubFtReq = onFastTrackRequested((data) => {
      const req = data.request || data;
      if (req.mandiId === activeMandiId || !req.mandiId) {
        setFastTrackRequests((prev) => {
          const reqId = req._id || req.id;
          if (prev.some((r) => (r._id || r.id) === reqId)) return prev;
          return [req, ...prev];
        });
        setActionSuccessToast({
          title: '⚡ FAST-TRACK REQUESTED',
          message: `Token #${req.tokenNumber || data.tokenNumber} requested Tier ${req.tier || data.tier}% priority!`,
          tokenNumber: req.tokenNumber || data.tokenNumber || 'PRIORITY',
        });
      }
    });

    const unsubFtApp = onFastTrackApproved((data) => {
      const tokenNum = data.tokenNumber || data.token?.tokenNumber;
      setFastTrackRequests((prev) => prev.filter((r) => r.tokenNumber !== tokenNum));
      fetchTokens();
      setActionSuccessToast({
        title: '⚡ FAST-TRACK APPROVED',
        message: `Token #${tokenNum} prioritized to Position #1 in queue!`,
        tokenNumber: tokenNum || 'PRIORITY-1',
      });
    });

    const unsubFtRej = onFastTrackRejected((data) => {
      const tokenNum = data.tokenNumber || data.token?.tokenNumber;
      setFastTrackRequests((prev) => prev.filter((r) => r.tokenNumber !== tokenNum));
      fetchTokens();
    });

    return () => {
      unsubConn();
      unsubBooking();
      unsubStage();
      unsubCompleted();
      unsubHardware();
      unsubExitReq();
      unsubExitApproved();
      unsubCancelled();
      unsubDuesUpdated();
      unsubFtReq();
      unsubFtApp();
      unsubFtRej();
    };
  }, [fetchTokens, activeMandiId, selectedToken]);

  // When selected token changes, auto-align active desk tab to next pending stage
  useEffect(() => {
    const norm = normalizeStatus(selectedToken?.status);
    if (norm === TOKEN_STATUS.GATE_EXIT_REQUESTED) {
      setActiveDeskTab(0); // Focus on Gate Desk for exit authorization
    } else if (selectedToken?.stages && Array.isArray(selectedToken.stages)) {
      const pendingIdx = (selectedToken?.stages || []).findIndex((s) => (s?.status || '').toLowerCase() !== 'completed');
      if (pendingIdx !== -1) {
        setActiveDeskTab(pendingIdx);
      } else {
        setActiveDeskTab(4); // All done -> show final payout desk
      }


      // Sync form values from existing token details if present
      const qty = Number(selectedToken.quantity) || 25;
      const tare = 3.40;
      const gross = Number((tare + qty / 10).toFixed(2));
      setGrossWeightMT(gross);
      setTareWeightMT(tare);
    }
  }, [selectedToken]);

  // Handle Desk 1 Officer Gate Exit Authorization
  const handleApproveGateExit = async () => {
    if (!selectedToken) return;
    const tokenNumber = selectedToken.tokenNumber || selectedToken.id;
    setIsApprovingExit(true);

    try {
      await approveGateExitApi(tokenNumber, {
        officerName: staffSession.name || 'Security Head',
        officerSigId: `${staffSession.officerCode || 'SEC-D1-KPG'}-EXIT`,
        penaltyAmount: Number(exitPenalty) || 0,
        reason: exitOfficerReason || 'Gate exit authorized by officer',
      });

      setBoomBarrierOpen(true);
      const updated = {
        ...selectedToken,
        status: 'Cancelled',
        cancellationFee: Number(exitPenalty) || 0,
        gateExitApprovedBy: staffSession.name,
      };
      setSelectedToken(updated);
      setTokens((prev) => prev.map((t) => ((t.tokenNumber || t.id) === tokenNumber ? updated : t)));

      // Refresh dues
      const phone = selectedToken.farmerPhone || selectedToken.phone;
      if (phone) fetchDues(phone);

      setActionSuccessToast({
        title: 'Gate Exit Authorized & Barrier Opened',
        message: `Boom barrier opened for #${tokenNumber}. Penalty dues ₹${exitPenalty} registered & account unlocked!`,
        tokenNumber,
      });
      setTimeout(() => setActionSuccessToast(null), 5000);
    } catch (err) {
      console.error('Error approving gate exit:', err);
    } finally {
      setIsApprovingExit(false);
    }
  };

  // Handle Officer Fast-Track Priority Review
  const handleApproveFastTrack = async (req) => {
    const reqId = req._id || req.id;
    setActioningFastTrackId(reqId);
    try {
      const officerId = staffSession.officerCode || user?.officerCode || 'SUPERVISOR-DESK';
      const res = await fastTrackApi.approveRequest(reqId, officerId);
      if (res && res.success) {
        setFastTrackRequests((prev) => prev.filter((r) => (r._id || r.id) !== reqId));
        await fetchTokens();
        setActionSuccessToast({
          title: '⚡ Fast-Track Approved',
          message: `Token #${res.tokenNumber || req.tokenNumber} moved to Queue Position #1 by ${officerId}.`,
          tokenNumber: res.tokenNumber || req.tokenNumber,
        });
        setTimeout(() => setActionSuccessToast(null), 4000);
      } else {
        alert(res?.message || 'Failed to approve fast-track request.');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error approving fast-track request.');
    } finally {
      setActioningFastTrackId(null);
    }
  };

  const handleRejectFastTrack = async (req) => {
    const reqId = req._id || req.id;
    setActioningFastTrackId(reqId);
    try {
      const officerId = staffSession.officerCode || user?.officerCode || 'SUPERVISOR-DESK';
      const res = await fastTrackApi.rejectRequest(reqId, officerId, 'Fairness & Capacity Quota Limit');
      if (res && res.success) {
        setFastTrackRequests((prev) => prev.filter((r) => (r._id || r.id) !== reqId));
        await fetchTokens();
        setActionSuccessToast({
          title: 'Fast-Track Declined',
          message: `Token #${res.tokenNumber || req.tokenNumber} priority rejected. Standard queue position preserved.`,
          tokenNumber: res.tokenNumber || req.tokenNumber,
        });
        setTimeout(() => setActionSuccessToast(null), 4000);
      } else {
        alert(res?.message || 'Failed to reject fast-track request.');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error rejecting fast-track request.');
    } finally {
      setActioningFastTrackId(null);
    }
  };

  // Handle Desk Action Execution
  const handleExecuteStageAction = async (deskConfig) => {
    if (!selectedToken) return;

    if (!isCurrentDeskAuthorized) {
      alert(`Station Locked: Signed in as '${staffSession.roleLabel || staffSession.name}'. Only authorized ${deskConfig.shortName} officers can execute sign-offs.`);
      return;
    }

    // Strict Sequential Pipeline Check on Frontend
    if (deskConfig.stageIndex > 0) {
      const prevStg = stages.find(s => s.stageIndex === deskConfig.stageIndex - 1 || s.id === DESK_CONFIGS[deskConfig.stageIndex - 1]?.id);
      const isPrevDone = (prevStg?.status || '').toLowerCase() === 'completed';
      if (!isPrevDone) {
        const prevTitle = DESK_CONFIGS[deskConfig.stageIndex - 1]?.shortName || `Desk ${deskConfig.stageIndex}`;
        alert(`🔒 Prerequisite Pending: Awaiting sign-off from ${prevTitle} (Desk ${deskConfig.stageIndex}) before proceeding.`);
        return;
      }
    }

    const tokenNumber = selectedToken.tokenNumber || selectedToken.id;
    setIsProcessing(true);


    const sigId = `${staffSession.officerCode || deskConfig.officerCode}-${Date.now().toString(36).toUpperCase()}`;

    // Compile desk-specific rich payload
    let stagePayload = {
      stageId: deskConfig.id,
      stageIndex: deskConfig.stageIndex,
      officerName: staffSession.name || deskConfig.officerDefault,
      officerSigId: sigId,
      status: 'Completed',
    };

    if (deskConfig.id === 'GATE_CHECKIN') {
      stagePayload.details = {
        gateNumber: 'Gate 01 - North Boom Barrier',
        anprPlate: anprPlateInput,
        anprConfidence: '99.4%',
        entryType: 'Commercial Tractor-Trolley',
      };
      setBoomBarrierOpen(true);
      triggerHardwareSimulation({
        mandiId: activeMandiId,
        device: 'BOOM_BARRIER',
        action: 'OPEN',
        tokenNumber,
      });
    } else if (deskConfig.id === 'QUALITY_GRADING') {
      stagePayload.grade = autoCalculatedGrade.grade;
      stagePayload.moisture = Number(moisture);
      stagePayload.foreignMatter = Number(foreignMatter);
      stagePayload.damagedGrain = Number(damagedGrain);
      stagePayload.details = {
        moisture: Number(moisture),
        foreignMatter: Number(foreignMatter),
        damagedGrain: Number(damagedGrain),
        grade: autoCalculatedGrade.grade,
        qaCertHash: qaCertHash,
        faqStandardBand: currentFaqSpec.faqBand,
        assayerRemarks: `Passed statutory APMC MSP standard: ${autoCalculatedGrade.grade}`,
      };
    } else if (deskConfig.id === 'WEIGHBRIDGE') {
      stagePayload.weight = netProduceQtl;
      stagePayload.grossWeight = grossWeightMT;
      stagePayload.tareWeight = tareWeightMT;
      stagePayload.netWeight = netProduceQtl;
      stagePayload.details = {
        scaleId: 'PIT-WB-01-60MT-DIGITAL',
        grossWeightMT,
        tareWeightMT,
        netProduceMT,
        netProduceQtl,
        calibratedTolerance: '±0 kg Drift (ISO/IEC 17025)',
      };
      triggerHardwareSimulation({
        mandiId: activeMandiId,
        device: 'LOAD_CELL',
        action: 'WEIGHT_LOCKED',
        value: `${netProduceMT} MT (${netProduceQtl} Qtl)`,
        tokenNumber,
      });
    } else if (deskConfig.id === 'PROCUREMENT') {
      const poNum = `PO-APMC-${activeMandi.code || 'KPG'}-${Date.now().toString(36).toUpperCase()}`;
      stagePayload.poNumber = poNum;
      stagePayload.totalAmount = totalCalculatedAmount;
      stagePayload.details = {
        poNumber: poNum,
        ratePerQtl: cropPricePerQtl,
        certifiedQuantity: netProduceQtl,
        totalAmount: totalCalculatedAmount,
        certifiedGrade: autoCalculatedGrade.grade,
      };
    } else if (deskConfig.id === 'PAYOUT') {
      const pmtRef = `DBT-PFMS-MH-2026-${Date.now().toString(36).toUpperCase()}`;
      stagePayload.paymentRef = pmtRef;
      stagePayload.totalAmount = netDbtPayout;
      stagePayload.status = 'Completed';
      stagePayload.details = {
        paymentRef: pmtRef,
        dbtStatus: 'PFMS_DISBURSEMENT_SUCCESS',
        beneficiaryName: selectedToken.farmerName,
        accountMasked: 'SBI ········4102',
        grossAmount: totalCalculatedAmount,
        duesDeducted: farmerPendingDues,
        totalPaid: netDbtPayout,
        unlockedSingleActiveToken: true,
      };
    }

    try {
      const updated = await updateTokenStageAsync(tokenNumber, deskConfig.id, stagePayload);
      if (updated) {
        setSelectedToken(updated);
        setTokens((prev) => prev.map((t) => ((t.tokenNumber || t.id) === tokenNumber ? updated : t)));
        if (deskConfig.id === 'PAYOUT') {
          setFarmerPendingDues(0);
        }
      }

      setActionSuccessToast({
        title: `${deskConfig.shortName} Clearance Certified!`,
        message: deskConfig.id === 'PAYOUT'
          ? `Token #${tokenNumber} finalized! Net ₹${netDbtPayout.toLocaleString('en-IN')} disbursed, past dues cleared, and single-active-token lock lifted.`
          : `Stage ${deskConfig.stageIndex + 1} signed off with Hash/Sig: ${sigId}`,
        tokenNumber,
      });
      setTimeout(() => setActionSuccessToast(null), 4500);

      // Advance to next desk tab if available
      if (deskConfig.stageIndex < 4) {
        setActiveDeskTab(deskConfig.stageIndex + 1);
      }
    } catch (err) {
      console.error('Error updating stage:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Manual Farmer Registration Form Submission
  const handleCreateFarmer = async (e) => {
    e.preventDefault();
    if (!newFarmerName || !newFarmerPhone) return;

    setIsCreatingFarmer(true);
    try {
      const farmer = await createFarmerApi({
        name: newFarmerName,
        phone: newFarmerPhone,
        village: newFarmerVillage,
        crop: newFarmerCrop,
        landArea: Number(newFarmerLandArea) || 2.5,
      });

      setActionSuccessToast({
        title: 'Farmer Registered Successfully',
        message: `Registered ${farmer.name} (+91 ${farmer.phone}) in APMC Registry`,
        tokenNumber: farmer.kisanId || 'FARMER',
      });
      setNewFarmerName('');
      setNewFarmerPhone('');
      loadFarmers();
      setFarmerModalTab('list');
      setTimeout(() => setActionSuccessToast(null), 4000);
    } catch (err) {
      alert('Error registering farmer: ' + err.message);
    } finally {
      setIsCreatingFarmer(false);
    }
  };

  // Handle Database Reset Trigger
  const handleResetDatabase = async () => {
    if (!window.confirm('⚠️ WARNING: This will flush all operational tokens, queue states, and reset farmer dues to clean demo state. Continue?')) {
      return;
    }

    setIsResettingDb(true);
    try {
      await resetDataApi();
      setTokens([]);
      setSelectedToken(null);
      await fetchTokens();
      await loadFarmers();

      setActionSuccessToast({
        title: 'Database Reset & Re-Seeded',
        message: 'All queues flushed. Single-active-token locks lifted. Demo state active.',
        tokenNumber: 'PURGE_OK',
      });
      setTimeout(() => setActionSuccessToast(null), 5000);
      setShowFarmerModal(false);
    } catch (err) {
      alert('Failed to reset database: ' + err.message);
    } finally {
      setIsResettingDb(false);
    }
  };

  // 1-Click Test Slot Booking for a specific farmer
  const handleBookTestSlot = async (farmer) => {
    try {
      const slotTime = 'Morning 08:00 – 11:00 AM';
      const slotDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      const res = await saveTokenAsync({
        mandiId: activeMandi.id,
        mandiName: activeMandi.name,
        mandiCode: activeMandi.id.split('-')[0],
        farmerName: farmer.name,
        phone: farmer.phone,
        crop: farmer.crop || 'Soybean',
        quantity: Math.floor(18 + Math.random() * 15),
        quantityBand: '20-30 Quintals',
        slotLabel: slotTime,
        slotDate,
        latitude: 19.8928,
        longitude: 74.4820,
      });

      if (res.token) {
        setSelectedToken(res.token);
        fetchTokens();
        loadFarmers();
        setShowFarmerModal(false);

        setActionSuccessToast({
          title: 'Test Token Generated',
          message: `Slot reserved for ${farmer.name} at ${activeMandi.name}`,
          tokenNumber: res.token.tokenNumber || res.token.id,
        });
        setTimeout(() => setActionSuccessToast(null), 4000);
      }
    } catch (err) {
      if (err.code === 'ACTIVE_TOKEN_EXISTS' || err.status === 409) {
        alert(`❌ SINGLE ACTIVE TOKEN LOCK: Farmer ${farmer.name} (+91 ${farmer.phone}) already has an active slot in queue! Complete or cancel delivery first.`);
      } else {
        alert('Booking error: ' + err.message);
      }
    }
  };

  // Simulate ANPR Plate Snap
  const handleSimulateAnprSnap = () => {
    setIsAnprScanning(true);
    setTimeout(() => {
      const plates = ['MH-17-BY-8821', 'MH-17-AH-4102', 'MH-17-CT-9012', 'MH-15-EG-3344'];
      const randomPlate = plates[Math.floor(Math.random() * plates.length)];
      setAnprPlateInput(randomPlate);
      setIsAnprScanning(false);
      setActionSuccessToast({
        title: 'ANPR Plate Camera Snap',
        message: `Optical Vehicle Recognition: ${randomPlate} (OCR Confidence: 99.4%)`,
        tokenNumber: randomPlate,
      });
      setTimeout(() => setActionSuccessToast(null), 3000);
    }, 700);
  };

  const activeMandiTokens = useMemo(() => {
    return tokens.filter((t) => {
      return (
        activeMandiId === 'ALL' ||
        t.mandiId === activeMandiId ||
        t.mandiCode === activeMandiId.split('-')[0] ||
        (t.mandiName && t.mandiName.includes(activeMandi.name.replace('APMC ', '')))
      );
    });
  }, [tokens, activeMandiId, activeMandi]);

  // Tab counters according to requirements:
  // - All tab count: Total of all active tokens in the yard or en route (Booked, In-Progress, Gate-Exit-Requested).
  // - In Yard tab: Tokens with Stage 1 completed and status not cancelled/completed.
  // - Exit Reqs tab: Tokens matching normalizeStatus(token.status) === 'Gate-Exit-Requested'.
  // - Done tab: Tokens completed or cancelled today.
  const allCount = useMemo(() => {
    return activeMandiTokens.filter((t) => isTokenActive(t.status)).length;
  }, [activeMandiTokens]);

  const inYardCount = useMemo(() => {
    return activeMandiTokens.filter((t) => {
      const isAct = isTokenActive(t.status);
      if (!isAct) return false;
      const stages = Array.isArray(t.stages) ? t.stages : [];
      const stage1Done = (stages[0]?.status || '').toLowerCase() === 'completed';
      const norm = normalizeStatus(t.status);
      return stage1Done || norm === TOKEN_STATUS.IN_PROGRESS;
    }).length;
  }, [activeMandiTokens]);

  const exitCount = useMemo(() => {
    return activeMandiTokens.filter((t) => normalizeStatus(t.status) === TOKEN_STATUS.GATE_EXIT_REQUESTED).length;
  }, [activeMandiTokens]);

  const doneCount = useMemo(() => {
    return activeMandiTokens.filter((t) => {
      const norm = normalizeStatus(t.status);
      return norm === TOKEN_STATUS.COMPLETED || norm === TOKEN_STATUS.CANCELLED;
    }).length;
  }, [activeMandiTokens]);

  // Filter Tokens list for active mandi
  const filteredTokens = useMemo(() => {
    return activeMandiTokens.filter((t) => {
      // Text Search Filter
      const num = t.tokenNumber || t.id || '';
      const name = t.farmerName || '';
      const phone = t.farmerPhone || t.phone || '';
      const matchesSearch =
        num.toLowerCase().includes(searchQuery.toLowerCase()) ||
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        phone.includes(searchQuery);

      if (!matchesSearch) return false;

      const norm = normalizeStatus(t.status);
      const isDone = norm === TOKEN_STATUS.COMPLETED || norm === TOKEN_STATUS.CANCELLED;
      const isExitReq = norm === TOKEN_STATUS.GATE_EXIT_REQUESTED;
      const stages = Array.isArray(t.stages) ? t.stages : [];
      const stage1Done = (stages[0]?.status || '').toLowerCase() === 'completed';
      const isInYard = isTokenActive(norm) && (stage1Done || norm === TOKEN_STATUS.IN_PROGRESS);

      if (statusFilter === 'ALL') {
        return isTokenActive(norm);
      }
      if (statusFilter === 'ACTIVE') {
        return isInYard;
      }
      if (statusFilter === 'EXITS') {
        return isExitReq;
      }
      if (statusFilter === 'COMPLETED') {
        return isDone;
      }

      return true;
    });
  }, [activeMandiTokens, searchQuery, statusFilter]);

  // Filter registered farmers in modal
  const filteredFarmers = useMemo(() => {
    return registeredFarmers.filter((f) => {
      const q = farmerSearchQuery.toLowerCase();
      return (
        (f.name || '').toLowerCase().includes(q) ||
        (f.phone || '').includes(q) ||
        (f.village || '').toLowerCase().includes(q) ||
        (f.crop || '').toLowerCase().includes(q)
      );
    });
  }, [registeredFarmers, farmerSearchQuery]);

  const stages = Array.isArray(selectedToken?.stages) ? selectedToken.stages : [];
  const completedCount = stages.filter((s) => (s.status || '').toLowerCase() === 'completed').length;
  const normSelectedStatus = normalizeStatus(selectedToken?.status);
  const isTokenCompleted = normSelectedStatus === TOKEN_STATUS.COMPLETED || completedCount === 5;
  const isExitRequested = normSelectedStatus === TOKEN_STATUS.GATE_EXIT_REQUESTED;
  const isCancelled = normSelectedStatus === TOKEN_STATUS.CANCELLED;

  const currentActionableStageIndex = useMemo(() => {
    if (!selectedToken) return 0;
    const idx = stages.findIndex((s) => (s.status || '').toLowerCase() !== 'completed');
    return idx !== -1 ? idx : 5;
  }, [selectedToken, stages]);

  const isPrerequisiteMet = useMemo(() => {
    if (activeDeskTab === 0) return true;
    const prevStg = stages.find((s) => s.stageIndex === activeDeskTab - 1 || s.id === DESK_CONFIGS[activeDeskTab - 1]?.id);
    return (prevStg?.status || '').toLowerCase() === 'completed';
  }, [activeDeskTab, stages]);

  const prevDesk = activeDeskTab > 0 ? DESK_CONFIGS[activeDeskTab - 1] : null;
  const isStageAlreadyCertified = stages[activeDeskTab] && (stages[activeDeskTab].status || '').toLowerCase() === 'completed';


  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F2850] flex flex-col font-sans selection:bg-[#047857] selection:text-white">
      
      {/* ── Official Indian Government Header Bar ─────────────────────────── */}
      <GovHeader portalType="staff" />

      {/* ── Real-Time Success Toast ────────────────────────────────────────── */}
      {actionSuccessToast && (
        <div className="fixed top-24 right-6 z-50 animate-bounce bg-[#0B1E3B] border-2 border-emerald-400 text-white px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-md max-w-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-slate-950" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                {actionSuccessToast.title}
              </h4>
              <span className="text-[10px] font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-emerald-300 border border-slate-700">
                {actionSuccessToast.tokenNumber}
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-1 leading-snug">{actionSuccessToast.message}</p>
          </div>
        </div>
      )}

      {/* ── 4. PERSISTENT COMMAND HEADER & CROSS-CENTER EMERGENCY TRANSFER ──── */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-16 z-40 shadow-xs text-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          
          {/* Brand & Mandi Label */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-xs shrink-0 text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-slate-900">
                  Kisan<span className="text-emerald-600">Q</span> Operational Desk
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  Live Terminal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Check-in, quality testing, automated weighbridge & payout controls
              </p>
            </div>
          </div>

          {/* Quick Role HUD Switcher Tabs */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {DESK_CONFIGS.map((d, idx) => {
              const IconComp = d.icon;
              const isActive = activeDeskTab === idx;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActiveDeskTab(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{d.shortName}</span>
                </button>
              );
            })}
          </div>

          {/* Persistent Top-Right Badge: Active Duty Station & Emergency Transfer Button */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            
            {/* 📍 Active Duty Station Badge with Request Transfer ⇄ Button */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 shadow-xs">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-left">
                <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <span>Mandi:</span>
                  <strong className="text-slate-900">{activeMandi.name.replace('APMC ', '')}</strong>
                  <span className="font-mono text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded text-[8px] font-bold">
                    {staffSession.dutyToken || 'DUTY-ACTIVE'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-600 truncate max-w-[150px] sm:max-w-none">
                  {staffSession.terminalLane || 'Gate 01 - North Boom Barrier'}
                </div>
              </div>

              {/* Request Transfer Button */}
              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                className="ml-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center gap-1 transition-all cursor-pointer shrink-0"
                title="Switch Target Mandi Center"
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>Switch ⇄</span>
              </button>
            </div>

            {/* Fast-Track Priority Queue Button */}
            <button
              type="button"
              onClick={() => {
                setShowFastTrackModal(true);
                loadFastTrackRequests();
              }}
              className={`px-2.5 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer relative ${
                fastTrackRequests.length > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title="Fast-Track Priority Verification & Queue Override"
            >
              <Zap className={`w-3.5 h-3.5 ${fastTrackRequests.length > 0 ? 'text-amber-600 fill-amber-500' : 'text-slate-600'}`} />
              <span className="hidden sm:inline">Fast-Track</span>
              {fastTrackRequests.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                  {fastTrackRequests.length}
                </span>
              )}
            </button>

            {/* Farmer Registry Button */}
            <button
              type="button"
              onClick={() => {
                setShowFarmerModal(true);
                loadFarmers();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
              title="Manual Farmer Management & Database Reset"
            >
              <Users className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Registry & Seed</span>
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/staff-login');
              }}
              className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Logout Staff Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ──────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ── Left Sidebar: Incoming Queue, Search & Live Yard Telemetry (4 Cols) */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Yard Telemetry Box */}
          <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#0B1E3B] flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#047857]" />
                <span>{activeMandi.name} Queue</span>
              </h2>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <button
                  type="button"
                  onClick={fetchTokens}
                  className="p-1 text-slate-500 hover:text-[#0B1E3B] rounded-lg hover:bg-slate-100 transition-colors"
                  title="Refresh Queue"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-2.5">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search ${activeMandi.code || 'Token'} or Mobile…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-300 focus:border-[#047857] rounded-xl pl-9 pr-8 py-1.5 text-xs text-[#0B1E3B] placeholder-slate-400 focus:outline-hidden font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-200">
              {[
                { id: 'ALL', label: `All (${allCount})` },
                { id: 'ACTIVE', label: `In Yard (${inYardCount})` },
                { id: 'EXITS', label: `Exit Reqs (${exitCount})`, isPulsing: exitCount > 0 },
                { id: 'COMPLETED', label: `Done (${doneCount})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`py-1 px-1 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer relative ${
                    statusFilter === f.id
                      ? f.id === 'EXITS' && f.isPulsing
                        ? 'bg-rose-700 text-white shadow-xs animate-pulse'
                        : 'bg-[#0B1E3B] text-white shadow-xs'
                      : f.id === 'EXITS' && f.isPulsing
                      ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse font-black'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Incoming Truck Queue Cards */}
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-270px)] pr-1">
            {filteredTokens.length === 0 ? (
              <div className="bg-white border border-slate-300 rounded-2xl p-8 text-center text-slate-500 text-xs shadow-xs">
                <Truck className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="font-bold text-slate-700">No trucks currently queued for {activeMandi.name}</p>
                <p className="text-[11px] mt-1 text-slate-500">
                  Use the Farmer Registry to generate test tokens or switch mandis via the Transfer button.
                </p>
              </div>
            ) : (
              filteredTokens.map((tok) => {
                const isSelected = selectedToken && (selectedToken.tokenNumber || selectedToken.id) === (tok.tokenNumber || tok.id);
                const norm = normalizeStatus(tok.status);
                const isDone = norm === TOKEN_STATUS.COMPLETED;
                const isTokExitReq = norm === TOKEN_STATUS.GATE_EXIT_REQUESTED;
                const isTokCancelled = norm === TOKEN_STATUS.CANCELLED;
                const tokStages = Array.isArray(tok.stages) ? tok.stages : [];
                const doneCount = tokStages.filter((s) => (s.status || '').toLowerCase() === 'completed').length;


                return (
                  <div
                    key={tok.tokenNumber || tok.id}
                    onClick={() => {
                      setSelectedToken(tok);
                      if (isTokExitReq) setActiveDeskTab(0);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isTokExitReq
                        ? isSelected
                          ? 'bg-rose-50 border-rose-500 shadow-md ring-2 ring-rose-400'
                          : 'bg-rose-50/60 border-rose-300 hover:border-rose-400'
                        : isSelected
                        ? 'bg-emerald-50/70 border-[#047857] shadow-md ring-2 ring-emerald-500/40'
                        : 'bg-white border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs text-[#0B1E3B]">
                          {tok.tokenNumber || tok.id}
                        </span>
                        {isTokExitReq ? (
                          <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse flex items-center gap-1">
                            🚨 Exit Req
                          </span>
                        ) : isTokCancelled ? (
                          <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                            ✕ Cancelled
                          </span>
                        ) : isDone ? (
                          <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✓ Done
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            Stage {doneCount + 1}/5
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {tok.slotDate || 'Today'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-700 mb-1.5">
                      <span className="font-bold text-[#0B1E3B] truncate">{tok.farmerName || 'Farmer'}</span>
                      <span className="text-emerald-800 font-bold">{tok.crop} · {tok.quantityBand || `${tok.quantity} Qtl`}</span>
                    </div>

                    {/* Mini Stage Progress bar */}
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const isStageDone = idx < doneCount;
                        return (
                          <div
                            key={idx}
                            className={`flex-1 h-1.5 rounded-full transition-all ${
                              isTokCancelled
                                ? 'bg-rose-200'
                                : isStageDone
                                ? 'bg-[#047857]'
                                : 'bg-slate-200'
                            }`}
                          />
                        );
                      })}
                      <span className="text-[9px] font-mono text-slate-500 ml-1">
                        {isTokCancelled ? 'Cancelled' : `${doneCount}/5`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── Right Work Desk: Specialized Role HUDs (8 Cols) ─────────────────── */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          {selectedToken ? (
            <>
              {/* ── Procurement Manifest Header Card ─────────────────────────── */}
              <div className="bg-white border border-slate-300 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-black uppercase tracking-wider text-[#047857] flex items-center gap-1">
                        <BadgeCheck className="w-4 h-4" />
                        Government Physical Intake Manifest
                      </span>
                      <span className="text-[10px] text-slate-400">·</span>
                      <span className="text-[11px] font-mono text-slate-600">{selectedToken.slotLabel || selectedToken.slotTime}</span>
                    </div>
                    <h2 className="text-2xl font-black text-[#0B1E3B] font-mono tracking-tight flex items-center gap-2">
                      <span>{selectedToken.tokenNumber || selectedToken.id}</span>
                      {isExitRequested ? (
                        <span className="text-xs font-black tracking-normal px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                          🚨 EXIT REQUESTED
                        </span>
                      ) : isCancelled ? (
                        <span className="text-xs font-black tracking-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300">
                          CANCELLED (FEE: ₹{selectedToken.cancellationFee || 0})
                        </span>
                      ) : isTokenCompleted ? (
                        <span className="text-xs font-black tracking-normal px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                          COMPLETED
                        </span>
                      ) : null}
                    </h2>
                  </div>

                  {/* Mandi & Station Badge */}
                  <div className="bg-[#F8FAFC] border border-slate-300 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#047857] flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-500">APMC Procurement Center</p>
                      <p className="text-xs font-black text-[#0B1E3B]">{selectedToken.mandiName || activeMandi.name}</p>
                    </div>
                  </div>
                </div>

                {/* Farmer Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                  <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-2.5">
                    <p className="text-[9px] uppercase font-bold text-slate-500">Citizen Farmer</p>
                    <p className="text-xs font-black text-[#0B1E3B] mt-0.5 truncate">{selectedToken?.farmerName || 'Citizen Farmer'}</p>
                  </div>
                  <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-2.5">
                    <p className="text-[9px] uppercase font-bold text-slate-500">Contact Number</p>
                    <p className="text-xs font-mono font-bold text-[#047857] mt-0.5">+91 {selectedToken?.farmerPhone || selectedToken?.phone || '9876543210'}</p>
                  </div>
                  <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-2.5">
                    <p className="text-[9px] uppercase font-bold text-slate-500">Commodity</p>
                    <p className="text-xs font-bold text-[#0B1E3B] mt-0.5">{selectedToken?.crop || 'Soybean'}</p>
                  </div>
                  <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-2.5">
                    <p className="text-[9px] uppercase font-bold text-slate-500">Declared Volume</p>
                    <p className="text-xs font-bold text-[#0B1E3B] mt-0.5">{selectedToken?.quantityBand || `${selectedToken?.quantity || 25} Quintals`}</p>
                  </div>
                </div>

                {/* 5-Stage Stepper Bar */}
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                    <span className="font-bold text-[#0B1E3B]">Checkpoint Verification & Sign-Offs</span>
                    <span className="font-mono text-[#047857] font-bold">{completedCount}/5 Verified</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {DESK_CONFIGS.map((desk, idx) => {
                      const stg = stages.find((s) => s.id === desk.id || s.stageIndex === idx);
                      const isDone = (stg?.status || '').toLowerCase() === 'completed';
                      const isSelectedDesk = activeDeskTab === idx;
                      const isActionable = idx === currentActionableStageIndex;
                      const isLocked = idx > currentActionableStageIndex;

                      return (
                        <button
                          key={desk.id}
                          type="button"
                          onClick={() => setActiveDeskTab(idx)}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                            isDone
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                              : isSelectedDesk
                              ? 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-400/40'
                              : isActionable
                              ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs ring-1 ring-blue-300'
                              : 'bg-[#F8FAFC] border-slate-200 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[9px] font-black font-mono">DESK {idx + 1}</span>
                            {isDone ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            ) : isActionable ? (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                              </span>
                            ) : (
                              <Lock className="w-2.5 h-2.5 text-slate-400" />
                            )}
                          </div>
                          <div className="text-[10px] font-bold truncate leading-tight">
                            {desk.shortName}
                          </div>
                          <div className="text-[8px] font-mono mt-0.5 text-slate-500 truncate">
                            {isDone ? '✓ Certified' : isActionable ? '● Next in Queue' : '🔒 Locked'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── ACTIVE SPECIALIZED ROLE HUD ──────────────────────────────── */}
              <div className="bg-white border border-slate-300 rounded-2xl p-5 shadow-xs">
                
                {/* HUD Header */}
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#047857] border border-emerald-300 flex items-center justify-center">
                      {React.createElement(DESK_CONFIGS[activeDeskTab].icon, { className: 'w-5 h-5' })}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-[#0B1E3B]">
                        {DESK_CONFIGS[activeDeskTab].title}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Assigned Station: <strong className="text-slate-900">{DESK_CONFIGS[activeDeskTab].terminalLane}</strong> · Officer: <strong className="font-mono text-[#047857]">{staffSession.officerCode}</strong>
                      </p>
                    </div>
                  </div>

                  {stages[activeDeskTab] && (stages[activeDeskTab].status || '').toLowerCase() === 'completed' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Stage Certified
                    </span>
                  )}
                </div>

                {/* Read-Only Station Access Locked Warning */}
                {!isCurrentDeskAuthorized && (
                  <div className="mb-4 p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-200/80 flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4 text-amber-800" />
                      </div>
                      <div>
                        <span className="font-extrabold text-amber-900">Station Read-Only Telemetry Mode</span>
                        <p className="text-amber-800 mt-0.5">
                          You are signed in as <strong>{staffSession.name || 'Officer'}</strong> ({staffSession.roleLabel || staffSession.role}). Modifications at <strong>{DESK_CONFIGS[activeDeskTab].shortName}</strong> are restricted to authorized personnel.
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-black bg-amber-200 text-amber-900 px-2.5 py-1 rounded-md shrink-0 border border-amber-300 self-start sm:self-auto">
                      READ-ONLY
                    </span>
                  </div>
                )}

                {/* Prerequisite Pending Warning */}
                {isCurrentDeskAuthorized && !isPrerequisiteMet && (
                  <div className="mb-4 p-4 rounded-xl bg-slate-100 border-2 border-slate-300 text-slate-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4 text-slate-700" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900">🔒 Prerequisite Pending: Stage Locked</span>
                        <p className="text-slate-600 mt-0.5">
                          Awaiting sign-off and physical certification from <strong>{prevDesk?.shortName || `Desk ${activeDeskTab}`}</strong> (Desk {activeDeskTab}) before this station can process the load.
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md shrink-0 border border-slate-300 self-start sm:self-auto">
                      AWAITING TURN
                    </span>
                  </div>
                )}


                {/* ── HUD 1: SECURITY GATE OFFICER (ANPR, BOOM BARRIER & THROTTLE) ─ */}
                {activeDeskTab === 0 && (
                  <div className="space-y-4">
                    
                    {/* Live Lane Metering / Throttle Mode Alert */}
                    {isYardThrottled && (
                      <div className="p-3 bg-amber-500/10 border-2 border-amber-500 rounded-xl flex items-center gap-3 text-amber-900">
                        <Flame className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
                        <div className="flex-1">
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                            🚨 THROTTLE MODE ACTIVE - HOLD INCOMING TRACTORS AT OUTER BAY
                          </h4>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Yard capacity near threshold ({activeYardTrucksCount} vehicles in queue). Algorithmic gate metering rate-limiting arrival to 3.8 min/truck to eliminate highway spillover.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Exit Mediation Request if present */}
                    {isExitRequested ? (
                      <div className="bg-rose-50 border-2 border-rose-400 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-300 text-rose-700 flex items-center justify-center shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xs font-black text-rose-900 uppercase tracking-wide">
                              🚨 Officer Mediation: Yard Exit & Produce Rejection Clearance
                            </h4>
                            <p className="text-xs text-slate-700 mt-0.5">
                              Vehicle <strong>#{selectedToken.tokenNumber || selectedToken.id}</strong> requested exit clearance. Reason: <em className="text-rose-900 font-semibold">"{selectedToken.cancellationReason || 'Produce rejection'}"</em>
                            </p>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-300 rounded-xl p-3 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                              Yard Clearance Fee (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="500"
                              value={exitPenalty}
                              onChange={(e) => setExitPenalty(Number(e.target.value))}
                              className="w-full bg-[#F8FAFC] border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-[#0B1E3B]"
                            />
                            <span className="text-[9px] text-slate-500 mt-0.5 block">Default fee: ₹150 for gate boom barrier release.</span>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                              Clearance Remarks
                            </label>
                            <input
                              type="text"
                              value={exitOfficerReason}
                              onChange={(e) => setExitOfficerReason(e.target.value)}
                              className="w-full bg-[#F8FAFC] border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-[#0B1E3B]"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isApprovingExit}
                          onClick={handleApproveGateExit}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-700 to-amber-700 hover:from-rose-800 hover:to-amber-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
                        >
                          <DoorOpen className="w-4 h-4" />
                          <span>{isApprovingExit ? 'Authorizing & Raising Barrier…' : `Authorize Gate Exit & Open Boom Barrier (Apply ₹${exitPenalty} Penalty)`}</span>
                        </button>
                      </div>
                    ) : null}

                    {/* ANPR Camera Feed Scanner & Boom Barrier Visualizer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* ANPR Camera Scanner HUD */}
                      <div className="bg-[#F8FAFC] border border-slate-300 rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-[#0B1E3B] flex items-center gap-1">
                              <Camera className="w-3.5 h-3.5 text-[#047857]" />
                              <span>ANPR Fast-Scan Camera Feed</span>
                            </span>
                            <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                              OCR 99.4% CONFIDENCE
                            </span>
                          </div>

                          {/* Optical Reticle Box */}
                          <div className="bg-slate-950 text-white rounded-lg p-3 relative font-mono text-xs overflow-hidden border border-slate-800 mb-2">
                            <div className="flex items-center justify-between text-[10px] text-emerald-400 mb-1">
                              <span>CAM-01 [NORTH GATE]</span>
                              <span className="animate-pulse">● LIVE OCR</span>
                            </div>
                            <div className="text-center py-2">
                              <span className="text-lg font-black tracking-widest text-amber-300 bg-slate-900 px-3 py-1 rounded border border-amber-500/50">
                                {anprPlateInput}
                              </span>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                              <span>Vehicle: Swaraj 855 FE Tractor</span>
                              <span>Target: #{selectedToken.tokenNumber || selectedToken.id}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSimulateAnprSnap}
                            disabled={isAnprScanning}
                            className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{isAnprScanning ? 'Snapping Plate…' : 'Snap ANPR Camera'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Interactive Boom Barrier Visualizer */}
                      <div className="bg-[#F8FAFC] border border-slate-300 rounded-xl p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#0B1E3B]">Physical Boom Barrier Status</span>
                          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                            boomBarrierOpen
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {boomBarrierOpen ? 'BARRIER LIFTED 🟢' : 'BARRIER LOCKED 🔴'}
                          </span>
                        </div>

                        {/* Animated Gate Barrier Visualizer */}
                        <div className="my-2 py-4 px-4 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between relative overflow-hidden">
                          <div className="w-4 h-12 bg-slate-600 rounded-xs z-10" />
                          <div className={`h-2 flex-1 mx-2 rounded-full transition-all duration-700 ${
                            boomBarrierOpen ? 'bg-emerald-400 rotate-[-40deg] origin-left shadow-lg shadow-emerald-500/50' : 'bg-rose-500 shadow-lg shadow-rose-500/50'
                          }`} />
                          <div className="w-4 h-12 bg-slate-600 rounded-xs z-10" />
                        </div>

                        <button
                          type="button"
                          onClick={() => setBoomBarrierOpen(!boomBarrierOpen)}
                          className="text-[11px] font-bold text-slate-600 hover:text-[#0B1E3B] underline text-right cursor-pointer"
                        >
                          Manual Barrier Override ({boomBarrierOpen ? 'Lower' : 'Raise'})
                        </button>
                      </div>
                    </div>

                    {!isExitRequested && !isCancelled && (
                      <button
                        type="button"
                        disabled={!isCurrentDeskAuthorized || isProcessing || isStageAlreadyCertified}
                        onClick={() => handleExecuteStageAction(DESK_CONFIGS[0])}
                        className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                          !isCurrentDeskAuthorized
                            ? 'bg-slate-300 text-slate-600 cursor-not-allowed border border-slate-300'
                            : isStageAlreadyCertified
                            ? 'bg-emerald-800 text-white cursor-default'
                            : 'bg-[#047857] hover:bg-[#065f46] text-white'
                        }`}
                      >
                        <ScanLine className="w-5 h-5" />
                        <span>
                          {!isCurrentDeskAuthorized
                            ? `🔒 Station Read-Only (Restricted to ${DESK_CONFIGS[0].shortName})`
                            : isStageAlreadyCertified
                            ? '✓ Gate Check-In Already Certified'
                            : DESK_CONFIGS[0].actionLabel}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* ── HUD 2: QUALITY ASSAYER (FAQ PRESETS & AUTO-GRADING) ───────── */}
                {activeDeskTab === 1 && (
                  <div className="space-y-4">
                    
                    {/* Maharashtra Fair Average Quality (FAQ) Standard Presets Banner */}
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[#0B1E3B] flex items-center gap-1.5">
                          <Leaf className="w-4 h-4 text-[#047857]" />
                          <span>Maharashtra Statutory FAQ Standard: <strong>{currentCrop}</strong></span>
                        </span>
                        <span className="font-mono font-bold text-[#047857] bg-white px-2 py-0.5 rounded border border-emerald-300 text-[10px]">
                          {currentFaqSpec.faqBand}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{currentFaqSpec.toleranceNote}</p>
                    </div>

                    {/* Quality Parameter Sliders */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Moisture Content Slider */}
                      <div className="bg-[#F8FAFC] border border-slate-300 rounded-xl p-3.5">
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-xs font-bold text-[#0B1E3B]">Moisture Content (%)</label>
                          <span className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                            moisture <= currentFaqSpec.maxMoisture ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {moisture}% ({moisture <= currentFaqSpec.maxMoisture ? 'Optimal' : 'Excess Moisture'})
                          </span>
                        </div>
                        <input
                          type="range"
                          min="7"
                          max="18"
                          step="0.1"
                          value={moisture}
                          disabled={!isCurrentDeskAuthorized || !isPrerequisiteMet}
                          onChange={(e) => setMoisture(Number(e.target.value))}
                          className="w-full h-2 bg-slate-300 rounded-full appearance-none accent-[#047857] cursor-pointer disabled:opacity-50"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>7% (Dry)</span>
                          <span className="text-[#047857] font-bold">{currentFaqSpec.maxMoisture}% FAQ Ceiling</span>
                          <span>18% (Wet)</span>
                        </div>
                      </div>

                      {/* Foreign Matter / Impurities */}
                      <div className="bg-[#F8FAFC] border border-slate-300 rounded-xl p-3.5">
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-xs font-bold text-[#0B1E3B]">Foreign Matter & Impurities (%)</label>
                          <span className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                            foreignMatter <= currentFaqSpec.maxForeignMatter ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {foreignMatter}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="6"
                          step="0.1"
                          value={foreignMatter}
                          disabled={!isCurrentDeskAuthorized || !isPrerequisiteMet}
                          onChange={(e) => setForeignMatter(Number(e.target.value))}
                          className="w-full h-2 bg-slate-300 rounded-full appearance-none accent-[#047857] cursor-pointer disabled:opacity-50"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>0.0% (Clean)</span>
                          <span className="text-[#047857] font-bold">{currentFaqSpec.maxForeignMatter}% Max Tolerance</span>
                          <span>6.0% (High Impurity)</span>
                        </div>
                      </div>
                    </div>

                    {/* Algorithmic Grade Output & Cryptographic Hash */}
                    <div className="p-4 rounded-xl border border-slate-300 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold flex items-center gap-1">
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Algorithmic Grade Certification</span>
                        </div>
                        <div className="text-lg font-black text-white mt-0.5">
                          {autoCalculatedGrade.grade} — <span className="text-amber-300">{autoCalculatedGrade.bonus}</span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                          Immutable Hash: <strong className="text-emerald-300">{qaCertHash}</strong>
                        </p>
                      </div>

                      <span className={`text-xs font-black px-3 py-1.5 rounded-xl border text-center ${autoCalculatedGrade.badgeColor}`}>
                        APMC Act 1963 Sec 29 Certified
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!isCurrentDeskAuthorized || !isPrerequisiteMet || isProcessing || isStageAlreadyCertified}
                      onClick={() => handleExecuteStageAction(DESK_CONFIGS[1])}
                      className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                        !isCurrentDeskAuthorized
                          ? 'bg-slate-300 text-slate-600 cursor-not-allowed border border-slate-300'
                          : !isPrerequisiteMet
                          ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 cursor-not-allowed'
                          : isStageAlreadyCertified
                          ? 'bg-emerald-800 text-white cursor-default'
                          : 'bg-[#047857] hover:bg-[#065f46] text-white'
                      }`}
                    >
                      <Leaf className="w-5 h-5" />
                      <span>
                        {!isCurrentDeskAuthorized
                          ? `🔒 Station Read-Only (Restricted to ${DESK_CONFIGS[1].shortName})`
                          : !isPrerequisiteMet
                          ? `🔒 Prerequisite Pending (Awaiting ${prevDesk?.shortName || 'Gate Check-In'})`
                          : isStageAlreadyCertified
                          ? '✓ Quality Grade Already Certified'
                          : `${DESK_CONFIGS[1].actionLabel} (${autoCalculatedGrade.grade})`}
                      </span>
                    </button>
                  </div>
                )}

                {/* ── HUD 3: WEIGHMASTER (DIGITAL TELEMETRY & LOAD STABILIZATION) ─ */}
                {activeDeskTab === 2 && (
                  <div className="space-y-4">
                    
                    {/* Calibrated Digital Load Cell Terminal Box */}
                    <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-white shadow-2xl relative overflow-hidden">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Scale className="w-5 h-5 text-emerald-400" />
                          <div>
                            <span className="text-xs font-black text-white block">Digital Load Cell Telemetry Terminal</span>
                            <span className="text-[10px] font-mono text-slate-400">Sensor ID: PIT-WB-01 · 60 MT Capacity</span>
                          </div>
                        </div>

                        {/* Stabilization Status Indicator */}
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                          isScaleFluctuating
                            ? 'bg-amber-950 text-amber-300 border-amber-500 animate-pulse'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-400'
                        }`}>
                          <span>{isScaleFluctuating ? '⚡ MEASURING...' : '⚖️ LOAD STABILIZED (±0 kg)'}</span>
                        </div>
                      </div>

                      {/* Giant Digital Readout */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center my-2 shadow-inner">
                        <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">Live Calibrated Telemetry</div>
                        <div className="text-4xl sm:text-5xl font-black font-mono tracking-wider text-emerald-400">
                          {simulatedFluctuatingKg.toLocaleString('en-IN')} <span className="text-xl text-slate-400">kg</span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-1">
                          ≈ {(simulatedFluctuatingKg / 1000).toFixed(2)} Metric Tonnes
                        </div>
                      </div>

                      {/* 1-Click Load Cell Lock Action Buttons */}
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <button
                          type="button"
                          disabled={!isCurrentDeskAuthorized || !isPrerequisiteMet}
                          onClick={handleLockGrossFromScale}
                          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Lock className="w-4 h-4" />
                          <span>🔒 Lock Gross Weight ({grossWeightMT} MT)</span>
                        </button>

                        <button
                          type="button"
                          disabled={!isCurrentDeskAuthorized || !isPrerequisiteMet}
                          onClick={handleLockTareFromScale}
                          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Lock className="w-4 h-4" />
                          <span>🔒 Lock Tare Weight ({tareWeightMT} MT)</span>
                        </button>
                      </div>
                    </div>

                    {/* Weight Breakdown Summary Cards */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-[#F8FAFC] border border-slate-300 rounded-xl p-3">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Gross (Loaded)</div>
                        <div className="text-base font-black font-mono text-[#0B1E3B]">{grossWeightMT} MT</div>
                      </div>
                      <div className="bg-[#F8FAFC] border border-slate-300 rounded-xl p-3">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Tare (Empty)</div>
                        <div className="text-base font-black font-mono text-[#0B1E3B]">{tareWeightMT} MT</div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-400 rounded-xl p-3">
                        <div className="text-[10px] uppercase font-bold text-emerald-800">Net Produce</div>
                        <div className="text-base font-black font-mono text-[#047857]">{netProduceMT} MT ({netProduceQtl} Qtl)</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!isCurrentDeskAuthorized || !isPrerequisiteMet || isProcessing || isStageAlreadyCertified}
                      onClick={() => handleExecuteStageAction(DESK_CONFIGS[2])}
                      className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                        !isCurrentDeskAuthorized
                          ? 'bg-slate-300 text-slate-600 cursor-not-allowed border border-slate-300'
                          : !isPrerequisiteMet
                          ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 cursor-not-allowed'
                          : isStageAlreadyCertified
                          ? 'bg-emerald-800 text-white cursor-default'
                          : 'bg-[#047857] hover:bg-[#065f46] text-white'
                      }`}
                    >
                      <Scale className="w-5 h-5" />
                      <span>
                        {!isCurrentDeskAuthorized
                          ? `🔒 Station Read-Only (Restricted to ${DESK_CONFIGS[2].shortName})`
                          : !isPrerequisiteMet
                          ? `🔒 Prerequisite Pending (Awaiting ${prevDesk?.shortName || 'Assaying Lab'})`
                          : isStageAlreadyCertified
                          ? '✓ Weights Already Calibrated & Locked'
                          : `${DESK_CONFIGS[2].actionLabel} (${netProduceQtl} Qtl)`}
                      </span>
                    </button>
                  </div>
                )}

                {/* ── HUD 4: PROCUREMENT PURCHASE ORDER BILL ──────────────────── */}
                {activeDeskTab === 3 && (
                  <div className="space-y-4">
                    <div className="bg-[#F8FAFC] border border-slate-300 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-[#0B1E3B] uppercase tracking-wide mb-3">
                        Procurement Bill & Statutory Price Calculation ({activeMandi.name})
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-slate-200">
                          <span className="text-slate-600">Commodity & Grade:</span>
                          <span className="font-bold text-[#0B1E3B]">{selectedToken?.crop || 'Soybean'} · {autoCalculatedGrade?.grade || 'Grade A FAQ'}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-200">
                          <span className="text-slate-600">Certified Net Weight:</span>
                          <span className="font-mono font-bold text-[#0B1E3B]">{netProduceQtl} Quintals ({netProduceMT} MT)</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-200">
                          <span className="text-slate-600">Applicable Procurement Rate ({activeMandi.code}):</span>
                          <span className="font-mono font-bold text-[#047857]">₹{cropPricePerQtl.toLocaleString('en-IN')}/Qtl</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-sm font-black text-[#0B1E3B]">Total Purchase Order Value:</span>
                          <span className="text-xl font-black font-mono text-[#047857]">
                            ₹{totalCalculatedAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!isCurrentDeskAuthorized || !isPrerequisiteMet || isProcessing || isStageAlreadyCertified}
                      onClick={() => handleExecuteStageAction(DESK_CONFIGS[3])}
                      className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                        !isCurrentDeskAuthorized
                          ? 'bg-slate-300 text-slate-600 cursor-not-allowed border border-slate-300'
                          : !isPrerequisiteMet
                          ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 cursor-not-allowed'
                          : isStageAlreadyCertified
                          ? 'bg-emerald-800 text-white cursor-default'
                          : 'bg-[#047857] hover:bg-[#065f46] text-white'
                      }`}
                    >
                      <FileText className="w-5 h-5" />
                      <span>
                        {!isCurrentDeskAuthorized
                          ? `🔒 Station Read-Only (Restricted to ${DESK_CONFIGS[3].shortName})`
                          : !isPrerequisiteMet
                          ? `🔒 Prerequisite Pending (Awaiting ${prevDesk?.shortName || 'Weighbridge'})`
                          : isStageAlreadyCertified
                          ? '✓ Purchase Order Already Authorized'
                          : `${DESK_CONFIGS[3].actionLabel} (₹${totalCalculatedAmount.toLocaleString('en-IN')})`}
                      </span>
                    </button>
                  </div>
                )}

                {/* ── HUD 5: TREASURY & AUTO-DEDUCTION DBT DISBURSEMENT ───────── */}
                {activeDeskTab === 4 && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50/50 border border-emerald-300 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Banknote className="w-5 h-5 text-[#047857]" />
                          <h4 className="text-sm font-black text-[#0B1E3B]">Direct Bank Transfer (DBT) & Auto-Deduction Engine</h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          PFMS / APB Bridge
                        </span>
                      </div>

                      {/* Itemized Payout Breakdown with Dues Auto-Deduction */}
                      <div className="bg-white rounded-xl p-3.5 border border-slate-300 mb-3 space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Gross Purchase Order Amount:</span>
                          <span className="font-mono font-bold text-[#0B1E3B]">
                            ₹{totalCalculatedAmount.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {farmerPendingDues > 0 ? (
                          <div className="flex justify-between items-center text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-300">
                            <span className="flex items-center gap-1.5 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>Less Unsettled Cancellation Penalties (Auto-Recovered):</span>
                            </span>
                            <span className="font-mono font-black text-rose-700">
                              -₹{farmerPendingDues.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center text-slate-500">
                            <span>Outstanding Cancellation Penalties:</span>
                            <span className="font-mono font-bold text-[#047857]">₹0 (Clean Profile)</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                          <span className="text-sm font-black text-[#0B1E3B]">Net Direct Bank Transfer Payout:</span>
                          <span className="text-2xl font-black font-mono text-[#047857]">
                            ₹{netDbtPayout.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs mb-3">
                        <div className="bg-white rounded-lg p-2.5 border border-slate-300">
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Beneficiary Account</p>
                          <p className="font-bold text-[#0B1E3B] mt-0.5">{selectedToken.farmerName || 'Citizen Farmer'}</p>
                          <p className="text-[11px] font-mono text-slate-600 mt-0.5">State Bank of India ······4102</p>
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-300">
                          <p className="text-[9px] text-slate-500 font-bold uppercase">DBT Protocol Bridge</p>
                          <p className="font-bold text-[#047857] mt-0.5">Public Financial Mgmt System (PFMS)</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Aadhaar Payment Bridge (APB)</p>
                        </div>
                      </div>

                      <div className="p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-lg text-xs text-emerald-950 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-[#047857]">Single Active Token Release Trigger</p>
                          <p className="text-[11px] mt-0.5 leading-snug">
                            Executing disbursement will pay net <strong>₹{netDbtPayout.toLocaleString('en-IN')}</strong>, finalize token #{selectedToken.tokenNumber || selectedToken.id} as <strong>Completed</strong>, clear dues, and immediately unlock the farmer's account to book new delivery slots!
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!isCurrentDeskAuthorized || !isPrerequisiteMet || isProcessing || isStageAlreadyCertified}
                      onClick={() => handleExecuteStageAction(DESK_CONFIGS[4])}
                      className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                        !isCurrentDeskAuthorized
                          ? 'bg-slate-300 text-slate-600 cursor-not-allowed border border-slate-300'
                          : !isPrerequisiteMet
                          ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 cursor-not-allowed'
                          : isStageAlreadyCertified
                          ? 'bg-emerald-800 text-white cursor-default'
                          : 'bg-[#047857] hover:bg-[#065f46] text-white'
                      }`}
                    >
                      <Banknote className="w-5 h-5" />
                      <span>
                        {!isCurrentDeskAuthorized
                          ? `🔒 Station Read-Only (Restricted to ${DESK_CONFIGS[4].shortName})`
                          : !isPrerequisiteMet
                          ? `🔒 Prerequisite Pending (Awaiting ${prevDesk?.shortName || 'Procurement Desk'})`
                          : isStageAlreadyCertified
                          ? '✓ DBT Disbursement Finalized & Completed'
                          : `${DESK_CONFIGS[4].actionLabel} (Net ₹${netDbtPayout.toLocaleString('en-IN')})`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="bg-white border border-slate-300 rounded-2xl p-16 text-center shadow-xs">
              <Truck className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <h3 className="text-base font-bold text-slate-800">No Truck Manifest Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Select a token from the incoming queue on the left or use the Farmer Registry to generate test tokens for {activeMandi.name}.
              </p>
            </div>
          )}
        </section>

      </main>

      {/* ── 4. CROSS-CENTER FLOATING & EMERGENCY TRANSFER MODAL ─────────────── */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col">
            <div className="bg-[#0B1E3B] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ArrowLeftRight className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-black text-white">Cross-Center Floating & Emergency Duty Transfer</h3>
                  <p className="text-xs text-slate-300">Re-wire your active shift dispatch to cover another regional procurement yard</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950">
                <p className="font-bold">Active Duty Session: {activeMandi.name} ({staffSession.dutyToken})</p>
                <p className="text-[11px] mt-0.5">
                  Transferring will disconnect from {activeMandi.name}'s Socket.IO channel, subscribe to the new center's queue, and issue an updated shift duty pass.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#0B1E3B] uppercase">Select Target Mandi Center</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MANDIS.map((m) => {
                    const isCurrent = m.id === activeMandiId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleExecuteEmergencyTransfer(m.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-50 border-[#047857] ring-2 ring-emerald-500/30'
                            : 'bg-[#F8FAFC] border-slate-300 hover:border-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#0B1E3B]">{m.name}</span>
                            <span className="text-[9px] font-mono font-bold bg-slate-200 px-1.5 py-0.2 rounded text-slate-700">
                              {m.id}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{m.location}</p>
                        </div>
                        <div className="mt-2 text-[10px] font-bold text-[#047857] flex items-center justify-between">
                          <span>{isCurrent ? '● Active Assignment' : '⇄ Transfer Duty Here'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Farmer Management & Database Reset Modal ──────────────────────── */}
      {showFarmerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-[#0B1E3B] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-black text-white">APMC Citizen Farmer Registry & Provisioning</h3>
                  <p className="text-xs text-slate-300">Inspect registered farmers, manually provision profiles, or reset demo database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFarmerModal(false)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setFarmerModalTab('list')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  farmerModalTab === 'list'
                    ? 'border-[#047857] text-[#047857]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Farmer Directory ({registeredFarmers.length})
              </button>
              <button
                type="button"
                onClick={() => setFarmerModalTab('create')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  farmerModalTab === 'create'
                    ? 'border-[#047857] text-[#047857]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                + Manual Farmer Registration
              </button>
              <button
                type="button"
                onClick={() => setFarmerModalTab('reset')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all ml-auto cursor-pointer ${
                  farmerModalTab === 'reset'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-rose-700 hover:text-rose-900'
                }`}
              >
                ⚠️ Database Reset & Purge
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              
              {/* TAB 1: FARMER DIRECTORY */}
              {farmerModalTab === 'list' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search by Name, Mobile, Village, or Crop…"
                        value={farmerSearchQuery}
                        onChange={(e) => setFarmerSearchQuery(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-sans"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={loadFarmers}
                      className="p-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                      title="Reload Farmers"
                    >
                      <RefreshCw className={`w-4 h-4 ${isFetchingFarmers ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {filteredFarmers.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No farmer found. Use the "Manual Farmer Registration" tab to add one.
                      </div>
                    ) : (
                      filteredFarmers.map((f) => {
                        const hasActiveToken = Boolean(f.activeToken);
                        const hasDues = (f.pendingDues || 0) > 0;

                        return (
                          <div
                            key={f.phone}
                            className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-[#0B1E3B]">{f.name}</span>
                                <span className="font-mono text-xs text-slate-600 font-semibold">+91 {f.phone}</span>
                                {hasDues ? (
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.2 rounded border border-amber-300">
                                    Dues: ₹{f.pendingDues}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded">
                                    Dues: ₹0
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                📍 {f.village || 'Kopargaon'} · Crop: <strong>{f.crop || 'Soybean'}</strong> · Land: <strong>{f.landArea || 2.5} Acres</strong> · Kisan ID: <span className="font-mono">{f.kisanId || 'MH-AGRI-001'}</span>
                              </p>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {hasActiveToken ? (
                                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                                  Active Token #{f.activeToken?.tokenNumber || 'KQ-ACTIVE'}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleBookTestSlot(f)}
                                  className="px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs shadow-xs cursor-pointer"
                                >
                                  Book Slot ({activeMandi.code || 'KPG'})
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: MANUAL FARMER REGISTRATION */}
              {farmerModalTab === 'create' && (
                <form onSubmit={handleCreateFarmer} className="space-y-4 max-w-lg mx-auto">
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs text-emerald-950">
                    <p className="font-bold">Citizen Farmer Provisioning</p>
                    <p className="text-[11px] mt-0.5">
                      Register a farmer into the APMC Digital Registry. Once created, slots can be booked for this mobile number under any target APMC Mandi.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1E3B] mb-1">Farmer Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Balasaheb Vikhe Patil"
                      value={newFarmerName}
                      onChange={(e) => setNewFarmerName(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1E3B] mb-1">10-Digit Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      maxLength="10"
                      placeholder="e.g. 9822001122"
                      value={newFarmerPhone}
                      onChange={(e) => setNewFarmerPhone(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#0B1E3B] mb-1">Village / Location</label>
                      <input
                        type="text"
                        placeholder="e.g. Loni / Rahata"
                        value={newFarmerVillage}
                        onChange={(e) => setNewFarmerVillage(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3.5 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0B1E3B] mb-1">Primary Produce / Crop</label>
                      <select
                        value={newFarmerCrop}
                        onChange={(e) => setNewFarmerCrop(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold"
                      >
                        <option value="Soybean">Soybean</option>
                        <option value="Wheat">Wheat</option>
                        <option value="Onion">Onion</option>
                        <option value="Cotton">Cotton</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1E3B] mb-1">Cultivated Land Area (Acres)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="100"
                      value={newFarmerLandArea}
                      onChange={(e) => setNewFarmerLandArea(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingFarmer}
                    className="w-full py-3 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingFarmer ? 'Registering Citizen Farmer…' : 'Register Citizen Farmer Profile'}
                  </button>
                </form>
              )}

              {/* TAB 3: DATABASE RESET & PURGE */}
              {farmerModalTab === 'reset' && (
                <div className="space-y-4 max-w-lg mx-auto text-center">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-[#0B1E3B]">Database Purge & Demo Reset</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Wipes all operational tokens, queued trucks, and cancellation histories across MongoDB Atlas and in-memory caches. Re-seeds the 5 regional demo farmers with clean state (₹0 dues, no active locks).
                    </p>
                  </div>

                  <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-xs text-rose-900 text-left">
                    <p className="font-bold">What will happen:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-[11px]">
                      <li>All active and completed tokens in all 5 Mandis will be cleared.</li>
                      <li>Single-active-token locks will be lifted for all phone numbers.</li>
                      <li>All accumulated cancellation dues will be reset to ₹0.</li>
                      <li>5 standard demo farmers (Kopargaon, Shirdi, Rahata, Vaijapur, Shrirampur) will be ready.</li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={isResettingDb}
                    onClick={handleResetDatabase}
                    className="w-full py-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-black text-xs shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {isResettingDb ? 'Purging & Re-Seeding Database…' : '⚠️ Flush Database & Reset Demo Queues'}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── FAST-TRACK PRIORITY VERIFICATION MODAL ───────────────────────── */}
      {showFastTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white fill-white" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Fast-Track Priority Queue Reviews</h3>
                  <p className="text-xs text-amber-100 font-medium">
                    Statutory Floor Verified · Officer Approval moves Token to Queue Position #1
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFastTrackModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mandi & Quota Notice Bar */}
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <Building2 className="w-4 h-4 text-amber-700" />
                <span>Active Mandi: <strong>{activeMandi.name}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                  Pending: {fastTrackRequests.length} / 5 Max Concurrent
                </span>
                <button
                  type="button"
                  onClick={loadFastTrackRequests}
                  disabled={isFastTrackLoading}
                  className="p-1 hover:bg-amber-200/60 rounded text-amber-800 transition-colors"
                  title="Refresh Pending List"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFastTrackLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Request List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {fastTrackRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No Pending Fast-Track Requests</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    When farmers request fast-track priority for {activeMandi.name}, requests will appear here ranked by discount tier and submission time.
                  </p>
                </div>
              ) : (
                fastTrackRequests.map((req, idx) => {
                  const reqId = req._id || req.id;
                  const isActioning = actioningFastTrackId === reqId;
                  const isFloorValid = Number(req.discountedPrice) >= Number(req.mspPriceAtRequest);

                  return (
                    <div
                      key={reqId || idx}
                      className="bg-slate-50 border-2 border-slate-200 hover:border-amber-400 rounded-2xl p-4 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Left Details */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-300">
                              {req.tokenNumber}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 flex items-center gap-1">
                              <Zap className="w-3 h-3 fill-slate-950" />
                              Tier {req.tier}% Priority Discount
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {req.crop} · 📱 +91 {req.farmerPhone}
                            </span>
                          </div>

                          {/* Price Breakdown */}
                          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200 text-xs">
                            <div className="bg-white p-2 rounded-xl border border-slate-200">
                              <div className="text-[10px] text-slate-500 font-bold uppercase">Market Price</div>
                              <div className="font-black text-slate-800">₹{req.marketPriceAtRequest?.toLocaleString() || '—'}<span className="text-[10px] text-slate-500">/Qtl</span></div>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-slate-200">
                              <div className="text-[10px] text-slate-500 font-bold uppercase">Statutory MSP Floor</div>
                              <div className="font-black text-slate-800">₹{req.mspPriceAtRequest?.toLocaleString() || '—'}<span className="text-[10px] text-slate-500">/Qtl</span></div>
                            </div>
                            <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                              <div className="text-[10px] text-emerald-800 font-bold uppercase">Discounted Realization</div>
                              <div className="font-black text-emerald-900">₹{req.discountedPrice?.toLocaleString() || '—'}<span className="text-[10px] text-emerald-700">/Qtl</span></div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>Requested at: {new Date(req.requestedAt || req.createdAt || Date.now()).toLocaleTimeString()}</span>
                            {isFloorValid && (
                              <span className="text-emerald-700 font-bold flex items-center gap-1 ml-auto">
                                <Check className="w-3 h-3 text-emerald-600" /> MSP Floor Protected
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex sm:flex-col gap-2 shrink-0 justify-end">
                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() => handleApproveFastTrack(req)}
                            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>{isActioning ? 'Approving…' : 'Approve (Position #1)'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() => handleRejectFastTrack(req)}
                            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
              <span>* Fast-Track modifies gate/yard queue order only. All 5 quality & weighbridge verification desks remain mandatory.</span>
              <button
                type="button"
                onClick={() => setShowFastTrackModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

