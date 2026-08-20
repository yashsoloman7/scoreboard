'use client';

// src/app/judge/[categoryId]/[performanceId]/page.tsx - Touch-Optimized Mobile/Tablet Judge Scoring Console

import React, { useEffect, useState, use, useId } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/auth/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { CategoryCriterion, CriteriaVersion, Performance, ScoreSubmission, TimerState } from '@/types';
import { offlineDraftStore } from '@/lib/storage/offlineDraftStore';
import { submitScore, getJudgeSubmissionForPerformance } from '@/actions/scoring';
import { computeTimerDisplay } from '@/lib/timer/authoritativeTimer';
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  Send,
  EyeOff,
  Wifi,
  WifiOff,
  User,
  Award,
  Sparkles,
  Clock,
  Radio,
  Hourglass,
} from 'lucide-react';
import Link from 'next/link';

export default function JudgeScoringConsolePage({
  params,
}: {
  params: Promise<{ categoryId: string; performanceId: string }>;
}) {
  const resolvedParams = use(params);
  const { categoryId, performanceId } = resolvedParams;
  const { user } = useAuth();

  const [performance, setPerformance] = useState<Performance | null>(null);
  const [criteriaVersion, setCriteriaVersion] = useState<CriteriaVersion | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [maskedFields, setMaskedFields] = useState<Record<string, boolean>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [submission, setSubmission] = useState<ScoreSubmission | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [timerDisplay, setTimerDisplay] = useState({
    formattedDisplay: '05:00',
    isWarning: false,
    isOvertime: false,
  });

  // Connectivity monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Timer calculation loop
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

  // Load performance, criteria & existing submission / draft
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        // 1. Performance Details
        const { data: perf } = await supabase
          .from('performances')
          .select('*, participant:participants(*), team:teams(*)')
          .eq('id', performanceId)
          .single();

        if (perf) {
          setPerformance({
            id: perf.id,
            roundId: perf.round_id,
            participantId: perf.participant_id,
            teamId: perf.team_id,
            performanceOrder: perf.performance_order,
            performanceCode: perf.performance_code,
            status: perf.status,
            participant: perf.participant ? {
              id: perf.participant.id,
              competitionId: perf.participant.competition_id,
              participantCode: perf.participant.participant_code,
              firstName: perf.participant.first_name,
              lastName: perf.participant.last_name,
              institution: perf.participant.institution,
              contactEmail: perf.participant.contact_email,
              contactPhone: perf.participant.contact_phone,
              environment: perf.participant.environment,
              createdAt: perf.participant.created_at,
              updatedAt: perf.participant.updated_at,
            } : null,
            team: perf.team ? {
              id: perf.team.id,
              competitionId: perf.team.competition_id,
              teamCode: perf.team.team_code,
              name: perf.team.name,
              institution: perf.team.institution,
              environment: perf.team.environment,
              createdAt: perf.team.created_at,
            } : null,
            createdAt: perf.created_at,
            updatedAt: perf.updated_at,
          });
        }

        // 2. Criteria Version & Criteria Items
        const { data: version } = await supabase
          .from('criteria_versions')
          .select('*, criteria:category_criteria(*)')
          .eq('category_id', categoryId)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();

        if (version) {
          setCriteriaVersion({
            id: version.id,
            categoryId: version.category_id,
            versionNumber: version.version_number,
            isLocked: version.is_locked,
            lockedAt: version.locked_at,
            createdAt: version.created_at,
            criteria: (version.criteria || []).map((c: any) => ({
              id: c.id,
              criteriaVersionId: c.criteria_version_id,
              name: c.name,
              description: c.description,
              maxMarks: Number(c.max_marks),
              weight: Number(c.weight),
              displayOrder: c.display_order,
              createdAt: c.created_at,
            })),
          });
        }

        // 3. Existing Submission on Server
        const existingSub = await getJudgeSubmissionForPerformance(performanceId, user.id);
        if (existingSub) {
          setSubmission(existingSub);
          if (existingSub.status === 'locked' || existingSub.status === 'submitted') {
            setIsLocked(true);
            const scoreMap: Record<string, number> = {};
            const maskMap: Record<string, boolean> = {};
            existingSub.entries.forEach((e) => {
              scoreMap[e.criterionId] = e.rawScore;
              maskMap[e.criterionId] = true;
            });
            setScores(scoreMap);
            setMaskedFields(maskMap);
          }
        } else {
          const draft = offlineDraftStore.getDraft(performanceId);
          if (draft) {
            setScores(draft.scores || {});
            setNotes(draft.notes || {});
          }
        }

        // 4. Load Authoritative Performance Timer
        const { data: t } = await supabase
          .from('timers')
          .select('*')
          .eq('performance_id', performanceId)
          .maybeSingle();

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
      } catch (err) {
        console.error('Error initializing scoring console:', err);
      }
    }

    loadData();

    // Supabase Realtime channel for live timer & performance status updates
    const channel = supabase
      .channel(`judge_perf_${performanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timers', filter: `performance_id=eq.${performanceId}` },
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'performances', filter: `id=eq.${performanceId}` },
        (payload) => {
          if (payload.new) {
            setPerformance((prev) => prev ? { ...prev, status: (payload.new as any).status } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryId, performanceId, user]);

  // Handle score change with local draft autosave
  const handleScoreChange = (criterionId: string, val: string, maxMarks: number) => {
    if (isLocked) return;
    const num = parseFloat(val);
    const validNum = isNaN(num) ? 0 : Math.min(Math.max(0, num), maxMarks);

    const updated = { ...scores, [criterionId]: validNum };
    setScores(updated);

    if (criteriaVersion) {
      offlineDraftStore.saveDraft(
        performanceId,
        criteriaVersion.id,
        updated,
        notes,
        submission?.idempotencyKey || crypto.randomUUID()
      );
    }
  };

  // Mask field on blur to prevent shoulder-surfing
  const handleBlur = (criterionId: string) => {
    if (scores[criterionId] !== undefined) {
      setMaskedFields((prev) => ({ ...prev, [criterionId]: true }));
    }
  };

  const handleUnmask = (criterionId: string) => {
    if (isLocked) return;
    setMaskedFields((prev) => ({ ...prev, [criterionId]: false }));
  };

  // Submit and lock score
  const handleSubmitScore = async () => {
    if (!criteriaVersion || isLocked) return;

    // Validate that all criteria have entered marks
    const missing = criteriaVersion.criteria.find((c) => scores[c.id] === undefined);
    if (missing) {
      setFeedback({ type: 'error', message: `Please enter a score for "${missing.name}"` });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);

      const entries = criteriaVersion.criteria.map((c) => ({
        criterionId: c.id,
        rawScore: scores[c.id] || 0,
        notes: notes[c.id] || null,
      }));

      const res = await submitScore({
        performanceId,
        criteriaVersionId: criteriaVersion.id,
        idempotencyKey: crypto.randomUUID(),
        entries,
        deviceFingerprint: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

      if (res.success) {
        setIsLocked(true);
        // Mask all fields
        const allMasked: Record<string, boolean> = {};
        criteriaVersion.criteria.forEach((c) => (allMasked[c.id] = true));
        setMaskedFields(allMasked);
        offlineDraftStore.clearDraft(performanceId);
        setFeedback({ type: 'success', message: 'Score successfully recorded and locked!' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Submission failed' });
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Submission failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const performerName = performance?.participant
    ? `${performance.participant.firstName} ${performance.participant.lastName}`
    : performance?.team?.name || 'Performer';

  const isPerformanceActive = performance?.status === 'performing' || timerState?.status === 'running' || timerState?.status === 'paused';
  const isPerformanceCompleted = performance?.status === 'completed';
  const canJudgeScore = (isPerformanceActive || isPerformanceCompleted) && !isLocked;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {/* Navigation & Connectivity Header */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <Link
            href="/judge"
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
          >
            ← Back to Lineup
          </Link>

          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <Wifi className="w-3 h-3" />
                <span>Live Synced</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <WifiOff className="w-3 h-3" />
                <span>Offline Draft Saved</span>
              </span>
            )}
          </div>
        </div>

        {/* Performer Card */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 mb-4 shadow-xl relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Order #{performance?.performanceOrder || 1}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {performance?.participant?.participantCode || performance?.performanceCode}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{performerName}</h1>
              {performance?.participant?.institution && (
                <p className="text-xs text-slate-400 mt-0.5">{performance.participant.institution}</p>
              )}
            </div>

            {isLocked ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                <span>Locked</span>
              </div>
            ) : isPerformanceActive ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Scoring Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Hourglass className="w-4 h-4" />
                <span>Waiting to Start</span>
              </div>
            )}
          </div>
        </div>

        {/* Authoritative Live Clock Banner for Judge */}
        <div className={`border rounded-2xl p-4 mb-4 shadow-xl flex items-center justify-between transition-colors ${
          timerDisplay.isOvertime
            ? 'bg-rose-950/40 border-rose-500/60'
            : timerDisplay.isWarning
            ? 'bg-amber-950/30 border-amber-500/50'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
              <Clock className={`w-5 h-5 ${timerDisplay.isOvertime ? 'text-rose-400 animate-pulse' : timerDisplay.isWarning ? 'text-amber-400 animate-pulse' : 'text-indigo-400'}`} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                <span>Official Clock</span>
                {timerState?.status === 'running' && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">RUNNING</span>
                )}
                {timerState?.status === 'paused' && (
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">PAUSED</span>
                )}
                {timerDisplay.isOvertime && (
                  <span className="text-[10px] text-rose-400 font-bold bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">OVERTIME</span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {timerState?.status === 'running'
                  ? 'Performance in progress'
                  : timerState?.status === 'paused'
                  ? 'Performance is paused'
                  : isPerformanceCompleted
                  ? 'Performance concluded'
                  : 'Waiting for Scrutineer to start clock'}
              </p>
            </div>
          </div>

          <div className={`font-mono text-3xl sm:text-4xl font-black ${
            timerDisplay.isOvertime ? 'text-rose-400 animate-pulse' : timerDisplay.isWarning ? 'text-amber-400 animate-pulse' : 'text-white'
          }`}>
            {timerDisplay.formattedDisplay}
          </div>
        </div>

        {/* Waiting For Scrutineer Warning */}
        {!isPerformanceActive && !isPerformanceCompleted && !isLocked && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 flex items-center gap-3 text-amber-300 text-xs">
            <Hourglass className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong className="font-semibold block text-amber-200">Waiting for Scrutineer to Start Performance</strong>
              <span>Scoring controls will automatically unlock when the Scrutineer starts the clock from the Control Room.</span>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl text-xs font-medium mb-6 flex items-center gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Criteria Scoring Form */}
        <div className="space-y-4 mb-8">
          {criteriaVersion?.criteria.map((crit, index) => {
            const isMasked = maskedFields[crit.id] && isLocked;
            const currentScore = scores[crit.id];

            return (
              <div
                key={crit.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-base text-slate-100">{crit.name}</h3>
                  </div>
                  {crit.description && (
                    <p className="text-xs text-slate-400 mt-1 pl-7">{crit.description}</p>
                  )}
                  <div className="pl-7 mt-2 flex items-center gap-3 text-xs text-slate-500">
                    <span>Max Marks: <strong className="text-slate-300">{crit.maxMarks}</strong></span>
                    <span>•</span>
                    <span>Weight: <strong className="text-slate-300">{crit.weight}x</strong></span>
                  </div>
                </div>

                {/* Score Input Controls */}
                <div className="flex items-center gap-3 sm:self-center">
                  {isMasked ? (
                    <div className="w-24 h-14 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-amber-400 font-mono text-2xl font-bold tracking-widest select-none">
                      ***
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max={crit.maxMarks}
                      disabled={!canJudgeScore}
                      value={currentScore !== undefined ? currentScore : ''}
                      onChange={(e) => handleScoreChange(crit.id, e.target.value, crit.maxMarks)}
                      onBlur={() => handleBlur(crit.id)}
                      placeholder="0.0"
                      className="w-24 h-14 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl text-center text-white font-mono text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  )}

                  {/* Preset quick buttons on desktop / tablet */}
                  {canJudgeScore && (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => handleScoreChange(crit.id, String(crit.maxMarks), crit.maxMarks)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded cursor-pointer"
                      >
                        MAX
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScoreChange(crit.id, String(crit.maxMarks * 0.8), crit.maxMarks)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded cursor-pointer"
                      >
                        80%
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sticky Submission Footer */}
        <div className="sticky bottom-4 z-40 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Marks are encrypted and permanently locked upon submission.</span>
          </div>

          <button
            onClick={handleSubmitScore}
            disabled={isLocked || isSubmitting}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isLocked ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Scores Locked</span>
              </>
            ) : isSubmitting ? (
              <span>Locking Score...</span>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit & Lock Official Score</span>
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
