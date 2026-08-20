'use client';

// src/components/staging/EventManagerController.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
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
  RotateCcw,
  Sparkles
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
}

interface EventState {
  event_id: string;
  active_participant_id: string | null;
  stage_mode: 'standby' | 'live' | 'completed';
  timer_status: 'idle' | 'running' | 'paused' | 'stopped' | 'overtime';
  timer_duration_seconds: number;
  timer_elapsed_seconds: number;
  is_judge_input_unlocked: boolean;
  current_category: string;
}

export function EventManagerController({ eventId }: { eventId: string }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [state, setState] = useState<EventState | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [activePerformer, setActivePerformer] = useState<Participant | null>(null);
  const [submittedJudgeCount, setSubmittedJudgeCount] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  // 1. Initial Fetch
  const loadData = useCallback(async () => {
    const [{ data: pList }, { data: st }] = await Promise.all([
      supabase.from('participants').select('*').eq('competition_id', eventId).order('performance_order'),
      supabase.from('event_state').select('*').eq('event_id', eventId).maybeSingle(),
    ]);

    if (pList) setParticipants(pList);
    if (st) {
      setState(st);
      const active = pList?.find((p) => p.id === st.active_participant_id) || null;
      setActivePerformer(active);
      setTimeLeft(st.timer_duration_seconds - Math.floor(st.timer_elapsed_seconds || 0));
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores', filter: `event_id=eq.${eventId}` }, () => {
        setSubmittedJudgeCount((c) => c + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // 3. Local Countdown Ticker
  useEffect(() => {
    if (state?.stage_mode !== 'live' || state?.timer_status !== 'running') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.stage_mode, state?.timer_status]);

  // 4. Staging State Machine Controls
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
    setTimeLeft(state?.timer_duration_seconds || 300);
    await supabase.from('event_state').upsert({
      event_id: eventId,
      active_participant_id: p.id,
      stage_mode: 'standby',
      is_judge_input_unlocked: false,
      timer_status: 'idle',
      timer_elapsed_seconds: 0,
      current_category: p.performance_type,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' });
    setIsUpdating(false);
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
              Event Manager Staging Console
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
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                {activePerformer?.performance_type || 'No Act Selected'}
              </span>
            </div>

            {activePerformer ? (
              <div className="space-y-2">
                <h2 className="text-3xl font-extrabold text-slate-100 tracking-tight">
                  {activePerformer.team_name || activePerformer.participant_name || `${activePerformer.first_name || ''} ${activePerformer.last_name || ''}`.trim()}
                </h2>
                <div className="flex flex-wrap gap-2 text-sm text-slate-400">
                  <span className="text-cyan-400 font-medium">🏛️ {activePerformer.church_name || 'Independent Church'}</span>
                  <span>•</span>
                  <span>Performer: {activePerformer.participant_name || `${activePerformer.first_name || ''} ${activePerformer.last_name || ''}`.trim()}</span>
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
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-lg shadow-emerald-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              START LIVE TIMER
            </button>

            <button
              onClick={() => setStageMode('standby', false)}
              disabled={!isLive || isUpdating}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Pause className="w-4 h-4" />
              PAUSE / STANDBY
            </button>

            <button
              onClick={() => setStageMode('standby', false)}
              disabled={!activePerformer || isUpdating}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Square className="w-4 h-4 fill-current" />
              STOP & LOCK
            </button>
          </div>
        </div>

        {/* Live Judge Response Monitor Radar */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-400" /> Judge Submissions
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono font-bold">
                {submittedJudgeCount} Locked
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm">
                <span className="text-slate-300 font-medium">Scoring Permission:</span>
                <span className={`font-bold flex items-center gap-1.5 ${state?.is_judge_input_unlocked ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {state?.is_judge_input_unlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {state?.is_judge_input_unlocked ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm">
                <span className="text-slate-300 font-medium">SHA-256 Hashing:</span>
                <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> ACTIVE
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 text-xs text-slate-500 text-center border-t border-slate-800/80">
            Judges auto-lock immediately upon submission or timer expiration.
          </div>
        </div>
      </div>

      {/* Performer Stage Queue Selector */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" /> Performer Queue & Staging Selector
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {participants.map((p) => {
            const isSelected = activePerformer?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => selectActivePerformer(p)}
                disabled={isLive && isSelected}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${
                  isSelected 
                    ? 'bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500 text-white shadow-lg' 
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold text-cyan-400">#{p.performance_order}</span>
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {p.performance_type}
                  </span>
                </div>
                <div className="font-bold truncate text-slate-100">{p.team_name || p.participant_name || `${p.first_name || ''} ${p.last_name || ''}`.trim()}</div>
                <div className="text-xs text-slate-400 truncate mt-0.5">{p.church_name || 'Independent'}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
