'use client';

// src/app/admin/control-room/page.tsx - Event Operator & Admin Live Control Room Console

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/auth/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Category, Performance, JudgeAssignment, TimerState, ScoreSubmission } from '@/types';
import { computeTimerDisplay } from '@/lib/timer/authoritativeTimer';
import { controlTimer, advancePerformanceSlot } from '@/actions/timer';
import { reopenScore } from '@/actions/scoring';
import { calculateAndStoreCategoryResults, approveResults, publishResults } from '@/actions/results';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  ChevronRight,
  ChevronLeft,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Radio,
  Calculator,
  Lock,
  Unlock,
  Settings2,
  FastForward,
} from 'lucide-react';

export default function LiveControlRoomPage() {
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [currentPerfIndex, setCurrentPerfIndex] = useState(0);
  const [judges, setJudges] = useState<JudgeAssignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, ScoreSubmission>>({});
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [timerDisplay, setTimerDisplay] = useState({
    formattedDisplay: '05:00',
    isWarning: false,
    isOvertime: false,
  });

  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [customDurationMinutes, setCustomDurationMinutes] = useState('5');

  const [reopenTarget, setReopenTarget] = useState<ScoreSubmission | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. Fetch categories
  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase.from('categories').select('*').order('display_order');
      if (data && data.length > 0) {
        const mappedCategories = data.map((c: any) => ({
          id: c.id,
          competitionId: c.competition_id,
          name: c.name,
          performerType: c.performer_type || 'solo',
          displayOrder: c.display_order,
          scoringFormula: c.scoring_formula,
          status: c.status,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));
        setCategories(mappedCategories as any);
        setSelectedCategory(mappedCategories[0] as any);
      }
    }
    loadCategories();
  }, []);

  // 2. Fetch performances & judges when category changes
  useEffect(() => {
    if (!selectedCategory) return;

    async function loadCategoryDetails() {
      // Fetch performances for round 1
      const { data: rounds } = await supabase
        .from('rounds')
        .select('id')
        .eq('category_id', selectedCategory!.id)
        .order('round_number')
        .limit(1);

      if (rounds && rounds.length > 0) {
        const roundId = rounds[0].id;
        const { data: perfs } = await supabase
          .from('performances')
          .select('*, participant:participants(*), team:teams(*), timer:timers(*)')
          .eq('round_id', roundId)
          .order('performance_order');

        if (perfs) {
          const mappedPerfs = perfs.map((p: any) => ({
            id: p.id,
            roundId: p.round_id,
            participantId: p.participant_id,
            teamId: p.team_id,
            performanceOrder: p.performance_order,
            performanceCode: p.performance_code,
            status: p.status,
            startedAt: p.started_at,
            completedAt: p.completed_at,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            participant: p.participant ? {
              id: p.participant.id,
              competitionId: p.participant.competition_id,
              participantCode: p.participant.participant_code,
              firstName: p.participant.first_name,
              lastName: p.participant.last_name,
              institution: p.participant.institution,
              contactEmail: p.participant.contact_email,
              contactPhone: p.participant.contact_phone,
              environment: p.participant.environment,
            } : undefined,
            team: p.team ? {
              id: p.team.id,
              competitionId: p.team.competition_id,
              teamCode: p.team.team_code,
              name: p.team.name,
              institution: p.team.institution,
              environment: p.team.environment,
            } : undefined,
          }));
          setPerformances(mappedPerfs as any);
          setCurrentPerfIndex(0);
        }
      }

      // Fetch assigned judges
      const { data: judgeData } = await supabase
        .from('judge_assignments')
        .select('*, judge:profiles(*)')
        .eq('category_id', selectedCategory!.id)
        .eq('is_active', true)
        .order('judge_seat_number');

      if (judgeData) {
        const mappedJudges = judgeData.map((j: any) => ({
          id: j.id,
          competitionId: j.competition_id,
          categoryId: j.category_id,
          judgeId: j.judge_id,
          judgeSeatNumber: j.judge_seat_number,
          isActive: j.is_active,
          assignedAt: j.assigned_at,
          judge: j.judge ? {
            id: j.judge.id,
            email: j.judge.email,
            fullName: j.judge.full_name,
            phoneNumber: j.judge.phone_number,
            avatarUrl: j.judge.avatar_url,
            isActive: j.judge.is_active,
          } : undefined,
        }));
        setJudges(mappedJudges as any);
      }
    }

    loadCategoryDetails();
  }, [selectedCategory]);

  const currentPerformance = performances[currentPerfIndex];

  // 3. Realtime subscription for submissions & timer for the current performance
  useEffect(() => {
    if (!currentPerformance) return;

    async function fetchSubmissionsAndTimer() {
      const { data: subs } = await supabase
        .from('score_submissions')
        .select('*')
        .eq('performance_id', currentPerformance.id);

      const subMap: Record<string, ScoreSubmission> = {};
      (subs || []).forEach((s: any) => {
        subMap[s.judge_id] = s;
      });
      setSubmissions(subMap);

      const { data: t } = await supabase
        .from('timers')
        .select('*')
        .eq('performance_id', currentPerformance.id)
        .single();

      if (t) {
        setTimerState({
          id: t.id,
          performanceId: t.performance_id,
          status: t.status,
          configuredDurationSeconds: t.configured_duration_seconds,
          warningThresholdSeconds: t.warning_threshold_seconds,
          startedAt: t.started_at,
          pausedAt: t.paused_at,
          accumulatedDurationSeconds: Number(t.accumulated_duration_seconds),
          overtimeSeconds: Number(t.overtime_seconds),
          updatedAt: t.updated_at,
        });
      }
    }

    fetchSubmissionsAndTimer();

    // Supabase Realtime channel for live submissions & timers
    const channel = supabase
      .channel(`perf_${currentPerformance.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'score_submissions', filter: `performance_id=eq.${currentPerformance.id}` },
        () => fetchSubmissionsAndTimer()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timers', filter: `performance_id=eq.${currentPerformance.id}` },
        (payload) => {
          if (payload.new) {
            const t = payload.new as any;
            setTimerState({
              id: t.id,
              performanceId: t.performance_id,
              status: t.status,
              configuredDurationSeconds: t.configured_duration_seconds,
              warningThresholdSeconds: t.warning_threshold_seconds,
              startedAt: t.started_at,
              pausedAt: t.paused_at,
              accumulatedDurationSeconds: Number(t.accumulated_duration_seconds),
              overtimeSeconds: Number(t.overtime_seconds),
              updatedAt: t.updated_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPerformance]);

  // 4. Timer Tick calculation loop
  useEffect(() => {
    if (!timerState) return;

    const interval = setInterval(() => {
      const display = computeTimerDisplay(timerState);
      setTimerDisplay({
        formattedDisplay: display.formattedDisplay,
        isWarning: display.isWarning,
        isOvertime: display.isOvertime,
      });
    }, 200);

    return () => clearInterval(interval);
  }, [timerState]);

  // Timer controls
  const handleTimerAction = async (action: 'start' | 'pause' | 'resume' | 'stop' | 'reset') => {
    if (!currentPerformance) return;

    // Optimistic UI update
    const nowIso = new Date().toISOString();
    setTimerState((prev) => {
      if (!prev) return null;
      if (action === 'start') {
        return { ...prev, status: 'running', startedAt: nowIso, pausedAt: null, accumulatedDurationSeconds: 0 };
      } else if (action === 'pause') {
        let accum = prev.accumulatedDurationSeconds || 0;
        if (prev.status === 'running' && prev.startedAt) {
          accum += Math.max(0, (Date.now() - new Date(prev.startedAt).getTime()) / 1000);
        }
        return { ...prev, status: 'paused', pausedAt: nowIso, accumulatedDurationSeconds: accum };
      } else if (action === 'resume') {
        return { ...prev, status: 'running', startedAt: nowIso, pausedAt: null };
      } else if (action === 'stop') {
        let accum = prev.accumulatedDurationSeconds || 0;
        if (prev.status === 'running' && prev.startedAt) {
          accum += Math.max(0, (Date.now() - new Date(prev.startedAt).getTime()) / 1000);
        }
        return { ...prev, status: 'stopped', pausedAt: nowIso, accumulatedDurationSeconds: accum };
      } else if (action === 'reset') {
        return { ...prev, status: 'idle', startedAt: null, pausedAt: null, accumulatedDurationSeconds: 0, overtimeSeconds: 0 };
      }
      return prev;
    });

    try {
      const res = await controlTimer({
        performanceId: currentPerformance.id,
        action,
      });

      if (res && (res as any).timer) {
        const t = (res as any).timer;
        setTimerState({
          id: t.id,
          performanceId: t.performance_id,
          status: t.status,
          configuredDurationSeconds: t.configured_duration_seconds,
          warningThresholdSeconds: t.warning_threshold_seconds,
          startedAt: t.started_at,
          pausedAt: t.paused_at,
          accumulatedDurationSeconds: Number(t.accumulated_duration_seconds),
          overtimeSeconds: Number(t.overtime_seconds),
          updatedAt: t.updated_at,
        });
      }
    } catch (err: unknown) {
      console.error('Timer action failed:', err);
    }
  };

  // Adjust timing duration (presets or custom)
  const handleUpdateDuration = async (seconds: number) => {
    if (!currentPerformance || seconds <= 0) return;
    setTimerState((prev) => prev ? { ...prev, configuredDurationSeconds: seconds } : null);
    setIsEditingDuration(false);
    try {
      await controlTimer({
        performanceId: currentPerformance.id,
        action: 'update_duration',
        durationSeconds: seconds,
      });
      setStatusMessage(`Official timer adjusted to ${Math.floor(seconds / 60)}m ${seconds % 60 ? (seconds % 60) + 's' : ''}`);
    } catch (err) {
      console.error('Failed to update timer duration:', err);
    }
  };

  // Advance Slot Handler
  const handleAdvanceSlot = async () => {
    if (!currentPerformance) return;
    const nextPerf = performances[currentPerfIndex + 1];
    try {
      await advancePerformanceSlot(currentPerformance.id, nextPerf?.id);
      if (nextPerf) {
        setCurrentPerfIndex((p) => Math.min(performances.length - 1, p + 1));
        setStatusMessage(`Advanced to Slot #${nextPerf.performanceOrder} (${nextPerf.participant?.firstName || 'Performer'})`);
      } else {
        setStatusMessage(`Marked Slot #${currentPerformance.performanceOrder} as completed.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to advance slot');
    }
  };

  // Score Reopen Handler
  const handleReopenScore = async () => {
    if (!reopenTarget || !reopenReason) return;
    try {
      await reopenScore({
        submissionId: reopenTarget.id,
        reason: reopenReason,
      });
      setReopenTarget(null);
      setReopenReason('');
      setStatusMessage('Score successfully reopened for modification.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reopen score');
    }
  };

  // Calculate Category Results
  const handleCalculateCategory = async () => {
    if (!selectedCategory || !currentPerformance) return;
    try {
      setCalculating(true);
      const res = await calculateAndStoreCategoryResults(
        selectedCategory.id,
        currentPerformance.roundId
      );
      setStatusMessage(`Results computed successfully for ${res.entries.length} participants!`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Calculation error');
    } finally {
      setCalculating(false);
    }
  };

  const performerName = currentPerformance?.participant
    ? `${currentPerformance.participant.firstName} ${currentPerformance.participant.lastName}`
    : currentPerformance?.team?.name || 'No Performer Selected';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Live Competition Control Room</h1>
              <p className="text-xs text-slate-400">Chief Scrutineer & Event Operator Command Center</p>
            </div>
          </div>

          {/* Category Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">Category:</label>
            <select
              value={selectedCategory?.id || ''}
              onChange={(e) => {
                const found = categories.find((c) => c.id === e.target.value);
                if (found) setSelectedCategory(found);
              }}
              className="bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({(c.performerType || (c as any).performer_type || 'solo').toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-emerald-400 font-bold ml-4">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stage & Timer (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Performer Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                    Slot #{currentPerformance?.performanceOrder || 0}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {currentPerformance?.participant?.participantCode || currentPerformance?.performanceCode}
                  </span>
                </div>

                {/* Next / Prev Navigation & Advance Slot Buttons */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/50">
                    <button
                      disabled={currentPerfIndex <= 0}
                      onClick={() => setCurrentPerfIndex((p) => Math.max(0, p - 1))}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                      title="Previous Performer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-300 font-mono px-1.5">
                      {currentPerfIndex + 1} / {performances.length}
                    </span>
                    <button
                      disabled={currentPerfIndex >= performances.length - 1}
                      onClick={() => setCurrentPerfIndex((p) => Math.min(performances.length - 1, p + 1))}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                      title="Next Performer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleAdvanceSlot}
                    className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-semibold text-xs flex items-center gap-1.5 border border-indigo-500/40 shadow-sm cursor-pointer"
                    title="Conclude current slot and move panel to next performer"
                  >
                    <FastForward className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Advance Slot</span>
                  </button>
                </div>
              </div>

              <h2 className="text-3xl font-extrabold text-white tracking-tight">{performerName}</h2>
              {currentPerformance?.participant?.institution && (
                <p className="text-sm text-slate-400 mt-1">{currentPerformance.participant.institution}</p>
              )}
            </div>

            {/* Authoritative Timer Card */}
            <div className={`border rounded-2xl p-8 shadow-2xl flex flex-col items-center justify-center transition-colors ${
              timerDisplay.isOvertime
                ? 'bg-rose-950/40 border-rose-500/60 shadow-rose-500/10'
                : timerDisplay.isWarning
                ? 'bg-amber-950/30 border-amber-500/50 shadow-amber-500/10'
                : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="text-xs uppercase tracking-widest font-bold text-slate-400 flex items-center gap-1.5 mb-2">
                <Clock className="w-4 h-4" />
                <span>Authoritative Event Clock</span>
                {timerDisplay.isOvertime && (
                  <span className="text-rose-400 font-bold bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                    OVERTIME
                  </span>
                )}
              </div>

              {/* Big Digital Clock Display */}
              <div className={`font-mono text-7xl sm:text-8xl font-black tracking-tight my-4 select-none ${
                timerDisplay.isOvertime
                  ? 'text-rose-400 animate-pulse'
                  : timerDisplay.isWarning
                  ? 'text-amber-400 animate-pulse'
                  : 'text-white'
              }`}>
                {timerDisplay.formattedDisplay}
              </div>

              {/* Timer Controls */}
              <div className="flex items-center gap-3 mt-4">
                {timerState?.status === 'running' ? (
                  <button
                    onClick={() => handleTimerAction('pause')}
                    className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-amber-600/20 cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </button>
                ) : timerState?.status === 'paused' ? (
                  <button
                    onClick={() => handleTimerAction('resume')}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleTimerAction('start')}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Performance</span>
                  </button>
                )}

                <button
                  onClick={() => handleTimerAction('stop')}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm flex items-center gap-2 border border-slate-700 cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop</span>
                </button>

                <button
                  onClick={() => handleTimerAction('reset')}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 cursor-pointer"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Timing Duration Controls */}
              <div className="mt-8 pt-6 border-t border-slate-800/80 w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <Settings2 className="w-4 h-4 text-indigo-400" />
                  <span>Configured Duration: <strong className="text-white">{Math.floor((timerState?.configuredDurationSeconds || 300) / 60)}m {(timerState?.configuredDurationSeconds || 300) % 60 ? ((timerState?.configuredDurationSeconds || 300) % 60) + 's' : ''}</strong></span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Presets:</span>
                  {[
                    { label: '2m', sec: 120 },
                    { label: '3m', sec: 180 },
                    { label: '5m', sec: 300 },
                    { label: '8m', sec: 480 },
                    { label: '10m', sec: 600 },
                  ].map((p) => (
                    <button
                      key={p.sec}
                      type="button"
                      onClick={() => handleUpdateDuration(p.sec)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-colors cursor-pointer ${
                        timerState?.configuredDurationSeconds === p.sec
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}

                  {isEditingDuration ? (
                    <div className="flex items-center gap-1 ml-1 bg-slate-950 p-1 rounded-lg border border-slate-700">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={customDurationMinutes}
                        onChange={(e) => setCustomDurationMinutes(e.target.value)}
                        className="w-12 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                        placeholder="min"
                      />
                      <span className="text-[10px] text-slate-400">min</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateDuration(Math.max(1, parseInt(customDurationMinutes) || 5) * 60)}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded cursor-pointer"
                      >
                        Set
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingDuration(false)}
                        className="px-1.5 py-0.5 text-slate-400 hover:text-slate-200 text-[10px] cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingDuration(true)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs ml-1 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Custom</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Judge Submission Matrix */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Judge Readiness Matrix</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {Object.values(submissions).filter((s) => s.status === 'locked').length} / {judges.length} Locked
                </span>
              </div>

              <div className="space-y-3">
                {judges.map((j) => {
                  const sub = submissions[j.judgeId];
                  const isSubmitted = sub?.status === 'locked' || sub?.status === 'submitted';

                  return (
                    <div
                      key={j.id}
                      className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
                            Seat {j.judgeSeatNumber}
                          </span>
                          <span className="text-xs font-semibold text-slate-100">
                            {j.judge?.fullName || `Judge ${j.judgeSeatNumber}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSubmitted ? (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <Lock className="w-3 h-3" />
                            <span>Submitted</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </div>
                        )}

                        {/* Reopen Button for Admins */}
                        {isSubmitted && (
                          <button
                            onClick={() => setReopenTarget(sub)}
                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-amber-300 transition-colors"
                            title="Reopen Score for Modification"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Finalize Category & Results Button */}
              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={handleCalculateCategory}
                  disabled={calculating}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Calculator className="w-4 h-4" />
                  <span>{calculating ? 'Calculating Rankings...' : 'Calculate Official Results'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Score Reopen Modal Dialog */}
        {reopenTarget && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
                <ShieldAlert className="w-5 h-5" />
                <span>Audited Score Reopening</span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Reopening a locked score will permit the assigned judge to amend entered marks. A full historical snapshot will be logged.
              </p>

              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mandatory Reason for Scrutiny Log:
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Enter exact reason (e.g. Scrutineer corrected criterion transcription error)..."
                className="w-full h-24 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setReopenTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReopenScore}
                  disabled={reopenReason.trim().length < 10}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  Confirm & Reopen
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
