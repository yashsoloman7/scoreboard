'use client';

// src/components/leaderboard/PublicLeaderboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getAggregatedLeaderboardAndTies } from '@/actions/scoring';
import { ParticipantAggregatedScore, TieBreakerAlert } from '@/types';
import { 
  Trophy, 
  Medal, 
  AlertTriangle, 
  Radio, 
  Clock, 
  Music, 
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

interface PublicLeaderboardProps {
  eventId?: string;
}

export function PublicLeaderboard({ eventId }: PublicLeaderboardProps) {
  const [activeEventId, setActiveEventId] = useState<string | null>(eventId || null);
  const [leaderboard, setLeaderboard] = useState<ParticipantAggregatedScore[]>([]);
  const [tieAlerts, setTieAlerts] = useState<TieBreakerAlert[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('grand_total');
  const [eventState, setEventState] = useState<any>(null);
  const [activePerformer, setActivePerformer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. Resolve Competition ID if not provided
  useEffect(() => {
    async function resolveEvent() {
      if (!activeEventId) {
        const { data: comp } = await supabase.from('competitions').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (comp) {
          setActiveEventId(comp.id);
        } else {
          setLoading(false);
        }
      }
    }
    resolveEvent();
  }, [activeEventId]);

  // 2. Fetch Aggregated Data
  const refreshScores = useCallback(async () => {
    if (!activeEventId) return;
    try {
      const { leaderboard: lb, tieAlerts: ties } = await getAggregatedLeaderboardAndTies(activeEventId);
      setLeaderboard(lb);
      setTieAlerts(ties);
    } catch (err) {
      console.error('Failed to load leaderboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeEventId]);

  const loadStageState = useCallback(async () => {
    if (!activeEventId) return;
    try {
      const { data: st } = await supabase.from('event_state').select('*').eq('event_id', activeEventId).maybeSingle();
      if (st) {
        setEventState(st);
        if (st.active_participant_id) {
          const { data: p } = await supabase.from('participants').select('*').eq('id', st.active_participant_id).maybeSingle();
          setActivePerformer(p);
        }
      }
    } catch (err) {
      console.error('Failed to load stage state:', err);
    }
  }, [activeEventId]);

  useEffect(() => {
    if (activeEventId) {
      refreshScores();
      loadStageState();
    }
  }, [activeEventId, refreshScores, loadStageState]);

  // 3. Realtime Subscriptions
  useEffect(() => {
    if (!activeEventId) return;

    const channel = supabase
      .channel(`public_board_${activeEventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `event_id=eq.${activeEventId}` }, () => {
        refreshScores();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state', filter: `event_id=eq.${activeEventId}` }, () => {
        loadStageState();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEventId, refreshScores, loadStageState]);

  // Category Filtering & Value Mapping
  const getCategoryScore = (item: ParticipantAggregatedScore) => {
    switch (selectedCategory) {
      case 'solo': return item.soloSums;
      case 'duet': return item.duetSums;
      case 'group': return item.groupSums;
      case 'keyboard': return item.keyboardistSums;
      case 'rhythm': return item.rhythmistSums;
      case 'guitar': return item.guitaristSums;
      case 'grand_total':
      default:
        return item.grandTotal;
    }
  };

  const filteredLeaderboard = [...leaderboard].sort((a, b) => getCategoryScore(b) - getCategoryScore(a));
  const top3 = filteredLeaderboard.slice(0, 3);
  const isLive = eventState?.stage_mode === 'live';

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Live Stage Marquee Banner */}
      <div className={`w-full max-w-6xl mx-auto rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all ${
        isLive 
          ? 'bg-gradient-to-r from-red-950/60 via-slate-900 to-slate-950 border-red-500/50 ring-1 ring-red-500/30' 
          : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
              isLive ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
            }`}>
              <Radio className="w-3.5 h-3.5" />
              {isLive ? 'NOW PERFORMING LIVE' : 'STAGE ON STANDBY'}
            </span>
            <span className="text-xs text-slate-400 font-semibold uppercase">
              Category: {activePerformer?.performance_type || 'General'}
            </span>
          </div>

          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {activePerformer?.team_name || activePerformer?.participant_name || `${activePerformer?.first_name || ''} ${activePerformer?.last_name || ''}`.trim() || 'Next Act Getting Ready'}
            </div>
            <div className="text-sm text-cyan-400 font-medium">
              {activePerformer ? `🏛️ ${activePerformer.church_name || activePerformer.institution || 'Independent'}` : 'Scoreboard Live Broadcast'}
            </div>
          </div>
        </div>
      </div>

      {/* Tie-Breaker Realtime Alerts Bar */}
      {tieAlerts.length > 0 && (
        <div className="w-full max-w-6xl mx-auto space-y-2">
          {tieAlerts.map((alert, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-amber-950/70 border border-amber-500/60 text-amber-200 flex items-center justify-between gap-4 shadow-lg animate-pulse"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-sm font-bold tracking-wide">
                  ⚠️ {alert.alertMessage} — <span className="underline">Awaiting Admin Adjudication</span>
                </span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-amber-900/80 font-mono font-black text-amber-300">
                {alert.score.toFixed(2)} PTS
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Category Filter Navigation Pills */}
      <div className="w-full max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'grand_total', label: '🏆 Grand Total Sum' },
          { id: 'solo', label: '🎤 Solo Vocals' },
          { id: 'duet', label: '👥 Duet Vocals' },
          { id: 'group', label: '🎵 Group / Choir' },
          { id: 'keyboard', label: '🎹 Best Keyboardist' },
          { id: 'rhythm', label: '🥁 Best Rhythmist' },
          { id: 'guitar', label: '🎸 Best Guitarist' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
              selectedCategory === tab.id
                ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-950/50 scale-105'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Podium Showcase for Top 3 */}
      {top3.length >= 3 && selectedCategory === 'grand_total' && (
        <div className="w-full max-w-4xl mx-auto grid grid-cols-3 gap-3 sm:gap-6 pt-6 items-end">
          {/* Rank 2 - Silver */}
          <div className="bg-slate-900/90 border border-slate-700/60 rounded-3xl p-4 sm:p-6 text-center space-y-2 relative order-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full bg-slate-400/20 text-slate-300 flex items-center justify-center font-black text-lg border border-slate-400">
              🥈 2
            </div>
            <div className="font-extrabold text-sm sm:text-base text-white truncate">{top3[1].teamName}</div>
            <div className="text-xs text-slate-400 truncate">{top3[1].churchName}</div>
            <div className="text-lg sm:text-2xl font-black font-mono text-cyan-300">{top3[1].grandTotal.toFixed(2)}</div>
          </div>

          {/* Rank 1 - Gold */}
          <div className="bg-gradient-to-b from-amber-950/60 via-slate-900 to-slate-950 border border-amber-500/60 rounded-3xl p-6 sm:p-8 text-center space-y-2 relative order-2 -translate-y-4 shadow-2xl shadow-amber-950/40">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-black text-2xl border border-amber-400">
              👑 1
            </div>
            <div className="font-black text-base sm:text-xl text-white truncate">{top3[0].teamName}</div>
            <div className="text-xs text-amber-300 truncate">{top3[0].churchName}</div>
            <div className="text-2xl sm:text-4xl font-black font-mono text-amber-400">{top3[0].grandTotal.toFixed(2)}</div>
          </div>

          {/* Rank 3 - Bronze */}
          <div className="bg-slate-900/90 border border-amber-800/40 rounded-3xl p-4 sm:p-6 text-center space-y-2 relative order-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full bg-amber-700/20 text-amber-500 flex items-center justify-center font-black text-lg border border-amber-700">
              🥉 3
            </div>
            <div className="font-extrabold text-sm sm:text-base text-white truncate">{top3[2].teamName}</div>
            <div className="text-xs text-slate-400 truncate">{top3[2].churchName}</div>
            <div className="text-lg sm:text-2xl font-black font-mono text-amber-500">{top3[2].grandTotal.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="w-full max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-xs uppercase font-extrabold tracking-wider">
                <th className="py-4 px-6">Rank</th>
                <th className="py-4 px-6">Team & Church</th>
                <th className="py-4 px-6">Performance Type</th>
                <th className="py-4 px-6 text-right">Strict Sum Total</th>
                <th className="py-4 px-6 text-center">Tie Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
              {filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-medium">
                    {loading ? 'Aggregating live scores from cryptographically locked records...' : 'No scores submitted yet for this event.'}
                  </td>
                </tr>
              ) : (
                filteredLeaderboard.map((row, idx) => {
                  const score = getCategoryScore(row);
                  return (
                    <tr
                      key={row.participantId}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        row.isTie ? 'bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-4 px-6 font-mono font-black text-base text-slate-300">
                        #{idx + 1}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-white text-base">{row.teamName}</div>
                        <div className="text-xs text-slate-400">🏛️ {row.churchName} ({row.participantName})</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs uppercase font-semibold">
                          {row.performanceType}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-black text-xl text-emerald-400">
                        {score.toFixed(2)} <span className="text-xs text-slate-500">pts</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {row.isTie ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold animate-pulse">
                            ⚠️ TIE DETECTED
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Clear</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
