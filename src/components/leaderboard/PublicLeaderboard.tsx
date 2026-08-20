'use client';

// src/components/leaderboard/PublicLeaderboard.tsx - Public Broadcast & Grand Official Results Ceremony Suite
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { calculateEventPrizes, exportEventResultsCSV, EventPrizeStandings } from '@/actions/prizes';
import { 
  Trophy, 
  Medal, 
  AlertTriangle, 
  Radio, 
  Music, 
  Sparkles, 
  Printer, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2,
  Users,
  ShieldCheck
} from 'lucide-react';

interface PublicLeaderboardProps {
  eventId?: string;
}

export function PublicLeaderboard({ eventId }: PublicLeaderboardProps) {
  const [activeEventId, setActiveEventId] = useState<string | null>(eventId || null);
  const [standings, setStandings] = useState<EventPrizeStandings | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('overall');
  const [eventState, setEventState] = useState<any>(null);
  const [activePerformer, setActivePerformer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. Resolve Competition ID if not provided
  useEffect(() => {
    async function resolveEvent() {
      if (!activeEventId) {
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
          setActiveEventId(comp.id);
        } else {
          setLoading(false);
        }
      }
    }
    resolveEvent();
  }, [activeEventId]);

  // 2. Fetch Standings & Live Stage
  const refreshScores = useCallback(async () => {
    if (!activeEventId) return;
    try {
      const data = await calculateEventPrizes(activeEventId);
      setStandings(data);
    } catch (err) {
      console.error('Failed to load prize standings:', err);
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
        refreshScores();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competitions', filter: `id=eq.${activeEventId}` }, () => {
        refreshScores();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEventId, refreshScores, loadStageState]);

  // CSV Export Trigger
  const handleExportCSV = async () => {
    if (!activeEventId) return;
    const csvContent = await exportEventResultsCSV(activeEventId);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Official_Results_${standings?.eventName || 'Championship'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const isPublished = standings?.isPublished;
  const isLive = eventState?.stage_mode === 'live' && !isPublished;

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 space-y-8 print:bg-white print:text-black print:p-0">
      {/* Print Stylesheet injection */}
      <style jsx global>{`
        @media print {
          nav, header, button, .no-print {
            display: none !important;
          }
          body, main, div {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .print-border {
            border: 1px solid #ddd !important;
          }
        }
      `}</style>

      {/* PUBLISHED OFFICIAL RESULTS CEREMONY HEADER */}
      {isPublished ? (
        <div className="w-full max-w-6xl mx-auto rounded-3xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border-2 border-amber-500/50 p-6 sm:p-8 shadow-2xl space-y-4 text-center relative overflow-hidden print:border-none print:p-2">
          <div className="flex flex-wrap items-center justify-between gap-4 no-print border-b border-amber-500/20 pb-4">
            <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-widest">
              <CheckCircle2 className="w-4 h-4" />
              OFFICIAL VERIFIED RESULTS PUBLISHED
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintPDF}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow cursor-pointer transition-transform active:scale-95"
              >
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export CSV / Sheets
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest font-black text-amber-400 print:text-black">
              Official Grand Championship Bulletin
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight print:text-black">
              {standings?.eventName || 'Championship Results'}
            </h1>
            <p className="text-xs text-slate-400 print:text-gray-600">
              Audited and Signed Final Standings • Solo, Duet, Group Choir & Overall Church Championship
            </p>
          </div>
        </div>
      ) : (
        /* LIVE STAGE BANNER (Only shown before event is published) */
        <div className={`w-full max-w-6xl mx-auto rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all ${
          isLive 
            ? 'bg-gradient-to-r from-red-950/60 via-slate-900 to-slate-950 border-red-500/50 ring-2 ring-red-500/30' 
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
                {activePerformer?.team_name || activePerformer?.participant_name || `${activePerformer?.first_name || ''} ${activePerformer?.last_name || ''}`.trim() || 'Live Scoreboard'}
              </div>
              <div className="text-sm text-cyan-400 font-medium">
                {activePerformer ? `🏛️ ${activePerformer.church_name || activePerformer.institution || 'Independent'}` : 'Competition Broadcast'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Navigation Bar */}
      <div className="w-full max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto pb-2 no-print scrollbar-none">
        {[
          { id: 'overall', label: '🏆 Overall Church Championship' },
          { id: 'solo', label: '🎤 Solo Vocals' },
          { id: 'duet', label: '👥 Duet Vocals (Both Performers)' },
          { id: 'group', label: '🎵 Group / Choir' },
          { id: 'instruments', label: '🎹 Special Instrumentalists' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === tab.id
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-950/50 scale-105'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MAIN LEADERBOARD CONTENT */}
      <div className="w-full max-w-6xl mx-auto space-y-6">
        {/* 1. OVERALL CHURCH CHAMPIONSHIP (SOLO + DUET + GROUP) */}
        {(selectedCategory === 'overall' || isPublished) && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4 print:border-none print:p-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                <h2 className="text-lg font-black text-white uppercase tracking-wider print:text-black">
                  Grand Rolling Church Championship
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-bold">
                Calculated across Solo + Duet + Group Performances
              </span>
            </div>

            <div className="space-y-3">
              {standings?.churchOverallStandings.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">No church scores registered yet.</div>
              ) : (
                standings?.churchOverallStandings.map((c) => (
                  <div
                    key={c.churchName}
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      c.rank === 1
                        ? 'bg-amber-950/40 border-amber-500/60 ring-2 ring-amber-500/20'
                        : c.rank === 2
                        ? 'bg-slate-900/90 border-slate-500/40'
                        : c.rank === 3
                        ? 'bg-amber-950/20 border-amber-700/40'
                        : 'bg-slate-950 border-slate-800/80'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black font-mono ${
                          c.rank === 1 ? 'bg-amber-400 text-slate-950' : c.rank === 2 ? 'bg-slate-300 text-slate-950' : c.rank === 3 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          #{c.rank}
                        </span>
                        <h3 className="text-base font-bold text-white print:text-black">{c.churchName}</h3>
                        {c.prizeTitle && (
                          <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {c.prizeTitle}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap gap-3 pt-0.5">
                        <span>Solo: <strong className="text-slate-200">{c.soloScore.toFixed(1)}</strong></span>
                        <span>•</span>
                        <span>Duet: <strong className="text-slate-200">{c.duetScore.toFixed(1)}</strong></span>
                        <span>•</span>
                        <span>Group & Inst: <strong className="text-slate-200">{(c.groupScore + c.instrumentsScore).toFixed(1)}</strong></span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-500 uppercase font-black block">Grand Total</span>
                      <span className="font-mono text-2xl font-black text-cyan-400 print:text-black">
                        {c.grandTotal.toFixed(1)} <span className="text-xs font-normal text-slate-400">pts</span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 2. SOLO CATEGORY */}
        {(selectedCategory === 'solo' || isPublished) && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4 print:border-none print:p-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Medal className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-black text-white uppercase tracking-wider print:text-black">
                  Solo Vocal Category Standings
                </h2>
              </div>
            </div>

            <div className="space-y-2">
              {standings?.soloStandings.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">No solo scores registered.</div>
              ) : (
                standings?.soloStandings.map((s) => (
                  <div key={s.participantId} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-400">#{s.rank}</span>
                        <span className="font-bold text-white text-sm print:text-black">{s.name}</span>
                        {s.rank <= 3 && <span className="text-[10px] text-amber-400 font-bold">{s.prizeTitle}</span>}
                      </div>
                      <span className="text-[11px] text-slate-400">🏛️ {s.churchName}</span>
                    </div>
                    <span className="font-mono font-black text-cyan-400 text-sm print:text-black">{s.totalScore.toFixed(1)} pts</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. DUET CATEGORY (SHOWS BOTH SINGER NAMES) */}
        {(selectedCategory === 'duet' || isPublished) && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4 print:border-none print:p-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <h2 className="text-base font-black text-white uppercase tracking-wider print:text-black">
                  Duet Category Standings (Both Singers Displayed)
                </h2>
              </div>
            </div>

            <div className="space-y-2">
              {standings?.duetStandings.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">No duet scores registered.</div>
              ) : (
                standings?.duetStandings.map((d) => (
                  <div key={d.participantId} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-400">#{d.rank}</span>
                        <span className="font-bold text-white text-sm print:text-black">{d.name}</span>
                        {d.rank <= 3 && <span className="text-[10px] text-purple-400 font-bold">{d.prizeTitle}</span>}
                      </div>
                      <span className="text-[11px] text-slate-400">🏛️ {d.churchName}</span>
                    </div>
                    <span className="font-mono font-black text-cyan-400 text-sm print:text-black">{d.totalScore.toFixed(1)} pts</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. GROUP / CHOIR CATEGORY */}
        {(selectedCategory === 'group' || isPublished) && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4 print:border-none print:p-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-black text-white uppercase tracking-wider print:text-black">
                  Group / Choir Category Standings
                </h2>
              </div>
            </div>

            <div className="space-y-2">
              {standings?.groupStandings.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">No group scores registered.</div>
              ) : (
                standings?.groupStandings.map((g) => (
                  <div key={g.participantId} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-400">#{g.rank}</span>
                        <span className="font-bold text-white text-sm print:text-black">{g.name}</span>
                        {g.rank <= 3 && <span className="text-[10px] text-emerald-400 font-bold">{g.prizeTitle}</span>}
                      </div>
                      <span className="text-[11px] text-slate-400">🏛️ {g.churchName}</span>
                    </div>
                    <span className="font-mono font-black text-cyan-400 text-sm print:text-black">{g.totalScore.toFixed(1)} pts</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 5. SPECIAL INSTRUMENTALIST AWARDS */}
        {(selectedCategory === 'instruments' || isPublished) && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4 print:border-none print:p-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-black text-white uppercase tracking-wider print:text-black">
                  Instrumentalists of the Year (Evaluated in Group Act)
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Best Keyboardist */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-amber-300">🎹 Best Keyboardist</span>
                {standings?.keyboardistStandings.slice(0, 1).map((k) => (
                  <div key={k.participantId}>
                    <div className="font-bold text-white text-sm">{k.name}</div>
                    <div className="text-[11px] text-slate-400">{k.churchName} • {k.totalScore.toFixed(1)} pts</div>
                  </div>
                ))}
              </div>

              {/* Best Rhythmist */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-rose-300">🥁 Best Rhythmist / Drummer</span>
                {standings?.rhythmistStandings.slice(0, 1).map((r) => (
                  <div key={r.participantId}>
                    <div className="font-bold text-white text-sm">{r.name}</div>
                    <div className="text-[11px] text-slate-400">{r.churchName} • {r.totalScore.toFixed(1)} pts</div>
                  </div>
                ))}
              </div>

              {/* Best Guitarist */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-purple-300">🎸 Best Guitarist</span>
                {standings?.guitaristStandings.slice(0, 1).map((g) => (
                  <div key={g.participantId}>
                    <div className="font-bold text-white text-sm">{g.name}</div>
                    <div className="text-[11px] text-slate-400">{g.churchName} • {g.totalScore.toFixed(1)} pts</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
