import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login               from './pages/Login';
import OTPVerify           from './pages/OTPVerify';
import MandiSelection      from './pages/MandiSelection';
import BookSlot            from './pages/BookSlot';
import LiveToken           from './pages/LiveToken';
import GuardTerminal       from './pages/GuardTerminal';
import AuctionBoard        from './pages/AuctionBoard';
import PaymentCheckout     from './pages/PaymentCheckout';
import StaffLogin          from './pages/StaffLogin';
import SupervisorExceptions from './pages/SupervisorExceptions';
import Dashboard           from './pages/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Farmer Auth Flow */}
        <Route path="/"              element={<Login />} />
        <Route path="/otp-verify"    element={<OTPVerify />} />

        {/* Farmer Booking & Token Flow */}
        <Route path="/mandi-selection"  element={<MandiSelection />} />
        <Route path="/book-slot"        element={<BookSlot />} />
        <Route path="/live-token"       element={<LiveToken />} />

        {/* Staff / Mandi Operations */}
        <Route path="/staff-login"         element={<StaffLogin />} />
        <Route path="/guard-terminal"      element={<GuardTerminal />} />
        <Route path="/auction-board"       element={<AuctionBoard />} />
        <Route path="/payment-checkout"    element={<PaymentCheckout />} />
        <Route path="/supervisor-exceptions" element={<SupervisorExceptions />} />

        {/* Landing Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
