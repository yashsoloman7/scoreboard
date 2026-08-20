'use client';

// src/app/live/page.tsx - Public Live Broadcast Scoreboard & Audited Leaderboard Portal
import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PublicLeaderboard } from '@/components/leaderboard/PublicLeaderboard';

export default function LiveScoreboardPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <PublicLeaderboard />
      </main>
    </div>
  );
}
