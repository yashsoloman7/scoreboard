'use client';

// src/app/judge/page.tsx - Streamlined Mobile/Tablet Touch-Optimized Judge Portal
import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { JudgePanel } from '@/components/judge/JudgePanel';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

export default function JudgePage() {
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth/login?next=/judge');
        return;
      }

      const role = user.role;
      if (role === 'unauthorized' || role === 'public_viewer') {
        router.push('/auth/unauthorized');
        return;
      }

      if (role === 'event_manager') {
        router.push('/admin/staging');
        return;
      }

      if (role === 'event_operator') {
        router.push('/admin/control-room');
        return;
      }
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    async function loadActiveEvent() {
      const { data: comp } = await supabase
        .from('competitions')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (comp) {
        setActiveEventId(comp.id);
      }
    }
    loadActiveEvent();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 mb-3"></div>
        <p className="text-xs text-slate-400 font-mono">Loading judging console...</p>
      </div>
    );
  }

  if (!user || (user.role !== 'judge' && user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4">
        <div className="p-6 max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Judge Authorization Required</h2>
          <p className="text-xs text-slate-400">
            Only authorized Judges and Administrators can access the active scoring console.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-2 sm:px-4 py-4 max-w-xl">
        <JudgePanel eventId={activeEventId || undefined} />
      </main>
    </div>
  );
}
