import { supabase } from '../supabase/client';

export interface SheetParticipant {
  id: string;
  sequence: number;
  code: string;
  name: string;
  category: 'Solo' | 'Duet' | 'Group';
  churchOrTeam: string;
  status: 'standby' | 'live' | 'completed' | 'on_deck';
  soloScore: number;
  duetScore: number;
  groupScore: number;
  totalScore: number;
  rank?: number;
  keyboardist?: string;
  rhythmist?: string;
  guitarist?: string;
}

export interface SheetJudgeScoreInput {
  participantId: string;
  participantName: string;
  category: string;
  judgeEmail: string;
  judgeName: string;
  vocalScore: number;
  presentationScore: number;
  rhythmScore: number;
  overallScore: number;
  totalScore: number;
  notes?: string;
  submittedAt: string;
}

// In-Memory Live State: Starts with 0.0 scores so only REAL judge submissions establish standings
let inMemoryParticipants: SheetParticipant[] = [
  {
    id: 'P-001',
    sequence: 1,
    code: 'C01-SOLO',
    name: 'Pratush Hemrm',
    category: 'Solo',
    churchOrTeam: 'Bhilai Central Church',
    status: 'standby',
    soloScore: 0,
    duetScore: 0,
    groupScore: 0,
    totalScore: 0,
  },
  {
    id: 'P-002',
    sequence: 2,
    code: 'C02-DUET',
    name: 'Parina H. George & B. Paulina',
    category: 'Duet',
    churchOrTeam: 'St. Thomas Cathedral Raipur',
    status: 'standby',
    soloScore: 0,
    duetScore: 0,
    groupScore: 0,
    totalScore: 0,
  },
  {
    id: 'P-003',
    sequence: 3,
    code: 'C03-GROUP',
    name: 'Grace Fellowship Choir',
    category: 'Group',
    churchOrTeam: 'Grace Fellowship Durg',
    status: 'standby',
    soloScore: 0,
    duetScore: 0,
    groupScore: 0,
    totalScore: 0,
    keyboardist: 'John Samuel',
    rhythmist: 'David Raj',
    guitarist: 'Philip K.',
  },
  {
    id: 'P-004',
    sequence: 4,
    code: 'C04-SOLO',
    name: 'A. Nageshwar Rao',
    category: 'Solo',
    churchOrTeam: 'Bethel Assembly Bhilai',
    status: 'standby',
    soloScore: 0,
    duetScore: 0,
    groupScore: 0,
    totalScore: 0,
  },
  {
    id: 'P-005',
    sequence: 5,
    code: 'C05-DUET',
    name: 'Raj Abhishek Singh & Shifa Masih',
    category: 'Duet',
    churchOrTeam: 'Emmanuel Methodist Bilaspur',
    status: 'standby',
    soloScore: 0,
    duetScore: 0,
    groupScore: 0,
    totalScore: 0,
  },
  {
    id: 'P-006',
    sequence: 6,
    code: 'C06-GROUP',
    name: 'Zion City Worship Choir',
    category: 'Group',
    churchOrTeam: 'Zion City Church Nagpur',
    status: 'standby',
    soloScore: 0,
    duetScore: 0,
    groupScore: 0,
    totalScore: 0,
  },
];

let submittedScoresLog: SheetJudgeScoreInput[] = [];

/**
 * 1. Fetch Participant Schedule & Categories (Checking Supabase DB -> Google Sheets REST -> Memory Fallback)
 */
export async function getParticipantsFromSheet(): Promise<SheetParticipant[]> {
  // If running in test environment, return in-memory live state directly
  if (process.env.NODE_ENV === 'test') {
    return inMemoryParticipants.sort((a, b) => a.sequence - b.sequence);
  }

  // A. Check Supabase Database for Real Imported Participants & Submitted Scores
  try {
    const dbPromise = supabase
      .from('performances')
      .select(`
        id,
        performance_order,
        performance_code,
        status,
        participant:participants(id, first_name, last_name, institution),
        team:teams(id, name, institution),
        score_submissions(total_raw_score, total_weighted_score, status)
      `)
      .order('performance_order', { ascending: true });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('DB Query Timeout')), 1500)
    );

    const { data: dbPerformances } = await Promise.race([dbPromise, timeoutPromise]) as any;

    if (dbPerformances && dbPerformances.length > 0) {
      return dbPerformances.map((perf: any, idx: number) => {
        const isTeam = !!perf.team;
        const name = isTeam
          ? perf.team?.name || 'Choir Team'
          : `${perf.participant?.first_name || ''} ${perf.participant?.last_name || ''}`.trim() || 'Performer';
        const church = isTeam ? perf.team?.institution : perf.participant?.institution;
        
        let category: 'Solo' | 'Duet' | 'Group' = 'Solo';
        if (isTeam || name.toLowerCase().includes('choir') || name.toLowerCase().includes('group')) {
          category = 'Group';
        } else if (name.includes('&') || name.toLowerCase().includes('duet')) {
          category = 'Duet';
        }

        // Calculate real average score from valid judge submissions
        const validScores = (perf.score_submissions || [])
          .filter((s: any) => s.status === 'locked' || s.status === 'submitted')
          .map((s: any) => Number(s.total_weighted_score || s.total_raw_score) || 0);

        const avgScore = validScores.length > 0
          ? Number((validScores.reduce((acc: number, curr: number) => acc + curr, 0) / validScores.length).toFixed(2))
          : 0;

        let status: 'standby' | 'live' | 'completed' | 'on_deck' = 'standby';
        if (perf.status === 'performing') status = 'live';
        else if (perf.status === 'on_deck') status = 'on_deck';
        else if (perf.status === 'completed' || validScores.length > 0) status = 'completed';

        return {
          id: perf.id,
          sequence: perf.performance_order || idx + 1,
          code: perf.performance_code || `ACT-${idx + 1}`,
          name,
          category,
          churchOrTeam: church || 'Independent',
          status,
          soloScore: category === 'Solo' ? avgScore : 0,
          duetScore: category === 'Duet' ? avgScore : 0,
          groupScore: category === 'Group' ? avgScore : 0,
          totalScore: avgScore,
        };
      });
    }
  } catch (dbErr) {
    console.warn('[Database Participant Query]', dbErr);
  }

  // B. Check Google Sheets REST API if credentials provided
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY;

  if (sheetId && apiKey) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Participants!A2:K100?key=${apiKey}`;
      const res = await fetch(url, { next: { revalidate: 2 } });
      if (res.ok) {
        const data = await res.json();
        const rows = data.values as string[][];
        if (rows && rows.length > 0) {
          return rows.map((row, idx) => ({
            id: row[0] || `P-${(idx + 1).toString().padStart(3, '0')}`,
            sequence: Number(row[1]) || idx + 1,
            code: row[2] || `ACT-${idx + 1}`,
            name: row[3] || 'Performer',
            category: (row[4] as any) || 'Solo',
            churchOrTeam: row[5] || 'Independent',
            status: (row[6] as any) || 'standby',
            soloScore: Number(row[7]) || 0,
            duetScore: Number(row[8]) || 0,
            groupScore: Number(row[9]) || 0,
            totalScore: Number(row[10]) || 0,
          }));
        }
      }
    } catch (error) {
      console.warn('[Google Sheets REST API Warning]', error);
    }
  }

  // C. In-Memory Live State
  return inMemoryParticipants.sort((a, b) => a.sequence - b.sequence);
}

/**
 * 2. Submit Judge Score to Google Sheet / Live Engine
 */
export async function submitScoreToSheet(input: SheetJudgeScoreInput): Promise<{ success: boolean; rowId?: number }> {
  submittedScoresLog.push(input);

  // Update participant cumulative score in memory
  const target = inMemoryParticipants.find(
    (p) => p.id === input.participantId || p.name.toLowerCase() === input.participantName.toLowerCase()
  );
  
  if (target) {
    const finalScore = Number(input.totalScore.toFixed(2));
    if (input.category.toLowerCase().includes('solo')) target.soloScore = finalScore;
    else if (input.category.toLowerCase().includes('duet')) target.duetScore = finalScore;
    else if (input.category.toLowerCase().includes('group')) target.groupScore = finalScore;
    
    target.totalScore = finalScore;
    target.status = 'completed';
  }

  return { success: true, rowId: submittedScoresLog.length };
}

/**
 * 3. Update Sequence of Performances (Framer Motion Drag & Drop)
 */
export async function updateParticipantSequenceInSheet(
  reorderedList: { id: string; sequence: number }[]
): Promise<{ success: boolean }> {
  reorderedList.forEach((item) => {
    const match = inMemoryParticipants.find((p) => p.id === item.id);
    if (match) match.sequence = item.sequence;
  });
  inMemoryParticipants.sort((a, b) => a.sequence - b.sequence);

  return { success: true };
}

/**
 * 4. Update Performer Live Stage Status
 */
export async function updateParticipantStatusInSheet(
  participantId: string,
  status: 'standby' | 'live' | 'completed' | 'on_deck'
): Promise<{ success: boolean }> {
  inMemoryParticipants.forEach((p) => {
    if (p.id === participantId) p.status = status;
    else if (status === 'live' && p.status === 'live') p.status = 'completed';
  });

  return { success: true };
}

/**
 * 5. Fetch Real Leaderboard Standings Calculated from Real Submitted Scores
 */
export async function getLeaderboardFromSheet(): Promise<SheetParticipant[]> {
  const participants = await getParticipantsFromSheet();
  
  // Real standings sorting:
  // 1. Acts with real submitted scores (totalScore > 0) are ranked highest to lowest
  // 2. Acts awaiting scores (totalScore == 0) are ordered by stage sequence
  const scoredActs = participants.filter((p) => p.totalScore > 0);
  const pendingActs = participants.filter((p) => p.totalScore === 0);

  scoredActs.sort((a, b) => b.totalScore - a.totalScore);
  pendingActs.sort((a, b) => a.sequence - b.sequence);

  // Assign sequential rank to scored acts
  const rankedScored = scoredActs.map((p, idx) => ({
    ...p,
    rank: idx + 1,
  }));

  // Combine scored acts with pending acts
  return [...rankedScored, ...pendingActs];
}
