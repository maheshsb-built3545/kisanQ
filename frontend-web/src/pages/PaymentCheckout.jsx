import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

export default function PaymentCheckout() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const lot   = state?.lot  || { token: 'KQ-108', farmer: 'रामचंद्र पाटील', crop: '🧅 प्याज', qty: 48.5 };
  const bid   = state?.bid  || 3150;
  const grade = state?.grade || 'A';
  const gradeQty = lot.gradeBreakdown?.find(g => g.g === grade)?.qty || lot.qty;
  const gross = (bid * gradeQty).toFixed(2);
  const commission = (gross * 0.015).toFixed(2);  // 1.5% mandi tax
  const transport  = 250;
  const weighing   = 50;
  const net  = (gross - commission - transport - weighing).toFixed(2);

  const [method, setMethod] = useState('upi');
  const [upiId, setUpiId] = useState('9876543210@okaxis');
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      await api.post('/payments', { bookingId: lot._id, amount: Number(net), method, upiId });
    } catch {}
    setTimeout(() => { setLoading(false); setPaid(true); }, 1800);
  };

  if (paid) return (
    <main className="flex flex-col min-h-screen bg-surface items-center justify-center px-4 font-jakarta">
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        {/* Header */}
        <header className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
          <span className="text-xs font-extrabold text-secondary uppercase tracking-wider block mb-1">
            <span className="material-symbols-outlined text-base align-middle">receipt_long</span>
            Direct Mandi Payout Settlement
          </span>
          <h1 className="text-xl font-bold text-on-surface">भुगतान एवं भुगतान रसीद</h1>
          <p className="text-sm text-on-surface-variant">Farmer Direct Payout &amp; Mandi Slip</p>
        </header>

        {/* Backend In Development Banner */}
        <div className="p-3 bg-tertiary-fixed text-on-tertiary-fixed rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
          <span className="material-symbols-outlined text-base shrink-0">engineering</span>
          <span>[Backend Notice] Direct payment gateway integration is in development. Displaying settlement slip preview.</span>
        </div>
        <div className="bg-surface-container-lowest rounded-2xl p-6 w-full shadow-md text-left space-y-2">
          <div className="flex justify-between"><span className="text-sm text-on-surface-variant">किसान</span><span className="text-sm font-bold">{lot.farmer}</span></div>
          <div className="flex justify-between"><span className="text-sm text-on-surface-variant">टोकन</span><span className="text-sm font-bold">{lot.token}</span></div>
          <div className="flex justify-between"><span className="text-sm text-on-surface-variant">उपज</span><span className="text-sm font-bold">{lot.crop}</span></div>
          <div className="h-px bg-outline-variant my-2" />
          <div className="flex justify-between"><span className="text-lg font-extrabold text-on-surface">शुद्ध भुगतान</span><span className="text-lg font-extrabold text-secondary">₹{Number(net).toLocaleString('hi-IN')}</span></div>
        </div>
        <button onClick={() => navigate('/mandi-selection')} className="btn-primary">
          <span className="material-symbols-outlined">storefront</span>
          <span>मंडी में वापस जाएं</span>
        </button>
      </div>
    </main>
  );

  return (
    <main className="flex flex-col min-h-screen bg-surface px-4 py-4 pb-4 font-jakarta">
      <div className="flex flex-col w-full max-w-md mx-auto gap-4">

        {/* Header */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-lg">KQ</div>
            <div>
              <span className="block text-lg font-bold text-primary">KisanQ</span>
              <span className="block text-xs text-on-surface-variant">Payment & Settlement</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-secondary-fixed text-on-secondary-fixed px-3 py-1.5 rounded-full text-xs font-extrabold">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            Secure Checkout
          </div>
        </header>

        {/* Sale summary */}
        <section className="bg-surface-container-lowest rounded-xl shadow-md p-4">
          <h2 className="text-sm font-extrabold text-on-surface-variant uppercase mb-3">विक्रय सारांश / Sale Summary</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-secondary-container flex items-center justify-center text-3xl">🧅</div>
            <div>
              <span className="block text-xl font-bold text-on-surface">{lot.crop}</span>
              <span className="block text-sm text-on-surface-variant">ग्रेड {grade} • {gradeQty} क्विंटल • {lot.token}</span>
            </div>
          </div>
          <div className="space-y-2">
            {[
              ['बोली दर (Hammer Rate)', `₹${bid.toLocaleString('hi-IN')}/क्विंटल`],
              ['कुल वजन', `${gradeQty} क्विंटल`],
              ['सकल राशि (Gross)', `₹${Number(gross).toLocaleString('hi-IN')}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-sm text-on-surface-variant">{k}</span><span className="text-sm font-bold text-on-surface">{v}</span></div>
            ))}
            <div className="h-px bg-outline-variant/40 my-1" />
            <div className="flex justify-between"><span className="text-sm text-on-surface-variant">मंडी कर (1.5%)</span><span className="text-sm font-bold text-error">- ₹{Number(commission).toLocaleString('hi-IN')}</span></div>
            <div className="flex justify-between"><span className="text-sm text-on-surface-variant">ढुलाई / Transport</span><span className="text-sm font-bold text-error">- ₹{transport}</span></div>
            <div className="flex justify-between"><span className="text-sm text-on-surface-variant">तौल शुल्क / Weighing</span><span className="text-sm font-bold text-error">- ₹{weighing}</span></div>
            <div className="h-px bg-outline-variant/40 my-1" />
            <div className="flex justify-between bg-primary-fixed rounded-xl px-3 py-3">
              <span className="text-lg font-extrabold text-on-primary-fixed">शुद्ध भुगतान (Net)</span>
              <span className="text-xl font-black text-primary">₹{Number(net).toLocaleString('hi-IN')}</span>
            </div>
          </div>
        </section>

        {/* Payment method */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-extrabold text-on-surface-variant uppercase mb-3">भुगतान विधि / Payment Method</h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[['upi', '📱 UPI'], ['neft', '🏦 NEFT'], ['cash', '💵 Cash']].map(([m, label]) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`h-14 rounded-xl text-sm font-bold ${method === m ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container text-on-surface'}`}
              >{label}</button>
            ))}
          </div>

          {method === 'upi' && (
            <div>
              <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-xl mb-3">
                <span className="material-symbols-outlined text-secondary text-xl">account_balance_wallet</span>
                <input
                  className="flex-1 text-sm font-bold text-on-surface bg-transparent outline-none"
                  placeholder="UPI ID (e.g. 9876543210@okaxis)"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </div>
              <div className="bg-secondary-fixed/30 rounded-xl p-3 flex items-start gap-2">
                <span className="material-symbols-outlined text-secondary text-xl shrink-0">info</span>
                <div>
                  <span className="block text-sm font-bold text-on-surface">No Aadhaar / Bank Account Number required</span>
                  <span className="block text-xs text-on-surface-variant mt-0.5">मंडी केवल UPI ID या NEFT Account Number का उपयोग करती है। आधार कार्ड नहीं मांगा जाएगा।</span>
                </div>
              </div>
            </div>
          )}

          {method === 'neft' && (
            <div className="space-y-2">
              {[['बैंक का नाम / Bank', 'State Bank of India'], ['खाता नं. (Account)', '****8542 (Masked)'], ['IFSC', 'SBIN0000123']].map(([k, v]) => (
                <div key={k} className="flex justify-between bg-surface-container-low px-3 py-2 rounded-lg">
                  <span className="text-sm text-on-surface-variant">{k}</span>
                  <span className="text-sm font-bold text-on-surface">{v}</span>
                </div>
              ))}
            </div>
          )}

          {method === 'cash' && (
            <div className="bg-tertiary-fixed rounded-xl p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-on-tertiary-fixed text-2xl">payments</span>
              <div>
                <span className="block text-sm font-bold text-on-tertiary-fixed">मंडी कार्यालय में नकद भुगतान</span>
                <span className="block text-xs text-on-tertiary-fixed/80 mt-0.5">Counter Window No. 5 • Gate 2 Admin Block</span>
              </div>
            </div>
          )}
        </section>

        {/* Government assurance */}
        <div className="bg-surface-container rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-secondary text-2xl shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>assured_workload</span>
          <div>
            <span className="block text-sm font-bold text-on-surface">भुगतान सुरक्षा गारंटी</span>
            <ul className="text-xs text-on-surface-variant mt-1 space-y-0.5 list-disc list-inside">
              <li>24 घंटे में UPI/NEFT ट्रांसफर</li>
              <li>पूर्ण भुगतान रसीद / Digital Receipt</li>
              <li>No Aadhaar, No Bank statements required</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <button
          className="btn-primary"
          onClick={handlePay}
          disabled={loading}
        >
          {loading
            ? <><span className="material-symbols-outlined animate-spin">autorenew</span><span>प्रोसेस हो रहा है...</span></>
            : <><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span><span>₹{Number(net).toLocaleString('hi-IN')} – भुगतान की पुष्टि करें</span></>
          }
        </button>

      </div>
    </main>
  );
}
