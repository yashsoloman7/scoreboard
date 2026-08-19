'use client';

// src/app/auth/unauthorized/page.tsx - Role Authorization Pending Notice

import React from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { ShieldAlert, RefreshCw, LogOut, Mail } from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  const { user, refreshProfile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8 text-amber-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Authorization Pending</h1>
        <p className="text-sm text-slate-400 mb-6">
          You are currently signed in as <span className="font-semibold text-slate-200">{user?.email || 'authenticated user'}</span>.
          In accordance with competition security policy, new accounts have no privileged access by default.
        </p>

        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-left text-xs text-slate-300 space-y-2 mb-6">
          <div className="flex items-center gap-2 text-slate-200 font-medium">
            <Mail className="w-4 h-4 text-indigo-400" />
            <span>Next Steps for Event Authorization:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Notify the Competition Super Admin or Chief Scrutineer.</li>
            <li>Provide your signed-in email address for Judge or Operator role assignment.</li>
            <li>Once granted, click <strong>"Check Authorization"</strong> below to enter.</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => refreshProfile()}
            className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Check Authorization</span>
          </button>
          
          <button
            onClick={() => signOut()}
            className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Return to Public Home / Live Scoreboard
          </Link>
        </div>
      </div>
    </div>
  );
}
