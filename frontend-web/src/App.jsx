import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing              from './pages/Landing';
import FarmerLogin          from './pages/FarmerLogin';
import OTPVerify            from './pages/OTPVerify';
import Dashboard            from './pages/Dashboard';
import MandiSelection       from './pages/MandiSelection';
import BookSlot             from './pages/BookSlot';
import LiveToken            from './pages/LiveToken';
import StaffLogin           from './pages/StaffLogin';
import GuardTerminal        from './pages/GuardTerminal';
import WeighmasterDesk      from './pages/WeighmasterDesk';
import SupervisorExceptions from './pages/SupervisorExceptions';
import AdminDashboard       from './pages/AdminDashboard';
import NotFound             from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Gateway */}
        <Route path="/"              element={<Landing />} />

        {/* Farmer Flow */}
        <Route path="/farmer-login"  element={<FarmerLogin />} />
        <Route path="/login"         element={<Navigate to="/farmer-login" replace />} />
        <Route path="/verify"        element={<OTPVerify />} />
        <Route path="/otp-verify"    element={<OTPVerify />} />
        <Route path="/dashboard"     element={<Dashboard />} />
        <Route path="/mandi-selection" element={<MandiSelection />} />
        <Route path="/book-slot"     element={<BookSlot />} />
        <Route path="/live-token"    element={<LiveToken />} />

        {/* Staff Flow */}
        <Route path="/staff-login"   element={<StaffLogin />} />
        <Route path="/guard-terminal" element={<GuardTerminal />} />
        <Route path="/weighmaster-desk" element={<WeighmasterDesk />} />
        <Route path="/supervisor-exceptions" element={<SupervisorExceptions />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />

        {/* 404 Fallback */}
        <Route path="*"              element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
