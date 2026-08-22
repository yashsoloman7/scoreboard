'use client';

// src/app/admin/layout.tsx - Role-Segregated Layout Guard for Admin Suite
import React, { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push(`/auth/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const role = user.role;

      if (role === 'unauthorized' || role === 'public_viewer') {
        router.push('/auth/unauthorized');
        return;
      }

      if (role === 'judge') {
        router.push('/judge');
        return;
      }

      // Role-specific view routing
      if (role === 'event_manager') {
        // Event Manager only has access to /admin/staging and /admin/import
        if (!pathname.startsWith('/admin/staging') && !pathname.startsWith('/admin/import')) {
          router.push('/admin/staging');
          return;
        }
      } else if (role === 'event_operator') {
        // Event Operator has access to /admin/control-room and /admin/staging
        if (!pathname.startsWith('/admin/control-room') && !pathname.startsWith('/admin/staging')) {
          router.push('/admin/control-room');
          return;
        }
      }
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
        <p className="text-xs text-slate-400 font-mono">Verifying role permissions...</p>
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
            You must be granted an authorized staff or administrator role to access this section.
          </p>
          <div className="animate-pulse text-xs text-indigo-400 font-mono">Redirecting to authorization check...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
