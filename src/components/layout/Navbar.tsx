'use client';

// src/components/layout/Navbar.tsx - Universal Application Header & Status Bar

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';
import { Award, Shield, User, LogOut, Radio, PlayCircle, Settings } from 'lucide-react';

export function Navbar({ environment = 'live' }: { environment?: 'live' | 'practice' }) {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      {/* Practice Mode Alert Banner */}
      {environment === 'practice' && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs font-bold tracking-wide text-amber-400 flex items-center justify-center gap-2">
          <span>⚠ PRACTICE MODE ACTIVE</span>
          <span className="text-[10px] font-normal text-amber-300/80">— Scores entered here will not affect official records.</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 p-0.5 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Award className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-white text-base leading-tight tracking-tight">MusicScore</span>
            <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">Digital Judging Suite</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 text-sm">
          <Link
            href="/live"
            className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-1.5"
          >
            <Radio className="w-4 h-4 text-rose-400" />
            <span>Live Scoreboard</span>
          </Link>

          {(user?.role === 'judge' || user?.role === 'admin' || user?.role === 'super_admin') && (
            <Link
              href="/judge"
              className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-1.5"
            >
              <PlayCircle className="w-4 h-4 text-emerald-400" />
              <span>Judge Console</span>
            </Link>
          )}

          {(user?.role === 'event_operator' || user?.role === 'admin' || user?.role === 'super_admin') && (
            <Link
              href="/admin/control-room"
              className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-1.5"
            >
              <Radio className="w-4 h-4 text-indigo-400" />
              <span>Control Room</span>
            </Link>
          )}

          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Link
              href="/admin/dashboard"
              className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-1.5"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>Admin Suite</span>
            </Link>
          )}
        </nav>

        {/* User Role Badge & Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-200">{user.fullName}</span>
                <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  {user.role.replace('_', ' ')}
                </span>
              </div>

              <button
                onClick={() => signOut()}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Judge / Admin Login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
