'use server';

// src/actions/prizes.ts - Individual Category Prizes & Overall Church Championship Adjudication
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { revalidatePath } from 'next/cache';

export interface CategoryPrizeRank {
  rank: number;
  participantId: string;
  name: string;
  churchName: string;
  performanceType: string;
  totalScore: number;
  judgeCount: number;
  prizeTitle?: string;
  instrumentalists?: {
    keyboardist?: string | null;
    rhythmist?: string | null;
    guitarist?: string | null;
  };
}

export interface ChurchOverallRank {
  rank: number;
  churchName: string;
  soloScore: number;
  duetScore: number;
  groupScore: number;
  instrumentsScore: number;
  grandTotal: number;
  prizeTitle?: string;
}

export interface EventPrizeStandings {
  eventId: string;
  soloStandings: CategoryPrizeRank[];
  duetStandings: CategoryPrizeRank[];
  groupStandings: CategoryPrizeRank[];
  keyboardistStandings: CategoryPrizeRank[];
  rhythmistStandings: CategoryPrizeRank[];
  guitaristStandings: CategoryPrizeRank[];
  churchOverallStandings: ChurchOverallRank[];
  isPublished: boolean;
}

export async function calculateEventPrizes(eventId: string): Promise<EventPrizeStandings> {
  const supabase = await createServerSupabaseClient();

  const [{ data: participants }, { data: scores }, { data: comp }] = await Promise.all([
    supabase
      .from('participants')
      .select('*')
      .eq('competition_id', eventId)
      .neq('environment', 'practice'),
    supabase
      .from('scores')
      .select('*')
      .eq('event_id', eventId),
    supabase
      .from('competitions')
      .select('status')
      .eq('id', eventId)
      .single(),
  ]);

  if (!participants || participants.length === 0) {
    return {
      eventId,
      soloStandings: [],
      duetStandings: [],
      groupStandings: [],
      keyboardistStandings: [],
      rhythmistStandings: [],
      guitaristStandings: [],
      churchOverallStandings: [],
      isPublished: comp?.status === 'completed',
    };
  }

  // 1. Group scores by participant
  const participantScoreMap = new Map<string, { total: number; count: number; keyScore: number; rhythmScore: number; guitarScore: number }>();

  (scores || []).forEach((sc) => {
    const prev = participantScoreMap.get(sc.participant_id) || { total: 0, count: 0, keyScore: 0, rhythmScore: 0, guitarScore: 0 };
    participantScoreMap.set(sc.participant_id, {
      total: prev.total + Number(sc.total_score || 0),
      count: prev.count + 1,
      keyScore: prev.keyScore + Number(sc.keyboardist_score || 0),
      rhythmScore: prev.rhythmScore + Number(sc.rhythmist_score || 0),
      guitarScore: prev.guitarScore + Number(sc.guitarist_score || 0),
    });
  });

  // 2. Separate into Solo, Duet, Group
  const soloList: CategoryPrizeRank[] = [];
  const duetList: CategoryPrizeRank[] = [];
  const groupList: CategoryPrizeRank[] = [];
  const keyboardList: CategoryPrizeRank[] = [];
  const rhythmList: CategoryPrizeRank[] = [];
  const guitarList: CategoryPrizeRank[] = [];

  // Group by Church for Overall Championship
  const churchMap = new Map<string, { solo: number; duet: number; group: number; inst: number }>();

  participants.forEach((p) => {
    const sc = participantScoreMap.get(p.id) || { total: 0, count: 0, keyScore: 0, rhythmScore: 0, guitarScore: 0 };
    const pName = p.participant_name || p.team_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const church = p.church_name || 'Independent Church';

    const rankItem: CategoryPrizeRank = {
      rank: 0,
      participantId: p.id,
      name: pName,
      churchName: church,
      performanceType: p.performance_type,
      totalScore: sc.total,
      judgeCount: sc.count,
      instrumentalists: {
        keyboardist: p.best_keyboardist,
        rhythmist: p.best_rhythmist,
        guitarist: p.best_guitarist,
      },
    };

    // Update Church scores
    const cData = churchMap.get(church) || { solo: 0, duet: 0, group: 0, inst: 0 };
    if (p.performance_type === 'solo') {
      soloList.push(rankItem);
      cData.solo += sc.total;
    } else if (p.performance_type === 'duet') {
      duetList.push(rankItem);
      cData.duet += sc.total;
    } else if (p.performance_type === 'group') {
      groupList.push(rankItem);
      cData.group += (sc.total - sc.keyScore - sc.rhythmScore - sc.guitarScore);
      cData.inst += (sc.keyScore + sc.rhythmScore + sc.guitarScore);

      if (p.best_keyboardist && sc.keyScore > 0) {
        keyboardList.push({ ...rankItem, name: p.best_keyboardist, totalScore: sc.keyScore });
      }
      if (p.best_rhythmist && sc.rhythmScore > 0) {
        rhythmList.push({ ...rankItem, name: p.best_rhythmist, totalScore: sc.rhythmScore });
      }
      if (p.best_guitarist && sc.guitarScore > 0) {
        guitarList.push({ ...rankItem, name: p.best_guitarist, totalScore: sc.guitarScore });
      }
    }
    churchMap.set(church, cData);
  });

  // Helper rank assigner
  const ranker = (list: CategoryPrizeRank[], categoryLabel: string) => {
    list.sort((a, b) => b.totalScore - a.totalScore);
    list.forEach((item, idx) => {
      item.rank = idx + 1;
      if (idx === 0) item.prizeTitle = `🥇 1st Place Champion - ${categoryLabel}`;
      else if (idx === 1) item.prizeTitle = `🥈 2nd Place Runner-Up - ${categoryLabel}`;
      else if (idx === 2) item.prizeTitle = `🥉 3rd Place - ${categoryLabel}`;
      else item.prizeTitle = `Participant`;
    });
    return list;
  };

  const rankedSolo = ranker(soloList, 'Solo');
  const rankedDuet = ranker(duetList, 'Duet');
  const rankedGroup = ranker(groupList, 'Group Choir');
  const rankedKeyboard = ranker(keyboardList, 'Best Keyboardist');
  const rankedRhythm = ranker(rhythmList, 'Best Rhythmist');
  const rankedGuitar = ranker(guitarList, 'Best Guitarist');

  // Overall Church Championship Ranking
  const churchOverall: ChurchOverallRank[] = Array.from(churchMap.entries()).map(([churchName, data]) => ({
    rank: 0,
    churchName,
    soloScore: data.solo,
    duetScore: data.duet,
    groupScore: data.group,
    instrumentsScore: data.inst,
    grandTotal: data.solo + data.duet + data.group + data.inst,
  }));

  churchOverall.sort((a, b) => b.grandTotal - a.grandTotal);
  churchOverall.forEach((item, idx) => {
    item.rank = idx + 1;
    if (idx === 0) item.prizeTitle = '🏆 Grand Rolling Championship Trophy (1st Place)';
    else if (idx === 1) item.prizeTitle = '🥈 Overall 2nd Place Trophy';
    else if (idx === 2) item.prizeTitle = '🥉 Overall 3rd Place Trophy';
  });

  return {
    eventId,
    soloStandings: rankedSolo,
    duetStandings: rankedDuet,
    groupStandings: rankedGroup,
    keyboardistStandings: rankedKeyboard,
    rhythmistStandings: rankedRhythm,
    guitaristStandings: rankedGuitar,
    churchOverallStandings: churchOverall,
    isPublished: comp?.status === 'completed',
  };
}

/**
 * Admin Action to Publish Official Results
 */
export async function publishEventResults(eventId: string) {
  const admin = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('competitions')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', eventId);

  if (error) throw new Error(`Failed to publish results: ${error.message}`);

  await supabase.from('audit_logs').insert({
    competition_id: eventId,
    actor_id: admin.id,
    action: 'PUBLISH_OFFICIAL_RESULTS',
    entity: 'competitions',
    entity_id: eventId,
  });

  revalidatePath('/live');
  revalidatePath('/admin/control-room');
  revalidatePath('/admin/dashboard');

  return { success: true };
}
