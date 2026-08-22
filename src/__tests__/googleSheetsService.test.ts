import { describe, it, expect } from 'vitest';
import {
  getParticipantsFromSheet,
  submitScoreToSheet,
  updateParticipantSequenceInSheet,
  getLeaderboardFromSheet,
  SheetJudgeScoreInput,
} from '../lib/sheets/googleSheetsService';

describe('Google Sheets Competition Engine & RBAC Integration', () => {
  it('loads participant sequence and categories accurately', async () => {
    const participants = await getParticipantsFromSheet();
    expect(participants.length).toBeGreaterThan(0);
    expect(participants[0]).toHaveProperty('id');
    expect(participants[0]).toHaveProperty('category');
    expect(participants[0]).toHaveProperty('sequence');
  });

  it('records judge score and updates contestant total score for leaderboard calculation', async () => {
    const scoreInput: SheetJudgeScoreInput = {
      participantId: 'P-001',
      participantName: 'Pratush Hemrm',
      category: 'Solo',
      judgeEmail: 'judge1@example.com',
      judgeName: 'Chief Scrutineer',
      vocalScore: 92.5,
      presentationScore: 0,
      rhythmScore: 0,
      overallScore: 92.5,
      totalScore: 92.5,
      submittedAt: new Date().toISOString(),
    };

    const res = await submitScoreToSheet(scoreInput);
    expect(res.success).toBe(true);

    const leaderboard = await getLeaderboardFromSheet();
    const match = leaderboard.find((p) => p.id === 'P-001');
    expect(match).toBeDefined();
    expect(match?.totalScore).toBeGreaterThanOrEqual(92.5);
  });

  it('supports drag-and-drop sequence updates', async () => {
    const participants = await getParticipantsFromSheet();
    const reversed = [...participants].reverse().map((p, idx) => ({
      id: p.id,
      sequence: idx + 1,
    }));

    const updateRes = await updateParticipantSequenceInSheet(reversed);
    expect(updateRes.success).toBe(true);

    const reloaded = await getParticipantsFromSheet();
    expect(reloaded[0].id).toBe(reversed[0].id);
  });
});
