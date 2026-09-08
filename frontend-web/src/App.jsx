import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Building2, 
  Scale, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  Radio, 
  CheckCircle2, 
  Clock, 
  ArrowRight 
} from 'lucide-react';

function App() {
  const [backendStatus, setBackendStatus] = useState({ loading: true, online: false, data: null });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus({ loading: false, online: true, data });
      })
      .catch((err) => {
        setBackendStatus({ loading: false, online: false, error: err.message });
      });
  }, []);

  const services = [
    { name: 'Auth Service', desc: 'Minimal identity verification and role-based access', icon: ShieldCheck, route: '/api/auth' },
    { name: 'Booking Service', desc: 'Procurement slot scheduling and quota management', icon: Calendar, route: '/api/bookings' },
    { name: 'Queue Service', desc: 'Real-time queue sequencing and token orchestration', icon: Users, route: '/api/queue' },
    { name: 'Centre Service', desc: 'Procurement centres, bays, and capacity config', icon: Building2, route: '/api/centres' },
    { name: 'Procurement Service', desc: 'Inspection logging, weighbridge records, and receipts', icon: Scale, route: '/api/procurement' },
    { name: 'Exceptions Service', desc: 'Emergency rescheduling and delay management', icon: AlertTriangle, route: '/api/exceptions' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                KisanQ
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                SIH26032
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700/60">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${backendStatus.online ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${backendStatus.online ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span className="text-slate-300">
                Backend API: {backendStatus.loading ? 'Checking...' : backendStatus.online ? 'Connected' : 'Offline / Standby'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full">
        {/* Hero Banner */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300 mb-4">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Modular Monolith Core Architecture Active</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            Smart Slot Booking & <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-green-400 bg-clip-text text-transparent">
              Real-Time Queue Management
            </span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg">
            Streamlining agricultural procurement centre operations, eliminating long waiting hours for farmers, and enabling transparent intake processing.
          </p>
        </div>

        {/* Data Minimization Pledge Banner */}
        <div className="mb-10 p-4 rounded-xl bg-slate-900/80 border border-emerald-500/20 flex items-start sm:items-center space-x-4">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-emerald-300">Strict Data Minimization Guarantee</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              KisanQ does not store raw government identification numbers (no raw Aadhaar, no full bank account numbers). Only tokenized operational references are maintained.
            </p>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((srv, idx) => {
            const Icon = srv.icon;
            return (
              <div
                key={idx}
                className="group relative p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/90 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800/80 group-hover:bg-emerald-500/10 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {srv.route}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  {srv.name}
                </h3>
                <p className="text-sm text-slate-400 mt-2">
                  {srv.desc}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© 2026 KisanQ — Team Aveniq (SIH26032). All rights reserved.</p>
          <div className="flex items-center space-x-6 mt-3 sm:mt-0">
            <span className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Node.js / Express</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Socket.IO</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>React & Tailwind</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
