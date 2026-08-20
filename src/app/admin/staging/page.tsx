'use client';

// src/app/admin/staging/page.tsx
import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { EventManagerController } from '@/components/staging/EventManagerController';
import { supabase } from '@/lib/supabase/client';
import { Competition } from '@/types';
import { Radio, Layers, Sparkles } from 'lucide-react';

export default function AdminStagingPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadComps() {
      const { data } = await supabase
        .from('competitions')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setCompetitions(data as any);
        setSelectedCompId(data[0].id);
      }
      setLoading(false);
    }
    loadComps();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6 max-w-7xl">
        {/* Competition Switcher */}
        {competitions.length > 1 && (
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl max-w-md">
            <Layers className="w-5 h-5 text-teal-400 shrink-0" />
            <select
              value={selectedCompId || ''}
              onChange={(e) => setSelectedCompId(e.target.value)}
              className="bg-transparent text-white text-sm font-bold focus:outline-none w-full cursor-pointer"
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-slate-500 font-medium">
            Loading Event Manager staging interface...
          </div>
        ) : selectedCompId ? (
          <EventManagerController eventId={selectedCompId} />
        ) : (
          <div className="py-24 text-center text-slate-500 font-medium">
            No active competitions found. Please create an event first.
          </div>
        )}
      </main>
    </div>
  );
}
