'use client';

// src/components/judge/JudgePanel.tsx - Creator-Configured Dynamic Criteria Scoring Portal
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { submitJudgeScore } from '@/actions/scoring';
import { getEventCriteria, CustomCriterion } from '@/actions/criteria';
import { 
  ShieldCheck, 
  Lock, 
  Radio, 
  Clock, 
  Send, 
  CheckCircle2, 
  Sparkles,
  Sliders,
  ListOrdered,
  Music,
  Award
} from 'lucide-react';

interface JudgePanelProps {
  eventId?: string;
}

export function JudgePanel({ eventId }: JudgePanelProps) {
  const [activeEventId, setActiveEventId] = useState<string | null>(eventId || null);
  const [eventState, setEventState] = useState<any>(null);
  const [activePerformer, setActivePerformer] = useState<any>(null);
  const [upcomingPerformers, setUpcomingPerformers] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hashReceipt, setHashReceipt] = useState<string | null>(null);
  const [submittedTime, setSubmittedTime] = useState<string | null>(null);

  // Dynamic Criteria Configured by Event Creator
  const [criteriaList, setCriteriaList] = useState<CustomCriterion[]>([]);
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});
  const [totalConfiguredMax, setTotalConfiguredMax] = useState<number>(100);

  // Instrumentalist Scores (Evaluated & Totaled exclusively during/after Group Choir act)
  const [keyboardistScore, setKeyboardistScore] = useState<number>(0);
  const [rhythmistScore, setRhythmistScore] = useState<number>(0);
  const [guitaristScore, setGuitaristScore] = useState<number>(0);

  // 1. Initial State, Queue & Creator-Defined Criteria Load
  useEffect(() => {
    async function load() {
      let targetId = activeEventId;
      if (!targetId) {
        const { data: comp } = await supabase
          .from('competitions')
          .select('id')
          .neq('environment', 'practice')
          .not('name', 'ilike', '%demo%')
          .not('name', 'ilike', '%practice%')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (comp) {
          targetId = comp.id;
          setActiveEventId(comp.id);
        }
      }

      if (!targetId) return;

      // Fetch dynamic criteria configured by creator
      try {
        const config = await getEventCriteria(targetId);
        if (config?.criteria) {
          setCriteriaList(config.criteria);
          setTotalConfiguredMax(config.totalMaxMarks || 100);
          const initialScores: Record<string, number> = {};
          config.criteria.forEach((c, idx) => {
            initialScores[c.id || `crit-${idx}`] = 0;
          });
          setCriteriaScores(initialScores);
        }
      } catch (e) {
        console.error('Failed to load event criteria:', e);
      }

      const [{ data: st }, { data: pList }] = await Promise.all([
        supabase.from('event_state').select('*').eq('event_id', targetId).maybeSingle(),
        supabase.from('participants').select('*').eq('competition_id', targetId).order('performance_order', { ascending: true }),
      ]);

      if (st) {
        setEventState(st);
        setTimeLeft(st.timer_duration_seconds || 300);
        if (st.active_participant_id && pList) {
          const current = pList.find((p) => p.id === st.active_participant_id) || null;
          setActivePerformer(current);
          if (current) {
            const nextActs = pList.filter((p) => (p.performance_order || 0) > (current.performance_order || 0));
            setUpcomingPerformers(nextActs.slice(0, 3));
          }
        } else if (pList && pList.length > 0) {
          setUpcomingPerformers(pList.slice(0, 3));
        }
      } else if (pList && pList.length > 0) {
        setUpcomingPerformers(pList.slice(0, 3));
      }
    }
    load();
  }, [activeEventId]);

  // 2. Realtime State Sync
  useEffect(() => {
    if (!activeEventId) return;

    const channel = supabase
      .channel(`judge_state_${activeEventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state', filter: `event_id=eq.${activeEventId}` }, async (payload) => {
        const updated = payload.new as any;
        setEventState(updated);

        const { data: pList } = await supabase
          .from('participants')
          .select('*')
          .eq('competition_id', activeEventId)
          .order('performance_order', { ascending: true });

        if (updated.active_participant_id !== activePerformer?.id) {
          // Reset score fields for next performer
          setHashReceipt(null);
          setCriteriaScores((prev) => {
            const reset: Record<string, number> = {};
            Object.keys(prev).forEach((k) => (reset[k] = 0));
            return reset;
          });
          setKeyboardistScore(0);
          setRhythmistScore(0);
          setGuitaristScore(0);

          if (updated.active_participant_id && pList) {
            const current = pList.find((p) => p.id === updated.active_participant_id) || null;
            setActivePerformer(current);
            if (current) {
              const nextActs = pList.filter((p) => (p.performance_order || 0) > (current.performance_order || 0));
              setUpcomingPerformers(nextActs.slice(0, 3));
            }
          } else {
            setActivePerformer(null);
            if (pList) setUpcomingPerformers(pList.slice(0, 3));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `competition_id=eq.${activeEventId}` }, async () => {
        const { data: pList } = await supabase
          .from('participants')
          .select('*')
          .eq('competition_id', activeEventId)
          .order('performance_order', { ascending: true });

        if (pList && activePerformer) {
          const current = pList.find((p) => p.id === activePerformer.id) || activePerformer;
          setActivePerformer(current);
          const nextActs = pList.filter((p) => (p.performance_order || 0) > (current.performance_order || 0));
          setUpcomingPerformers(nextActs.slice(0, 3));
        } else if (pList) {
          setUpcomingPerformers(pList.slice(0, 3));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEventId, activePerformer?.id]);

  // 3. Live Countdown Timer Ticker
  useEffect(() => {
    if (eventState?.stage_mode !== 'live' || eventState?.timer_status !== 'running') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [eventState?.stage_mode, eventState?.timer_status]);

  const isGroupAct = activePerformer?.performance_type === 'group';

  // Dynamic Vocal Criteria Subtotal
  const vocalSubtotal = Object.values(criteriaScores).reduce((sum, score) => sum + (Number(score) || 0), 0);

  // Instrumentalists Subtotal (Only for Group acts)
  const instrumentsSubtotal = isGroupAct 
    ? keyboardistScore + rhythmistScore + guitaristScore 
    : 0;

  // Strict SUM Total
  const totalScore = vocalSubtotal + instrumentsSubtotal;

  const isUnlocked = eventState?.stage_mode === 'live' && eventState?.is_judge_input_unlocked;

  // Handle Score Submission
  const handleSubmit = async () => {
    if (!activePerformer || !activeEventId || vocalSubtotal <= 0 || isSubmitting) return;
    setIsSubmitting(true);

    const perfType = activePerformer.performance_type || 'solo';

    const res = await submitJudgeScore({
      eventId: activeEventId,
      participantId: activePerformer.id,
      category: perfType,
      soloScore: perfType === 'solo' ? vocalSubtotal : 0,
      duetScore: perfType === 'duet' ? vocalSubtotal : 0,
      groupScore: perfType === 'group' ? vocalSubtotal : 0,
      keyboardistScore: isGroupAct ? keyboardistScore : 0,
      rhythmistScore: isGroupAct ? rhythmistScore : 0,
      guitaristScore: isGroupAct ? guitaristScore : 0,
      deviceFingerprint: typeof window !== 'undefined' ? navigator.userAgent : 'mobile_client',
    });

    if (res.success && res.hashReceipt) {
      setHashReceipt(res.hashReceipt);
      setSubmittedTime(res.submittedAt || new Date().toISOString());
    } else {
      alert(`Submission Error: ${res.error}`);
    }
    setIsSubmitting(false);
  };

  const updateCriterionScore = (key: string, val: number) => {
    setCriteriaScores((prev) => ({ ...prev, [key]: val }));
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-950 text-slate-100 min-h-screen p-4 sm:p-6 pb-32 flex flex-col justify-between space-y-6">
      {/* Top Header Bar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span className="font-black text-lg tracking-tight">JUDGE SCORING PORTAL</span>
          </div>
          <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase flex items-center gap-1.5 ${
            isUnlocked ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            <Radio className="w-3.5 h-3.5" />
            {isUnlocked ? 'LIVE STAGE' : 'STANDBY (LOCKED)'}
          </span>
        </div>

        {/* Live Timer Sync Banner */}
        {isUnlocked && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>PERFORMANCE TIMER</span>
            </div>
            <span className={`font-mono text-xl font-black ${
              timeLeft < 60 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
            }`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        )}

        {/* Active Performer Details Header */}
        {activePerformer ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-cyan-500/20 border-b border-l border-cyan-500/30 text-[10px] uppercase font-black text-cyan-300 rounded-bl-xl">
              Now On Stage • #{activePerformer.performance_order || 1}
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-cyan-400">
              Category: {(activePerformer.performance_type || 'Solo').toUpperCase()}
            </span>
            <h2 className="text-xl font-black text-white truncate">
              {activePerformer.participant_name || activePerformer.team_name || `${activePerformer.first_name || ''} ${activePerformer.last_name || ''}`.trim()}
            </h2>
            <p className="text-xs text-slate-400 truncate">🏛️ {activePerformer.church_name || activePerformer.institution || 'Independent'}</p>

            {/* Special Instrumentalists on Group Act */}
            {isGroupAct && (activePerformer.best_keyboardist || activePerformer.best_rhythmist || activePerformer.best_guitarist) && (
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 text-[11px]">
                {activePerformer.best_keyboardist && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    🎹 {activePerformer.best_keyboardist}
                  </span>
                )}
                {activePerformer.best_rhythmist && (
                  <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                    🥁 {activePerformer.best_rhythmist}
                  </span>
                )}
                {activePerformer.best_guitarist && (
                  <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    🎸 {activePerformer.best_guitarist}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 text-sm">
            Waiting for Stage Manager to stage the next performer...
          </div>
        )}

        {/* UP NEXT / ON DECK QUEUE VISIBILITY FOR JUDGES */}
        {upcomingPerformers.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <ListOrdered className="w-3.5 h-3.5" /> UP NEXT ON DECK
              </span>
              <span className="text-[10px] text-slate-500">Upcoming Queue</span>
            </div>
            <div className="space-y-1.5">
              {upcomingPerformers.map((up, idx) => (
                <div 
                  key={up.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-[11px] font-black text-slate-500 shrink-0">
                      #{up.performance_order || idx + 2}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">
                        {up.participant_name || up.team_name || `${up.first_name || ''} ${up.last_name || ''}`.trim()}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {up.church_name || up.institution || 'Independent'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 bg-slate-800 text-slate-300">
                    {up.performance_type || 'Solo'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Post-Submission Receipt Banner */}
        {hashReceipt && (
          <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-2xl p-4 shadow-xl space-y-2 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              Score Locked & Cryptographically Signed
            </div>
            <div className="text-[11px] font-mono text-emerald-300/80 break-all bg-emerald-950 p-2.5 rounded-lg border border-emerald-800/50">
              SHA-256: {hashReceipt}
            </div>
            <div className="text-[10px] text-slate-400 text-right">
              Locked at {new Date(submittedTime || '').toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* Dynamic Criteria Fields Defined by Event Creator */}
        <div className={`space-y-4 transition-all duration-300 ${!isUnlocked || hashReceipt ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs uppercase font-black tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>{(activePerformer?.performance_type || 'Vocal').toUpperCase()} CRITERIA (SET BY CREATOR)</span>
            </span>
            <span className="text-xs font-mono font-bold text-cyan-400">
              Subtotal: {vocalSubtotal.toFixed(1)} / {totalConfiguredMax}
            </span>
          </div>

          {/* Render Each Creator-Configured Criterion Dynamically */}
          {criteriaList.map((crit, idx) => {
            const key = crit.id || `crit-${idx}`;
            const currentScore = criteriaScores[key] || 0;
            return (
              <DynamicCriteriaTouchField
                key={key}
                name={crit.name}
                description={crit.description}
                maxMarks={crit.maxMarks}
                value={currentScore}
                onChange={(val) => updateCriterionScore(key, val)}
              />
            );
          })}

          {/* Special Accompanying Instrumentalists (Totaled ONLY during/after Group performance) */}
          {isGroupAct && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs uppercase font-black tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-amber-400" />
                  <span>GROUP ACCOMPANYING INSTRUMENTALISTS</span>
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  Inst. Subtotal: {instrumentsSubtotal.toFixed(1)}
                </span>
              </div>

              {activePerformer?.best_keyboardist && (
                <DynamicCriteriaTouchField
                  name={`🎹 Keyboardist (${activePerformer.best_keyboardist})`}
                  description="Technique, harmonization, chords & accompaniment skill"
                  maxMarks={100}
                  value={keyboardistScore}
                  onChange={setKeyboardistScore}
                />
              )}

              {activePerformer?.best_rhythmist && (
                <DynamicCriteriaTouchField
                  name={`🥁 Rhythmist (${activePerformer.best_rhythmist})`}
                  description="Octopad, drums, dholak, tabla rhythm, tempo hold & groove"
                  maxMarks={100}
                  value={rhythmistScore}
                  onChange={setRhythmistScore}
                />
              )}

              {activePerformer?.best_guitarist && (
                <DynamicCriteriaTouchField
                  name={`🎸 Guitarist (${activePerformer.best_guitarist})`}
                  description="Lead, electric, bass guitar strumming, fills & dynamics"
                  maxMarks={100}
                  value={guitaristScore}
                  onChange={setGuitaristScore}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Score Preview & Lock Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-xl p-4 z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">
              {isGroupAct ? 'Group & Inst. Total' : 'Act Sum Total'}
            </span>
            <span className="text-3xl font-black font-mono text-cyan-400">{totalScore.toFixed(1)}</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isUnlocked || vocalSubtotal <= 0 || isSubmitting || !!hashReceipt}
            className="flex-1 py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wide bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-xl shadow-emerald-950 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            {hashReceipt ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Score Locked</span>
              </>
            ) : isSubmitting ? (
              <span>Signing Hash...</span>
            ) : !isUnlocked ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Standby Locked</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Lock & Sign Score</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reusable Dynamic Criteria Touch Stepper Field
function DynamicCriteriaTouchField({
  name,
  description,
  maxMarks,
  value,
  onChange,
}: {
  name: string;
  description?: string;
  maxMarks: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const step = (delta: number) => {
    const updated = Math.max(0, Math.min(maxMarks, Math.round((value + delta) * 10) / 10));
    onChange(updated);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-black text-slate-200 tracking-wide block">{name}</span>
          {description && <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{description}</p>}
        </div>
        <div className="text-right shrink-0">
          <span className="font-mono text-2xl font-black text-emerald-400">{value.toFixed(1)}</span>
          <span className="text-[10px] text-slate-500 block">/ {maxMarks}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 pt-1">
        <button
          type="button"
          onClick={() => step(-5)}
          className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
        >
          -5
        </button>
        <button
          type="button"
          onClick={() => step(-1)}
          className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
        >
          -1
        </button>
        <button
          type="button"
          onClick={() => step(+1)}
          className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
        >
          +1
        </button>
        <button
          type="button"
          onClick={() => step(+5)}
          className="py-2.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/40 active:bg-cyan-600/50 border border-cyan-500/40 text-xs font-black text-cyan-300 transition-colors cursor-pointer"
        >
          +5
        </button>
      </div>
    </div>
  );
}
