'use server';

// src/actions/sheets.ts - Next.js Server Actions for Google Sheets Integration

import {
  getParticipantsFromSheet,
  submitScoreToSheet,
  updateParticipantSequenceInSheet,
  updateParticipantStatusInSheet,
  getLeaderboardFromSheet,
  SheetJudgeScoreInput,
  SheetParticipant,
} from '@/lib/sheets/googleSheetsService';
import { revalidatePath } from 'next/cache';

export async function fetchSheetParticipantsAction(): Promise<SheetParticipant[]> {
  return await getParticipantsFromSheet();
}

export async function submitJudgeScoreAction(input: SheetJudgeScoreInput) {
  const res = await submitScoreToSheet(input);
  revalidatePath('/live');
  revalidatePath('/admin/staging');
  revalidatePath('/admin/control-room');
  return res;
}

export async function reorderSequenceAction(reorderedList: { id: string; sequence: number }[]) {
  const res = await updateParticipantSequenceInSheet(reorderedList);
  revalidatePath('/admin/staging');
  revalidatePath('/admin/control-room');
  revalidatePath('/live');
  return res;
}

export async function updatePerformerStatusAction(
  participantId: string,
  status: 'standby' | 'live' | 'completed' | 'on_deck'
) {
  const res = await updateParticipantStatusInSheet(participantId, status);
  revalidatePath('/admin/staging');
  revalidatePath('/admin/control-room');
  revalidatePath('/judge');
  revalidatePath('/live');
  return res;
}

export async function fetchSheetLeaderboardAction(): Promise<SheetParticipant[]> {
  return await getLeaderboardFromSheet();
}
