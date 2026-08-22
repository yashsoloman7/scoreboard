'use client';

// src/app/auth/unauthorized/page.tsx - Role Authorization Verification & Master Super Admin Initialization Portal

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { claimInitialSuperAdmin, getSuperAdminStatus } from '@/actions/users';
import { 
  ShieldAlert, 
  RefreshCw, 
  LogOut, 
  Mail, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle,
  Crown,
  Sparkles,
  Award
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppRole } from '@/types';

export default function UnauthorizedPage() {
  const { user, refreshProfile, signOut, isLoading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasSuperAdmin, setHasSuperAdmin] = useState<boolean | null>(null);
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

  // Check if system has a Super Admin registered
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await getSuperAdminStatus();
        setHasSuperAdmin(res.hasSuperAdmin);
      } catch (err) {
        console.error('Failed to check Super Admin status:', err);
      }
    }
    checkStatus();
  }, []);

  const handleClaimSuperAdmin = async () => {
    try {
      setIsClaiming(true);
      setStatusMessage(null);
      const res = await claimInitialSuperAdmin();

      if (res.success && res.role) {
        setStatusType('success');
        setStatusMessage(res.message);
        await refreshProfile();
        const dest = getDestinationForRole(res.role) || '/admin/dashboard';
        setTimeout(() => {
          router.push(dest);
        }, 1200);
      } else {
        setStatusType('pending');
        setStatusMessage(res.message);
      }
    } catch (err: unknown) {
      setStatusType('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to claim Super Admin role');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCheckAuthorization = useCallback(async () => {
    try {
      setIsChecking(true);
      setStatusMessage(null);

      // Attempt bootstrap claim first if no Super Admin exists
      if (hasSuperAdmin === false) {
        const claimRes = await claimInitialSuperAdmin();
        if (claimRes.success && claimRes.role) {
          setStatusType('success');
          setStatusMessage(claimRes.message);
          await refreshProfile();
          const dest = getDestinationForRole(claimRes.role) || '/admin/dashboard';
          setTimeout(() => {
            router.push(dest);
          }, 1000);
          return;
        }
      }

      const refreshed = await refreshProfile();
      const role = refreshed?.role || user?.role;
      const destination = getDestinationForRole(role);

      if (destination && role !== 'unauthorized' && role !== 'public_viewer') {
        setStatusType('success');
        setStatusMessage(`Role verified as "${(role || '').replace('_', ' ').toUpperCase()}". Redirecting to your console...`);
        setTimeout(() => {
          router.push(destination);
        }, 1000);
      } else {
        setStatusType('pending');
        const time = new Date().toLocaleTimeString();
        setStatusMessage(`Status checked at ${time}: Role is currently "Unauthorized". Once your Super Administrator grants your role in the Admin Suite, click Check Authorization again.`);
      }
    } catch (err: unknown) {
      setStatusType('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to query authorization server');
    } finally {
      setIsChecking(false);
    }
  }, [refreshProfile, user?.role, hasSuperAdmin, router]);

  // Auto-redirect if user already has an authorized role
  useEffect(() => {
    if (!isLoading && user?.role && user.role !== 'unauthorized' && user.role !== 'public_viewer') {
      const dest = getDestinationForRole(user.role);
      if (dest) {
        setStatusType('success');
        setStatusMessage(`Active role detected: "${user.role.replace('_', ' ').toUpperCase()}". Redirecting...`);
        const timer = setTimeout(() => router.push(dest), 800);
        return () => clearTimeout(timer);
      }
    }
  }, [user?.role, isLoading, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 selection:bg-indigo-500 selection:text-white py-12">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl text-center">
        {/* Master Setup Initialization Banner (When no Super Admin exists yet) */}
        {hasSuperAdmin === false && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-tr from-amber-500/15 via-purple-500/15 to-indigo-500/15 border border-amber-500/40 text-left space-y-3 shadow-lg shadow-amber-500/5">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Crown className="w-5 h-5 text-amber-400 shrink-0" />
              <span>First-Time System Setup Detected</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              No Super Administrator is registered in this database yet. As the primary creator/administrator of this platform, you can claim the <strong>Master Super Admin</strong> role now.
            </p>
            <button
              onClick={handleClaimSuperAdmin}
              disabled={isClaiming || isChecking}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:from-amber-400 hover:via-indigo-500 hover:to-purple-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Crown className="w-4 h-4 text-amber-200" />
              <span>{isClaiming ? 'Initializing Master Role...' : 'Claim Master Super Administrator Role'}</span>
            </button>
          </div>
        )}

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
            <span>Role Authorization Workflow:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li>Your Super Administrator assigns roles in the <strong>Admin Suite → User Roles</strong> panel.</li>
            <li>Available roles: <strong>Judge</strong>, <strong>Stage Manager</strong>, <strong>Control Room</strong>, and <strong>Admin</strong>.</li>
            <li>Each role receives a tailored interface designed specifically for their contest responsibilities.</li>
            <li>Once assigned, click <strong>"Check Authorization"</strong> to enter immediately.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleCheckAuthorization}
            disabled={isChecking || isClaiming || isLoading}
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
