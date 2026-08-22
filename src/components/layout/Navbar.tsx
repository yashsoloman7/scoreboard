'use client';

// src/components/layout/Navbar.tsx - Universal Application Header & Status Bar

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';
import { Award, Shield, User, LogOut, Radio, PlayCircle, Settings, Upload } from 'lucide-react';

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

          {(user?.role === 'event_manager' || user?.role === 'event_operator' || user?.role === 'admin' || user?.role === 'super_admin') && (
            <Link
              href="/admin/staging"
              className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-1.5"
            >
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Stage Manager</span>
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

          {(user?.role === 'event_manager' || user?.role === 'event_operator' || user?.role === 'admin' || user?.role === 'super_admin') && (
            <Link
              href="/admin/import"
              className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Import Sheet</span>
            </Link>
          )}

          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Link
              href="/admin/users"
              className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-1.5"
            >
              <Shield className="w-4 h-4 text-purple-400" />
              <span>User Roles</span>
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
                <div className="flex items-center gap-1">
                  {user.role === 'super_admin' && (
                    <span className="text-[10px] uppercase font-black text-amber-300 bg-gradient-to-r from-amber-500/20 to-purple-500/20 px-2 py-0.5 rounded-md border border-amber-500/40 shadow-sm flex items-center gap-1">
                      <span>👑</span>
                      <span>Super Admin</span>
                    </span>
                  )}
                  {user.role === 'admin' && (
                    <span className="text-[10px] uppercase font-bold text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded-md border border-indigo-500/30 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-indigo-400" />
                      <span>Admin</span>
                    </span>
                  )}
                  {user.role === 'event_manager' && (
                    <span className="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1">
                      <Radio className="w-3 h-3 text-emerald-400" />
                      <span>Stage Manager</span>
                    </span>
                  )}
                  {user.role === 'event_operator' && (
                    <span className="text-[10px] uppercase font-bold text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded-md border border-cyan-500/30 flex items-center gap-1">
                      <Radio className="w-3 h-3 text-cyan-400" />
                      <span>Control Room</span>
                    </span>
                  )}
                  {user.role === 'judge' && (
                    <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-400" />
                      <span>Judge</span>
                    </span>
                  )}
                  {user.role === 'unauthorized' && (
                    <span className="text-[10px] uppercase font-bold text-rose-300 bg-rose-500/15 px-1.5 py-0.5 rounded-md border border-rose-500/30">
                      Pending Auth
                    </span>
                  )}
                </div>
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
              <span>Judge / Staff Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
