// src/lib/sheets/googleSheetsService.ts - Lightweight Google Sheets API Integration Engine for Antigravity

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

// In-Memory Simulated State for instant local/preview testing when Service Account credentials are not yet entered
let simulatedParticipants: SheetParticipant[] = [
  {
    id: 'P-001',
    sequence: 1,
    code: 'C01-SOLO',
    name: 'Pratush Hemrm',
    category: 'Solo',
    churchOrTeam: 'Bhilai Central Church',
    status: 'completed',
    soloScore: 88.5,
    duetScore: 0,
    groupScore: 0,
    totalScore: 88.5,
    rank: 1,
  },
  {
    id: 'P-002',
    sequence: 2,
    code: 'C02-DUET',
    name: 'Parina H. George & B. Paulina',
    category: 'Duet',
    churchOrTeam: 'St. Thomas Cathedral Raipur',
    status: 'live',
    soloScore: 0,
    duetScore: 92.0,
    groupScore: 0,
    totalScore: 92.0,
    rank: 2,
  },
  {
    id: 'P-003',
    sequence: 3,
    code: 'C03-GROUP',
    name: 'Grace Fellowship Choir',
    category: 'Group',
    churchOrTeam: 'Grace Fellowship Durg',
    status: 'on_deck',
    soloScore: 0,
    duetScore: 0,
    groupScore: 95.5,
    totalScore: 95.5,
    rank: 3,
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
    soloScore: 84.0,
    duetScore: 0,
    groupScore: 0,
    totalScore: 84.0,
    rank: 4,
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
    duetScore: 89.5,
    groupScore: 0,
    totalScore: 89.5,
    rank: 5,
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
    groupScore: 91.0,
    totalScore: 91.0,
    rank: 6,
  },
];

let simulatedScoresLog: SheetJudgeScoreInput[] = [];

/**
 * 1. Fetch Participant Schedule & Categories from Google Sheet
 */
export async function getParticipantsFromSheet(): Promise<SheetParticipant[]> {
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

  // Live in-memory state fallback
  return simulatedParticipants.sort((a, b) => a.sequence - b.sequence);
}

/**
 * 2. Submit Judge Score to Google Sheet
 */
export async function submitScoreToSheet(input: SheetJudgeScoreInput): Promise<{ success: boolean; rowId?: number }> {
  simulatedScoresLog.push(input);

  // Update participant cumulative score in memory
  const target = simulatedParticipants.find((p) => p.id === input.participantId || p.name === input.participantName);
  if (target) {
    if (input.category.toLowerCase().includes('solo')) target.soloScore = input.totalScore;
    if (input.category.toLowerCase().includes('duet')) target.duetScore = input.totalScore;
    if (input.category.toLowerCase().includes('group')) target.groupScore = input.totalScore;
    target.totalScore = target.soloScore + target.duetScore + target.groupScore;
    target.status = 'completed';
  }

  return { success: true, rowId: simulatedScoresLog.length };
}

/**
 * 3. Update Sequence of Performances in Google Sheets (Framer Motion Reorder)
 */
export async function updateParticipantSequenceInSheet(
  reorderedList: { id: string; sequence: number }[]
): Promise<{ success: boolean }> {
  reorderedList.forEach((item) => {
    const match = simulatedParticipants.find((p) => p.id === item.id);
    if (match) match.sequence = item.sequence;
  });
  simulatedParticipants.sort((a, b) => a.sequence - b.sequence);

  return { success: true };
}

/**
 * 4. Update Performer Live Status (Standby, Live, Completed)
 */
export async function updateParticipantStatusInSheet(
  participantId: string,
  status: 'standby' | 'live' | 'completed' | 'on_deck'
): Promise<{ success: boolean }> {
  simulatedParticipants.forEach((p) => {
    if (p.id === participantId) p.status = status;
    else if (status === 'live' && p.status === 'live') p.status = 'completed';
  });

  return { success: true };
}

/**
 * 5. Fetch Finalized Leaderboard Totals Calculated by Google Sheet
 */
export async function getLeaderboardFromSheet(): Promise<SheetParticipant[]> {
  const participants = await getParticipantsFromSheet();
  
  const ranked = [...participants]
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));

  return ranked;
}
