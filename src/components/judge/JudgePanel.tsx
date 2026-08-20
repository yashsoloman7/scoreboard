'use client';

// src/components/judge/JudgePanel.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { submitJudgeScore } from '@/actions/scoring';
import { 
  ShieldCheck, 
  Lock, 
  Radio, 
  Clock, 
  Send, 
  CheckCircle2, 
  Plus, 
  Minus,
  Sparkles
} from 'lucide-react';

interface JudgePanelProps {
  eventId?: string;
}

export function JudgePanel({ eventId }: JudgePanelProps) {
  const [activeEventId, setActiveEventId] = useState<string | null>(eventId || null);
  const [eventState, setEventState] = useState<any>(null);
  const [activePerformer, setActivePerformer] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hashReceipt, setHashReceipt] = useState<string | null>(null);
  const [submittedTime, setSubmittedTime] = useState<string | null>(null);

  // Score states
  const [soloScore, setSoloScore] = useState<number>(0);
  const [duetScore, setDuetScore] = useState<number>(0);
  const [groupScore, setGroupScore] = useState<number>(0);
  const [keyboardistScore, setKeyboardistScore] = useState<number>(0);
  const [rhythmistScore, setRhythmistScore] = useState<number>(0);
  const [guitaristScore, setGuitaristScore] = useState<number>(0);

  // 1. Initial State Load
  useEffect(() => {
    async function load() {
      let targetId = activeEventId;
      if (!targetId) {
        // Resolve default active competition
        const { data: comp } = await supabase.from('competitions').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (comp) {
          targetId = comp.id;
          setActiveEventId(comp.id);
        }
      }

      if (!targetId) return;

      const { data: st } = await supabase.from('event_state').select('*').eq('event_id', targetId).maybeSingle();
      if (st) {
        setEventState(st);
        if (st.active_participant_id) {
          const { data: p } = await supabase.from('participants').select('*').eq('id', st.active_participant_id).maybeSingle();
          setActivePerformer(p);
        }
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
        // Reset inputs if active performer changed
        if (updated.active_participant_id !== activePerformer?.id) {
          setHashReceipt(null);
          setSoloScore(0);
          setDuetScore(0);
          setGroupScore(0);
          setKeyboardistScore(0);
          setRhythmistScore(0);
          setGuitaristScore(0);
          if (updated.active_participant_id) {
            const { data: p } = await supabase.from('participants').select('*').eq('id', updated.active_participant_id).maybeSingle();
            setActivePerformer(p);
          } else {
            setActivePerformer(null);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEventId, activePerformer?.id]);

  // Strict SUM-TOTAL Calculation
  const totalScore = 
    soloScore + 
    duetScore + 
    groupScore + 
    keyboardistScore + 
    rhythmistScore + 
    guitaristScore;

  const isUnlocked = eventState?.stage_mode === 'live' && eventState?.is_judge_input_unlocked;

  // Handle Score Submission
  const handleSubmit = async () => {
    if (!activePerformer || !activeEventId || totalScore <= 0 || isSubmitting) return;
    setIsSubmitting(true);

    const res = await submitJudgeScore({
      eventId: activeEventId,
      participantId: activePerformer.id,
      category: activePerformer.performance_type || 'solo',
      soloScore,
      duetScore,
      groupScore,
      keyboardistScore,
      rhythmistScore,
      guitaristScore,
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

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-950 text-slate-100 min-h-screen p-4 sm:p-6 pb-28 flex flex-col justify-between">
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

        {/* Performer Details Header */}
        {activePerformer ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
              Active Performance ({activePerformer.performance_type || 'Solo'})
            </span>
            <h2 className="text-xl font-black text-white truncate">
              {activePerformer.team_name || activePerformer.participant_name || `${activePerformer.first_name || ''} ${activePerformer.last_name || ''}`.trim()}
            </h2>
            <p className="text-xs text-slate-400 truncate">🏛️ {activePerformer.church_name || activePerformer.institution || 'Independent'}</p>
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 text-sm">
            Waiting for Stage Manager to stage the next performer...
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

        {/* Scoring Input Widgets (Touch Steppers) */}
        <div className={`space-y-4 transition-all duration-300 ${!isUnlocked || hashReceipt ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          {/* Main Category Score Input */}
          <TouchScoreField 
            label={`${(activePerformer?.performance_type || 'Solo').toUpperCase()} SCORE`} 
            value={
              activePerformer?.performance_type === 'duet' ? duetScore :
              activePerformer?.performance_type === 'group' ? groupScore : soloScore
            } 
            onChange={(val) => {
              if (activePerformer?.performance_type === 'duet') setDuetScore(val);
              else if (activePerformer?.performance_type === 'group') setGroupScore(val);
              else setSoloScore(val);
            }} 
            max={100} 
          />

          {/* Instrumental Special Criteria */}
          <div className="border-t border-slate-800/80 pt-3 space-y-3">
            <div className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Special Instrumental Awards (Optional Criteria)
            </div>

            <TouchScoreField label="🎹 Best Keyboardist" value={keyboardistScore} onChange={setKeyboardistScore} max={25} />
            <TouchScoreField label="🥁 Best Rhythmist" value={rhythmistScore} onChange={setRhythmistScore} max={25} />
            <TouchScoreField label="🎸 Best Guitarist" value={guitaristScore} onChange={setGuitaristScore} max={25} />
          </div>
        </div>
      </div>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 flex items-center justify-between gap-4 z-50">
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400">Strict Sum Total</div>
          <div className="text-2xl font-black font-mono text-emerald-400">{totalScore.toFixed(2)} pts</div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isUnlocked || totalScore <= 0 || isSubmitting || !!hashReceipt}
          className="flex-1 py-3.5 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-950/60 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          {hashReceipt ? (
            <>
              <Lock className="w-4 h-4" />
              SCORE LOCKED
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              SUBMIT & LOCK
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function TouchScoreField({
  label,
  value,
  onChange,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  const step = (delta: number) => {
    onChange(Math.max(0, Math.min(max, value + delta)));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3">
      <div>
        <div className="text-xs font-bold text-slate-300">{label}</div>
        <div className="text-xl font-mono font-black text-white">{value}</div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => step(-5)}
          className="w-10 h-10 rounded-xl bg-slate-800 text-slate-200 font-bold active:bg-slate-700 flex items-center justify-center text-sm shadow"
        >
          -5
        </button>
        <button
          type="button"
          onClick={() => step(-1)}
          className="w-10 h-10 rounded-xl bg-slate-800 text-slate-200 font-bold active:bg-slate-700 flex items-center justify-center text-sm shadow"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          className="w-10 h-10 rounded-xl bg-slate-800 text-slate-200 font-bold active:bg-slate-700 flex items-center justify-center text-sm shadow"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => step(5)}
          className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-bold active:bg-cyan-900 flex items-center justify-center text-sm shadow"
        >
          +5
        </button>
      </div>
    </div>
  );
}
