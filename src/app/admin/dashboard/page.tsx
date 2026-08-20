'use client';

// src/app/admin/dashboard/page.tsx - Executive Admin Management Console

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { supabase } from '@/lib/supabase/client';
import { Competition, UserProfile } from '@/types';
import { seedCompetitionAwards } from '@/actions/awards';
import { initializePracticeSandbox } from '@/actions/practice';
import {
  Settings,
  Trophy,
  Users,
  Award,
  Radio,
  FileSpreadsheet,
  Play,
  CheckCircle2,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [judges, setJudges] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: compData } = await supabase
          .from('competitions')
          .select('*')
          .order('created_at', { ascending: false });

        if (compData) setCompetitions(compData as any);

        const { data: profiles } = await supabase
          .from('profiles')
          .select('*, roles:user_roles(role)');

        if (profiles) {
          setJudges(
            profiles.map((p) => ({
              id: p.id,
              email: p.email,
              fullName: p.full_name,
              isActive: p.is_active,
              role: p.roles?.[0]?.role || 'unauthorized',
              createdAt: p.created_at,
              updatedAt: p.updated_at,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  const handleSeedAwards = async (compId: string) => {
    try {
      await seedCompetitionAwards(compId);
      setActionMessage('Successfully seeded 20 official awards for this competition!');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to seed awards');
    }
  };

  const handleLaunchPractice = async (compId: string) => {
    try {
      await initializePracticeSandbox(compId);
      setActionMessage('Practice mode initialized! 4 demo participants and criteria ready.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to launch practice');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Settings className="w-6 h-6 text-amber-400" />
              <span>Admin Management Hub</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">State Scrutiny, Competition Setup, and Judge Authorization</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/control-room"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Launch Live Control Room</span>
            </Link>
          </div>
        </div>

        {actionMessage && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-emerald-400 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Competitions</p>
              <h3 className="text-2xl font-bold text-white mt-1">{competitions.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Trophy className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Registered Judges</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {judges.filter((j) => j.role === 'judge').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-white mt-1">{judges.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Competitions Management List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <h2 className="font-bold text-base text-white">Event Registry</h2>
            <Link
              href="/admin/create"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Event</span>
            </Link>
          </div>

          {competitions.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">No competitions created yet.</div>
          ) : (
            <div className="space-y-4">
              {competitions.map((comp) => (
                <div
                  key={comp.id}
                  className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {comp.code}
                      </span>
                      <span className="text-xs text-slate-400">
                        {comp.startDate} to {comp.endDate}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-white">{comp.name}</h3>
                    {comp.venue && <p className="text-xs text-slate-400 mt-0.5">{comp.venue}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleSeedAwards(comp.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>Seed 20 Awards</span>
                    </button>

                    <button
                      onClick={() => handleLaunchPractice(comp.id)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Launch Practice Sandbox</span>
                    </button>

                    <Link
                      href="/admin/control-room"
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Control Room</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
