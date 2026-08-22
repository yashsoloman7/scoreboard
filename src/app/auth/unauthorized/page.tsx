'use client';

// src/app/auth/unauthorized/page.tsx - Role Authorization Verification Portal

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { claimInitialSuperAdmin } from '@/actions/users';
import { MASTER_SUPER_ADMIN_EMAIL } from '@/lib/constants';
import { 
  ShieldAlert, 
  RefreshCw, 
  LogOut, 
  Mail, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle,
  Crown
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppRole } from '@/types';

export default function UnauthorizedPage() {
  const { user, refreshProfile, signOut, isLoading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'pending' | 'error'>('pending');

  const getDestinationForRole = (role?: AppRole) => {
    switch (role) {
      case 'super_admin':
      case 'admin':
        return '/admin/dashboard';
      case 'event_manager':
        return '/admin/staging';
      case 'event_operator':
        return '/admin/control-room';
      case 'judge':
        return '/judge';
      default:
        return null;
    }
  };

  // Automatic Master Super Admin Verification for navgirekanta65@gmail.com
  useEffect(() => {
    async function checkMasterAdmin() {
      if (!user?.email) return;
      const isMaster = user.email.toLowerCase().trim() === MASTER_SUPER_ADMIN_EMAIL.toLowerCase();
      if (isMaster) {
        setStatusType('success');
        setStatusMessage(`Welcome Master Super Administrator (${MASTER_SUPER_ADMIN_EMAIL}). Redirecting to Admin Suite...`);
        try {
          await claimInitialSuperAdmin();
          await refreshProfile();
          setTimeout(() => router.push('/admin/dashboard'), 800);
        } catch (e) {
          router.push('/admin/dashboard');
        }
      }
    }
    checkMasterAdmin();
  }, [user?.email, refreshProfile, router]);

  // Auto-redirect if user already has an authorized role
  useEffect(() => {
    if (!isLoading && user?.role && user.role !== 'unauthorized' && user.role !== 'public_viewer') {
      const dest = getDestinationForRole(user.role);
      if (dest) {
        setStatusType('success');
        setStatusMessage(`Active role verified: "${user.role.replace('_', ' ').toUpperCase()}". Redirecting...`);
        const timer = setTimeout(() => router.push(dest), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [user?.role, isLoading, router]);

  const handleCheckAuthorization = useCallback(async () => {
    try {
      setIsChecking(true);
      setStatusMessage(null);

      // If this is the master admin email, ensure immediate elevation
      if (user?.email?.toLowerCase().trim() === MASTER_SUPER_ADMIN_EMAIL.toLowerCase()) {
        const claimRes = await claimInitialSuperAdmin();
        setStatusType('success');
        setStatusMessage(claimRes.message);
        await refreshProfile();
        setTimeout(() => router.push('/admin/dashboard'), 600);
        return;
      }

      const refreshed = await refreshProfile();
      const role = refreshed?.role || user?.role;
      const destination = getDestinationForRole(role);

      if (destination && role !== 'unauthorized' && role !== 'public_viewer') {
        setStatusType('success');
        setStatusMessage(`Role verified as "${(role || '').replace('_', ' ').toUpperCase()}". Redirecting to your console...`);
        setTimeout(() => router.push(destination), 800);
      } else {
        setStatusType('pending');
        const time = new Date().toLocaleTimeString();
        setStatusMessage(`Status checked at ${time}: Role is still marked as "Unauthorized". Once your Super Administrator (${MASTER_SUPER_ADMIN_EMAIL}) grants your Judge or Staff role, click Check Authorization again.`);
      }
    } catch (err: unknown) {
      setStatusType('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to query authorization server');
    } finally {
      setIsChecking(false);
    }
  }, [refreshProfile, user?.email, user?.role, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 selection:bg-indigo-500 selection:text-white py-12">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl text-center">
        {/* Status Icon */}
        <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center border transition-all ${
          statusType === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : statusType === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}>
          {statusType === 'success' ? (
            <ShieldCheck className="w-8 h-8 text-emerald-400 animate-bounce" />
          ) : statusType === 'error' ? (
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          ) : (
            <ShieldAlert className="w-8 h-8 text-amber-400" />
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
          {statusType === 'success' ? 'Access Authorized!' : 'Authorization Pending'}
        </h1>
        
        <p className="text-sm text-slate-400 mb-6">
          Signed in as <span className="font-semibold text-slate-200 font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">{user?.email || 'authenticated user'}</span>.
        </p>

        {/* Dynamic Status Feedback Banner */}
        {statusMessage && (
          <div className={`mb-6 p-3.5 rounded-2xl text-xs font-medium flex items-start gap-2.5 text-left border ${
            statusType === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : statusType === 'error'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-slate-800/80 border-slate-700 text-amber-300'
          }`}>
            {statusType === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : statusType === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            )}
            <span className="leading-relaxed">{statusMessage}</span>
          </div>
        )}

        {/* Instructions Box */}
        <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 text-left text-xs text-slate-300 space-y-2 mb-6">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <Mail className="w-4 h-4 text-cyan-400" />
            <span>Steps to Complete Authorization:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li>Notify your Competition Super Administrator (<strong className="text-slate-200 font-mono">{MASTER_SUPER_ADMIN_EMAIL}</strong>).</li>
            <li>Provide your signed-in email address for <strong>Judge</strong>, <strong>Event Manager</strong>, or <strong>Admin</strong> assignment.</li>
            <li>Once granted in the Admin Portal, click <strong>"Check Authorization"</strong> below to enter immediately.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleCheckAuthorization}
            disabled={isChecking || isLoading}
            className="w-full sm:w-auto flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-cyan-300' : ''}`} />
            <span>{isChecking ? 'Checking Permissions...' : 'Check Authorization'}</span>
          </button>
          
          <button
            onClick={() => signOut()}
            className="w-full sm:w-auto py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-sm flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Footer link */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <Link href="/" className="hover:text-cyan-400 transition-colors">
            ← Live Scoreboard
          </Link>
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors">
            Switch Account <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
