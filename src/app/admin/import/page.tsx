'use client';

// src/app/admin/import/page.tsx - Admin Google Form & CSV Participant Importer Portal
import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { GoogleFormSheetImporter } from '@/components/importer/GoogleFormSheetImporter';
import { supabase } from '@/lib/supabase/client';
import { Competition } from '@/types';
import { Layers, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminImportPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCompetitions() {
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
    loadCompetitions();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/control-room"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Control Room
          </Link>

          {/* Competition Switcher */}
          {competitions.length > 1 && (
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-2xl">
              <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
              <select
                value={selectedCompId || ''}
                onChange={(e) => setSelectedCompId(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
              >
                {competitions.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-24 text-center text-slate-500 font-medium animate-pulse">
            Loading competition context...
          </div>
        ) : selectedCompId ? (
          <GoogleFormSheetImporter competitionId={selectedCompId} />
        ) : (
          <div className="py-24 text-center text-slate-500 font-medium">
            No active competitions found. Please create a competition first.
          </div>
        )}
      </main>
    </div>
  );
}
