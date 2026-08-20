'use client';

// src/components/staging/EventManagerController.tsx - Stage Manager Console with Wall-Clock Timer & Multi-Singer Duet Support
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { updateParticipantDetails, deleteParticipant } from '@/actions/participants';
import { getEventCriteria, TimeSlotConfig } from '@/actions/criteria';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { 
  Play, 
  Pause, 
  Square, 
  Radio, 
  Lock, 
  Unlock, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  Edit2,
  Trash2,
  PlusCircle,
  X,
  Save
} from 'lucide-react';

interface Participant {
  id: string;
  team_name?: string | null;
  church_name?: string | null;
  participant_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  performance_type: string;
  performance_order: number;
  best_keyboardist?: string | null;
  bestRhythmist?: string | null;
  best_rhythmist?: string | null;
  bestGuitarist?: string | null;
  best_guitarist?: string | null;
}

interface EventState {
  event_id: string;
  active_participant_id: string | null;
  stage_mode: 'standby' | 'live' | 'completed';
  timer_status: 'idle' | 'running' | 'paused' | 'stopped' | 'overtime';
  timer_duration_seconds: number;
  timer_elapsed_seconds: number;
  timer_started_at: string | null;
  is_judge_input_unlocked: boolean;
  current_category: string;
}

export function EventManagerController({ eventId }: { eventId: string }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [state, setState] = useState<EventState | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlotConfig>({
    soloDurationSeconds: 240,
    duetDurationSeconds: 300,
    groupDurationSeconds: 480,
  });
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [activePerformer, setActivePerformer] = useState<Participant | null>(null);
  const [submittedJudgeCount, setSubmittedJudgeCount] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  // Edit / Add Modal States
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [isAddingPerformer, setIsAddingPerformer] = useState(false);
  const [editForm, setEditForm] = useState<{
    participantName: string;
    duetSinger1: string;
    duetSinger2: string;
    churchName: string;
    performanceType: 'solo' | 'duet' | 'group';
    bestKeyboardist: string;
    bestRhythmist: string;
    bestGuitarist: string;
    performanceOrder: number;
  }>({
    participantName: '',
    duetSinger1: '',
    duetSinger2: '',
    churchName: '',
    performanceType: 'solo',
    bestKeyboardist: '',
    bestRhythmist: '',
    bestGuitarist: '',
    performanceOrder: 1,
  });

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

  // 1. Initial Fetch & Category Time Slots Load
  const loadData = useCallback(async () => {
    const [{ data: pList }, { data: st }, { data: scoredRows }] = await Promise.all([
      supabase.from('participants').select('*').eq('competition_id', eventId).order('performance_order'),
      supabase.from('event_state').select('*').eq('event_id', eventId).maybeSingle(),
      supabase.from('scores').select('participant_id').eq('event_id', eventId),
    ]);

    try {
      const config = await getEventCriteria(eventId);
      if (config?.timeSlots) {
        setTimeSlots(config.timeSlots);
      }
    } catch (e) {
      console.error('Failed to load time slots:', e);
    }

    if (pList) setParticipants(pList);
    if (scoredRows) {
      setCompletedIds(new Set(scoredRows.map((s) => s.participant_id)));
    }

    if (st) {
      setState(st);
      const active = pList?.find((p) => p.id === st.active_participant_id) || null;
      setActivePerformer(active);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Realtime Subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`event_state_${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state', filter: `event_id=eq.${eventId}` }, (payload) => {
        const updated = payload.new as EventState;
        setState(updated);
        setParticipants((prev) => {
          const active = prev.find((p) => p.id === updated.active_participant_id) || null;
          setActivePerformer(active);
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `competition_id=eq.${eventId}` }, () => {
        loadData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores', filter: `event_id=eq.${eventId}` }, (payload: any) => {
        setSubmittedJudgeCount((c) => c + 1);
        if (payload?.new?.participant_id) {
          setCompletedIds((prev) => new Set([...prev, payload.new.participant_id]));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, loadData]);

  // 3. Tab-Change Resilient Authoritative Wall-Clock Timer
  useEffect(() => {
    if (state?.stage_mode !== 'live' || state?.timer_status !== 'running') {
      if (state?.timer_duration_seconds) {
        setTimeLeft(state.timer_duration_seconds - Math.floor(state.timer_elapsed_seconds || 0));
      }
      return;
    }

    const calcRemaining = () => {
      if (!state?.timer_started_at) return state?.timer_duration_seconds || 300;
      const startedMs = new Date(state.timer_started_at).getTime();
      const elapsedSecs = Math.floor((Date.now() - startedMs) / 1000);
      const totalDur = state.timer_duration_seconds || 300;
      return Math.max(0, totalDur - elapsedSecs);
    };

    setTimeLeft(calcRemaining());
    const interval = setInterval(() => {
      setTimeLeft(calcRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.stage_mode, state?.timer_status, state?.timer_started_at, state?.timer_duration_seconds]);

  // 4. Staging Controls
  const setStageMode = async (mode: 'standby' | 'live' | 'completed', unlockJudges = false) => {
    setIsUpdating(true);
    await supabase.from('event_state').upsert({
      event_id: eventId,
      stage_mode: mode,
      is_judge_input_unlocked: unlockJudges,
      timer_status: mode === 'live' ? 'running' : 'stopped',
      timer_started_at: mode === 'live' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' });
    setIsUpdating(false);
  };

  const selectActivePerformer = async (p: Participant) => {
    setIsUpdating(true);
    setSubmittedJudgeCount(0);

    let targetDuration = timeSlots.soloDurationSeconds;
    if (p.performance_type === 'duet') targetDuration = timeSlots.duetDurationSeconds;
    else if (p.performance_type === 'group') targetDuration = timeSlots.groupDurationSeconds;

    setTimeLeft(targetDuration);

    await supabase.from('event_state').upsert({
      event_id: eventId,
      active_participant_id: p.id,
      stage_mode: 'standby',
      is_judge_input_unlocked: false,
      timer_status: 'idle',
      timer_duration_seconds: targetDuration,
      timer_elapsed_seconds: 0,
      timer_started_at: null,
      current_category: p.performance_type,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' });

    setIsUpdating(false);
  };

  // 5. Edit Performer Handler with Duet 1 & 2 Support
  const openEditModal = (p: Participant) => {
    setEditingParticipant(p);
    
    let d1 = p.first_name || '';
    let d2 = p.last_name || '';
    if (p.participant_name && p.participant_name.includes('&')) {
      const parts = p.participant_name.split('&').map((s) => s.trim());
      d1 = parts[0] || d1;
      d2 = parts[1] || d2;
    }

    setEditForm({
      participantName: p.participant_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      duetSinger1: d1,
      duetSinger2: d2,
      churchName: p.church_name || p.team_name || '',
      performanceType: (p.performance_type as any) || 'solo',
      bestKeyboardist: p.best_keyboardist || '',
      bestRhythmist: p.best_rhythmist || '',
      bestGuitarist: p.best_guitarist || '',
      performanceOrder: p.performance_order || 1,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingParticipant) return;
    setIsUpdating(true);
    try {
      const fullName = editForm.performanceType === 'duet'
        ? [editForm.duetSinger1, editForm.duetSinger2].filter(Boolean).join(' & ')
        : editForm.participantName;

      await updateParticipantDetails(editingParticipant.id, {
        participantName: fullName,
        firstName: editForm.performanceType === 'duet' ? editForm.duetSinger1 : fullName.split(' ')[0] || fullName,
        lastName: editForm.performanceType === 'duet' ? editForm.duetSinger2 : fullName.split(' ').slice(1).join(' ') || '',
        churchName: editForm.churchName,
        teamName: editForm.churchName,
        performanceType: editForm.performanceType,
        bestKeyboardist: editForm.bestKeyboardist || null,
        bestRhythmist: editForm.bestRhythmist || null,
        bestGuitarist: editForm.bestGuitarist || null,
        performanceOrder: editForm.performanceOrder,
      });
      setEditingParticipant(null);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update participant');
    } finally {
      setIsUpdating(false);
    }
  };

  // 6. Manual Add Performer with Duet 1 & 2 Support
  const handleCreatePerformer = async () => {
    setIsUpdating(true);
    try {
      const order = participants.length + 1;
      const code = `P-${order.toString().padStart(3, '0')}`;
      const fullName = editForm.performanceType === 'duet'
        ? [editForm.duetSinger1, editForm.duetSinger2].filter(Boolean).join(' & ')
        : editForm.participantName;

      const { error } = await supabase.from('participants').insert({
        competition_id: eventId,
        participant_code: code,
        participant_name: fullName,
        first_name: editForm.performanceType === 'duet' ? editForm.duetSinger1 : fullName.split(' ')[0] || fullName,
        last_name: editForm.performanceType === 'duet' ? editForm.duetSinger2 : fullName.split(' ').slice(1).join(' ') || '',
        church_name: editForm.churchName,
        team_name: editForm.churchName,
        performance_type: editForm.performanceType,
        best_keyboardist: editForm.bestKeyboardist || null,
        best_rhythmist: editForm.bestRhythmist || null,
        best_guitarist: editForm.bestGuitarist || null,
        performance_order: editForm.performanceOrder || order,
      });

      if (error) throw error;
      setIsAddingPerformer(false);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add participant');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeletePerformer = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Performer Confirmation',
      message: `Are you sure you want to remove "${name}" from the staging queue?`,
      confirmLabel: 'Yes, Remove Performer',
      variant: 'danger',
      action: async () => {
        await deleteParticipant(id);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        await loadData();
      },
    });
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isLive = state?.stage_mode === 'live';

  return (
    <div className="w-full max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-8">
      {/* Header & Status Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Stage Manager Console
            </h1>
            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-lg ${
              isLive ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              <Radio className="w-3.5 h-3.5" />
              {isLive ? 'STAGE LIVE' : 'STANDBY MODE'}
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Realtime State Machine: Synchronizes stage countdown timers and unlocks cryptographic judge inputs.
          </p>
        </div>

        {/* Live Timer Clock Display */}
        <div className={`px-6 py-3 rounded-2xl border font-mono font-black text-3xl sm:text-4xl flex items-center gap-3 shadow-inner ${
          isLive 
            ? timeLeft < 60 
              ? 'bg-red-950/80 border-red-500 text-red-400 animate-pulse' 
              : 'bg-emerald-950/80 border-emerald-500 text-emerald-400' 
            : 'bg-slate-950 border-slate-800 text-slate-500'
        }`}>
          <Clock className="w-7 h-7" />
          {formatSeconds(timeLeft)}
        </div>
      </div>

      {/* Stage Controller Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Performer Showcase Card */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" /> Currently On Stage
              </span>
              <div className="flex items-center gap-2">
                {activePerformer && (
                  <button
                    onClick={() => openEditModal(activePerformer)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" /> Edit Act
                  </button>
                )}
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                  {activePerformer?.performance_type || 'No Act Selected'}
                </span>
              </div>
            </div>

            {activePerformer ? (
              <div className="space-y-2">
                <h2 className="text-3xl font-extrabold text-slate-100 tracking-tight">
                  {activePerformer.participant_name || activePerformer.team_name || `${activePerformer.first_name || ''} ${activePerformer.last_name || ''}`.trim()}
                </h2>
                <div className="flex flex-wrap gap-2 text-sm text-slate-400">
                  <span className="text-cyan-400 font-medium">🏛️ {activePerformer.church_name || 'Independent Church'}</span>
                  <span>•</span>
                  <span>Order: #{activePerformer.performance_order}</span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 font-medium">
                No active performer staged. Select a team from the queue below to initialize.
              </div>
            )}
          </div>

          {/* Staging Action Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setStageMode('live', true)}
              disabled={isLive || !activePerformer || isUpdating}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-lg shadow-emerald-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Live Stage</span>
            </button>

            <button
              onClick={() => setStageMode('standby', false)}
              disabled={!isLive || isUpdating}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Pause className="w-4 h-4" />
              <span>Standby Pause</span>
            </button>

            <button
              onClick={() => setStageMode('completed', false)}
              disabled={!activePerformer || isUpdating}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Square className="w-4 h-4" />
              <span>Complete & Lock</span>
            </button>
          </div>
        </div>

        {/* Judge Submission Radar & Status */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> Judge Radar
              </span>
              <span className="text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {submittedJudgeCount} Signed
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When stage is live, judge inputs unlock automatically. Upon submission, each judge locks their score with an immutable SHA-256 cryptographic receipt.
            </p>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Input Lock State</div>
            <div className="text-sm font-black flex items-center justify-center gap-1.5 text-slate-200">
              {state?.is_judge_input_unlocked ? (
                <>
                  <Unlock className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">UNLOCKED FOR JUDGES</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400">LOCKED (STANDBY)</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Performer Queue Section with Distinct Color States */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-200">Staging Queue</h3>
            <p className="text-xs text-slate-400">
              Color Legend: <span className="text-cyan-400 font-bold">Cyan (Live on Stage)</span> • <span className="text-emerald-400 font-bold">Green (Completed & Scored)</span> • <span className="text-slate-400 font-bold">Slate (Queued)</span>
            </p>
          </div>
          <button
            onClick={() => {
              setEditForm({
                participantName: '',
                duetSinger1: '',
                duetSinger2: '',
                churchName: '',
                performanceType: 'solo',
                bestKeyboardist: '',
                bestRhythmist: '',
                bestGuitarist: '',
                performanceOrder: participants.length + 1,
              });
              setIsAddingPerformer(true);
            }}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Add Act Manually
          </button>
        </div>

        {participants.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-800">
            No participants found. Use "Import Sheet" to load Google Form/CSV registrations or add manually above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {participants.map((p) => {
              const isActive = activePerformer?.id === p.id;
              const isCompleted = completedIds.has(p.id);

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border text-left transition-all relative ${
                    isActive
                      ? 'bg-cyan-950/60 border-cyan-400 shadow-xl shadow-cyan-950/60 ring-2 ring-cyan-400'
                      : isCompleted
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      onClick={() => selectActivePerformer(p)}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          #{p.performance_order}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                          {p.performance_type}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-black uppercase text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30 animate-pulse">
                            ON STAGE
                          </span>
                        )}
                        {isCompleted && !isActive && (
                          <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Scored
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm text-white truncate">
                        {p.participant_name || p.team_name || `${p.first_name || ''} ${p.last_name || ''}`.trim()}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{p.church_name || 'Independent'}</div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors cursor-pointer"
                        title="Edit Performer Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePerformer(p.id, p.participant_name || 'Act')}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete Act"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit / Add Modal with Duet 1 & Duet 2 Support */}
      {(editingParticipant || isAddingPerformer) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">
                {isAddingPerformer ? 'Add New Performance Act' : 'Edit Performer & Act Details'}
              </h3>
              <button
                onClick={() => {
                  setEditingParticipant(null);
                  setIsAddingPerformer(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Performance Type</label>
                <select
                  value={editForm.performanceType}
                  onChange={(e) => setEditForm({ ...editForm, performanceType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="solo">Solo</option>
                  <option value="duet">Duet (2 Singers)</option>
                  <option value="group">Group / Choir</option>
                </select>
              </div>

              {/* Dynamic Performer Fields depending on Solo/Group vs Duet */}
              {editForm.performanceType === 'duet' ? (
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <div>
                    <label className="block text-purple-400 mb-1 font-bold">Duet Singer #1 *</label>
                    <input
                      type="text"
                      value={editForm.duetSinger1}
                      onChange={(e) => setEditForm({ ...editForm, duetSinger1: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-purple-400 mb-1 font-bold">Duet Singer #2 *</label>
                    <input
                      type="text"
                      value={editForm.duetSinger2}
                      onChange={(e) => setEditForm({ ...editForm, duetSinger2: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500"
                      placeholder="e.g. Sarah Smith"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Performer / Act Name *</label>
                  <input
                    type="text"
                    value={editForm.participantName}
                    onChange={(e) => setEditForm({ ...editForm, participantName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. David Miller or Cathedral Choir"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Church / Team Name</label>
                <input
                  type="text"
                  value={editForm.churchName}
                  onChange={(e) => setEditForm({ ...editForm, churchName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. St. Andrews Church"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Sequence Order</label>
                <input
                  type="number"
                  min={1}
                  value={editForm.performanceOrder}
                  onChange={(e) => setEditForm({ ...editForm, performanceOrder: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block text-slate-400 font-bold">Special Instrumentalists (Optional Awards)</label>
                <input
                  type="text"
                  value={editForm.bestKeyboardist}
                  onChange={(e) => setEditForm({ ...editForm, bestKeyboardist: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-[11px] focus:outline-none focus:border-cyan-500"
                  placeholder="🎹 Keyboardist Name"
                />
                <input
                  type="text"
                  value={editForm.bestRhythmist}
                  onChange={(e) => setEditForm({ ...editForm, bestRhythmist: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-[11px] focus:outline-none focus:border-cyan-500"
                  placeholder="🥁 Rhythmist / Drummer Name"
                />
                <input
                  type="text"
                  value={editForm.bestGuitarist}
                  onChange={(e) => setEditForm({ ...editForm, bestGuitarist: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-[11px] focus:outline-none focus:border-cyan-500"
                  placeholder="🎸 Guitarist Name"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setEditingParticipant(null);
                  setIsAddingPerformer(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={isAddingPerformer ? handleCreatePerformer : handleSaveEdit}
                disabled={isUpdating || (editForm.performanceType === 'duet' ? (!editForm.duetSinger1.trim() && !editForm.duetSinger2.trim()) : !editForm.participantName.trim())}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isAddingPerformer ? 'Add Performer' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Confirmation Dialog */}
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
