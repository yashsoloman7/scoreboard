'use client';

// src/app/admin/dashboard/page.tsx - Executive Admin Management Console
import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { supabase } from '@/lib/supabase/client';
import { Competition, UserProfile } from '@/types';
import { deleteCompetition } from '@/actions/competitions';
import {
  Settings,
  Trophy,
  Users,
  Award,
  Radio,
  FileSpreadsheet,
  Play,
  PlusCircle,
  Trash2,
  Upload,
  Calendar,
  MapPin
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [judges, setJudges] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const { data: compData } = await supabase
        .from('competitions')
        .select('*')
        .order('created_at', { ascending: false });

      if (compData) {
        setCompetitions(compData.map((c: any) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          description: c.description,
          venue: c.venue,
          startDate: c.start_date,
          endDate: c.end_date,
          status: c.status,
          environment: c.environment,
          createdBy: c.created_by,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })));
      }

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
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleDeleteComp = async (id: string, name: string) => {
    if (!confirm(`⚠️ Are you sure you want to permanently delete event "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteCompetition(id);
      setActionMessage(`Successfully deleted event "${name}"`);
      await loadStats();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Settings className="w-6 h-6 text-amber-400" />
              <span>Admin Management Hub</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">Live Event Setup, Registration Importer, and Stage Controls</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/import"
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Import Form / CSV</span>
            </Link>
            <Link
              href="/admin/staging"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all"
            >
              <Radio className="w-4 h-4 text-slate-950" />
              <span>Stage Manager</span>
            </Link>
          </div>
        </div>

        {actionMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-emerald-400 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Events</p>
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
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Authorized Users</p>
              <h3 className="text-2xl font-bold text-white mt-1">{judges.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Competitions Management List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="font-bold text-base text-white">Event Registry</h2>
            <Link
              href="/admin/create"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Event</span>
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-xs">Loading events...</div>
          ) : competitions.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">No competitions created yet. Click "Create Event" above.</div>
          ) : (
            <div className="space-y-4">
              {competitions.map((comp) => (
                <div
                  key={comp.id}
                  className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        {comp.code}
                      </span>
                      {comp.startDate && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {comp.startDate}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-white">{comp.name}</h3>
                    {comp.venue && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" /> {comp.venue}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/admin/import"
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import Acts</span>
                    </Link>

                    <Link
                      href="/admin/staging"
                      className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Radio className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Stage Manager</span>
                    </Link>

                    <Link
                      href="/admin/control-room"
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Control Room</span>
                    </Link>

                    {/* Delete Event Button */}
                    <button
                      onClick={() => handleDeleteComp(comp.id, comp.name)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 transition-colors cursor-pointer"
                      title="Delete Competition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
