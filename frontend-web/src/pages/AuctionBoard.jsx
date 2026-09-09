import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const MOCK_LOTS = [
  {
    _id: 'lot-001', token: 'KQ-108', farmer: 'रामचंद्र पाटील', crop: '🧅 प्याज / Red Onion',
    qty: 48.5, gradeBreakdown: [{ g: 'A', pct: 62, qty: 30.0 }, { g: 'B', pct: 25, qty: 12.1 }, { g: 'C', pct: 13, qty: 6.4 }],
    arrivedAt: '08:42 AM', status: 'under_auction', weighbridgeId: 'WB-03', laneId: 'Lane B',
  },
];

const BIDDERS = [
  { id: 'TR-001', name: 'श्री कमोडिटी', grade: 'A', bid: 2890, time: '2 mins ago' },
  { id: 'TR-002', name: 'महाराष्ट्र ट्रेडिंग', grade: 'A', bid: 3020, time: '1 min ago' },
  { id: 'TR-003', name: 'नासिक एग्रो', grade: 'A', bid: 3150, time: '30 secs ago' },
];

export default function AuctionBoard() {
  const navigate = useNavigate();
  const [lots, setLots] = useState(MOCK_LOTS);
  const [activeLot, setActiveLot] = useState(MOCK_LOTS[0]);
  const [grade, setGrade] = useState('A');
  const [bidInput, setBidInput] = useState('');
  const [bids, setBids] = useState(BIDDERS);
  const [hammer, setHammer] = useState(false);
  const [bidError, setBidError] = useState('');

  const highestBid = Math.max(...bids.filter(b => b.grade === grade).map(b => b.bid), 0);

  const handleBid = () => {
    const amt = Number(bidInput);
    if (!amt || amt <= highestBid) {
      setBidError('बोली वर्तमान उच्चतम बोली से अधिक होनी चाहिए।');
      return;
    }
    setBidError('');
    setBids(prev => [{ id: `TR-${Date.now()}`, name: 'नई बोली', grade, bid: amt, time: 'अभी' }, ...prev]);
    setBidInput('');
  };

  const handleHammer = () => {
    setHammer(true);
    setTimeout(() => navigate('/payment-checkout', { state: { lot: activeLot, bid: highestBid, grade } }), 1500);
  };

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-4 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="bg-primary rounded-xl p-4 shadow-md flex items-start justify-between">
          <div>
            <span className="text-on-primary/70 text-xs font-extrabold uppercase tracking-wider block mb-1">
              <span className="material-symbols-outlined text-base align-middle">gavel</span>
              नीलामी बोर्ड / Live Auction
            </span>
            <h1 className="text-xl font-bold text-on-primary">{activeLot.crop}</h1>
            <p className="text-sm text-on-primary/80">{activeLot.farmer} • Token {activeLot.token}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 bg-secondary-fixed text-on-secondary-fixed px-2 py-1 rounded-full text-xs font-extrabold">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
              LIVE
            </div>
            <span className="text-on-primary/70 text-xs">Weighbridge {activeLot.weighbridgeId}</span>
          </div>
        </header>

        {/* Weighbridge results */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-extrabold text-on-surface-variant uppercase mb-3">तौल परिणाम / Weighbridge Result</h2>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-primary-fixed rounded-lg p-2 text-center">
              <span className="block text-xs text-on-primary-fixed-variant">कुल वजन</span>
              <span className="block text-xl font-black text-primary">{activeLot.qty}</span>
              <span className="block text-xs text-on-primary-fixed-variant">क्विंटल</span>
            </div>
            <div className="bg-secondary-fixed rounded-lg p-2 text-center">
              <span className="block text-xs text-on-secondary-fixed-variant">आगमन</span>
              <span className="block text-lg font-bold text-on-secondary-fixed">{activeLot.arrivedAt}</span>
              <span className="block text-xs text-on-secondary-fixed-variant">समय</span>
            </div>
            <div className="bg-surface-container-low rounded-lg p-2 text-center">
              <span className="block text-xs text-on-surface-variant">ग्रेड A</span>
              <span className="block text-xl font-black text-secondary">{activeLot.gradeBreakdown[0].pct}%</span>
              <span className="block text-xs text-on-surface-variant">{activeLot.gradeBreakdown[0].qty} क्विं</span>
            </div>
          </div>

          {/* Grade bars */}
          <div className="space-y-2">
            {activeLot.gradeBreakdown.map(({ g, pct, qty }) => (
              <div key={g} className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${g === 'A' ? 'bg-secondary-fixed text-on-secondary-fixed' : g === 'B' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-error-container text-on-error-container'}`}>{g}</span>
                <div className="flex-1 bg-surface-container-low rounded-full h-3 overflow-hidden">
                  <div style={{ width: `${pct}%` }} className={`h-3 rounded-full transition-all ${g === 'A' ? 'bg-secondary' : g === 'B' ? 'bg-tertiary-container' : 'bg-error'}`} />
                </div>
                <span className="text-sm font-bold text-on-surface w-20 text-right">{qty} क्विंटल ({pct}%)</span>
              </div>
            ))}
          </div>
        </section>

        {/* Grade selector */}
        <div className="flex gap-2">
          {['A', 'B', 'C'].map((g) => (
            <button key={g} onClick={() => setGrade(g)} className={`flex-1 h-12 rounded-xl text-sm font-bold shadow-sm ${grade === g ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}`}>
              Grade {g} {g === 'A' ? '★' : g === 'B' ? '☆' : '○'}
            </button>
          ))}
        </div>

        {/* Live bids */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low">
            <h2 className="text-sm font-extrabold text-on-surface uppercase">ग्रेड {grade} की बोलियां</h2>
            <span className="flex items-center gap-1.5 text-xs font-bold text-secondary">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
              लाइव बोली
            </span>
          </div>

          {/* Highest bid */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-outline-variant/30">
            <span className="text-sm text-on-surface-variant">वर्तमान उच्चतम बोली:</span>
            <span className="text-2xl font-black text-secondary">₹{highestBid.toLocaleString('hi-IN')}/क्विं</span>
          </div>

          {bids.filter(b => b.grade === grade).map((b, i) => (
            <div key={b.id} className={`flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 ${i === 0 ? 'bg-secondary-fixed/20' : ''}`}>
              <div className="flex items-center gap-2">
                {i === 0 && <span className="material-symbols-outlined text-secondary text-lg">emoji_events</span>}
                <div>
                  <p className="text-sm font-bold text-on-surface">{b.name}</p>
                  <p className="text-xs text-on-surface-variant">{b.id} • {b.time}</p>
                </div>
              </div>
              <span className={`text-lg font-extrabold ${i === 0 ? 'text-secondary' : 'text-on-surface'}`}>₹{b.bid.toLocaleString('hi-IN')}</span>
            </div>
          ))}
        </section>

        {/* New bid input */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-bold text-on-surface mb-2">नई बोली दर्ज करें (₹/क्विंटल)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={bidInput}
              onChange={(e) => setBidInput(e.target.value)}
              placeholder={`> ₹${highestBid}`}
              className="flex-1 h-14 px-4 text-xl font-bold text-on-surface bg-surface-container-low rounded-xl focus:outline-none"
            />
            <button onClick={handleBid} className="h-14 px-5 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-sm">बोली लगाएं</button>
          </div>
          <div className="flex gap-2 mt-2">
            {[50, 100, 200].map((n) => (
              <button key={n} onClick={() => setBidInput(String(highestBid + n))} className="flex-1 h-11 rounded-lg bg-surface-container text-on-surface text-sm font-bold">+₹{n}</button>
            ))}
          </div>
          {bidError && (
            <p className="text-sm text-error bg-error-container px-3 py-2 rounded-lg mt-2">{bidError}</p>
          )}
        </div>

        {/* Hammer CTA */}
        <button
          className={`w-full h-16 rounded-xl text-base font-bold shadow-xl flex items-center justify-center gap-2 transition-all ${hammer ? 'bg-secondary-fixed text-on-secondary-fixed scale-95' : 'bg-primary text-on-primary'}`}
          onClick={handleHammer}
          disabled={hammer}
        >
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
          {hammer ? 'सौदा पक्का! भुगतान की ओर...' : `हैमर करें – ₹${highestBid.toLocaleString('hi-IN')}/क्विंटल`}
        </button>

      </div>
    </main>
  );
}
