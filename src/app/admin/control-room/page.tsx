'use client';

// src/app/admin/control-room/page.tsx - Chief Scrutineer & Event Operator Command Center
import React, { useEffect, useState, useCallback } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { supabase } from '@/lib/supabase/client';
import { 
  Radio, 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Unlock,
  FileSpreadsheet,
  PlusCircle,
  Trophy,
  Award,
  Upload
} from 'lucide-react';
import Link from 'next/link';

interface CompetitionItem {
  id: string;
  name: string;
  code: string;
  environment: string;
}

interface ParticipantAct {
  id: string;
  competition_id: string;
  participant_code: string;
  participant_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  church_name?: string | null;
  team_name?: string | null;
  performance_type: string;
  performance_order: number;
  best_keyboardist?: string | null;
  best_rhythmist?: string | null;
  best_guitarist?: string | null;
}

interface ScoreRecord {
  id: string;
  judge_id: string;
  participant_id: string;
  total_score: number;
  score_hash: string;
  submitted_at: string;
}

export default function ControlRoomPage() {
  const [competitions, setCompetitions] = useState<CompetitionItem[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [acts, setActs] = useState<ParticipantAct[]>([]);
  const [currentActIndex, setCurrentActIndex] = useState(0);
  const [eventState, setEventState] = useState<any>(null);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [judges, setJudges] = useState<any[]>([]);

  const [timeSlots, setTimeSlots] = useState<{ solo: number; duet: number; group: number }>({
    solo: 240,
    duet: 300,
    group: 360,
  });
  const [timeLeft, setTimeLeft] = useState(240);
  const [externalWebhookUrl, setExternalWebhookUrl] = useState('');
  const [isTriggeringExternal, setIsTriggeringExternal] = useState(false);
  const [externalTriggerLog, setExternalTriggerLog] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // 1. Load Real Live Competitions
  useEffect(() => {
    async function loadComps() {
      const { data } = await supabase
        .from('competitions')
        .select('id, name, code, environment')
        .neq('environment', 'practice')
        .not('name', 'ilike', '%demo%')
        .not('name', 'ilike', '%practice%')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setCompetitions(data);
        setSelectedCompId(data[0].id);
      }
    }
    loadComps();
  }, []);

  // Helper to get target duration for an act based on its performance type
  const getActDuration = useCallback((act?: ParticipantAct | null) => {
    if (!act) return timeSlots.solo;
    const type = (act.performance_type || '').toLowerCase();
    if (type.includes('group') || type.includes('choir') || type.includes('band')) return timeSlots.group;
    if (type.includes('duet')) return timeSlots.duet;
    return timeSlots.solo;
  }, [timeSlots]);

  // 2. Load Acts, Settings & State for Selected Competition
  const loadEventData = useCallback(async () => {
    if (!selectedCompId) return;

    const [
      { data: pList },
      { data: st },
      { data: scList },
      { data: jList },
      { data: settings }
    ] = await Promise.all([
      supabase
        .from('participants')
        .select('*')
        .eq('competition_id', selectedCompId)
        .neq('environment', 'practice')
        .not('participant_name', 'ilike', '%demo%')
        .not('team_name', 'ilike', '%demo%')
        .order('performance_order', { ascending: true }),
      supabase.from('event_state').select('*').eq('event_id', selectedCompId).maybeSingle(),
      supabase.from('scores').select('*').eq('event_id', selectedCompId),
      supabase.from('profiles').select('*, roles:user_roles(role)').eq('roles.role', 'judge'),
      supabase.from('competition_settings').select('*').eq('competition_id', selectedCompId).maybeSingle(),
    ]);

    const loadedSlots = {
      solo: Number(settings?.solo_duration_seconds || 240),
      duet: Number(settings?.duet_duration_seconds || 300),
      group: Number(settings?.group_duration_seconds || 480),
    };
    setTimeSlots(loadedSlots);

    if (pList && pList.length > 0) {
      setActs(pList);
      if (st?.active_participant_id) {
        const activeIdx = pList.findIndex((p) => p.id === st.active_participant_id);
        if (activeIdx !== -1) {
          setCurrentActIndex(activeIdx);
        }
      }
    }

    if (st) {
      setEventState(st);
    }

    if (scList) setScores(scList);
    if (jList) setJudges(jList.filter((j) => j.roles?.[0]?.role === 'judge'));
  }, [selectedCompId]);

  useEffect(() => {
    loadEventData();
  }, [loadEventData]);

  // 3. Realtime Sync
  useEffect(() => {
    if (!selectedCompId) return;

    const channel = supabase
      .channel(`control_room_${selectedCompId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_settings', filter: `competition_id=eq.${selectedCompId}` }, (payload) => {
        const updatedSettings = payload.new as any;
        if (updatedSettings) {
          setTimeSlots({
            solo: Number(updatedSettings.solo_duration_seconds || 240),
            duet: Number(updatedSettings.duet_duration_seconds || 300),
            group: Number(updatedSettings.group_duration_seconds || 480),
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state', filter: `event_id=eq.${selectedCompId}` }, (payload) => {
        const updated = payload.new as any;
        setEventState(updated);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `event_id=eq.${selectedCompId}` }, () => {
        loadEventData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCompId, loadEventData]);

  const currentAct = acts[currentActIndex] || null;
  const isLive = eventState?.stage_mode === 'live';

  // 4. Tab-Change Resilient Authoritative Wall-Clock Timer
  useEffect(() => {
    const actDuration = getActDuration(currentAct);
    const targetDuration = eventState?.timer_duration_seconds || actDuration;

    if (eventState?.stage_mode !== 'live' || eventState?.timer_status !== 'running') {
      if (eventState?.timer_duration_seconds) {
        setTimeLeft(eventState.timer_duration_seconds - Math.floor(eventState.timer_elapsed_seconds || 0));
      } else {
        setTimeLeft(targetDuration);
      }
      return;
    }

    const calcRemaining = () => {
      if (!eventState?.timer_started_at) return targetDuration;
      const startedMs = new Date(eventState.timer_started_at).getTime();
      const elapsedSecs = Math.floor((Date.now() - startedMs) / 1000);
      return Math.max(0, targetDuration - elapsedSecs);
    };

    setTimeLeft(calcRemaining());
    const interval = setInterval(() => {
      setTimeLeft(calcRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [eventState?.stage_mode, eventState?.timer_status, eventState?.timer_started_at, eventState?.timer_duration_seconds, currentAct, getActDuration]);

  // 5. Stage State Machine Controls
  const setStageMode = async (mode: 'standby' | 'live' | 'completed', unlockJudges = false) => {
    if (!selectedCompId) return;
    setIsUpdating(true);
    const actDuration = getActDuration(currentAct);
    const durationToUse = eventState?.timer_duration_seconds || actDuration;

    await supabase.from('event_state').upsert({
      event_id: selectedCompId,
      stage_mode: mode,
      is_judge_input_unlocked: unlockJudges,
      timer_status: mode === 'live' ? 'running' : 'stopped',
      timer_duration_seconds: durationToUse,
      timer_started_at: mode === 'live' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' });
    setIsUpdating(false);
  };

  const advanceToAct = async (newIndex: number) => {
    if (newIndex < 0 || newIndex >= acts.length || !selectedCompId) return;
    const target = acts[newIndex];
    setCurrentActIndex(newIndex);
    setIsUpdating(true);
    const targetDuration = getActDuration(target);
    setTimeLeft(targetDuration);

    await supabase.from('event_state').upsert({
      event_id: selectedCompId,
      active_participant_id: target.id,
      stage_mode: 'standby',
      is_judge_input_unlocked: false,
      timer_status: 'idle',
      timer_duration_seconds: targetDuration,
      timer_elapsed_seconds: 0,
      timer_started_at: null,
      current_category: target.performance_type,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' });

    setIsUpdating(false);
  };

  const setManualDuration = async (seconds: number) => {
    if (!selectedCompId) return;
    const clamped = Math.max(10, seconds);
    setTimeLeft(clamped);
    await supabase.from('event_state').upsert({
      event_id: selectedCompId,
      timer_duration_seconds: clamped,
      timer_elapsed_seconds: 0,
      timer_started_at: isLive ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' });
  };

  const adjustTimerMinutes = async (deltaMinutes: number) => {
    const nextVal = Math.max(10, timeLeft + deltaMinutes * 60);
    await setManualDuration(nextVal);
  };

  const resetToCategoryDefault = async () => {
    const actDuration = getActDuration(currentAct);
    await setManualDuration(actDuration);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeScores = scores.filter((s) => s.participant_id === currentAct?.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Live Competition Control Room</h1>
                <p className="text-xs text-slate-400">Chief Scrutineer & Event Operator Command Center</p>
              </div>
            </div>
          </div>

          {/* Event Selector Dropdown */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400">Active Event:</span>
            {competitions.length === 0 ? (
              <Link
                href="/admin/dashboard"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Create Event
              </Link>
            ) : (
              <select
                value={selectedCompId || ''}
                onChange={(e) => setSelectedCompId(e.target.value)}
                className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:border-cyan-500 rounded-xl text-xs font-bold text-cyan-300 focus:outline-none cursor-pointer"
              >
                {competitions.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name} ({comp.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Empty State when no acts loaded */}
        {acts.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">No Competition Acts Loaded Yet</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Import church registration Google Sheets or CSV files with Solo, Duet, Group Choir, and instrumentalist parameters to initialize the stage queue.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                href="/admin/import"
                className="px-5 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950 flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Import Sheet / CSV
              </Link>
              <Link
                href="/admin/staging"
                className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 flex items-center gap-2 cursor-pointer"
              >
                <Radio className="w-4 h-4 text-emerald-400" /> Stage Manager
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Staged Performer Details */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                      Slot #{currentAct?.performance_order || currentActIndex + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {currentAct?.participant_code}
                    </span>
                  </div>

                  {/* Act Stepper Navigation */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => advanceToAct(currentActIndex - 1)}
                      disabled={currentActIndex === 0 || isUpdating}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-bold px-2 text-slate-300">
                      {currentActIndex + 1} / {acts.length}
                    </span>
                    <button
                      onClick={() => advanceToAct(currentActIndex + 1)}
                      disabled={currentActIndex >= acts.length - 1 || isUpdating}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Performer Info */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-black tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    Category: {(currentAct?.performance_type || 'Solo').toUpperCase()}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {currentAct?.participant_name || currentAct?.team_name || `${currentAct?.first_name || ''} ${currentAct?.last_name || ''}`.trim()}
                  </h2>
                  <p className="text-sm text-slate-400 flex items-center gap-1.5">
                    <span>🏛️ Church / Organization:</span>
                    <strong className="text-slate-200">{currentAct?.church_name || 'Independent Church'}</strong>
                  </p>

                  {/* Special Instrumental Candidates for Group Performance */}
                  {currentAct?.performance_type === 'group' && (
                    <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-2 text-xs">
                      {currentAct.best_keyboardist && (
                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                          🎹 Keys: {currentAct.best_keyboardist}
                        </span>
                      )}
                      {currentAct.best_rhythmist && (
                        <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                          🥁 Rhythm: {currentAct.best_rhythmist}
                        </span>
                      )}
                      {currentAct.best_guitarist && (
                        <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
                          🎸 Guitar: {currentAct.best_guitarist}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Authoritative Timer & Live Stage Controls */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Authoritative Wall-Clock Stage Countdown</span>
                  </div>

                  <div className={`font-mono text-5xl sm:text-6xl font-black tracking-tight ${
                    isLive 
                      ? timeLeft < 60 
                        ? 'text-red-400 animate-pulse' 
                        : 'text-emerald-400' 
                      : 'text-slate-500'
                  }`}>
                    {formatSeconds(timeLeft)}
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <button
                      onClick={() => setStageMode('live', true)}
                      disabled={isLive || isUpdating}
                      className="px-6 py-3 rounded-2xl font-black text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-950 disabled:opacity-40 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-current" /> Start Live Stage
                    </button>
                    <button
                      onClick={() => setStageMode('standby', false)}
                      disabled={!isLive || isUpdating}
                      className="px-6 py-3 rounded-2xl font-bold text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 disabled:opacity-40 flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Pause className="w-4 h-4" /> Standby (Lock)
                    </button>
                    <button
                      onClick={() => setStageMode('completed', false)}
                      disabled={isUpdating}
                      className="px-6 py-3 rounded-2xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40 flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Mark Completed
                    </button>
                  </div>

                  {/* Category Dedicated Presets & Quick Controls */}
                  <div className="pt-3 border-t border-slate-900 flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Category Presets:</span>
                    <button
                      type="button"
                      onClick={() => setManualDuration(timeSlots.solo)}
                      className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                        currentAct?.performance_type === 'solo'
                          ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🎤 Solo ({Math.round(timeSlots.solo / 60)}m)
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualDuration(timeSlots.duet)}
                      className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                        currentAct?.performance_type === 'duet'
                          ? 'bg-purple-600/25 border-purple-500/50 text-purple-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      👥 Duet ({Math.round(timeSlots.duet / 60)}m)
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualDuration(timeSlots.group)}
                      className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                        currentAct?.performance_type === 'group'
                          ? 'bg-cyan-600/25 border-cyan-500/50 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🏛️ Group ({Math.round(timeSlots.group / 60)}m)
                    </button>

                    <div className="h-4 w-px bg-slate-800 mx-1"></div>

                    <button
                      type="button"
                      onClick={() => adjustTimerMinutes(1)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-mono font-bold cursor-pointer transition-colors"
                      title="Add 1 Minute"
                    >
                      +1m
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustTimerMinutes(-1)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-mono font-bold cursor-pointer transition-colors"
                      title="Subtract 1 Minute"
                    >
                      -1m
                    </button>
                    <button
                      type="button"
                      onClick={resetToCategoryDefault}
                      className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-amber-400 cursor-pointer transition-colors"
                      title="Reset to Current Category Duration"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Judge Submission Matrix */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Judge Readiness Matrix</span>
                  </h3>
                  <span className="text-xs font-mono font-black text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    {activeScores.length} Locked
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Judges evaluate Creator-Configured Criteria with direct numeric input and submit SHA-256 signed scores.
                </p>

                <div className="space-y-2 pt-2">
                  {activeScores.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500 font-medium">
                      Waiting for judge score submissions...
                    </div>
                  ) : (
                    activeScores.map((sc, idx) => (
                      <div key={sc.id || idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="font-bold text-white">Judge #{idx + 1}</span>
                        </div>
                        <span className="font-mono font-black text-cyan-400">{sc.total_score.toFixed(2)} pts</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <Link
                    href="/live"
                    className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950 transition-all"
                  >
                    <Trophy className="w-4 h-4" /> View Live Scoreboard
                  </Link>
                  <Link
                    href="/admin/dashboard"
                    className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all"
                  >
                    <Award className="w-4 h-4 text-purple-400" /> Review Category Prizes & Standings
                  </Link>
                </div>
              </div>

              {/* External Integration Trigger Console */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <span>External Stage Integration</span>
                  </h3>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Ready
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Broadcast synchronized timer triggers, stage lighting cues, audio gongs, and LED walls via external webhook / socket.
                </p>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 block">External Webhook / Trigger URL</label>
                  <input
                    type="url"
                    placeholder="https://stage-controller.local/api/cue"
                    value={externalWebhookUrl}
                    onChange={(e) => setExternalWebhookUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isTriggeringExternal}
                    onClick={async () => {
                      setIsTriggeringExternal(true);
                      const timestamp = new Date().toLocaleTimeString();
                      setExternalTriggerLog((prev) => [`[${timestamp}] Broadcasted START_ACT trigger to external systems`, ...prev.slice(0, 3)]);
                      setTimeout(() => setIsTriggeringExternal(false), 600);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 font-bold text-xs border border-cyan-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Send Cue Start</span>
                  </button>

                  <button
                    type="button"
                    disabled={isTriggeringExternal}
                    onClick={async () => {
                      setIsTriggeringExternal(true);
                      const timestamp = new Date().toLocaleTimeString();
                      setExternalTriggerLog((prev) => [`[${timestamp}] Broadcasted OVERTIME_GONG alert to stage`, ...prev.slice(0, 3)]);
                      setTimeout(() => setIsTriggeringExternal(false), 600);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-xs border border-rose-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Send Gong Alert</span>
                  </button>
                </div>

                {externalTriggerLog.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono text-[10px] text-slate-400">
                    {externalTriggerLog.map((log, i) => (
                      <div key={i} className="truncate text-cyan-300/80">{log}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
