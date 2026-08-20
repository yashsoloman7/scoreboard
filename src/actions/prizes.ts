'use server';

// src/actions/prizes.ts - Individual Category Prizes, Tie-Breaker Engine & Password-Protected Publishing
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { revalidatePath } from 'next/cache';

export interface CategoryPrizeRank {
  rank: number;
  participantId: string;
  name: string;
  duetParticipant1?: string;
  duetParticipant2?: string;
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

export interface TieAlert {
  category: string;
  rank: number;
  score: number;
  tiedContestants: { id: string; name: string; churchName: string }[];
}

export interface EventPrizeStandings {
  eventId: string;
  eventName: string;
  soloStandings: CategoryPrizeRank[];
  duetStandings: CategoryPrizeRank[];
  groupStandings: CategoryPrizeRank[];
  keyboardistStandings: CategoryPrizeRank[];
  rhythmistStandings: CategoryPrizeRank[];
  guitaristStandings: CategoryPrizeRank[];
  churchOverallStandings: ChurchOverallRank[];
  ties: TieAlert[];
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
      .select('name, status')
      .eq('id', eventId)
      .single(),
  ]);

  if (!participants || participants.length === 0) {
    return {
      eventId,
      eventName: comp?.name || 'Championship Event',
      soloStandings: [],
      duetStandings: [],
      groupStandings: [],
      keyboardistStandings: [],
      rhythmistStandings: [],
      guitaristStandings: [],
      churchOverallStandings: [],
      ties: [],
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

  const churchMap = new Map<string, { solo: number; duet: number; group: number; inst: number }>();

  participants.forEach((p) => {
    const sc = participantScoreMap.get(p.id) || { total: 0, count: 0, keyScore: 0, rhythmScore: 0, guitarScore: 0 };
    
    // For Duet, format both names clearly
    let pName = p.participant_name || p.team_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (p.performance_type === 'duet') {
      if (p.first_name && p.last_name && p.first_name !== p.last_name) {
        pName = `${p.first_name} & ${p.last_name}`;
      }
    }

    const church = p.church_name || 'Independent Church';

    const rankItem: CategoryPrizeRank = {
      rank: 0,
      participantId: p.id,
      name: pName,
      duetParticipant1: p.first_name || undefined,
      duetParticipant2: p.last_name || undefined,
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

  const ties: TieAlert[] = [];

  // Helper rank assigner + tie finder
  const ranker = (list: CategoryPrizeRank[], categoryLabel: string) => {
    list.sort((a, b) => b.totalScore - a.totalScore);
    
    // Check top 3 ties
    const scoreMap = new Map<number, CategoryPrizeRank[]>();
    list.slice(0, 5).forEach((item) => {
      if (item.totalScore > 0) {
        const arr = scoreMap.get(item.totalScore) || [];
        arr.push(item);
        scoreMap.set(item.totalScore, arr);
      }
    });

    scoreMap.forEach((tiedGroup, score) => {
      if (tiedGroup.length > 1) {
        ties.push({
          category: categoryLabel,
          rank: list.indexOf(tiedGroup[0]) + 1,
          score,
          tiedContestants: tiedGroup.map((g) => ({ id: g.participantId, name: g.name, churchName: g.churchName })),
        });
      }
    });

    list.forEach((item, idx) => {
      item.rank = idx + 1;
      if (idx === 0) item.prizeTitle = `🥇 1st Place Winner - ${categoryLabel}`;
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
    eventName: comp?.name || 'Championship Event',
    soloStandings: rankedSolo,
    duetStandings: rankedDuet,
    groupStandings: rankedGroup,
    keyboardistStandings: rankedKeyboard,
    rhythmistStandings: rankedRhythm,
    guitaristStandings: rankedGuitar,
    churchOverallStandings: churchOverall,
    ties,
    isPublished: comp?.status === 'completed',
  };
}

/**
 * 2. Password-Protected Final Official Results Publication
 */
export async function verifyEventPasswordAndPublish(eventId: string, enteredPasscode: string) {
  const admin = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  const { data: comp } = await supabase
    .from('competitions')
    .select('id, name, settings:competition_settings(*)')
    .eq('id', eventId)
    .single();

  if (!comp) throw new Error('Event not found.');

  const storedPasscode = (comp.settings as any)?.publish_passcode;

  if (storedPasscode && storedPasscode.trim()) {
    if (enteredPasscode.trim() !== storedPasscode.trim()) {
      throw new Error('Invalid Event Security Password. The password entered does not match the event creation passkey.');
    }
  }

  // Update competition status to completed (published)
  const { error } = await supabase
    .from('competitions')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', eventId);

  if (error) throw new Error(`Failed to publish results: ${error.message}`);

  // Lock all event states
  await supabase.from('event_state').update({
    stage_mode: 'completed',
    is_judge_input_unlocked: false,
    timer_status: 'stopped',
    updated_at: new Date().toISOString(),
  }).eq('event_id', eventId);

  await supabase.from('audit_logs').insert({
    competition_id: eventId,
    actor_id: admin.id,
    action: 'PUBLISH_OFFICIAL_RESULTS_AUTHORIZED',
    entity: 'competitions',
    entity_id: eventId,
  });

  revalidatePath('/live');
  revalidatePath('/admin/control-room');
  revalidatePath('/admin/dashboard');

  return { success: true };
}

/**
 * 3. Generate CSV / Sheets Export for Official Results
 */
export async function exportEventResultsCSV(eventId: string): Promise<string> {
  const standings = await calculateEventPrizes(eventId);

  const rows: string[] = [];
  rows.push(`"OFFICIAL GRAND CHAMPIONSHIP RESULTS - ${standings.eventName}"`);
  rows.push(`"Generated on: ${new Date().toLocaleString()}"`);
  rows.push('');

  // 1. Overall Church Championship
  rows.push('"OVERALL CHURCH CHAMPIONSHIP RANKINGS"');
  rows.push('"Rank","Church Name","Solo Score","Duet Score","Group Score","Instruments Score","Grand Total","Prize Title"');
  standings.churchOverallStandings.forEach((c) => {
    rows.push(`"${c.rank}","${c.churchName}","${c.soloScore.toFixed(2)}","${c.duetScore.toFixed(2)}","${c.groupScore.toFixed(2)}","${c.instrumentsScore.toFixed(2)}","${c.grandTotal.toFixed(2)}","${c.prizeTitle || ''}"`);
  });

  rows.push('');
  // 2. Solo Category
  rows.push('"SOLO CATEGORY AWARDS"');
  rows.push('"Rank","Participant Name","Church Name","Total Score","Prize"');
  standings.soloStandings.forEach((s) => {
    rows.push(`"${s.rank}","${s.name}","${s.churchName}","${s.totalScore.toFixed(2)}","${s.prizeTitle || ''}"`);
  });

  rows.push('');
  // 3. Duet Category
  rows.push('"DUET CATEGORY AWARDS (BOTH PARTICIPANTS)"');
  rows.push('"Rank","Duet Singers","Church Name","Total Score","Prize"');
  standings.duetStandings.forEach((d) => {
    rows.push(`"${d.rank}","${d.name}","${d.churchName}","${d.totalScore.toFixed(2)}","${d.prizeTitle || ''}"`);
  });

  rows.push('');
  // 4. Group Category
  rows.push('"GROUP / CHOIR CATEGORY AWARDS"');
  rows.push('"Rank","Group Name","Church Name","Total Score","Prize"');
  standings.groupStandings.forEach((g) => {
    rows.push(`"${g.rank}","${g.name}","${g.churchName}","${g.totalScore.toFixed(2)}","${g.prizeTitle || ''}"`);
  });

  return rows.join('\n');
}
