'use client';

// src/app/admin/dashboard/page.tsx - Executive Admin Management Console
import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { supabase } from '@/lib/supabase/client';
import { Competition, UserProfile } from '@/types';
import { deleteCompetition, createCompetition } from '@/actions/competitions';
import { getEventCriteria, saveEventCriteria, CustomCriterion, TimeSlotConfig } from '@/actions/criteria';
import { calculateEventPrizes, verifyEventPasswordAndPublish, EventPrizeStandings } from '@/actions/prizes';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
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
  MapPin,
  X,
  Save,
  ShieldCheck,
  Sliders,
  Plus,
  Edit3,
  Clock,
  CheckCircle2,
  Medal,
  KeyRound,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [judges, setJudges] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Create Event Modal State with Security Password
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    description: '',
    venue: '',
    startDate: '',
    endDate: '',
    eventPassword: '',
    soloSlateMinutes: 4,
    duetSlateMinutes: 5,
    groupSlateMinutes: 8,
  });

  // Criteria & Time Slots Configuration Modal State
  const [criteriaModalEvent, setCriteriaModalEvent] = useState<{ id: string; name: string } | null>(null);
  const [criteriaList, setCriteriaList] = useState<CustomCriterion[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlotConfig>({
    soloDurationSeconds: 240,
    duetDurationSeconds: 300,
    groupDurationSeconds: 480,
  });
  const [isSavingCriteria, setIsSavingCriteria] = useState(false);

  // Individual Prizes Standings & Publishing Modal State
  const [prizeModalEvent, setPrizeModalEvent] = useState<Competition | null>(null);
  const [prizeStandings, setPrizeStandings] = useState<EventPrizeStandings | null>(null);
  const [publishPassword, setPublishPassword] = useState('');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishingPrizes, setIsPublishingPrizes] = useState(false);

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Yes, Proceed',
    variant: 'danger',
    action: async () => {},
  });

  const loadStats = async () => {
    try {
      setLoading(true);
      const { data: compData } = await supabase
        .from('competitions')
        .select('*')
        .neq('environment', 'practice')
        .not('name', 'ilike', '%demo%')
        .not('name', 'ilike', '%practice%')
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

  const handleDeleteComp = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Event Confirmation',
      message: `Are you sure you want to permanently delete event "${name}"? All associated participants, performance slots, and scores will be removed.`,
      confirmLabel: 'Yes, Delete Event',
      variant: 'danger',
      action: async () => {
        await deleteCompetition(id);
        setActionMessage(`Successfully deleted event "${name}"`);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        await loadStats();
      },
    });
  };

  const handleCreateEvent = async () => {
    if (!createForm.name.trim() || !createForm.code.trim()) return;
    setIsCreating(true);
    try {
      const newComp = await createCompetition({
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        description: createForm.description.trim() || undefined,
        venue: createForm.venue.trim() || undefined,
        startDate: createForm.startDate || undefined,
        endDate: createForm.endDate || undefined,
        environment: 'live',
        eventPassword: createForm.eventPassword.trim() || undefined,
      });

      if (newComp?.id) {
        await saveEventCriteria(newComp.id, [
          { name: 'Technicality & Vocal Precision', maxMarks: 30, description: 'Pitch, intonation, vocal control & tone quality' },
          { name: 'Presentation & Stage Presence', maxMarks: 30, description: 'Expression, poise, diction, harmony & dynamics' },
          { name: 'Rhythm, Timing & Musicality', maxMarks: 20, description: 'Tempo stability, groove & rhythmic phrasing' },
          { name: 'Overall Impact & Artistry', maxMarks: 20, description: 'Interpretation, emotional delivery & overall effect' },
        ], {
          soloDurationSeconds: createForm.soloSlateMinutes * 60,
          duetDurationSeconds: createForm.duetSlateMinutes * 60,
          groupDurationSeconds: createForm.groupSlateMinutes * 60,
        });
      }

      setActionMessage(`Successfully created event "${createForm.name}" with security password protection!`);
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        code: '',
        description: '',
        venue: '',
        startDate: '',
        endDate: '',
        eventPassword: '',
        soloSlateMinutes: 4,
        duetSlateMinutes: 5,
        groupSlateMinutes: 8,
      });
      await loadStats();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsCreating(false);
    }
  };

  // Open Criteria Builder Modal
  const openCriteriaModal = async (comp: Competition) => {
    setCriteriaModalEvent({ id: comp.id, name: comp.name });
    try {
      const config = await getEventCriteria(comp.id);
      setCriteriaList(config.criteria || []);
      if (config?.timeSlots) setTimeSlots(config.timeSlots);
    } catch (e) {
      console.error('Failed to load criteria:', e);
    }
  };

  const handleAddCriterion = () => {
    setCriteriaList([
      ...criteriaList,
      {
        id: `crit-${Date.now()}`,
        name: `Criterion ${criteriaList.length + 1}`,
        maxMarks: 25,
        description: '',
      },
    ]);
  };

  const handleRemoveCriterion = (index: number) => {
    setCriteriaList(criteriaList.filter((_, i) => i !== index));
  };

  const handleUpdateCriterion = (index: number, field: keyof CustomCriterion, value: any) => {
    const updated = [...criteriaList];
    updated[index] = { ...updated[index], [field]: value };
    setCriteriaList(updated);
  };

  const handleSaveCriteria = async () => {
    if (!criteriaModalEvent) return;
    setIsSavingCriteria(true);
    try {
      await saveEventCriteria(criteriaModalEvent.id, criteriaList, timeSlots);
      setActionMessage(`Criteria, time slots & weightages successfully updated for "${criteriaModalEvent.name}"`);
      setCriteriaModalEvent(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save criteria');
    } finally {
      setIsSavingCriteria(false);
    }
  };

  // Open Prizes Standings Modal
  const openPrizesModal = async (comp: Competition) => {
    setPrizeModalEvent(comp);
    setPublishPassword('');
    setPublishError(null);
    const standings = await calculateEventPrizes(comp.id);
    setPrizeStandings(standings);
  };

  const handlePublishResults = async () => {
    if (!prizeModalEvent) return;
    setPublishError(null);
    setIsPublishingPrizes(true);
    try {
      await verifyEventPasswordAndPublish(prizeModalEvent.id, publishPassword);
      setActionMessage(`Official Prize Results successfully published for "${prizeModalEvent.name}"!`);
      setPrizeModalEvent(null);
      await loadStats();
    } catch (e: any) {
      setPublishError(e.message || 'Failed to authorize publishing. Check event password.');
    } finally {
      setIsPublishingPrizes(false);
    }
  };

  const totalCriteriaMax = criteriaList.reduce((sum, c) => sum + (Number(c.maxMarks) || 0), 0);

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
            <p className="text-sm text-slate-400 mt-1">Live Event Setup, Password Protection, Time Slots & Prize Adjudication</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/users"
              className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-bold text-xs flex items-center gap-2 transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Manage Roles</span>
            </Link>
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
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between font-bold">
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

          <Link
            href="/admin/users"
            className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 shadow-lg flex items-center justify-between transition-colors group cursor-pointer"
          >
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider group-hover:text-purple-300 transition-colors">
                Authorized Staff
              </p>
              <h3 className="text-2xl font-bold text-white mt-1">{judges.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </Link>
        </div>

        {/* Competitions Management List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="font-bold text-base text-white">Event Registry</h2>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Event</span>
            </button>
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
                      {comp.status === 'completed' && (
                        <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                          PUBLISHED
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
                    {/* Prizes & Standings Button */}
                    <button
                      onClick={() => openPrizesModal(comp)}
                      className="px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="View Category Prizes & Publish"
                    >
                      <Trophy className="w-3.5 h-3.5 text-purple-400" />
                      <span>Prizes & Standings</span>
                    </button>

                    {/* Criteria & Time Slots Configuration */}
                    <button
                      onClick={() => openCriteriaModal(comp)}
                      className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Set Custom Criteria & Time Slots"
                    >
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>Criteria & Time Slots</span>
                    </button>

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

                    {/* Delete Event Button with Confirmation */}
                    <button
                      onClick={() => handleDeleteComp(comp.id, comp.name)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 transition-colors cursor-pointer"
                      title="Delete Event"
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

      {/* Individual Prizes & Category Standings Modal with Password-Protected Publishing */}
      {prizeModalEvent && prizeStandings && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-2xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Category Prizes & Official Standings
                </h3>
                <p className="text-xs text-slate-400">Event: {prizeModalEvent.name}</p>
              </div>
              <button onClick={() => setPrizeModalEvent(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TIE ALERT WARNING BOX */}
            {prizeStandings.ties && prizeStandings.ties.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
                  <AlertTriangle className="w-4 h-4" />
                  ⚠️ Tie Score Review Required Before Final Publishing
                </div>
                {prizeStandings.ties.map((t, idx) => (
                  <div key={idx} className="text-xs text-amber-200 pl-6 space-y-1">
                    <div><strong>{t.category} (Rank #{t.rank})</strong> — Equal Score: {t.score.toFixed(2)} pts:</div>
                    <ul className="list-disc list-inside text-slate-300 text-[11px]">
                      {t.tiedContestants.map((c) => (
                        <li key={c.id}>{c.name} ({c.churchName})</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Overall Church Championship Ranking */}
            <div className="space-y-3 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Medal className="w-4 h-4 text-amber-400" />
                OVERALL CHURCH CHAMPIONSHIP (SOLO + DUET + GROUP)
              </span>
              <div className="space-y-2">
                {prizeStandings.churchOverallStandings.length === 0 ? (
                  <p className="text-xs text-slate-500">No scored churches yet.</p>
                ) : (
                  prizeStandings.churchOverallStandings.map((c) => (
                    <div key={c.churchName} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>#{c.rank} {c.churchName}</span>
                          <span className="text-[10px] text-amber-400 font-bold">{c.prizeTitle}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Solo: {c.soloScore.toFixed(1)} | Duet: {c.duetScore.toFixed(1)} | Group & Inst: {(c.groupScore + c.instrumentsScore).toFixed(1)}
                        </div>
                      </div>
                      <span className="font-mono font-black text-cyan-400 text-sm">{c.grandTotal.toFixed(1)} pts</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Duet Category (Both Singers Displayed) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-purple-300 uppercase">👥 Duet Category (Both Singers Displayed)</span>
              <div className="space-y-1.5">
                {prizeStandings.duetStandings.slice(0, 3).map((d) => (
                  <div key={d.participantId} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{d.name} ({d.churchName})</span>
                      <span className="text-[10px] text-purple-400 block">{d.prizeTitle}</span>
                    </div>
                    <span className="font-mono font-bold text-cyan-400">{d.totalScore.toFixed(1)} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Password Authorization Input */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                Enter Event Security Password to Authorize Publishing
              </label>
              <input
                type="password"
                value={publishPassword}
                onChange={(e) => setPublishPassword(e.target.value)}
                placeholder="Enter password set during event creation"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-white focus:outline-none font-mono"
              />
              {publishError && (
                <p className="text-[11px] text-red-400 font-bold">{publishError}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPrizeModalEvent(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={handlePublishResults}
                disabled={isPublishingPrizes}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isPublishingPrizes ? 'Authorizing...' : 'Authorize & Publish Official Results'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Criteria & Time Slots Configuration Modal */}
      {criteriaModalEvent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  Criteria, Weightages & Time Slots
                </h3>
                <p className="text-xs text-slate-400">Event: {criteriaModalEvent.name}</p>
              </div>
              <button onClick={() => setCriteriaModalEvent(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Time Slots Duration Config per Performance Type */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Category Time Slot Durations
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Solo Time</label>
                  <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={Math.round(timeSlots.soloDurationSeconds / 60)}
                      onChange={(e) => setTimeSlots({ ...timeSlots, soloDurationSeconds: (Number(e.target.value) || 1) * 60 })}
                      className="w-full bg-transparent text-white font-mono font-bold text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 pr-1">min</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Duet Time</label>
                  <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={Math.round(timeSlots.duetDurationSeconds / 60)}
                      onChange={(e) => setTimeSlots({ ...timeSlots, duetDurationSeconds: (Number(e.target.value) || 1) * 60 })}
                      className="w-full bg-transparent text-white font-mono font-bold text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 pr-1">min</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Group Time</label>
                  <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={Math.round(timeSlots.groupDurationSeconds / 60)}
                      onChange={(e) => setTimeSlots({ ...timeSlots, groupDurationSeconds: (Number(e.target.value) || 1) * 60 })}
                      className="w-full bg-transparent text-white font-mono font-bold text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 pr-1">min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Marks Summary Badge */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Total Criteria Max Marks</span>
              <span className="font-mono text-xl font-black text-amber-400">
                {totalCriteriaMax} Points
              </span>
            </div>

            {/* Criteria Fields List */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {criteriaList.map((crit, idx) => (
                <div key={crit.id || idx} className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={crit.name}
                      onChange={(e) => handleUpdateCriterion(idx, 'name', e.target.value)}
                      placeholder="Criterion Name (e.g. Technicality)"
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                    />
                    <div className="w-24 shrink-0 flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={crit.maxMarks}
                        onChange={(e) => handleUpdateCriterion(idx, 'maxMarks', Number(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-black font-mono text-amber-300 text-center focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[10px] text-slate-500 font-bold">pts</span>
                    </div>
                    {criteriaList.length > 1 && (
                      <button
                        onClick={() => handleRemoveCriterion(idx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-900 transition-colors"
                        title="Remove Criterion"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={crit.description || ''}
                    onChange={(e) => handleUpdateCriterion(idx, 'description', e.target.value)}
                    placeholder="Short description/guideline for judges (optional)"
                    className="w-full px-3 py-1 bg-slate-900/60 border border-slate-800/60 rounded-lg text-[11px] text-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              ))}
            </div>

            {/* Add Criterion Button */}
            <button
              type="button"
              onClick={handleAddCriterion}
              className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Another Criterion Parameter
            </button>

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCriteriaModalEvent(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCriteria}
                disabled={isSavingCriteria || criteriaList.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingCriteria ? 'Saving...' : 'Save All Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal with Password Field */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                Create New Event
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Event Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. State Choir Championship 2026"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Event Code * (Short Identifier)</label>
                <input
                  type="text"
                  required
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono uppercase focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. SCC-2026"
                />
              </div>

              {/* Event Security Password */}
              <div>
                <label className="block text-amber-400 mb-1 font-bold flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> Event Security Passkey * (Required to Publish Results)
                </label>
                <input
                  type="password"
                  value={createForm.eventPassword}
                  onChange={(e) => setCreateForm({ ...createForm, eventPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-mono focus:outline-none"
                  placeholder="Set secret password (e.g. ChurchAdmin2026!)"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Venue / Location</label>
                <input
                  type="text"
                  value={createForm.venue}
                  onChange={(e) => setCreateForm({ ...createForm, venue: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Grand Auditorium Hall"
                />
              </div>

              {/* Time Slots Defaults */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Solo Duration</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.soloSlateMinutes}
                    onChange={(e) => setCreateForm({ ...createForm, soloSlateMinutes: Number(e.target.value) || 1 })}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-center font-bold"
                  />
                  <span className="text-[10px] text-slate-500 text-center block mt-0.5">minutes</span>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Duet Duration</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.duetSlateMinutes}
                    onChange={(e) => setCreateForm({ ...createForm, duetSlateMinutes: Number(e.target.value) || 1 })}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-center font-bold"
                  />
                  <span className="text-[10px] text-slate-500 text-center block mt-0.5">minutes</span>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Group Duration</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.groupSlateMinutes}
                    onChange={(e) => setCreateForm({ ...createForm, groupSlateMinutes: Number(e.target.value) || 1 })}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-center font-bold"
                  />
                  <span className="text-[10px] text-slate-500 text-center block mt-0.5">minutes</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateEvent}
                disabled={isCreating || !createForm.name.trim() || !createForm.code.trim()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isCreating ? 'Creating...' : 'Create Event'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
