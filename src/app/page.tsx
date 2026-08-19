import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import Link from 'next/link';
import {
  Award,
  ShieldCheck,
  Radio,
  PlayCircle,
  Settings,
  Lock,
  Clock,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-indigo-400 mb-6 shadow-inner">
          <Award className="w-4 h-4 text-amber-400" />
          <span>State-Level Music Competition & Digital Scrutiny Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight max-w-4xl mx-auto leading-tight">
          Host Events. Score Fairly.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
            Eliminate Bias.
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Production-grade digital judging system with server-authoritative timer synchronization, masked mark inputs,
          automated tie-breaker resolution, and immutable PostgreSQL audit trails.
        </p>

        {/* Quick Portals CTA */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/live"
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-indigo-600/25 transition-all transform active:scale-95"
          >
            <Radio className="w-4 h-4 text-rose-400" />
            <span>View Live Scoreboard</span>
          </Link>

          <Link
            href="/judge"
            className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm flex items-center gap-2.5 border border-slate-800 shadow-lg transition-all"
          >
            <PlayCircle className="w-4 h-4 text-emerald-400" />
            <span>Judge Console</span>
          </Link>

          <Link
            href="/admin/control-room"
            className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm flex items-center gap-2.5 border border-slate-800 shadow-lg transition-all"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>Operator Control Room</span>
          </Link>
        </div>
      </section>

      {/* Core Architectural Guarantees Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white mb-1">Server-Authoritative Scoring</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              PostgreSQL RPC triggers enforce score locking, criteria version immutability, and atomic deduplication at the database tier.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white mb-1">Synchronized Timer Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Live clocks calibrate with sub-second server timestamps, displaying authoritative remaining time, warning thresholds, and overtime.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white mb-1">Multi-Tier Tie Breakers</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deterministic 5-tier tie-breaking evaluating highest averages, priority criteria, and judge standard deviation before audited jury overrides.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-8 px-4 text-center text-xs text-slate-500">
        <p>© 2026 State Music Competition Scrutiny & Digital Judging Platform. Fully Audited & Encrypted.</p>
      </footer>
    </div>
  );
}
