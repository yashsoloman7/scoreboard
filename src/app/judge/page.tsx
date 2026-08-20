'use client';

// src/app/judge/page.tsx - Streamlined Mobile/Tablet Touch-Optimized Judge Portal
import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { JudgePanel } from '@/components/judge/JudgePanel';
import { supabase } from '@/lib/supabase/client';

export default function JudgePage() {
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-2 sm:px-4 py-4 max-w-xl">
        <JudgePanel eventId={activeEventId || undefined} />
      </main>
    </div>
  );
}
