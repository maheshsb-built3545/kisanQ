import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing             from './pages/Landing';
import Login               from './pages/Login';
import OTPVerify           from './pages/OTPVerify';
import MandiSelection      from './pages/MandiSelection';
import BookSlot            from './pages/BookSlot';
import LiveToken           from './pages/LiveToken';
import StaffLogin          from './pages/StaffLogin';
import GuardTerminal       from './pages/GuardTerminal';
import SupervisorExceptions from './pages/SupervisorExceptions';
import WeighmasterDesk     from './pages/WeighmasterDesk';
import AuctionBoard        from './pages/AuctionBoard';
import Dashboard           from './pages/Dashboard';
import NotFound            from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Gateway */}
        <Route path="/" element={<Landing />} />

        {/* Farmer Flow */}
        <Route path="/farmer-login" element={<Login />} />
        <Route path="/login" element={<Navigate to="/farmer-login" replace />} />
        <Route path="/verify" element={<OTPVerify />} />
        <Route path="/otp-verify" element={<Navigate to="/verify" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/mandi-selection" element={<MandiSelection />} />
        <Route path="/book-slot" element={<BookSlot />} />
        <Route path="/live-token" element={<LiveToken />} />

        {/* Staff Flow */}
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/guard-terminal" element={<GuardTerminal />} />
        <Route path="/supervisor-exceptions" element={<SupervisorExceptions />} />
        <Route path="/weighmaster-desk" element={<WeighmasterDesk />} />
        <Route path="/auction-board" element={<AuctionBoard />} />

        {/* 404 Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
