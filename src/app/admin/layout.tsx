'use client';

// src/app/admin/layout.tsx - Role-Protected Layout Guard for Admin Suite
import React, { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth/login?next=/admin/dashboard');
      } else if (user.role === 'unauthorized' || user.role === 'public_viewer') {
        router.push('/auth/unauthorized');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
        <p className="text-xs text-slate-400 font-mono">Verifying authorization credentials...</p>
      </div>
    );
  }

  if (!user || user.role === 'unauthorized' || user.role === 'public_viewer') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="p-6 max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Authorization Required</h2>
          <p className="text-xs text-slate-400">
            You must be granted an administrative role (Super Admin, Admin, Event Manager, or Event Operator) to access this section.
          </p>
          <div className="animate-pulse text-xs text-indigo-400 font-mono">Redirecting to verification...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
