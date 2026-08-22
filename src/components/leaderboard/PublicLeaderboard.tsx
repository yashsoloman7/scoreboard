'use client';

// src/components/leaderboard/PublicLeaderboard.tsx - Antigravity Next-Gen Esports Broadcast Leaderboard
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchSheetLeaderboardAction } from '@/actions/sheets';
import { SheetParticipant } from '@/lib/sheets/googleSheetsService';
import { 
  Trophy, 
  Medal, 
  Sparkles, 
  Radio, 
  Music, 
  Users, 
  RefreshCw, 
  ShieldCheck, 
  Award,
  Crown,
  ChevronRight,
  Flame,
  Activity
} from 'lucide-react';

export function PublicLeaderboard() {
  const [participants, setParticipants] = useState<SheetParticipant[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Solo' | 'Duet' | 'Group'>('All');
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const data = await fetchSheetLeaderboardAction();
      setParticipants(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load Google Sheets leaderboard:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Realtime background sync polling every 4 seconds
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Filter items by active category
  const filtered = participants.filter((p) => {
    if (selectedCategory === 'All') return true;
    return p.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const activeLivePerformer = participants.find((p) => p.status === 'live');

  // Top 3 Podium
  const topThree = filtered.slice(0, 3);
  const remainingList = filtered.slice(3);

  return (
    <div className="w-full min-h-screen antigravity-bg py-8 px-4 sm:px-6 lg:px-8 space-y-8 selection:bg-cyan-500 selection:text-slate-950">
      {/* Live Broadcast Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Trophy className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  Live Google Sheets Sync
                </span>
                <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400 animate-pulse" /> {lastRefreshed ? `Updated ${lastRefreshed}` : 'Connecting...'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mt-0.5 flex items-center gap-2">
                <span>Antigravity Championship</span>
                <span className="text-xs font-mono font-normal text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hidden sm:inline-block">
                  Broadcast Suite
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Live Stage Status Card */}
        <div className="flex items-center gap-3">
          {activeLivePerformer ? (
            <div className="p-3 px-4 rounded-2xl bg-red-950/40 border border-red-500/40 flex items-center gap-3 shadow-lg shadow-red-950/40">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
              <div>
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block">ON STAGE NOW</span>
                <strong className="text-xs text-white truncate max-w-[180px] block">{activeLivePerformer.name}</strong>
              </div>
            </div>
          ) : (
            <div className="p-3 px-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
              <span className="text-xs text-slate-300 font-bold">Stage on Standby</span>
            </div>
          )}

          <button
            onClick={loadData}
            disabled={isRefreshing}
            className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-white/10 transition-all cursor-pointer"
            title="Refresh Leaderboard"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="max-w-7xl mx-auto flex items-center justify-center sm:justify-start gap-2 overflow-x-auto pb-2">
        {(['All', 'Solo', 'Duet', 'Group'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/25 scale-105'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {cat === 'All' ? '🏆 All Standings' : cat === 'Solo' ? '🎤 Solo Vocals' : cat === 'Duet' ? '👥 Duet Pairs' : '🏛️ Group Choirs'}
          </button>
        ))}
      </div>

      {/* Top 3 Esports Podium Showcase */}
      {topThree.length >= 3 && selectedCategory === 'All' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {/* #2 Silver Podium */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="antigravity-glass rounded-3xl p-6 border border-slate-400/30 flex flex-col justify-between order-2 md:order-1 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 font-mono font-black text-6xl text-slate-300">#2</div>
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-400/15 text-slate-300 border border-slate-400/30 inline-flex items-center gap-1">
                <Medal className="w-3.5 h-3.5 text-slate-300" /> Silver Medalist
              </span>
              <h3 className="text-xl font-black text-white">{topThree[1].name}</h3>
              <p className="text-xs text-slate-400">{topThree[1].churchOrTeam}</p>
            </div>
            <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Category: {topThree[1].category}</span>
              <span className="font-mono text-2xl font-black text-slate-200">{topThree[1].totalScore.toFixed(1)} <span className="text-xs text-slate-500">pts</span></span>
            </div>
          </motion.div>

          {/* #1 Gold Champion Podium */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="antigravity-glass rounded-3xl p-7 border-2 border-amber-500/60 shadow-2xl shadow-amber-500/10 flex flex-col justify-between order-1 md:order-2 relative overflow-hidden group md:-translate-y-2"
          >
            <div className="absolute top-0 right-0 p-4 opacity-15 font-mono font-black text-7xl text-amber-400">#1</div>
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-amber-300 border border-amber-500/50 inline-flex items-center gap-1.5 shadow-sm">
                <Crown className="w-3.5 h-3.5 text-amber-400 animate-bounce" /> Grand Champion
              </span>
              <h3 className="text-2xl font-black text-white text-glow-amber">{topThree[0].name}</h3>
              <p className="text-xs text-slate-300 font-medium">{topThree[0].churchOrTeam}</p>
            </div>
            <div className="pt-6 mt-4 border-t border-amber-500/20 flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Category: {topThree[0].category}</span>
              <span className="font-mono text-3xl font-black text-amber-400">{topThree[0].totalScore.toFixed(1)} <span className="text-xs text-amber-300/80">pts</span></span>
            </div>
          </motion.div>

          {/* #3 Bronze Podium */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="antigravity-glass rounded-3xl p-6 border border-amber-700/40 flex flex-col justify-between order-3 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 font-mono font-black text-6xl text-amber-700">#3</div>
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-amber-700/20 text-amber-400 border border-amber-700/40 inline-flex items-center gap-1">
                <Medal className="w-3.5 h-3.5 text-amber-500" /> Bronze Medalist
              </span>
              <h3 className="text-xl font-black text-white">{topThree[2].name}</h3>
              <p className="text-xs text-slate-400">{topThree[2].churchOrTeam}</p>
            </div>
            <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Category: {topThree[2].category}</span>
              <span className="font-mono text-2xl font-black text-amber-500">{topThree[2].totalScore.toFixed(1)} <span className="text-xs text-slate-500">pts</span></span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Full Leaderboard Table / Cards */}
      <div className="max-w-7xl mx-auto space-y-3">
        <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span>Rank & Performer</span>
          <span>Score Breakdown & Total</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">Synchronizing with Google Sheets...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">No contestant scores found in Google Sheet.</div>
        ) : (
          <AnimatePresence>
            {filtered.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.03 }}
                className={`antigravity-glass rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border transition-all ${
                  item.rank === 1
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : item.rank === 2
                    ? 'border-slate-400/30'
                    : item.rank === 3
                    ? 'border-amber-700/30'
                    : 'border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-sm shrink-0 ${
                    item.rank === 1
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                      : item.rank === 2
                      ? 'bg-slate-300 text-slate-950'
                      : item.rank === 3
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400'
                  }`}>
                    #{item.rank || idx + 1}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        {item.category}
                      </span>
                      <span className="text-xs font-mono text-slate-500">{item.code}</span>
                      {item.status === 'live' && (
                        <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded animate-pulse">
                          LIVE ON STAGE
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-base text-white truncate">{item.name}</h4>
                    <p className="text-xs text-slate-400 truncate">🏛️ {item.churchOrTeam}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  <div className="text-right space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Score</span>
                    <span className="font-mono text-2xl font-black text-cyan-400">{item.totalScore.toFixed(1)} <span className="text-xs text-slate-400 font-normal">pts</span></span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
