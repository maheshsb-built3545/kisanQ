import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GovHeader from '../components/common/GovHeader';
import PickupLocationPicker from '../components/common/PickupLocationPicker';
import { pricesApi, fastTrackApi } from '../api';
import {

  MapPin, Clock, Zap, TrendingUp, TrendingDown, Minus,
  Ticket, CheckCircle2, Circle, Loader2, Printer,
  ChevronRight, X, ArrowRight, Building2, Leaf, Scale,
  FileText, Banknote, ShieldCheck, RefreshCw, LogOut,
  LayoutDashboard, AlertTriangle, Star, Navigation, Package,
  QrCode, Sparkles, Users, Activity, BadgeCheck, Receipt,
  ScanLine, Database, Server, Radio, Bell, CheckCircle,
  Lock, AlertCircle, PhoneCall, Trash2, Wallet, DollarSign,
  XCircle, History, Info, ExternalLink, Landmark, Shield,
  Mic, Volume2
} from 'lucide-react';
import {
  MANDIS, STAGE_DEFINITIONS, STORAGE_KEYS,
  initializeStorage, getTokens, getFarmerTokens, saveToken, updateTokenStage,
  saveTokenAsync, getTokensAsync, updateTokenStageAsync, checkBackendHealth,
  buildNewToken, addTokenToPipeline, getMandiQueueCount, generateTokenId,
  cancelTokenApi, requestGateExitApi, getFarmerProfileDuesApi,
  previewCancellationPenaltyApi
} from '../services/storageService';
import {
  getSocket, joinTokenRoom, joinMandiRoom, onStageUpdated,
  onNewBooking, onHardwareEvent, onAgriPoolMatch, onTokenCompleted,
  onTokenCancelled, onGateExitRequested, onExitApproved, onFarmerDuesUpdated, onQueueSlotFreed,
  onFastTrackApproved, onFastTrackRejected,
  subscribeConnectionStatus
} from '../services/socketService';
import {
  getFarmerCoordinates,
  calculateRealTimeTravel,
  calculateLeaveBy,
  calculateAllMandiDistances,
  DEFAULT_FARMER_COORDINATES
} from '../services/routingService';
import { TOKEN_STATUS, normalizeStatus, isTokenActive } from '../utils/statusEnums';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CROPS = ['Wheat', 'Soybean', 'Onion', 'Cotton'];
const SLOTS = [
  { id: 'S1', label: 'Morning  08:00 – 11:00 AM', start: '08:00', end: '11:00' },
  { id: 'S2', label: 'Midday   11:00 AM – 02:00 PM', start: '11:00', end: '14:00' },
  { id: 'S3', label: 'Afternoon 02:00 – 05:00 PM', start: '14:00', end: '17:00' },
];

function congestionColor(color) {
  if (color === 'red')   return { bar: 'bg-rose-500',   text: 'text-rose-400',   badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  if (color === 'amber') return { bar: 'bg-amber-400',  text: 'text-amber-400',  badge: 'bg-amber-400/15 text-amber-400 border-amber-400/30' };
  return                        { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
}

function fmtRate(val) {
  return `₹${val.toLocaleString('en-IN')}/Qtl`;
}

function rateChange(yesterday, today) {
  const diff = today - yesterday;
  if (diff > 0) return { label: `▲ +₹${diff}`, cls: 'text-emerald-500' };
  if (diff < 0) return { label: `▼ -₹${Math.abs(diff)}`, cls: 'text-rose-500' };
  return { label: `→ No change`, cls: 'text-slate-400' };
}

function stageIcon(iconKey, cls = 'w-4 h-4') {
  const map = {
    gate:     <ScanLine className={cls} />,
    leaf:     <Leaf className={cls} />,
    scale:    <Scale className={cls} />,
    document: <FileText className={cls} />,
    bank:     <Banknote className={cls} />,
  };
  return map[iconKey] || <Circle className={cls} />;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

function statusLabel(status) {
  const map = {
    BOOKED: 'Booked', GATE_IN: 'Gate In', INSPECTED: 'Inspected',
    WEIGHED: 'Weighed', PROCUREMENT: 'Procurement', COMPLETED: 'Completed',
  };
  return map[status] || status;
}

// ─── Official Indian Government Digital Verification Slip ────────────────────
function printStageReceipt({ token, stage }) {
  const win = window.open('', '_blank', 'width=650,height=800');
  const today = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
  win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>KisanQ Official Digital Verification Slip – ${token.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #0b1e3b; padding: 36px; line-height: 1.4; }
    .tricolor { height: 4px; background: linear-gradient(90deg, #FF9933 0%, #FF9933 33.3%, #FFFFFF 33.3%, #FFFFFF 66.6%, #138808 66.6%, #138808 100%); margin-bottom: 16px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0b1e3b; padding-bottom: 14px; margin-bottom: 18px; }
    .gov-title { font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .mandi-title { font-size: 20px; font-weight: 900; color: #0b1e3b; margin-top: 2px; }
    .sub-title { font-size: 12px; color: #047857; font-weight: 700; }
    .badge { background: #ecfdf5; color: #065f46; border: 1.5px solid #10b981; border-radius: 6px; padding: 4px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .token-id { font-size: 26px; font-weight: 900; color: #0b1e3b; letter-spacing: 1px; margin-bottom: 2px; font-family: monospace; }
    .section { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 14px; }
    .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0b1e3b; letter-spacing: 0.5px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .field label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; display: block; }
    .field value { font-size: 13px; font-weight: 700; color: #0f172a; display: block; margin-top: 2px; }
    .stage-completed { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; }
    .check { width: 26px; height: 26px; background: #047857; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 15px; font-weight: 900; flex-shrink: 0; }
    .sig-box { font-family: monospace; font-size: 11px; color: #065f46; background: #ffffff; border: 1px dashed #059669; border-radius: 6px; padding: 8px 12px; margin-top: 10px; }
    .footer { text-align: center; margin-top: 24px; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 14px; }
    .stamp { display: inline-block; border: 2px solid #047857; color: #047857; font-weight: 900; font-size: 16px; padding: 4px 14px; border-radius: 6px; letter-spacing: 1.5px; transform: rotate(-3deg); margin-top: 8px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="tricolor"></div>
  <div class="header">
    <div>
      <div class="gov-title">Government of Maharashtra · Department of Agricultural Marketing</div>
      <div class="mandi-title">${token.mandiName || 'APMC Mandi'}</div>
      <div class="sub-title">National Agriculture Market (e-NAM) Electronic Physical Slip</div>
    </div>
    <div class="badge">✓ Statutory Verified</div>
  </div>

  <div style="margin-bottom:16px;">
    <div class="token-id">TOKEN: ${token.id || token.tokenNumber}</div>
    <div style="font-size:12px;color:#475569;font-weight:600;">Slot Date: ${token.slotDate || 'Today'} &nbsp;|&nbsp; Schedule: ${token.slotLabel || 'Standard Slot'}</div>
  </div>

  <div class="section">
    <div class="section-title">Citizen Farmer Particulars</div>
    <div class="grid">
      <div class="field"><label>Farmer Name</label><value>${token.farmerName}</value></div>
      <div class="field"><label>Mobile / Aadhaar Ref</label><value>+91 ${token.phone}</value></div>
      <div class="field"><label>Commodity Intake</label><value>${token.crop}</value></div>
      <div class="field"><label>Declared Quantity</label><value>${token.quantityBand || token.quantity + ' Qtl'}</value></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Verified Checkpoint: ${stage.shortLabel || stage.name}</div>
    <div class="stage-completed">
      <div class="check">✓</div>
      <div>
        <div style="font-size:13px;font-weight:800;color:#065f46;">${stage.label || stage.name} Completed</div>
        <div style="font-size:11px;color:#475569;">Recorded at: ${today} &nbsp;·&nbsp; Mandi Centre: ${token.mandiName || 'APMC'}</div>
      </div>
    </div>
    <div class="sig-box">
      <strong>Officer Digital Signature:</strong> ${stage.officer || 'APMC Authorized Officer'} | PIN-VERIFIED-SHA256
    </div>
  </div>

  <div style="text-align:center;">
    <div class="stamp">OFFICIAL APMC CLEARANCE</div>
  </div>

  <div class="footer">
    This is a cryptographically signed electronic pass generated under the Maharashtra APMC (Regulation) Act, 1963.<br/>
    For verification queries, contact APMC Kisan Toll Free Helpline: 1800-233-5472.
  </div>
</body>
</html>
`);
  win.document.close();
  win.focus();
}


// ─── Sub-components ───────────────────────────────────────────────────────────

/** Mandi Discovery Card */
function MandiCard({ mandi, onSelect, isSelected, routeInfo }) {
  const c = congestionColor(mandi.color);
  const distanceDisplay = routeInfo?.distanceKm ? `${routeInfo.distanceKm} km` : `${mandi.distance} km`;
  const travelTimeDisplay = routeInfo?.durationMins ? `~${routeInfo.durationMins} mins` : mandi.travelTime;
  const isOsrm = routeInfo?.isOsrm;

  return (
    <div
      onClick={() => onSelect(mandi)}
      className={`rounded-2xl border cursor-pointer transition-all duration-200 p-5 hover:shadow-lg hover:-translate-y-0.5 ${
        isSelected
          ? 'border-emerald-500 bg-emerald-50 shadow-emerald-100 shadow-md ring-2 ring-emerald-400/30'
          : 'border-slate-200 bg-white hover:border-emerald-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-emerald-500' : 'bg-slate-100'}`}>
            <Building2 className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm leading-tight">{mandi.name}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-emerald-500" /> {mandi.location}
            </p>
          </div>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.badge}`}>
          {mandi.congestion}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-600 mb-3">
        <span className="flex items-center gap-1">
          <Navigation className="w-3 h-3 text-emerald-500" />
          <strong>{distanceDisplay}</strong>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-emerald-500" />
          <strong>{travelTimeDisplay}</strong>
          {isOsrm && (
            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded ml-0.5">
              OSRM
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3 text-slate-400" />
          Queue: {getMandiQueueCount(mandi.id)}
        </span>
      </div>

      {/* Congestion Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>Capacity</span>
          <span className={`font-semibold ${c.text}`}>{mandi.capacity}% full</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${mandi.capacity}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {mandi.cropsHandled.slice(0, 3).map((cr) => (
            <span key={cr} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">{cr}</span>
          ))}
        </div>
        <span className={`text-xs font-bold flex items-center gap-1 ${isSelected ? 'text-emerald-600' : 'text-emerald-500'}`}>
          {isSelected ? 'Selected' : 'Select'} <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
}

/** Rate Comparison + Booking Panel */
function BookingPanel({
  mandi,
  farmerName,
  phone,
  onBooked,
  hasActiveBooking,
  activeToken,
  onViewActiveToken,
  farmerCoords,
  pickupLocation,
  onRequestPickupLocation
}) {
  const [crop, setCrop] = useState(mandi?.cropsHandled?.[0] || 'Wheat');
  const [quantity, setQuantity] = useState(10);
  const [slot, setSlot] = useState(SLOTS[0]);
  const [isBooking, setIsBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const handleBook = async (explicitCoords = null) => {
    if (hasActiveBooking) {
      setBookingError(`You already have an active booking (${activeToken?.id || activeToken?.tokenNumber}). Complete delivery before reserving a new slot.`);
      return;
    }

    const currentCoords = explicitCoords || farmerCoords;
    const hasPin = Boolean(
      pickupLocation?.coordinates &&
      Array.isArray(pickupLocation.coordinates) &&
      pickupLocation.coordinates.length === 2 &&
      !isNaN(pickupLocation.coordinates[0]) &&
      !isNaN(pickupLocation.coordinates[1])
    );

    // If farmer does not have pickup location set, block and open interactive map modal
    if (!hasPin && !explicitCoords) {
      if (onRequestPickupLocation) {
        onRequestPickupLocation((newCoords) => handleBook(newCoords));
        return;
      }
    }

    setIsBooking(true);
    setBookingError('');
    const quantityBand = `${quantity} Quintals`;
    const effLat = currentCoords?.lat || (pickupLocation?.coordinates ? pickupLocation.coordinates[1] : 19.8928);
    const effLng = currentCoords?.lng || (pickupLocation?.coordinates ? pickupLocation.coordinates[0] : 74.4820);

    const token = buildNewToken({
      mandiId: mandi.id,
      mandiName: mandi.name,
      mandiCode: mandi.code.split('-')[1] || 'KPG',
      farmerName,
      phone,
      crop,
      quantityBand,
      quantity,
      slotLabel: slot.label.trim(),
      slotDate: today,
      latitude: effLat,
      longitude: effLng
    });
    const queuePos = addTokenToPipeline(mandi.id, {
      tokenId: token.id,
      farmerName,
      crop,
      status: 'BOOKED',
    });
    token.queuePosition = queuePos + 7; // simulate some queue ahead

    try {
      const saved = await saveTokenAsync(token);
      setIsBooking(false);
      setBooked(true);
      setTimeout(() => onBooked(saved || token), 900);
    } catch (err) {
      setIsBooking(false);
      if (err?.code === 'PICKUP_LOCATION_REQUIRED' || err?.message?.includes('pickup location')) {
        if (onRequestPickupLocation) {
          onRequestPickupLocation((newCoords) => handleBook(newCoords));
          return;
        }
      }
      if (err?.code === 'ACTIVE_TOKEN_EXISTS' || err?.message?.includes('active booking')) {
        setBookingError(err.message || 'You already have an active booking in progress.');
      } else {
        // Fallback for network timeouts
        saveToken(token);
        setBooked(true);
        setTimeout(() => onBooked(token), 900);
      }
    }
  };

  // Dynamic live rate fetching for the selected APMC mandi
  const [liveRates, setLiveRates] = useState(mandi.rates || { today: {}, yesterday: {} });

  useEffect(() => {
    let isMounted = true;
    const fetchRates = async () => {
      try {
        const res = await pricesApi.getPricesByMandi(mandi.id);
        const prices = Array.isArray(res) ? res : res?.data || [];
        if (isMounted && prices.length > 0) {
          const newRates = { today: {}, yesterday: {} };
          prices.forEach((p) => {
            newRates.today[p.crop] = p.marketPriceToday;
            newRates.yesterday[p.crop] = p.marketPriceYesterday !== null && p.marketPriceYesterday !== undefined ? p.marketPriceYesterday : p.mspPrice;
          });
          setLiveRates(newRates);
        }
      } catch (err) {
        console.debug('Failed to fetch live mandi rates for BookingPanel:', err.message);
      }
    };
    fetchRates();
    return () => { isMounted = false; };
  }, [mandi.id]);

  const rates = liveRates.today && Object.keys(liveRates.today).length > 0 ? liveRates : (mandi.rates || { today: {}, yesterday: {} });
  const availCrops = (mandi?.cropsHandled || []).filter((c) => rates?.today && rates?.today?.[c]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-white/80" />
          <span className="text-xs text-white/80 font-medium">{mandi.location}</span>
        </div>
        <h3 className="text-white font-black text-lg">{mandi.name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="inline-flex items-center gap-1 text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse inline-block" />
            LIVE RATES
          </span>
          <span className="text-[10px] text-white/70">{today}</span>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rate Comparison */}
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Rate Comparison</h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Yesterday's Closing</p>
              <div className="mt-2 space-y-1.5">
                {availCrops.map((cr) => (
                  <div key={cr} className="flex justify-between text-xs">
                    <span className="text-slate-600">{cr}</span>
                    <span className="font-bold text-slate-800">{fmtRate(rates?.yesterday?.[cr] || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
              <p className="text-[10px] text-emerald-600 font-semibold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Today Live
              </p>
              <div className="mt-2 space-y-1.5">
                {availCrops.map((cr) => {
                  const ch = rateChange(rates?.yesterday?.[cr] || 0, rates?.today?.[cr] || 0);
                  return (
                    <div key={cr} className="flex justify-between text-xs items-center">
                      <span className="text-slate-600">{cr}</span>
                      <div className="text-right">
                        <span className="font-bold text-emerald-800 block">{fmtRate(rates?.today?.[cr] || 0)}</span>
                        <span className={`text-[9px] font-bold ${ch.cls}`}>{ch.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detailed change table */}
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left p-2.5 font-semibold text-slate-500">Crop</th>
                  <th className="text-right p-2.5 font-semibold text-slate-500">Today</th>
                  <th className="text-right p-2.5 font-semibold text-slate-500">Change</th>
                </tr>
              </thead>
              <tbody>
                {availCrops.map((cr, i) => {
                  const ch = rateChange(rates?.yesterday?.[cr] || 0, rates?.today?.[cr] || 0);
                  return (
                    <tr key={cr} className={i % 2 === 0 ? '' : 'bg-slate-50/50'}>
                      <td className="p-2.5 font-medium text-slate-700">{cr}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">{fmtRate(rates?.today?.[cr] || 0)}</td>
                      <td className={`p-2.5 text-right font-bold ${ch.cls}`}>{ch.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Booking Form */}
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Book Your Slot</h4>

          {/* Crop */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-2">Commodity / Crop</label>
            <div className="flex flex-wrap gap-2">
              {CROPS.map((cr) => {
                const available = mandi.cropsHandled.includes(cr);
                return (
                  <button
                    key={cr}
                    type="button"
                    disabled={!available}
                    onClick={() => setCrop(cr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      crop === cr
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                        : available
                        ? 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                        : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                    }`}
                  >
                    {cr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Quantity (Quintals) — <span className="text-emerald-600 font-bold">{quantity} Qtl</span>
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-full appearance-none accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>1 Qtl</span>
              <span className="font-bold text-emerald-600">{quantity} Qtl ≈ ₹{(quantity * (rates?.today?.[crop] || 0)).toLocaleString('en-IN')}</span>
              <span>100 Qtl</span>
            </div>
          </div>

          {/* Slot */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-600 mb-2">Arrival Time Slot</label>
            <div className="space-y-2">
              {SLOTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-2 ${
                    slot.id === s.id
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-1 ring-emerald-400/30'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-200'
                  }`}
                >
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${slot.id === s.id ? 'text-emerald-500' : 'text-slate-400'}`} />
                  {s.label}
                  {slot.id === s.id && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Estimate */}
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 mb-4 text-xs">
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Estimated Value ({quantity} Qtl × {fmtRate(rates?.today?.[crop] || 0)})</span>
            </div>
            <div className="text-xl font-black text-emerald-700">
              ₹{((quantity * (rates?.today?.[crop] || 0))).toLocaleString('en-IN')}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Based on today's live rate — final amount confirmed after weighbridge</p>
          </div>

          {/* ─── Warning Card: Strict Single-Active-Token Constraint ───────── */}
          {hasActiveBooking && (
            <div className="mb-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 shadow-sm animate-fadeIn">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-amber-900 uppercase tracking-wide">
                      Active Booking In Progress
                    </p>
                    <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                      {activeToken?.tokenNumber || activeToken?.id}
                    </span>
                  </div>
                  <p className="text-amber-800 mt-1 leading-relaxed font-medium">
                    Active booking in progress. Please complete your current slot at APMC {activeToken?.mandiName?.replace('APMC ', '') || 'Kopargaon'} before scheduling a new one.
                  </p>
                  <button
                    type="button"
                    onClick={() => onViewActiveToken(activeToken)}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm"
                  >
                    <span>View Active Token →</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Booking Error Alert ───────────────────────────────────────── */}
          {bookingError && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Reservation Blocked</p>
                <p className="mt-0.5 leading-snug">{bookingError}</p>
                {activeToken && (
                  <button
                    type="button"
                    onClick={() => onViewActiveToken(activeToken)}
                    className="mt-1 text-emerald-700 font-bold underline flex items-center gap-1"
                  >
                    You have an active booking in progress. [View Active Token →]
                  </button>
                )}
              </div>
            </div>
          )}

          {booked ? (
            <div className="w-full py-3.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 font-bold text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-bounce" />
              Token Generated! Redirecting…
            </div>
          ) : (
            <button
              type="button"
              onClick={handleBook}
              disabled={isBooking || hasActiveBooking}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                hasActiveBooking
                  ? 'bg-slate-200 text-slate-400 border border-slate-300 shadow-none cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200 disabled:opacity-70 disabled:cursor-not-allowed'
              }`}
              title={hasActiveBooking ? 'Active booking already in progress. Complete current delivery first.' : 'Confirm and generate token'}
            >
              {isBooking ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating Token…</>
              ) : hasActiveBooking ? (
                <><Lock className="w-4 h-4" /> Single Active Token Limit (Active: #{activeToken?.tokenNumber || activeToken?.id})</>
              ) : (
                <><Ticket className="w-4 h-4" /> Confirm & Generate Digital Token</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Pre-Gate Cancellation Confirmation Modal with Dynamic Penalty Breakdown */
function CancellationModal({ token, onClose, onConfirmCancel, isCancelling }) {
  const [penaltyInfo, setPenaltyInfo] = useState(null);
  const [isLoadingPenalty, setIsLoadingPenalty] = useState(true);
  const [reason, setReason] = useState('Personal / Vehicle Breakdown');

  useEffect(() => {
    let isMounted = true;
    async function loadPenalty() {
      if (!token) return;
      const res = await previewCancellationPenaltyApi(token.id || token.tokenNumber);
      if (isMounted) {
        if (res && res.penaltyInfo) {
          setPenaltyInfo(res.penaltyInfo);
        } else {
          setPenaltyInfo({
            penalty: 0,
            tier: 'FREE',
            explanation: 'Standard free cancellation window prior to yard gate check-in'
          });
        }
        setIsLoadingPenalty(false);
      }
    }
    loadPenalty();
    return () => { isMounted = false; };
  }, [token]);

  const tokenNumber = token?.tokenNumber || token?.id || 'KQ-TOKEN';
  const penalty = penaltyInfo?.penalty ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scaleIn">
        <div className="bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-white" />
              <h3 className="font-bold text-base">Cancel Mandi Booking</h3>
            </div>
            <button
              onClick={onClose}
              disabled={isCancelling}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-rose-100 mt-1 font-mono">{tokenNumber} · {token?.mandiName}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Penalty Breakdown Card */}
          <div className={`rounded-2xl border p-4 ${
            penalty === 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : penalty <= 50
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Calculated Penalty Fee</span>
              <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${
                penalty === 0 ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-900'
              }`}>
                {isLoadingPenalty ? 'Calculating…' : penaltyInfo?.tier || 'FEE'}
              </span>
            </div>
            <div className="text-2xl font-black font-mono">
              {isLoadingPenalty ? '...' : `₹${penalty}`}
            </div>
            <p className="text-xs mt-1 leading-snug opacity-90">
              {isLoadingPenalty ? 'Evaluating time to scheduled slot…' : penaltyInfo?.explanation}
            </p>
          </div>

          {/* Dues Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">Account Dues Notice:</span>
              <p className="mt-0.5 text-slate-600 leading-relaxed">
                Any applicable fee will be recorded in your profile pending dues and automatically deducted from your next produce payout at Desk 5. Your active slot lock will be lifted immediately!
              </p>
            </div>
          </div>

          {/* Cancellation Reason Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Reason for Cancellation</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="Personal / Family Emergency">Personal / Family Emergency</option>
              <option value="Vehicle Breakdown / Transport Delay">Vehicle Breakdown / Transport Delay</option>
              <option value="Yield / Moisture Adjustment">Yield / Moisture Adjustment</option>
              <option value="Selected Alternate Mandi">Selected Alternate Mandi</option>
              <option value="Weather / Harvest Delay">Weather / Harvest Delay</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={isCancelling}
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all"
            >
              Keep Slot
            </button>
            <button
              type="button"
              disabled={isCancelling}
              onClick={() => onConfirmCancel(token, reason, penalty)}
              className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isCancelling ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</>
              ) : (
                <><Trash2 className="w-4 h-4" /> Confirm & Cancel</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Farmer Portfolio & Account Dues Ledger Modal */
function FarmerDuesModal({ farmerProfile, onClose, farmerName, farmerPhone }) {
  const pendingDues = farmerProfile?.pendingDues || 0;
  const history = Array.isArray(farmerProfile?.cancellationHistory) ? farmerProfile.cancellationHistory : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base">Farmer Portfolio & Account Dues</h3>
                <p className="text-[11px] text-slate-400">Farmer: {farmerName} · +91 {farmerPhone}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Active Balance Card */}
          <div className={`p-5 rounded-2xl border flex items-center justify-between ${
            pendingDues === 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-amber-50 border-amber-300 text-amber-950 shadow-sm'
          }`}>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Outstanding Cancellation Dues
              </span>
              <div className="text-3xl font-black font-mono mt-0.5">
                ₹{pendingDues.toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                {pendingDues === 0
                  ? '✓ Account in good standing — Zero pending penalties'
                  : '⚠ Will be auto-settled on your next produce payment'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              pendingDues === 0 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}>
              {pendingDues === 0 ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
          </div>

          {/* Auto-Deduction Explanation */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-1.5">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              How Dues Settlement Works
            </h4>
            <p className="leading-relaxed">
              When you deliver produce to any APMC Mandi, Desk 5 (Final Accounts & DBT Settlement) will automatically deduct pending penalty dues from your gross purchase order value:
            </p>
            <div className="font-mono bg-white p-2 rounded-lg border border-slate-200 text-emerald-800 font-bold text-center mt-1">
              Final Payout = (Net Produce × Certified Rate) − Pending Dues
            </div>
          </div>

          {/* Itemized Cancellation History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                Cancellation & Penalty History ({history.length})
              </h4>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No past cancellations recorded.
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map((item, idx) => (
                  <div key={item.tokenNumber || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800">{item.tokenNumber || 'KQ-TOKEN'}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 font-medium">{item.mandiName}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {item.cancelledAt ? new Date(item.cancelledAt).toLocaleString('en-IN') : 'Recent'} · {item.reason || 'Cancelled'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-rose-600">₹{item.penaltyAmount || 0}</div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        item.status === 'DEDUCTED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.status === 'WAIVED'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.status || 'DUE'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Token Card in "My Active Tokens" tab */
function TokenCard({ token, onOpenTerminal, onOpenCancelModal, onRequestGateExit, farmerCoords }) {
  const [routingData, setRoutingData] = useState(null);

  // Fast-Track Priority State
  const [fastTrackData, setFastTrackData] = useState(null);
  const [showFastTrackModal, setShowFastTrackModal] = useState(false);
  const [selectedFastTrackTier, setSelectedFastTrackTier] = useState(null);
  const [isSubmittingFastTrack, setIsSubmittingFastTrack] = useState(false);
  const [fastTrackError, setFastTrackError] = useState('');
  const [fastTrackSuccessMsg, setFastTrackSuccessMsg] = useState('');

  const tokenNumber = token?.tokenNumber || token?.id || 'KQ-TOKEN';
  const mandiName = token?.mandiName || 'APMC Kopargaon';
  const crop = token?.crop || 'Wheat';
  const quantityBand = token?.quantityBand || `${token?.quantity || 10} Quintals`;
  const slotDate = token?.slotDate || 'Today';
  const queuePos = token?.queuePosition || 8;

  // Load Fast-Track status & floor checks
  const loadFastTrackStatus = useCallback(async () => {
    if (!tokenNumber) return;
    try {
      const res = await fastTrackApi.getFastTrackStatus(tokenNumber, {
        mandiId: token?.mandiId,
        crop: token?.crop
      });
      if (res?.data) {
        setFastTrackData(res.data);
      }
    } catch (e) {
      console.debug('FastTrack status load note:', e.message);
    }
  }, [tokenNumber, token?.mandiId, token?.crop]);

  useEffect(() => {
    loadFastTrackStatus();
  }, [loadFastTrackStatus]);

  // Real-time socket updates for Fast-Track
  useEffect(() => {
    const unsubApprove = onFastTrackApproved((data) => {
      if (data?.tokenNumber === tokenNumber || data?.request?.tokenNumber === tokenNumber) {
        loadFastTrackStatus();
      }
    });

    const unsubReject = onFastTrackRejected((data) => {
      if (data?.tokenNumber === tokenNumber || data?.request?.tokenNumber === tokenNumber) {
        loadFastTrackStatus();
      }
    });

    return () => {
      unsubApprove();
      unsubReject();
    };
  }, [tokenNumber, loadFastTrackStatus]);

  const handleFastTrackSubmit = async () => {
    if (!selectedFastTrackTier) {
      setFastTrackError('Please select an available discount tier');
      return;
    }
    setIsSubmittingFastTrack(true);
    setFastTrackError('');
    try {
      await fastTrackApi.requestFastTrack(tokenNumber, {
        tier: selectedFastTrackTier,
        phone: token?.phone
      });
      setIsSubmittingFastTrack(false);
      setShowFastTrackModal(false);
      setFastTrackSuccessMsg('Fast-Track Priority requested! Awaiting APMC officer verification.');
      loadFastTrackStatus();
      setTimeout(() => setFastTrackSuccessMsg(''), 5000);
    } catch (err) {
      setIsSubmittingFastTrack(false);
      setFastTrackError(err?.response?.data?.message || err.message || 'Failed to submit fast-track request');
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function updateRouting() {
      if (!token) return;
      const travel = await calculateRealTimeTravel({
        origin: farmerCoords || DEFAULT_FARMER_COORDINATES,
        mandiId: token.mandiId || 'KPG-01'
      });
      if (isMounted) {
        const leaveBy = calculateLeaveBy({
          token,
          travelDurationMins: travel.durationMins,
          bufferMins: 15
        });
        setRoutingData({ travel, leaveBy });
      }
    }

    updateRouting();
    const timer = setInterval(updateRouting, 20000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [token, farmerCoords]);

  const stages = Array.isArray(token?.stages) ? token.stages : [];
  const completedStages = stages.filter((s) => (s?.status || '').toLowerCase() === 'completed').length;
  const normStatus = normalizeStatus(token?.status);
  const isGateInDone = (stages[0]?.status || '').toLowerCase() === 'completed' || normStatus === TOKEN_STATUS.IN_PROGRESS;
  const isCancelled = normStatus === TOKEN_STATUS.CANCELLED;
  const isCompleted = normStatus === TOKEN_STATUS.COMPLETED;
  const isExitRequested = normStatus === TOKEN_STATUS.GATE_EXIT_REQUESTED;

  const statusColors = {
    Booked: 'bg-blue-50 text-blue-700 border-blue-200',
    'In-Progress': 'bg-amber-50 text-amber-700 border-amber-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
    'Gate-Exit-Requested': 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse',
  };
  const badgeStyle = statusColors[normStatus] || 'bg-blue-50 text-blue-700 border-blue-200';

  const rawSlot = token?.slotLabel || token?.slotTime || 'Morning 08:00 – 11:00 AM';
  const slotDisplay = typeof rawSlot === 'string' ? rawSlot.split('  ')[0] : 'Morning';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeStyle}`}>
              {statusLabel(normStatus)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{slotDate}</span>
            {isExitRequested && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Exit Requested
              </span>
            )}
          </div>
          <h3 className="font-black text-xl text-slate-900 font-mono tracking-tight">{tokenNumber}</h3>
        </div>
        <div className="w-14 h-14 bg-white rounded-xl border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
          <QrCode className="w-8 h-8 text-slate-800" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Mandi', value: mandiName },
          { label: 'Crop', value: crop },
          { label: 'Quantity', value: quantityBand },
          { label: 'Time Slot', value: slotDisplay },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">{label}</p>
            <p className="text-xs font-bold text-slate-800 mt-0.5 leading-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* ─── Dynamic Live "Leave-By" Recommendation Card (OSRM Powered) ── */}
      {routingData && !isCancelled && !isCompleted && (
        <div className={`mb-4 rounded-2xl border p-4 transition-all ${routingData.leaveBy.urgency.bg}`}>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Navigation className="w-4 h-4 shrink-0" />
              <span>Dynamic "Leave-By" Recommendation</span>
              <span className="text-[10px] opacity-75 font-mono">
                {farmerCoords?.isLive ? '· Live GPS' : '· Kopargaon Base'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${routingData.leaveBy.urgency.dot}`} />
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/80 border border-current shadow-xs">
                {routingData.leaveBy.urgency.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-white/85 backdrop-blur-xs rounded-xl p-2.5 mb-2.5 border border-current/15 text-center">
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500">Driving Duration</p>
              <p className="text-xs font-black text-slate-900 mt-0.5">
                ~{routingData.leaveBy.travelDurationMins} mins
              </p>
              <span className="text-[9px] text-emerald-700 font-bold">
                {routingData.travel?.isOsrm ? 'via OSRM' : 'Traffic-adjusted'}
              </span>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500">Weighbridge Turn</p>
              <p className="text-xs font-black text-slate-900 mt-0.5">
                {routingData.leaveBy.turnTimeFormatted}
              </p>
              <span className="text-[9px] text-emerald-600 font-bold">Slot Time</span>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500">Departure Deadline</p>
              <p className="text-xs font-black text-emerald-700 mt-0.5 underline decoration-2">
                {routingData.leaveBy.leaveTimeFormatted}
              </p>
              <span className="text-[9px] text-slate-500">15m Gate Buffer</span>
            </div>
          </div>

          <div className="bg-white/90 rounded-xl p-2.5 border border-current/20 mb-2 shadow-xs">
            <p className="text-xs font-bold text-slate-900 leading-snug">
              {routingData.leaveBy.displayText}
            </p>
          </div>

          <div className="flex items-center justify-between text-[10px] opacity-80 font-medium">
            <span>Buffer: 15 min gate-intake clearance</span>
            <span className="font-bold">{routingData.leaveBy.urgency.headline}</span>
          </div>
        </div>
      )}

      {/* Stage Progress Mini */}
      {!isCancelled && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>Checkpoint Progress</span>
            <span className="font-bold text-slate-600">{completedStages}/5 stages</span>
          </div>
          <div className="flex gap-1">
            {stages.map((s, i) => {
              const st = (s?.status || '').toLowerCase();
              return (
                <div
                  key={s?.id || i}
                  className={`flex-1 h-2 rounded-full transition-all ${
                    st === 'completed'
                      ? 'bg-emerald-500'
                      : st === 'in_progress' || st === 'in progress'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-100'
                  }`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
            <span>Queue Position: <strong className="text-emerald-600">#{queuePos}</strong></span>
            <span>·</span>
            <span>ETA: ~{queuePos * 12} mins</span>
          </div>
        </div>
      )}

      {/* ─── Fast-Track Priority Section ─── */}
      {!isCancelled && !isCompleted && !isGateInDone && (
        <div className="mb-4">
          {fastTrackSuccessMsg && (
            <div className="mb-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{fastTrackSuccessMsg}</span>
            </div>
          )}

          {fastTrackData?.activeRequest?.status === 'PENDING' ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <Zap className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span>Fast-Track Priority: Pending Approval</span>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-mono">
                  Tier {fastTrackData.activeRequest.tier}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-700 bg-white/90 p-2 rounded-lg border border-amber-200/70">
                <span>Agreed Purchase Rate:</span>
                <span className="font-black text-amber-900 font-mono">₹{fastTrackData.activeRequest.discountedPrice?.toLocaleString('en-IN')}/Qtl</span>
              </div>
              <p className="text-[10px] text-amber-700 mt-1">
                Queue position will shift to #1 upon officer authorization.
              </p>
            </div>
          ) : (fastTrackData?.activeRequest?.status === 'APPROVED' || token.isFastTrack) ? (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 font-black text-emerald-800">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>Fast-Track Priority: ACTIVE</span>
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                  Priority Intake #1
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-700 bg-white/90 p-2 rounded-lg border border-emerald-200">
                <span>Certified Rate:</span>
                <span className="font-black text-emerald-900 font-mono">
                  ₹{(fastTrackData?.activeRequest?.discountedPrice || token.fastTrackDiscountedPrice)?.toLocaleString('en-IN')}/Qtl
                </span>
              </div>
            </div>
          ) : fastTrackData?.activeRequest?.status === 'REJECTED' ? (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
              <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                Fast-Track not approved for this run
              </span>
              <button
                type="button"
                onClick={() => setShowFastTrackModal(true)}
                className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Resubmit
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowFastTrackModal(true)}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 hover:bg-amber-100/70 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>⚡ Request Fast-Track Priority Intake</span>
            </button>
          )}
        </div>
      )}

      {/* ─── Fast-Track Request Modal ─── */}
      {showFastTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Request Fast-Track Priority</h3>
                  <p className="text-[10px] text-slate-500 font-mono">{tokenNumber} · {mandiName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowFastTrackModal(false); setFastTrackError(''); }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Voluntarily offer a small discount from today's market rate in exchange for priority gate queue placement (Queue Position #1). Discounted rates are strictly protected by the statutory MSP floor.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Commodity:</span>
                <span className="font-bold text-slate-800">{crop}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Today Market Rate:</span>
                <span className="font-bold text-slate-800 font-mono">₹{fastTrackData?.tierAvailability?.marketPriceToday?.toLocaleString('en-IN') || '4,950'}/Qtl</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Statutory MSP Floor:</span>
                <span className="font-mono">₹{fastTrackData?.tierAvailability?.mspPrice?.toLocaleString('en-IN') || '4,892'}/Qtl</span>
              </div>
            </div>

            <div className="space-y-2.5 mb-5">
              <label className="text-xs font-bold text-slate-700 block">Select Priority Discount Tier:</label>
              {(fastTrackData?.tierAvailability?.tierDetails || [
                { tier: 2, discountedPrice: 4851, isValid: false },
                { tier: 5, discountedPrice: 4703, isValid: false },
                { tier: 10, discountedPrice: 4455, isValid: false }
              ]).map((td) => {
                const isSelected = selectedFastTrackTier === td.tier;
                return (
                  <div
                    key={td.tier}
                    onClick={() => {
                      if (td.isValid) {
                        setSelectedFastTrackTier(td.tier);
                        setFastTrackError('');
                      }
                    }}
                    className={`p-3 rounded-xl border transition-all text-xs flex items-center justify-between ${
                      !td.isValid
                        ? 'bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-amber-50 border-amber-400 shadow-xs cursor-pointer'
                        : 'bg-white border-slate-200 hover:border-amber-300 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">Tier {td.tier}% Discount</span>
                        {!td.isValid && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
                            Below Statutory MSP
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        Final rate: ₹{td.discountedPrice?.toLocaleString('en-IN')}/Qtl
                      </p>
                    </div>
                    <div className="text-right">
                      {td.isValid ? (
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </span>
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {fastTrackError && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {fastTrackError}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowFastTrackModal(false); setFastTrackError(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingFastTrack || !selectedFastTrackTier}
                onClick={handleFastTrackSubmit}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {isSubmittingFastTrack ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Banner if applicable */}
      {isCancelled && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Booking Cancelled {token.cancellationFee ? `· Penalty: ₹${token.cancellationFee}` : '· Free'}</span>
          </div>
          <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded">
            Slot Released
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenTerminal(token)}
          className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          Live Terminal
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Cancellation or Gate Exit Button */}
        {!isCancelled && !isCompleted && (
          !isGateInDone ? (
            <button
              type="button"
              onClick={() => onOpenCancelModal(token)}
              className="py-2.5 px-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-all"
              title="Cancel Booking (Time-decay penalty applies)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          ) : !isExitRequested ? (
            <button
              type="button"
              onClick={() => onRequestGateExit(token)}
              className="py-2.5 px-3 rounded-xl border border-amber-300 hover:bg-amber-50 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-all"
              title="Request Gate Exit / Produce Rejection"
            >
              <LogOut className="w-3.5 h-3.5 text-amber-600" />
              <span>Request Exit</span>
            </button>
          ) : (
            <span className="py-2.5 px-2.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Exit Pending
            </span>
          )
        )}
      </div>
    </div>
  );
}

/** Live Queue Terminal Modal */
function QueueTerminalModal({
  token,
  onClose,
  onStageUpdate,
  onOpenCancelModal,
  onRequestGateExit,
  farmerCoords
}) {
  const [localToken, setLocalToken] = useState(token);
  const [signingStageId, setSigningStageId] = useState(null);
  const [simulationNote, setSimulationNote] = useState('');
  const [routingData, setRoutingData] = useState(null);

  useEffect(() => {
    if (token) setLocalToken(token);
  }, [token]);

  useEffect(() => {
    let isMounted = true;
    async function updateRouting() {
      if (!localToken) return;
      const travel = await calculateRealTimeTravel({
        origin: farmerCoords || DEFAULT_FARMER_COORDINATES,
        mandiId: localToken.mandiId || 'KPG-01'
      });
      if (isMounted) {
        const leaveBy = calculateLeaveBy({
          token: localToken,
          travelDurationMins: travel.durationMins,
          bufferMins: 15,
          isOsrm: travel.isOsrm,
        });
        setRoutingData({ travel, leaveBy });
      }
    }
    updateRouting();
    return () => { isMounted = false; };
  }, [localToken, farmerCoords]);

  const stages = Array.isArray(localToken?.stages) ? localToken.stages : [];
  const nextPendingStage = stages.find((s) => (s?.status || '').toLowerCase() !== 'completed');
  const completedCount = stages.filter((s) => (s?.status || '').toLowerCase() === 'completed').length;
  const isAllDone = completedCount === 5;
  const normModalStatus = normalizeStatus(localToken?.status);
  const isGateInDone = (stages[0]?.status || '').toLowerCase() === 'completed' || normModalStatus === TOKEN_STATUS.IN_PROGRESS;
  const isCancelled = normModalStatus === TOKEN_STATUS.CANCELLED;
  const isExitRequested = normModalStatus === TOKEN_STATUS.GATE_EXIT_REQUESTED;

  const handleSignoff = async (stageId) => {
    setSigningStageId(stageId);
    const stg = stages.find((s) => s?.id === stageId);
    if (!stg) {
      setSigningStageId(null);
      return;
    }

    const now = new Date().toISOString();
    const sigId = `${stg.officerCode || 'OFFICER'}-${Date.now().toString(36).toUpperCase()}`;
    const extras = {};
    if (stageId === 'QUALITY_GRADING') extras.grade = 'Grade A';
    if (stageId === 'WEIGHBRIDGE') extras.weight = ((Number(localToken.quantity) || 10) * 0.95).toFixed(2);

    try {
      const updated = await updateTokenStageAsync(localToken.id || localToken.tokenNumber, stageId, {
        status: 'completed',
        completedAt: now,
        officerSigId: sigId,
        ...extras,
      });

      if (updated) {
        setLocalToken(updated);
        onStageUpdate(updated);
      }
    } catch {
      const updated = updateTokenStage(localToken.id || localToken.tokenNumber, stageId, {
        status: 'completed',
        completedAt: now,
        officerSigId: sigId,
        ...extras,
      });
      if (updated) {
        setLocalToken(updated);
        onStageUpdate(updated);
      }
    }

    setSigningStageId(null);
    setSimulationNote(`✓ ${stg.shortLabel || 'Checkpoint'} signed off by ${stg.officer || 'Officer'}`);
    setTimeout(() => setSimulationNote(''), 3000);
  };

  const handlePrint = (stage) => {
    if (!stage) return;
    printStageReceipt({ token: localToken, stage });
  };

  const tokenNumber = localToken?.tokenNumber || localToken?.id || 'KQ-TOKEN';
  const queuePos = localToken?.queuePosition || 8;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl my-4 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Live Mandi Checkpoint Terminal
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="font-black text-2xl tracking-tight font-mono">{tokenNumber}</div>
          <div className="text-slate-300 text-xs mt-1">
            {localToken?.mandiName} · {localToken?.crop} · {localToken?.quantityBand || `${localToken?.quantity} Quintals`}
          </div>

          {/* Queue & Leave-By HUD */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 font-medium uppercase">Queue Position</p>
              <p className="text-sm font-black text-white mt-0.5">#{queuePos} in Line</p>
              <p className="text-[10px] text-emerald-400 mt-0.5">~{queuePos * 12}m to turn</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 font-medium uppercase">Travel Duration</p>
              <p className="text-sm font-black text-white mt-0.5">
                {routingData?.travel?.durationMins ? `~${routingData.travel.durationMins} mins` : 'Calculating…'}
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">
                {routingData?.travel?.distanceKm ? `${routingData.travel.distanceKm} km (${routingData.travel?.isOsrm ? 'OSRM' : 'Est.'})` : 'Road Network'}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 font-medium uppercase">Leave Home By</p>
              <p className="text-sm font-black text-emerald-400 mt-0.5">
                {routingData?.leaveBy?.leaveTimeFormatted || '08:35 AM'}
              </p>
              <span className="text-[10px] text-amber-300 font-semibold">15m Buffer</span>
            </div>
          </div>
        </div>

        {/* Simulation Note */}
        {simulationNote && (
          <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-3 flex items-center gap-2 text-sm text-emerald-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {simulationNote}
          </div>
        )}

        {/* Stages */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-900">Procurement Checkpoints</h4>
            <div className="text-xs text-slate-500 font-semibold">{completedCount}/5 completed</div>
          </div>

          <div className="space-y-3">
            {stages.map((stage, idx) => {
              const st = (stage?.status || '').toLowerCase();
              const isCompleted = st === 'completed';
              const isNext = !isCompleted && !isAllDone && nextPendingStage?.id === stage?.id;

              return (
                <div
                  key={stage?.id || idx}
                  className={`rounded-2xl border transition-all ${
                    isCompleted
                      ? 'bg-emerald-50 border-emerald-200'
                      : isNext
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300/40'
                      : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="p-4 flex items-start gap-4">
                    {/* Status Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isNext
                          ? 'bg-amber-400 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        stageIcon(stage?.icon, 'w-4 h-4')
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-bold text-sm ${isCompleted ? 'text-emerald-800' : isNext ? 'text-amber-800' : 'text-slate-500'}`}>
                              {idx + 1}. {stage?.shortLabel || stage?.label || 'Checkpoint'}
                            </span>
                            {isCompleted && <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">DONE</span>}
                            {isNext && <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold animate-pulse">IN PROGRESS</span>}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">Officer: {stage?.officer || stage?.officerName || 'Staff'}</p>
                          {isCompleted && (
                            <p className="text-[10px] text-slate-400 mt-1">
                              Signed at {formatDateTime(stage?.completedAt || stage?.timestamp)} · ID: {stage?.officerSigId || 'SIG-OK'}
                            </p>
                          )}
                          {isCompleted && stage?.grade && (
                            <span className="inline-block mt-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                              🏅 {stage.grade} Certified
                            </span>
                          )}
                          {isCompleted && stage?.weight && (
                            <span className="inline-block mt-1 text-[10px] bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-bold border border-cyan-200">
                              ⚖ Net Weight: {stage.weight} Qtl
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isNext && (
                            <button
                              type="button"
                              disabled={signingStageId === stage?.id}
                              onClick={() => handleSignoff(stage?.id)}
                              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-all flex items-center gap-1.5 disabled:opacity-60 shadow-sm"
                            >
                              {signingStageId === stage?.id ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Signing…</>
                              ) : (
                                <><ShieldCheck className="w-3 h-3" /> Simulate Sign-off</>
                              )}
                            </button>
                          )}
                          {isCompleted && (
                            <button
                              type="button"
                              onClick={() => handlePrint(stage)}
                              title="Print Verification Slip"
                              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 transition-all flex items-center gap-1.5"
                            >
                              <Printer className="w-3 h-3" />
                              Print Slip
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cancellation or Exit options in modal footer */}
          {!isCancelled && !isAllDone && (
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Need to cancel or leave early?</span>
              {!isGateInDone ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCancelModal(localToken);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Cancel Slot Reservation
                </button>
              ) : !isExitRequested ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestGateExit(localToken);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5 text-amber-600" /> Request Gate Exit / Produce Rejection
                </button>
              ) : (
                <span className="text-xs text-amber-700 font-bold bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                  Gate Exit Request Pending Approval
                </span>
              )}
            </div>
          )}

          {isAllDone && (
            <div className="mt-5 p-5 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl text-center">
              <div className="text-4xl mb-2">🎉</div>
              <h4 className="font-black text-emerald-800 text-lg">Procurement Complete!</h4>
              <p className="text-sm text-emerald-600 mt-1">Payment will be credited within 48 hours via Direct Bank Transfer (DBT).</p>
              <button
                onClick={() => handlePrint(stages[4] || stages[stages.length - 1])}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200"
              >
                <Receipt className="w-4 h-4" /> Download Final E-Receipt
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ─── Simulated Trilingual Voice Booking Modal (Demo Mode) ────────────────────
 * Features animated audio waveform & pulsing mic with cycling captions:
 * English ("Listening...") -> Hindi ("सुन रहे हैं...") -> Marathi ("ऐकत आहे...")
 * Transitions to Token Generated confirmation preview for one-tap booking.
 */
function VoiceBookingModal({
  isOpen,
  onClose,
  onConfirmBooking,
  defaultMandi,
  farmerName,
  farmerPhone,
  farmerCoords,
  pickupLocation,
  onRequestPickupLocation,
  hasActiveBooking,
  activeToken
}) {
  const [phase, setPhase] = useState('LISTENING'); // 'LISTENING' | 'PREVIEW'
  const [langIndex, setLangIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mockTokenId, setMockTokenId] = useState('');

  const targetMandi = defaultMandi || MANDIS[0];
  const targetCrop = targetMandi.cropsHandled?.[0] || 'Wheat';
  const targetSlot = SLOTS[0];
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const estimatedRate = targetMandi.rates?.today?.[targetCrop] || 2460;
  const estimatedAmount = 20 * estimatedRate;

  const LANGUAGES = [
    {
      code: 'en',
      langName: 'English',
      caption: 'Listening...',
      utterance: '“APMC Kopargaon, 20 Quintals Wheat, Morning slot”'
    },
    {
      code: 'hi',
      langName: 'हिन्दी',
      caption: 'सुन रहे हैं...',
      utterance: '“कोपरगांव मंडी, 20 क्विंटल गेहूं, सुबह का स्लॉट”'
    },
    {
      code: 'mr',
      langName: 'मराठी',
      caption: 'ऐकत आहे...',
      utterance: '“कोपरगाव मंडी, 20 क्विंटल गहू, सकाळचा स्लॉट”'
    }
  ];

  // Language cycling & auto-transition to preview
  useEffect(() => {
    if (!isOpen) {
      setPhase('LISTENING');
      setLangIndex(0);
      setIsSubmitting(false);
      setErrorMsg('');
      setMockTokenId('');
      return;
    }

    setPhase('LISTENING');
    setLangIndex(0);
    setErrorMsg('');
    const newId = generateTokenId(targetMandi.code?.split('-')?.[1] || 'KPG');
    setMockTokenId(newId);

    // Cycle languages every 1.5s (0s: English -> 1.5s: Hindi -> 3.0s: Marathi)
    const interval = setInterval(() => {
      setLangIndex((prev) => {
        if (prev < LANGUAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 1500);

    // Transition to preview after ~4.5 seconds total
    const timer = setTimeout(() => {
      setPhase('PREVIEW');
    }, 4500);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [isOpen, targetMandi]);

  if (!isOpen) return null;

  const currentLang = LANGUAGES[langIndex] || LANGUAGES[0];

  const handleConfirm = async () => {
    if (hasActiveBooking) {
      setErrorMsg(`You already have an active booking (${activeToken?.id || activeToken?.tokenNumber}). Complete delivery before reserving a new slot.`);
      return;
    }

    const hasPin = Boolean(
      pickupLocation?.coordinates &&
      Array.isArray(pickupLocation.coordinates) &&
      pickupLocation.coordinates.length === 2 &&
      !isNaN(pickupLocation.coordinates[0]) &&
      !isNaN(pickupLocation.coordinates[1])
    );

    // If farmer does not have pickup location set, open interactive map modal first
    if (!hasPin) {
      if (onRequestPickupLocation) {
        onClose();
        onRequestPickupLocation((newCoords) => {
          onConfirmBooking({
            id: mockTokenId,
            mandi: targetMandi,
            crop: targetCrop,
            quantity: 20,
            slot: targetSlot,
            coords: newCoords
          });
        });
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onConfirmBooking({
        id: mockTokenId,
        mandi: targetMandi,
        crop: targetCrop,
        quantity: 20,
        slot: targetSlot,
        coords: farmerCoords
      });
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Booking could not be created.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white animate-scaleIn relative">
        
        {/* Top Gradient Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />

        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Mic className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Voice Booking Assistant</h3>
              <p className="text-[10px] text-emerald-400 font-medium tracking-wide uppercase">AI Speech-to-Slot Engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8">
          {phase === 'LISTENING' ? (
            <div className="text-center space-y-6">
              {/* Language Pills Indicator */}
              <div className="inline-flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-full px-3 py-1">
                {LANGUAGES.map((l, idx) => (
                  <span
                    key={l.code}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                      idx === langIndex
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 opacity-60'
                    }`}
                  >
                    {l.langName}
                  </span>
                ))}
              </div>

              {/* Glowing Pulsing Mic Orb with Ripple Rings */}
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center my-2">
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-ping opacity-75" />
                <div className="absolute -inset-2 rounded-full border border-teal-400/20 animate-pulse" />
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                  <Mic className="w-10 h-10 text-slate-950 animate-pulse" />
                </div>
              </div>

              {/* Dynamic Animated Waveform */}
              <div className="flex items-center justify-center gap-1.5 h-10 py-1">
                {[40, 75, 100, 60, 90, 100, 70, 85, 45].map((h, i) => (
                  <span
                    key={i}
                    className="w-1 bg-gradient-to-t from-emerald-500 to-teal-300 rounded-full animate-pulse"
                    style={{
                      height: `${h}%`,
                      animationDuration: `${0.6 + (i % 3) * 0.25}s`,
                      animationDelay: `${i * 0.08}s`
                    }}
                  />
                ))}
              </div>

              {/* Cycling Trilingual Caption */}
              <div className="space-y-1.5 min-h-[64px]">
                <h4 className="text-2xl font-black text-white tracking-tight animate-fadeIn">
                  {currentLang.caption}
                </h4>
                <p className="text-xs text-emerald-300 font-medium italic opacity-90 animate-fadeIn">
                  {currentLang.utterance}
                </p>
              </div>

              {/* Disclaimer */}
              <div className="pt-2">
                <span className="inline-block text-[11px] font-semibold text-slate-400 bg-slate-800/60 border border-slate-700/60 px-3 py-1 rounded-full">
                  Voice booking demo — tap to simulate
                </span>
              </div>
            </div>
          ) : (
            /* PREVIEW PHASE: Token Generated Confirmation State */
            <div className="space-y-5 animate-scaleIn">
              {/* Success Badge */}
              <div className="flex items-center justify-between bg-emerald-950/60 border border-emerald-500/30 rounded-2xl p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                      Voice Intake Recognized
                    </h4>
                    <p className="text-[11px] text-slate-300">Ready for instant slot confirmation</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded">
                  {mockTokenId}
                </span>
              </div>

              {/* Token Details Grid */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Mandi Centre:
                  </span>
                  <span className="font-bold text-white">{targetMandi.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Leaf className="w-3.5 h-3.5 text-emerald-400" /> Commodity / Crop:
                  </span>
                  <span className="font-bold text-white">{targetCrop} (20 Quintals)</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> Arrival Slot:
                  </span>
                  <span className="font-bold text-emerald-300">{targetSlot.label.trim()}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-emerald-400" /> Est. Market Value:
                  </span>
                  <span className="font-black text-white text-sm text-emerald-400">
                    ₹{estimatedAmount.toLocaleString('en-IN')} <span className="text-[10px] text-slate-400 font-normal">(@ ₹{estimatedRate}/Qtl)</span>
                  </span>
                </div>
              </div>

              {/* Error Message if any */}
              {errorMsg && (
                <div className="p-3 bg-rose-950/70 border border-rose-500/50 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirm}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating Token…</>
                  ) : (
                    <><Ticket className="w-4 h-4" /> Confirm & Book Slot</>
                  )}
                </button>
              </div>

              {/* Disclaimer Tag */}
              <p className="text-[10px] text-center text-slate-500 font-medium">
                Voice booking demo — tap to simulate · Reuses standard APMC queue reservation
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Farmer Command Center ───────────────────────────────────────────────
export default function FarmerCommandCenter() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const farmerName = user?.name || 'Mahesh Borde';
  const farmerPhone = user?.phone || '9876543210';

  const [activeTab, setActiveTab] = useState('DISCOVERY');
  const [selectedMandi, setSelectedMandi] = useState(null);
  const [tokens, setTokens] = useState(() => getFarmerTokens(farmerPhone));
  const [terminalToken, setTerminalToken] = useState(null);
  const [dbStatus, setDbStatus] = useState({ online: false, database: 'disconnected', cluster: '' });
  const [socketConnected, setSocketConnected] = useState(false);
  const [liveOfficerToast, setLiveOfficerToast] = useState(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [farmerCoords, setFarmerCoords] = useState(() => {
    if (user?.pickupLocation?.coordinates?.length === 2) {
      return {
        lat: Number(user?.pickupLocation?.coordinates?.[1]),
        lng: Number(user?.pickupLocation?.coordinates?.[0]),
        address: user?.pickupLocation?.address || 'Saved Farm Pickup Location',
        isLive: false
      };
    }
    return DEFAULT_FARMER_COORDINATES;
  });
  const [mandiMatrix, setMandiMatrix] = useState({});
  const [agriPoolAlert, setAgriPoolAlert] = useState(null);
  const [showPoolDrawer, setShowPoolDrawer] = useState(false);
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const pendingBookingRetryRef = useRef(null);

  // Farmer Portfolio Dues & Cancellation States
  const [farmerProfile, setFarmerProfile] = useState({ pendingDues: 0, cancellationHistory: [] });
  const [showDuesModal, setShowDuesModal] = useState(false);
  const [cancelModalToken, setCancelModalToken] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // 1. Acquire farmer coordinates (prioritizing saved pickupLocation pin) & calculate multi-mandi OSRM road matrix
  useEffect(() => {
    let isMounted = true;
    if (user?.pickupLocation?.coordinates?.length === 2) {
      const pinCoords = {
        lat: Number(user?.pickupLocation?.coordinates?.[1]),
        lng: Number(user?.pickupLocation?.coordinates?.[0]),
        address: user?.pickupLocation?.address || 'Saved Farm Pickup Location',
        isLive: false
      };
      setFarmerCoords(pinCoords);
      calculateAllMandiDistances(pinCoords).then((matrix) => {
        if (isMounted) {
          console.log('🗺️ [OSRM Distance Matrix] Pinned pickup location distances loaded:', matrix);
          setMandiMatrix(matrix);
        }
      });
    } else {
      getFarmerCoordinates().then((coords) => {
        console.log('📍 [Farmer Command Center] Geolocation acquired:', coords);
        if (isMounted) {
          setFarmerCoords(coords);
          calculateAllMandiDistances(coords).then((matrix) => {
            if (isMounted) {
              console.log('🗺️ [OSRM Distance Matrix] Multi-mandi calculations loaded:', matrix);
              setMandiMatrix(matrix);
            }
          });
        }
      });
    }
    return () => { isMounted = false; };
  }, [user?.pickupLocation]);

  const handleRequestPickupLocation = useCallback((retryCallback) => {
    pendingBookingRetryRef.current = retryCallback;
    setShowPickupPicker(true);
  }, []);

  const handlePickupLocationConfirmed = useCallback((locData) => {
    setShowPickupPicker(false);
    const pinCoords = {
      lat: Number(locData.lat),
      lng: Number(locData.lng),
      address: locData.address || 'Saved Farm Pickup Location',
      isLive: false
    };
    setFarmerCoords(pinCoords);
    calculateAllMandiDistances(pinCoords).then((matrix) => {
      setMandiMatrix(matrix);
    });

    // Auto-retry pending booking attempt immediately
    if (pendingBookingRetryRef.current) {
      const retryFn = pendingBookingRetryRef.current;
      pendingBookingRetryRef.current = null;
      setTimeout(() => {
        retryFn(pinCoords);
      }, 150);
    }
  }, []);


  // 2. Initialize storage, Socket.IO listeners, dues profile, and load from MongoDB Atlas
  useEffect(() => {
    initializeStorage();

    const fetchInitialData = async () => {
      setIsLoadingTokens(true);
      const health = await checkBackendHealth();
      setDbStatus(health);

      const [fetchedTokens, duesData] = await Promise.all([
        getTokensAsync(farmerPhone),
        getFarmerProfileDuesApi(farmerPhone)
      ]);

      if (duesData) {
        setFarmerProfile(duesData);
      }

      if (Array.isArray(fetchedTokens)) {
        setTokens(fetchedTokens);
        fetchedTokens.forEach((t) => {
          joinTokenRoom(t.id || t.tokenNumber);
          if (t.mandiId) joinMandiRoom(t.mandiId);
        });
      }
      setIsLoadingTokens(false);
    };

    fetchInitialData();

    // Subscribe to Socket.IO connection status
    const unsubConn = subscribeConnectionStatus((connected) => {
      setSocketConnected(connected);
    });

    // Listen for live STAGE_UPDATED broadcast from Admin / Officers
    const unsubStage = onStageUpdated((data) => {
      console.log('⚡ [Farmer Command Center] Live STAGE_UPDATED event received:', data);
      const updatedToken = data.token;
      const tokenNum = data.tokenNumber || updatedToken?.tokenNumber || updatedToken?.id;

      setTokens((prev) => {
        const index = prev.findIndex((t) => (t.id || t.tokenNumber) === tokenNum);
        if (index !== -1) {
          const nextTokens = [...prev];
          nextTokens[index] = updatedToken || {
            ...nextTokens[index],
            currentStageIndex: data.stageIndex !== undefined ? data.stageIndex : nextTokens[index].currentStageIndex + 1,
            status: data.status || 'In-Progress'
          };
          return nextTokens;
        }
        return prev;
      });

      setTerminalToken((prevModal) => {
        if (prevModal && (prevModal.id || prevModal.tokenNumber) === tokenNum) {
          return updatedToken || {
            ...prevModal,
            currentStageIndex: data.stageIndex !== undefined ? data.stageIndex : prevModal.currentStageIndex + 1,
            status: data.status || 'In-Progress'
          };
        }
        return prevModal;
      });

      setLiveOfficerToast({
        title: 'Checkpoint Signed Off',
        message: `Officer ${data.officerName || 'Staff'} signed off on ${data.stageTitle || 'Checkpoint'}`,
        tokenNumber: tokenNum,
        officer: data.officerName,
        stage: data.stageTitle
      });

      setTimeout(() => setLiveOfficerToast(null), 5500);
    });

    // ─── 500m Proximity-Based AgriPool Socket Listener ────────────────────────
    const unsubPool = onAgriPoolMatch((data) => {
      console.log('🤝 [AgriPool] Proximity micro-pooling alert received:', data);
      setAgriPoolAlert(data);
      setShowPoolDrawer(true);
    });

    // ─── Real-Time Token Completed & Settlement Listener ───────────────────────
    const unsubCompleted = onTokenCompleted((data) => {
      console.log('🎉 [Farmer Command Center] Live TOKEN_COMPLETED event received:', data);
      const updatedToken = data.token;
      const tokenNum = data.tokenNumber || updatedToken?.tokenNumber || updatedToken?.id;

      setTokens((prev) =>
        prev.map((t) => {
          if ((t.tokenNumber || t.id) === tokenNum) {
            return {
              ...(updatedToken || t),
              status: 'Completed',
              currentStageIndex: 5,
            };
          }
          return t;
        })
      );

      setTerminalToken((prevModal) => {
        if (prevModal && (prevModal.id || prevModal.tokenNumber) === tokenNum) {
          return {
            ...(updatedToken || prevModal),
            status: 'Completed',
            currentStageIndex: 5,
          };
        }
        return prevModal;
      });

      // Clear pending dues on settlement
      setFarmerProfile((prev) => ({
        ...prev,
        pendingDues: 0,
        cancellationHistory: (prev.cancellationHistory || []).map((h) => ({ ...h, status: 'DEDUCTED' }))
      }));

      setLiveOfficerToast({
        title: 'Settlement Paid 🎉',
        message: `Token #${tokenNum} completed! Direct Bank Transfer (DBT) payout cleared. Outstanding dues settled. Account unlocked!`,
        tokenNumber: tokenNum,
        officer: 'Treasury Desk',
        stage: 'Final Accounts Payout'
      });

      setTimeout(() => setLiveOfficerToast(null), 6000);
    });

    // ─── Real-Time Token Cancellation Socket Listener ──────────────────────────
    const unsubCancelled = onTokenCancelled((data) => {
      console.log('🛑 [Farmer Command Center] Live TOKEN_CANCELLED event received:', data);
      const tokenNum = data.tokenNumber;

      setTokens((prev) =>
        prev.map((t) => {
          if ((t.tokenNumber || t.id) === tokenNum) {
            return {
              ...t,
              status: TOKEN_STATUS.CANCELLED,
              cancellationFee: data.penaltyAmount || 0,
              cancelledAt: new Date().toISOString()
            };
          }
          return t;
        })
      );

      if (terminalToken && (terminalToken.tokenNumber || terminalToken.id) === tokenNum) {
        setTerminalToken((prev) => ({
          ...prev,
          status: TOKEN_STATUS.CANCELLED,
          cancellationFee: data.penaltyAmount || 0,
        }));
      }

      setLiveOfficerToast({
        title: 'Booking Cancelled',
        message: `Token #${tokenNum} cancelled. Slot released immediately. Penalty: ₹${data.penaltyAmount || 0}`,
        tokenNumber: tokenNum,
        officer: 'System',
        stage: 'Cancellation'
      });
      setTimeout(() => setLiveOfficerToast(null), 5000);
    });

    // ─── Real-Time Gate Exit Request Socket Listener ────────────────────────────
    const unsubExitReq = onGateExitRequested((data) => {
      const tokenNum = data.tokenNumber;
      setTokens((prev) =>
        prev.map((t) => ((t.tokenNumber || t.id) === tokenNum ? { ...t, status: TOKEN_STATUS.GATE_EXIT_REQUESTED } : t))
      );
      if (terminalToken && (terminalToken.tokenNumber || terminalToken.id) === tokenNum) {
        setTerminalToken((prev) => ({ ...prev, status: TOKEN_STATUS.GATE_EXIT_REQUESTED }));
      }
    });

    // ─── Real-Time Gate Exit Approval Socket Listener ──────────────────────────
    const unsubExitApproved = onExitApproved((data) => {
      console.log('🚪 [Farmer Command Center] Live EXIT_APPROVED event received:', data);
      const tokenNum = data.tokenNumber;

      setTokens((prev) =>
        prev.map((t) => {
          if ((t.tokenNumber || t.id) === tokenNum) {
            return {
              ...t,
              status: TOKEN_STATUS.CANCELLED,
              cancellationFee: data.penaltyAmount || 0,
              gateExitApprovedBy: data.gateExitApprovedBy,
              cancelledAt: new Date().toISOString()
            };
          }
          return t;
        })
      );

      if (terminalToken && (terminalToken.tokenNumber || terminalToken.id) === tokenNum) {
        setTerminalToken((prev) => ({
          ...prev,
          status: TOKEN_STATUS.CANCELLED,
          cancellationFee: data.penaltyAmount || 0,
          gateExitApprovedBy: data.gateExitApprovedBy,
        }));
      }

      // Refresh dues profile
      getFarmerProfileDuesApi(farmerPhone).then((dues) => {
        if (dues) setFarmerProfile(dues);
      });

      setLiveOfficerToast({
        title: 'Gate Exit Approved 🟢',
        message: `Gate exit authorized for #${tokenNum}. Boom barrier opened. Penalty fee: ₹${data.penaltyAmount || 0}. Account unlocked!`,
        tokenNumber: tokenNum,
        officer: data.gateExitApprovedBy || 'Security Desk',
        stage: 'Gate Exit Clearance'
      });
      setTimeout(() => setLiveOfficerToast(null), 6000);
    });

    // ─── Real-Time Farmer Dues Update Listener ─────────────────────────────────
    const unsubDues = onFarmerDuesUpdated((data) => {
      if (data.phone === farmerPhone) {
        setFarmerProfile({
          pendingDues: data.pendingDues || 0,
          cancellationHistory: data.cancellationHistory || []
        });
      }
    });

    // ─── Real-Time Queue Slot Freed Listener ───────────────────────────────────
    const unsubFreed = onQueueSlotFreed(() => {
      getTokensAsync(farmerPhone).then((fresh) => {
        if (Array.isArray(fresh)) setTokens(fresh);
      });
    });

    // Periodic health check & fallback polling (every 4s if socket disconnected)
    const interval = setInterval(async () => {
      const health = await checkBackendHealth();
      setDbStatus(health);

      if (!socketConnected) {
        const [polled, dues] = await Promise.all([
          getTokensAsync(farmerPhone),
          getFarmerProfileDuesApi(farmerPhone)
        ]);
        if (Array.isArray(polled)) setTokens(polled);
        if (dues) setFarmerProfile(dues);
      }
    }, 4000);

    return () => {
      unsubConn();
      unsubStage();
      unsubPool();
      unsubCompleted();
      unsubCancelled();
      unsubExitReq();
      unsubExitApproved();
      unsubDues();
      unsubFreed();
      clearInterval(interval);
    };
  }, [farmerPhone, socketConnected, terminalToken]);

  const refreshTokens = useCallback(async () => {
    setIsLoadingTokens(true);
    const [fresh, dues] = await Promise.all([
      getTokensAsync(farmerPhone),
      getFarmerProfileDuesApi(farmerPhone)
    ]);
    setTokens(fresh || getFarmerTokens(farmerPhone));
    if (dues) setFarmerProfile(dues);
    setIsLoadingTokens(false);
  }, [farmerPhone]);

  const handleMandiSelect = (mandi) => {
    setSelectedMandi(mandi);
  };

  const handleBooked = (newToken) => {
    joinTokenRoom(newToken.id || newToken.tokenNumber);
    if (newToken.mandiId) joinMandiRoom(newToken.mandiId);

    refreshTokens();
    setSelectedMandi(null);
    setActiveTab('TOKENS');
  };

  const handleConfirmVoiceBooking = async ({ id, mandi, crop, quantity, slot, coords }) => {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const quantityBand = `${quantity} Quintals`;
    const effLat = coords?.lat || (user?.pickupLocation?.coordinates ? user?.pickupLocation?.coordinates?.[1] : 19.8928);
    const effLng = coords?.lng || (user?.pickupLocation?.coordinates ? user?.pickupLocation?.coordinates?.[0] : 74.4820);

    const token = buildNewToken({
      id,
      mandiId: mandi.id,
      mandiName: mandi.name,
      mandiCode: mandi.code.split('-')[1] || 'KPG',
      farmerName,
      phone: farmerPhone,
      crop,
      quantityBand,
      quantity,
      slotLabel: slot.label.trim(),
      slotDate: today,
      latitude: effLat,
      longitude: effLng
    });

    const queuePos = addTokenToPipeline(mandi.id, {
      tokenId: token.id,
      farmerName,
      crop,
      status: 'BOOKED',
    });
    token.queuePosition = queuePos + 7;

    const saved = await saveTokenAsync(token);
    handleBooked(saved || token);
    return saved || token;
  };

  const handleOpenTerminal = (token) => {
    const fresh = getFarmerTokens(farmerPhone).find((t) => t.id === token.id || t.tokenNumber === token.tokenNumber) || token;
    setTerminalToken(fresh);
    joinTokenRoom(fresh.id || fresh.tokenNumber);
  };

  const handleStageUpdate = (updatedToken) => {
    setTokens((prev) => prev.map((t) => (t.id === updatedToken.id || t.tokenNumber === updatedToken.tokenNumber) ? updatedToken : t));
    setTerminalToken(updatedToken);
  };

  // ─── Cancellation & Gate Exit Action Handlers ───────────────────────────
  const handleOpenCancelModal = (tok) => {
    setCancelModalToken(tok);
  };

  const handleConfirmCancel = async (tok, reason, penalty) => {
    setIsCancelling(true);
    try {
      const tokenId = tok.id || tok.tokenNumber;
      const res = await cancelTokenApi(tokenId, reason);
      
      setTokens((prev) =>
        prev.map((t) =>
          (t.id === tokenId || t.tokenNumber === tokenId)
            ? { ...t, status: TOKEN_STATUS.CANCELLED, cancellationFee: penalty, cancelledAt: new Date().toISOString() }
            : t
        )
      );

      // Refresh dues profile
      const updatedDues = await getFarmerProfileDuesApi(farmerPhone);
      if (updatedDues) setFarmerProfile(updatedDues);

      setCancelModalToken(null);
      setLiveOfficerToast({
        title: 'Booking Cancelled',
        message: `Token #${tokenId} cancelled. Slot released. Penalty: ₹${penalty}`,
        tokenNumber: tokenId,
        officer: 'Self',
        stage: 'Pre-Gate Cancellation'
      });
      setTimeout(() => setLiveOfficerToast(null), 5000);
    } catch (err) {
      alert(err.message || 'Failed to cancel booking.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRequestGateExit = async (tok) => {
    const tokenId = tok.id || tok.tokenNumber;
    try {
      await requestGateExitApi(tokenId, 'Produce rejection / Driver requested gate exit');
      setTokens((prev) =>
        prev.map((t) =>
          (t.id === tokenId || t.tokenNumber === tokenId)
            ? { ...t, status: TOKEN_STATUS.GATE_EXIT_REQUESTED }
            : t
        )
      );
      setLiveOfficerToast({
        title: 'Exit Request Submitted',
        message: `Vehicle #${tokenId} requested gate exit. Security Officer notified to open boom barrier.`,
        tokenNumber: tokenId,
        officer: 'Security Desk',
        stage: 'Gate Exit Request'
      });
      setTimeout(() => setLiveOfficerToast(null), 5500);
    } catch (err) {
      alert('Failed to submit exit request.');
    }
  };

  // ─── Strict Single-Active-Token Constraint Computation ──────────────────
  const activeToken = tokens.find((t) => isTokenActive(t?.status));
  const hasActiveBooking = Boolean(activeToken);
  const activeTokenCount = tokens.filter((t) => isTokenActive(t?.status)).length;


  const handleViewActiveToken = (tok) => {
    const target = tok || activeToken;
    setActiveTab('TOKENS');
    if (target) {
      handleOpenTerminal(target);
    }
  };

  // ─── Production Navigation Tabs (Strictly No Demo Switcher) ──────────────
  const TABS = [
    { id: 'DISCOVERY', label: 'Mandi Discovery & Booking', icon: <MapPin className="w-4 h-4" /> },
    {
      id: 'TOKENS',
      label: 'My Active Tokens',
      icon: <Ticket className="w-4 h-4" />,
      badge: activeTokenCount > 0 ? activeTokenCount : null,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {/* ── Real-Time Live Officer Sign-Off Toast ─────────────────────────────── */}
      {liveOfficerToast && (
        <div className="fixed top-20 right-6 z-50 animate-bounce bg-emerald-950 border-2 border-emerald-400 text-white px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-md max-w-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                {liveOfficerToast.title}
              </h4>
              <span className="text-[10px] font-mono font-bold bg-emerald-900 px-2 py-0.5 rounded text-emerald-300">
                {liveOfficerToast.tokenNumber}
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-1 leading-snug">{liveOfficerToast.message}</p>
          </div>
        </div>
      )}

      {/* ── Official Indian Government Header ───────────────────────────────── */}
      <GovHeader
        portalType="farmer"
        activeMandi={null}
        onMandiChange={null}
        onOpenResetModal={null}
      />

      {/* ── Modern Farmer Command Sub-Bar ─────────────────────────────────── */}
      <div className="bg-white/95 backdrop-blur-md text-slate-800 border-b border-slate-200 sticky top-16 z-30 shadow-xs">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-4">
            
            {/* Center Tabs & Voice Booking Entry */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 border border-slate-200">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all relative ${
                      activeTab === tab.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                    {tab.badge && (
                      <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Simulated Voice Booking Quick Trigger */}
              <button
                type="button"
                onClick={() => {
                  if (hasActiveBooking) {
                    handleViewActiveToken(activeToken);
                  } else {
                    setShowVoiceModal(true);
                  }
                }}
                className={`hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs border ${
                  hasActiveBooking
                    ? 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/80 cursor-pointer'
                    : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white border-emerald-500 shadow-emerald-200/50 hover:shadow-md'
                }`}
                title={hasActiveBooking ? `Active booking in progress (${activeToken?.tokenNumber || activeToken?.id})` : 'Voice Booking (Demo Mode)'}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-100"></span>
                </span>
                <Mic className="w-3.5 h-3.5" />
                <span>Voice Booking</span>
                <span className="text-[9px] font-black uppercase bg-white/20 text-white px-1.5 py-0.5 rounded tracking-wider">
                  DEMO
                </span>
              </button>
            </div>

            {/* Right Group: Farmer Dues Badge + AgriPool Alert + DB Status + Farmer Badge + Logout */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Farmer Portfolio / Account Dues Badge Button */}
              <button
                type="button"
                onClick={() => setShowDuesModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                  farmerProfile.pendingDues > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-400/20 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
                title="View Farmer Portfolio & Cancellation Penalty Ledger"
              >
                <Wallet className="w-3.5 h-3.5 text-amber-500" />
                <span>Dues: ₹{farmerProfile.pendingDues || 0}</span>
                {farmerProfile.pendingDues > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>

              {/* AgriPool Notification Bell */}
              <button
                type="button"
                onClick={() => setShowPoolDrawer(!showPoolDrawer)}
                className={`relative p-2 rounded-xl border transition-all ${
                  agriPoolAlert
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-400/20'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title="Freight Pooling Alerts (AgriPool 500m Engine)"
              >
                <Bell className="w-4 h-4" />
                {agriPoolAlert && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                    1
                  </span>
                )}
              </button>

              {/* Real-time Socket / MongoDB Connection Pill */}
              <div
                className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                  socketConnected && dbStatus.database === 'connected'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : socketConnected
                    ? 'bg-slate-50 text-slate-700 border-slate-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
                title={
                  socketConnected
                    ? 'Connected to Live Cluster via Socket.IO'
                    : 'WebSocket Reconnecting... Using 4s HTTP Polling'
                }
              >
                <Database className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>
                  {dbStatus.database === 'connected' ? 'Atlas Live' : 'Standby'}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {socketConnected ? '⚡ Real-Time' : '🟠 Polling'}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              </div>

              {/* Farmer Badge */}
              <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center shadow-xs">
                  <span className="text-white text-xs font-black">{farmerName[0]}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 leading-none">{farmerName}</p>
                  <p className="text-[10px] text-slate-500 leading-none mt-0.5 flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                    {farmerCoords?.isLive ? 'Live GPS' : 'Kopargaon (MH)'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>



      {/* ─── 500m Proximity-Based AgriPool Micro-Pooling Alert Drawer ────────── */}
      {agriPoolAlert && showPoolDrawer && (
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white border-b-2 border-emerald-400 py-3.5 px-4 sm:px-6 relative shadow-xl animate-fadeIn">
          <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 text-xl shadow-inner">
                🤝
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black tracking-wider uppercase text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/30">
                    500m AgriPool Proximity Opportunity
                  </span>
                  <span className="text-[11px] text-slate-300 font-mono">
                    ~{agriPoolAlert.distanceMeters || 320}m from your farm
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-1">
                  Freight Pool Match: Farmer heading to APMC {agriPoolAlert.mandiName?.replace('APMC ', '') || 'Kopargaon'} today!
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                  {agriPoolAlert.message || `A farmer within 500m of your location is heading to APMC ${agriPoolAlert.mandiName} today. Merge your load to save transport costs!`}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-emerald-300">
                  <span>Peer: <strong>{agriPoolAlert.farmer2?.name || 'Local Farmer'}</strong> ({agriPoolAlert.farmer2?.crop || 'Crop'})</span>
                  <span>·</span>
                  <span>Estimated Savings: <strong>{agriPoolAlert.estimatedSavings || '₹750 – ₹1,200'}</strong></span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                type="button"
                onClick={() => {
                  alert(`📞 Connected with ${agriPoolAlert.farmer2?.name || 'Peer Farmer'} (+91 ${agriPoolAlert.farmer2?.phone || '9876543210'}). Micro-freight pooling confirmed for APMC delivery!`);
                }}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/50"
              >
                <Users className="w-3.5 h-3.5" />
                Connect / Pool Freight
              </button>
              <button
                type="button"
                onClick={() => setShowPoolDrawer(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Dismiss Alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Body ─────────────────────────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── TAB: MANDI DISCOVERY ──────────────────────────────────────────── */}
        {activeTab === 'DISCOVERY' && (
          <div>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900">Nearby APMC Mandi Discovery</h1>
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  Showing mandis near <strong className="text-slate-700">Kopargaon, Ahmednagar (MH)</strong> — sorted by distance
                </p>
              </div>

              {/* Voice Booking CTA Button in Discovery Header */}
              <button
                type="button"
                onClick={() => {
                  if (hasActiveBooking) {
                    handleViewActiveToken(activeToken);
                  } else {
                    setShowVoiceModal(true);
                  }
                }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs border ${
                  hasActiveBooking
                    ? 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200/80 cursor-pointer'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20 shadow-emerald-100'
                }`}
              >
                <Mic className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>Try Voice Booking (Demo)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Mandi Cards Grid */}
              <div className="xl:col-span-1 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-slate-700">5 Procurement Centres Found</h2>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Origin: Kopargaon</span>
                </div>
                {MANDIS.map((mandi) => (
                  <MandiCard
                    key={mandi.id}
                    mandi={mandi}
                    routeInfo={mandiMatrix[mandi.id]}
                    onSelect={handleMandiSelect}
                    isSelected={selectedMandi?.id === mandi.id}
                  />
                ))}
              </div>

              {/* Booking Panel */}
              <div className="xl:col-span-2">
                {selectedMandi ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs text-slate-400 font-semibold">RATE COMPARISON & SLOT BOOKING</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                    <BookingPanel
                      key={selectedMandi.id}
                      mandi={selectedMandi}
                      farmerName={farmerName}
                      phone={farmerPhone}
                      onBooked={handleBooked}
                      hasActiveBooking={hasActiveBooking}
                      activeToken={activeToken}
                      onViewActiveToken={handleViewActiveToken}
                      farmerCoords={farmerCoords}
                      pickupLocation={user?.pickupLocation}
                      onRequestPickupLocation={handleRequestPickupLocation}
                    />

                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                      <Building2 className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-base font-bold text-slate-600 mb-2">Select a Mandi to Compare Rates</h3>
                    <p className="text-sm text-slate-400 max-w-sm">
                      Click any mandi card on the left to see live vs. yesterday's rates and book your arrival slot.
                    </p>
                    <div className="mt-6 flex gap-2">
                      {MANDIS.slice(0, 3).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMandi(m)}
                          className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-all"
                        >
                          {m.name.replace('APMC ', '')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: MY ACTIVE TOKENS ─────────────────────────────────────────── */}
        {activeTab === 'TOKENS' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900">My Active Tokens</h1>
                <p className="text-sm text-slate-500 mt-1">
                  {tokens.length === 0
                    ? 'No tokens yet. Book a slot to get started.'
                    : `${tokens.length} token${tokens.length > 1 ? 's' : ''} — ${activeTokenCount} active`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (hasActiveBooking) {
                      handleViewActiveToken(activeToken);
                    } else {
                      setShowVoiceModal(true);
                    }
                  }}
                  className={`hidden sm:flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all ${
                    hasActiveBooking
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                  }`}
                  title={hasActiveBooking ? 'Active booking already in progress' : 'Simulate Voice Booking'}
                >
                  <Mic className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Voice Booking</span>
                </button>
                <button
                  type="button"
                  onClick={refreshTokens}
                  className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('DISCOVERY')}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all shadow-sm"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  Book New Slot
                </button>
              </div>
            </div>

            {/* Skeleton Loader during fetch */}
            {isLoadingTokens ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {[1, 2].map((n) => (
                  <div key={n} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse space-y-4 shadow-sm">
                    <div className="flex justify-between items-center">
                      <div className="h-6 w-24 bg-slate-200 rounded-full" />
                      <div className="h-12 w-12 bg-slate-100 rounded-xl" />
                    </div>
                    <div className="h-8 w-44 bg-slate-200 rounded-lg" />
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((c) => (
                        <div key={c} className="h-14 bg-slate-100 rounded-xl" />
                      ))}
                    </div>
                    <div className="h-20 bg-slate-50 rounded-xl" />
                    <div className="h-10 bg-slate-200 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : tokens.length === 0 ? (
              /* Empty state illustration */
              <div className="bg-white rounded-2xl border border-slate-200 py-20 px-4 text-center max-w-lg mx-auto shadow-sm">
                <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-500 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Ticket className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-1">No Active Mandi Bookings</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
                  You have no active mandi bookings. Discover a nearby APMC to book a slot.
                </p>
                <button
                  onClick={() => setActiveTab('DISCOVERY')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-md shadow-emerald-200"
                >
                  <MapPin className="w-4 h-4" /> Discover Nearby APMCs
                </button>
              </div>
            ) : (
              /* Token Cards Grid */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {tokens.map((token) => (
                  <TokenCard
                    key={token.id || token.tokenNumber}
                    token={token}
                    onOpenTerminal={handleOpenTerminal}
                    onOpenCancelModal={handleOpenCancelModal}
                    onRequestGateExit={handleRequestGateExit}
                    farmerCoords={farmerCoords}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Live Queue Terminal Modal ──────────────────────────────────────────── */}
      {terminalToken && (
        <QueueTerminalModal
          token={terminalToken}
          onClose={() => setTerminalToken(null)}
          onStageUpdate={handleStageUpdate}
          onOpenCancelModal={handleOpenCancelModal}
          onRequestGateExit={handleRequestGateExit}
          farmerCoords={farmerCoords}
        />
      )}

      {/* ── Pre-Gate Cancellation Modal ────────────────────────────────────────── */}
      {cancelModalToken && (
        <CancellationModal
          token={cancelModalToken}
          onClose={() => setCancelModalToken(null)}
          onConfirmCancel={handleConfirmCancel}
          isCancelling={isCancelling}
        />
      )}

      {/* ── Farmer Portfolio & Penalty Dues Ledger Modal ──────────────────────── */}
      {showDuesModal && (
        <FarmerDuesModal
          farmerProfile={farmerProfile}
          farmerName={farmerName}
          farmerPhone={farmerPhone}
          onClose={() => setShowDuesModal(false)}
        />
      )}

      {/* ── Pickup Location Pin Modal ────────────────────────────────────────── */}
      {showPickupPicker && (
        <PickupLocationPicker
          isOpen={showPickupPicker}
          onClose={() => {
            setShowPickupPicker(false);
            pendingBookingRetryRef.current = null;
          }}
          onConfirm={handlePickupLocationConfirmed}
          initialCoords={farmerCoords}
        />
      )}

      {/* ── Simulated Voice Booking Modal (Demo Mode) ────────────────────────── */}
      {showVoiceModal && (
        <VoiceBookingModal
          isOpen={showVoiceModal}
          onClose={() => setShowVoiceModal(false)}
          onConfirmBooking={handleConfirmVoiceBooking}
          defaultMandi={selectedMandi || MANDIS[0]}
          farmerName={farmerName}
          farmerPhone={farmerPhone}
          farmerCoords={farmerCoords}
          pickupLocation={user?.pickupLocation}
          onRequestPickupLocation={handleRequestPickupLocation}
          hasActiveBooking={hasActiveBooking}
          activeToken={activeToken}
        />
      )}
    </div>
  );
}

