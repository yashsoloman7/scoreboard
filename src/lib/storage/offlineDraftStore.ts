// src/lib/storage/offlineDraftStore.ts - Client-side Local Draft Persistence & Resilient Queue

export interface OfflineDraft {
  performanceId: string;
  criteriaVersionId: string;
  scores: Record<string, number>;
  notes: Record<string, string>;
  idempotencyKey: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'agy_judge_draft_';

export const offlineDraftStore = {
  saveDraft(performanceId: string, criteriaVersionId: string, scores: Record<string, number>, notes: Record<string, string>, idempotencyKey: string) {
    if (typeof window === 'undefined') return;
    try {
      const draft: OfflineDraft = {
        performanceId,
        criteriaVersionId,
        scores,
        notes,
        idempotencyKey,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`${STORAGE_PREFIX}${performanceId}`, JSON.stringify(draft));
    } catch (e) {
      console.warn('[OfflineDraftStore] LocalStorage write failed', e);
    }
  },

  getDraft(performanceId: string): OfflineDraft | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${performanceId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  clearDraft(performanceId: string) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${performanceId}`);
    } catch {
      // safe
    }
  },
};
